/**
 * Recommendation Controller
 * Handles recommendation API endpoints
 */

const { 
  recommendProducts, 
  getSimilarProducts, 
  getPersonalizedRecommendations 
} = require('../recommender/recommender');

/**
 * Main recommendation endpoint
 * POST /recommend/:tenantId
 * GET /recommend/:tenantId (with query params)
 * 
 * Request body (POST):
 * {
 *   "query": "eid outfit",
 *   "preferences": ["white", "shirt"],
 *   "limit": 10,
 *   "minScore": 0.1
 * }
 * 
 * Query params (GET):
 * ?query=eid+outfit&preferences=white,shirt&limit=10
 */
async function recommendController(req, res) {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    // Support both POST and GET
    let query = '';
    let preferences = [];
    let limit = 10;
    let minScore = 0.1;
    
    if (req.method === 'POST') {
      // Parse from request body
      query = req.body.query || '';
      preferences = req.body.preferences || [];
      limit = req.body.limit || 10;
      minScore = req.body.minScore || 0.1;
    } else {
      // Parse from query params (GET)
      query = req.query.query || '';
      
      // Parse preferences from comma-separated string
      if (req.query.preferences) {
        preferences = req.query.preferences.split(',').map(p => p.trim());
      }
      
      limit = parseInt(req.query.limit, 10) || 10;
      minScore = parseFloat(req.query.minScore) || 0.1;
    }
    
    // Validate preferences is an array
    if (!Array.isArray(preferences)) {
      preferences = [];
    }
    
    // Validate limit
    if (limit < 1 || limit > 50) {
      limit = 10;
    }
    
    // Get recommendations
    const recommendations = await recommendProducts(tenantId, query, preferences, {
      limit,
      minScore,
      includeScores: true
    });
    
    return res.status(200).json({
      success: true,
      tenantId,
      query,
      preferences,
      count: recommendations.length,
      recommendations
    });
    
  } catch (error) {
    console.error('❌ Error in recommendController:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations'
    });
  }
}

/**
 * Get similar products endpoint
 * GET /recommend/:tenantId/similar/:productId
 * 
 * Query params:
 * ?limit=5&minScore=0.2
 */
async function getSimilarProductsController(req, res) {
  try {
    const { tenantId, productId } = req.params;
    
    if (!tenantId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID and Product ID are required'
      });
    }
    
    const limit = parseInt(req.query.limit, 10) || 5;
    const minScore = parseFloat(req.query.minScore) || 0.2;
    
    // Get similar products
    const similarProducts = await getSimilarProducts(tenantId, productId, {
      limit,
      minScore
    });
    
    return res.status(200).json({
      success: true,
      tenantId,
      productId,
      count: similarProducts.length,
      similarProducts
    });
    
  } catch (error) {
    console.error('❌ Error in getSimilarProductsController:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to find similar products'
    });
  }
}

/**
 * Get personalized recommendations endpoint
 * POST /recommend/:tenantId/personalized
 * 
 * Request body:
 * {
 *   "viewedProducts": ["p101", "p102"],
 *   "likedCategories": ["shirt", "shoes"],
 *   "limit": 10
 * }
 */
async function getPersonalizedController(req, res) {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    const viewedProducts = req.body.viewedProducts || [];
    const likedCategories = req.body.likedCategories || [];
    const limit = req.body.limit || 10;
    const minScore = req.body.minScore || 0.15;
    
    // Validate arrays
    if (!Array.isArray(viewedProducts) || !Array.isArray(likedCategories)) {
      return res.status(400).json({
        success: false,
        error: 'viewedProducts and likedCategories must be arrays'
      });
    }
    
    // Get personalized recommendations
    const recommendations = await getPersonalizedRecommendations(
      tenantId, 
      viewedProducts, 
      likedCategories, 
      { limit, minScore }
    );
    
    return res.status(200).json({
      success: true,
      tenantId,
      viewedProducts,
      likedCategories,
      count: recommendations.length,
      recommendations
    });
    
  } catch (error) {
    console.error('❌ Error in getPersonalizedController:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate personalized recommendations'
    });
  }
}

module.exports = {
  recommendController,
  getSimilarProductsController,
  getPersonalizedController
};
