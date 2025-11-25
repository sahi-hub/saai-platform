/**
 * SAAI API Configuration
 * 
 * Configure the backend API endpoint and default tenant.
 * Uses environment variables for flexibility across environments.
 */

// API Base URL - Uses NEXT_PUBLIC_SAAI_API env var or defaults to localhost
export const API_URL = process.env.NEXT_PUBLIC_SAAI_API || 'http://localhost:3001';

// Default tenant identifier
export const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'example';

/**
 * Send a chat message to the SAAI backend
 * 
 * @param message - User's message text
 * @param tenant - Tenant identifier (optional, uses DEFAULT_TENANT)
 * @returns Promise with backend response
 */
export async function sendChatMessage(message: string, tenant: string = DEFAULT_TENANT) {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tenant,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Backend response types
 */
export interface ChatResponse {
  success: boolean;
  replyType: 'message' | 'tool';
  llm: {
    type: 'message' | 'tool';
    text?: string;
    action?: string;
    params?: Record<string, unknown>;
    reasoning?: string;
    provider?: string;
    _meta?: {
      model?: string;
      usage?: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
  };
  actionResult?: Record<string, unknown>;
  tenantConfig?: Record<string, unknown>;
  actionRegistry?: Record<string, unknown>;
}
