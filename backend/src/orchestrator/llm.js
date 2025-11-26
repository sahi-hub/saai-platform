/**
 * SAAI LLM Orchestrator - Refactored
 * 
 * Multi-provider LLM interface with:
 * - TEXT-ONLY provider responses (no native tool calling)
 * - Internal keyword-based tool planner (determineTool)
 * - Provider fallback loop: GROQ -> GEMINI -> MISTRAL -> MOCK
 * - Graceful error handling (never crashes)
 */

const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Mistral = require('@mistralai/mistralai').default;

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROVIDER_ORDER = ['groq', 'gemini', 'mistral', 'mock'];

const PROVIDER_CONFIG = {
  groq: {
    model: 'llama-3.3-70b-versatile',
    maxTokens: 4096,
    temperature: 0.7
  },
  gemini: {
    model: 'gemini-1.5-flash',
    maxTokens: 4096,
    temperature: 0.7
  },
  mistral: {
    model: 'mistral-small-latest',
    maxTokens: 4096,
    temperature: 0.7
  }
};

// ============================================================================
// INTERNAL TOOL PLANNER - Keyword-based tool detection
// ============================================================================

/**
 * Determines if a message indicates a tool action should be executed
 * Uses keyword matching to detect user intent
 * 
 * @param {string} messageString - The user's message or LLM response
 * @param {Object} actionRegistry - Registry of available actions
 * @returns {Object|null} - { action, params } or null if no tool detected
 */
