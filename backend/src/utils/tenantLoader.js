const fs = require('fs').promises;
const path = require('path');

/**
 * Tenant Loader Utility
 * 
 * Loads and validates tenant configuration files from the config/tenants directory.
 * Each tenant has a JSON configuration file named {tenantId}.json
 * 
 * @module tenantLoader
 */

/**
 * Custom error class for tenant-related errors
 */
class TenantNotFoundError extends Error {
  constructor(tenantId) {
    super(`Tenant configuration not found: ${tenantId}`);
    this.name = 'TenantNotFoundError';
    this.statusCode = 404;
    this.tenantId = tenantId;
  }
}

/**
 * Custom error class for invalid tenant configuration
 */
class InvalidTenantConfigError extends Error {
  constructor(tenantId, reason) {
    super(`Invalid tenant configuration for ${tenantId}: ${reason}`);
    this.name = 'InvalidTenantConfigError';
    this.statusCode = 500;
    this.tenantId = tenantId;
  }
}

/**
 * Load tenant configuration from JSON file
 * 
 * @param {string} tenantId - The unique identifier for the tenant
 * @returns {Promise<Object>} The tenant configuration object
 * @throws {TenantNotFoundError} If the tenant configuration file doesn't exist
 * @throws {InvalidTenantConfigError} If the configuration file is invalid
 * 
 * @example
 * const config = await loadTenantConfig('example');
 * console.log(config.displayName); // "Example Tenant"
 */
async function loadTenantConfig(tenantId) {
  try {
    // Validate input
    if (!tenantId || typeof tenantId !== 'string') {
      throw new InvalidTenantConfigError(tenantId, 'Tenant ID must be a non-empty string');
    }

    // Sanitize tenant ID to prevent directory traversal attacks
    const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedTenantId !== tenantId) {
      throw new InvalidTenantConfigError(tenantId, 'Tenant ID contains invalid characters');
    }

    // Build the file path dynamically
    const configDir = path.join(__dirname, '..', 'config', 'tenants');
    const configFilePath = path.join(configDir, `${sanitizedTenantId}.json`);

    // Check if the config file exists
    try {
      await fs.access(configFilePath);
    } catch (error) {
      throw new TenantNotFoundError(tenantId);
    }

    // Read the file
    const fileContent = await fs.readFile(configFilePath, 'utf-8');

    // Parse JSON
    let config;
    try {
      config = JSON.parse(fileContent);
    } catch (parseError) {
      throw new InvalidTenantConfigError(
        tenantId,
        `Failed to parse JSON: ${parseError.message}`
      );
    }

    // Validate required fields
    if (!config.tenantId) {
      throw new InvalidTenantConfigError(tenantId, 'Missing required field: tenantId');
    }

    // Verify tenantId matches the filename
    if (config.tenantId !== tenantId) {
      throw new InvalidTenantConfigError(
        tenantId,
        `Tenant ID mismatch: file name is "${tenantId}" but config contains "${config.tenantId}"`
      );
    }

    // Return the validated configuration
    return config;

  } catch (error) {
    // Re-throw custom errors as-is
    if (error instanceof TenantNotFoundError || error instanceof InvalidTenantConfigError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new InvalidTenantConfigError(
      tenantId,
      `Unexpected error: ${error.message}`
    );
  }
}

/**
 * List all available tenant IDs
 * 
 * @returns {Promise<string[]>} Array of tenant IDs
 */
async function listTenants() {
  try {
    const configDir = path.join(__dirname, '..', 'config', 'tenants');
    const files = await fs.readdir(configDir);
    
    // Filter for .json files and extract tenant IDs
    const tenantIds = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    return tenantIds;
  } catch (error) {
    console.error('Error listing tenants:', error);
    return [];
  }
}

module.exports = {
  loadTenantConfig,
  listTenants,
  TenantNotFoundError,
  InvalidTenantConfigError
};
