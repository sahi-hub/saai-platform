/**
 * Product Loader Utility
 * Loads tenant-specific product catalogs from JSON files
 * Provides fallback to example catalog if tenant-specific file not found
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Load products for a specific tenant
 * @param {string} tenantId - The tenant identifier
 * @returns {Promise<Array>} Array of product objects
 */
async function loadProductsForTenant(tenantId) {
  try {
    // Build the path to the tenant-specific product file
    const tenantProductsPath = path.join(
      __dirname,
      '..',
      'data',
      'products',
      `products.${tenantId}.json`
    );

    // Try to read the tenant-specific file
    try {
      const data = await fs.readFile(tenantProductsPath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Validate the structure
      if (parsed && Array.isArray(parsed.products)) {
        console.log(`✅ Loaded ${parsed.products.length} products for tenant: ${tenantId}`);
        return parsed.products;
      } else {
        console.warn(`⚠️  Invalid product file structure for tenant: ${tenantId}`);
        throw new Error('Invalid product file structure');
      }
    } catch (tenantError) {
      // Tenant-specific file not found or invalid, try fallback
      if (tenantError.code === 'ENOENT') {
        console.log(`ℹ️  No product file for tenant: ${tenantId}, falling back to example`);
      } else {
        console.error(`❌ Error reading product file for tenant: ${tenantId}`, tenantError.message);
      }
      
      // Fallback to example products
      const exampleProductsPath = path.join(
        __dirname,
        '..',
        'data',
        'products',
        'products.example.json'
      );
      
      try {
        const data = await fs.readFile(exampleProductsPath, 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed && Array.isArray(parsed.products)) {
          console.log(`✅ Loaded ${parsed.products.length} fallback products from example catalog`);
          return parsed.products;
        } else {
          console.warn(`⚠️  Invalid example product file structure`);
          return [];
        }
      } catch (exampleError) {
        console.error('❌ Error reading example product file:', exampleError.message);
        return [];
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error in loadProductsForTenant:', error.message);
    return [];
  }
}

/**
 * Get product by ID for a specific tenant
 * @param {string} tenantId - The tenant identifier
 * @param {string} productId - The product identifier
 * @returns {Promise<Object|null>} Product object or null if not found
 */
async function getProductById(tenantId, productId) {
  try {
    const products = await loadProductsForTenant(tenantId);
    const product = products.find(p => p.id === productId);
    
    if (product) {
      console.log(`✅ Found product ${productId} for tenant: ${tenantId}`);
    } else {
      console.log(`ℹ️  Product ${productId} not found for tenant: ${tenantId}`);
    }
    
    return product || null;
  } catch (error) {
    console.error('❌ Error in getProductById:', error.message);
    return null;
  }
}

/**
 * Search products by category for a specific tenant
 * @param {string} tenantId - The tenant identifier
 * @param {string} category - The product category
 * @returns {Promise<Array>} Array of matching products
 */
async function getProductsByCategory(tenantId, category) {
  try {
    const products = await loadProductsForTenant(tenantId);
    const filtered = products.filter(p => p.category === category);
    
    console.log(`✅ Found ${filtered.length} products in category '${category}' for tenant: ${tenantId}`);
    return filtered;
  } catch (error) {
    console.error('❌ Error in getProductsByCategory:', error.message);
    return [];
  }
}

/**
 * Search products by tags for a specific tenant
 * @param {string} tenantId - The tenant identifier
 * @param {Array<string>} tags - Array of tags to search for
 * @returns {Promise<Array>} Array of matching products
 */
async function getProductsByTags(tenantId, tags) {
  try {
    const products = await loadProductsForTenant(tenantId);
    const filtered = products.filter(p => 
      p.tags && p.tags.some(tag => tags.includes(tag))
    );
    
    console.log(`✅ Found ${filtered.length} products with tags [${tags.join(', ')}] for tenant: ${tenantId}`);
    return filtered;
  } catch (error) {
    console.error('❌ Error in getProductsByTags:', error.message);
    return [];
  }
}

module.exports = {
  loadProductsForTenant,
  getProductById,
  getProductsByCategory,
  getProductsByTags
};
