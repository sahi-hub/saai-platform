/**
 * Gemini Vision Client
 * 
 * Handles text and image-based AI queries using Google's Gemini Flash model.
 * Used by the assistant endpoint for product recommendations based on
 * user text queries and/or uploaded images.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use same model as geminiProvider, or fallback to gemini-2.0-flash
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

let geminiClient = null;

/**
 * Get or create the Gemini client singleton
 */
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Detect MIME type from base64 data URI prefix
 */
function detectMimeType(prefix) {
  if (!prefix) return 'image/jpeg';
  if (prefix.includes('png')) return 'image/png';
  if (prefix.includes('gif')) return 'image/gif';
  if (prefix.includes('webp')) return 'image/webp';
  if (prefix.includes('jpg') || prefix.includes('jpeg')) return 'image/jpeg';
  return 'image/jpeg'; // default
}

/**
 * Build system text for Gemini including profile and recent products context
 * 
 * @param {string} productContext - JSON string of product catalog
 * @param {string} profileContext - User preference profile (optional)
 * @param {string} recentProductsContext - Indexed recent products (optional)
 * @returns {string} - Complete system text
 */
function buildSystemText(productContext, profileContext, recentProductsContext) {
  const lines = [
    'You are SAAI, an AI shopping assistant.',
    'You MUST ONLY recommend products that exist in the provided catalog.',
    'You are given a list of products with id, name, description, category, price, and tags.',
    '',
    'When you answer:',
    '- Mention products by name and optionally ID.',
    '- Suggest the best matches for the user\'s request or image.',
    '- Do NOT invent products that are not in the catalog.',
    '- Be helpful, friendly, and concise.',
    '- IMPORTANT: Remember the conversation context and refer back to previous messages when relevant.'
  ];

  // Include user preference profile if available
  // CRITICAL: Profile is SOFT preference - user's EXPLICIT request always wins!
  if (profileContext?.length > 0) {
    lines.push(
      '',
      '=== USER PREFERENCE PROFILE (SOFT HINT ONLY) ===',
      'The user has shown preferences for certain styles, colors, and categories.',
      '',
      'CRITICAL RULES FOR USING PROFILE:',
      '1. EXPLICIT USER REQUEST ALWAYS OVERRIDES PROFILE.',
      '   - If user says "show me kurta" → show kurtas, NOT shirts even if profile says "likes shirts".',
      '   - If user says "not X, show Y" → show Y, ignore profile bias toward X.',
      '   - If user explicitly names a category/product → honor that, not profile.',
      '2. ONLY use profile to BREAK TIES when user request is ambiguous.',
      '   - User says "show me something nice" → then use profile to prefer colors/styles.',
      '3. NEVER let profile override explicit user intent.',
      '4. Do NOT say "based on your preference for shirts" when user asked for kurtas.',
      '',
      'User preference profile (JSON - use as soft hint only):',
      profileContext,
      '=== END PROFILE ==='
    );
  }

  // Include recent products context for reference resolution (conversational commerce)
  if (recentProductsContext?.length > 0) {
    lines.push(
      '',
      '=== RECENT PRODUCTS CONTEXT (for reference resolution) ===',
      'These are products from the recent conversation. Use for:',
      '- "the first one", "the second one" → return that product from indexed list',
      '- "tell me more about it" → refer to the last mentioned product',
      '- "cheaper option" → find lowest priced from this list',
      '',
      recentProductsContext,
      '=== END RECENT PRODUCTS ==='
    );
  }

  // Add product catalog with lookup instructions
  lines.push(
    '',
    '=== PRODUCT CATALOG ===',
    'This is the FULL product catalog. Use it to:',
    '- Search for products by category, name, tags, or description',
    '- Look up specific product IDs (e.g., "what is p122" → find p122 in this catalog)',
    '- Find products matching user requests',
    '',
    'IMPORTANT: If user asks about a specific product ID (like "p122", "p123"), search THIS catalog.',
    'The Recent Products list only has products from the last response.',
    '',
    productContext,
    '=== END CATALOG ==='
  );

  return lines.join('\n');
}

/**
 * Build conversation history text for context
 * 
 * @param {Array} history - Conversation history array
 * @returns {string|null} - Formatted history text or null if empty
 */
function buildHistoryText(history) {
  if (!history?.length) return null;
  
  const recentHistory = history.slice(-20); // Last 20 messages (10 exchanges)
  
  const historyText = recentHistory.map((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    return `${role}: ${msg.content}`;
  }).join('\n');

  return [
    '',
    '--- Previous conversation context ---',
    historyText,
    '--- End of previous context ---',
    ''
  ].join('\n');
}

/**
 * Process image and return inline data for Gemini
 * 
 * @param {string} imageBase64 - Base64 image string
 * @returns {{ inlineData: { data: string, mimeType: string } }|null}
 */
