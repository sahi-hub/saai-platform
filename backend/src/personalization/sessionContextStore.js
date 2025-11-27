/**
 * Session Context Store - Track recent AI product context per session
 * 
 * Stores the last products shown, matched IDs, and user message
 * to enable conversational references like "the second one", "cheaper option", etc.
 * 
 * This is an in-memory implementation - data is lost on restart.
 */

// In-memory store:
// contexts[tenantId][sessionId] = { lastProducts, lastMatchedProductIds, lastUserMessage, updatedAt }
const contexts = {};

/**
 * Get session context for a tenant/session combination
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session context or null if not found
 */
function getSessionContext(tenantId = 'default', sessionId = 'anon') {
  const tId = tenantId || 'default';
  const sId = sessionId || 'anon';

  if (!contexts[tId]) return null;
  return contexts[tId][sId] || null;
}

/**
 * Save session context for a tenant/session combination
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionId - Session identifier
 * @param {Object} context - Context to save
 * @param {Array} context.lastProducts - Full product objects that were matched
 * @param {Array} context.lastMatchedProductIds - Product IDs that were matched
 * @param {string} context.lastUserMessage - The user's last message
 */
function saveSessionContext(tenantId, sessionId, context) {
  const tId = tenantId || 'default';
  const sId = sessionId || 'anon';

  if (!contexts[tId]) {
    contexts[tId] = {};
  }

  contexts[tId][sId] = {
    ...context,
    updatedAt: new Date().toISOString()
  };

  console.log(`[SessionContext] Saved context for ${tId}/${sId}: ${context.lastMatchedProductIds?.length || 0} products`);
}

/**
 * Get all contexts for debugging
 * 
 * @returns {Object} All session contexts
 */
function getContextsDebug() {
  return contexts;
}

/**
 * Clear session context for a specific tenant/session
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionId - Session identifier
 */
function clearSessionContext(tenantId = 'default', sessionId = 'anon') {
  const tId = tenantId || 'default';
  const sId = sessionId || 'anon';

  if (contexts[tId] && contexts[tId][sId]) {
    delete contexts[tId][sId];
  }
}

/**
 * Clear all session contexts (useful for testing)
 */
function clearAllContexts() {
  for (const key of Object.keys(contexts)) {
    delete contexts[key];
  }
}

/**
 * Get context statistics
 * 
 * @returns {Object} Stats about stored contexts
 */
function getContextStats() {
  let totalContexts = 0;
  const byTenant = {};

  for (const tenantId of Object.keys(contexts)) {
    const sessionCount = Object.keys(contexts[tenantId]).length;
    byTenant[tenantId] = sessionCount;
    totalContexts += sessionCount;
  }

  return {
    totalContexts,
    byTenant,
    tenantCount: Object.keys(contexts).length
  };
}

module.exports = {
  getSessionContext,
  saveSessionContext,
  getContextsDebug,
  clearSessionContext,
  clearAllContexts,
  getContextStats
};
