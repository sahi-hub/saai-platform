'use client';

/**
 * useStreamingChat Hook
 * 
 * Handles Server-Sent Events (SSE) for streaming chat responses.
 * Provides real-time text updates as the LLM generates responses.
 */

import { useCallback, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_SAAI_API || 'http://localhost:3001';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
}

interface StreamCallbacks {
  onChunk: (text: string) => void;
  onTool: (toolName: string, params: Record<string, unknown>) => void;
  onProducts: (products: Product[], action: string) => void;
  onComplete: (result: StreamCompleteResult) => void;
  onError: (error: string) => void;
}

interface StreamCompleteResult {
  success: boolean;
  replyType: string;
  action?: string;
  provider?: string;
  model?: string;
}

interface StreamRequest {
  tenant: string;
  sessionId: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
}

export function useStreamingChat() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamChat = useCallback(async (
    request: StreamRequest,
    callbacks: StreamCallbacks
  ) => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6).trim();
            
            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData);
                handleSSEEvent(eventType, data, callbacks);
              } catch (e) {
                console.warn('Failed to parse SSE data:', e);
              }
              eventType = '';
              eventData = '';
            }
          }
        }
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Stream aborted');
        return;
      }
      console.error('Stream error:', error);
      callbacks.onError((error as Error).message || 'Stream failed');
    }
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { streamChat, cancelStream };
}

function handleSSEEvent(
  eventType: string,
  data: Record<string, unknown>,
  callbacks: StreamCallbacks
) {
  switch (eventType) {
    case 'start':
      // Stream started, could show a "thinking" indicator
      break;
    
    case 'chunk':
      if (typeof data.text === 'string') {
        callbacks.onChunk(data.text);
      }
      break;
    
    case 'tool':
      if (typeof data.name === 'string') {
        callbacks.onTool(data.name, (data.params as Record<string, unknown>) || {});
      }
      break;
    
    case 'products':
      if (Array.isArray(data.items)) {
        callbacks.onProducts(
          data.items as Product[],
          (data.action as string) || ''
        );
      }
      break;
    
    case 'done':
      callbacks.onComplete({
        success: (data.success as boolean) ?? true,
        replyType: (data.replyType as string) || 'message',
        action: data.action as string | undefined,
        provider: data.provider as string | undefined,
        model: data.model as string | undefined
      });
      break;
    
    case 'error':
      callbacks.onError((data.message as string) || 'Unknown error');
      break;
  }
}

export default useStreamingChat;
