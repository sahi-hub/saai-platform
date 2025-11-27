/**
 * Profile Updater - Learn User Preferences from Product Interactions
 * 
 * Updates user profiles based on products that were matched/recommended.
 * Builds profile summaries for injection into AI prompts.
 */

const { getOrCreateProfile, saveProfile } = require('./profileStore');

/**
 * Increment a counter in a map (used for tracking preferences)
 * 
 * @param {Object} map - The map to update
 * @param {string} key - The key to increment
 * @param {number} amount - Amount to increment by (default: 1)
 */
function incrementMapCounter(map, key, amount = 1) {
  if (!key) return;
  const k = key.toLowerCase().trim();
  if (k.length === 0) return;
  map[k] = (map[k] || 0) + amount;
}

/**
 * Update user profile based on products that were matched/recommended
 * 
 * This learns user preferences by:
 * - Incrementing category scores for matched product categories
 * - Incrementing color scores for matched product colors
 * - Incrementing tag scores for matched product tags
 * 
 * @param {Object} options
 * @param {string} options.tenantId - Tenant identifier
 * @param {string} options.sessionId - Session identifier
 * @param {Array} options.products - Full product catalog
 * @param {Array} options.matchedProductIds - IDs of products that were matched
 */
function updateProfileFromProducts({ tenantId, sessionId, products, matchedProductIds }) {
  if (!Array.isArray(products) || !Array.isArray(matchedProductIds)) {
    return;
  }

  if (matchedProductIds.length === 0) {
    return;
  }

  const profile = getOrCreateProfile(tenantId, sessionId);
  const idSet = new Set(matchedProductIds);

  // Find the actual product objects for matched IDs
  const matchedProducts = products.filter((p) => idSet.has(p.id));

  console.log(`[ProfileUpdater] Updating profile for ${tenantId}/${sessionId} with ${matchedProducts.length} matched products`);

  for (const p of matchedProducts) {
    // Learn category preference (weight: 2)
    if (p.category) {
      incrementMapCounter(profile.likedCategories, p.category, 2);
    }

    // Learn color preferences (weight: 1)
    if (Array.isArray(p.colors)) {
      for (const c of p.colors) {
        incrementMapCounter(profile.likedColors, c, 1);
      }
    }

    // Learn tag preferences (weight: 1)
    if (Array.isArray(p.tags)) {
      for (const tag of p.tags) {
        incrementMapCounter(profile.likedTags, tag, 1);
      }
    }
  }

  // Update interaction count
  profile.interactionCount += 1;

  // Keep track of recent product IDs (last 10)
  const newRecent = [...profile.recentProductIds, ...matchedProductIds];
  profile.recentProductIds = newRecent.slice(-10);

  saveProfile(tenantId, sessionId, profile);

  console.log(`[ProfileUpdater] Profile updated: ${profile.interactionCount} interactions, ${Object.keys(profile.likedColors).length} color preferences`);
}

/**
 * Build a summary string of user preferences for injection into AI prompts
 * 
 * @param {Object} profile - User profile object
 * @returns {string} JSON string of top preferences, or empty string if no preferences
 */
function buildProfileSummary(profile) {
  if (!profile) return '';

  // Get top 3 categories by score
  const topCategories = Object.entries(profile.likedCategories || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  // Get top 3 colors by score
  const topColors = Object.entries(profile.likedColors || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  // Get top 5 tags by score
  const topTags = Object.entries(profile.likedTags || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  // If no meaningful preferences yet, return empty
  if (topCategories.length === 0 && topColors.length === 0 && topTags.length === 0) {
    return '';
  }

  const summary = {
    preferredCategories: topCategories,
    preferredColors: topColors,
    preferredTags: topTags,
    interactionCount: profile.interactionCount || 0
  };

  return JSON.stringify(summary);
}

/**
 * Get a human-readable description of preferences
 * Used for generating natural language preference hints
 * 
 * @param {Object} profile - User profile object
 * @returns {string} Human readable preference description
 */
function getPreferenceHint(profile) {
  if (!profile || profile.interactionCount < 2) {
    return '';
  }

  const topColors = Object.entries(profile.likedColors || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);

  const topCategories = Object.entries(profile.likedCategories || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k);

  const parts = [];

  if (topColors.length > 0) {
    parts.push(`colors like ${topColors.join(' and ')}`);
  }

  if (topCategories.length > 0) {
    parts.push(`${topCategories.join(' and ')}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `The user seems to like ${parts.join(', ')}.`;
}

module.exports = {
  updateProfileFromProducts,
  buildProfileSummary,
  getPreferenceHint,
  incrementMapCounter // exported for testing
};
