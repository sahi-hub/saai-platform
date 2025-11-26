/**
 * Mistral Provider
 * 
 * Implements native tool/function calling with Mistral's API.
 * Uses OpenAI-compatible format for tools.
 */

const { Mistral } = require('@mistralai/mistralai');
const { toOpenAIFormat } = require('../toolSchema');

const MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;

/**
 * Call Mistral with tool/function calling support
 * 
 * @param {Object} options
 * @param {Array} options.messages - Conversation messages
 * @param {boolean} options.enableTools - Whether to enable tool calling
 * @returns {Promise<Object>} Result with type: "message" or "tool"
 */
async function callWithTools({ messages, enableTools = true }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'MISTRAL_API_KEY not configured',
      provider: 'mistral'
    };
  }

  try {
    const mistral = new Mistral({ apiKey });

    const requestOptions = {
      model: MODEL,
      messages,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE
    };

    // Add tools if enabled
    if (enableTools) {
      requestOptions.tools = toOpenAIFormat();
      requestOptions.toolChoice = 'auto';
    }

    console.log(`[MISTRAL] Calling model: ${MODEL} with ${enableTools ? 'tools' : 'no tools'}`);

    const response = await mistral.chat.complete(requestOptions);

    const choice = response.choices?.[0];
    if (!choice) {
      return {
        success: false,
        error: 'No response from Mistral',
        provider: 'mistral'
      };
    }

    const message = choice.message;

    // Check if model made a tool call
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolCall = message.toolCalls[0];
      const functionName = toolCall.function?.name;
      let functionArgs = {};

      try {
        // Mistral may return arguments as string or object
        const args = toolCall.function?.arguments;
        functionArgs = typeof args === 'string' ? JSON.parse(args) : (args || {});
      } catch (parseError) {
        console.warn('[MISTRAL] Failed to parse tool arguments:', parseError.message);
      }

      console.log(`[MISTRAL] Tool call detected: ${functionName}`);

      return {
        success: true,
        type: 'tool',
        provider: 'mistral',
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
      provider: 'mistral',
      model: MODEL,
      text: message.content || ''
    };

  } catch (error) {
    console.error('[MISTRAL] Error:', error.message);
    
    return {
      success: false,
      error: error.message,
      provider: 'mistral'
    };
  }
}

/**
 * Call Mistral without tools (plain text generation)
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
