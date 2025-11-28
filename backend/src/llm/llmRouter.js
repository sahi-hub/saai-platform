/**
 * LLM Router
 * 
 * Routes requests to LLM providers with fallback support.
 * Supports both tool-calling and plain text modes.
 * 
 * Provider priority (optimized by speed test 2025-11-28):
 *   GROQ (335ms) → GEMINI (1296ms) → OPENROUTER (5041ms) → MOCK
 * 
 * (Can be overridden via LLM_PRIORITY env var)
 */

const groqProvider = require('./providers/groqProvider');
const openRouterProvider = require('./providers/openRouterProvider');
const geminiProvider = require('./providers/geminiProvider');
const mistralProvider = require('./providers/mistralProvider');
const mockProvider = require('./providers/mockProvider');

// Provider mapping
const providers = {
  groq: groqProvider,
  openrouter: openRouterProvider,
  gemini: geminiProvider,
  mistral: mistralProvider,
  mock: mockProvider
};

// Default provider order (optimized by speed test: fastest first)
// GROQ: 335ms avg | Gemini: 1296ms avg | OpenRouter: 5041ms avg
// Note: Mistral excluded due to auth issues - can re-enable if API key fixed
const DEFAULT_PRIORITY = ['groq', 'gemini', 'openrouter', 'mock'];

/**
 * Parse tool calls that appear in text response
 * 
 * Sometimes LLMs output tool calls as text instead of using native tool calling.
 * This function detects and parses various formats:
 * - {"name":"tool","parameters":{...}}
 * - /function=tool>{...}<function
 * - <function_call>...</function_call>
 * 
 * @param {string} text - LLM text response to parse
 * @returns {Object|null} Parsed tool call or null if not found
 */
function parseToolCallFromText(text) {
  if (!text) return null;

  // Pattern 1: JSON tool call format {"name":"...", "parameters":{...}}
  const jsonPattern = /\{"name"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[^}]*\})\}/;
  const jsonMatch = text.match(jsonPattern);
  if (jsonMatch) {
    try {
      const name = jsonMatch[1];
      const args = JSON.parse(jsonMatch[2]);
      console.log(`[LLM Router] Parsed tool call from JSON format: ${name}`);
      return { name, arguments: args };
    } catch (e) {
      console.warn('[LLM Router] Failed to parse JSON tool call:', e.message);
    }
  }

  // Pattern 2: /function=name>{...}<function format
  const functionPattern = /\/function=(\w+)>\s*(\{[^}]*\})\s*<function/;
  const functionMatch = text.match(functionPattern);
  if (functionMatch) {
    try {
      const name = functionMatch[1];
      const args = JSON.parse(functionMatch[2]);
      console.log(`[LLM Router] Parsed tool call from function format: ${name}`);
      return { name, arguments: args };
    } catch (e) {
      console.warn('[LLM Router] Failed to parse function tool call:', e.message);
    }
  }

  // Pattern 3: <function_call name="...">...</function_call>
  const xmlPattern = /<function_call\s+name="([^"]+)">\s*(\{[^}]*\})\s*<\/function_call>/;
  const xmlMatch = text.match(xmlPattern);
  if (xmlMatch) {
    try {
      const name = xmlMatch[1];
      const args = JSON.parse(xmlMatch[2]);
      console.log(`[LLM Router] Parsed tool call from XML format: ${name}`);
      return { name, arguments: args };
    } catch (e) {
      console.warn('[LLM Router] Failed to parse XML tool call:', e.message);
    }
  }

  return null;
}

/**
 * Get provider priority order
 * @returns {string[]} Array of provider names in priority order
 */
function getProviderPriority() {
  const envPriority = process.env.LLM_PRIORITY;
  if (envPriority) {
    const parsed = envPriority.split(',').map(p => p.trim().toLowerCase());
    // Validate providers exist
    const valid = parsed.filter(p => providers[p]);
    if (valid.length > 0) {
      // Always include mock as final fallback
      if (!valid.includes('mock')) {
        valid.push('mock');
      }
      return valid;
    }
  }
  return DEFAULT_PRIORITY;
}

/**
 * Build messages array for LLM
 * @param {Object} options
 * @param {string} options.systemPrompt - System prompt
 * @param {string} options.userMessage - User message
 * @param {Array} options.conversationHistory - Previous messages
 * @returns {Array} Formatted messages
 */
function buildMessages({ systemPrompt, userMessage, conversationHistory = [] }) {
  const messages = [];

  // Add system prompt
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role || 'user',
      content: msg.content || msg.message || ''
    });
  }

  // Add current user message
  if (userMessage) {
    messages.push({
      role: 'user',
      content: userMessage
    });
  }

  return messages;
}

