/**
 * Product Embedding Module
 * Converts product objects into feature vectors for similarity computation
 * Uses category, tags, colors, and tokenized product names
 */

/**
 * Tokenize a text string into words
 * @param {string} text - Text to tokenize
 * @returns {Array<string>} Array of lowercase tokens
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with space
    .split(/\s+/)
    .filter(token => token.length > 2); // Filter out very short tokens
}

/**
 * Convert a product into a feature vector
 * @param {Object} product - Product object with category, tags, colors, name
 * @returns {Object} Feature vector as key-value pairs (feature -> weight)
 */
function embedProduct(product) {
  if (!product || typeof product !== 'object') {
    console.warn('⚠️  Invalid product for embedding');
    return {};
  }
  
  const vector = {};
  
  // Add category as a feature
  if (product.category) {
    const categoryToken = product.category.toLowerCase().trim();
    if (categoryToken) {
      vector[categoryToken] = 1;
    }
  }
  
  // Add tags as features
  if (Array.isArray(product.tags)) {
    product.tags.forEach(tag => {
      if (tag && typeof tag === 'string') {
        const tagToken = tag.toLowerCase().trim();
        if (tagToken) {
          vector[tagToken] = 1;
        }
      }
    });
  }
  
  // Add colors as features
  if (Array.isArray(product.colors)) {
    product.colors.forEach(color => {
      if (color && typeof color === 'string') {
        const colorToken = color.toLowerCase().trim();
        if (colorToken) {
          vector[colorToken] = 1;
        }
      }
    });
  }
  
  // Add tokenized product name as features
  if (product.name) {
    const nameTokens = tokenize(product.name);
    nameTokens.forEach(token => {
      if (token) {
        vector[token] = 1;
      }
    });
  }
  
  return vector;
}

/**
 * Create a query vector from search query and preferences
 * @param {string} query - Search query string
 * @param {Array<string>} preferences - Array of preference keywords
 * @returns {Object} Feature vector as key-value pairs
 */
function embedQuery(query, preferences = []) {
  const vector = {};
  
  // Tokenize and add query terms
  if (query && typeof query === 'string') {
    const queryTokens = tokenize(query);
    queryTokens.forEach(token => {
      if (token) {
        vector[token] = 1;
      }
    });
  }
  
  // Add preferences as features (with slightly higher weight)
  if (Array.isArray(preferences)) {
    preferences.forEach(pref => {
      if (pref && typeof pref === 'string') {
        const prefToken = pref.toLowerCase().trim();
        if (prefToken) {
          // Give preferences slightly higher weight (1.5)
          vector[prefToken] = 1.5;
        }
      }
    });
  }
  
  return vector;
}

/**
 * Get all unique features from a vector
 * @param {Object} vector - Feature vector
 * @returns {Array<string>} Array of feature keys
 */
function getFeatures(vector) {
  if (!vector || typeof vector !== 'object') {
    return [];
  }
  return Object.keys(vector);
}

/**
 * Get the magnitude (L2 norm) of a vector
 * @param {Object} vector - Feature vector
 * @returns {number} Vector magnitude
 */
function getMagnitude(vector) {
  if (!vector || typeof vector !== 'object') {
    return 0;
  }
  
  const values = Object.values(vector);
  const sumOfSquares = values.reduce((sum, val) => sum + (val * val), 0);
  return Math.sqrt(sumOfSquares);
}

module.exports = {
  embedProduct,
  embedQuery,
  tokenize,
  getFeatures,
  getMagnitude
};
