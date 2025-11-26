/**
 * OpenRouter Provider
 * 
 * Implements native tool/function calling with OpenRouter's API.
 * Uses OpenAI-compatible format for tools.
 * Model: x-ai/grok-4.1-fast:free
 */

const { toOpenAIFormat } = require('../toolSchema');

const MODEL = process.env.OPENROUTER_MODEL || 'x-ai/grok-4.1-fast:free';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;
const BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Call OpenRouter with tool/function calling support
 * 
 * @param {Object} options
 * @param {Array} options.messages - Conversation messages
 * @param {boolean} options.enableTools - Whether to enable tool calling
 * @returns {Promise<Object>} Result with type: "message" or "tool"
 */
async function callWithTools({ messages, enableTools = true }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'OPENROUTER_API_KEY not configured',
      provider: 'openrouter'
    };
  }

  try {
    const requestBody = {
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    };

    // Add tools if enabled
    if (enableTools) {
      requestBody.tools = toOpenAIFormat();
      requestBody.tool_choice = 'auto';
    }

    console.log(`[OPENROUTER] Calling model: ${MODEL} with ${enableTools ? 'tools' : 'no tools'}`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
        'X-Title': 'SAAI Platform'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[OPENROUTER] API error ${response.status}:`, errorData);
      return {
        success: false,
        error: `OpenRouter API error: ${response.status} - ${errorData}`,
        provider: 'openrouter'
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return {
        success: false,
        error: 'No response from OpenRouter',
        provider: 'openrouter'
      };
    }

    const message = choice.message;

    // Check if model made a tool call
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const functionName = toolCall.function?.name;
      let functionArgs = {};

      try {
        functionArgs = JSON.parse(toolCall.function?.arguments || '{}');
      } catch (parseError) {
        console.warn('[OPENROUTER] Failed to parse tool arguments:', parseError.message);
      }

      console.log(`[OPENROUTER] Tool call detected: ${functionName}`);

      return {
        success: true,
        type: 'tool',
        provider: 'openrouter',
        model: MODEL,
        text: message.content || '',
        toolCall: {
          name: functionName,
          arguments: functionArgs
        }
      };
    }

    // No tool call - return text response
    return {
      success: true,
      type: 'message',
      provider: 'openrouter',
      model: MODEL,
      text: message.content || ''
    };

  } catch (error) {
    console.error('[OPENROUTER] Error:', error.message);
    
    return {
      success: false,
      error: error.message,
      provider: 'openrouter'
    };
  }
}

/**
 * Call OpenRouter without tools (plain text generation)
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
