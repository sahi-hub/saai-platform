/**
 * OpenRouter Gemma Provider
 * 
 * Uses OpenRouter API with google/gemma-3-27b-it:free model.
 * OpenAI-compatible format for tools.
 */

const { toOpenAIFormat } = require('../toolSchema');

const MODEL = 'google/gemma-3-27b-it:free';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.7;
const BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Call OpenRouter with tool/function calling support
 */
async function callWithTools({ messages, enableTools = true }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'OPENROUTER_API_KEY not configured',
      provider: 'openrouter-gemma'
    };
  }

  try {
    const requestBody = {
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    };

    if (enableTools) {
      requestBody.tools = toOpenAIFormat();
      requestBody.tool_choice = 'auto';
    }

    console.log(`[OPENROUTER-GEMMA] Calling model: ${MODEL} with ${enableTools ? 'tools' : 'no tools'}`);

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
      console.error(`[OPENROUTER-GEMMA] API error ${response.status}:`, errorData);
      return {
        success: false,
        error: `${response.status} ${errorData}`,
        provider: 'openrouter-gemma'
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      return {
        success: false,
        error: 'No response from OpenRouter',
        provider: 'openrouter-gemma'
      };
    }

    const message = choice.message;

    // Check for tool call
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const functionName = toolCall.function?.name;
      let functionArgs = {};

      try {
        functionArgs = JSON.parse(toolCall.function?.arguments || '{}');
      } catch (parseError) {
        console.warn('[OPENROUTER-GEMMA] Failed to parse tool arguments:', parseError.message);
      }

      console.log(`[OPENROUTER-GEMMA] Tool call detected: ${functionName}`);

      return {
        success: true,
        type: 'tool',
        provider: 'openrouter-gemma',
        model: MODEL,
        text: message.content || '',
        toolCall: {
          name: functionName,
          arguments: functionArgs
        }
      };
    }

    return {
      success: true,
      type: 'message',
      provider: 'openrouter-gemma',
      model: MODEL,
      text: message.content || ''
    };

  } catch (error) {
    console.error('[OPENROUTER-GEMMA] Error:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'openrouter-gemma'
    };
  }
}

/**
 * Call without tools (plain text generation)
 */
async function callPlain(messages) {
  return callWithTools({ messages, enableTools: false });
}

module.exports = {
  callWithTools,
  callPlain,
  MODEL
};
