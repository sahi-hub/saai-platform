/**
 * Assistant Controller
 * 
 * Handles unified assistant queries for SAAI platform:
 * - Text-based chat queries
 * - Image-based visual search using Gemini Flash Vision
 * 
 * POST /assistant/query
 * 
 * Request body:
 * - tenantId: string (required) - Tenant identifier
 * - sessionId: string (optional) - Session ID for rate limiting
 * - message: string (optional) - User text message
 * - imageBase64: string (optional) - Base64-encoded image data
 * - history: Array (optional) - Conversation history [{role: 'user'|'assistant', content: string}]
 * 
 * At least one of message or imageBase64 must be provided.
 * 
 * Response format:
 * {
 *   success: boolean,
 *   reply: string,
 *   matchedProductIds: string[],
 *   error?: string
 * }
 */

const { loadProductsForTenant } = require('../utils/productLoader');
const { callGeminiFlashVision } = require('../llm/geminiVisionClient');
const { canProceed, getStats } = require('../utils/rateLimiter');
const { addLog } = require('../debug/logger');
const { getOrCreateProfile } = require('../personalization/profileStore');
const { updateProfileFromProducts, buildProfileSummary } = require('../personalization/profileUpdater');
const { getSessionContext, saveSessionContext } = require('../personalization/sessionContextStore');
const { buildRecentProductsContext } = require('../personalization/recentProductsFormatter');

// Use same model constant as geminiVisionClient
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/**
 * Build compact product context for LLM prompt
 * Keeps only essential fields to minimize token usage (~8KB max)
 * 
 * @param {Array} products - Full product array from catalog
 * @returns {string} - JSON string of compact product context
 */
function buildProductContext(products) {
  const compact = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: (p.description || '').slice(0, 100),
    category: p.category || '',
    price: p.price || 0,
    tags: Array.isArray(p.tags) ? p.tags.slice(0, 5) : []
  }));

  // Truncate to ~8KB to avoid token overflow
  let json = JSON.stringify(compact);
  if (json.length > 8000) {
    // Reduce products until under limit
    const reduced = compact.slice(0, Math.floor(compact.length * (8000 / json.length)));
    json = JSON.stringify(reduced);
  }

  return json;
}

/**
 * Parse and validate LLM response
 * Ensures matchedProductIds only contains valid product IDs from catalog
 * 
 * @param {Object} llmResult - Result from Gemini Vision client
 * @param {Array} products - Full product array for validation
 * @returns {Object} - { reply, matchedProductIds }
 */
function parseAndValidateLLMResult(llmResult, products) {
  const validIds = new Set(products.map((p) => p.id));
  
  const reply = llmResult.message || 'I found some items that might interest you.';
  
  let matchedProductIds = [];
  if (Array.isArray(llmResult.matchedProductIds)) {
    // Filter to only valid product IDs
    matchedProductIds = llmResult.matchedProductIds.filter((id) => validIds.has(id));
  }

  return { reply, matchedProductIds };
}

/**
 * Build prompt based on query type (text, image, or combined)
 * 
 * @param {string|null} message - User text message
 * @param {string|null} imageBase64 - Base64-encoded image
 * @returns {string} - Prompt for LLM
 */
function buildPrompt(message, imageBase64) {
  if (imageBase64 && message) {
    return `The user has provided an image and a message: "${message}". 
Analyze the image and the message together. If the image shows clothing or fashion items, 
find similar or matching products from the catalog. Consider the user's message for additional context.`;
  }
  
  if (imageBase64) {
    return `The user has provided an image. Analyze this image and if it shows clothing, 
fashion items, or style elements, find similar or matching products from the catalog. 
Describe what you see and suggest relevant items.`;
  }
  
  return message;
}

/**
 * Load recent products context from previous session for reference resolution
 * 
 * @param {string} tenantId - Tenant ID
 * @param {string|null} sessionId - Session ID
 * @returns {{ previousContext: Object|null, recentProductsContext: string|null }}
 */
function loadRecentProductsContext(tenantId, sessionId) {
  const previousContext = getSessionContext(tenantId, sessionId);
  let recentProductsContext = null;
  
  if (previousContext?.lastProducts?.length > 0) {
    recentProductsContext = buildRecentProductsContext(
      previousContext.lastProducts,
      previousContext.lastMatchedProductIds || []
    );
    console.log(`[Assistant] Loaded ${previousContext.lastProducts.length} recent products for reference resolution`);
  }
  
  return { previousContext, recentProductsContext };
}

/**
 * Save session context after processing query
 * Persists product context for next turn's reference resolution
 * 
 * @param {Object} params - Save parameters
 */
function saveSessionAfterQuery({ tenantId, sessionId, products, matchedProductIds, previousContext, message }) {
  const matchedProducts = products.filter((p) => matchedProductIds.includes(p.id));
  
  saveSessionContext({
    tenantId,
    sessionId: sessionId || null,
    lastProducts: matchedProducts.length > 0 ? matchedProducts : (previousContext?.lastProducts || []),
    lastMatchedProductIds: matchedProducts.length > 0 ? matchedProductIds : (previousContext?.lastMatchedProductIds || []),
    lastUserMessage: message || '[image query]'
  });
}

