/**
 * SAAI LLM Orchestrator - Streaming Version
 * 
 * Provides real-time streaming responses for better UX.
 * Uses SSE (Server-Sent Events) to stream text as it's generated.
 * 
 * Flow:
 * 1. Detect if forced tool routing applies
 * 2. Execute tool if needed
 * 3. Stream the grounded explanation in real-time
 * 
 * Note: Uses template-based responses for Stage 2 to maximize speed.
 * This skips the second LLM call, reducing latency by ~300-800ms.
 */

const { runAction } = require('./tools');
const { buildMessages, runLLMWithTools } = require('../llm/llmRouter');
const { getOrCreateProfile } = require('../personalization/profileStore');
const { updateProfileFromProducts, buildProfileSummary } = require('../personalization/profileUpdater');
const { getSessionContext, saveSessionContext } = require('../personalization/sessionContextStore');
const { buildRecentProductsContext } = require('../personalization/recentProductsFormatter');
const { detectForcedTool, isGreetingOnly, buildSystemPrompt } = require('./llm');

/**
 * Run the LLM orchestrator with streaming support
 * 
 * @param {Object} options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {Object} options.actionRegistry - Action registry
 * @param {string} options.userMessage - User message
 * @param {Array} options.conversationHistory - Conversation history
 * @param {string} options.sessionId - Session ID
 * @param {Function} options.onChunk - Callback for each text chunk
 * @param {Function} options.onTool - Callback when tool is called
 * @param {Function} options.onProducts - Callback when products are returned
 * @param {Function} options.onComplete - Callback when complete
 * @param {Function} options.onError - Callback on error
 */
async function runLLMOrchestratorStreaming({
  tenantConfig,
  actionRegistry,
  userMessage,
  conversationHistory = [],
  sessionId = null,
  onChunk,
  onTool,
  onProducts,
  onComplete,
  onError
}) {
  console.log('[Orchestrator-Stream] Starting streaming pipeline');
  
  const tenantId = tenantConfig.tenantId || tenantConfig.id || 'default';
  const profile = getOrCreateProfile(tenantId, sessionId);
  const sessionContext = getSessionContext(tenantId, sessionId);
  
  const profileSummary = buildProfileSummary(profile);
  const recentProductsContext = sessionContext 
    ? buildRecentProductsContext(sessionContext.lastProducts, sessionContext.lastMatchedProductIds)
    : '';

  try {
    // Check for forced tool routing
    const forcedTool = detectForcedTool(userMessage);
    
    let toolResult = null;
    let actionName = null;
    let params = {};

    if (forcedTool) {
      actionName = forcedTool.name;
      params = { ...forcedTool.arguments, sessionId };
      
      onTool?.(actionName, params);
      console.log(`[Orchestrator-Stream] Executing forced tool: ${actionName}`);
      
      toolResult = await runAction({
        tenantConfig,
        actionRegistry,
        action: actionName,
        params
      });

      // Send products immediately
      const products = extractProducts(toolResult);
      if (products.length > 0) {
        onProducts?.(products, actionName);
        
        // Update session context
        saveSessionContext(tenantId, sessionId, {
          lastProducts: products,
          lastMatchedProductIds: products.slice(0, 5).map(p => p.id)
        });
        
        // Update profile for personalization
        updateProfileFromProducts(tenantId, sessionId, products, userMessage);
      }
    } else if (isGreetingOnly(userMessage)) {
      // Handle greeting - stream simple response
      await streamGreetingResponse(userMessage, onChunk);
      onComplete?.({ type: 'message', provider: 'template' });
      return;
    } else {
      // Use LLM for tool decision (non-streaming for Stage 1)
      const systemPrompt = buildSystemPrompt(tenantConfig, profileSummary, recentProductsContext);
      const messages = buildMessages({
        systemPrompt,
        userMessage,
        conversationHistory
      });

      const llmDecision = await runLLMWithTools({
        messages,
        tenantConfig,
        actionRegistry
      });

      if (llmDecision.decision === 'message') {
        // No tool needed - stream the message
        await streamTextChunks(llmDecision.text || '', onChunk);
        onComplete?.({ 
          type: 'message', 
          provider: llmDecision.provider,
          model: llmDecision.model 
        });
        return;
      }

      // Tool was called
      actionName = llmDecision.tool?.name;
      params = llmDecision.tool?.arguments || {};
      if (sessionId) params.sessionId = sessionId;
      
      onTool?.(actionName, params);
      
      toolResult = await runAction({
        tenantConfig,
        actionRegistry,
        action: actionName,
        params
      });

      const products = extractProducts(toolResult);
      if (products.length > 0) {
        onProducts?.(products, actionName);
        
        saveSessionContext(tenantId, sessionId, {
          lastProducts: products,
          lastMatchedProductIds: products.slice(0, 5).map(p => p.id)
        });
        
        updateProfileFromProducts(tenantId, sessionId, products, userMessage);
      }
    }

    // Stream the grounded explanation
    if (toolResult) {
      await streamGroundedExplanation({
        userMessage,
        action: actionName,
        toolResult,
        onChunk
      });
    }

    onComplete?.({
      type: 'tool_result',
      action: actionName,
      provider: 'groq'
    });

  } catch (error) {
    console.error('[Orchestrator-Stream] Error:', error.message);
    onError?.(error.message);
  }
}

