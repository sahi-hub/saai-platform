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
 * Chat history message format for LLM context
 */
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Send a chat message to the SAAI backend
 * 
 * @param message - User's message text
 * @param tenant - Tenant identifier (optional, uses DEFAULT_TENANT)
 * @param history - Optional conversation history for context
 * @param sessionId - Optional session ID for cart isolation
 * @returns Promise with backend response
 */
export async function sendChatMessage(
  message: string,
  tenant: string = DEFAULT_TENANT,
  history?: HistoryMessage[],
  sessionId?: string
) {
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tenant,
      message,
      ...(history && history.length > 0 && { history }),
      ...(sessionId && { sessionId }),
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
    type?: 'message' | 'tool';
    decision?: 'message' | 'tool';
    text?: string;
    action?: string;
    params?: Record<string, unknown>;
    reasoning?: string;
    provider?: string;
    model?: string;
    groundedText?: string; // Grounded explanation for tool results
    _meta?: {
      model?: string;
      usage?: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
  };
  actionResult?: Record<string, unknown> & {
    type?: string;
    items?: unknown;
  };
  tenantConfig?: Record<string, unknown>;
  actionRegistry?: Record<string, unknown>;
}

/**
 * Add outfit to cart response type
 */
export interface AddOutfitResponse {
  success: boolean;
  type?: string;
  action?: string;
  message?: string;
  error?: string;
  cart?: {
    items: Array<{
      productId: string;
      quantity: number;
      productSnapshot: {
        id: string;
        name: string;
        price: number;
        currency: string;
        category: string;
        imageUrl: string;
      };
    }>;
  };
  summary?: {
    totalItems: number;
    totalAmount: number;
  };
  addedItems?: Array<{
    id: string;
    name: string;
    price: number;
    type: string;
  }>;
}

/**
 * Add outfit to cart (deterministic, no LLM)
 * 
 * Calls the backend directly to add multiple products to cart.
 * This bypasses the LLM for faster, deterministic cart operations.
 * 
 * @param tenantId - Tenant identifier
 * @param sessionId - Session ID for cart isolation
 * @param productIds - Array of product IDs to add
 * @returns Promise with cart operation response
 */
export async function addOutfitToCart(
  tenantId: string,
  sessionId: string,
  productIds: string[]
): Promise<AddOutfitResponse> {
  const response = await fetch(`${API_URL}/cart/${tenantId}/add-outfit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      productIds,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
