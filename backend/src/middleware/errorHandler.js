/**
 * Global Error Handler Middleware - REFACTORED
 * 
 * Centralized error handling for the SAAI backend.
 * 
 * CRITICAL CHANGE: Always returns HTTP 200 with success: false
 * This prevents UI freezes and ensures the frontend always gets a valid JSON response.
 * 
 * Error types are communicated via the 'type' field in the response body.
 */

/**
 * Global error handler middleware
 * 
 * ALWAYS returns HTTP 200 with { success: false, type: string, message: string }
 * This ensures UI never hangs waiting for a response that won't render properly.
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

  // Build error response - ALWAYS success: false
  const errorResponse = {
    success: false,
    message: err.message || 'An unexpected error occurred',
    type: 'error'
  };

  // Classify error type for frontend handling
  if (err.message) {
    const msg = err.message.toLowerCase();
    
    if (msg.includes('tenant not found') || msg.includes('tenant') && msg.includes('not found')) {
      errorResponse.type = 'tenant_not_found';
      errorResponse.message = 'The requested tenant could not be found. Using default configuration.';
    } else if (msg.includes('cors')) {
      errorResponse.type = 'cors_error';
      errorResponse.message = 'Cross-origin request blocked. Please check your configuration.';
    } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
      errorResponse.type = 'rate_limit';
      errorResponse.message = 'Too many requests. Please wait a moment and try again.';
    } else if (msg.includes('required') || msg.includes('invalid') || msg.includes('missing')) {
      errorResponse.type = 'validation_error';
    } else if (msg.includes('timeout') || msg.includes('timed out')) {
      errorResponse.type = 'timeout';
      errorResponse.message = 'The request took too long. Please try again.';
    } else if (msg.includes('unauthorized') || msg.includes('authentication')) {
      errorResponse.type = 'auth_error';
      errorResponse.message = 'Authentication required.';
    } else if (msg.includes('forbidden') || msg.includes('permission')) {
      errorResponse.type = 'permission_error';
      errorResponse.message = 'You do not have permission to perform this action.';
    } else {
      errorResponse.type = 'internal_error';
      // In production, don't expose internal error details
      if (process.env.NODE_ENV === 'production') {
        errorResponse.message = 'Something went wrong. Please try again.';
      }
    }
  }

  // Add debug info in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.debug = {
      stack: err.stack,
      path: req.path,
      method: req.method
    };
  }

  // ALWAYS return 200 - frontend handles success: false gracefully
  return res.status(200).json(errorResponse);
}

/**
 * Not Found handler (404 routes)
 * Also returns 200 with success: false for consistency
 */
function notFoundHandler(req, res) {
  console.warn('Route not found:', {
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  return res.status(200).json({
    success: false,
    type: 'not_found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

/**
 * Async handler wrapper - catches async errors
 * Wraps async route handlers to ensure errors are passed to errorHandler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { 
  errorHandler,
  notFoundHandler,
  asyncHandler
};
