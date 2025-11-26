// src/api/debug.controller.js
// Debug endpoints for development and demo

const { getLogs, getLogCount, clearLogs } = require('../debug/logger');

/**
 * Get debug logs with optional filtering
 * 
 * Query params:
 * - tenant: Filter by tenant ID
 * - session: Filter by session ID
 * - limit: Maximum number of logs to return (default: 50)
 */
exports.getDebugLogs = (req, res) => {
  try {
    const tenantId = req.query.tenant || null;
    const sessionId = req.query.session || null;
    const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : 50;

    const logs = getLogs({ 
      tenantId, 
      sessionId, 
      limit: Number.isNaN(limit) ? 50 : limit 
    });

    res.json({
      success: true,
      count: logs.length,
      totalInBuffer: getLogCount(),
      logs
    });
  } catch (err) {
    console.error('[debug] getDebugLogs error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load logs'
    });
  }
};

/**
 * Clear all logs (useful for testing)
 * POST /debug/logs/clear
 */
exports.clearDebugLogs = (req, res) => {
  try {
    clearLogs();
    res.json({
      success: true,
      message: 'All logs cleared'
    });
  } catch (err) {
    console.error('[debug] clearDebugLogs error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs'
    });
  }
};
