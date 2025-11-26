const express = require('express');
const { handleChat } = require('./chat.controller');
const { getTenantInfo } = require('./tenant.controller');
const { 
  getProductsForTenant, 
  getProduct, 
  getProductsByCategoryRoute, 
  getProductsByTagsRoute 
} = require('./products.controller');
const { 
  recommendController, 
  getSimilarProductsController, 
  getPersonalizedController 
} = require('./recommend.controller');
const { 
  getCart, 
  addToCartEndpoint, 
  checkoutCartEndpoint,
  addOutfitToCartEndpoint 
} = require('./cart.controller');
const { 
  getDebugLogs, 
  clearDebugLogs 
} = require('./debug.controller');

const router = express.Router();

/**
 * Chat endpoint
 * POST /chat
 * 
 * Handles chat requests for multi-tenant SAAI platform
 * Currently echoes back the message and tenant
 * Will be extended with tenant loader, orchestrator, memory, and adapters
 */
router.post('/chat', handleChat);

/**
 * Tenant information endpoint
 * GET /tenant/:tenantId
 * 
 * Returns tenant-specific configuration, action registry, and theme settings
 * Used by the frontend to customize UI for each tenant
 * 
 * Loads configuration from JSON files in src/config/tenants/
 * Loads action registry from JSON files in src/registry/
 */
router.get('/tenant/:tenantId', getTenantInfo);

/**
 * Product catalog endpoints
 * GET /products/:tenantId - Get all products for a tenant
 * GET /products/:tenantId/:productId - Get a specific product
 * GET /products/:tenantId/category/:category - Get products by category
 * GET /products/:tenantId/tags?tags=tag1,tag2 - Get products by tags
 * 
 * Loads product catalogs from JSON files in src/data/products/
 * Falls back to example catalog if tenant-specific file not found
 */
router.get('/products/:tenantId', getProductsForTenant);
router.get('/products/:tenantId/category/:category', getProductsByCategoryRoute);
router.get('/products/:tenantId/tags', getProductsByTagsRoute);
router.get('/products/:tenantId/:productId', getProduct);

/**
 * Recommendation endpoints
 * POST /recommend/:tenantId - Get product recommendations based on query and preferences
 * GET /recommend/:tenantId - Same as POST but with query params
 * GET /recommend/:tenantId/similar/:productId - Get products similar to a specific product
 * POST /recommend/:tenantId/personalized - Get personalized recommendations based on user history
 * 
 * Uses vector-based similarity computation with product embeddings
 * Query and preferences are converted to feature vectors and ranked by cosine similarity
 */
router.post('/recommend/:tenantId', recommendController);
router.get('/recommend/:tenantId', recommendController);
router.get('/recommend/:tenantId/similar/:productId', getSimilarProductsController);
router.post('/recommend/:tenantId/personalized', getPersonalizedController);

/**
 * Cart endpoints (debug/prototype)
 * GET /cart/:tenantId - View cart contents
 * POST /cart/:tenantId/add - Add product to cart
 * POST /cart/:tenantId/add-outfit - Add outfit (multiple products) to cart
 * POST /cart/:tenantId/checkout - Checkout and create order
 * 
 * These are for manual testing via curl.
 * In production, cart operations go through /chat as tool calls.
 * 
 * Query params for GET:
 * - session: Session ID (optional)
 * 
 * Body for POST /add:
 * - productId: Product ID to add
 * - quantity: Quantity (optional)
 * - sessionId: Session ID (optional)
 * 
 * Body for POST /add-outfit:
 * - sessionId: Session ID (required)
 * - productIds: Array of product IDs to add (required)
 * 
 * Body for POST /checkout:
 * - sessionId: Session ID (optional)
 * - paymentMethod: Payment method (optional, default COD)
 */
router.get('/cart/:tenantId', getCart);
router.post('/cart/:tenantId/add', addToCartEndpoint);
router.post('/cart/:tenantId/add-outfit', addOutfitToCartEndpoint);
router.post('/cart/:tenantId/checkout', checkoutCartEndpoint);

/**
 * Debug endpoints
 * GET /debug/logs - View recent chat logs
 * POST /debug/logs/clear - Clear all logs
 * 
 * Query params for GET:
 * - tenant: Filter by tenant ID (optional)
 * - session: Filter by session ID (optional)
 * - limit: Maximum number of logs (default: 50)
 * 
 * Returns structured logs with:
 * - tenantId, sessionId, userMessage
 * - replyType (message/tool_result)
 * - llmProvider, llmModel
 * - toolAction, toolResultType, toolSummary (for tool calls)
 * - groundedText (for grounded explanations)
 * - error, errorMessage (for errors)
 */
router.get('/debug/logs', getDebugLogs);
router.post('/debug/logs/clear', clearDebugLogs);

module.exports = router;
