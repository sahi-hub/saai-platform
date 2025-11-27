/**
 * Products Controller
 * Handles product catalog API endpoints
 */

const { loadProductsForTenant, getProductById, getProductsByCategory, getProductsByTags } = require('../utils/productLoader');

/**
 * Get all products for a tenant
 * GET /products/:tenantId
 * 
 * Query params:
 * - q: Optional search term to filter products by name, description, category, tags
 */
async function getProductsForTenant(req, res) {
  try {
    const { tenantId } = req.params;
    const q = (req.query.q || '').toString().toLowerCase().trim();
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    // Load products for the tenant
    const products = await loadProductsForTenant(tenantId);
    
    // Apply search filter if q param provided
    let filtered = products;
    if (q) {
      filtered = products.filter((p) => {
        const fields = [
          p.name,
          p.description,
          p.category,
          ...(Array.isArray(p.tags) ? p.tags : [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return fields.includes(q);
      });
    }
    
    return res.status(200).json({
      success: true,
      tenantId,
      ...(q && { searchQuery: q }),
      count: filtered.length,
      products: filtered
    });
  } catch (error) {
    console.error('❌ Error in getProductsForTenant:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load products'
    });
  }
}

/**
 * Get a specific product by ID
 * GET /products/:tenantId/:productId
 */
async function getProduct(req, res) {
  try {
    const { tenantId, productId } = req.params;
    
    if (!tenantId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID and Product ID are required'
      });
    }
    
    // Load the specific product
    const product = await getProductById(tenantId, productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      tenantId,
      product
    });
  } catch (error) {
    console.error('❌ Error in getProduct:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load product'
    });
  }
}

/**
 * Get products by category
 * GET /products/:tenantId/category/:category
 */
async function getProductsByCategoryRoute(req, res) {
  try {
    const { tenantId, category } = req.params;
    
    if (!tenantId || !category) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID and Category are required'
      });
    }
    
    // Load products by category
    const products = await getProductsByCategory(tenantId, category);
    
    return res.status(200).json({
      success: true,
      tenantId,
      category,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('❌ Error in getProductsByCategoryRoute:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load products by category'
    });
  }
}

/**
 * Get products by tags
 * GET /products/:tenantId/tags?tags=casual,formal
 */
async function getProductsByTagsRoute(req, res) {
  try {
    const { tenantId } = req.params;
    const { tags } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    if (!tags) {
      return res.status(400).json({
        success: false,
        error: 'Tags query parameter is required'
      });
    }
    
    // Parse tags from query string
    const tagArray = tags.split(',').map(t => t.trim());
    
    // Load products by tags
    const products = await getProductsByTags(tenantId, tagArray);
    
    return res.status(200).json({
      success: true,
      tenantId,
      tags: tagArray,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('❌ Error in getProductsByTagsRoute:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load products by tags'
    });
  }
}

module.exports = {
  getProductsForTenant,
  getProduct,
  getProductsByCategoryRoute,
  getProductsByTagsRoute
};
