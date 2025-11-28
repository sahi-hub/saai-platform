/**
 * Order Service
 * 
 * Business logic for order management: view, track, cancel.
 * Uses in-memory storage for prototype.
 */

// In-memory order store
// Structure: orders[tenantId][sessionId] = [order1, order2, ...]
const orders = {
  'example': {
    'demo-session': [
      {
        orderId: 'ORD-1715432100',
        tenantId: 'example',
        sessionId: 'demo-session',
        items: [
          {
            productId: 'p101',
            name: 'Classic White Shirt',
            price: 2499,
            quantity: 1,
            subtotal: 2499
          }
        ],
        summary: {
          totalItems: 1,
          totalAmount: 2499
        },
        paymentMethod: 'COD',
        status: 'DELIVERED',
        createdAt: '2024-05-11T10:15:00.000Z'
      },
      {
        orderId: 'ORD-1715518500',
        tenantId: 'example',
        sessionId: 'demo-session',
        items: [
          {
            productId: 'p103',
            name: 'Slim Fit Chinos',
            price: 1899,
            quantity: 2,
            subtotal: 3798
          }
        ],
        summary: {
          totalItems: 2,
          totalAmount: 3798
        },
        paymentMethod: 'UPI',
        status: 'PROCESSING',
        createdAt: new Date().toISOString() // Recent order
      }
    ]
  }
};

/**
 * Get orders for a session
 * 
 * @param {Object} options
 * @param {Object} options.tenantConfig
 * @param {string} options.sessionId
 * @returns {Promise<Object>} Result with orders list
 */
async function getOrders({ tenantConfig, sessionId }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  const sessionKey = sessionId || 'demo-session';

  console.log(`[orderService] Getting orders for tenant=${tenantId}, session=${sessionKey}`);

  if (!orders[tenantId]) orders[tenantId] = {};
  if (!orders[tenantId][sessionKey]) orders[tenantId][sessionKey] = [];

  const userOrders = orders[tenantId][sessionKey];

  // Sort by date desc
  userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    type: 'order_list',
    success: true,
    action: 'view_orders',
    message: userOrders.length > 0 
      ? `Found ${userOrders.length} order(s).` 
      : 'You have no orders yet.',
    orders: userOrders
  };
}

/**
 * Get status of a specific order
 * 
 * @param {Object} options
 * @param {Object} options.tenantConfig
 * @param {string} options.orderId
 * @returns {Promise<Object>} Result with order details
 */
async function getOrderStatus({ tenantConfig, orderId }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  
  console.log(`[orderService] Getting status for order=${orderId}`);

  // Search across all sessions for this tenant (simplified for prototype)
  let foundOrder = null;
  if (orders[tenantId]) {
    for (const sessionKey in orders[tenantId]) {
      const match = orders[tenantId][sessionKey].find(o => o.orderId === orderId);
      if (match) {
        foundOrder = match;
        break;
      }
    }
  }

  if (!foundOrder) {
    return {
      type: 'order_status',
      success: false,
      action: 'get_order_status',
      message: `Order ${orderId} not found.`,
      order: null
    };
  }

  return {
    type: 'order_status',
    success: true,
    action: 'get_order_status',
    message: `Order ${orderId} is currently ${foundOrder.status}.`,
    order: foundOrder
  };
}

/**
 * Cancel an order
 * 
 * @param {Object} options
 * @param {Object} options.tenantConfig
 * @param {string} options.orderId
 * @param {string} options.reason
 * @returns {Promise<Object>} Result
 */
async function cancelOrder({ tenantConfig, orderId, reason }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  
  console.log(`[orderService] Cancelling order=${orderId}, reason=${reason}`);

  let foundOrder = null;
  if (orders[tenantId]) {
    for (const sessionKey in orders[tenantId]) {
      const match = orders[tenantId][sessionKey].find(o => o.orderId === orderId);
      if (match) {
        foundOrder = match;
        break;
      }
    }
  }

  if (!foundOrder) {
    return {
      type: 'order_update',
      success: false,
      action: 'cancel_order',
      message: `Order ${orderId} not found.`,
      order: null
    };
  }

  if (['DELIVERED', 'CANCELLED', 'RETURNED'].includes(foundOrder.status)) {
    return {
      type: 'order_update',
      success: false,
      action: 'cancel_order',
      message: `Cannot cancel order ${orderId} because it is already ${foundOrder.status}.`,
      order: foundOrder
    };
  }

  foundOrder.status = 'CANCELLED';
  foundOrder.cancelledAt = new Date().toISOString();
  foundOrder.cancellationReason = reason || 'User requested cancellation';

  return {
    type: 'order_update',
    success: true,
    action: 'cancel_order',
    message: `Order ${orderId} has been cancelled successfully.`,
    order: foundOrder
  };
}

/**
 * Create a new order (called by checkout)
 * 
 * @param {Object} orderData - Order object
 * @returns {Object} Created order
 */
function createOrder(orderData) {
  const { tenantId, sessionId } = orderData;
  
  if (!orders[tenantId]) orders[tenantId] = {};
  if (!orders[tenantId][sessionId]) orders[tenantId][sessionId] = [];

  orders[tenantId][sessionId].push(orderData);
  console.log(`[orderService] Stored new order ${orderData.orderId}`);
  
  return orderData;
}

module.exports = {
  getOrders,
  getOrderStatus,
  cancelOrder,
  createOrder
};
