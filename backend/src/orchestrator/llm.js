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

// Default tool instructions (used as base, persona is layered on top)
const TOOL_INSTRUCTIONS = `You have access to tools to help customers:
- search_products: Search for products by query
- recommend_products: Recommend products based on preferences
- recommend_outfit: Recommend a complete outfit (shirt + pant + shoe)
- add_to_cart: Add a SINGLE product to cart (one item only)
- add_outfit_to_cart: Add a COMPLETE outfit to cart (all 3 items at once)
- view_cart: View current cart contents
- checkout: Complete purchase and create order

WHEN TO USE TOOLS:
- Use recommend_outfit when the user asks for: outfit, complete look, what to wear, dress me, style me, full look, occasion outfit
- Use recommend_products when the user asks for: recommendations, suggestions, "show me", "find me", looking for something
- Use search_products when the user wants to: search, browse, find specific items
- Use add_to_cart when the user wants to add ONE SPECIFIC item: "add the shirt", "add p109"
- Use add_outfit_to_cart when the user wants to add an OUTFIT: "add this outfit", "add the outfit", "add these to cart", "buy this look", "get this outfit"
- Use view_cart when the user asks: what's in my cart, show cart, my cart, cart contents
- Use checkout when the user wants to: checkout, place order, complete purchase, buy now, proceed to payment

IMPORTANT: When the user says "add this outfit" or "add this to cart" after an outfit recommendation, use add_outfit_to_cart with the product IDs from the conversation.

STYLE CHANGES: If the user asks to change the style, formality level, or colors (e.g., "more casual", "more formal", "different color", "lighter color", "more street style"), you MUST call recommend_outfit again to generate a NEW outfit that matches their updated preferences. Do NOT just re-describe the previous outfit.

WHEN NOT TO USE TOOLS:
- Greetings (hello, hi, hey)
- Thank you messages
- General questions about the store
- Questions about shipping, returns, etc.`;

// ============================================================================
// AI BEHAVIORAL RULES (A.1 - A.7)
// ============================================================================

const GREETING_BEHAVIOR_RULES = `
=== A.1 GREETING BEHAVIOR ===
CRITICAL: If the user's message is ONLY a greeting or conversational filler like:
  - "hi", "hello", "hey", "ok", "thanks", "thank you", "cool", "nice", "great", "sure", "okay", "alright"
  - "good morning", "good evening", "what's up", "how are you"
  
Then you MUST:
  - Reply with a SHORT, friendly acknowledgment (1 sentence max)
  - Ask "What are you looking for today?" or similar
  - DO NOT suggest, recommend, or mention ANY products
  - DO NOT call any tool
  
ONLY propose products when the message contains CLEAR shopping intent like:
  - "looking for", "show me", "recommend", "find me", "I need", "I want"
  - "outfit for", "what should I wear", "help me find", "browse"
  - Specific product names, categories, or occasions`;

const TOOL_CALLING_RULES = `
=== A.2 DETERMINISTIC TOOL CALLING ===
CRITICAL: You MUST call the appropriate tool BEFORE claiming any action was performed.

DO NOT SAY: "I've added X to cart" or "Here's your outfit" WITHOUT actually calling the tool first.
DO NOT hallucinate or pretend you performed an action.

When the user wants to:
- Add to cart → MUST call add_to_cart or add_outfit_to_cart FIRST
- See cart → MUST call view_cart FIRST
- Checkout → MUST call checkout FIRST
- Find products → MUST call search_products or recommend_products FIRST
- Get outfit → MUST call recommend_outfit FIRST

If you are unsure which tool to call, ASK the user for clarification.
If a tool call fails, tell the user honestly and offer alternatives.`;

const MULTI_ITEM_PARSING_RULES = `
=== A.3 MULTI-ITEM NATURAL LANGUAGE PARSING ===
When the user mentions MULTIPLE products in one message, you MUST:
1. Parse and extract EVERY product name/ID mentioned
2. Map each product to its exact product ID from the catalog
3. Call add_to_cart for EACH item separately, OR use add_outfit_to_cart if it's an outfit

Examples:
- "Add the blue shirt and khaki pants" → add_to_cart for shirt, then add_to_cart for pants
- "I'll take the oxford shoes too" → add_to_cart for shoes
- "Add this outfit" (after seeing shirt+pant+shoe) → add_outfit_to_cart with all 3 IDs

NEVER ignore items the user mentioned. Process ALL of them.`;

