/**
 * In-memory Cart Store
 * 
 * Simple in-memory storage for shopping carts.
 * Structure: carts[tenantId][sessionKey] = { items: [...], updatedAt }
 * 
 * NOTE: This is for PROTOTYPE ONLY - no persistence across restarts.
 * In production, use Redis/database.
 */

const carts = {};

/**
 * Get or create a cart record for tenant + session
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionKey - Session/user identifier
 * @returns {Object} Cart record with items array and updatedAt timestamp
 */
function getCartRecord(tenantId, sessionKey) {
  if (!tenantId) tenantId = 'default';
  if (!sessionKey) sessionKey = 'demo-session';

  if (!carts[tenantId]) {
    carts[tenantId] = {};
  }
  if (!carts[tenantId][sessionKey]) {
    carts[tenantId][sessionKey] = {
      items: [],
      updatedAt: new Date().toISOString()
    };
  }
  return carts[tenantId][sessionKey];
}

/**
 * Save/update a cart record
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionKey - Session/user identifier
 * @param {Object} record - Cart record to save
 */
function saveCartRecord(tenantId, sessionKey, record) {
  if (!tenantId) tenantId = 'default';
  if (!sessionKey) sessionKey = 'demo-session';

  if (!carts[tenantId]) {
    carts[tenantId] = {};
  }
  carts[tenantId][sessionKey] = {
    ...record,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Clear/delete a cart
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionKey - Session/user identifier
 */
function clearCart(tenantId, sessionKey) {
  if (!tenantId) tenantId = 'default';
  if (!sessionKey) sessionKey = 'demo-session';
  
  if (carts[tenantId]) {
    delete carts[tenantId][sessionKey];
  }
}

/**
 * Get all carts (for debugging)
 * 
 * @returns {Object} All carts
 */
function getAllCarts() {
  return carts;
}

module.exports = {
  getCartRecord,
  saveCartRecord,
  clearCart,
  getAllCarts
};
