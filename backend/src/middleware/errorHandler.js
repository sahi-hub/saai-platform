/**
 * Global Error Handler Middleware
 * 
 * Centralized error handling for the SAAI backend.
 * Handles different error types with appropriate HTTP status codes.
 * 
 * Error Categories:
 * - 404: Tenant not found, resource not found
 * - 403: CORS policy violations
 * - 429: Rate limit exceeded
 * - 500: Internal server errors
 */

/**
 * Global error handler middleware
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
  // Log the error for debugging
  console.error('Error caught by global handler:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle tenant not found errors (404)
  if (err.message && err.message.includes('Tenant not found')) {
    return res.status(404).json({
      success: false,
      error: 'Tenant not found'
    });
  }

  // Handle CORS policy violations (403)
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation: Origin not allowed'
    });
  }

  // Handle rate limit errors (429)
  if (err.message && err.message.includes('Too many requests')) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    });
  }

  // Handle validation errors (400)
  if (err.message && (err.message.includes('required') || err.message.includes('invalid'))) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Default to 500 Internal Server Error
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : err.message || 'Server error'
  });
}

module.exports = { errorHandler };
