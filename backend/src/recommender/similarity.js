/**
 * Vector Similarity Module
 * Computes similarity between feature vectors using cosine-like similarity
 */

/**
 * Compute cosine-like similarity between two feature vectors
 * Uses the formula: similarity = (# overlapping features) / sqrt(|A| * |B|)
 * This approximates cosine similarity without full numeric computation
 * 
 * @param {Object} vecA - First feature vector
 * @param {Object} vecB - Second feature vector
 * @returns {number} Similarity score between 0 and 1
 */
function computeSimilarity(vecA, vecB) {
  // Handle invalid inputs
  if (!vecA || !vecB || typeof vecA !== 'object' || typeof vecB !== 'object') {
    return 0;
  }
  
  const keysA = Object.keys(vecA);
  const keysB = Object.keys(vecB);
  
  // Handle empty vectors
  if (keysA.length === 0 || keysB.length === 0) {
    return 0;
  }
  
  // Count overlapping features
  let overlapping = 0;
  for (const key of keysA) {
    if (key in vecB) {
      // Weight by the product of their values
      overlapping += vecA[key] * vecB[key];
    }
  }
  
  // If no overlap, return 0
  if (overlapping === 0) {
    return 0;
  }
  
  // Compute magnitudes (L2 norm)
  const magnitudeA = Math.sqrt(keysA.reduce((sum, key) => sum + (vecA[key] * vecA[key]), 0));
  const magnitudeB = Math.sqrt(keysB.reduce((sum, key) => sum + (vecB[key] * vecB[key]), 0));
  
  // Prevent division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  // Compute cosine similarity
  const similarity = overlapping / (magnitudeA * magnitudeB);
  
  // Clamp to [0, 1] range
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Compute Jaccard similarity between two feature vectors
 * Alternative similarity metric: |A ∩ B| / |A ∪ B|
 * 
 * @param {Object} vecA - First feature vector
 * @param {Object} vecB - Second feature vector
 * @returns {number} Jaccard similarity score between 0 and 1
 */
function computeJaccardSimilarity(vecA, vecB) {
  if (!vecA || !vecB || typeof vecA !== 'object' || typeof vecB !== 'object') {
    return 0;
  }
  
  const keysA = new Set(Object.keys(vecA));
  const keysB = new Set(Object.keys(vecB));
  
  if (keysA.size === 0 && keysB.size === 0) {
    return 0;
  }
  
  // Intersection: features in both
  const intersection = new Set([...keysA].filter(key => keysB.has(key)));
  
  // Union: features in either
  const union = new Set([...keysA, ...keysB]);
  
  if (union.size === 0) {
    return 0;
  }
  
  return intersection.size / union.size;
}

/**
 * Rank items by similarity to a query vector
 * @param {Object} queryVec - Query feature vector
 * @param {Array<Object>} items - Array of items with embedded vectors
 * @param {Function} similarityFn - Similarity function to use
 * @returns {Array<Object>} Sorted array of items with similarity scores
 */
function rankBySimilarity(queryVec, items, similarityFn = computeSimilarity) {
  if (!queryVec || !Array.isArray(items)) {
    return [];
  }
  
  // Compute similarity for each item
  const itemsWithScores = items.map(item => {
    const score = similarityFn(queryVec, item.vector);
    return {
      ...item,
      similarityScore: score
    };
  });
  
  // Sort by similarity (descending)
  itemsWithScores.sort((a, b) => b.similarityScore - a.similarityScore);
  
  return itemsWithScores;
}

module.exports = {
  computeSimilarity,
  computeJaccardSimilarity,
  rankBySimilarity
};
