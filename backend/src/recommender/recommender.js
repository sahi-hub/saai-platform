/**
 * Product Recommendation Engine
 * Main recommender that loads products, embeds them, and ranks by similarity
 */

const { loadProductsForTenant } = require('../utils/productLoader');
const { embedProduct, embedQuery } = require('./productEmbedding');
const { computeSimilarity } = require('./similarity');

/**
 * Category penalty map: what categories to penalize for specific query intents
 * Key = intent keywords found in query
 * Value = array of categories to penalize
 */
const CATEGORY_PENALTIES = {
  // Tech/office intents should penalize non-tech categories
  'office': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry'],
  'work': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry'],
  'desk': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry', 'footwear'],
  'computer': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry', 'footwear', 'clothing'],
  'tech': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry'],
  'laptop': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry', 'footwear'],
  'monitor': ['beauty', 'fitness', 'fashion', 'grocery', 'food', 'jewelry', 'footwear'],
  
  // Fitness intents should focus on fitness gear
  'workout': ['beauty', 'food', 'jewelry', 'furniture', 'home'],
  'exercise': ['beauty', 'food', 'jewelry', 'furniture', 'home'],
  'gym': ['beauty', 'food', 'jewelry', 'furniture', 'home'],
  'yoga': ['beauty', 'food', 'jewelry', 'furniture', 'electronics'],
  
  // Beauty/skincare intents
  'skincare': ['electronics', 'fitness', 'furniture', 'food'],
  'makeup': ['electronics', 'fitness', 'furniture', 'food'],
  'beauty': ['electronics', 'fitness', 'furniture'],
  
  // Fashion/clothing intents
  'casual': ['electronics', 'furniture', 'grocery', 'beauty'],
  'formal': ['electronics', 'fitness', 'grocery'],
  'fashion': ['electronics', 'furniture', 'grocery']
};

/**
 * Detect categories that should be penalized based on query intent
 * @param {string} query - User's search query
 * @returns {Set<string>} Categories to penalize
 */
function detectCategoryPenalties(query) {
  const queryLower = query.toLowerCase();
  const penalizedCategories = new Set();
  
  for (const [keyword, categories] of Object.entries(CATEGORY_PENALTIES)) {
    if (queryLower.includes(keyword)) {
      categories.forEach(cat => penalizedCategories.add(cat.toLowerCase()));
    }
  }
  
  return penalizedCategories;
}

/**
 * Detect similar product clusters (products that serve same purpose)
 * Used for deduplication
 */
const SIMILAR_PRODUCT_CLUSTERS = [
  ['earbuds', 'headphones', 'earphones', 'airpods', 'headset'], // Audio devices
  ['laptop', 'notebook', 'macbook', 'chromebook'], // Portable computers
  ['smartwatch', 'smart watch', 'fitness tracker', 'fitness band'], // Wearables
  ['phone', 'smartphone', 'iphone', 'android'], // Phones
  ['tablet', 'ipad'], // Tablets
  ['mouse', 'trackpad'], // Pointing devices
];

/**
 * Get cluster ID for a product (0 = no cluster)
 * @param {Object} product - Product object
 * @returns {number} Cluster ID or 0 if no cluster
 */
function getProductClusterId(product) {
  const searchText = [
    product.name || '',
    product.category || '',
    ...(product.tags || [])
  ].join(' ').toLowerCase();
  
  for (let i = 0; i < SIMILAR_PRODUCT_CLUSTERS.length; i++) {
    const cluster = SIMILAR_PRODUCT_CLUSTERS[i];
    for (const keyword of cluster) {
      if (searchText.includes(keyword)) {
        return i + 1; // Return 1-indexed cluster ID
      }
    }
  }
  
  return 0; // No cluster
}

/**
 * Deduplicate products by cluster - keep only highest scored product per cluster
 * @param {Array<Object>} products - Sorted products with scores
 * @returns {Array<Object>} Deduplicated products
 */
