const orchestratorController = require('../orchestrator/controller');
const { TenantNotFoundError, InvalidTenantConfigError } = require('../utils/tenantLoader');
const { RegistryNotFoundError, InvalidRegistryError } = require('../utils/registryLoader');
const { 
  ActionNotFoundError, 
  ActionDisabledError,
  InvalidHandlerError,
  AdapterNotFoundError,
  FunctionNotFoundError
} = require('../orchestrator/tools');

/**
 * Chat Controller (Thin API Layer)
 * 
 * Handles HTTP chat requests and delegates to orchestrator controller.
 * 
 * Architecture (STEP 6):
 * - ✅ Tenant loader: Load tenant-specific configuration
 * - ✅ Action registry: Load tenant-specific action configurations
 * - ✅ Orchestrator: Coordinate action execution (STEP 5)
 * - ✅ LLM Integration: Process messages with mock LLM (STEP 6)
 * - TODO: Memory: Manage conversation history (STEP 7)
 * - TODO: Real LLM: OpenAI/Groq integration (STEP 8)
 * 
 * This controller is now thin - it validates requests and delegates to orchestrator.
 */

/**
 * Handle chat request
 * 
 * This is now a thin controller that:
 * 1. Validates required fields (tenant, message)
 * 2. Delegates to orchestrator controller
 * 3. Handles errors and returns HTTP responses
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.message - User message (required for LLM mode)
 * @param {string} req.body.tenant - Tenant identifier (required)
 * @param {string} [req.body.action] - Optional action to execute (direct mode)
 * @param {Object} [req.body.params] - Optional parameters for action
 * @param {Array} [req.body.conversationHistory] - Optional conversation history
 * @param {Object} res - Express response object
 * 
 * @returns {Object} JSON response
 */
async function handleChat(req, res) {
  try {
    const { tenant, message, action } = req.body;

    // Validate required fields
    if (!tenant) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required field: tenant'
      });
    }

    if (!message && !action) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Either message or action is required'
      });
    }

    // Delegate to orchestrator controller
    // The orchestrator will:
    // - Load tenant config and action registry
    // - Process message with LLM (if message provided)
    // - Execute action directly (if action provided)
    // - Return unified response
    const response = await orchestratorController.handleRequest(req.body);

    res.json(response);

  } catch (error) {
    console.error('Error in handleChat:', error);

    // Handle tenant-specific errors
    if (error instanceof TenantNotFoundError) {
      return res.status(404).json({
        success: false,
        error: 'Tenant Not Found',
        message: error.message,
        tenantId: error.tenantId
      });
    }

    if (error instanceof InvalidTenantConfigError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid Tenant Configuration',
        message: error.message,
        tenantId: error.tenantId
      });
    }

    // Handle registry-specific errors
    if (error instanceof RegistryNotFoundError) {
      return res.status(500).json({
        success: false,
        error: 'Registry Not Found',
        message: error.message,
        tenantId: error.tenantId
      });
    }

    if (error instanceof InvalidRegistryError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid Registry Configuration',
        message: error.message,
        tenantId: error.tenantId
      });
    }

    // Handle orchestrator/action errors
    if (error instanceof ActionNotFoundError) {
      return res.status(404).json({
        success: false,
        error: 'Action Not Found',
        message: error.message,
        action: error.action,
        tenantId: error.tenantId
      });
    }

    if (error instanceof ActionDisabledError) {
      return res.status(403).json({
        success: false,
        error: 'Action Disabled',
        message: error.message,
        action: error.action,
        tenantId: error.tenantId
      });
    }

    if (error instanceof InvalidHandlerError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid Handler',
        message: error.message,
        handler: error.handler,
        action: error.action
      });
    }

    if (error instanceof AdapterNotFoundError) {
      return res.status(500).json({
        success: false,
        error: 'Adapter Not Found',
        message: error.message,
        namespace: error.namespace,
        action: error.action
      });
    }

    if (error instanceof FunctionNotFoundError) {
      return res.status(500).json({
        success: false,
        error: 'Function Not Found',
        message: error.message,
        functionName: error.functionName,
        namespace: error.namespace,
        action: error.action
      });
    }

    // Handle generic errors
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

module.exports = {
  handleChat
};
