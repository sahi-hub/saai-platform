/**
 * Outfit Recommender
 * 
 * Recommends complete outfits (shirt + pant + shoe) based on user query and preferences.
 * Uses vector embeddings and cosine similarity to match products across categories.
 */

const { loadProductsForTenant } = require('../utils/productLoader');
const { embedProduct, embedQuery } = require('./productEmbedding');
const { computeSimilarity } = require('./similarity');

/**
 * Recommend a complete outfit (shirt, pant, shoe)
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} query - User query describing desired outfit
 * @param {string[]} preferences - Optional user preferences (colors, styles, etc.)
 * @returns {Promise<Object>} Outfit with shirt, pant, and shoe
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

    // Embed all products
    const embeddedProducts = products.map(product => ({
      ...product,
      embedding: embedProduct(product)
    }));

    // Filter products by category
    const shirts = embeddedProducts.filter(p => 
      p.category && p.category.toLowerCase().includes('shirt')
    );
    
    const pants = embeddedProducts.filter(p => 
      p.category && (
        p.category.toLowerCase().includes('pant') ||
        p.category.toLowerCase().includes('trouser')
      )
    );
    
    const shoes = embeddedProducts.filter(p => 
      p.category && (
        p.category.toLowerCase().includes('shoe') ||
        p.category.toLowerCase().includes('footwear')
      )
    );

    // Compute similarities and pick top item per category
    const outfit = {};

    // Find best shirt
    if (shirts.length > 0) {
      const shirtScores = shirts.map(shirt => ({
        product: shirt,
        score: computeSimilarity(queryVector, shirt.embedding)
      }));
      
      // Sort by score descending
      shirtScores.sort((a, b) => b.score - a.score);
      
      // Pick top shirt
      const topShirt = shirtScores[0].product;
      outfit.shirt = {
        id: topShirt.id,
        name: topShirt.name,
        category: topShirt.category,
        price: topShirt.price,
        currency: topShirt.currency,
        imageUrl: topShirt.imageUrl,
        tags: topShirt.tags,
        colors: topShirt.colors,
        _score: shirtScores[0].score
      };
    }

    // Find best pant
    if (pants.length > 0) {
      const pantScores = pants.map(pant => ({
        product: pant,
        score: computeSimilarity(queryVector, pant.embedding)
      }));
      
      pantScores.sort((a, b) => b.score - a.score);
      
      const topPant = pantScores[0].product;
      outfit.pant = {
        id: topPant.id,
        name: topPant.name,
        category: topPant.category,
        price: topPant.price,
        currency: topPant.currency,
        imageUrl: topPant.imageUrl,
        tags: topPant.tags,
        colors: topPant.colors,
        _score: pantScores[0].score
      };
    }

    // Find best shoe
    if (shoes.length > 0) {
      const shoeScores = shoes.map(shoe => ({
        product: shoe,
        score: computeSimilarity(queryVector, shoe.embedding)
      }));
      
      shoeScores.sort((a, b) => b.score - a.score);
      
      const topShoe = shoeScores[0].product;
      outfit.shoe = {
        id: topShoe.id,
        name: topShoe.name,
        category: topShoe.category,
        price: topShoe.price,
        currency: topShoe.currency,
        imageUrl: topShoe.imageUrl,
        tags: topShoe.tags,
        colors: topShoe.colors,
        _score: shoeScores[0].score
      };
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
  recommendOutfit
};
