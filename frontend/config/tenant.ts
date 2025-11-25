/**
 * Tenant Theme Configuration Loader
 * 
 * Loads tenant-specific themes from the backend and merges with defaults.
 */

// Get API URL from environment or use default
const API_URL = process.env.NEXT_PUBLIC_SAAI_API || 'http://localhost:3001';

/**
 * Default theme configuration
 * Used as fallback when tenant theme cannot be loaded
 */
export const DEFAULT_THEME = {
  primaryColor: '#4A90E2',
  secondaryColor: '#FFFFFF',
  headerTitle: 'SAAI Assistant',
  logoUrl: '/default-logo.png',
};

/**
 * Theme object structure
 */
export interface Theme {
  primaryColor: string;
  secondaryColor: string;
  headerTitle: string;
  logoUrl: string;
}

/**
 * Tenant configuration from backend
 */
export interface TenantConfig {
  id: string;
  name: string;
  theme?: Partial<Theme>;
  [key: string]: any;
}

/**
 * Combined theme and tenant config response
 */
export interface TenantThemeResult {
  theme: Theme;
  tenantConfig: TenantConfig | null;
}

/**
 * Loads tenant-specific theme from backend
 * Merges backend response with default theme
 * 
 * @param tenantId - The tenant ID to load theme for
 * @returns Promise with merged theme and tenant config
 */
export async function loadTenantTheme(tenantId: string): Promise<TenantThemeResult> {
  try {
    // Call backend to get tenant configuration
    const response = await fetch(`${API_URL}/tenant/${tenantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If request fails, return default theme
    if (!response.ok) {
      console.warn(`Failed to load tenant theme for "${tenantId}": ${response.status}`);
      return {
        theme: DEFAULT_THEME,
        tenantConfig: null,
      };
    }

    const data = await response.json();

    // Extract tenant config from response
    const tenantConfig: TenantConfig = data.tenant || data;

    // Merge tenant theme with default theme
    // Tenant-specific values override defaults
    const mergedTheme: Theme = {
      ...DEFAULT_THEME,
      ...(tenantConfig.theme || {}),
    };

    return {
      theme: mergedTheme,
      tenantConfig,
    };
  } catch (error) {
    // Network error or other failure - return default theme
    console.error(`Error loading tenant theme for "${tenantId}":`, error);
    return {
      theme: DEFAULT_THEME,
      tenantConfig: null,
    };
  }
}

/**
 * Validates and sanitizes a theme object
 * Ensures all required fields are present
 * 
 * @param theme - Theme object to validate
 * @returns Validated theme object
 */
export function validateTheme(theme: Partial<Theme>): Theme {
  return {
    primaryColor: theme.primaryColor || DEFAULT_THEME.primaryColor,
    secondaryColor: theme.secondaryColor || DEFAULT_THEME.secondaryColor,
    headerTitle: theme.headerTitle || DEFAULT_THEME.headerTitle,
    logoUrl: theme.logoUrl || DEFAULT_THEME.logoUrl,
  };
}
