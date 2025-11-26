const fs = require('fs').promises;
const path = require('path');

/**
 * Tenant Loader Utility
 * 
 * Loads and validates tenant configuration files from the config/tenants directory.
 * Each tenant has a JSON configuration file named {tenantId}.json
 * 
 * REFACTORED: Now uses fallback logic instead of throwing errors.
 * If tenant not found, falls back to DEFAULT_TENANT or "example".
 * 
 * @module tenantLoader
 */

// Default fallback tenant ID
const DEFAULT_FALLBACK_TENANT = 'example';

/**
 * Custom error class for tenant-related errors
 * DEPRECATED: Kept for backward compatibility but rarely thrown now
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
 * Get the effective tenant ID with fallback logic
 * 
 * @param {string} tenantId - The requested tenant ID
 * @returns {string} The effective tenant ID to use
 * 
 * Priority:
 * 1. If tenantId is valid and non-empty → return it
 * 2. If tenantId is null/empty → use DEFAULT_TENANT env var
 * 3. If no DEFAULT_TENANT → use "example"
 */
function getEffectiveTenantId(tenantId) {
  // If tenantId is provided and non-empty, use it
  if (tenantId && typeof tenantId === 'string' && tenantId.trim() !== '') {
    return tenantId.trim();
  }
  
  // Otherwise, use environment variable or fallback
  const defaultTenant = process.env.DEFAULT_TENANT || DEFAULT_FALLBACK_TENANT;
  console.log(`[tenantLoader] No tenantId provided, using fallback: ${defaultTenant}`);
  return defaultTenant;
}

/**
 * Check if a tenant config file exists
 * 
 * @param {string} tenantId - Tenant ID to check
 * @returns {Promise<boolean>} True if config file exists
 */
async function tenantConfigExists(tenantId) {
  try {
    const sanitizedTenantId = tenantId.replaceAll(/[^a-zA-Z0-9-_]/g, '');
    const configDir = path.join(__dirname, '..', 'config', 'tenants');
    const configFilePath = path.join(configDir, `${sanitizedTenantId}.json`);
    await fs.access(configFilePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load tenant configuration from JSON file with fallback
 * 
 * @param {string} tenantId - The unique identifier for the tenant
 * @returns {Promise<Object>} The tenant configuration object
 * 
 * REFACTORED: Instead of throwing TenantNotFoundError, 
 * this now falls back to "example" tenant if the requested tenant doesn't exist.
 * 
 * @example
 * const config = await loadTenantConfig('example');
 * console.log(config.displayName); // "Example Tenant"
 */
async function loadTenantConfig(tenantId) {
  try {
    // Get effective tenant ID (with fallback)
    const effectiveTenantId = getEffectiveTenantId(tenantId);

    // Sanitize tenant ID to prevent directory traversal attacks
    const sanitizedTenantId = effectiveTenantId.replaceAll(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedTenantId !== effectiveTenantId) {
      console.warn(`[tenantLoader] Tenant ID "${effectiveTenantId}" contains invalid characters, sanitized to "${sanitizedTenantId}"`);
    }

    // Build the file path dynamically
    const configDir = path.join(__dirname, '..', 'config', 'tenants');
    let configFilePath = path.join(configDir, `${sanitizedTenantId}.json`);

    // Check if the config file exists
    let configExists = false;
    try {
      await fs.access(configFilePath);
      configExists = true;
    } catch {
      configExists = false;
    }

    // If tenant config doesn't exist, fallback to example
    if (!configExists) {
      console.warn(`[tenantLoader] ⚠️  Tenant "${sanitizedTenantId}" not found, falling back to "${DEFAULT_FALLBACK_TENANT}"`);
      const fallbackPath = path.join(configDir, `${DEFAULT_FALLBACK_TENANT}.json`);
      
      try {
        await fs.access(fallbackPath);
        configFilePath = fallbackPath;
      } catch {
        // Even fallback doesn't exist - create a minimal default config
        console.error(`[tenantLoader] ❌ Even fallback tenant "${DEFAULT_FALLBACK_TENANT}" not found, using minimal default config`);
        return createMinimalTenantConfig(sanitizedTenantId);
      }
    }

    // Read the file
    const fileContent = await fs.readFile(configFilePath, 'utf-8');

    // Parse JSON
    let config;
    try {
      config = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`[tenantLoader] ❌ Failed to parse JSON for tenant "${sanitizedTenantId}": ${parseError.message}`);
      return createMinimalTenantConfig(sanitizedTenantId);
    }

    // Ensure tenantId is set in the config (use the originally requested one if it was sanitized)
    if (!config.tenantId) {
      config.tenantId = sanitizedTenantId;
    }

    console.log(`[tenantLoader] ✅ Loaded config for tenant: ${config.tenantId}`);
    return config;

  } catch (error) {
    // For any unexpected error, return a minimal config instead of throwing
    console.error(`[tenantLoader] ❌ Unexpected error loading tenant "${tenantId}": ${error.message}`);
    return createMinimalTenantConfig(tenantId || DEFAULT_FALLBACK_TENANT);
  }
}

/**
 * Create a minimal tenant configuration
 * Used when no tenant config file exists
 * 
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Minimal tenant configuration
 */
function createMinimalTenantConfig(tenantId) {
  console.log(`[tenantLoader] Creating minimal config for tenant: ${tenantId}`);
  return {
    tenantId: tenantId,
    displayName: `${tenantId} (Default)`,
    theme: {
      primaryColor: '#4A90E2',
      secondaryColor: '#50E3C2',
      fontFamily: 'Inter'
    },
    features: {
      chat: true,
      recommendations: true,
      checkout: false
    },
    llm: {
      provider: 'MOCK',
      temperature: 0.7
    }
  };
}

/**
 * Get effective tenant config with full fallback chain
 * 
 * @param {string} tenantId - The requested tenant ID
 * @returns {Promise<Object>} The effective tenant configuration
 * 
 * This is the recommended entry point that:
 * 1. Gets effective tenant ID (handles null/empty)
 * 2. Loads config with fallback
 * 3. Never throws - always returns a valid config
 */
async function getEffectiveTenant(tenantId) {
  const effectiveId = getEffectiveTenantId(tenantId);
  return loadTenantConfig(effectiveId);
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
  getEffectiveTenant,
  getEffectiveTenantId,
  tenantConfigExists,
  createMinimalTenantConfig,
  TenantNotFoundError,
  InvalidTenantConfigError
};
