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

module.exports = router;
