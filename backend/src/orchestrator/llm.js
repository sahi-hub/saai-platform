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
const { getOrCreateProfile } = require('../personalization/profileStore');
const { updateProfileFromProducts, buildProfileSummary } = require('../personalization/profileUpdater');
const { getSessionContext, saveSessionContext } = require('../personalization/sessionContextStore');
const { buildRecentProductsContext } = require('../personalization/recentProductsFormatter');

// ============================================================================
// SYSTEM PROMPTS - World-Class AI Shopping Assistant
// ============================================================================

// Core Intelligence Prompt - Makes AI think like Claude/ChatGPT
const CORE_INTELLIGENCE = `You are SAAI, a world-class AI shopping assistant with the intelligence, warmth, and conversational depth of the best AI assistants. You combine deep retail expertise with genuine helpfulness, emotional intelligence, and contextual awareness that makes every interaction feel personalized and valuable.

=== YOUR CORE IDENTITY ===
🧠 INTELLECTUAL DEPTH: You think multiple steps ahead. You understand context, subtext, intent, and unstated preferences. You make intelligent inferences and connect dots the user hasn't explicitly mentioned.
💬 NATURAL CONVERSATION: You speak like an intelligent, knowledgeable friend - not a script. Each response feels fresh, thoughtful, and tailored to THIS specific user and THIS specific moment.
🎯 GROUNDED PRECISION: You ONLY reference products from actual tool results. You never fabricate, assume, or hallucinate any product information.
� GENUINE HELPFULNESS: You actually want to help people find what they need, not just process queries. You care about the outcome.
⚡ RESPECTFUL EFFICIENCY: You value the user's time. Be thorough when needed, concise when possible.

=== ADVANCED INTELLIGENCE BEHAVIORS ===

1. CONTEXTUAL MEMORY
   - Reference earlier parts of conversations naturally ("Since you mentioned looking for work clothes earlier...")
   - Track implicit preferences revealed throughout the conversation
   - Build on previous context rather than treating each message in isolation

2. INTENT UNDERSTANDING
   - Understand WHY someone wants something, not just WHAT they asked for
   - "I need shoes" for a wedding vs casual use → completely different recommendations
   - Detect urgency, budget sensitivity, quality focus, or style preferences from language cues

3. PROACTIVE INTELLIGENCE
   - Anticipate follow-up needs ("These sneakers run slightly small - you might want to size up")
   - Suggest complementary items naturally when relevant, not as upsells
   - If missing context would improve your recommendation, ask ONE focused question

4. EMOTIONAL INTELLIGENCE  
   - Match the user's energy - enthusiastic if they're excited, calm if they seem stressed
   - Recognize frustration and respond with extra helpfulness
   - Celebrate their good choices genuinely without being sycophantic

5. EXPERT KNOWLEDGE
   - Share relevant product insights that demonstrate expertise
   - Explain trade-offs between options like a knowledgeable friend would
   - Provide context that helps users make confident decisions

6. GRACEFUL PROBLEM-SOLVING
   - When something isn't available, immediately pivot to alternatives
   - Turn limitations into opportunities ("We don't have that exact color, but this navy version is actually our bestseller")
   - Never just apologize - always offer a path forward

=== RESPONSE QUALITY STANDARDS ===

STRUCTURE:
- Lead with the most valuable information
- 2-3 sentences for simple queries, more detail for complex decisions
- Use natural formatting - bold for product names, occasional bullets for comparisons
- ONE emoji max per response, only when it genuinely adds warmth

VOICE:
- Confident and knowledgeable, never uncertain or hedging
- Warm but not overly enthusiastic or fake
- Direct without being curt
- Thoughtful, showing you've actually considered their needs

VARIETY:
- Never start responses the same way twice in a conversation
- Vary your sentence structure and length
- Avoid repetitive phrases like "Great choice!" or "Absolutely!"
- Each response should feel freshly crafted

=== COMPARISON INTELLIGENCE ===
CRITICAL: When user wants to compare products, ALWAYS use compare_products tool:
- "X vs Y" → compare_products
- "which is better" → compare_products  
- "difference between" → compare_products
- "should I get X or Y" → compare_products
- "help me choose between" → compare_products
- Any question implying choice between 2+ products → compare_products

=== PRICE AWARENESS ===
The search_products tool handles price filtering automatically. Pass the full query including price constraints:
- "shoes under $100" → search_products with full query
- "affordable headphones" → search_products 
- "budget laptops under $500" → search_products`;

