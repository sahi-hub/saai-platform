'use client';

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import Image from 'next/image';
import OrderListBubble from './OrderListBubble';
import InlineProductGrid from './InlineProductGrid';
import AssistantBubble from './AssistantBubble';
import { useStreamingChat } from '../../hooks/useStreamingChat';

const API_URL = process.env.NEXT_PUBLIC_SAAI_API || 'http://localhost:3001';

// Enable streaming mode (can be toggled via env var)
const USE_STREAMING = process.env.NEXT_PUBLIC_USE_STREAMING !== 'false';

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  orderId: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  summary: {
    totalItems: number;
    totalAmount: number;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  productSnapshot: Product;
}

interface CartSummary {
  totalItems: number;
  totalAmount: number;
}

interface ActionResult {
  type?: string;
  items?: Product[] | Record<string, Product>;
  products?: Product[];
  orders?: Order[];
  // Cart-specific fields
  addedItem?: Product;
  addedItems?: Product[];
  cartItems?: CartItem[];
  summary?: CartSummary;
  success?: boolean;
  // Order-specific fields
  order?: Order;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  imagePreview?: string;
  toolAction?: string;
  toolResult?: ActionResult;
  // New fields for message routing
  replyType?: 'message' | 'tool';
  actionResult?: ActionResult;
}

interface ChatPaneProps {
  tenant: string;
  sessionId: string;
  onHighlightProducts?: (ids: string[]) => void;
  onError?: (error: string) => void;
}

interface LlmResponse {
  text?: string;
  groundedText?: string;
  action?: string;
}

interface ApiData {
  replyType?: string;
  llm?: LlmResponse;
  actionResult?: { type?: string; items?: Product[] | Record<string, Product>; products?: Product[]; orders?: Order[] };
  reply?: string;
  matchedProductIds?: string[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractProductIds(toolResult: { type?: string; items?: Product[] | Record<string, Product>; products?: Product[] } | undefined): string[] {
  if (!toolResult) return [];
  
  // Handle array format
  if (Array.isArray(toolResult.items)) {
    return toolResult.items.map((p) => p.id);
  }
  if (Array.isArray(toolResult.products)) {
    return toolResult.products.map((p) => p.id);
  }
  
  // Handle outfit object format
  if (toolResult.type === 'outfit' && toolResult.items && typeof toolResult.items === 'object') {
    return Object.values(toolResult.items)
      .filter((item): item is Product => item !== null && typeof item === 'object' && 'id' in item)
      .map(p => p.id);
  }
  
  return [];
}

function processChatResponse(data: ApiData) {
  if (data.replyType === 'message') {
    return { replyText: data.llm?.text || '', toolAction: undefined, toolResult: undefined, matchedProductIds: [] as string[] };
  }
  if (data.replyType === 'tool') {
    const toolResult = data.actionResult;
    return {
      replyText: data.llm?.groundedText || '',
      toolAction: data.llm?.action,
      toolResult,
      matchedProductIds: extractProductIds(toolResult)
    };
  }
  return { replyText: '', toolAction: undefined, toolResult: undefined, matchedProductIds: [] as string[] };
}

function processLegacyResponse(data: ApiData) {
  return {
    replyText: data.reply || '',
    toolAction: undefined,
    toolResult: undefined,
    matchedProductIds: data.matchedProductIds || []
  };
}

function getMsgBubbleClass(msg: ChatMessage): string {
  if (msg.role === 'user') return 'bg-[#303030] text-white/90';
  if (msg.error) return 'bg-red-500/20 text-red-300';
  return 'bg-transparent';
}

interface ToolResultData {
  type?: string;
  items?: Product[] | Record<string, Product>;
  products?: Product[];
}

/**
 * Extract products array from tool result
 * Handles both array format (search/recommend) and object format (outfit)
 */
function getProductsArray(toolResult: ToolResultData): Product[] {
  if (!toolResult) return [];
  
  // If items is already an array, return it
  if (Array.isArray(toolResult.items)) {
    return toolResult.items;
  }
  
  // If products is an array, return it
  if (Array.isArray(toolResult.products)) {
    return toolResult.products;
  }
  
  // If items is an object (outfit format), convert to array
  if (toolResult.type === 'outfit' && toolResult.items && typeof toolResult.items === 'object') {
    return Object.values(toolResult.items).filter((item): item is Product => 
      item !== null && typeof item === 'object' && 'id' in item && 'name' in item && 'price' in item && 'category' in item
    );
  }
  
  return [];
}

async function sendChatRequest(endpoint: string, body: Record<string, unknown>) {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return resp.json();
}

type SetMessagesType = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

function handleApiResponse(
  data: ApiData & { success?: boolean; error?: string },
  id: string,
  endpoint: string,
  onHighlightProducts: ((ids: string[]) => void) | undefined,
  onError: ((error: string) => void) | undefined,
  setMessages: SetMessagesType
) {
  if (data.success) {
    const result = endpoint.includes('/chat') ? processChatResponse(data) : processLegacyResponse(data);
    setMessages(prev => [...prev, {
      id: `${id}-assistant`, role: 'assistant', text: result.replyText, toolAction: result.toolAction, toolResult: result.toolResult
    }]);
    if (onHighlightProducts && result.matchedProductIds.length > 0) {
      onHighlightProducts(result.matchedProductIds);
    }
  } else {
    setMessages(prev => [...prev, { id: `${id}-err`, role: 'assistant', text: data.error || 'Something went wrong.', error: true }]);
    onError?.(data.error || 'Error');
  }
}

export default function ChatPane({ tenant, sessionId, onHighlightProducts, onError }: Readonly<ChatPaneProps>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const { streamChat } = useStreamingChat();

  // Save recent products for context reference resolution
  const saveRecentProducts = useCallback((products: Product[]) => {
    setRecentProducts(products);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingText]);

  const handleImageSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError?.('Image must be smaller than 10MB');
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }, [onError]);

