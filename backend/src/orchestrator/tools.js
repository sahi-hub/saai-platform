/**
 * Tools Orchestrator
 * 
 * Dispatches action requests to appropriate adapters.
 * This is the central coordinator that:
 * 1. Validates actions against the registry
 * 2. Resolves the correct adapter (tenant-specific or generic)
 * 3. Executes the action
 * 4. Returns the result
 * 
 * Architecture:
 * - Actions are defined in the registry (e.g., example.registry.json)
 * - Handler strings map to adapter functions (e.g., "commerce.search")
 * - Tenant-specific adapters override generic ones
 */

const path = require('path');
const fs = require('fs').promises;
const { logToolExecution } = require('../utils/logger');

/**
 * Custom error for action not found in registry
 */
class ActionNotFoundError extends Error {
  constructor(action, tenantId) {
    super(`Action '${action}' not found in registry for tenant '${tenantId}'`);
    this.name = 'ActionNotFoundError';
    this.action = action;
    this.tenantId = tenantId;
  }
}

/**
 * Custom error for disabled actions
 */
class ActionDisabledError extends Error {
  constructor(action, tenantId) {
    super(`Action '${action}' is disabled for tenant '${tenantId}'`);
    this.name = 'ActionDisabledError';
    this.action = action;
    this.tenantId = tenantId;
  }
}

/**
 * Custom error for invalid handler
 */
class InvalidHandlerError extends Error {
  constructor(handler, action) {
    super(`Invalid handler format '${handler}' for action '${action}'. Expected format: 'namespace.function'`);
    this.name = 'InvalidHandlerError';
    this.handler = handler;
    this.action = action;
  }
}

/**
 * Custom error for adapter not found
 */
class AdapterNotFoundError extends Error {
  constructor(namespace, action) {
    super(`Adapter not found for namespace '${namespace}' (action: '${action}')`);
    this.name = 'AdapterNotFoundError';
    this.namespace = namespace;
    this.action = action;
  }
}

/**
 * Custom error for function not found in adapter
 */
class FunctionNotFoundError extends Error {
  constructor(functionName, namespace, action) {
    super(`Function '${functionName}' not found in adapter '${namespace}' (action: '${action}')`);
    this.name = 'FunctionNotFoundError';
    this.functionName = functionName;
    this.namespace = namespace;
    this.action = action;
  }
}

/**
 * Check if a file exists
 * 
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load adapter module (tenant-specific or generic)
 * 
 * @param {string} namespace - Adapter namespace (e.g., "commerce")
 * @param {string} functionName - Function name to execute
 * @param {string} tenantId - Tenant ID
 * @param {string} action - Action name (for error messages)
 * 
 * @returns {Promise<Object>} Adapter module with source
 */
async function loadAdapter(namespace, functionName, tenantId, action) {
  // Sanitize inputs
  const sanitizedTenant = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
  const sanitizedNamespace = namespace.replace(/[^a-zA-Z0-9-_]/g, '');

  // Try tenant-specific adapter first
  const tenantAdapterPath = path.join(
    __dirname,
    '..',
    'tenants',
    `${sanitizedTenant}.adapter.js`
  );

  if (await fileExists(tenantAdapterPath)) {
    console.log(`[tools] Checking tenant-specific adapter: ${sanitizedTenant}.adapter.js`);
    try {
      const adapter = require(tenantAdapterPath);
      // Check if the specific function exists in tenant adapter
      if (adapter[functionName] && typeof adapter[functionName] === 'function') {
        console.log(`[tools] Using tenant-specific function: ${functionName}`);
        return { adapter, source: 'tenant-specific' };
      } else {
        console.log(`[tools] Function '${functionName}' not found in tenant adapter, falling back to generic`);
      }
    } catch (error) {
      console.warn(`[tools] Failed to load tenant adapter: ${error.message}`);
      // Fall through to generic adapter
    }
  }

  // Fall back to generic adapter
  const genericAdapterPath = path.join(
    __dirname,
    '..',
    'adapters',
    `${sanitizedNamespace}Adapter.js`
  );

  if (await fileExists(genericAdapterPath)) {
    console.log(`[tools] Loading generic adapter: ${sanitizedNamespace}Adapter.js`);
    try {
      const adapter = require(genericAdapterPath);
      return { adapter, source: 'generic' };
    } catch (error) {
      console.error(`[tools] Failed to load generic adapter: ${error.message}`);
      throw new AdapterNotFoundError(namespace, action);
    }
  }

  // No adapter found
  throw new AdapterNotFoundError(namespace, action);
}

/**
 * Run an action
 * 
 * This is the main entry point for executing actions.
 * 
 * @param {Object} options - Run options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {Object} options.actionRegistry - Action registry
 * @param {string} options.action - Action name to execute
 * @param {Object} [options.params={}] - Action parameters
 * 
 * @returns {Promise<Object>} Action execution result
 * 
 * @throws {ActionNotFoundError} If action not in registry
 * @throws {ActionDisabledError} If action is disabled
 * @throws {InvalidHandlerError} If handler format is invalid
 * @throws {AdapterNotFoundError} If adapter module not found
 * @throws {FunctionNotFoundError} If function not found in adapter
 */
async function runAction({ tenantConfig, actionRegistry, action, params = {} }) {
  const tenantId = tenantConfig.tenantId;

  console.log(`[tools.runAction] Executing action: ${action}`);
  console.log(`  Tenant: ${tenantId}`);
  console.log(`  Params:`, params);

  // 1. Validate action exists in registry
  if (!actionRegistry.actions || !actionRegistry.actions[action]) {
    throw new ActionNotFoundError(action, tenantId);
  }

  const actionConfig = actionRegistry.actions[action];

  // 2. Check if action is enabled
  if (!actionConfig.enabled) {
    throw new ActionDisabledError(action, tenantId);
  }

  // 3. Parse handler string (format: "namespace.function")
  const handler = actionConfig.handler;
  if (!handler || typeof handler !== 'string') {
    throw new InvalidHandlerError(handler, action);
  }

  const handlerParts = handler.split('.');
  if (handlerParts.length !== 2) {
    throw new InvalidHandlerError(handler, action);
  }

  const [namespace, functionName] = handlerParts;

  // 4. Load adapter (tenant-specific or generic)
  const { adapter, source } = await loadAdapter(namespace, functionName, tenantId, action);

  // 5. Get function from adapter
  const adapterFunction = adapter[functionName];
  if (!adapterFunction || typeof adapterFunction !== 'function') {
    throw new FunctionNotFoundError(functionName, namespace, action);
  }

  // 6. Execute the function
  console.log(`[tools] Executing: ${handler} (source: ${source})`);
  const startTime = Date.now();

  try {
    const result = await adapterFunction(params, tenantConfig);
    const executionTime = Date.now() - startTime;

    console.log(`[tools] Action completed in ${executionTime}ms`);

    // Add metadata to result
    const enrichedResult = {
      ...result,
      _meta: {
        action,
        handler,
        adapterSource: source,
        executionTime,
        timestamp: new Date().toISOString()
      }
    };

    // Log successful tool execution
    logToolExecution(tenantId, action, params, enrichedResult);

    return enrichedResult;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[tools] Action failed after ${executionTime}ms:`, error.message);

    // Re-throw with additional context
    error.action = action;
    error.handler = handler;
    error.executionTime = executionTime;
    throw error;
  }
}

module.exports = {
  runAction,
  ActionNotFoundError,
  ActionDisabledError,
  InvalidHandlerError,
  AdapterNotFoundError,
  FunctionNotFoundError
};