/**
 * Handle assistant query
 * 
 * POST /assistant/query
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function handleAssistantQuery(req, res) {
  const startTime = Date.now();

  try {
    const { tenantId, sessionId, message, imageBase64, history } = req.body;

    // Validate required fields
    if (!tenantId) {
      return res.status(200).json({
        success: false,
        error: 'Missing required field: tenantId',
        reply: null,
        matchedProductIds: []
      });
    }

    if (!message && !imageBase64) {
      return res.status(200).json({
        success: false,
        error: 'At least one of message or imageBase64 is required',
        reply: null,
        matchedProductIds: []
      });
    }

    // Rate limiting check (use sessionId or IP as key)
    const rateLimitKey = sessionId || req.ip || 'anonymous';
    if (!canProceed(rateLimitKey)) {
      const stats = getStats(rateLimitKey);
      console.log(`[Assistant] Rate limit exceeded for key: ${rateLimitKey}`, stats);
      
      addLog({
        tenantId,
        sessionId: sessionId || null,
        userMessage: message || '[image query]',
        error: true,
        errorMessage: 'Rate limit exceeded'
      });

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again in a minute.',
        reply: null,
        matchedProductIds: []
      });
    }

    console.log(`[Assistant] Processing query for tenant: ${tenantId}`);
    console.log(`[Assistant] Message: "${message || '[image only]'}"`);
    console.log(`[Assistant] Has image: ${!!imageBase64}`);
    if (sessionId) {
      console.log(`[Assistant] Session ID: ${sessionId}`);
    }

    // Load products for the tenant
    const products = await loadProductsForTenant(tenantId);
    if (!products || products.length === 0) {
      return res.status(200).json({
        success: false,
        error: 'No products found for this tenant',
        reply: null,
        matchedProductIds: []
      });
    }

    console.log(`[Assistant] Loaded ${products.length} products for context`);

    // Load or create user preference profile
    const profile = getOrCreateProfile(tenantId, sessionId || null);
    const profileSummary = buildProfileSummary(profile);
    
    if (profileSummary) {
      console.log(`[Assistant] Profile loaded: ${profile.interactionCount} interactions`);
    }

    // Load previous session context for conversational commerce
    const { previousContext, recentProductsContext } = loadRecentProductsContext(tenantId, sessionId || null);

    // Build compact product context for LLM
    const productContext = buildProductContext(products);

    // Build prompt based on query type
    const prompt = buildPrompt(message, imageBase64);

    // Call Gemini Flash Vision
    const llmResult = await callGeminiFlashVision({
      prompt,
      imageBase64: imageBase64 || null,
      productContext,
      profileContext: profileSummary,
      recentProductsContext,
      history: Array.isArray(history) ? history : []
    });

    // Parse and validate result
    const { reply, matchedProductIds } = parseAndValidateLLMResult(llmResult, products);

    // Update user profile based on matched products (learn preferences)
    if (matchedProductIds.length > 0) {
      updateProfileFromProducts({
        tenantId,
        sessionId: sessionId || null,
        products,
        matchedProductIds
      });
    }

    // Save session context for conversational commerce (reference resolution)
    // Store full product objects for matched products so we can build indexed context next turn
    const matchedProducts = products.filter((p) => matchedProductIds.includes(p.id));
    saveSessionContext(tenantId, sessionId || null, {
      lastProducts: matchedProducts.length > 0 ? matchedProducts : (previousContext?.lastProducts || []),
      lastMatchedProductIds: matchedProductIds.length > 0 ? matchedProductIds : (previousContext?.lastMatchedProductIds || []),
      lastUserMessage: message || '[image query]'
    });

    const duration = Date.now() - startTime;
    console.log(`[Assistant] Query completed in ${duration}ms`);
    console.log(`[Assistant] Matched ${matchedProductIds.length} products`);

    // Log successful query
    addLog({
      tenantId,
      sessionId: sessionId || null,
      userMessage: message || '[image query]',
      replyType: 'assistant',
      llmProvider: 'google',
      llmModel: GEMINI_MODEL,
      llmText: reply,
      toolSummary: {
        hasImage: !!imageBase64,
        matchedProductCount: matchedProductIds.length,
        matchedProductIds,
        durationMs: duration
      }
    });

    return res.status(200).json({
      success: true,
      reply,
      matchedProductIds
    });

  } catch (error) {
    console.error('[Assistant] Error in handleAssistantQuery:', error);

    // Log the error
    addLog({
      tenantId: req.body?.tenantId || 'unknown',
      sessionId: req.body?.sessionId || null,
      userMessage: req.body?.message || '[image query]',
      error: true,
      errorMessage: error?.message || 'Unknown error in handleAssistantQuery'
    });

    // Return 200 with success: false to prevent UI freezes
    return res.status(200).json({
      success: false,
      error: error.message || 'An unexpected error occurred',
      reply: null,
      matchedProductIds: []
    });
  }
}

module.exports = {
  handleAssistantQuery
};
