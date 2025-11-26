/**
 * SAAI LLM Orchestrator - Two-Stage Tool Calling
 * 
 * This orchestrator implements a two-stage LLM pipeline:
 * 
 * Stage 1: Tool Decision
 * - LLM receives user message + tool definitions
 * - LLM decides: respond directly OR call a tool
 * - Uses native tool calling (Groq/Gemini/Mistral)
 * 
 * Stage 2: Grounded Explanation
 * - If tool was called, execute it (recommender/commerce)
 * - Call LLM again with tool results
 * - LLM generates response that ONLY mentions actual products
 * - No hallucination - response is grounded in real data
 * 
 * Provider fallback: GROQ → GEMINI → MISTRAL → MOCK
 */

const { runLLMWithTools, runLLMPlain, buildMessages } = require('../llm/llmRouter');
const { runAction } = require('./tools');

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const TOOL_DECISION_PROMPT = `You are SAAI, an AI sales assistant for a fashion and lifestyle store.

You have access to tools to help customers:
- search_products: Search for products by query
- recommend_products: Recommend products based on preferences
- recommend_outfit: Recommend a complete outfit (shirt + pant + shoe)
- add_to_cart: Add a product to the shopping cart
- view_cart: View current cart contents
- checkout: Complete purchase and create order

WHEN TO USE TOOLS:
- Use recommend_outfit when the user asks for: outfit, complete look, what to wear, dress me, style me, full look
- Use recommend_products when the user asks for: recommendations, suggestions, "show me", "find me", looking for something
- Use search_products when the user wants to: search, browse, find specific items
- Use add_to_cart when the user wants to: add to cart, buy this, get this
- Use view_cart when the user asks: what's in my cart, show cart, my cart, cart contents
- Use checkout when the user wants to: checkout, place order, complete purchase, buy now, proceed to payment

WHEN NOT TO USE TOOLS:
- Greetings (hello, hi, hey)
- Thank you messages
- General questions about the store
- Questions about shipping, returns, etc.

Be helpful, friendly, and proactive in assisting customers.`;

const GROUNDED_OUTFIT_PROMPT = `You are SAAI, a shopping assistant. You MUST ONLY talk about the exact products I give you.

CRITICAL RULES:
1. DO NOT invent, imagine, or mention ANY products not listed below
2. DO NOT add extra items like accessories, bags, watches unless they are listed
3. ONLY describe the shirt, pant, and shoe I provide
4. Use the exact product names provided
5. Keep your response concise and natural`;

const GROUNDED_PRODUCTS_PROMPT = `You are SAAI, a shopping assistant. You MUST ONLY talk about the exact products I give you.

CRITICAL RULES:
1. DO NOT invent, imagine, or mention ANY products not in the list below
2. ONLY describe products from the list I provide
3. Use the exact product names provided
4. Keep your response concise and helpful`;

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

/**
 * Run the two-stage LLM orchestration
 * 
 * @param {Object} options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {Object} options.actionRegistry - Available actions
 * @param {string} options.userMessage - User's message
 * @param {Array} [options.conversationHistory] - Previous messages
 * @param {string} [options.sessionId] - Session ID for cart isolation
 * @returns {Promise<Object>} Orchestration result
 */
