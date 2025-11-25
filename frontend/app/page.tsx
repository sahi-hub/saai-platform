'use client';

import { useState, useEffect, useRef } from 'react';
import ChatLayout from '@/components/ChatLayout';
import MessageBubble from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';
import { sendChatMessage, ChatResponse } from '@/config/api';
import { getCurrentTenant } from '@/utils/tenant';
import { loadTenantTheme, Theme, DEFAULT_THEME } from '@/config/tenant';

interface Message {
  id: string;
  text: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect tenant and load theme on mount
  useEffect(() => {
    const initializeTenant = async () => {
      try {
        // Detect tenant from hostname
        const detectedTenant = getCurrentTenant();
        setTenantId(detectedTenant);

        // Load tenant theme
        const { theme: tenantTheme } = await loadTenantTheme(detectedTenant);
        setTheme(tenantTheme);

        // Add welcome message after theme is loaded
        setMessages([
          {
            id: '1',
            text: `Hello! I'm SAAI, your AI assistant. I'm now connected to the backend and can help you with real actions. Try asking me to search for products, add items to your cart, or get support!`,
            sender: 'saai',
            timestamp: new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          }
        ]);
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
  }, []);

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
   * Send message to backend and handle response
   */
  const handleSendMessage = async (text: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
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
      text: '',
      sender: 'saai',
      timestamp: '',
      isLoading: true
    }]);

    setIsLoading(true);

    try {
      // Call backend API with detected tenant
      const response = await sendChatMessage(text, tenantId);

      // Remove loading indicator
      setMessages((prev) => prev.filter(msg => msg.id !== loadingId));

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
        text: responseText,
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
        text: '⚠️ Connection error. Please check if the backend server is running and try again.',
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
    <ChatLayout 
      tenantId={tenantId}
      theme={theme}
      inputComponent={<ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg.text}
          sender={msg.sender}
          timestamp={msg.timestamp}
          isLoading={msg.isLoading}
          theme={theme}
        />
      ))}
      {/* Invisible element for auto-scroll */}
      <div ref={messagesEndRef} />
    </ChatLayout>
  );
}

