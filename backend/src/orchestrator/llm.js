/**
 * Multi-Provider LLM Orchestrator Module
 * 
 * Supports multiple LLM providers with automatic fallback:
 * Priority order: GROQ → GEMINI → MISTRAL → MOCK
 * 
 * All providers support unified function-calling output format.
 */

const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Mistral = require('@mistralai/mistralai');
require('dotenv').config();

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run LLM processing with multi-provider fallback
 * 
 * @param {Object} options - Options object
 * @param {string} options.message - User's message text
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {Object} options.actionRegistry - Available actions for this tenant
 * @param {Array} options.conversationHistory - Previous messages (optional)
 * @returns {Promise<Object>} Normalized LLM decision object
 */
async function runLLM({ message, tenantConfig, actionRegistry, conversationHistory = [] }) {
  console.log(`[llm] Processing message for tenant: ${tenantConfig.tenantId}`);
  console.log(`[llm] Message: "${message}"`);
  console.log(`[llm] Available actions: ${Object.keys(actionRegistry).length}`);

  // Get provider priority from environment
  const priorityString = process.env.LLM_PRIORITY || 'GROQ,GEMINI,MISTRAL,MOCK';
  const providerList = priorityString.split(',').map(p => p.trim().toUpperCase());
  
  console.log(`[llm] Provider priority: ${providerList.join(' → ')}`);

  // Prepare request context
  const request = {
    message,
    actionRegistry,
    tenantConfig,
    conversationHistory
  };

  // Try each provider in order
  for (const provider of providerList) {
    try {
      console.log(`[llm] Trying provider: ${provider}`);
      
      let rawResponse;
      
      switch (provider) {
        case 'GROQ':
          rawResponse = await callGroqLLM(request);
          break;
        
        case 'GEMINI':
          rawResponse = await callGeminiLLM(request);
          break;
        
        case 'MISTRAL':
          rawResponse = await callMistralLLM(request);
          break;
        
        case 'MOCK':
          rawResponse = await callMockLLM(request);
          break;
        
        default:
          console.log(`[llm] Unknown provider: ${provider}, skipping`);
          continue;
      }

      // Normalize response to unified format
      const normalized = normalizeProviderResponse(provider, rawResponse, request);
      
      console.log(`[llm] ✓ Success with ${provider}`);
      console.log(`[llm] Decision type: ${normalized.type}`);
      if (normalized.type === 'tool') {
        console.log(`[llm] Tool selected: ${normalized.action}`);
      }
      
      return normalized;

    } catch (error) {
      console.log(`[llm] ✗ ${provider} failed: ${error.message}`);
      // Continue to next provider
    }
  }

  // All providers failed, use mock as absolute fallback
  console.log(`[llm] All providers failed, using MOCK fallback`);
  const mockResponse = await callMockLLM(request);
  return normalizeProviderResponse('MOCK', mockResponse, request);
}

// ============================================================================
// PROVIDER DRIVERS
// ============================================================================

/**
 * Call Groq LLM with function calling
 */
async function callGroqLLM(request) {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const groq = new Groq({ apiKey });
  
  // Build system prompt
  const systemPrompt = buildSystemPrompt(request.tenantConfig, request.actionRegistry);
  
  // Build tools/functions from action registry
  const tools = buildToolsFromRegistry(request.actionRegistry);
  
  // Call Groq API
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: request.message }
    ],
    model: 'llama-3.3-70b-versatile', // Fast and capable model
    temperature: 0.7,
    max_tokens: 1024,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined
  });

  return {
    provider: 'GROQ',
    raw: chatCompletion
  };
}

/**
 * Call Google Gemini LLM
 */
async function callGeminiLLM(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  // Build prompt with function calling instructions
  const systemPrompt = buildSystemPrompt(request.tenantConfig, request.actionRegistry);
  const fullPrompt = `${systemPrompt}\n\nUser message: ${request.message}`;
  
  // Gemini function calling
  const tools = buildGeminiTools(request.actionRegistry);
  
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    tools: tools.length > 0 ? tools : undefined,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  });

  return {
    provider: 'GEMINI',
    raw: result.response
  };
}

