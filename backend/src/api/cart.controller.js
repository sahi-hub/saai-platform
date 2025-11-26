/**
 * Cart Controller
 * 
 * Debug HTTP endpoints for cart operations.
 * These are for manual testing via curl, not intended for production use.
 */

const { viewCart, checkoutCart, addToCart } = require('../commerce/cartService');
const { loadTenantConfig } = require('../utils/tenantLoader');

/**
 * GET /cart/:tenantId
 * View cart contents for a tenant/session
 * 
 * Query params:
 * - session: Session ID (optional, defaults to demo-session)
 */
exports.getCart = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'example';
    const sessionId = req.query.session || null;

    console.log(`[cart.controller] GET cart for tenant=${tenantId}, session=${sessionId}`);

    const tenantConfig = await loadTenantConfig(tenantId);
    const result = await viewCart({ tenantConfig, sessionId });

    res.json(result);
  } catch (err) {
    console.error('[cart.controller] getCart error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load cart',
      message: err.message 
    });
  }
};

/**
 * POST /cart/:tenantId/add
 * Add a product to cart (debug endpoint)
 * 
 * Body:
 * - productId: Product ID to add
 * - quantity: Quantity (optional, default 1)
 * - sessionId: Session ID (optional)
 */
exports.addToCartEndpoint = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'example';
    const { productId, quantity, sessionId } = req.body;

    console.log(`[cart.controller] POST add to cart: tenant=${tenantId}, product=${productId}`);

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required'
      });
    }

    const tenantConfig = await loadTenantConfig(tenantId);
    const result = await addToCart({ 
      tenantConfig, 
      sessionId, 
      productId, 
      quantity: quantity || 1 
    });

    res.json(result);
  } catch (err) {
    console.error('[cart.controller] addToCart error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add to cart',
      message: err.message 
    });
  }
};

/**
 * POST /cart/:tenantId/checkout
 * Checkout cart and create order
 * 
 * Body:
 * - sessionId: Session ID (optional)
 * - paymentMethod: Payment method (optional, default COD)
 */
exports.checkoutCartEndpoint = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'example';
    const sessionId = req.body.sessionId || null;
    const paymentMethod = req.body.paymentMethod || 'COD';

    console.log(`[cart.controller] POST checkout: tenant=${tenantId}, payment=${paymentMethod}`);

    const tenantConfig = await loadTenantConfig(tenantId);
    const result = await checkoutCart({ tenantConfig, sessionId, paymentMethod });

    res.json(result);
  } catch (err) {
    console.error('[cart.controller] checkout error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to checkout',
      message: err.message 
    });
  }
};
