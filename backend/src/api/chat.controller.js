/**
 * Chat Controller - Two-Stage LLM Pipeline
 * 
 * Handles HTTP chat requests using the new two-stage LLM orchestration:
 * 1. Tool Decision: LLM decides to respond or call a tool
 * 2. Grounded Explanation: If tool called, generate response based on actual results
 * 
 * CRITICAL: Always returns HTTP 200 with { success: true/false }
 * This prevents UI freezes when errors occur.
 */

const { runLLMOrchestrator } = require('../orchestrator/llm');
const { getEffectiveTenant } = require('../utils/tenantLoader');
const { loadActionRegistry } = require('../utils/registryLoader');

/**
 * Handle chat request
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.message - User message (required)
 * @param {string} req.body.tenant - Tenant identifier (required)
 * @param {Array} [req.body.conversationHistory] - Optional conversation history
 * @param {Object} res - Express response object
 */
async function handleChat(req, res) {
  try {
    const { tenant, message, conversationHistory = [] } = req.body;

    // Validate required fields
    if (!tenant) {
      return res.status(200).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required field: tenant',
        type: 'validation_error'
      });
    }

    if (!message) {
      return res.status(200).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required field: message',
        type: 'validation_error'
      });
    }

    console.log(`[Chat] Processing request for tenant: ${tenant}`);
    console.log(`[Chat] Message: "${message}"`);

    // Load tenant configuration with fallback
    const tenantConfig = await getEffectiveTenant(tenant);

    // Load action registry
    let actionRegistry;
    try {
      actionRegistry = await loadActionRegistry(tenantConfig._effectiveId || tenant);
    } catch (regError) {
      console.warn(`[Chat] Failed to load registry, using empty:`, regError.message);
      actionRegistry = { actions: {} };
    }

    // Run the two-stage LLM orchestration
    const result = await runLLMOrchestrator({
      tenantConfig,
      actionRegistry,
      userMessage: message,
      conversationHistory
    });

    console.log(`[Chat] Result type: ${result.type}`);

    // Format response based on result type
    if (result.type === 'message') {
      // Pure conversational response (no tool used)
      return res.status(200).json({
        success: true,
        replyType: 'message',
        llm: {
          decision: 'message',
          provider: result.provider,
          model: result.model,
          text: result.text
        },
        tenantConfig: {
          id: tenantConfig._effectiveId || tenant,
          settings: tenantConfig.settings
        }
      });
    }

    if (result.type === 'tool_result') {
      // Tool was called - include both results and grounded explanation
      return res.status(200).json({
        success: true,
        replyType: 'tool',
        llm: {
          decision: 'tool',
          action: result.action,
          provider: result.provider,
          model: result.model,
          groundedText: result.groundedText
        },
        actionResult: result.toolResult,
        tenantConfig: {
          id: tenantConfig._effectiveId || tenant,
          settings: tenantConfig.settings
        }
      });
    }

    // Unknown result type - should not happen
    return res.status(200).json({
      success: false,
      error: 'Unknown LLM result type',
      type: 'internal_error'
    });

  } catch (error) {
    console.error('[Chat] Error in handleChat:', error);

    // CRITICAL: Always return 200 with success: false to prevent UI freezes
    return res.status(200).json({
      success: false,
      error: error.message || 'An unexpected error occurred',
      type: 'error'
    });
  }
}

module.exports = {
  handleChat
};
