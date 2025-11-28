/**
 * Commerce Adapter
 * 
 * Generic platform-agnostic commerce operations.
 * This adapter provides default implementations for e-commerce actions
 * that can be overridden by tenant-specific adapters.
 * 
 * In production, these functions would integrate with:
 * - Product search APIs
 * - Shopping cart services
 * - Checkout/payment gateways
 * - Order management systems
 */

const { loadProductsForTenant } = require('../utils/productLoader');

/**
 * Search for products with smart filtering
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query text (supports price filters like "under $100")
 * @param {number} [params.limit=10] - Maximum results to return
 * @param {Object} tenantConfig - Tenant configuration
 * 
 * @returns {Promise<Object>} Search results
 */
async function search(params, tenantConfig) {
  const query = params?.query || '';
  const limit = params?.limit || 10;
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';

  console.log(`[commerceAdapter.search] Executing for tenant: ${tenantId}`);
  console.log(`  Query: "${query}", Limit: ${limit}`);

  // Load actual products for tenant
  const products = await loadProductsForTenant(tenantId);
  
  // ===== SMART PRICE FILTERING =====
  // Extract price constraints from query (e.g., "under $100", "below 50", "less than ₹5000")
  const pricePatterns = [
    /(?:under|below|less than|cheaper than|max|maximum|up to|within|budget)\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /[$₹€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:or less|max|maximum|budget)/i,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:or less|and under|and below)/i
  ];
  
  let maxPrice = null;
  let minPrice = null;
  
  // Check for max price
  for (const pattern of pricePatterns) {
    const match = query.match(pattern);
    if (match) {
      maxPrice = parseFloat(match[1].replace(/,/g, ''));
      console.log(`[commerceAdapter.search] Detected max price filter: $${maxPrice}`);
      break;
    }
  }
  
  // Check for min price patterns
  const minPricePatterns = [
    /(?:over|above|more than|at least|minimum|starting|from)\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /[$₹€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:or more|minimum|and above|and up|\+)/i
  ];
  
  for (const pattern of minPricePatterns) {
    const match = query.match(pattern);
    if (match) {
      minPrice = parseFloat(match[1].replace(/,/g, ''));
      console.log(`[commerceAdapter.search] Detected min price filter: $${minPrice}`);
      break;
    }
  }
  
  // Check for price range (e.g., "$50-100", "between 50 and 100")
  const rangePatterns = [
    /[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–to]+\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /between\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*and\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
  ];
  
  for (const pattern of rangePatterns) {
    const match = query.match(pattern);
    if (match) {
      minPrice = parseFloat(match[1].replace(/,/g, ''));
      maxPrice = parseFloat(match[2].replace(/,/g, ''));
      console.log(`[commerceAdapter.search] Detected price range: $${minPrice} - $${maxPrice}`);
      break;
    }
  }
  
  // ===== CATEGORY DETECTION =====
  const categoryKeywords = {
    electronics: ['electronics', 'electronic', 'gadget', 'tech', 'device', 'headphone', 'speaker', 'camera'],
    accessories: ['accessories', 'accessory', 'watch', 'jewelry', 'bag', 'belt', 'wallet'],
    beauty: ['beauty', 'cosmetic', 'skincare', 'makeup', 'fragrance', 'perfume'],
    grocery: ['grocery', 'groceries', 'food', 'snack', 'beverage', 'drink'],
    clothing: ['clothing', 'clothes', 'shirt', 'pant', 'dress', 'jacket', 'top', 'bottom', 'apparel', 'wear', 't-shirt', 'tshirt'],
    fitness: ['fitness', 'gym', 'exercise', 'workout', 'sport', 'athletic', 'yoga'],
    footwear: ['footwear', 'shoe', 'shoes', 'sneaker', 'boot', 'sandal', 'slipper', 'loafer'],
    furniture: ['furniture', 'chair', 'table', 'desk', 'sofa', 'bed'],
    home: ['home', 'kitchen', 'decor', 'appliance', 'household']
  };
  
  const queryLower = query.toLowerCase();
  let detectedCategory = null;
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      detectedCategory = category;
      console.log(`[commerceAdapter.search] Detected category filter: ${category}`);
      break;
    }
  }
  
  // ===== COLOR DETECTION =====
  const colorKeywords = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'grey', 'brown', 'pink', 'purple', 'orange', 'navy', 'beige', 'tan', 'silver', 'gold', 'rose', 'cream', 'maroon', 'teal', 'cyan'];
  const detectedColors = colorKeywords.filter(color => queryLower.includes(color));
  if (detectedColors.length > 0) {
    console.log(`[commerceAdapter.search] Detected color filters: ${detectedColors.join(', ')}`);
  }
  
  // Remove price-related words from search terms
  const priceWords = ['under', 'below', 'above', 'over', 'less', 'more', 'than', 'budget', 'cheap', 'expensive', 'affordable', 'maximum', 'minimum', 'dollars', 'dollar', 'usd', 'rupees', 'inr'];
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const filteredQueryWords = queryWords.filter(w => !priceWords.includes(w) && !/^\$?\d+$/.test(w));
  
  // Create search variants (singular/plural forms)
  const createWordVariants = (word) => {
    const variants = [word];
    if (word.endsWith('s') && word.length > 3) {
      variants.push(word.slice(0, -1));
    }
    if (word.endsWith('es') && word.length > 4) {
      variants.push(word.slice(0, -2));
    }
    if (!word.endsWith('s')) {
      variants.push(word + 's');
    }
    return variants;
  };
  
  // Search and filter products
  const matchedProducts = products
    // Apply hard filters first
    .filter(product => {
      // Price filter
      if (maxPrice !== null && product.price > maxPrice) return false;
      if (minPrice !== null && product.price < minPrice) return false;
      
      // Category filter
      if (detectedCategory && product.category !== detectedCategory) return false;
      
      // Color filter
      if (detectedColors.length > 0) {
        const productColors = (product.colors || []).map(c => c.toLowerCase());
        const hasMatchingColor = detectedColors.some(color => 
          productColors.some(pc => pc.includes(color) || color.includes(pc))
        );
        if (!hasMatchingColor) return false;
      }
      
      return true;
    })
    .map(product => {
      let score = 0;
      const searchFields = [
        product.name || '',
        product.description || '',
        product.category || '',
        ...(product.tags || [])
      ].join(' ').toLowerCase();
      
      // Count matching words
      for (const word of filteredQueryWords) {
        const variants = createWordVariants(word);
        for (const variant of variants) {
          if (searchFields.includes(variant)) {
            score += 1;
            break;
          }
        }
      }
      
      // Bonus for exact phrase match
      if (searchFields.includes(queryLower)) score += 2;
      
      // Bonus for price relevance
      if (maxPrice !== null) {
        const priceRatio = product.price / maxPrice;
        if (priceRatio >= 0.7 && priceRatio <= 1.0) score += 0.5;
      }
      
      return { ...product, searchScore: score };
    })
    .filter(p => {
      const hasFilters = maxPrice !== null || minPrice !== null || detectedCategory || detectedColors.length > 0;
      return hasFilters ? true : p.searchScore > 0;
    })
    .sort((a, b) => b.searchScore - a.searchScore)
    .slice(0, limit)
    .map(({ searchScore, ...product }) => product);
  
  // Build informative message
  let filterInfo = [];
  if (maxPrice !== null) filterInfo.push(`under $${maxPrice}`);
  if (minPrice !== null) filterInfo.push(`over $${minPrice}`);
  if (detectedCategory) filterInfo.push(`in ${detectedCategory}`);
  if (detectedColors.length > 0) filterInfo.push(`in ${detectedColors.join('/')}`);
  
  const filterSuffix = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';
  const cleanQuery = filteredQueryWords.join(' ') || query;

  return {
    executed: true,
    handler: 'commerce.search',
    tenant: tenantId,
    params: { query, limit },
    results: matchedProducts,
    totalFound: matchedProducts.length,
    message: matchedProducts.length > 0 
      ? `Found ${matchedProducts.length} products matching "${cleanQuery}"${filterSuffix}`
      : `No products found for "${query}"${filterSuffix}. Try broadening your search.`
  };
}

