'use client';

import { useState, useEffect, useRef } from 'react';
import ChatLayout from '@/components/ChatLayout';
import SaaiLayout from '@/components/SaaiLayout';
import MessageBubble from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';
import { sendChatMessage, ChatResponse, HistoryMessage, addOutfitToCart, AddOutfitResponse } from '@/config/api';
import { getCurrentTenant } from '@/utils/tenant';
import { loadTenantTheme, Theme, DEFAULT_THEME } from '@/config/tenant';
import { ProductItem } from '@/components/ProductCard';

// Cart summary type for side panel
interface CartSummary {
  totalItems: number;
  totalAmount: number;
}

// Outfit items type for side panel
interface OutfitItems {
  shirt?: ProductItem;
  pant?: ProductItem;
  shoe?: ProductItem;
}

// Support both text messages and recommendation messages
type MessageContent = 
  | string 
  | { type: 'text'; text: string; }
  | { type: 'recommendations'; items: ProductItem[]; }
  | { type: 'outfit'; items: { shirt?: ProductItem; pant?: ProductItem; shoe?: ProductItem; }; };

interface Message {
  id: string;
  text?: string; // For backward compatibility
  content?: MessageContent; // New field for both text and recommendations
  sender: 'user' | 'saai';
  timestamp: string;
  isLoading?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');
  
