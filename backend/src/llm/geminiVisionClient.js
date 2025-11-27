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
  if (profileContext?.length > 0) {
    lines.push(
      '',
      '=== USER PREFERENCE PROFILE ===',
      'The user has shown preferences for certain styles, colors, and categories.',
      'When making recommendations, PREFER products that match these preferences when reasonable.',
      'You may acknowledge their preferences naturally (e.g., "Since you seem to like white and navy...").',
      '',
      'User preference profile (JSON):',
      profileContext,
      '=== END PROFILE ==='
    );
  }

  // Include recent products context for reference resolution (conversational commerce)
  if (recentProductsContext?.length > 0) {
    lines.push(
      '',
      '=== RECENT PRODUCTS CONTEXT ===',
      recentProductsContext,
      '=== END RECENT PRODUCTS ==='
    );
  }

  // Add product catalog
  lines.push(
    '',
    'Product catalog:',
    productContext
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
    'IMPORTANT for "message":',
    '- Keep it short and friendly (2-4 sentences max).',
    '- If user preferences indicate they like certain colors/categories that match recommended products,',
    '  mention it naturally (e.g., "Since you seem to like white and navy..." or "Given your style preferences...").',
    '- Do NOT mention products that are not in matchedProductIds.',
    '- Use matchedProductIds from the given catalog only. Include 1-5 most relevant products.',
    '',
    'REFERENCE RESOLUTION (when RECENT PRODUCTS CONTEXT is provided):',
    '- If user says "the first one", "the second one", etc. → return that product from the indexed list.',
    '- If user says "the cheaper one" or "less expensive" → return the product with lowest price.',
    '- If user says "the more expensive one" → return the product with highest price.',
    '- If user says "something similar" → find products with same category/tags.',
    '- If user says "replace the X with Y" → keep other products but swap X for Y.',
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