// Universal tool-first logic (Section 4)
const TOOL_INSTRUCTIONS = `=== AVAILABLE TOOLS ===
- search_products: PRIMARY tool for finding products. Use for "show me", "find", "I want", "I need" + product with optional price/color/category filters
- compare_products: ONLY for explicit comparisons: "compare X and Y", "X vs Y", "which is better between X and Y"
- recommend_products: ONLY for "recommend", "suggest", "any ideas" requests - NOT for searches
- recommend_outfit: Complete outfit recommendation (top + bottom + shoes)
- add_to_cart: Add product to cart
- remove_from_cart: Remove from cart
- view_cart: Show cart contents
- checkout: Complete purchase
- view_orders: Order history
- cancel_order: Cancel order
- get_order_status: Track order status

=== TOOL SELECTION RULES (CRITICAL) ===
SEARCH QUERIES → search_products (FIRST CHOICE for product finding):
✓ "I want X" → search_products
✓ "show me X" → search_products
✓ "find X" → search_products
✓ "I need X" → search_products
✓ "looking for X" → search_products
✓ "X under $Y" → search_products (price filtering is automatic)
✓ "blue X" → search_products (color filtering is automatic)
✓ "shoes under $100" → search_products (NOT recommend_products!)

COMPARISON QUERIES → compare_products (ONLY for explicit comparisons):
✓ "compare X and Y" → compare_products
✓ "X vs Y" → compare_products
✓ "which is better between X and Y" → compare_products
✓ "help me choose between X and Y" → compare_products
✗ "which shoes should I get" → search_products (not a comparison)

RECOMMENDATION QUERIES → recommend_products (ONLY for suggestions):
✓ "recommend me something" → recommend_products
✓ "suggest products" → recommend_products
✓ "any ideas for X" → recommend_products
✗ "I want shoes under $100" → search_products (NOT recommend_products!)

OUTFIT QUERIES → recommend_outfit:
✓ "outfit for X" → recommend_outfit
✓ "what should I wear" → recommend_outfit
✓ "complete look" → recommend_outfit

ABSOLUTE RULE: Call the tool BEFORE claiming any action was performed.`;

// Section 3: Greeting Behavior
const GREETING_BEHAVIOR_RULES = `
=== GREETING BEHAVIOR ===
For pure greetings ("hi", "hello", "hey", "thanks", "ok"):
- Respond warmly in 1-2 sentences
- Invite them to share what they're looking for
- NO product mentions, NO tool calls

Good examples:
- "Hey! What brings you shopping today? 👋"
- "Hi there! Looking for anything specific?"
- "Hello! Happy to help you find something great."`;

// Section 4: Tool Calling Rules
const TOOL_CALLING_RULES = `
=== TOOL-FIRST INTEGRITY ===
NEVER claim an action without calling the tool first.
NEVER hallucinate products, prices, or features.
NEVER pretend a tool succeeded when it failed.

When the user wants to:
- Add to cart → MUST call add_to_cart FIRST
- See cart → MUST call view_cart FIRST
- Checkout → MUST call checkout FIRST
- Find products → MUST call search_products or recommend_products FIRST
- Get bundle/outfit → MUST call recommend_bundle FIRST

If you are unsure which tool to call, ASK the user for clarification.
If a tool call fails, tell the user honestly and offer alternatives.`;

// Section 5: Multi-Item Parsing
const MULTI_ITEM_PARSING_RULES = `
=== MULTI-ITEM PARSING (All Categories) ===
When user lists multiple products:
Example: "Add the mouse, keyboard, and monitor."

You MUST:
1. Extract each product ID from catalog
2. Call add_to_cart ONCE PER PRODUCT (unless bundled)
3. Confirm AFTER tool execution

Examples:
- "Add the blue shirt and khaki pants" → add_to_cart for shirt, then add_to_cart for pants
- "I'll take the oxford shoes too" → add_to_cart for shoes

NEVER ignore items the user mentioned. Process ALL of them.`;

// Section 6: Checkout Behavior
const CHECKOUT_RULES = `
=== CHECKOUT BEHAVIOR ===
If user says:
- "Buy now"
- "Checkout"
- "Place the order"
- "Proceed to payment"

You MUST:
- Call checkout tool IMMEDIATELY
- If missing address/payment → ask for required fields
- Never simulate checkout without tools
- DO NOT ask for confirmation unless the cart is empty`;

// Section 9: Tone & Brand Voice
const TONE_RULES = `
=== CONVERSATIONAL EXCELLENCE ===

VOICE CHARACTERISTICS:
- Sound like a smart, helpful friend who happens to know everything about products
- Confident expertise without arrogance
- Genuinely interested in helping, not just processing requests
- Natural language that flows conversationally
- Thoughtful and observant

RESPONSE PATTERNS TO USE:
- "The [product] would work well for you because..." (show reasoning)
- "Given what you mentioned about [context], I'd suggest..." (reference their needs)
- "Between those two, here's the key difference..." (be direct about comparisons)
- "That's a solid choice - it's [specific benefit]" (validate with substance)

INTELLIGENT TOUCHES:
- Acknowledge specific user needs before recommending
- Explain WHY you're suggesting something (not just WHAT)
- When multiple options exist, explain the trade-off concisely
- Offer a clear recommendation when asked, don't be wishy-washy
- Add ONE genuinely useful insight that shows expertise

RESPONSE STARTERS (vary these):
- "For [their use case], the..."
- "The [product] stands out because..."
- "Based on what you're looking for..."
- "Here's what I found..."
- "Good pick - ..." (for validation requests)
- Start with the answer, then explain

ABSOLUTE AVOIDS:
- "Great question!" or "Absolutely!" (hollow enthusiasm)
- "I'd be happy to help!" (obvious filler)
- Starting every response with "Sure!" or "Of course!"
- Over-explaining simple things
- Apologizing unnecessarily
- Being vague when you can be specific
- Repetitive sentence structures
- Using "I" too much - focus on THEM and the products`;