/**
 * Call Mistral LLM
 */
async function callMistralLLM(request) {
  const apiKey = process.env.MISTRAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY not configured');
  }

  const client = new Mistral({ apiKey });
  
  // Build system prompt
  const systemPrompt = buildSystemPrompt(request.tenantConfig, request.actionRegistry);
  
  // Build tools
  const tools = buildToolsFromRegistry(request.actionRegistry);
  
  // Call Mistral API
  const chatResponse = await client.chat.complete({
    model: 'mistral-small-latest',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: request.message }
    ],
    temperature: 0.7,
    maxTokens: 1024,
    tools: tools.length > 0 ? tools : undefined,
    toolChoice: tools.length > 0 ? 'auto' : undefined
  });

  return {
    provider: 'MISTRAL',
    raw: chatResponse
  };
}

/**
 * Call Mock LLM (pattern matching fallback)
 */
async function callMockLLM(request) {
  const { message, actionRegistry, tenantConfig } = request;
  const lowerMessage = message.toLowerCase();

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 50));

  // Pattern matching for common intents
  
  // Outfit recommendation intent (more specific, check first)
  if ((lowerMessage.includes('outfit') && (lowerMessage.includes('complete') || lowerMessage.includes('full') || lowerMessage.includes('entire'))) ||
      lowerMessage.includes('dress me') ||
      lowerMessage.includes('what should i wear') ||
      lowerMessage.includes('complete look') ||
      (lowerMessage.includes('eid') && lowerMessage.includes('outfit'))) {
    
    if (actionRegistry.recommend_outfit?.enabled) {
      return {
        type: 'tool',
        action: 'recommend_outfit',
        params: {
          query: message,
          preferences: []
        },
        reasoning: 'Mock LLM detected outfit recommendation intent'
      };
    }
  }
  
  // General recommendation intent
  if (lowerMessage.includes('recommend') || 
      lowerMessage.includes('suggest') || 
      lowerMessage.includes('outfit') ||
      lowerMessage.includes('idea') ||
      lowerMessage.includes('eid') ||
      lowerMessage.includes('style') ||
      lowerMessage.includes('what to wear')) {
    
    if (actionRegistry.recommend_products?.enabled) {
      return {
        type: 'tool',
        action: 'recommend_products',
        params: {
          query: message,
          preferences: []
        },
        reasoning: 'Mock LLM detected recommendation intent'
      };
    }
  }

  // Search intent
  if (lowerMessage.includes('search') || 
      lowerMessage.includes('find') || 
      lowerMessage.includes('look for') ||
      lowerMessage.includes('show me')) {
    
    if (actionRegistry.search_products?.enabled) {
      const query = extractSearchQuery(message);
      return {
        type: 'tool',
        action: 'search_products',
        params: { query },
        reasoning: `Mock LLM detected search intent for "${query}"`
      };
    }
  }

  // Add to cart intent
  if ((lowerMessage.includes('add') && (lowerMessage.includes('cart') || lowerMessage.includes('basket'))) ||
      lowerMessage.includes('buy') ||
      lowerMessage.includes('purchase') ||
      lowerMessage.includes('get me')) {
    
    if (actionRegistry.add_to_cart?.enabled) {
      const productInfo = extractProductInfo(message);
      return {
        type: 'tool',
        action: 'add_to_cart',
        params: productInfo,
        reasoning: 'Mock LLM detected add-to-cart/purchase intent'
      };
    }
  }

  // Checkout intent
  if (lowerMessage.includes('checkout') || 
      lowerMessage.includes('complete order') ||
      lowerMessage.includes('finalize purchase') ||
      lowerMessage.includes('pay now')) {
    
    if (actionRegistry.checkout?.enabled) {
      return {
        type: 'tool',
        action: 'checkout',
        params: { cartId: 'cart-' + Math.random().toString(36).substring(7) },
        reasoning: 'Mock LLM detected checkout intent'
      };
    }
  }

  // Support intent
  if (lowerMessage.includes('help') || 
      lowerMessage.includes('problem') ||
      lowerMessage.includes('issue') ||
      lowerMessage.includes('support')) {
    
    if (actionRegistry.create_ticket?.enabled) {
      return {
        type: 'tool',
        action: 'create_ticket',
        params: {
          subject: 'User Support Request',
          description: message
        },
        reasoning: 'Mock LLM detected support request'
      };
    }
  }

  // Default: conversational response
  return {
    type: 'message',
    text: generateMockResponse(message, tenantConfig),
    reasoning: 'No tool intent detected, returning conversational response'
  };
}