/**
 * Run LLM with tools across providers with fallback
 * 
 * @param {Object} options
 * @param {Array} options.messages - Formatted messages array
 * @param {Object} [options.tenantConfig] - Tenant configuration (optional)
 * @param {Object} [options.actionRegistry] - Action registry (optional)
 * @returns {Promise<Object>} Result object
 * 
 * Return shape (message):
 * { decision: "message", provider, model, text }
 * 
 * Return shape (tool):
 * { decision: "tool", provider, model, tool: { name, arguments }, text }
 */
async function runLLMWithTools({ messages, tenantConfig, actionRegistry }) {
  const providerOrder = getProviderPriority();
  let lastError = null;

  console.log(`[LLM Router] Running with tools, providers: ${providerOrder.join(' → ')}`);

  for (const providerName of providerOrder) {
    const provider = providers[providerName];
    if (!provider) {
      continue;
    }

    console.log(`[LLM Router] Trying provider: ${providerName}`);

    try {
      const result = await provider.callWithTools({ messages, enableTools: true });

      if (!result.success) {
        console.log(`[LLM Router] Provider ${providerName} failed: ${result.error}`);
        lastError = result.error;
        continue;
      }

      // Successfully got a response
      console.log(`[LLM Router] Success with ${providerName}, type: ${result.type}`);

      if (result.type === 'tool') {
        return {
          decision: 'tool',
          provider: result.provider,
          model: result.model,
          tool: result.toolCall,
          text: result.text || ''
        };
      }

      // Check if the text response contains a tool call that wasn't properly parsed
      // This happens when LLMs output tool calls as text instead of using native tool calling
      const parsedToolCall = parseToolCallFromText(result.text);
      if (parsedToolCall) {
        console.log(`[LLM Router] Detected tool call in text response, converting to proper tool call`);
        return {
          decision: 'tool',
          provider: result.provider,
          model: result.model,
          tool: parsedToolCall,
          text: '' // Clear the text since it was actually a tool call
        };
      }

      return {
        decision: 'message',
        provider: result.provider,
        model: result.model,
        text: result.text || ''
      };

    } catch (error) {
      console.error(`[LLM Router] Provider ${providerName} threw:`, error.message);
      lastError = error.message;
    }
  }

  // All providers failed
  console.error('[LLM Router] All providers failed');
  return {
    decision: 'message',
    provider: 'fallback',
    model: 'none',
    text: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
    error: lastError
  };
}

/**
 * Run LLM without tools (plain text generation)
 * Used for grounded explanation phase
 * 
 * @param {Object} options
 * @param {Array} options.messages - Formatted messages array
 * @param {string} [options.preferredProvider] - Preferred provider to use
 * @returns {Promise<Object>} Result object
 */
async function runLLMPlain({ messages, preferredProvider }) {
  let providerOrder = getProviderPriority();
  
  // If preferred provider specified, put it first
  if (preferredProvider && providers[preferredProvider]) {
    providerOrder = [
      preferredProvider,
      ...providerOrder.filter(p => p !== preferredProvider)
    ];
  }

  let lastError = null;

  console.log(`[LLM Router] Running plain (no tools), providers: ${providerOrder.join(' → ')}`);

  for (const providerName of providerOrder) {
    const provider = providers[providerName];
    if (!provider) {
      continue;
    }

    console.log(`[LLM Router] Trying provider: ${providerName}`);

    try {
      const result = await provider.callPlain(messages);

      if (!result.success) {
        console.log(`[LLM Router] Provider ${providerName} failed: ${result.error}`);
        lastError = result.error;
        continue;
      }

      console.log(`[LLM Router] Success with ${providerName}`);

      return {
        success: true,
        provider: result.provider,
        model: result.model,
        text: result.text || ''
      };

    } catch (error) {
      console.error(`[LLM Router] Provider ${providerName} threw:`, error.message);
      lastError = error.message;
    }
  }

  // All providers failed
  console.error('[LLM Router] All providers failed for plain call');
  return {
    success: false,
    provider: 'fallback',
    model: 'none',
    text: '',
    error: lastError
  };
}

/**
 * Get status of all providers
 * @returns {Object} Provider availability status
 */
function getProviderStatus() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    mock: true
  };
}

/**
 * Health check for LLM router
 * @returns {Object} Health status
 */
function healthCheck() {
  const status = getProviderStatus();
  const available = Object.entries(status)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  return {
    healthy: available.length > 0,
    availableProviders: available,
    priority: getProviderPriority(),
    status
  };
}

module.exports = {
  runLLMWithTools,
  runLLMPlain,
  buildMessages,
  getProviderPriority,
  getProviderStatus,
  healthCheck
};