/**
 * Add product to cart
 * 
 * @param {Object} params - Cart parameters
 * @param {string} params.productId - Product ID to add
 * @param {number} [params.quantity=1] - Quantity to add
 * @param {Object} tenantConfig - Tenant configuration
 * 
 * @returns {Promise<Object>} Cart update result
 */
async function addToCart(params, tenantConfig) {
  // Mock implementation - in production, would call cart service
  const productId = params?.productId;
  const quantity = params?.quantity || 1;

  console.log(`[commerceAdapter.addToCart] Executing for tenant: ${tenantConfig.tenantId}`);
  console.log(`  Product: ${productId}, Quantity: ${quantity}`);

  if (!productId) {
    throw new Error('Missing required parameter: productId');
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    executed: true,
    handler: 'commerce.addToCart',
    tenant: tenantConfig.tenantId,
    params: { productId, quantity },
    cart: {
      items: [
        {
          productId,
          quantity,
          price: 29.99,
          subtotal: 29.99 * quantity
        }
      ],
      total: 29.99 * quantity
    },
    message: `Added ${quantity}x product ${productId} to cart`
  };
}

/**
 * Process checkout
 * 
 * @param {Object} params - Checkout parameters
 * @param {string} params.cartId - Cart ID to checkout
 * @param {Object} params.paymentMethod - Payment details
 * @param {Object} tenantConfig - Tenant configuration
 * 
 * @returns {Promise<Object>} Checkout result
 */
