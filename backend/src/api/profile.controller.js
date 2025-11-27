/**
 * Profile Controller - Debug endpoints for user preference profiles
 * 
 * These endpoints are for development/debugging only.
 * Should be disabled or protected in production.
 */

const { getProfilesDebug, getProfileStats, getOrCreateProfile, clearAllProfiles } = require('../personalization/profileStore');
const { buildProfileSummary } = require('../personalization/profileUpdater');

/**
 * Get all profiles (debug endpoint)
 * 
 * GET /debug/profiles
 */
function getProfiles(req, res) {
  const stats = getProfileStats();
  const profiles = getProfilesDebug();

  res.json({
    success: true,
    stats,
    profiles
  });
}

/**
 * Get a specific profile
 * 
 * GET /debug/profiles/:tenantId/:sessionId
 */
function getProfile(req, res) {
  const { tenantId, sessionId } = req.params;

  if (!tenantId || !sessionId) {
    return res.status(400).json({
      success: false,
      error: 'tenantId and sessionId are required'
    });
  }

  const profile = getOrCreateProfile(tenantId, sessionId);
  const summary = buildProfileSummary(profile);

  res.json({
    success: true,
    tenantId,
    sessionId,
    profile,
    summary: summary ? JSON.parse(summary) : null
  });
}

/**
 * Clear all profiles (debug endpoint)
 * 
 * DELETE /debug/profiles
 */
function clearProfiles(req, res) {
  clearAllProfiles();

  res.json({
    success: true,
    message: 'All profiles cleared'
  });
}

module.exports = {
  getProfiles,
  getProfile,
  clearProfiles
};