  const handleRemoveImage = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreviewUrl]);

  const handleSend = useCallback(async (textOverride?: string) => {
    const userText = typeof textOverride === 'string' ? textOverride : input.trim();
    if (!userText && !imageFile) return;
    if (isLoading) return;

    const id = Date.now().toString();
    const currentImagePreview = imagePreviewUrl;
    const history = messages.map(msg => ({ role: msg.role, content: msg.text }));

    setMessages(prev => [...prev, {
      id, role: 'user', text: userText || '(Image search)', imagePreview: currentImagePreview || undefined
    }]);
    setInput('');
    setIsLoading(true);

    let imageBase64: string | null = null;
    if (imageFile) {
      try { imageBase64 = await fileToBase64(imageFile); } catch (err) { console.error(err); }
    }

    // Use streaming for text-only requests, fallback for image requests
    if (!imageBase64 && USE_STREAMING) {
      // Streaming mode
      let accumulatedText = '';
      let toolResult: { type?: string; items?: Product[] | Record<string, Product>; products?: Product[] } | undefined;
      let toolAction: string | undefined;
      
      setStreamingText('');
      
      // Add placeholder assistant message
      const assistantId = `${id}-assistant`;
      setMessages(prev => [...prev, {
        id: assistantId, role: 'assistant', text: '', toolAction: undefined, toolResult: undefined
      }]);

      await streamChat(
        { tenant, sessionId, message: userText, history },
        {
          onChunk: (text) => {
            accumulatedText += text;
            setStreamingText(accumulatedText);
            // Update the message in real-time
            setMessages(prev => prev.map(msg => 
              msg.id === assistantId ? { ...msg, text: accumulatedText } : msg
            ));
          },
          onTool: (name) => {
            toolAction = name;
          },
          onProducts: (products, action) => {
            toolResult = { type: action === 'recommend_outfit' ? 'outfit' : 'recommendations', items: products };
            toolAction = action;
            // Save products for context reference (e.g., "the second product")
            saveRecentProducts(products);
            // Update message with products
            setMessages(prev => prev.map(msg => 
              msg.id === assistantId ? { ...msg, toolAction, toolResult } : msg
            ));
            // Highlight products
            const productIds = products.map(p => p.id);
            if (onHighlightProducts && productIds.length > 0) {
              onHighlightProducts(productIds);
            }
          },
          onComplete: () => {
            // Final update with all data
            setMessages(prev => prev.map(msg => 
              msg.id === assistantId ? { ...msg, text: accumulatedText, toolAction, toolResult } : msg
            ));
            setStreamingText('');
          },
          onError: (error) => {
            setMessages(prev => prev.map(msg => 
              msg.id === assistantId ? { ...msg, text: error || 'Something went wrong.', error: true } : msg
            ));
            onError?.(error);
          }
        }
      );
    } else {
      // Non-streaming mode (for image requests or when streaming is disabled)
      const endpoint = imageBase64 ? `${API_URL}/assistant/query` : `${API_URL}/chat`;
      const body = imageBase64 
        ? { tenantId: tenant, sessionId, message: userText || null, imageBase64, history }
        : { tenant, sessionId, message: userText || null, history };

      try {
        const data = await sendChatRequest(endpoint, body);
        handleApiResponse(data, id, endpoint, onHighlightProducts, onError, setMessages);
      } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { id: `${id}-err`, role: 'assistant', text: 'Network error. Please try again.', error: true }]);
        onError?.('Network error');
      }
    }

    setIsLoading(false);
    handleRemoveImage();
  }, [input, imageFile, imagePreviewUrl, isLoading, tenant, sessionId, messages, onHighlightProducts, onError, handleRemoveImage, streamChat, saveRecentProducts]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleAddToCart = async (product: Product) => {
    try {
      const res = await fetch(`${API_URL}/cart/${tenant}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, sessionId, quantity: 1 })
      });
      if (res.ok) {
        alert(`Added ${product.name} to cart!`);
      } else {
        alert('Failed to add to cart');
      }
    } catch (e) {
      console.error(e);
      alert('Error adding to cart');
    }
  };

  const canSend = (input.trim() || imageFile) && !isLoading;
  const hasStarted = messages.length > 0;

  // Dynamic suggestion pool - randomly picks 4 on initial render
  const [suggestions] = useState<string[]>(() => {
    const allSuggestions = [
      // 1. General Shopping Experience (Cross-Category)
      "I’m setting up my home office. What should I get?",
      "Recommend something for fitness and home workouts.",
      "I want a few healthy snacks for work.",
      "Give me a small list of self-care essentials I can buy.",
      "I need gift ideas under 2000.",

      // 2. Intelligent Product Discovery
      "Find me something for a weekend trip.",
      "Show me products to upgrade my work desk.",
      "I need something relaxing for sleep.",
      "Recommend eco-friendly items you have.",
      "I’m looking for premium items. What do you suggest?",

      // 3. Electronics & Accessories (Clear Reasoning)
      "Suggest accessories for my laptop.",
      "I want wireless audio options.",
      "Show me something useful for video calls.",
      "Give me a compact desk tech setup.",
      "Which items are good for productivity?",

      // 4. Fitness / Health / Lifestyle
      "Build me a basic home gym setup.",
      "Recommend essentials for a morning workout routine.",
      "I need something for muscle recovery.",
      "Show me healthy daily essentials.",
      "What should I buy for staying hydrated and active?",

      // 5. Clothing / Footwear / Bundle Logic
      "Make me a casual everyday outfit.",
      "Suggest something for a comfortable travel day.",
      "I want a simple, clean weekend look.",
      "Give me a sporty outfit.",
      "Change the shoes to something more comfortable.",

      // 6. Beauty, Self-Care, Cosmetics
      "Show me a simple skincare routine.",
      "Recommend something for dry skin.",
      "I want a small beauty gift.",
      "Give me products for a self-care night at home.",
      "Suggest essentials for daily grooming.",

      // 7. Home, Kitchen, Furniture
      "I’m furnishing a small living room. Suggest essentials.",
      "Recommend something for clean air at home.",
      "Show me your best coffee setup.",
      "I want a modern workspace. What do I need?",
      "Show me something for organizing my space."
    ];
    const shuffled = [...allSuggestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  });

  /**
   * Render assistant message based on replyType and actionResult
   * Handles: checkout, cart add (single/multi), cart view, similar products, product grid, text
   */
  const renderAssistantMessage = (msg: ChatMessage) => {
    const toolResult = msg.toolResult || msg.actionResult;
    const toolAction = msg.toolAction;
    
    // 1. Checkout / order confirmation
    if (toolResult?.type === 'order' || toolAction === 'checkout') {
      const order = toolResult?.order;
      const total = toolResult?.summary?.totalAmount || 0;
      if (order || toolResult?.success) {
        return (
          <AssistantBubble>
            <span>🎉 <strong>Order Confirmed!</strong></span><br />
            {order?.orderId && <span>Order ID: {order.orderId}<br /></span>}
            {total > 0 && <span>Total: ${total}<br /></span>}
            <span>Delivered to your saved address.</span>
          </AssistantBubble>
        );
      }
    }

    // 2. Add multiple items to cart
    if ((toolResult?.type === 'cart' || toolAction === 'add_multiple_to_cart') && 
        toolResult?.addedItems && toolResult.addedItems.length > 1) {
      return (
        <AssistantBubble>
          <span>🛒 <strong>Added to cart:</strong></span><br />
          {toolResult.addedItems.map((p: Product) => (
            <div key={p.id}>• {p.name}</div>
          ))}
          <br />
          {toolResult.summary && <span>Total: ${toolResult.summary.totalAmount}</span>}
        </AssistantBubble>
      );
    }

    // 3. Add single item to cart
    if ((toolResult?.type === 'cart' || toolAction === 'add_to_cart') && 
        (toolResult?.addedItem || toolResult?.addedItems?.length === 1)) {
      const p = toolResult.addedItem || toolResult.addedItems?.[0];
      if (p) {
        return (
          <AssistantBubble>
            🛒 Added <strong>{p.name}</strong> to your cart.
          </AssistantBubble>
        );
      }
    }

    // 4. View cart
    if (toolResult?.type === 'cart_view' || toolAction === 'view_cart') {
      const cartItems = (toolResult?.cartItems || toolResult?.items) as CartItem[] | undefined;
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        return (
          <AssistantBubble>
            <strong>Your Cart:</strong><br />
            {cartItems.map((item) => (
              <div key={item.productId}>
                {item.productSnapshot?.name || item.productId} – ${item.productSnapshot?.price || 0}
              </div>
            ))}
            <br />
            {toolResult?.summary && <span>Total: ${toolResult.summary.totalAmount}</span>}
          </AssistantBubble>
        );
      }
      // Empty cart
      return (
        <AssistantBubble>
          🛒 Your cart is empty. Start shopping!
        </AssistantBubble>
      );
    }

    // 5. View orders
    if (toolAction === 'view_orders' && toolResult?.orders) {
      return (
        <div className="mt-3">
          <OrderListBubble 
            orders={toolResult.orders} 
            onCancelOrder={(orderId) => handleSend(`Cancel order ${orderId}`)} 
          />
        </div>
      );
    }

    // 6. Similar products (similarity search)
    if (toolResult?.type === 'similar_products') {
      const products = toolResult.products || getProductsArray(toolResult);
      if (products.length > 0) {
        saveRecentProducts(products);
        return <InlineProductGrid products={products} onAddToCart={handleAddToCart} />;
      }
    }

    // 7. Product recommendations / search / outfit
    const products = getProductsArray(toolResult || {});
    if (products.length > 0) {
      saveRecentProducts(products);
      return (
        <>
          {msg.text && (
            <AssistantBubble>{msg.text}</AssistantBubble>
          )}
          <InlineProductGrid products={products} onAddToCart={handleAddToCart} />
        </>
      );
    }

    // 8. Default text response
    if (msg.text) {
      return (
        <AssistantBubble>
          {msg.text}
        </AssistantBubble>
      );
    }

    // Fallback
    return (
      <AssistantBubble>
        I&apos;m here to help!
      </AssistantBubble>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#191A1A] text-white relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 md:px-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-sm">🛍️</span>
          </div>
          <span className="font-semibold text-white/90 tracking-tight">SAAI</span>
        </div>
      </header>

      {hasStarted ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className="max-w-3xl mx-auto">
                <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs">🛍️</div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                    {msg.imagePreview && (
                      <div className="mb-2 rounded-xl overflow-hidden inline-block border border-white/10">
                        <Image src={msg.imagePreview} alt="Uploaded" width={180} height={135} className="object-cover" />
                      </div>
                    )}
                    {msg.role === 'user' ? (
                      <div className={`rounded-2xl px-4 py-3 ${getMsgBubbleClass(msg)}`}>
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      </div>
                    ) : (
                      renderAssistantMessage(msg)
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-[#404040] flex items-center justify-center text-xs">👤</div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="max-w-3xl mx-auto flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs">🛍️</div>
                <div className="flex items-center gap-1.5 h-7">
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar - Fixed Bottom */}
          <div className="p-4 md:px-6 border-t border-white/10 bg-[#191A1A]">
            <div className="max-w-3xl mx-auto">
              {imagePreviewUrl && (
                <div className="mb-3 inline-block relative">
                  <Image src={imagePreviewUrl} alt="Preview" width={64} height={64} className="rounded-lg object-cover border border-white/20" />
                  <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">×</button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-[#303030] rounded-full px-2 py-1.5 border border-white/10 focus-within:border-white/20 transition-colors">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" title="Upload image" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50" aria-label="Upload image">
                  <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything..." disabled={isLoading} className="flex-1 bg-transparent text-white/90 placeholder-white/40 text-[15px] py-2 px-1 focus:outline-none disabled:cursor-not-allowed" />
                <button onClick={() => handleSend()} disabled={!canSend} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-95 disabled:bg-white/20 disabled:text-white/40 transition-all" aria-label="Send">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        // HERO MODE
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl text-center space-y-8">
            <h1 className="text-3xl md:text-4xl font-medium text-white/95 tracking-tight">
              What can I help you find?
            </h1>
            
            {/* Hero Input */}
            <div className="relative">
              {imagePreviewUrl && (
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 inline-block">
                  <Image src={imagePreviewUrl} alt="Preview" width={72} height={72} className="rounded-xl object-cover border border-white/20" />
                  <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">×</button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-[#303030] rounded-full px-3 py-2 border border-white/10 focus-within:border-white/25 shadow-lg transition-all">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" title="Upload image" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Upload image">
                  <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search for products, ask questions..." disabled={isLoading} className="flex-1 bg-transparent text-white placeholder-white/40 text-lg py-2 px-1 focus:outline-none" autoFocus />
                <button onClick={() => handleSend()} disabled={!canSend} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-95 disabled:bg-white/20 disabled:text-white/40 transition-all" aria-label="Send">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => handleSend(suggestion)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/70 hover:text-white/90 transition-colors">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