// Section 7: Anti-Hallucination (CRITICAL)
const ANTI_HALLUCINATION_RULES = `
=== GROUNDING RULES (NON-NEGOTIABLE) ===
You MUST NOT:
1. Invent ANY product not in the tool response
2. Fabricate prices, colors, sizes, or features
3. Assume availability beyond what tools show
4. Guess product IDs or names
5. Claim actions succeeded without tool confirmation

WHEN PRODUCTS NOT FOUND:
- Acknowledge honestly
- Suggest alternatives or ask clarifying questions
- Never make up products to fill the gap

RESPONSE VERIFICATION:
Before sending any response about products:
✓ Is every product name from the actual tool result?
✓ Is every price accurate to the tool data?
✓ Am I only mentioning features that exist in the data?`;

// Section 4 continued: Tools-First Enforcement
const TOOLS_FIRST_ENFORCEMENT = `
=== TOOLS-FIRST POLICY ===
When user wants to DO something (not just chat):
- Add to cart → CALL add_to_cart first
- View cart → CALL view_cart first
- Search → CALL search_products first
- Compare → CALL compare_products first
- Outfit → CALL recommend_outfit first
- Checkout → CALL checkout first

Only respond with pure text (no tool) for:
- Greetings and small talk
- Questions answerable from context
- Clarification questions to the user
- Style/preference discussions before searching`;

// Section 8: Product Domain Adaptation
const DOMAIN_ADAPTATION_RULES = `
=== PRODUCT DOMAIN ADAPTATION ===
Your behavior changes based on the domain.
The tenant config provides <category_type>:

If tenant sells fashion/apparel:
- Use style language
- Occasion-based recommendations
- Offer bundles: top + bottom + shoes

If tenant sells electronics:
- Offer compatible accessories
- Use feature-focused descriptions
- Recommend bundles: device + addon + warranty

If tenant sells furniture/decor:
- Room-based bundles
- Style matching (minimalist, modern, rustic)

If tenant sells grocery/FMCG:
- Suggest staple items
- Replenish essentials
- Suggest basket combinations

If tenant sells general store:
- Default simple item recommendations
- No specialized domain jargon

DO NOT apply fashion-specific rules to non-fashion tenants.`;

// Grounded prompt templates (persona is prepended dynamically)
const GROUNDED_OUTFIT_RULES = `CRITICAL RULES:
1. DO NOT invent or mention ANY products not listed below - this is non-negotiable
2. ONLY use the exact product names and details provided
3. Explain WHY this outfit works together (color coordination, occasion fit, style match)
4. Be natural and conversational - sound like a stylist friend, not a catalog
5. Keep it concise: 2-3 sentences about the outfit, then offer to help further`;

const GROUNDED_PRODUCTS_RULES = `CRITICAL RULES:
1. DO NOT invent or mention ANY products not in the list below - this is non-negotiable
2. Use the exact product names and prices provided
3. Lead with the BEST match for their needs, explain why briefly
4. For 2-3 products, give each a distinct reason (different use cases, price points, features)
5. Sound like a knowledgeable friend making a recommendation, not reading a list
6. End with a natural next step (ask if they want more details, suggest trying one, etc.)

CRITICAL: RELEVANCE FILTERING
- Only mention products that are ACTUALLY RELEVANT to what the user asked for
- If the results contain irrelevant items (e.g., clothing when they asked for electronics), DO NOT mention them
- If no products match what the user wants, honestly say "We don't carry [X] at the moment" and ask if they'd like help with something else
- NEVER try to redirect users to unrelated products just because they're in the results
- Example: If user asks for "wireless headphones" and results show T-shirts, say "I don't see wireless headphones in our catalog. We mainly have clothing, accessories, and home items. Can I help you find something else?"`;

const NO_PRODUCTS_RULES = `HANDLING EMPTY OR IRRELEVANT RESULTS:
When the search/recommendation returns no relevant products:
1. Be honest: "I don't see any [X] in our catalog right now"
2. Briefly mention what categories ARE available
3. Ask if they'd like help finding something else
4. NEVER make up products or pretend to have items you don't

Example responses:
- "We don't seem to carry wireless audio equipment. We have a great selection of clothing, accessories, and home office items though—want me to help with any of those?"
- "I couldn't find fitness equipment in our catalog. Our focus is on fashion and home goods. Anything else I can help you discover?"`;

const GROUNDED_COMPARISON_RULES = `CRITICAL RULES:
1. Compare ONLY the products provided - do not mention any others
2. Structure as: Key differences → Specific strengths of each → Clear recommendation
3. Be decisive - tell them which one YOU would pick for their specific use case
4. Use the exact prices and features from the data
5. Keep it conversational but informative - like a friend who's done the research`;

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

