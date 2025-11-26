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
 * Chat Controller (Thin API Layer) - REFACTORED
 * 
 * Handles HTTP chat requests and delegates to orchestrator controller.
 * 
 * CRITICAL: This controller ALWAYS returns HTTP 200 with { success: true/false }
 * This prevents UI freezes when errors occur.
 * 
 * Architecture:
 * - ✅ Tenant loader: Load tenant-specific configuration (with fallback)
 * - ✅ Action registry: Load tenant-specific action configurations
 * - ✅ Orchestrator: Coordinate action execution
 * - ✅ LLM Integration: Multi-provider with fallback
 * - ✅ Error handling: Always returns 200, never crashes
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

    // Validate required fields - return 200 with success: false
    if (!tenant) {
      return res.status(200).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required field: tenant',
        type: 'validation_error'
      });
    }

    if (!message && !action) {
      return res.status(200).json({
        success: false,
        error: 'Bad Request',
        message: 'Either message or action is required',
        type: 'validation_error'
      });
    }

    // Delegate to orchestrator controller
    const response = await orchestratorController.handleRequest(req.body);

    // Ensure response has success flag
    if (response.success === undefined) {
      response.success = true;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in handleChat:', error);

    // CRITICAL: Always return 200 with success: false to prevent UI freezes
    // The error type is included for debugging, but HTTP status is always 200
    
    const errorResponse = {
      success: false,
      message: error.message || 'An unexpected error occurred',
      type: 'error'
    };

    // Add specific error details based on error type
    if (error instanceof TenantNotFoundError) {
      errorResponse.type = 'tenant_not_found';
      errorResponse.tenantId = error.tenantId;
    } else if (error instanceof InvalidTenantConfigError) {
      errorResponse.type = 'invalid_tenant_config';
      errorResponse.tenantId = error.tenantId;
    } else if (error instanceof RegistryNotFoundError) {
      errorResponse.type = 'registry_not_found';
      errorResponse.tenantId = error.tenantId;
    } else if (error instanceof InvalidRegistryError) {
      errorResponse.type = 'invalid_registry';
      errorResponse.tenantId = error.tenantId;
    } else if (error instanceof ActionNotFoundError) {
      errorResponse.type = 'action_not_found';
      errorResponse.action = error.action;
      errorResponse.tenantId = error.tenantId;
    } else if (error instanceof ActionDisabledError) {
      errorResponse.type = 'action_disabled';
      errorResponse.action = error.action;
      errorResponse.tenantId = error.tenantId;
    } else if (error instanceof InvalidHandlerError) {
      errorResponse.type = 'invalid_handler';
      errorResponse.handler = error.handler;
      errorResponse.action = error.action;
    } else if (error instanceof AdapterNotFoundError) {
      errorResponse.type = 'adapter_not_found';
      errorResponse.namespace = error.namespace;
      errorResponse.action = error.action;
    } else if (error instanceof FunctionNotFoundError) {
      errorResponse.type = 'function_not_found';
      errorResponse.functionName = error.functionName;
      errorResponse.namespace = error.namespace;
      errorResponse.action = error.action;
    } else {
      errorResponse.type = 'internal_error';
    }

    // Always return 200 - UI handles success: false gracefully
    res.status(200).json(errorResponse);
  }
}

module.exports = {
  handleChat
};
