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
 * Call Gemini Flash with text and optional image
 * 
 * @param {Object} options
 * @param {string} options.prompt - User's text query
 * @param {string|null} options.imageBase64 - Optional base64 image (data URI or raw)
 * @param {string} options.productContext - JSON string of product catalog
 * @param {Array} options.history - Conversation history [{role: 'user'|'assistant', content: string}]
 * @returns {Promise<string>} Raw JSON-like text response from Gemini
 */
async function callGeminiFlashVision({ prompt, imageBase64, productContext, history = [] }) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const parts = [];

  // System + product context first
  const systemText = [
    'You are SAAI, an AI shopping assistant.',
    'You MUST ONLY recommend products that exist in the provided catalog.',
    'You are given a list of products with id, name, description, category, price, and tags.',
    'When you answer:',
    '- Mention products by name and optionally ID.',
    '- Suggest the best matches for the user\'s request or image.',
    '- Do NOT invent products that are not in the catalog.',
    '- Be helpful, friendly, and concise.',
    '- IMPORTANT: Remember the conversation context and refer back to previous messages when relevant.',
    '',
    'Product catalog:',
    productContext
  ].join('\n');

  parts.push({ text: systemText });

  // Include conversation history for context (limit to last 10 exchanges to prevent token overflow)
  if (history && history.length > 0) {
    const recentHistory = history.slice(-20); // Last 20 messages (10 exchanges)
    
    const historyText = recentHistory.map((msg) => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${msg.content}`;
    }).join('\n');

    parts.push({ 
      text: [
        '',
        '--- Previous conversation context ---',
        historyText,
        '--- End of previous context ---',
        ''
      ].join('\n')
    });
  }

  // User prompt
  if (prompt) {
    parts.push({ text: `User request: ${prompt}` });
  }

  // Image if provided
  if (imageBase64) {
    try {
      // Handle both "data:image/jpeg;base64,..." and raw base64
      let base64Data = imageBase64;
      let mimeType = 'image/jpeg';

      if (imageBase64.includes(',')) {
        const [prefix, data] = imageBase64.split(',');
        base64Data = data;
        mimeType = detectMimeType(prefix);
      }

      parts.push({
        inlineData: {
          data: base64Data,
          mimeType
        }
      });

      // Add image context hint
      if (!prompt) {
        parts.push({ text: 'Find products from the catalog that match or are similar to this image.' });
      }
    } catch (error_) {
      console.error('[geminiVision] Error processing image:', error_.message);
      // Continue without image if processing fails
    }
  }

  // Request structured JSON output
  parts.push({
    text: [
      '',
      'Respond STRICTLY in the following JSON format (no markdown, no code blocks):',
      '{',
      '  "message": "<friendly natural language reply mentioning product names>",',
      '  "matchedProductIds": ["p101", "p102"]',
      '}',
      'Use matchedProductIds from the given catalog only. Include 1-5 most relevant products.'
    ].join('\n')
  });

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

  // Parse JSON response
  try {
    // Remove potential markdown code blocks
    let cleanJson = rawText
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
    // Fallback: return raw text as message with empty product IDs
    return {
      message: rawText || 'I had trouble understanding. Please try again.',
      matchedProductIds: []
    };
  }
}

module.exports = {
  callGeminiFlashVision,
  getGeminiClient
};