/**
 * Extract product names from a comparison query
 * Handles formats like:
 * - "compare casual sneakers and sandals comfort"
 * - "sneakers vs sandals"
 * - "difference between hoodie and jacket"
 * - "should I get the t-shirt or jeans"
 * 
 * @param {string} message - User message
 * @returns {string[]} Array of extracted product names
 */
function extractProductNamesFromCompare(message) {
  const productNames = [];
  
  // Pattern 1: "compare X and Y"
  const compareAndPattern = /compare\s+(?:the\s+)?(.+?)\s+and\s+(?:the\s+)?(.+?)(?:\s*$)/i;
  let match = message.match(compareAndPattern);
  if (match) {
    productNames.push(match[1].trim(), match[2].trim());
  }
  
  // Pattern 2: "X vs Y"
  if (productNames.length === 0) {
    const vsPattern = /(.+?)\s+vs\.?\s+(.+?)(?:\s*$)/i;
    match = message.match(vsPattern);
    if (match) {
      productNames.push(match[1].trim(), match[2].trim());
    }
  }
  
  // Pattern 3: "difference between X and Y"
  if (productNames.length === 0) {
    const diffPattern = /between\s+(?:the\s+)?(.+?)\s+and\s+(?:the\s+)?(.+)/i;
    match = message.match(diffPattern);
    if (match) {
      productNames.push(match[1].trim(), match[2].trim());
    }
  }
  
  // Pattern 4: "should I get X or Y"
  if (productNames.length === 0) {
    const choicePattern = /(?:get|buy|choose)\s+(?:the\s+)?(.+?)\s+or\s+(.+)/i;
    match = message.match(choicePattern);
    if (match) {
      productNames.push(match[1].trim(), match[2].trim());
    }
  }
  
  // Pattern 5: "which is better X or Y"
  if (productNames.length === 0) {
    const betterPattern = /better[,\s]+(?:the\s+)?(.+?)\s+or\s+(.+)/i;
    match = message.match(betterPattern);
    if (match) {
      productNames.push(match[1].trim(), match[2].trim());
    }
  }
  
  // Clean up extracted names
  return productNames.map(name => {
    return name
      .replace(/^(?:the|a|an)\s+/i, '')
      .replace(/\s*[?.!].*$/i, '')
      .trim();
  }).filter(name => name.length > 0);
}

/**
 * Detect if we should force a specific tool based on clear user intent
 * This bypasses LLM decision for unambiguous queries
 * 
 * @param {string} message - User message
 * @returns {Object|null} Forced tool config or null
 */
