/**
 * Outfit Recommender
 * 
 * Recommends complete outfits (top + bottom + shoe) based on user query and preferences.
 * Uses vector embeddings and cosine similarity to match products across categories.
 * 
 * Handles both specific categories (shirt, pant, shoe) and generic ones (clothing, footwear)
 * by analyzing tags and product names.
 */

const { loadProductsForTenant } = require('../utils/productLoader');
const { embedProduct, embedQuery } = require('./productEmbedding');
const { computeSimilarity } = require('./similarity');

/**
 * Classify a product as top, bottom, or shoes based on category, tags, and name
 * @param {Object} product - Product object
 * @returns {'top'|'bottom'|'shoes'|null} Classification or null if not clothing
 */
function classifyClothingType(product) {
  const category = (product.category || '').toLowerCase();
  const tags = (product.tags || []).map(t => t.toLowerCase());
  const name = (product.name || '').toLowerCase();
  
  // Combine all text for matching
  const allText = `${category} ${tags.join(' ')} ${name}`;
  
  // EXCLUSION patterns - items that are NOT clothing
  const excludePatterns = [
    'backpack', 'bag', 'laptop', 'phone', 'watch', 'headphone', 'earbuds',
    'speaker', 'keyboard', 'mouse', 'monitor', 'charger', 'cable',
    'yoga mat', 'band', 'dumbbell', 'protein', 'supplement',
    'serum', 'cream', 'moisturizer', 'lipstick', 'mascara'
  ];
  
  for (const pattern of excludePatterns) {
    if (allText.includes(pattern)) {
      return null; // Not clothing
    }
  }
  
  // Only consider items in clothing/footwear categories or generic categories
  const clothingCategories = ['clothing', 'footwear', 'shirt', 'pant', 'shoe', 'top', 'bottom', 'fashion'];
  const isClothingCategory = clothingCategories.some(cat => category.includes(cat));
  
  if (!isClothingCategory && category !== '') {
    return null; // Not a clothing category
  }
  
  // TOP patterns: shirts, t-shirts, polos, hoodies, jackets, blouses, tops, sweaters
  const topPatterns = [
    'shirt', 't-shirt', 'tshirt', 'polo', 'hoodie', 'jacket', 'blouse', 
    'top', 'sweater', 'pullover', 'cardigan', 'vest', 'blazer', 'kurta',
    'tunic', 'crop top', 'tank'
  ];
  
  // BOTTOM patterns: pants, jeans, trousers, shorts, skirts, leggings
  const bottomPatterns = [
    'pant', 'jeans', 'trouser', 'chino', 'shorts', 'skirt', 'legging',
    'jogger', 'cargo', 'slacks', 'culottes', 'palazzos', 'capris'
  ];
  
  // SHOES patterns: shoes, sneakers, boots, sandals, footwear, loafers
  const shoePatterns = [
    'shoe', 'sneaker', 'boot', 'sandal', 'footwear', 'loafer', 'oxford',
    'heel', 'flat', 'slipper', 'moccasin', 'trainer', 'runner'
  ];
  
  // Check for tops
  for (const pattern of topPatterns) {
    if (allText.includes(pattern)) {
      return 'top';
    }
  }
  
  // Check for bottoms
  for (const pattern of bottomPatterns) {
    if (allText.includes(pattern)) {
      return 'bottom';
    }
  }
  
  // Check for shoes
  for (const pattern of shoePatterns) {
    if (allText.includes(pattern)) {
      return 'shoes';
    }
  }
  
  // Also handle explicit categories
  if (category === 'footwear') return 'shoes';
  if (category === 'shirt' || category === 'top') return 'top';
  if (category === 'pant' || category === 'bottom') return 'bottom';
  
  return null;
}

/**
 * Recommend a complete outfit (top, bottom, shoes)
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} query - User query describing desired outfit
 * @param {string[]} preferences - Optional user preferences (colors, styles, etc.)
 * @returns {Promise<Object>} Outfit with top, bottom, and shoes
 * 
 * @example
 * const outfit = await recommendOutfit('client1', 'formal eid outfit', ['white', 'elegant']);
 * // Returns: { shirt: {...}, pant: {...}, shoe: {...} }
 */