function deduplicateByClusters(products) {
  const seenClusters = new Set();
  const result = [];
  
  for (const product of products) {
    const clusterId = getProductClusterId(product);
    
    if (clusterId === 0) {
      // Not in any cluster, always include
      result.push(product);
    } else if (!seenClusters.has(clusterId)) {
      // First product from this cluster, include it
      seenClusters.add(clusterId);
      result.push(product);
    }
    // Skip if cluster already represented
  }
  
  return result;
}

/**
 * Recommend products based on query and preferences
 * @param {string} tenantId - Tenant identifier
 * @param {string} query - Search query string
 * @param {Array<string>} preferences - Array of preference keywords
 * @param {Object} options - Additional options (limit, minScore, etc.)
 * @returns {Promise<Array<Object>>} Sorted array of recommended products with scores
 */
async function recommendProducts(tenantId, query = '', preferences = [], options = {}) {
  try {
    const {
      limit = 10,
      minScore = 0.1, // Lower threshold to include more relevant results
      includeScores = true,
      deduplicate = true // Enable cluster deduplication by default
    } = options;
    
    console.log(`🔍 Generating recommendations for tenant: ${tenantId}`);
    console.log(`   Query: "${query}"`);
    console.log(`   Preferences: [${preferences.join(', ')}]`);
    
    // Load all products for the tenant
    const products = await loadProductsForTenant(tenantId);
    
    if (products.length === 0) {
      console.warn(`⚠️  No products found for tenant: ${tenantId}`);
      return [];
    }
    
    console.log(`✅ Loaded ${products.length} products for recommendation`);
    
    // Detect category penalties based on query intent
    const penalizedCategories = detectCategoryPenalties(query);
    if (penalizedCategories.size > 0) {
      console.log(`📊 Applying penalties to categories: [${[...penalizedCategories].join(', ')}]`);
    }
    
    // Build query vector
    const queryVec = embedQuery(query, preferences);
    const queryFeatures = Object.keys(queryVec);
    
    if (queryFeatures.length === 0) {
      console.warn('⚠️  Empty query and preferences, returning products by default order');
      // Return first N products without scoring
      return products.slice(0, limit).map(p => ({
        ...p,
        similarityScore: 0
      }));
    }
    
    console.log(`🎯 Query vector has ${queryFeatures.length} features: [${queryFeatures.slice(0, 5).join(', ')}...]`);
    
    // Embed all products and compute similarity with category penalty
    const productsWithScores = products.map(product => {
      const productVec = embedProduct(product);
      let score = computeSimilarity(queryVec, productVec);
      
      // Apply category penalty if product is in a penalized category
      const productCategory = (product.category || '').toLowerCase();
      if (penalizedCategories.has(productCategory)) {
        const penaltyFactor = 0.5; // Reduce score by 50%
        const originalScore = score;
        score = score * penaltyFactor;
        console.log(`   Penalizing "${product.name}" (${productCategory}): ${originalScore.toFixed(3)} → ${score.toFixed(3)}`);
      }
      
      return {
        ...product,
        vector: productVec,
        similarityScore: score
      };
    });
    
    // Filter by minimum score
    const filtered = productsWithScores.filter(p => p.similarityScore >= minScore);
    
    console.log(`📊 ${filtered.length} products passed minimum score threshold (${minScore})`);
    
    // Sort by similarity score (descending)
    filtered.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Apply cluster deduplication if enabled
    let recommendations = deduplicate 
      ? deduplicateByClusters(filtered)
      : filtered;
    
    // Take top N results
    recommendations = recommendations.slice(0, limit);
    
    console.log(`✅ Returning top ${recommendations.length} recommendations`);
    if (recommendations.length > 0) {
      console.log(`   Top match: "${recommendations[0].name}" (score: ${recommendations[0].similarityScore.toFixed(3)})`);
    }
    
    // Remove vector from results if not needed
    if (!includeScores) {
      return recommendations.map(({ vector, similarityScore, ...product }) => product);
    }
    
    // Remove vector but keep score
    return recommendations.map(({ vector, ...product }) => product);
    
  } catch (error) {
    console.error('❌ Error in recommendProducts:', error);
    return [];
  }
}