const CHECKOUT_RULES = `
=== A.4 CHECKOUT ENFORCEMENT ===
When the user says ANY of these (or similar):
  - "buy now", "checkout", "place order", "purchase", "complete order"
  - "I want to buy", "proceed to payment", "finalize", "confirm order"
  
You MUST call the checkout tool IMMEDIATELY.
DO NOT just say "proceeding to checkout" without calling the tool.
DO NOT ask for confirmation unless the cart is empty.`;

const TONE_RULES = `
=== A.5 TONE & STYLE ===
- Be SHORT and CONFIDENT - max 2-3 sentences per response
- Sound like a helpful friend, not a formal assistant
- Use casual, conversational language
- Avoid corporate-speak, marketing fluff, or over-explanation
- When showing products, focus on 2-3 key highlights, not full descriptions
- Use emojis sparingly (1-2 max per response) for friendly tone
- If recommending, briefly explain WHY (e.g., "this works for Eid because...")`;

const ANTI_HALLUCINATION_RULES = `
=== A.6 ANTI-HALLUCINATION ===
ABSOLUTE RULES - NEVER BREAK THESE:
1. NEVER invent product names, prices, or IDs that don't exist in the catalog
2. NEVER suggest products that weren't returned by a tool call
3. NEVER make up availability, colors, sizes, or other product attributes
4. If you don't know something, say "I'm not sure" or check with a tool
5. If asked about a product not in catalog, say "I couldn't find that exact item"
6. ONLY mention products that are EXPLICITLY in the tool response
7. When listing products, use their EXACT names from the catalog`;

const TOOLS_FIRST_ENFORCEMENT = `
=== A.7 TOOLS-FIRST POLICY ===
If the user asks you to DO something (not just ask a question), ALWAYS prefer calling a tool over giving a text reply.

User intent → Required action:
- "Add X" → CALL add_to_cart, don't just say "added"
- "Show me my cart" → CALL view_cart, don't describe from memory
- "Find me a shirt" → CALL search_products or recommend_products
- "I want to checkout" → CALL checkout tool
- "Recommend an outfit" → CALL recommend_outfit

Only respond with text (no tool) for:
- Greetings and small talk
- Questions you can answer from context (shipping policy, etc.)
- Clarification questions back to the user`;

// Grounded prompt templates (persona is prepended dynamically)
const GROUNDED_OUTFIT_RULES = `CRITICAL RULES:
1. DO NOT invent, imagine, or mention ANY products not listed below
2. DO NOT add extra items like accessories, bags, watches unless they are listed
3. ONLY describe the shirt, pant, and shoe I provide
4. Use the exact product names provided
5. Keep your response concise and natural`;

const GROUNDED_PRODUCTS_RULES = `CRITICAL RULES:
1. DO NOT invent, imagine, or mention ANY products not in the list below
2. ONLY describe products from the list I provide
3. Use the exact product names provided
4. Keep your response concise and helpful`;

// ============================================================================
// STYLE CHANGE DETECTION
// ============================================================================

/**
 * Detect if user message is ONLY a greeting (no shopping intent)
 * Used as a safety fallback to prevent unwanted product recommendations
 */
const GREETING_ONLY_PATTERNS = [
  /^(hi|hey|hello|hola|yo|sup)[\s!.,]*$/i,
  /^good\s*(morning|afternoon|evening|day)[\s!.,]*$/i,
  /^(thanks|thank you|thx|ty)[\s!.,]*$/i,
  /^(ok|okay|sure|alright|cool|nice|great|awesome|perfect)[\s!.,]*$/i,
  /^whats?\s*up[\s!.,?]*$/i,
  /^how\s*are\s*you[\s!.,?]*$/i,
  /^(no|nope|not really|maybe later|not now)[\s!.,]*$/i,
  /^(yes|yeah|yep|yup)[\s!.,]*$/i
];

