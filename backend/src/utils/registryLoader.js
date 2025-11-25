const fs = require('fs').promises;
const path = require('path');

/**
 * Action Registry Loader Utility
 * 
 * Loads tenant-specific action registry files from the registry directory.
 * Each tenant can have a custom set of actions/tools with their configurations.
 * Falls back to default.registry.json if tenant-specific registry is not found.
 * 
 * @module registryLoader
 */

/**
 * Custom error class for registry-related errors
 */
class RegistryNotFoundError extends Error {
  constructor(tenantId) {
    super(`Action registry not found for tenant: ${tenantId} (and no default found)`);
    this.name = 'RegistryNotFoundError';
    this.statusCode = 500;
    this.tenantId = tenantId;
  }
}

/**
 * Custom error class for invalid registry configuration
 */
class InvalidRegistryError extends Error {
  constructor(tenantId, reason) {
    super(`Invalid action registry for ${tenantId}: ${reason}`);
    this.name = 'InvalidRegistryError';
    this.statusCode = 500;
    this.tenantId = tenantId;
  }
}

/**
 * Load action registry for a tenant
 * 
 * Attempts to load a tenant-specific registry file first.
 * If not found, falls back to the default registry.
 * 
 * @param {string} tenantId - The unique identifier for the tenant
 * @returns {Promise<Object>} The action registry object
 * @throws {RegistryNotFoundError} If neither tenant nor default registry exists
 * @throws {InvalidRegistryError} If the registry file is invalid
 * 
 * @example
 * const registry = await loadActionRegistry('example');
 * console.log(registry.actions); // { search_products: {...}, ... }
 */
async function loadActionRegistry(tenantId) {
  try {
    // Validate input
    if (!tenantId || typeof tenantId !== 'string') {
      throw new InvalidRegistryError(tenantId, 'Tenant ID must be a non-empty string');
    }

    // Sanitize tenant ID to prevent directory traversal attacks
    const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedTenantId !== tenantId) {
      throw new InvalidRegistryError(tenantId, 'Tenant ID contains invalid characters');
    }

    const registryDir = path.join(__dirname, '..', 'registry');
    const tenantRegistryPath = path.join(registryDir, `${sanitizedTenantId}.registry.json`);
    const defaultRegistryPath = path.join(registryDir, 'default.registry.json');

    let registryPath = null;
    let usedDefault = false;

    // Try to load tenant-specific registry first
    try {
      await fs.access(tenantRegistryPath);
      registryPath = tenantRegistryPath;
    } catch (error) {
      // Tenant-specific registry not found, try default
      try {
        await fs.access(defaultRegistryPath);
        registryPath = defaultRegistryPath;
        usedDefault = true;
        console.log(`No registry found for tenant "${tenantId}", using default registry`);
      } catch (defaultError) {
        throw new RegistryNotFoundError(tenantId);
      }
    }

    // Read the file
    const fileContent = await fs.readFile(registryPath, 'utf-8');

    // Parse JSON
    let registry;
    try {
      registry = JSON.parse(fileContent);
    } catch (parseError) {
      throw new InvalidRegistryError(
        tenantId,
        `Failed to parse JSON: ${parseError.message}`
      );
    }

    // Validate required fields
    if (!registry.tenantId) {
      throw new InvalidRegistryError(tenantId, 'Missing required field: tenantId');
    }

    if (!registry.actions || typeof registry.actions !== 'object') {
      throw new InvalidRegistryError(tenantId, 'Missing or invalid "actions" object');
    }

    // Add metadata about which registry was used
    registry._meta = {
      loadedFrom: usedDefault ? 'default' : 'tenant-specific',
      requestedTenant: tenantId,
      actualTenant: registry.tenantId
    };

    return registry;

  } catch (error) {
    // Re-throw custom errors as-is
    if (error instanceof RegistryNotFoundError || error instanceof InvalidRegistryError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new InvalidRegistryError(
      tenantId,
      `Unexpected error: ${error.message}`
    );
  }
}

/**
 * List all available action registries
 * 
 * @returns {Promise<string[]>} Array of tenant IDs with registries
 */
async function listRegistries() {
  try {
    const registryDir = path.join(__dirname, '..', 'registry');
    const files = await fs.readdir(registryDir);
    
    // Filter for .registry.json files and extract tenant IDs
    const tenantIds = files
      .filter(file => file.endsWith('.registry.json'))
      .map(file => file.replace('.registry.json', ''));
    
    return tenantIds;
  } catch (error) {
    console.error('Error listing registries:', error);
    return [];
  }
}

module.exports = {
  loadActionRegistry,
  listRegistries,
  RegistryNotFoundError,
  InvalidRegistryError
};
