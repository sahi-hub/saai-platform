require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./src/api/routes');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security Middleware - Helmet
// Adds various HTTP headers for security
app.use(helmet());

// Logging Middleware - Morgan
// Log HTTP requests in combined format
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate Limiting
// Prevent abuse by limiting requests per IP
const rateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute window
  max: NODE_ENV === 'production' ? 60 : 100, // Stricter in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
};

app.use(rateLimit(rateLimitConfig));

// CORS Configuration
// Custom validator for allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002', // Frontend dev server
  /\.saai\.pro$/ // Production domains
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(rule =>
      rule instanceof RegExp ? rule.test(origin) : rule === origin
    );
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Not allowed by policy'));
    }
  },
  credentials: true
}));

// Body Parser Middleware
app.use(express.json());

// Routes

/**
 * Health check endpoint
 * Returns the service status
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SAAI backend'
  });
});

/**
 * API routes
 * All chat and future API endpoints
 */
app.use(apiRoutes);

// Global Error Handler
// Must be registered after all routes
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 SAAI backend server running on port ${PORT}`);
  console.log(`📍 Health check available at http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Export app for testing
module.exports = app;