  // Side panel state
  const [lastRecommendations, setLastRecommendations] = useState<ProductItem[] | null>(null);
  const [lastOutfit, setLastOutfit] = useState<OutfitItems | null>(null);
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate or retrieve sessionId from localStorage
  useEffect(() => {
    const STORAGE_KEY = 'saai_session_id';
    let existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      existing = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem(STORAGE_KEY, existing);
    }
    setSessionId(existing);
  }, []);

  // Detect tenant and load theme on mount
  useEffect(() => {
    // Wait for sessionId to be set before initializing
    if (!sessionId) return;
    
    const initializeTenant = async () => {
      try {
        // Detect tenant from hostname
        const detectedTenant = getCurrentTenant();
        setTenantId(detectedTenant);

        // Load tenant theme
        const { theme: tenantTheme } = await loadTenantTheme(detectedTenant);
        setTheme(tenantTheme);

        // Get AI greeting from backend
        try {
          const greetingResponse = await sendChatMessage(
            'Greet the user warmly. Introduce yourself briefly and mention 1-2 things you can help with.',
            detectedTenant,
            undefined,
            sessionId
          );
          
          const greetingText = greetingResponse.llm?.text || 
            "Hello! I'm SAAI, your AI assistant. How can I help you today?";
          
          setMessages([
            {
              id: '1',
              content: greetingText,
              sender: 'saai',
              timestamp: new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            }
          ]);
        } catch (greetingError) {
          console.warn('Failed to get AI greeting, using fallback:', greetingError);
          // Fallback greeting if backend is unavailable
          setMessages([
            {
              id: '1',
              content: "Hello! I'm SAAI, your AI assistant. How can I help you today?",
              sender: 'saai',
              timestamp: new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })
            }
          ]);
        }
      } catch (error) {
        console.error('Failed to initialize tenant:', error);
        // Fallback to default
        setTenantId('default');
        setTheme(DEFAULT_THEME);
      } finally {
        setIsLoadingTheme(false);
      }
    };

    initializeTenant();
  }, [sessionId]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Format tool execution message for display
   */
  const formatToolMessage = (response: ChatResponse): string => {
    const { llm, actionResult } = response;
    
    if (!llm.action) {
      return 'Action executed successfully.';
    }

    // Format based on action type
    switch (llm.action) {
      case 'search_products': {
        const query = llm.params?.query ? String(llm.params.query) : '';
        return query 
          ? `🔍 Searching for products: "${query}"...`
          : '🔍 Searching for products...';
      }
      
      case 'add_to_cart': {
        const productId = llm.params?.productId ? String(llm.params.productId) : '';
        return productId
          ? `🛒 Adding product to cart (ID: ${productId})...`
          : '🛒 Adding product to cart...';
      }
      
      case 'checkout': {
        const discount = actionResult && 'order' in actionResult && 
          typeof actionResult.order === 'object' && actionResult.order &&
          'discount' in actionResult.order ? actionResult.order.discount : null;
        
        if (discount) {
          return `✅ Processing checkout with ${discount}% discount!`;
        }
        return '✅ Processing your checkout...';
      }
      
      case 'create_support_ticket': {
        const ticketId = actionResult && 'ticketId' in actionResult 
          ? String(actionResult.ticketId) 
          : null;
        
        if (ticketId) {
          return `🎫 Support ticket created! Ticket ID: ${ticketId}`;
        }
        return '🎫 Creating support ticket...';
      }
      
      default:
        return `⚡ Executing action: ${llm.action}`;
    }
  };

  /**
   * Build conversation history for LLM context
   * Extracts the last N text-only messages and formats them for the backend
   */
  const buildHistoryForLLM = (messages: Message[]): HistoryMessage[] => {
    const MAX_HISTORY = 6; // Keep last 6 messages for context
    
    return messages
      // Filter to text-only messages (exclude recommendations, outfits, loading states)
      .filter((msg): msg is Message & { content: string } => 
        typeof msg.content === 'string' && 
        !msg.isLoading && 
        msg.content.length > 0
      )
      // Map to LLM format
      .map((msg): HistoryMessage => ({
        role: msg.sender === 'saai' ? 'assistant' : 'user',
        content: msg.content
      }))
      // Keep only last N messages
      .slice(-MAX_HISTORY);
  };

  /**
   * Send message to backend and handle response
   */
  const handleSendMessage = async (text: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add loading indicator
    const loadingId = `loading-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: loadingId,
      content: '',
      sender: 'saai',
      timestamp: '',
      isLoading: true
    }]);

    setIsLoading(true);

    try {
      // Build conversation history for LLM context (exclude the message we just added)
      const history = buildHistoryForLLM(messages.filter(m => m.id !== userMessage.id));
      
      // Call backend API with detected tenant, history, and sessionId
      const response = await sendChatMessage(text, tenantId, history, sessionId);

      // Remove loading indicator
      setMessages((prev) => prev.filter(msg => msg.id !== loadingId));

      // Check if this is an outfit response
      if (response.replyType === 'tool' && 
          response.actionResult && 
          response.actionResult.type === 'outfit' &&
          response.actionResult.items) {
        
        const newMessages: Message[] = [];
        
        // If groundedText is present, add it as a text bubble FIRST (above the outfit cards)
        if (response.llm.groundedText) {
          newMessages.push({
            id: (Date.now() + 1).toString(),
            content: response.llm.groundedText,
            sender: 'saai',
            timestamp: new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          });
        }

        // Create outfit message (after groundedText)
        newMessages.push({
          id: (Date.now() + 2).toString(),
          content: {
            type: 'outfit',
            items: response.actionResult.items
          },
          sender: 'saai',
          timestamp: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        });

        setMessages((prev) => [...prev, ...newMessages]);
        
        // Update side panel with outfit
        setLastOutfit(response.actionResult.items as OutfitItems);
        setLastRecommendations(null); // Clear recommendations when outfit is shown

        return;
      }

      // Check if this is a recommendation response
      if (response.replyType === 'tool' && 
          response.actionResult?.type === 'recommendations' &&
          Array.isArray(response.actionResult.items)) {
        
        const newMessages: Message[] = [];
        
        // If groundedText is present, add it as a text bubble FIRST (above the product cards)
        if (response.llm.groundedText) {
          newMessages.push({
            id: (Date.now() + 1).toString(),
            content: response.llm.groundedText,
            sender: 'saai',
            timestamp: new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          });
        }

        // Create recommendation message (after groundedText)
        newMessages.push({
          id: (Date.now() + 2).toString(),
          content: {
            type: 'recommendations',
            items: response.actionResult.items
          },
          sender: 'saai',
          timestamp: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        });

        setMessages((prev) => [...prev, ...newMessages]);
        
        // Update side panel with recommendations
        setLastRecommendations(response.actionResult.items as ProductItem[]);
        setLastOutfit(null); // Clear outfit when recommendations are shown

        return;
      }

      // Check if this is a cart action response (add_to_cart, view_cart)
      if (response.replyType === 'tool' && 
          response.actionResult?.type === 'cart') {
        
        // Use the message from actionResult, or build from summary
        let cartText = response.actionResult.message as string;
        const summary = response.actionResult.summary as { totalItems?: number; totalAmount?: number } | undefined;
        
        if (!cartText && summary) {
          cartText = `Your cart has ${summary.totalItems || 0} item(s), total: ₹${summary.totalAmount || 0}`;
        }
        
        if (!cartText) {
          cartText = response.actionResult.success 
            ? '🛒 Cart updated successfully!' 
            : '⚠️ Failed to update cart.';
        }

        const saaiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: cartText,
          sender: 'saai',
          timestamp: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        };

        setMessages((prev) => [...prev, saaiResponse]);
        
        // Update side panel cart summary
        if (summary) {
          setCartSummary({
            totalItems: summary.totalItems || 0,
            totalAmount: summary.totalAmount || 0
          });
        }
        
        return;
      }

      // Check if this is a checkout response
      if (response.replyType === 'tool' && 
          response.actionResult?.type === 'checkout') {
        
        let checkoutText = response.actionResult.message as string;
        
        if (!checkoutText) {
          checkoutText = response.actionResult.success
            ? '🎉 Order placed successfully!'
            : '⚠️ Checkout failed. Your cart might be empty.';
        }

        const saaiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: checkoutText,
          sender: 'saai',
          timestamp: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        };

        setMessages((prev) => [...prev, saaiResponse]);
        
        // Clear cart summary after checkout
        if (response.actionResult.success) {
          setCartSummary(null);
        }
        
        return;
      }

      // Determine response text based on replyType
      let responseText = '';
      
      if (response.replyType === 'tool' && response.llm.action) {
        // Format tool execution message
        responseText = formatToolMessage(response);
        
        // If there's also a text response from the LLM, add it
        if (response.llm.text) {
          responseText += `\n\n${response.llm.text}`;
        }
      } else if (response.llm.text) {
        // Regular message response
        responseText = response.llm.text;
      } else {
        // Fallback
        responseText = 'I processed your request.';
      }

      // Add SAAI response
      const saaiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        sender: 'saai',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };

      setMessages((prev) => [...prev, saaiResponse]);

      // Log provider info if available (for debugging)
      if (response.llm.provider) {
        console.log(`Response from: ${response.llm.provider}`, response.llm._meta);
      }

    } catch (error) {
      // Remove loading indicator
      setMessages((prev) => prev.filter(msg => msg.id !== loadingId));

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: '⚠️ Connection error. Please check if the backend server is running and try again.',
        sender: 'saai',
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };

      setMessages((prev) => [...prev, errorMessage]);
      
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Add to Cart button click from product cards
   * Simply sends a message to add the product to cart
   */
  const handleAddToCart = (productId: string) => {
    handleSendMessage(`Add product ${productId} to cart`);
  };

  /**
   * Handle Add Multiple to Cart (for outfit "Add Full Outfit" button)
   * Calls backend directly (no LLM) for deterministic cart operations
   */
  const handleAddMultipleToCart = async (productIds: string[]) => {
    if (!sessionId || !tenantId || productIds.length === 0) {
      console.error('[UI] Missing sessionId, tenantId, or productIds');
      return;
    }

    try {
      // Call backend directly (bypasses LLM)
      const response: AddOutfitResponse = await addOutfitToCart(tenantId, sessionId, productIds);

      if (!response.success) {
        // Show error message in chat
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: { type: 'text', text: response.error || "I couldn't add that outfit to your cart. Please try again." },
          sender: 'saai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      // Show confirmation in chat
      const confirmMessage: Message = {
        id: Date.now().toString(),
        content: { type: 'text', text: response.message || "I've added that outfit to your cart." },
        sender: 'saai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, confirmMessage]);

      // Update side panel cart summary
      if (response.summary) {
        setCartSummary(response.summary);
      }
    } catch (err) {
      console.error('[UI] add full outfit error:', err);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: { type: 'text', text: 'Something went wrong while adding the outfit to your cart.' },
        sender: 'saai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  /**
   * Handle checkout from side panel
   * Sends a message to trigger checkout via chat
   */
  const handleCheckout = () => {
    handleSendMessage('Checkout my cart');
  };

  // Show loading indicator while theme is loading
  if (isLoadingTheme) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-flex space-x-2 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-150"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-300"></div>
          </div>
          <p className="text-slate-600">Loading SAAI Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <SaaiLayout
      theme={theme}
      recommendations={lastRecommendations}
      outfit={lastOutfit}
      cartSummary={cartSummary}
      onCheckout={handleCheckout}
      onAddToCart={handleAddToCart}
    >
      <ChatLayout 
        tenantId={tenantId}
        theme={theme}
        inputComponent={<ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />}
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg.content || msg.text || ''}
            sender={msg.sender}
            timestamp={msg.timestamp}
            isLoading={msg.isLoading}
            theme={theme}
            onAddToCart={handleAddToCart}
            onAddMultipleToCart={handleAddMultipleToCart}
          />
        ))}
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
      </ChatLayout>
    </SaaiLayout>
  );
}