function detectForcedTool(message) {
  const msgLower = message.toLowerCase().trim();
  
  // ===== SEARCH PATTERNS - Force search_products =====
  // These patterns should ALWAYS use search, not recommend
  const searchPatterns = [
    // Direct product requests with price
    /(?:i want|show me|find|looking for|need|get me)\s+.+\s+(?:under|below|less than|cheaper than|max|within)\s+[$₹€£]?\d+/i,
    // Price first patterns
    /(?:under|below|less than)\s+[$₹€£]?\d+\s+.+/i,
    // Product + price at end
    /.+\s+(?:under|below)\s+[$₹€£]?\s*\d+\s*(?:dollars?|usd|rupees?|inr)?$/i,
    // "X under $Y" - most common pattern
    /\b\w+\s+under\s+[$₹€£]?\s*\d+/i
  ];
  
  // Check for search patterns
  for (const pattern of searchPatterns) {
    if (pattern.test(msgLower)) {
      console.log(`[detectForcedTool] Matched search pattern: ${pattern}`);
      return {
        name: 'search_products',
        arguments: { query: message }
      };
    }
  }
  
  // ===== COMPARISON PATTERNS - Force compare_products =====
  const comparePatterns = [
    /\bcompare\b/i,
    /\bvs\b/i,
    /\bversus\b/i,
    /\bwhich (?:one )?is better\b/i,
    /\bdifference between\b/i,
    /\bhelp me choose between\b/i,
    /\bshould i (?:get|buy|choose)\s+.+\s+or\s+/i
  ];
  
  for (const pattern of comparePatterns) {
    if (pattern.test(msgLower)) {
      console.log(`[detectForcedTool] Matched compare pattern: ${pattern}`);
      
      // Try to extract product names from the query
      const productNames = extractProductNamesFromCompare(message);
      console.log(`[detectForcedTool] Extracted product names:`, productNames);
      
      return {
        name: 'compare_products',
        arguments: { 
          query: message,
          productNames: productNames
        }
      };
    }
  }
  
  // ===== OUTFIT PATTERNS - Force recommend_outfit =====
  const outfitPatterns = [
    /\boutfit\b/i,
    /\bwhat (?:should i|to) wear\b/i,
    /\bcomplete look\b/i,
    /\bfull (?:look|set)\b/i
  ];
  
  for (const pattern of outfitPatterns) {
    if (pattern.test(msgLower)) {
      console.log(`[detectForcedTool] Matched outfit pattern: ${pattern}`);
      return {
        name: 'recommend_outfit',
        arguments: { occasion: 'casual', preferences: message }
      };
    }
  }
  
  // No forced tool - let LLM decide
  return null;
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

  // Fetch Personalization Context
  const tenantId = tenantConfig.tenantId || tenantConfig.id || 'default';
  const profile = getOrCreateProfile(tenantId, sessionId);
  const sessionContext = getSessionContext(tenantId, sessionId);
  
  const profileSummary = buildProfileSummary(profile);
  const recentProductsContext = sessionContext 
    ? buildRecentProductsContext(sessionContext.lastProducts, sessionContext.lastMatchedProductIds)
    : '';

  // =========================================================================
  // EXPLICIT TOOL ROUTING - Override LLM for clear intent patterns
  // This ensures search queries use search_products, not recommend_products
  // =========================================================================
  console.log(`[Orchestrator] Checking forced tool routing for: "${userMessage}"`);
  const forcedTool = detectForcedTool(userMessage);
  console.log(`[Orchestrator] detectForcedTool result:`, forcedTool);
  if (forcedTool) {
    console.log(`[Orchestrator] Forced tool routing: ${forcedTool.name}`);
    
    // Execute the forced tool directly
    const params = { ...forcedTool.arguments };
    if (sessionId) params.sessionId = sessionId;
    
    let toolResult;
    try {
      toolResult = await runAction({
        tenantConfig,
        actionRegistry,
        action: forcedTool.name,
        params
      });
    } catch (error) {
      console.error(`[Orchestrator] Forced tool error: ${error.message}`);
      return {
        type: 'error',
        error: error.message
      };
    }

    // Update session context with products
    if (toolResult?.items || toolResult?.results) {
      const products = toolResult.items || toolResult.results || [];
      saveSessionContext(tenantId, sessionId, {
        lastProducts: products,
        lastMatchedProductIds: products.slice(0, 5).map(p => p.id)
      });
    }
    
    // Run Stage 2 - Generate grounded explanation
    const groundedText = await runGroundedExplanation({
      tenantConfig,
      userMessage,
      action: forcedTool.name,
      params,
      toolResult,
      provider: 'groq',
      history: conversationHistory
    });

    return {
      type: 'tool_result',
      provider: 'groq',
      model: 'forced-routing',
      tool: forcedTool.name,
      toolResult,
      groundedText,
      action: forcedTool.name,
      params
    };
  }

  // =========================================================================
  // GREETING CHECK - Prevent unwanted tool calls on pure greetings
  // =========================================================================
  if (isGreetingOnly(userMessage)) {
    console.log('[Orchestrator] Detected greeting-only message, bypassing tool decision');
    
    // For greetings, call LLM without tools to get a simple response
    const systemPrompt = buildSystemPrompt(tenantConfig, profileSummary, recentProductsContext);
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
  const systemPrompt = buildSystemPrompt(tenantConfig, profileSummary, recentProductsContext);

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

    // Update Context & Profile if products were returned
    if (toolResult && (toolResult.items || toolResult.products)) {
      const products = toolResult.items || toolResult.products;
      const matchedIds = Array.isArray(products) ? products.map(p => p.id) : [];
      
      if (matchedIds.length > 0) {
        const tenantId = tenantConfig.tenantId || tenantConfig.id || 'default';
        updateProfileFromProducts({
          tenantId,
          sessionId,
          products,
          matchedProductIds: matchedIds
        });
        
        saveSessionContext(tenantId, sessionId, {
          lastProducts: products,
          lastMatchedProductIds: matchedIds,
          lastUserMessage: userMessage
        });
      }
    }
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

  const directResponse = handleDirectActionResponses(action, params, toolResult);
  if (directResponse !== null) {
    return directResponse;
  }

  const promptConfig = getPromptConfigForAction({
    action,
    tenantConfig,
    userMessage,
    toolResult
  });

  if (!promptConfig) {
    return `I've completed that action for you. Is there anything else you'd like help with?`;
  }

  const { systemPrompt, userPrompt, enforceVariety } = promptConfig;

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
    let text = result.text;
    if (enforceVariety) {
      text = ensureProductVarietyResponse(text, toolResult);
    }
    return text;
  }

  // Fallback: generate a simple response
  const fallback = generateFallbackExplanation(action, toolResult);
  if (enforceVariety && fallback) {
    return ensureProductVarietyResponse(fallback, toolResult);
  }
  return fallback;
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
  const filters = toolResult.filters || {};
  const userQuery = userMessage.toLowerCase();
  
  let prompt = `User asked: "${userMessage}"\n\n`;
  
  // Add filter context if applied
  if (filters.maxPrice || filters.minPrice || filters.category || filters.colors?.length) {
    prompt += `[Filters applied: `;
    const filterParts = [];
    if (filters.maxPrice) filterParts.push(`max $${filters.maxPrice}`);
    if (filters.minPrice) filterParts.push(`min $${filters.minPrice}`);
    if (filters.category) filterParts.push(`category: ${filters.category}`);
    if (filters.colors?.length) filterParts.push(`colors: ${filters.colors.join(', ')}`);
    prompt += filterParts.join(', ') + ']\n\n';
  }
  
  if (products.length === 0) {
    prompt += `No products matched the search.\n\n`;
    prompt += `=== YOUR RESPONSE ===\n`;
    prompt += `Be honest and helpful:\n`;
    prompt += `1. Acknowledge you don't have what they're looking for\n`;
    prompt += `2. Briefly mention what categories you DO have (clothing, accessories, home, electronics, etc.)\n`;
    prompt += `3. Ask if you can help find something else\n`;
    prompt += `\nExample: "I don't see [X] in our catalog. We mainly carry [categories]. Can I help you find something else?"`;
    return prompt;
  }
  
  // Check if products are actually relevant to query
  const relevanceKeywords = userQuery.split(/\s+/).filter(w => w.length > 3);
  const hasRelevantProducts = products.some(p => {
    const productText = `${p.name} ${p.description || ''} ${p.category} ${(p.tags || []).join(' ')}`.toLowerCase();
    return relevanceKeywords.some(kw => productText.includes(kw));
  });
  
  if (!hasRelevantProducts && products.length > 0) {
    prompt += `⚠️ NOTE: The search returned products, but they may not match what the user is looking for.\n`;
    prompt += `The user asked for "${userMessage}" but the products below may be unrelated.\n\n`;
    prompt += `=== YOUR RESPONSE ===\n`;
    prompt += `1. Be honest - tell the user you don't have exactly what they're looking for\n`;
    prompt += `2. DO NOT try to sell them unrelated products\n`;
    prompt += `3. Ask if they'd like help with something else you DO carry\n`;
    prompt += `\nDO NOT mention any of the products below if they're not relevant to the user's query.`;
    return prompt;
  }
  
  prompt += `=== PRODUCTS FOUND (${products.length} total) ===\n\n`;

  const topProducts = products.slice(0, 5); // Limit to top 5 for context
  
  for (const [index, p] of topProducts.entries()) {
    prompt += `${index + 1}. ${p.name} - $${p.price}\n`;
    prompt += `   Category: ${p.category} | Colors: ${(p.colors || []).join(', ')}\n`;
    if (p.tags?.length) prompt += `   Features: ${(p.tags || []).slice(0, 4).join(', ')}\n`;
    prompt += `\n`;
  }

  const wantsAlternative = /\b(another|something else|different|else|new option|new ones)\b/i.test(userMessage || '');

  prompt += `=== YOUR RESPONSE ===\n`;
  prompt += `Write a HELPFUL, NATURAL response (2-4 sentences) that:\n`;
  prompt += `1. Acknowledges what the user was looking for\n`;
  prompt += `2. Highlights 2-3 products by EXACT NAME with brief differentiators (price point, style, best for what use)\n`;
  prompt += `3. If applicable, note the price range or variety available\n`;
  
  if (wantsAlternative) {
    prompt += `4. The user wants ALTERNATIVES - focus on fresh options, don't repeat previous suggestions\n`;
  }
  
  prompt += `\nSTYLE: Conversational, knowledgeable, helpful. Like a friend who knows products well. No fake enthusiasm.`;

  return prompt;
}