function determineTool(messageString, actionRegistry = {}) {
  if (!messageString || typeof messageString !== 'string') {
    return null;
  }

  const lower = messageString.toLowerCase().trim();

  // -------------------------------------------------------------------------
  // OUTFIT INTENT (check first - more specific than general recommend)
  // -------------------------------------------------------------------------
  const outfitPatterns = [
    'outfit', 'dress me', 'complete look', 'what should i wear',
    'what to wear', 'style me', 'put together', 'coordinate',
    'match with', 'goes with', 'pair with', 'combine with',
    'full look', 'entire outfit', 'wardrobe'
  ];

  for (const pattern of outfitPatterns) {
    if (lower.includes(pattern)) {
      if (actionRegistry.recommend_outfit?.enabled !== false) {
        return { action: 'recommend_outfit', params: { query: messageString } };
      }
      if (actionRegistry['recommender.outfit']?.enabled !== false) {
        return { action: 'recommender.outfit', params: { query: messageString } };
      }
    }
  }

  // -------------------------------------------------------------------------
  // RECOMMENDATION INTENT
  // -------------------------------------------------------------------------
  const recommendPatterns = [
    'recommend', 'suggest', 'show me', 'find me', 'looking for',
    'need a', 'want a', 'search for', 'browse', 'discover',
    'what do you have', 'any products', 'something similar',
    'alternatives', 'options for'
  ];

  for (const pattern of recommendPatterns) {
    if (lower.includes(pattern)) {
      if (actionRegistry.recommend_products?.enabled !== false) {
        return { action: 'recommend_products', params: { query: messageString } };
      }
      if (actionRegistry['recommender.recommend']?.enabled !== false) {
        return { action: 'recommender.recommend', params: { query: messageString } };
      }
    }
  }

  // -------------------------------------------------------------------------
  // ADD TO CART INTENT
  // -------------------------------------------------------------------------
  const cartAddPatterns = [
    'add to cart', 'add to my cart', 'add this to cart',
    'put in cart', 'add to basket', 'buy this', 'purchase this',
    'i want this', "i'll take", 'get this'
  ];

  for (const pattern of cartAddPatterns) {
    if (lower.includes(pattern)) {
      const productId = extractProductId(messageString);
      if (actionRegistry.add_to_cart?.enabled !== false ||
          actionRegistry['commerce.addToCart']?.enabled !== false) {
        return {
          action: actionRegistry.add_to_cart ? 'add_to_cart' : 'commerce.addToCart',
          params: { productId: productId || 'unknown' }
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // VIEW CART INTENT
  // -------------------------------------------------------------------------
  const viewCartPatterns = [
    'view cart', 'show cart', 'my cart', "what's in my cart",
    'cart contents', 'see cart', 'check cart'
  ];

  for (const pattern of viewCartPatterns) {
    if (lower.includes(pattern)) {
      if (actionRegistry.view_cart?.enabled !== false ||
          actionRegistry['commerce.viewCart']?.enabled !== false) {
        return {
          action: actionRegistry.view_cart ? 'view_cart' : 'commerce.viewCart',
          params: {}
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // CHECKOUT INTENT
  // -------------------------------------------------------------------------
  const checkoutPatterns = [
    'checkout', 'check out', 'pay now', 'complete order',
    'place order', 'finish purchase', 'buy now'
  ];

  for (const pattern of checkoutPatterns) {
    if (lower.includes(pattern)) {
      if (actionRegistry.checkout?.enabled !== false ||
          actionRegistry['commerce.checkout']?.enabled !== false) {
        return {
          action: actionRegistry.checkout ? 'checkout' : 'commerce.checkout',
          params: {}
        };
      }
    }
  }

  // No tool detected
  return null;
}

/**
 * Extract product ID from message string
 */
function extractProductId(message) {
  if (!message) return null;

  const patterns = [
    /product[_-]?id[:\s]*([a-zA-Z0-9_-]+)/i,
    /product[:\s]*#?([a-zA-Z0-9_-]+)/i,
    /id[:\s]*([a-zA-Z0-9_-]+)/i,
    /#([a-zA-Z0-9_-]+)/,
    /\b([a-zA-Z0-9_-]{8,})\b/
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// ============================================================================
// PROVIDER DRIVERS - Text-only responses (NO native tool calling)
// ============================================================================

/**
 * Call GROQ LLM - Returns plain text only
 */
async function callGroqLLM(messages, systemPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GROQ_API_KEY not configured' };
  }

  try {
    const groq = new Groq({ apiKey });

    const formattedMessages = [];

    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content || ''
      });
    }

    const response = await groq.chat.completions.create({
      model: PROVIDER_CONFIG.groq.model,
      messages: formattedMessages,
      max_tokens: PROVIDER_CONFIG.groq.maxTokens,
      temperature: PROVIDER_CONFIG.groq.temperature
    });

    const content = response.choices?.[0]?.message?.content || '';

    return {
      success: true,
      content: content.trim(),
      provider: 'groq',
      model: PROVIDER_CONFIG.groq.model
    };

  } catch (error) {
    console.error('[LLM] GROQ error:', error.message);
    return { success: false, error: error.message, provider: 'groq' };
  }
}

/**
 * Call Gemini LLM - Returns plain text only (uses v1 API)
 */
async function callGeminiLLM(messages, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: PROVIDER_CONFIG.gemini.model });

    const parts = [];

    if (systemPrompt) {
      parts.push({ text: 'System: ' + systemPrompt + '\n\n' });
    }

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      parts.push({ text: role + ': ' + (msg.content || '') + '\n' });
    }

    parts.push({ text: 'Assistant: ' });

    const result = await model.generateContent({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: PROVIDER_CONFIG.gemini.maxTokens,
        temperature: PROVIDER_CONFIG.gemini.temperature
      }
    });

    const response = result.response;
    const content = response.text() || '';

    return {
      success: true,
      content: content.trim(),
      provider: 'gemini',
      model: PROVIDER_CONFIG.gemini.model
    };

  } catch (error) {
    console.error('[LLM] Gemini error:', error.message);
    return { success: false, error: error.message, provider: 'gemini' };
  }
}

/**
 * Call Mistral LLM - Returns plain text only
 */
async function callMistralLLM(messages, systemPrompt) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'MISTRAL_API_KEY not configured' };
  }

  try {
    const mistral = new Mistral({ apiKey });

    const formattedMessages = [];

    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content || ''
      });
    }

    const response = await mistral.chat.complete({
      model: PROVIDER_CONFIG.mistral.model,
      messages: formattedMessages,
      maxTokens: PROVIDER_CONFIG.mistral.maxTokens,
      temperature: PROVIDER_CONFIG.mistral.temperature
    });

    const content = response.choices?.[0]?.message?.content || '';

    return {
      success: true,
      content: content.trim(),
      provider: 'mistral',
      model: PROVIDER_CONFIG.mistral.model
    };

  } catch (error) {
    console.error('[LLM] Mistral error:', error.message);
    return { success: false, error: error.message, provider: 'mistral' };
  }
}

/**
 * Mock LLM - Pattern matching fallback (always works)
 */
async function callMockLLM(messages, systemPrompt) {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const lower = lastMessage.toLowerCase();

  let content = '';

  if (lower.includes('outfit') || lower.includes('wear')) {
    content = "I'd be happy to help you create a complete outfit! Let me put together some coordinated pieces that would work well together based on your preferences.";
  } else if (lower.includes('recommend') || lower.includes('suggest') || lower.includes('show')) {
    content = "I'd love to recommend some products for you! Based on what you're looking for, let me find some great options.";
  } else if (lower.includes('cart')) {
    content = 'I can help you with your shopping cart. What would you like to do?';
  } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    content = "Hello! I'm your AI shopping assistant. How can I help you today? I can recommend products, create outfits, or help you find what you're looking for.";
  } else if (lower.includes('thank')) {
    content = "You're welcome! Is there anything else I can help you with?";
  } else if (lower.includes('help')) {
    content = "I'm here to help! I can:\n- Recommend products based on your preferences\n- Create complete outfit suggestions\n- Help you find specific items\n- Manage your shopping cart\n\nWhat would you like to do?";
  } else {
    content = "I understand you're interested in shopping. Would you like me to recommend some products or help you find something specific?";
  }

  return {
    success: true,
    content: content,
    provider: 'mock',
    model: 'mock-v1'
  };
}