/**
 * Get similar products to a given product
 * @param {string} tenantId - Tenant identifier
 * @param {string} productId - Product ID to find similar items for
 * @param {Object} options - Additional options
 * @returns {Promise<Array<Object>>} Sorted array of similar products
 */
async function getSimilarProducts(tenantId, productId, options = {}) {
  try {
    const {
      limit = 5,
      minScore = 0.2
    } = options;
    
    console.log(`🔍 Finding similar products to ${productId} for tenant: ${tenantId}`);
    
    // Load all products
    const products = await loadProductsForTenant(tenantId);
    
    // Find the target product
    const targetProduct = products.find(p => p.id === productId);
    
    if (!targetProduct) {
      console.warn(`⚠️  Product ${productId} not found`);
      return [];
    }
    
    console.log(`✅ Found target product: "${targetProduct.name}"`);
    
    // Embed target product
    const targetVec = embedProduct(targetProduct);
    
    // Compute similarity with all other products
    const otherProducts = products.filter(p => p.id !== productId);
    
    const productsWithScores = otherProducts.map(product => {
      const productVec = embedProduct(product);
      const score = computeSimilarity(targetVec, productVec);
      
      return {
        ...product,
        similarityScore: score
      };
    });
    
    // Filter and sort
    const filtered = productsWithScores.filter(p => p.similarityScore >= minScore);
    filtered.sort((a, b) => b.similarityScore - a.similarityScore);
    
    const recommendations = filtered.slice(0, limit);
    
    console.log(`✅ Found ${recommendations.length} similar products`);
    
    return recommendations;
    
  } catch (error) {
    console.error('❌ Error in getSimilarProducts:', error);
    return [];
  }
}

/**
 * Get personalized recommendations based on user history
 * @param {string} tenantId - Tenant identifier
 * @param {Array<string>} viewedProductIds - Product IDs user has viewed
 * @param {Array<string>} likedCategories - Categories user likes
 * @param {Object} options - Additional options
 * @returns {Promise<Array<Object>>} Sorted array of recommended products
 */
async function getPersonalizedRecommendations(tenantId, viewedProductIds = [], likedCategories = [], options = {}) {
  try {
    const {
      limit = 10,
      minScore = 0.15
    } = options;
    
    console.log(`🔍 Generating personalized recommendations for tenant: ${tenantId}`);
    
    // Load all products
    const products = await loadProductsForTenant(tenantId);
    
    // Build user profile from viewed products and liked categories
    const userProfile = {};
    
    // Add liked categories with high weight
    for (const category of likedCategories) {
      userProfile[category.toLowerCase()] = 2.0;
    }
    
    // Add features from viewed products
    const viewedProducts = products.filter(p => viewedProductIds.includes(p.id));
    for (const product of viewedProducts) {
      const vec = embedProduct(product);
      for (const [feature, weight] of Object.entries(vec)) {
        userProfile[feature] = (userProfile[feature] || 0) + weight;
      }
    }
    
    console.log(`✅ Built user profile with ${Object.keys(userProfile).length} features`);
    
    // Exclude already viewed products
    const candidateProducts = products.filter(p => !viewedProductIds.includes(p.id));
    
    // Compute similarity with user profile
    const productsWithScores = candidateProducts.map(product => {
      const productVec = embedProduct(product);
      const score = computeSimilarity(userProfile, productVec);
      
      return {
        ...product,
        similarityScore: score
      };
    });
    
    // Filter and sort
    const filtered = productsWithScores.filter(p => p.similarityScore >= minScore);
    filtered.sort((a, b) => b.similarityScore - a.similarityScore);
    
    const recommendations = filtered.slice(0, limit);
    
    console.log(`✅ Generated ${recommendations.length} personalized recommendations`);
    
    return recommendations;
    
  } catch (error) {
    console.error('❌ Error in getPersonalizedRecommendations:', error);
    return [];
  }
}

module.exports = {
  recommendProducts,
  getSimilarProducts,
  getPersonalizedRecommendations
};