function isGreetingOnly(message) {
  const normalized = message.toLowerCase().trim();
  return GREETING_ONLY_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Detect if user message is requesting a style change
 * 
 * This is used as a fallback to force recommend_outfit when the LLM
 * incorrectly decides to respond with a message instead of calling the tool.
 */
const STYLE_CHANGE_PATTERNS = [
  /more\s+casual/i,
  /more\s+formal/i,
  /more\s+street/i,
  /more\s+elegant/i,
  /more\s+sporty/i,
  /more\s+relaxed/i,
  /more\s+dressy/i,
  /more\s+comfortable/i,
  /less\s+formal/i,
  /less\s+casual/i,
  /lighter\s+colou?r/i,
  /darker\s+colou?r/i,
  /different\s+colou?r/i,
  /change\s+(the\s+)?colou?r/i,
  /brighter/i,
  /make\s+it\s+more/i,
  /switch\s+to/i,
  /can\s+(you\s+)?make\s+it/i,
  /something\s+more/i,
  /try\s+something\s+more/i
];

function isStyleChangeRequest(message) {
  const normalized = message.toLowerCase().trim();
  return STYLE_CHANGE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Extract occasion from conversation history
 * 
 * Looks back through history to find the original occasion
 * (e.g., "Eid outfit", "wedding", "office")
 */
function extractOccasionFromHistory(history) {
  const occasionPatterns = [
    { regex: /\b(eid|eidm|ramadan)\b/i, occasion: 'eid' },
    { regex: /\b(wedding|shaadi|nikah|baraat)\b/i, occasion: 'wedding' },
    { regex: /\b(office|work|formal|business|meeting)\b/i, occasion: 'office' },
    { regex: /\b(casual|everyday|daily)\b/i, occasion: 'casual' },
    { regex: /\b(party|celebration|club|night out)\b/i, occasion: 'party' },
    { regex: /\b(travel|vacation|trip)\b/i, occasion: 'travel' },
    { regex: /\b(date|dinner|romantic)\b/i, occasion: 'date' },
    { regex: /\b(sport|gym|athletic|workout)\b/i, occasion: 'sports' }
  ];

  // Search backwards through history (most recent first)
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const content = typeof msg === 'string' ? msg : (msg.content || '');
    
    for (const { regex, occasion } of occasionPatterns) {
      if (regex.test(content)) {
        return occasion;
      }
    }
  }

  return 'casual'; // default
}

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

  // =========================================================================
  // GREETING CHECK - Prevent unwanted tool calls on pure greetings
  // =========================================================================
  if (isGreetingOnly(userMessage)) {
    console.log('[Orchestrator] Detected greeting-only message, bypassing tool decision');
    
    // For greetings, call LLM without tools to get a simple response
    const systemPrompt = buildSystemPrompt(tenantConfig);
    const messages = buildMessages({
      systemPrompt,
      userMessage,
      conversationHistory
    });

    const greetingResponse = await runLLMPlain({
      messages,
      preferredProvider: null
    });

    return {
      type: 'message',
      provider: greetingResponse.provider,
      model: greetingResponse.model,
      text: greetingResponse.text || "Hey! What are you looking for today? 👋"
    };
  }

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
    // FALLBACK: Check if user is requesting a style change
    // If so, force a recommend_outfit call instead of returning text
    if (isStyleChangeRequest(userMessage)) {
      console.log(`[Orchestrator] Style-change detected but LLM responded with message. Forcing recommend_outfit.`);
      
      // Build fallback tool call
      llmDecision.decision = 'tool';
      llmDecision.tool = {
        name: 'recommend_outfit',
        arguments: {
          occasion: extractOccasionFromHistory(conversationHistory),
          preferences: userMessage // pass the style change as preferences
        }
      };
      // Fall through to tool execution below
    } else {
      return {
        type: 'message',
        provider: llmDecision.provider,
        model: llmDecision.model,
        text: llmDecision.text
      };
    }
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
    systemPrompt = buildGroundedSystemPrompt(tenantConfig, GROUNDED_OUTFIT_RULES);
    userPrompt = buildOutfitPrompt(userMessage, toolResult, tenantConfig);
  } else if (action === 'recommend_products' || action === 'search_products') {
    systemPrompt = buildGroundedSystemPrompt(tenantConfig, GROUNDED_PRODUCTS_RULES);
    userPrompt = buildProductsPrompt(userMessage, toolResult, tenantConfig);
  } else if (action === 'add_to_cart') {
    // For cart actions, generate simple confirmation
    return generateCartConfirmation(params, toolResult);
  } else if (action === 'add_outfit_to_cart') {
    // For outfit cart additions, generate outfit confirmation
    return generateOutfitCartConfirmation(toolResult);
  } else if (action === 'view_cart') {
    // For view cart, generate cart summary
    return generateCartSummary(toolResult);
  } else if (action === 'checkout') {
    // For checkout, generate order confirmation
    return generateCheckoutConfirmation(toolResult);
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
function buildOutfitPrompt(userMessage, toolResult, tenantConfig) {
  const outfit = toolResult.items || toolResult;
  
  let prompt = `User asked: "${userMessage}"\n\n`;
  
  // Add event/occasion instruction
  prompt += `INSTRUCTION: If the user asked about an event or occasion (like eid, wedding, office, party, casual, travel), explicitly tie the outfit to that event and explain how it fits (e.g., color, formality, comfort, style). Still do NOT invent new products.\n\n`;
  
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
  prompt += `Mention the products by their exact names. Explain WHY these pieces work together (color coordination, style, occasion fit). `;
  prompt += `DO NOT recommend any additional items not listed above.`;

  return prompt;
}

/**
 * Build prompt for products explanation
 */
function buildProductsPrompt(userMessage, toolResult, tenantConfig) {
  const products = toolResult.items || toolResult.products || [];
  
  let prompt = `User asked: "${userMessage}"\n\n`;
  prompt += `Here are the products I found. ONLY talk about these exact items:\n\n`;

  const topProducts = products.slice(0, 5); // Limit to top 5 for context
  
  for (const [index, p] of topProducts.entries()) {
    prompt += `${index + 1}. ${p.name}\n`;
    prompt += `   - Price: ₹${p.price}\n`;
    prompt += `   - Category: ${p.category}\n`;
    prompt += `   - Colors: ${(p.colors || []).join(', ')}\n`;
    prompt += `   - Tags: ${(p.tags || []).join(', ')}\n\n`;
  }

  prompt += `Write a short, helpful message (2-3 sentences) introducing these products to the user. `;
  prompt += `Mention 2-3 products by their exact names and briefly explain why they fit the user's request. `;
  prompt += `DO NOT recommend any products not in this list.\n\n`;
  
  // Cross-sell hint
  prompt += `CROSS-SELL HINT: If it makes sense, you may suggest exactly ONE additional complementary item type `;
  prompt += `(like a belt, watch, or socks) conceptually, but do not mention a specific product name unless it is in the list above. `;
  prompt += `Keep the main answer focused on the products listed.`;

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
 * Generate outfit cart confirmation message
 */
function generateOutfitCartConfirmation(toolResult) {
  if (toolResult.success === false) {
    return `I couldn't add the outfit to your cart. ${toolResult.message || 'Please try again.'}`;
  }

  const addedItems = toolResult.addedItems || [];
  const summary = toolResult.summary || {};
  
  if (addedItems.length === 0) {
    return `I couldn't find those items in our catalog. Please try again.`;
  }

  const itemNames = addedItems.map(i => i.name).join(', ');
  const total = summary.totalAmount || 0;

  return `🛒 I've added your complete outfit to the cart: ${itemNames}. Your cart total is now ₹${total}. Ready to checkout?`;
}

/**
 * Generate cart summary message
 */
function generateCartSummary(toolResult) {
  // Handle both cart formats: { cart: { items: [...] } } and { cart: [...] }
  const cartData = toolResult.cart;
  const cartItems = Array.isArray(cartData) ? cartData : (cartData?.items || []);
  
  if (!toolResult.success || cartItems.length === 0) {
    return `Your cart is currently empty. Would you like me to help you find some products?`;
  }

  const summary = toolResult.summary || {};
  const itemCount = summary.totalItems || cartItems.length;
  const total = summary.totalAmount || 0;

  if (itemCount === 1) {
    const item = cartItems[0];
    const itemName = item.name || item.productSnapshot?.name || 'item';
    return `You have ${itemName} (×${item.quantity}) in your cart for ₹${total}. Ready to checkout or want to keep shopping?`;
  }

  const itemNames = cartItems.slice(0, 3).map(i => i.name || i.productSnapshot?.name).join(', ');
  const moreItems = cartItems.length > 3 ? ` and ${cartItems.length - 3} more` : '';
  
  return `You have ${itemCount} items in your cart: ${itemNames}${moreItems}. Total: ₹${total}. Ready to checkout?`;
}

/**
 * Generate checkout confirmation message
 */
function generateCheckoutConfirmation(toolResult) {
  if (!toolResult.success) {
    return `I couldn't complete the checkout. ${toolResult.message || 'Please try again or contact support.'}`;
  }

  const order = toolResult.order || {};
  const orderId = order.orderId || 'N/A';
  const total = order.summary?.totalAmount || order.totalAmount || toolResult.summary?.totalAmount || 0;
  const paymentMethod = order.paymentMethod || 'online';

  return `🎉 Order confirmed! Your order #${orderId} for ₹${total} (${paymentMethod}) has been placed successfully. Thank you for shopping with us!`;
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
 * Build system prompt with tenant persona customization
 */
function buildSystemPrompt(tenantConfig) {
  // Extract persona from tenant config
  const persona = tenantConfig?.persona || {};
  const brandVoice = persona.brandVoice || {};
  const toneRules = Array.isArray(brandVoice.rules) ? brandVoice.rules.join(' ') : '';
  const personaName = persona.name || 'SAAI';
  const personaRole = persona.role || 'AI sales assistant';

  // Build dynamic system content with ALL behavioral rules
  const systemContent = [
    `You are ${personaName}, ${personaRole} for a fashion and lifestyle ecommerce app.`,
    '',
    // Critical behavioral rules first
    GREETING_BEHAVIOR_RULES,
    '',
    TOOL_CALLING_RULES,
    '',
    ANTI_HALLUCINATION_RULES,
    '',
    TOOLS_FIRST_ENFORCEMENT,
    '',
    // Tool definitions
    TOOL_INSTRUCTIONS,
    '',
    // Additional rules
    MULTI_ITEM_PARSING_RULES,
    '',
    CHECKOUT_RULES,
    '',
    TONE_RULES,
    '',
    // UI context
    'CRITICAL: The user already sees your introduction in the app UI.',
    'DO NOT introduce yourself again or explain what you can do.',
    'DO NOT say "How can I help you today?" as your first response to greetings.',
    'Always answer the user\'s latest message directly and concisely.',
    '',
    // Business context
    'Your job is to help users find and buy clothes, shoes, and accessories.',
    'Prioritize:',
    '- Understanding the occasion (eid, wedding, office, casual, travel, party)',
    '- Suggesting complete outfits when appropriate (top, bottom, shoes)',
    '- Explaining briefly WHY items work together (color, style, occasion fit)',
    '- Being concise and sales-focused',
    '',
    // Brand voice customization
    brandVoice.tone ? `Tone: ${brandVoice.tone}.` : '',
    toneRules || ''
  ].filter(Boolean).join('\n');

  return systemContent;
}

/**
 * Build grounded system prompt with persona
 */
function buildGroundedSystemPrompt(tenantConfig, baseRules) {
  const persona = tenantConfig?.persona || {};
  const brandVoice = persona.brandVoice || {};
  const personaName = persona.name || 'SAAI';

  const systemContent = [
    `You are ${personaName}, a shopping assistant. You MUST ONLY talk about the exact products I give you.`,
    brandVoice.tone ? `Your tone should be: ${brandVoice.tone}.` : '',
    '',
    ANTI_HALLUCINATION_RULES,
    '',
    TONE_RULES,
    '',
    baseRules
  ].filter(Boolean).join('\n');

  return systemContent;
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
  buildGroundedSystemPrompt,
  getProviderStatus,
  healthCheck
};