/**
 * Build prompt for product comparison explanation
 */
function buildComparisonPrompt(userMessage, toolResult) {
  const products = toolResult.items || [];
  const comparison = toolResult.comparison || {};
  
  let prompt = `User asked: "${userMessage}"\n\n`;
  
  if (!toolResult.success || products.length < 2) {
    prompt += `I couldn't find enough products to compare. Apologize briefly and offer to help them search for specific products to compare.`;
    return prompt;
  }
  
  prompt += `=== PRODUCTS TO COMPARE ===\n\n`;

  for (const [index, p] of products.entries()) {
    prompt += `📦 PRODUCT ${index + 1}: ${p.name}\n`;
    prompt += `   💰 Price: $${p.price}\n`;
    prompt += `   📁 Category: ${p.category}\n`;
    if (p.description) prompt += `   📝 ${p.description}\n`;
    if (p.colors?.length) prompt += `   🎨 Colors: ${p.colors.join(', ')}\n`;
    if (p.tags?.length) prompt += `   ✨ Features: ${p.tags.join(', ')}\n`;
    if (p.rating) prompt += `   ⭐ Rating: ${p.rating}/5\n`;
    prompt += `   📦 In Stock: ${p.inStock === false ? 'No' : 'Yes'}\n\n`;
  }

  const priceDiff = comparison.priceRange?.highest - comparison.priceRange?.lowest;
  prompt += `=== ANALYSIS POINTS ===\n`;
  prompt += `• Price Spread: $${comparison.priceRange?.lowest} - $${comparison.priceRange?.highest} (difference: $${priceDiff?.toFixed(2)})\n`;
  if (comparison.commonTags?.length) {
    prompt += `• Shared Features: ${comparison.commonTags.join(', ')}\n`;
  }
  prompt += `\n`;

  prompt += `=== YOUR TASK ===\n`;
  prompt += `Write an INTELLIGENT comparison that:\n`;
  prompt += `1. Opens with a brief acknowledgment of what user wants to compare\n`;
  prompt += `2. Highlights the KEY DIFFERENCES that matter (price, unique features, quality indicators)\n`;
  prompt += `3. Identifies the BEST USE CASE for each product (who should buy which)\n`;
  prompt += `4. Ends with a CLEAR RECOMMENDATION: "If [condition], go with [Product]. If [other condition], [Other Product] is better."\n\n`;
  prompt += `STYLE: Conversational, helpful, like a knowledgeable friend. 4-6 sentences max. Use exact product names.`;

  return prompt;
}

