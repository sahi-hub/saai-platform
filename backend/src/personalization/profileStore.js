/**
 * Profile Store - In-Memory User Preference Storage
 * 
 * Stores user preference profiles keyed by (tenantId, sessionId).
 * Profiles track liked categories, colors, tags, and recent interactions.
 * 
 * This is an in-memory implementation - data is lost on restart.
 * Can be extended to persist to Redis/DB later.
 */

// In-memory profiles: profiles[tenantId][sessionId] = { ...profile }
const profiles = {};

/**
 * Get or create a profile for a tenant/session combination
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionId - Session identifier
 * @returns {Object} User profile with preferences
 */
function getOrCreateProfile(tenantId = 'default', sessionId = 'anon') {
  const tId = tenantId || 'default';
  const sId = sessionId || 'anon';

  if (!profiles[tId]) {
    profiles[tId] = {};
  }

  if (!profiles[tId][sId]) {
    profiles[tId][sId] = {
      likedCategories: {},  // { "shirt": score, "shoes": score }
      likedColors: {},      // { "white": score, "navy": score }
      likedTags: {},        // { "casual": score, "eid": score }
      interactionCount: 0,
      recentProductIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return profiles[tId][sId];
}

/**
 * Save/update a profile for a tenant/session combination
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {string} sessionId - Session identifier
 * @param {Object} profile - Profile data to save
 */
function saveProfile(tenantId, sessionId, profile) {
  const tId = tenantId || 'default';
  const sId = sessionId || 'anon';

  if (!profiles[tId]) {
    profiles[tId] = {};
  }

  profile.updatedAt = new Date().toISOString();
  profiles[tId][sId] = profile;
}

/**
 * Get all profiles for debugging purposes
 * 
 * @returns {Object} All profiles organized by tenant/session
 */
function getProfilesDebug() {
  return profiles;
}

/**
 * Clear all profiles (useful for testing)
 */
function clearAllProfiles() {
  for (const key of Object.keys(profiles)) {
    delete profiles[key];
  }
}

/**
 * Get profile count statistics
 * 
 * @returns {Object} Stats about stored profiles
 */
function getProfileStats() {
  let totalProfiles = 0;
  const byTenant = {};

  for (const tenantId of Object.keys(profiles)) {
    const sessionCount = Object.keys(profiles[tenantId]).length;
    byTenant[tenantId] = sessionCount;
    totalProfiles += sessionCount;
  }

  return {
    totalProfiles,
    byTenant,
    tenantCount: Object.keys(profiles).length
  };
}

module.exports = {
  getOrCreateProfile,
  saveProfile,
  getProfilesDebug,
  clearAllProfiles,
  getProfileStats
};