function processImage(imageBase64) {
  if (!imageBase64) return null;
  
  try {
    let base64Data = imageBase64;
    let mimeType = 'image/jpeg';

    if (imageBase64.includes(',')) {
      const [prefix, data] = imageBase64.split(',');
      base64Data = data;
      mimeType = detectMimeType(prefix);
    }

    return {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };
  } catch (error_) {
    console.error('[geminiVision] Error processing image:', error_.message);
    return null;
  }
}

/**
 * Get JSON output instructions for Gemini
 * 
 * @returns {string} - JSON format instructions
 */
function getJsonOutputInstructions() {
  return [
    '',
    'Respond STRICTLY in the following JSON format (no markdown, no code blocks):',
    '{',
    '  "message": "<friendly natural language reply mentioning product names>",',
    '  "matchedProductIds": ["p101", "p102"]',
    '}',
    '',
    '=== CRITICAL RULES FOR MESSAGE ===',
    '1. EXPLICIT USER REQUEST ALWAYS WINS:',
    '   - If user asks for "kurta" → find and return kurtas from catalog.',
    '   - If user says "not shirt" or "no shirts" → do NOT recommend shirts.',
    '   - If user explicitly names a category → search that category, not profile preference.',
    '',
    '2. Keep message short and friendly (2-4 sentences max).',
    '',
    '3. If you CANNOT find matching products:',
    '   - Say "I could not find [category] in our catalog."',
    '   - Do NOT substitute with unrelated products.',
    '   - Do NOT say "based on your preference for X, here is Y" when user asked for Z.',
    '',
    '4. Use matchedProductIds from the given catalog only. Include 1-5 most relevant products.',
    '',
    '=== REFERENCE RESOLUTION (when RECENT PRODUCTS CONTEXT is provided) ===',
    '- If user says "the first one", "the second one", etc. → return that product from the indexed list.',
    '- If user asks about a product ID like "what is p122" → look it up in recent products or catalog.',
    '- If user says "the cheaper one" or "less expensive" → return the product with lowest price.',
    '- If user says "the more expensive one" → return the product with highest price.',
    '- If user says "something similar" → find products with same category/tags.',
    '- If user says "replace the X with Y" → keep other products but swap X for Y.',
    '- If user asks "do you have any other option" → search catalog for more products in SAME category.',
    '- ALWAYS use the product IDs from the catalog, never invent IDs.'
  ].join('\n');
}

/**
 * Parse Gemini response to extract message and matchedProductIds
 * 
 * @param {string} rawText - Raw response text
 * @returns {{ message: string, matchedProductIds: string[] }}
 */
function parseGeminiResponse(rawText) {
  try {
    const cleanJson = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return {
      message: parsed.message || 'I found some products that might interest you.',
      matchedProductIds: Array.isArray(parsed.matchedProductIds) ? parsed.matchedProductIds : []
    };
  } catch (error_) {
    console.warn('[geminiVision] Failed to parse JSON response, returning raw text:', error_.message);
    return {
      message: rawText || 'I had trouble understanding. Please try again.',
      matchedProductIds: []
    };
  }
}

/**
 * Call Gemini Flash with text and optional image
 * 
 * @param {Object} options
 * @param {string} options.prompt - User's text query
 * @param {string|null} options.imageBase64 - Optional base64 image (data URI or raw)
 * @param {string} options.productContext - JSON string of product catalog
 * @param {string} options.profileContext - JSON string of user preference profile (optional)
 * @param {string} options.recentProductsContext - Indexed recent products for reference resolution (optional)
 * @param {Array} options.history - Conversation history [{role: 'user'|'assistant', content: string}]
 * @returns {Promise<string>} Raw JSON-like text response from Gemini
 */
async function callGeminiFlashVision({ prompt, imageBase64, productContext, profileContext = '', recentProductsContext = '', history = [] }) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const parts = [];

  // Build system text using helper function
  const systemText = buildSystemText(productContext, profileContext, recentProductsContext);
  parts.push({ text: systemText });

  // Include conversation history for context
  const historyText = buildHistoryText(history);
  if (historyText) {
    parts.push({ text: historyText });
  }

  // User prompt
  if (prompt) {
    parts.push({ text: `User request: ${prompt}` });
  }

  // Image if provided
  const imageData = processImage(imageBase64);
  if (imageData) {
    parts.push(imageData);
    // Add image context hint if no prompt
    if (!prompt) {
      parts.push({ text: 'Find products from the catalog that match or are similar to this image.' });
    }
  }

  // Request structured JSON output
  parts.push({ text: getJsonOutputInstructions() });

  console.log('[geminiVision] Calling Gemini with', imageBase64 ? 'text+image' : 'text only', `(history: ${history?.length || 0} messages)`);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }]
  });

  const candidate = result?.response?.candidates?.[0];
  const contentParts = candidate?.content?.parts || [];

  const rawText = contentParts
    .map((p) => p.text || '')
    .join(' ')
    .trim();

  console.log('[geminiVision] Response received, length:', rawText.length);

  return parseGeminiResponse(rawText);
}

module.exports = {
  callGeminiFlashVision,
  getGeminiClient
};