/**
 * Extract products array from tool result
 */
function extractProducts(toolResult) {
  if (!toolResult) return [];
  
  let products = toolResult.items || toolResult.results || toolResult.products || [];
  
  // Handle outfit object format
  if (products && typeof products === 'object' && !Array.isArray(products)) {
    products = Object.values(products).filter(p => p && p.id);
  }
  
  return Array.isArray(products) ? products : [];
}

/**
 * Stream greeting response with simulated typing
 */
async function streamGreetingResponse(userMessage, onChunk) {
  const greetings = [
    "Hey! What are you looking for today? 👋",
    "Hi there! Ready to help you find something great. What's on your mind?",
    "Hello! What can I help you discover today?",
    "Hey! Looking for something specific or just browsing?"
  ];
  
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  await streamTextChunks(greeting, onChunk);
}

/**
 * Stream text in chunks to simulate typing
 */
async function streamTextChunks(text, onChunk, chunkSize = 3) {
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    onChunk?.(chunk + (i + chunkSize < words.length ? ' ' : ''));
    // Small delay between chunks for natural feel
    await new Promise(r => setTimeout(r, 30));
  }
}

/**
 * Stream grounded explanation based on tool results
 * Uses templates for speed instead of LLM call
 */
async function streamGroundedExplanation({ userMessage, action, toolResult, onChunk }) {
  let explanation = '';
  
  if (action === 'recommend_outfit') {
    explanation = buildOutfitExplanation(toolResult, userMessage);
  } else if (action === 'search_products' || action === 'recommend_products') {
    explanation = buildProductsExplanation(toolResult, userMessage);
  } else if (action === 'add_to_cart') {
    explanation = buildCartExplanation(toolResult);
  } else if (action === 'compare_products') {
    explanation = buildComparisonExplanation(toolResult);
  } else {
    explanation = "Here's what I found for you!";
  }
  
  await streamTextChunks(explanation, onChunk);
}

/**
 * Build outfit explanation
 */
function buildOutfitExplanation(toolResult, userMessage) {
  const items = toolResult.items || {};
  const parts = [];
  
  if (items.shirt) parts.push(`the **${items.shirt.name}**`);
  if (items.pant) parts.push(`**${items.pant.name}**`);
  if (items.shoe) parts.push(`**${items.shoe.name}**`);
  
  if (parts.length === 0) return "I couldn't find a complete outfit for that request.";
  
  const itemList = parts.length > 1 
    ? parts.slice(0, -1).join(', ') + ' and ' + parts.slice(-1)
    : parts[0];
  
  const occasion = extractOccasion(userMessage);
  const occasionText = occasion ? ` for ${occasion}` : '';
  
  return `I've put together a great outfit${occasionText} with ${itemList}. These pieces work well together and match your style!`;
}

/**
 * Build products explanation
 */
function buildProductsExplanation(toolResult, userMessage) {
  const products = extractProducts(toolResult);
  const count = products.length;
  
  if (count === 0) {
    return "I couldn't find any products matching your request. Try a different search term?";
  }
  
  if (count === 1) {
    return `I found **${products[0].name}** for you. Take a look!`;
  }
  
  const topProducts = products.slice(0, 3).map(p => `**${p.name}**`);
  const listText = topProducts.join(', ');
  
  return `Here are ${count} products I found for you, including ${listText}. Let me know if you'd like more details on any of these!`;
}

/**
 * Build cart explanation
 */
function buildCartExplanation(toolResult) {
  if (toolResult.success) {
    const itemName = toolResult.addedItem?.name || 'the item';
    const cartTotal = toolResult.summary?.totalItems || 1;
    return `Done! Added **${itemName}** to your cart. You now have ${cartTotal} item${cartTotal > 1 ? 's' : ''} in your cart.`;
  }
  return "I had trouble adding that to your cart. Please try again.";
}

/**
 * Build comparison explanation
 */
function buildComparisonExplanation(toolResult) {
  const products = toolResult.products || [];
  if (products.length < 2) {
    return "I need at least two products to compare.";
  }
  
  const names = products.map(p => `**${p.name}**`).join(' vs ');
  return `Here's a comparison of ${names}. Check the details above to see which one fits your needs better!`;
}

/**
 * Extract occasion from user message
 */
function extractOccasion(message) {
  const occasions = ['wedding', 'party', 'office', 'work', 'casual', 'formal', 'eid', 'date', 'interview', 'weekend'];
  const lower = message.toLowerCase();
  
  for (const occ of occasions) {
    if (lower.includes(occ)) return occ;
  }
  return null;
}

module.exports = { runLLMOrchestratorStreaming };
