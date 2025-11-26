/**
 * Gemini Provider
 * 
 * Implements native tool/function calling with Google's Gemini API.
 * Uses Gemini's native function declaration format.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { toGeminiFormat } = require('../toolSchema');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;

/**
 * Call Gemini with tool/function calling support
 * 
 * @param {Object} options
 * @param {Array} options.messages - Conversation messages (OpenAI format)
 * @param {boolean} options.enableTools - Whether to enable tool calling
 * @returns {Promise<Object>} Result with type: "message" or "tool"
 */
async function callWithTools({ messages, enableTools = true }) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not configured',
      provider: 'gemini'
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Configure model with or without tools
    const modelConfig = { model: MODEL };
    
    if (enableTools) {
      modelConfig.tools = [toGeminiFormat()];
      modelConfig.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO'
        }
      };
    }

    const model = genAI.getGenerativeModel(modelConfig);

    // Convert messages to Gemini format
    const { systemInstruction, contents } = convertToGeminiMessages(messages);

    console.log(`[GEMINI] Calling model: ${MODEL} with ${enableTools ? 'tools' : 'no tools'}`);

    // Start chat with system instruction
    const chat = model.startChat({
      history: contents.slice(0, -1),
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        temperature: TEMPERATURE
      }
    });

    // Send the last message
    const lastMessage = contents[contents.length - 1];
    const userMessage = lastMessage?.parts?.[0]?.text || '';
    
    // Prepend system instruction if present
    const fullMessage = systemInstruction 
      ? `${systemInstruction}\n\n${userMessage}`
      : userMessage;

    const result = await chat.sendMessage(fullMessage);
    const response = result.response;

    // Check for function call in response
    const candidate = response.candidates?.[0];
    if (!candidate) {
      return {
        success: false,
        error: 'No response from Gemini',
        provider: 'gemini'
      };
    }

    // Look for function call in parts
    const parts = candidate.content?.parts || [];
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const fc = functionCallPart.functionCall;
      console.log(`[GEMINI] Tool call detected: ${fc.name}`);

      return {
        success: true,
        type: 'tool',
        provider: 'gemini',
        model: MODEL,
        text: getTextFromParts(parts),
        toolCall: {
          name: fc.name,
          arguments: fc.args || {}
        }
      };
    }

    // No function call - return text response
    const textContent = getTextFromParts(parts);

    return {
      success: true,
      type: 'message',
      provider: 'gemini',
      model: MODEL,
      text: textContent
    };

  } catch (error) {
    console.error('[GEMINI] Error:', error.message);
    
    return {
      success: false,
      error: error.message,
      provider: 'gemini'
    };
  }
}

/**
 * Convert OpenAI-style messages to Gemini format
 * @param {Array} messages - Messages in OpenAI format
 * @returns {Object} { systemInstruction, contents }
 */
function convertToGeminiMessages(messages) {
  let systemInstruction = '';
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content || '';
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || '' }]
      });
    }
  }

  // Ensure there's at least one user message
  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: 'Hello' }]
    });
  }

  return { systemInstruction, contents };
}

/**
 * Extract text from Gemini response parts
 * @param {Array} parts - Response parts
 * @returns {string} Combined text content
 */
function getTextFromParts(parts) {
  return parts
    .filter(p => p.text)
    .map(p => p.text)
    .join('')
    .trim();
}

/**
 * Call Gemini without tools (plain text generation)
 * Used for grounded explanation phase
 * 
 * @param {Array} messages - Conversation messages
 * @returns {Promise<Object>} Result with type: "message"
 */
async function callPlain(messages) {
  return callWithTools({ messages, enableTools: false });
}

module.exports = {
  callWithTools,
  callPlain,
  MODEL
};
