/**
 * Tenant Detection Utility
 * 
 * Detects the tenant from the hostname in both SSR and browser environments.
 * 
 * Examples:
 * - client1.saai.pro → "client1"
 * - ui.saai.pro → "default"
 * - localhost → "example"
 */

/**
 * Extracts tenant ID from hostname
 * @param hostname - The hostname to parse (e.g., "client1.saai.pro")
 * @returns The tenant ID string
 */
export function getTenantFromHostname(hostname: string): string {
  // Handle localhost
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'example';
  }

  // Handle ui.saai.pro (main UI domain)
  if (hostname === 'ui.saai.pro' || hostname === 'saai.pro') {
    return 'default';
  }

  // Handle subdomain pattern: client1.saai.pro
  // Extract the first part before the first dot
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const subdomain = parts[0];
    // Return subdomain as tenant ID if it's not 'www'
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }

  // Fallback to default if no pattern matches
  return 'default';
}

/**
 * Gets the current tenant ID based on the runtime environment
 * Works in both browser and SSR (Next.js server-side) contexts
 * @returns The current tenant ID
 */
export function getCurrentTenant(): string {
  // Browser environment
  if (typeof window !== 'undefined') {
    return getTenantFromHostname(window.location.hostname);
  }

  // SSR environment - return default
  // In a real SSR setup, you would extract hostname from request headers
  // This can be enhanced to accept headers as a parameter
  return 'default';
}

/**
 * Gets tenant ID from Next.js request headers (for SSR)
 * @param headers - Request headers object
 * @returns The tenant ID
 */
export function getTenantFromHeaders(headers: Headers | Record<string, string>): string {
  let hostname = '';

  if (headers instanceof Headers) {
    hostname = headers.get('host') || '';
  } else {
    hostname = headers.host || '';
  }

  // Remove port if present (e.g., "localhost:3002" → "localhost")
  hostname = hostname.split(':')[0];

  return getTenantFromHostname(hostname);
}