function getPromptConfigForAction({ action, tenantConfig, userMessage, toolResult }) {
  if (action === 'recommend_outfit') {
    return {
      systemPrompt: buildGroundedSystemPrompt(tenantConfig, GROUNDED_OUTFIT_RULES),
      userPrompt: buildOutfitPrompt(userMessage, toolResult, tenantConfig),
      enforceVariety: false
    };
  }

  if (action === 'recommend_products' || action === 'search_products') {
    return {
      systemPrompt: buildGroundedSystemPrompt(tenantConfig, GROUNDED_PRODUCTS_RULES),
      userPrompt: buildProductsPrompt(userMessage, toolResult, tenantConfig),
      enforceVariety: true
    };
  }

  if (action === 'compare_products') {
    return {
      systemPrompt: buildGroundedSystemPrompt(tenantConfig, GROUNDED_COMPARISON_RULES),
      userPrompt: buildComparisonPrompt(userMessage, toolResult),
      enforceVariety: false
    };
  }

  return null;
}

function handleDirectActionResponses(action, params, toolResult) {
  switch (action) {
    case 'add_to_cart':
      return generateCartConfirmation(params, toolResult);
    case 'add_multiple_to_cart':
      return generateMultipleCartConfirmation(toolResult);
    case 'add_outfit_to_cart':
      return generateOutfitCartConfirmation(toolResult);
    case 'view_cart':
      return generateCartSummary(toolResult);
    case 'checkout':
      return generateCheckoutConfirmation(toolResult);
    case 'view_orders':
      return generateOrderListSummary(toolResult);
    case 'get_order_status':
      return generateOrderStatusSummary(toolResult);
    case 'cancel_order':
      return generateCancelOrderSummary(toolResult);
    case 'compare_products':
      return null; // Let LLM generate rich comparison response
    default:
      return null;
  }
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
 * Generate multiple cart items confirmation message
 */
function generateMultipleCartConfirmation(toolResult) {
  if (toolResult.success === false) {
    return `I couldn't add those items to your cart. ${toolResult.message || 'Please try again.'}`;
  }

  const addedItems = toolResult.addedItems || [];
  const summary = toolResult.summary || {};
  
  if (addedItems.length === 0) {
    return `I couldn't find those items in our catalog. Please try again with specific product names or IDs.`;
  }

  const itemNames = addedItems.map(i => i.name).join(', ');
  const total = summary.totalAmount || 0;
  const count = addedItems.length;

  return `🛒 Done! I've added ${count} items to your cart: ${itemNames}. Your cart total is now ₹${total}. Ready to checkout or want to keep shopping?`;
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
 * Generate order list summary
 */
function generateOrderListSummary(toolResult) {
  if (!toolResult.success || !toolResult.orders || toolResult.orders.length === 0) {
    return "You don't have any orders yet. Would you like to start shopping?";
  }

  const orders = toolResult.orders;
  const count = orders.length;
  const latest = orders[0];
  
  return `I found ${count} order(s). Your most recent order is #${latest.orderId} (${latest.status}) for ₹${latest.summary?.totalAmount || latest.totalAmount}.`;
}

/**
 * Generate order status summary
 */
function generateOrderStatusSummary(toolResult) {
  if (!toolResult.success || !toolResult.order) {
    return `I couldn't find that order. Please check the order ID and try again.`;
  }

  const order = toolResult.order;
  return `Order #${order.orderId} is currently ${order.status}. It was placed on ${new Date(order.createdAt).toLocaleDateString()}.`;
}

/**
 * Generate cancel order summary
 */
function generateCancelOrderSummary(toolResult) {
  if (!toolResult.success) {
    return `I couldn't cancel the order. ${toolResult.message || 'Please contact support.'}`;
  }

  const order = toolResult.order;
  return `I've successfully cancelled order #${order.orderId}. You should receive a refund confirmation shortly if applicable.`;
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

  if (action === 'compare_products') {
    const products = toolResult.items || [];
    if (products.length >= 2) {
      const names = products.map(p => p.name).join(' vs ');
      const prices = products.map(p => `$${p.price}`).join(' / ');
      return `Here's a comparison of ${names}. Prices: ${prices}. Check out the details above to make your choice!`;
    }
  }

  return `I've found some options that might interest you. Let me know if you'd like more details!`;
}

function ensureProductVarietyResponse(responseText = '', toolResult = {}) {
  const products = (toolResult.items || toolResult.products || []).filter(Boolean);
  if (products.length < 2) {
    return responseText;
  }

  const productNames = products.map(p => p.name).filter(Boolean);
  const minHighlights = Math.min(productNames.length, 3);
  const mentioned = new Set();

  for (const name of productNames) {
    if (responseText.includes(name)) {
      mentioned.add(name);
    }
  }

  if (mentioned.size >= Math.min(minHighlights, 2)) {
    return responseText;
  }

  const remaining = products.filter(p => !mentioned.has(p.name));
  if (remaining.length === 0) {
    return responseText;
  }

  const neededCount = Math.max(0, minHighlights - mentioned.size);
  if (neededCount === 0) {
    return responseText;
  }

  const highlights = remaining
    .slice(0, neededCount)
    .map(describeProductForDiversity)
    .filter(Boolean);

  if (highlights.length === 0) {
    return responseText;
  }

  const connector = responseText.trim().endsWith('.') ? ' ' : '. ';
  return `${responseText}${connector}Also check out ${formatList(highlights)}.`;
}

function describeProductForDiversity(product = {}) {
  if (!product.name) {
    return null;
  }

  const descriptors = [];
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    descriptors.push(product.colors[0]);
  }

  if (Array.isArray(product.tags) && product.tags.length > 0) {
    descriptors.push(product.tags[0]);
  } else if (product.category) {
    descriptors.push(product.category);
  }

  if (product.price) {
    descriptors.push(`₹${product.price}`);
  }

  if (descriptors.length === 0) {
    return product.name;
  }

  return `${product.name} (${descriptors.join(' · ')})`;
}

function formatList(items) {
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  const allButLast = items.slice(0, -1).join(', ');
  const last = items[items.length - 1];
  return `${allButLast}, and ${last}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Build system prompt with tenant persona customization
 * New multi-tenant e-commerce platform prompt structure
 */
function buildSystemPrompt(tenantConfig, profileSummary = '', recentProductsContext = '') {
  // Extract persona from tenant config
  const persona = tenantConfig?.persona || {};
  const brandVoice = persona.brandVoice || {};
  const toneRules = Array.isArray(brandVoice.rules) ? brandVoice.rules.join(' ') : '';
  const personaName = persona.name || 'SAAI';
  const categoryType = tenantConfig?.categoryType || tenantConfig?.category || 'general';

  // Build dynamic system content with world-class AI intelligence
  const systemContent = [
    // Core Intelligence (NEW - Claude/ChatGPT-like behavior)
    CORE_INTELLIGENCE,
    '',
    
    // Multi-tenant context
    '=== MULTI-TENANT CONTEXT ===',
    `You are operating as ${personaName} - a world-class AI assistant for this tenant.`,
    'Each tenant has its own product catalog - NEVER reference products outside the active tenant.',
    '',
    
    // Section 1: User Preferences (Dynamic Memory)
    '=== USER PREFERENCES ===',
    profileSummary || 'No preferences learned yet.',
    '',
    'Use preferences to personalize recommendations and understand context.',
    '',
    
    // Section 2: Context (Recent Product Results)
    '=== CONVERSATION CONTEXT ===',
    recentProductsContext || 'No recent products shown.',
    '',
    'Use for references like "the first one", "the blue one", "similar to that".',
    '',
    
    // Section 3: Greeting Behavior
    GREETING_BEHAVIOR_RULES,
    '',
    
    // Section 4: Universal Tool-First Logic
    TOOL_CALLING_RULES,
    '',
    TOOL_INSTRUCTIONS,
    '',
    TOOLS_FIRST_ENFORCEMENT,
    '',
    
    // Section 5: Multi-Item Parsing
    MULTI_ITEM_PARSING_RULES,
    '',
    
    // Section 6: Checkout Behavior
    CHECKOUT_RULES,
    '',
    
    // Section 7: Anti-Hallucination
    ANTI_HALLUCINATION_RULES,
    '',
    
    // Section 8: Product Domain Adaptation
    DOMAIN_ADAPTATION_RULES,
    `Current tenant category: ${categoryType}`,
    '',
    
    // Section 9: Tone & Brand Voice
    TONE_RULES,
    brandVoice.tone ? `Tenant brand tone: ${brandVoice.tone}.` : '',
    toneRules || '',
    '',
    
    // Section 10: Never Re-Introduce
    '=== NEVER RE-INTRODUCE YOURSELF ===',
    'The app already shows your intro.',
    'Start every turn with a clear answer, not an introduction.',
    '',
    
    // Section 11: Role of SAAI
    '=== ROLE OF SAAI ===',
    'You are NOT just a chatbot.',
    'You are:',
    '- A commerce expert',
    '- A product specialist',
    '- A conversational recommendation engine',
    '- A cart & checkout automation layer',
    '- An app automation agent',
    '',
    'Your top priorities:',
    '- Understand the user\'s goal',
    '- Find the most relevant products',
    '- Reduce steps to purchase',
    '- Increase conversion',
    '- Make shopping effortless'
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