async function runLLMOrchestrator({ tenantConfig, actionRegistry, userMessage, conversationHistory = [], sessionId = null }) {
  console.log('[Orchestrator] Starting two-stage LLM pipeline');
  console.log(`[Orchestrator] User message: "${userMessage}"`);

  // Build system prompt with tenant customization
  const systemPrompt = buildSystemPrompt(tenantConfig);

  // Build messages for Stage 1
  const messages = buildMessages({
    systemPrompt,
    userMessage,
    conversationHistory
  });

  // =========================================================================
  // STAGE 1: Tool Decision
  // =========================================================================
  console.log('[Orchestrator] Stage 1: Tool Decision');

  const llmDecision = await runLLMWithTools({
    messages,
    tenantConfig,
    actionRegistry
  });

  console.log(`[Orchestrator] LLM decision: ${llmDecision.decision}`);

  // If LLM decided to just respond (no tool)
  if (llmDecision.decision === 'message') {
    return {
      type: 'message',
      provider: llmDecision.provider,
      model: llmDecision.model,
      text: llmDecision.text
    };
  }

  // =========================================================================
  // TOOL EXECUTION
  // =========================================================================
  const { tool } = llmDecision;
  const actionName = tool.name;
  const params = tool.arguments || {};

  // Inject sessionId into params for cart-related tools
  if (sessionId) {
    params.sessionId = sessionId;
  }

  console.log(`[Orchestrator] Executing tool: ${actionName}`);
  console.log(`[Orchestrator] Tool params:`, params);
  if (sessionId) {
    console.log(`[Orchestrator] Session ID: ${sessionId}`);
  }

  let toolResult;
  try {
    toolResult = await runAction({
      tenantConfig,
      actionRegistry,
      action: actionName,
      params
    });
    console.log(`[Orchestrator] Tool executed successfully`);
  } catch (actionError) {
    console.error(`[Orchestrator] Tool execution failed:`, actionError.message);
    // Return LLM's text as fallback
    return {
      type: 'message',
      provider: llmDecision.provider,
      model: llmDecision.model,
      text: llmDecision.text || "I tried to help with that but encountered an issue. Could you try again?",
      error: actionError.message
    };
  }

  // =========================================================================
  // STAGE 2: Grounded Explanation
  // =========================================================================
  console.log('[Orchestrator] Stage 2: Grounded Explanation');

  const groundedText = await runGroundedExplanation({
    tenantConfig,
    userMessage,
    action: actionName,
    params,
    toolResult,
    provider: llmDecision.provider,
    history: conversationHistory
  });

  return {
    type: 'tool_result',
    provider: llmDecision.provider,
    model: llmDecision.model,
    action: actionName,
    params,
    toolResult,
    groundedText
  };
}

// ============================================================================
// GROUNDED EXPLANATION GENERATOR
// ============================================================================

/**
 * Generate a grounded explanation based on tool results
 * 
 * The LLM is called again with:
 * - Original user message
 * - Actual tool results (products/outfit)
 * - Strict instructions to ONLY mention these products
 * 
 * @param {Object} options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {string} options.userMessage - Original user message
 * @param {string} options.action - Tool/action that was executed
 * @param {Object} options.params - Tool parameters
 * @param {Object} options.toolResult - Result from tool execution
 * @param {string} options.provider - Provider that made the tool decision
 * @param {Array} [options.history] - Conversation history (for future use)
 * @returns {Promise<string>} Grounded explanation text
 */
