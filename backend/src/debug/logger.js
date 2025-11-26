// src/debug/logger.js
// In-memory structured logging for development and demo

const logs = [];
const MAX_LOGS = 500; // keep last N entries in memory

/**
 * Add a log entry to the in-memory buffer
 * @param {Object} entry - Log entry with tenantId, sessionId, userMessage, etc.
 */
function addLog(entry) {
  const enriched = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString()
  };
  logs.push(enriched);
  if (logs.length > MAX_LOGS) {
    logs.shift(); // remove oldest
  }
}

/**
 * Retrieve logs with optional filtering
 * @param {Object} options - Filter options
 * @param {string} [options.tenantId] - Filter by tenant
 * @param {string} [options.sessionId] - Filter by session
 * @param {number} [options.limit=50] - Maximum number of logs to return
 * @returns {Array} Filtered logs, newest first
 */
function getLogs({ tenantId, sessionId, limit = 50 } = {}) {
  let result = logs;

  if (tenantId) {
    result = result.filter((l) => l.tenantId === tenantId);
  }
  if (sessionId) {
    result = result.filter((l) => l.sessionId === sessionId);
  }

  // return newest first
  const sliced = result.slice(-limit).reverse();
  return sliced;
}

/**
 * Clear all logs (useful for testing)
 */
function clearLogs() {
  logs.length = 0;
}

/**
 * Get current log count
 * @returns {number} Number of logs in buffer
 */
function getLogCount() {
  return logs.length;
}

module.exports = {
  addLog,
  getLogs,
  clearLogs,
  getLogCount
};