async function checkout(params, tenantConfig) {
  // Mock implementation - in production, would process payment
  const cartId = params?.cartId;
  const paymentMethod = params?.paymentMethod || 'default';

  console.log(`[commerceAdapter.checkout] Executing for tenant: ${tenantConfig.tenantId}`);
  console.log(`  Cart: ${cartId}, Payment: ${paymentMethod}`);

  if (!cartId) {
    throw new Error('Missing required parameter: cartId');
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 150));

  return {
    executed: true,
    handler: 'commerce.checkout',
    tenant: tenantConfig.tenantId,
    params: { cartId, paymentMethod },
    order: {
      orderId: `ORD-${Date.now()}`,
      status: 'confirmed',
      total: 89.97,
      paymentStatus: 'paid'
    },
    message: `Order created successfully for cart ${cartId}`
  };
}

/**
 * Get product recommendations
 * 
 * @param {Object} params - Recommendation parameters
 * @param {string} [params.userId] - User ID for personalized recommendations
 * @param {number} [params.limit=5] - Number of recommendations
 * @param {Object} tenantConfig - Tenant configuration
 * 
 * @returns {Promise<Object>} Recommendations
 */
async function recommend(params, tenantConfig) {
  const userId = params?.userId;
  const limit = params?.limit || 5;

  console.log(`[commerceAdapter.recommend] Executing for tenant: ${tenantConfig.tenantId}`);
  console.log(`  User: ${userId}, Limit: ${limit}`);

  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    executed: true,
    handler: 'commerce.recommend',
    tenant: tenantConfig.tenantId,
    params: { userId, limit },
    recommendations: [
      { id: 'rec-001', name: 'Recommended Product 1', score: 0.95 },
      { id: 'rec-002', name: 'Recommended Product 2', score: 0.87 }
    ],
    message: `Generated ${2} recommendations`
  };
}

module.exports = {
  search,
  addToCart,
  checkout,
  recommend
};
