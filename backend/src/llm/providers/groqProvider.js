/**
 * GROQ Provider
 * 
 * Implements native tool/function calling with GROQ's API.
 * Uses OpenAI-compatible format for tools.
 */

const Groq = require('groq-sdk');
const { toOpenAIFormat } = require('../toolSchema');

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;

/**
 * Call GROQ with tool/function calling support
 * 
 * @param {Object} options
 * @param {Array} options.messages - Conversation messages
 * @param {boolean} options.enableTools - Whether to enable tool calling
 * @returns {Promise<Object>} Result with type: "message" or "tool"
 */
async function callWithTools({ messages, enableTools = true }) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'GROQ_API_KEY not configured',
      provider: 'groq'
    };
  }

  try {
    const groq = new Groq({ apiKey });

    const requestOptions = {
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    };

    // Add tools if enabled
    if (enableTools) {
      requestOptions.tools = toOpenAIFormat();
      requestOptions.tool_choice = 'auto';
    }

    console.log(`[GROQ] Calling model: ${MODEL} with ${enableTools ? 'tools' : 'no tools'}`);
    
    const response = await groq.chat.completions.create(requestOptions);

    const choice = response.choices?.[0];
    if (!choice) {
      return {
        success: false,
        error: 'No response from GROQ',
        provider: 'groq'
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
        console.warn('[GROQ] Failed to parse tool arguments:', parseError.message);
      }

      console.log(`[GROQ] Tool call detected: ${functionName}`);

      return {
        success: true,
        type: 'tool',
        provider: 'groq',
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
      provider: 'groq',
      model: MODEL,
      text: message.content || ''
    };

  } catch (error) {
    console.error('[GROQ] Error:', error.message);
    
    // Check for specific error types
    if (error.message?.includes('tool_use_failed') || 
        error.message?.includes('tool') ||
        error.status === 400) {
      console.warn('[GROQ] Tool calling failed, may need retry without tools');
    }

    return {
      success: false,
      error: error.message,
      provider: 'groq'
    };
  }
}

/**
 * Call GROQ without tools (plain text generation)
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
