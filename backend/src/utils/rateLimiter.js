/**
 * Rate Limiter Utility
 * 
 * Simple in-memory sliding window rate limiter.
 * Tracks requests per key (e.g., tenant:sessionId) within a time window.
 */

// In-memory storage for rate limit buckets
const buckets = {};

// Configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 20; // max requests per key per window

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a request can proceed based on rate limits
 * 
 * @param {string} key - Unique identifier (e.g., "client1:session-123")
 * @returns {boolean} True if request is allowed, false if rate limited
 */
function canProceed(key) {
  const now = Date.now();
  
  if (!buckets[key]) {
    buckets[key] = [];
  }
  
  // Remove timestamps outside the current window
  buckets[key] = buckets[key].filter((t) => now - t < WINDOW_MS);
  
  // Check if we've exceeded the limit
  if (buckets[key].length >= MAX_REQUESTS) {
    console.log(`[rateLimiter] Rate limit exceeded for key: ${key}`);
    return false;
  }
  
  // Add current timestamp
  buckets[key].push(now);
  return true;
}

/**
 * Get remaining requests for a key
 * 
 * @param {string} key - Unique identifier
 * @returns {number} Number of remaining requests in current window
 */
function getRemainingRequests(key) {
  const now = Date.now();
  
  if (!buckets[key]) {
    return MAX_REQUESTS;
  }
  
  // Count requests in current window
  const recentRequests = buckets[key].filter((t) => now - t < WINDOW_MS).length;
  return Math.max(0, MAX_REQUESTS - recentRequests);
}

/**
 * Reset rate limit for a key (useful for testing)
 * 
 * @param {string} key - Unique identifier
 */
function resetKey(key) {
  delete buckets[key];
}

/**
 * Cleanup old entries to prevent memory leaks
 */
function cleanup() {
  const now = Date.now();
  let cleanedKeys = 0;
  
  for (const key of Object.keys(buckets)) {
    // Filter out old timestamps
    buckets[key] = buckets[key].filter((t) => now - t < WINDOW_MS);
    
    // Remove empty buckets
    if (buckets[key].length === 0) {
      delete buckets[key];
      cleanedKeys++;
    }
  }
  
  if (cleanedKeys > 0) {
    console.log(`[rateLimiter] Cleaned up ${cleanedKeys} empty buckets`);
  }
}

// Schedule periodic cleanup
setInterval(cleanup, CLEANUP_INTERVAL_MS);

module.exports = {
  canProceed,
  getRemainingRequests,
  resetKey,
  // Export config for reference
  config: {
    windowMs: WINDOW_MS,
    maxRequests: MAX_REQUESTS
  }
};
