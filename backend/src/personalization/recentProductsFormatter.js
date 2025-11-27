/**
 * Recent Products Formatter
 * 
 * Formats recently matched products into indexed context for the AI
 * to enable conversational references like "the second one", "cheaper option", etc.
 */

/**
 * Build a formatted context string of recent products with indices
 * 
 * This enables the AI to resolve references like:
 * - "the first one", "the second one", "the third one"
 * - "a cheaper option" (compare prices)
 * - "similar to the previous one" (use category/tags)
 * 
 * @param {Array} products - Full product catalog
 * @param {Array} matchedProductIds - IDs of products that were last matched
 * @returns {string} Formatted context string, or empty string if no matches
 */
function buildRecentProductsContext(products, matchedProductIds) {
  if (!Array.isArray(products) || products.length === 0) {
    return '';
  }

  if (!Array.isArray(matchedProductIds) || matchedProductIds.length === 0) {
    return '';
  }

  // Preserve the order from matchedProductIds for consistent indexing
  const matched = [];
  for (const id of matchedProductIds) {
    const product = products.find((p) => p.id === id);
    if (product) {
      matched.push(product);
    }
  }

  if (matched.length === 0) {
    return '';
  }

  // Build the context using array join for efficiency
  const headerLines = [
    '=== RECENT PRODUCTS SHOWN TO USER (indexed list) ===',
    'Use this list to resolve ordinal references like "the first", "the second", etc.',
    ''
  ];

  // Limit to 10 products max
  const displayProducts = matched.slice(0, 10);
  const productLines = [];

  for (const [index, p] of displayProducts.entries()) {
    const idx = index + 1;
    const price = p.price || 0;
    const currency = p.currency || 'INR';
    const category = p.category || 'unknown';
    const tags = Array.isArray(p.tags) ? p.tags.join(', ') : '';
    const colors = Array.isArray(p.colors) ? p.colors.join(', ') : '';

    const productInfo = [
      `${idx}. ID: ${p.id}`,
      `   Name: ${p.name}`,
      `   Category: ${category}`,
      `   Price: ${price} ${currency}`
    ];

    if (colors) {
      productInfo.push(`   Colors: ${colors}`);
    }
    if (tags) {
      productInfo.push(`   Tags: ${tags}`);
    }

    productLines.push(productInfo.join('\n'), '');
  }

  const ruleLines = [
    '=== REFERENCE RESOLUTION RULES ===',
    '- "the first one", "first" → Index 1 in the list above',
    '- "the second one", "second" → Index 2 in the list above',
    '- "the third one", "third" → Index 3 in the list above',
    '- "a cheaper option", "cheapest" → Find products with LOWER price than shown, same/similar category',
    '- "more expensive", "premium" → Find products with HIGHER price, same/similar category',
    '- "similar to that one", "like the second one" → Find products with similar category/tags',
    '- "replace the shirt with X" → Output NEW product IDs matching X, not the old ones',
    '- "within my budget of X" → Filter to products under price X',
    '=== END REFERENCE RULES ==='
  ];

  return [...headerLines, ...productLines, ...ruleLines].join('\n');
}

/**
 * Extract the referenced product from a user message using ordinal parsing
 * 
 * @param {string} message - User message
 * @param {Array} recentProducts - Recently shown products in order
 * @returns {Object|null} The referenced product or null
 */
function extractReferencedProduct(message, recentProducts) {
  if (!message || !Array.isArray(recentProducts) || recentProducts.length === 0) {
    return null;
  }

  const lowerMessage = message.toLowerCase();

  // Ordinal patterns
  const ordinalPatterns = [
    { pattern: /\b(first|1st)\b/, index: 0 },
    { pattern: /\b(second|2nd)\b/, index: 1 },
    { pattern: /\b(third|3rd)\b/, index: 2 },
    { pattern: /\b(fourth|4th)\b/, index: 3 },
    { pattern: /\b(fifth|5th)\b/, index: 4 },
    { pattern: /\b(sixth|6th)\b/, index: 5 },
    { pattern: /\b(seventh|7th)\b/, index: 6 },
    { pattern: /\b(eighth|8th)\b/, index: 7 },
    { pattern: /\b(ninth|9th)\b/, index: 8 },
    { pattern: /\b(tenth|10th)\b/, index: 9 }
  ];

  for (const { pattern, index } of ordinalPatterns) {
    if (pattern.test(lowerMessage) && index < recentProducts.length) {
      return recentProducts[index];
    }
  }

  // Check for "that one", "this one", "it" - default to first product
  if (/\b(that\s+one|this\s+one|it)\b/.test(lowerMessage) && recentProducts.length > 0) {
    return recentProducts[0];
  }

  return null;
}

/**
 * Check if user is asking for a cheaper option
 * 
 * @param {string} message - User message
 * @returns {boolean} True if asking for cheaper
 */
function isAskingForCheaper(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return /\b(cheaper|cheapest|less expensive|lower price|budget|affordable|within.*budget)\b/.test(lower);
}

/**
 * Check if user is asking for a more expensive option
 * 
 * @param {string} message - User message
 * @returns {boolean} True if asking for more expensive
 */
function isAskingForExpensive(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return /\b(expensive|premium|luxury|high.?end|more expensive|pricier)\b/.test(lower);
}

/**
 * Check if user is asking for something similar
 * 
 * @param {string} message - User message
 * @returns {boolean} True if asking for similar
 */
function isAskingForSimilar(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return /\b(similar|like that|like this|same style|more like|alternatives?)\b/.test(lower);
}

module.exports = {
  buildRecentProductsContext,
  extractReferencedProduct,
  isAskingForCheaper,
  isAskingForExpensive,
  isAskingForSimilar
};