async function runGroundedExplanation({ tenantConfig, userMessage, action, params, toolResult, provider, history = [] }) {
  console.log(`[Orchestrator] Generating grounded explanation for: ${action}`);

  let systemPrompt;
  let userPrompt;

  // Build prompts based on action type
  if (action === 'recommend_outfit') {
    systemPrompt = GROUNDED_OUTFIT_PROMPT;
    userPrompt = buildOutfitPrompt(userMessage, toolResult);
  } else if (action === 'recommend_products' || action === 'search_products') {
    systemPrompt = GROUNDED_PRODUCTS_PROMPT;
    userPrompt = buildProductsPrompt(userMessage, toolResult);
  } else if (action === 'add_to_cart') {
    // For cart actions, generate simple confirmation
    return generateCartConfirmation(params, toolResult);
  } else {
    // For unknown actions, return generic confirmation
    return `I've completed that action for you. Is there anything else you'd like help with?`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  // Call LLM for grounded response (no tools)
  const result = await runLLMPlain({
    messages,
    preferredProvider: provider
  });

  if (result.success && result.text) {
    return result.text;
  }

  // Fallback: generate a simple response
  return generateFallbackExplanation(action, toolResult);
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

/**
 * Build prompt for outfit explanation
 */
function buildOutfitPrompt(userMessage, toolResult) {
  const outfit = toolResult.items || toolResult;
  
  let prompt = `User asked: "${userMessage}"\n\n`;
  prompt += `Here is the outfit I've selected from our catalog. ONLY talk about these exact items:\n\n`;

  if (outfit.shirt) {
    const s = outfit.shirt;
    prompt += `SHIRT: ${s.name}\n`;
    prompt += `  - Price: ₹${s.price}\n`;
    prompt += `  - Colors: ${(s.colors || []).join(', ')}\n`;
    prompt += `  - Tags: ${(s.tags || []).join(', ')}\n\n`;
  }

  if (outfit.pant) {
    const p = outfit.pant;
    prompt += `PANT: ${p.name}\n`;
    prompt += `  - Price: ₹${p.price}\n`;
    prompt += `  - Colors: ${(p.colors || []).join(', ')}\n`;
    prompt += `  - Tags: ${(p.tags || []).join(', ')}\n\n`;
  }

  if (outfit.shoe) {
    const sh = outfit.shoe;
    prompt += `SHOE: ${sh.name}\n`;
    prompt += `  - Price: ₹${sh.price}\n`;
    prompt += `  - Colors: ${(sh.colors || []).join(', ')}\n`;
    prompt += `  - Tags: ${(sh.tags || []).join(', ')}\n\n`;
  }

  prompt += `Write a short, friendly message (2-3 sentences) explaining why this outfit works well for the user's request. `;
  prompt += `Mention the products by their exact names. DO NOT recommend any additional items.`;

  return prompt;
}

/**
 * Build prompt for products explanation
 */
function buildProductsPrompt(userMessage, toolResult) {
  const products = toolResult.items || toolResult.products || [];
  
  let prompt = `User asked: "${userMessage}"\n\n`;
  prompt += `Here are the products I found. ONLY talk about these exact items:\n\n`;

  const topProducts = products.slice(0, 5); // Limit to top 5 for context
  
  topProducts.forEach((p, i) => {
    prompt += `${i + 1}. ${p.name}\n`;
    prompt += `   - Price: ₹${p.price}\n`;
    prompt += `   - Category: ${p.category}\n`;
    prompt += `   - Colors: ${(p.colors || []).join(', ')}\n`;
    prompt += `   - Tags: ${(p.tags || []).join(', ')}\n\n`;
  });

  prompt += `Write a short, helpful message (2-3 sentences) introducing these products to the user. `;
  prompt += `Mention 2-3 products by their exact names. DO NOT recommend any products not in this list.`;

  return prompt;
}

/**
 * Generate cart confirmation message
 */
function generateCartConfirmation(params, toolResult) {
  const productId = params.productId || 'the item';
  const quantity = params.quantity || 1;
  
  if (toolResult.success === false) {
    return `I couldn't add that item to your cart. ${toolResult.message || 'Please try again.'}`;
  }

  return `I've added ${quantity > 1 ? quantity + ' of ' : ''}${productId} to your cart! Would you like to continue shopping or proceed to checkout?`;
}

/**
 * Generate fallback explanation when LLM call fails
 */
function generateFallbackExplanation(action, toolResult) {
  if (action === 'recommend_outfit') {
    const outfit = toolResult.items || toolResult;
    const parts = [];
    if (outfit.shirt) parts.push(outfit.shirt.name);
    if (outfit.pant) parts.push(outfit.pant.name);
    if (outfit.shoe) parts.push(outfit.shoe.name);
    
    if (parts.length > 0) {
      return `I've put together a great outfit for you: ${parts.join(', ')}. These pieces work well together for your occasion!`;
    }
  }

  if (action === 'recommend_products' || action === 'search_products') {
    const products = toolResult.items || toolResult.products || [];
    if (products.length > 0) {
      const topNames = products.slice(0, 3).map(p => p.name);
      return `I found some great options for you including ${topNames.join(', ')}. Take a look!`;
    }
  }

  return `I've found some options that might interest you. Let me know if you'd like more details!`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Build system prompt with tenant customization
 */
function buildSystemPrompt(tenantConfig) {
  const brandName = tenantConfig?.settings?.brandName || 'our store';
  const brandVoice = tenantConfig?.settings?.brandVoice || 'friendly and helpful';
  
  let prompt = TOOL_DECISION_PROMPT;
  
  // Add tenant customization
  prompt += `\n\nYou are assisting customers of ${brandName}. Your tone should be ${brandVoice}.`;
  
  return prompt;
}

/**
 * Get provider status
 */
function getProviderStatus() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    mock: true
  };
}

/**
 * Health check
 */
function healthCheck() {
  const status = getProviderStatus();
  const available = Object.entries(status)
    .filter(([_, v]) => v)
    .map(([k]) => k);

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
  runLLMOrchestrator,
  runGroundedExplanation,
  buildSystemPrompt,
  getProviderStatus,
  healthCheck
};