// ============================================================================
// MAIN LLM ORCHESTRATOR
// ============================================================================

/**
 * Run LLM with provider fallback loop
 * 
 * @param {Object} options
 * @param {Array} options.messages - Conversation messages
 * @param {string} options.systemPrompt - System prompt
 * @param {Object} options.actionRegistry - Available actions
 * @param {string} options.preferredProvider - Preferred provider (optional)
 * @returns {Object} - { type: 'tool'|'message', ... }
 */
async function runLLM({
  messages = [],
  systemPrompt = '',
  actionRegistry = {},
  preferredProvider = null
}) {
  let providers = [...PROVIDER_ORDER];
  if (preferredProvider && PROVIDER_ORDER.includes(preferredProvider)) {
    providers = [preferredProvider, ...PROVIDER_ORDER.filter(p => p !== preferredProvider)];
  }

  const enhancedSystemPrompt = systemPrompt + '\n\nIMPORTANT: When the user asks for product recommendations, outfit suggestions, or wants to perform shopping actions, respond naturally while clearly expressing the intent. Always be helpful, conversational, and focused on assisting with shopping needs.';

  let lastError = null;
  let llmResponse = null;

  for (const provider of providers) {
    console.log('[LLM] Trying provider: ' + provider);

    try {
      switch (provider) {
        case 'groq':
          llmResponse = await callGroqLLM(messages, enhancedSystemPrompt);
          break;
        case 'gemini':
          llmResponse = await callGeminiLLM(messages, enhancedSystemPrompt);
          break;
        case 'mistral':
          llmResponse = await callMistralLLM(messages, enhancedSystemPrompt);
          break;
        case 'mock':
          llmResponse = await callMockLLM(messages, enhancedSystemPrompt);
          break;
        default:
          continue;
      }

      if (llmResponse.success) {
        console.log('[LLM] Success with provider: ' + provider);
        break;
      } else {
        console.log('[LLM] Provider ' + provider + ' failed: ' + llmResponse.error);
        lastError = llmResponse.error;
      }
    } catch (error) {
      console.error('[LLM] Provider ' + provider + ' threw error:', error.message);
      lastError = error.message;
    }
  }

  if (!llmResponse || !llmResponse.success) {
    console.error('[LLM] All providers failed, returning graceful message');
    return {
      type: 'message',
      text: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
      provider: 'fallback',
      error: lastError
    };
  }

  const userMessage = messages[messages.length - 1]?.content || '';
  const combinedText = userMessage + ' ' + llmResponse.content;

  const toolIntent = determineTool(combinedText, actionRegistry);

  if (toolIntent) {
    console.log('[LLM] Tool detected: ' + toolIntent.action);
    return {
      type: 'tool',
      action: toolIntent.action,
      params: toolIntent.params,
      text: llmResponse.content,
      provider: llmResponse.provider,
      model: llmResponse.model
    };
  }

  return {
    type: 'message',
    text: llmResponse.content,
    provider: llmResponse.provider,
    model: llmResponse.model
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function buildSystemPrompt(tenantConfig) {
  const brandName = tenantConfig?.settings?.brandName || 'Store';
  const brandVoice = tenantConfig?.settings?.brandVoice || 'friendly and helpful';
  const productCategories = tenantConfig?.settings?.productCategories || [];

  let prompt = 'You are a helpful AI shopping assistant for ' + brandName + '. Your tone is ' + brandVoice + '.';

  if (productCategories.length > 0) {
    prompt += '\n\nWe specialize in: ' + productCategories.join(', ') + '.';
  }

  prompt += '\n\nYour role is to:\n- Help customers find products they will love\n- Create outfit recommendations when asked\n- Answer questions about products and shopping\n- Guide customers through their shopping journey\n\nBe concise, helpful, and personable.';

  return prompt;
}

function getProviderStatus() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    mock: true
  };
}

function healthCheck() {
  const status = getProviderStatus();
  const available = Object.entries(status)
    .filter(([_, v]) => v)
    .map(([k, _]) => k);

  return {
    healthy: available.length > 0,
    availableProviders: available,
    status
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runLLM,
  determineTool,
  extractProductId,
  callGroqLLM,
  callGeminiLLM,
  callMistralLLM,
  callMockLLM,
  buildSystemPrompt,
  getProviderStatus,
  healthCheck,
  PROVIDER_ORDER,
  PROVIDER_CONFIG
};