// ============================================================================
// RESPONSE NORMALIZATION
// ============================================================================

/**
 * Normalize provider-specific responses to unified format
 * 
 * @param {string} provider - Provider name (GROQ, GEMINI, MISTRAL, MOCK)
 * @param {Object} rawResponse - Raw provider response
 * @param {Object} request - Original request context
 * @returns {Object} Normalized response: {type, action, params, text, reasoning}
 */
function normalizeProviderResponse(provider, rawResponse, request) {
  switch (provider) {
    case 'GROQ':
      return normalizeGroqResponse(rawResponse, request);
    
    case 'GEMINI':
      return normalizeGeminiResponse(rawResponse, request);
    
    case 'MISTRAL':
      return normalizeMistralResponse(rawResponse, request);
    
    case 'MOCK':
      // Mock already returns normalized format
      return rawResponse;
    
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Normalize Groq response (OpenAI-compatible format)
 */
function normalizeGroqResponse(response, request) {
  const message = response.raw.choices[0].message;
  
  // Check for tool calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);
    
    return {
      type: 'tool',
      action: functionName,
      params: functionArgs,
      reasoning: `Groq LLM selected tool: ${functionName}`,
      provider: 'GROQ',
      _meta: {
        model: response.raw.model,
        usage: response.raw.usage
      }
    };
  }
  
  // Regular message
  return {
    type: 'message',
    text: message.content,
    reasoning: 'Groq LLM returned conversational response',
    provider: 'GROQ',
    _meta: {
      model: response.raw.model,
      usage: response.raw.usage
    }
  };
}

/**
 * Normalize Gemini response
 */
function normalizeGeminiResponse(response, request) {
  const candidate = response.raw.candidates?.[0];
  
  if (!candidate) {
    throw new Error('Gemini response has no candidates');
  }
  
  const content = candidate.content;
  
  // Check for function calls
  if (content.parts?.[0]?.functionCall) {
    const functionCall = content.parts[0].functionCall;
    
    return {
      type: 'tool',
      action: functionCall.name,
      params: functionCall.args,
      reasoning: `Gemini LLM selected tool: ${functionCall.name}`,
      provider: 'GEMINI',
      _meta: {
        model: 'gemini-1.5-flash'
      }
    };
  }
  
  // Regular text response
  const text = content.parts?.[0]?.text || '';
  
  return {
    type: 'message',
    text: text,
    reasoning: 'Gemini LLM returned conversational response',
    provider: 'GEMINI',
    _meta: {
      model: 'gemini-1.5-flash'
    }
  };
}

/**
 * Normalize Mistral response
 */
function normalizeMistralResponse(response, request) {
  const message = response.raw.choices?.[0]?.message;
  
  if (!message) {
    throw new Error('Mistral response has no message');
  }
  
  // Check for tool calls
  if (message.toolCalls && message.toolCalls.length > 0) {
    const toolCall = message.toolCalls[0];
    const functionName = toolCall.function.name;
    const functionArgs = typeof toolCall.function.arguments === 'string' 
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;
    
    return {
      type: 'tool',
      action: functionName,
      params: functionArgs,
      reasoning: `Mistral LLM selected tool: ${functionName}`,
      provider: 'MISTRAL',
      _meta: {
        model: response.raw.model,
        usage: response.raw.usage
      }
    };
  }
  
  // Regular message
  return {
    type: 'message',
    text: message.content,
    reasoning: 'Mistral LLM returned conversational response',
    provider: 'MISTRAL',
    _meta: {
      model: response.raw.model,
      usage: response.raw.usage
    }
  };
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build system prompt for LLM
 */
function buildSystemPrompt(tenantConfig, actionRegistry) {
  const availableActions = Object.entries(actionRegistry)
    .filter(([_, config]) => config.enabled)
    .map(([name, _]) => name);

  return `You are an AI assistant for ${tenantConfig.displayName}.

Your role is to help users by either:
1. Responding with natural conversational text
2. Calling available tools/actions to fulfill their request

Available actions: ${availableActions.join(', ')}

When a user asks to do something that matches an available action, call that action.
Otherwise, respond conversationally.

Be helpful, concise, and professional.`;
}

/**
 * Build OpenAI/Groq/Mistral compatible tools from action registry
 */
function buildToolsFromRegistry(actionRegistry) {
  const tools = [];
  
  for (const [actionName, actionConfig] of Object.entries(actionRegistry)) {
    if (!actionConfig.enabled) continue;
    
    // Create tool definition
    const tool = {
      type: 'function',
      function: {
        name: actionName,
        description: actionConfig.description || `Execute ${actionName} action`,
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    };
    
    // Add common parameters based on action type
    if (actionName.includes('search')) {
      tool.function.parameters.properties.query = {
        type: 'string',
        description: 'Search query'
      };
      tool.function.parameters.required.push('query');
    }
    
    if (actionName.includes('cart')) {
      tool.function.parameters.properties.productId = {
        type: 'string',
        description: 'Product ID'
      };
      tool.function.parameters.properties.quantity = {
        type: 'integer',
        description: 'Quantity',
        default: 1
      };
    }
    
    if (actionName.includes('checkout')) {
      tool.function.parameters.properties.cartId = {
        type: 'string',
        description: 'Cart ID'
      };
    }
    
    if (actionName.includes('ticket')) {
      tool.function.parameters.properties.subject = {
        type: 'string',
        description: 'Ticket subject'
      };
      tool.function.parameters.properties.description = {
        type: 'string',
        description: 'Issue description'
      };
      tool.function.parameters.required.push('subject', 'description');
    }
    
    if (actionName.includes('recommend')) {
      tool.function.parameters.properties.query = {
        type: 'string',
        description: 'Recommendation query (e.g., "eid outfit", "formal shoes")'
      };
      tool.function.parameters.properties.preferences = {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'User preferences (e.g., colors, styles, categories)',
        default: []
      };
      tool.function.parameters.properties.limit = {
        type: 'integer',
        description: 'Maximum number of recommendations to return',
        default: 10
      };
    }
    
    tools.push(tool);
  }
  
  return tools;
}

/**
 * Build Gemini-specific tools format
 */
function buildGeminiTools(actionRegistry) {
  const tools = buildToolsFromRegistry(actionRegistry);
  
  if (tools.length === 0) {
    return [];
  }
  
  // Convert to Gemini format
  const functionDeclarations = tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters
  }));
  
  return [{ functionDeclarations }];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract search query from message
 */
function extractSearchQuery(message) {
  let query = message
    .toLowerCase()
    .replace(/^(search for|find|look for|show me|get me)\s+/i, '')
    .trim();
  
  return query || message;
}

/**
 * Extract product information from message
 */
function extractProductInfo(message) {
  const productIdMatch = message.match(/product[:\s]+([a-zA-Z0-9-]+)/i);
  const productId = productIdMatch 
    ? productIdMatch[1] 
    : 'product-' + Math.random().toString(36).substring(7);
  
  const quantityMatch = message.match(/(\d+)\s*(x|times|of)?/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
  
  return { productId, quantity };
}

/**
 * Generate mock conversational response
 */
function generateMockResponse(message, tenantConfig) {
  return `Hello! I'm the AI assistant for ${tenantConfig.displayName}. You said: "${message}". How can I help you today?`;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runLLM,
  // Provider drivers (for testing)
  callGroqLLM,
  callGeminiLLM,
  callMistralLLM,
  callMockLLM,
  // Normalization (for testing)
  normalizeProviderResponse,
  // Utilities (for testing)
  buildSystemPrompt,
  buildToolsFromRegistry
};
