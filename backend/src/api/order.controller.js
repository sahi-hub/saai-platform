/**
 * Order Controller
 * 
 * HTTP endpoints for order operations.
 */

const { getOrders, getOrderStatus, cancelOrder } = require('../commerce/orderService');
const { loadTenantConfig } = require('../utils/tenantLoader');

/**
 * GET /orders/:tenantId
 * View orders for a tenant/session
 * 
 * Query params:
 * - session: Session ID (optional, defaults to demo-session)
 */
exports.getOrdersEndpoint = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'example';
    const sessionId = req.query.session || null;

    console.log(`[order.controller] GET orders for tenant=${tenantId}, session=${sessionId}`);

    const tenantConfig = await loadTenantConfig(tenantId);
    const result = await getOrders({ tenantConfig, sessionId });

    res.json(result);
  } catch (err) {
    console.error('[order.controller] getOrders error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load orders',
      message: err.message 
    });
  }
};

/**
 * GET /orders/:tenantId/:orderId
 * Get status of a specific order
 */
exports.getOrderStatusEndpoint = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'example';
    const orderId = req.params.orderId;

    console.log(`[order.controller] GET order status for tenant=${tenantId}, order=${orderId}`);

    const tenantConfig = await loadTenantConfig(tenantId);
    const result = await getOrderStatus({ tenantConfig, orderId });

    res.json(result);
  } catch (err) {
    console.error('[order.controller] getOrderStatus error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get order status',
      message: err.message 
    });
  }
};

/**
 * POST /orders/:tenantId/:orderId/cancel
 * Cancel an order
 * 
 * Body:
 * - reason: Cancellation reason (optional)
 */
exports.cancelOrderEndpoint = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'example';
    const orderId = req.params.orderId;
    const { reason } = req.body;

    console.log(`[order.controller] POST cancel order: tenant=${tenantId}, order=${orderId}`);

    const tenantConfig = await loadTenantConfig(tenantId);
    const result = await cancelOrder({ tenantConfig, orderId, reason });

    res.json(result);
  } catch (err) {
    console.error('[order.controller] cancelOrder error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel order',
      message: err.message 
    });
  }
};
