/**
 * Tenant Controller
 * 
 * Handles tenant information API endpoints.
 * Provides read-only access to tenant configuration, action registry, and theme data.
 * 
 * @module tenant.controller
 */

const { loadTenantConfig, TenantNotFoundError } = require('../utils/tenantLoader');
const { loadActionRegistry } = require('../utils/registryLoader');

/**
 * Get tenant information including config, registry, and theme
 * 
 * Endpoint: GET /tenant/:tenantId
 * 
 * Success Response (200):
 * {
 *   "success": true,
 *   "tenantId": "example",
 *   "tenantConfig": { ... },
 *   "actionRegistry": { ... },
 *   "theme": {
 *     "headerTitle": "Example Tenant",
 *     "primaryColor": "#4A90E2",
 *     "secondaryColor": "#FFFFFF",
 *     "logoUrl": "/default-logo.png"
 *   }
 * }
 * 
 * Error Response (404):
 * {
 *   "success": false,
 *   "error": "Tenant not found"
 * }
 * 
 * Error Response (500):
 * {
 *   "success": false,
 *   "error": "Internal server error"
 * }
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
async function getTenantInfo(req, res) {
  try {
    // Extract tenant ID from request params
    const { tenantId } = req.params;

    // Validate tenant ID exists
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    // Load tenant configuration
    let tenantConfig;
    try {
      tenantConfig = await loadTenantConfig(tenantId);
    } catch (error) {
      // Handle tenant not found error specifically
      if (error instanceof TenantNotFoundError) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found'
        });
      }
      // Re-throw other errors to be caught by outer try-catch
      throw error;
    }

    // Load action registry (with fallback to default)
    let actionRegistry;
    try {
      actionRegistry = await loadActionRegistry(tenantId);
    } catch (error) {
      // Log error but continue - registry is optional
      console.error(`Failed to load action registry for tenant "${tenantId}":`, error.message);
      // Use empty registry as fallback
      actionRegistry = {
        tenantId: tenantId,
        actions: {},
        _meta: {
          loadedFrom: 'fallback',
          error: error.message
        }
      };
    }

    // Derive theme object from tenant config
    const theme = {
      headerTitle: tenantConfig.displayName || 'SAAI Assistant',
      primaryColor: tenantConfig.brandColor || '#4A90E2',
      secondaryColor: '#FFFFFF',
      logoUrl: tenantConfig.logoUrl || '/default-logo.png'
    };

    // Return successful response
    return res.status(200).json({
      success: true,
      tenantId: tenantId,
      tenantConfig: tenantConfig,
      actionRegistry: actionRegistry,
      theme: theme
    });

  } catch (error) {
    // Log unexpected errors
    console.error('Error in getTenantInfo:', error);

    // Return generic 500 error
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = {
  getTenantInfo
};
