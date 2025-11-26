/**
 * Orchestrator Controller - REFACTORED
 * 
 * Coordinates LLM processing and action execution.
 * This is the main entry point for AI-powered chat interactions.
 * 
 * CHANGES:
 * - Uses getEffectiveTenant for tenant fallback
 * - Adapted to new runLLM interface (text-only + internal tool planner)
 * - Enhanced error handling (never crashes)
 */

const { getEffectiveTenant } = require('../utils/tenantLoader');
const registryLoader = require('../utils/registryLoader');
const { runLLM, buildSystemPrompt } = require('./llm');
const { runAction } = require('./tools');

/**
 * Handle LLM-powered chat request
 * 
 * Flow:
 * 1. Load tenant configuration
 * 2. Load action registry
 * 3. Call LLM to process message
 * 4. If LLM decides to use a tool:
 *    - Execute the action via tools orchestrator
 *    - Return action result
 * 5. If LLM decides to respond directly:
 *    - Return LLM's text response
 * 
 * @param {Object} requestBody - Request body from API
 * @param {string} requestBody.tenant - Tenant ID
 * @param {string} requestBody.message - User message
 * @param {Array} requestBody.conversationHistory - Optional conversation history
 * @returns {Promise<Object>} Response object
 */
async function handleLLMChat(requestBody) {
  const { tenant, message, conversationHistory = [] } = requestBody;

  console.log(`[orchestrator] Processing LLM chat for tenant: ${tenant}`);
  console.log(`[orchestrator] Message: "${message}"`);

  // 1. Load tenant configuration with fallback
  const tenantConfig = await getEffectiveTenant(tenant);
  
  // 2. Load action registry (use effective tenant ID)
  let actionRegistry;
  try {
    actionRegistry = await registryLoader.loadActionRegistry(tenantConfig._effectiveId || tenant);
  } catch (error) {
    console.warn(`[orchestrator] Failed to load registry for ${tenant}, using empty registry`);
    actionRegistry = { actions: {} };
  }

  // 3. Build system prompt from tenant config
  const systemPrompt = buildSystemPrompt(tenantConfig);

  // 4. Format conversation messages for LLM
  const messages = [
    ...conversationHistory.map(msg => ({
      role: msg.role || 'user',
      content: msg.content || msg.message || ''
    })),
    { role: 'user', content: message }
  ];

  // 5. Call LLM to process message (text-only, internal tool planning)
  const llmResult = await runLLM({
    messages,
    systemPrompt,
    actionRegistry: actionRegistry.actions || {},
    preferredProvider: tenantConfig.settings?.preferredProvider || null
  });

  console.log(`[orchestrator] LLM result type: ${llmResult.type}`);

  // 6. Handle LLM result
  if (llmResult.type === 'tool') {
    // Internal tool planner detected an action intent
    console.log(`[orchestrator] Executing tool: ${llmResult.action}`);
    
    try {
      const actionResult = await runAction({
        tenantConfig,
        actionRegistry,
        action: llmResult.action,
        params: llmResult.params || {}
      });

      return {
        success: true,
        replyType: 'tool',
        llm: {
          decision: 'tool',
          action: llmResult.action,
          detectedParams: llmResult.params,
          provider: llmResult.provider,
          model: llmResult.model,
          text: llmResult.text
        },
        actionResult,
        tenantConfig: { id: tenantConfig._effectiveId, settings: tenantConfig.settings }
      };
    } catch (actionError) {
      console.error(`[orchestrator] Action execution failed:`, actionError.message);
      // Return the LLM text as fallback when action fails
      return {
        success: true,
        replyType: 'message',
        llm: {
          decision: 'message',
          provider: llmResult.provider,
          model: llmResult.model
        },
        message: llmResult.text || "I tried to help with that but encountered an issue. Could you try rephrasing your request?",
        actionError: actionError.message
      };
    }
  } else {
    // Conversational response (no tool intent detected)
    console.log(`[orchestrator] Returning conversational response`);
    
    return {
      success: true,
      replyType: 'message',
      llm: {
        decision: 'message',
        provider: llmResult.provider,
        model: llmResult.model
      },
      message: llmResult.text
    };
  }
}

/**
 * Handle direct action request (backward compatibility with STEP 5)
 * 
 * This allows direct action execution without LLM processing.
 * Useful for:
 * - Testing
 * - API integrations that know exact action to call
 * - Bypassing LLM when not needed
 * 
 * @param {Object} requestBody - Request body from API
 * @param {string} requestBody.tenant - Tenant ID
 * @param {string} requestBody.action - Action name
 * @param {Object} requestBody.params - Action parameters
 * @returns {Promise<Object>} Response object
 */
async function handleDirectAction(requestBody) {
  const { tenant, action, params } = requestBody;

  console.log(`[orchestrator] Processing direct action for tenant: ${tenant}`);
  console.log(`[orchestrator] Action: ${action}`);

  // Load tenant configuration with fallback
  const tenantConfig = await getEffectiveTenant(tenant);
  
  // Load action registry
  let actionRegistry;
  try {
    actionRegistry = await registryLoader.loadActionRegistry(tenantConfig._effectiveId || tenant);
  } catch (error) {
    console.warn(`[orchestrator] Failed to load registry for ${tenant}:`, error.message);
    actionRegistry = { actions: {} };
  }

  // Execute action directly
  const actionResult = await runAction({
    tenantConfig,
    actionRegistry,
    action,
    params: params || {}
  });

  return {
    success: true,
    replyType: 'direct_action',
    actionResult,
    tenantConfig: { id: tenantConfig._effectiveId, settings: tenantConfig.settings }
  };
}

/**
 * Determine request type and route to appropriate handler
 * 
 * @param {Object} requestBody - Request body from API
 * @returns {Promise<Object>} Response object
 */
async function handleRequest(requestBody) {
  const { tenant, message, action } = requestBody;

  // Validate tenant is provided
  if (!tenant) {
    throw new Error('Tenant ID is required');
  }

  // Route based on request type
  if (action) {
    // Direct action request (STEP 5 compatibility)
    return handleDirectAction(requestBody);
  } else if (message) {
    // LLM-powered chat (STEP 6)
    return handleLLMChat(requestBody);
  } else {
    throw new Error('Either message or action is required');
  }
}

module.exports = {
  handleRequest,
  handleLLMChat,
  handleDirectAction
};