async function recommendOutfit(tenantId, query = '', preferences = []) {
  try {
    // Load all products for tenant
    const products = await loadProductsForTenant(tenantId);
    
    if (!products || products.length === 0) {
      console.warn(`[OutfitRecommender] No products found for tenant: ${tenantId}`);
      return {};
    }

    // Build query vector from query text and preferences
    const queryVector = embedQuery(query, preferences);

    // Embed all products and classify them
    const embeddedProducts = products.map(product => ({
      ...product,
      embedding: embedProduct(product),
      clothingType: classifyClothingType(product)
    }));

    // Filter products by clothing type
    const tops = embeddedProducts.filter(p => p.clothingType === 'top');
    const bottoms = embeddedProducts.filter(p => p.clothingType === 'bottom');
    const shoes = embeddedProducts.filter(p => p.clothingType === 'shoes');
    
    console.log(`[OutfitRecommender] Found ${tops.length} tops, ${bottoms.length} bottoms, ${shoes.length} shoes`);

    // Compute similarities and pick top item per category
    const outfit = {};

    // Find best top (shirt)
    if (tops.length > 0) {
      const topScores = tops.map(top => ({
        product: top,
        score: computeSimilarity(queryVector, top.embedding)
      }));
      
      // Sort by score descending
      topScores.sort((a, b) => b.score - a.score);
      
      // Pick top item
      const topItem = topScores[0].product;
      outfit.shirt = {
        id: topItem.id,
        name: topItem.name,
        category: topItem.category,
        price: topItem.price,
        currency: topItem.currency,
        imageUrl: topItem.imageUrl,
        tags: topItem.tags,
        colors: topItem.colors,
        _score: topScores[0].score
      };
      console.log(`[OutfitRecommender] Selected top: ${topItem.name} (score: ${topScores[0].score.toFixed(3)})`);
    } else {
      console.log(`[OutfitRecommender] No tops found in catalog`);
    }

    // Find best bottom (pant)
    if (bottoms.length > 0) {
      const bottomScores = bottoms.map(bottom => ({
        product: bottom,
        score: computeSimilarity(queryVector, bottom.embedding)
      }));
      
      bottomScores.sort((a, b) => b.score - a.score);
      
      const bottomItem = bottomScores[0].product;
      outfit.pant = {
        id: bottomItem.id,
        name: bottomItem.name,
        category: bottomItem.category,
        price: bottomItem.price,
        currency: bottomItem.currency,
        imageUrl: bottomItem.imageUrl,
        tags: bottomItem.tags,
        colors: bottomItem.colors,
        _score: bottomScores[0].score
      };
      console.log(`[OutfitRecommender] Selected bottom: ${bottomItem.name} (score: ${bottomScores[0].score.toFixed(3)})`);
    } else {
      console.log(`[OutfitRecommender] No bottoms found in catalog`);
    }

    // Find best shoes
    if (shoes.length > 0) {
      const shoeScores = shoes.map(shoe => ({
        product: shoe,
        score: computeSimilarity(queryVector, shoe.embedding)
      }));
      
      shoeScores.sort((a, b) => b.score - a.score);
      
      const shoeItem = shoeScores[0].product;
      outfit.shoe = {
        id: shoeItem.id,
        name: shoeItem.name,
        category: shoeItem.category,
        price: shoeItem.price,
        currency: shoeItem.currency,
        imageUrl: shoeItem.imageUrl,
        tags: shoeItem.tags,
        colors: shoeItem.colors,
        _score: shoeScores[0].score
      };
      console.log(`[OutfitRecommender] Selected shoes: ${shoeItem.name} (score: ${shoeScores[0].score.toFixed(3)})`);
    } else {
      console.log(`[OutfitRecommender] No shoes found in catalog`);
    }

    // Log outfit recommendation
    const categories = Object.keys(outfit);
    console.log(`[OutfitRecommender] Recommended outfit with ${categories.length} items: ${categories.join(', ')}`);

    return outfit;

  } catch (error) {
    console.error('[OutfitRecommender] Error recommending outfit:', error.message);
    throw error;
  }
}

module.exports = {
  recommendOutfit,
  classifyClothingType
};
