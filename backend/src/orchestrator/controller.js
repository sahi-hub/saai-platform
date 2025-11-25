/**
 * Orchestrator Controller
 * 
 * Coordinates LLM processing and action execution.
 * This is the main entry point for AI-powered chat interactions.
 */

const tenantLoader = require('../utils/tenantLoader');
const registryLoader = require('../utils/registryLoader');
const { runLLM } = require('./llm');
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

  // 1. Load tenant configuration
  const tenantConfig = await tenantLoader.loadTenantConfig(tenant);
  
  // 2. Load action registry
  const actionRegistry = await registryLoader.loadActionRegistry(tenant);

  // 3. Call LLM to process message and decide what to do
  const llmDecision = await runLLM({
    message,
    tenantConfig,
    actionRegistry: actionRegistry.actions, // Pass the actions object, not the wrapper
    conversationHistory
  });

  console.log(`[orchestrator] LLM decision type: ${llmDecision.type}`);

  // 4. Handle LLM decision
  if (llmDecision.type === 'tool') {
    // LLM wants to execute an action
    console.log(`[orchestrator] Executing tool: ${llmDecision.action}`);
    
    const actionResult = await runAction({
      tenantConfig,
      actionRegistry, // Pass the full registry object (it will access .actions internally)
      action: llmDecision.action,
      params: llmDecision.params || {}
    });

    return {
      success: true,
      replyType: 'tool',
      llm: {
        decision: llmDecision.type,
        action: llmDecision.action,
        reasoning: llmDecision.reasoning,
        detectedParams: llmDecision.params,
        provider: llmDecision.provider,
        _meta: llmDecision._meta
      },
      actionResult,
      tenantConfig,
      actionRegistry
    };
  } else if (llmDecision.type === 'message') {
    // LLM wants to respond with text
    console.log(`[orchestrator] Returning conversational response`);
    
    return {
      success: true,
      replyType: 'message',
      llm: {
        decision: llmDecision.type,
        reasoning: llmDecision.reasoning,
        response: llmDecision.text,
        text: llmDecision.text,
        provider: llmDecision.provider,
        _meta: llmDecision._meta
      },
      message: llmDecision.text,
      tenantConfig,
      actionRegistry
    };
  } else {
    // Unknown decision type
    throw new Error(`Unknown LLM decision type: ${llmDecision.type}`);
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

  // Load tenant configuration
  const tenantConfig = await tenantLoader.loadTenantConfig(tenant);
  
  // Load action registry
  const actionRegistry = await registryLoader.loadActionRegistry(tenant);

  // Execute action directly
  const actionResult = await runAction({
    tenantConfig,
    actionRegistry, // Pass the full registry object
    action,
    params: params || {}
  });

  return {
    success: true,
    replyType: 'direct_action',
    actionResult,
    tenantConfig,
    actionRegistry
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
