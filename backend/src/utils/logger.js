/**
 * Structured Logging Utility
 * 
 * Provides structured logging for tool execution and other events.
 * Logs are output as JSON for easy parsing and analysis.
 * 
 * In production, these logs can be ingested by log aggregation systems
 * like ELK, Splunk, or CloudWatch.
 */

/**
 * Log tool execution with structured data
 * 
 * @param {string} tenantId - The tenant ID executing the tool
 * @param {string} action - The action/tool name being executed
 * @param {Object} params - Parameters passed to the tool
 * @param {Object} result - Result returned from the tool
 */
function logToolExecution(tenantId, action, params, result) {
  const logEntry = {
    timestamp: Date.now(),
    timestampISO: new Date().toISOString(),
    level: 'info',
    type: 'tool_execution',
    tenantId,
    action,
    params,
    result: {
      success: result?.success !== false,
      // Truncate large result objects to avoid log bloat
      data: typeof result === 'object' ? 
        JSON.stringify(result).substring(0, 500) : 
        result
    }
  };

  // Only log in development or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_TOOL_LOGS === 'true') {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Log general application events
 * 
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function log(level, message, metadata = {}) {
  const logEntry = {
    timestamp: Date.now(),
    timestampISO: new Date().toISOString(),
    level,
    message,
    ...metadata
  };

  // In production, only log warnings and errors to reduce noise
  if (process.env.NODE_ENV === 'production' && level === 'info') {
    return;
  }

  console.log(JSON.stringify(logEntry));
}

/**
 * Log errors with stack traces
 * 
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {Object} metadata - Additional metadata
 */
function logError(message, error, metadata = {}) {
  const logEntry = {
    timestamp: Date.now(),
    timestampISO: new Date().toISOString(),
    level: 'error',
    message,
    error: {
      name: error?.name,
      message: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    },
    ...metadata
  };

  console.error(JSON.stringify(logEntry));
}

module.exports = {
  logToolExecution,
  log,
  logError
};
