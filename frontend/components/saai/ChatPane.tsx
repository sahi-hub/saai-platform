'use client';

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_SAAI_API || 'http://localhost:3001';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  imagePreview?: string; // For showing uploaded image in user message
}

interface ChatPaneProps {
  tenant: string;
  sessionId: string;
  onHighlightProducts?: (ids: string[]) => void;
  onError?: (error: string) => void;
}

/**
 * Helper to convert File to base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * ChatPane - Text chat + image upload component
 * 
 * Features:
 * - Text message input
 * - Image upload with preview
 * - Typing indicator
 * - Auto-scroll to bottom
 * - Error handling
 */
export default function ChatPane({
  tenant,
  sessionId,
  onHighlightProducts,
  onError
}: Readonly<ChatPaneProps>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Handle image file selection
  const handleImageSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        onError?.('Please select an image file');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        onError?.('Image must be smaller than 10MB');
        return;
      }
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  }, [onError]);

  // Remove selected image
  const handleRemoveImage = useCallback(() => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreviewUrl]);

  // Send message handler
  const handleSend = useCallback(async () => {
    if (!input.trim() && !imageFile) return;
    if (isLoading) return;

    const userText = input.trim();
    const id = Date.now().toString();
    const currentImagePreview = imagePreviewUrl;

    // Build conversation history from existing messages (for contextual awareness)
    const history = messages.map(msg => ({
      role: msg.role,
      content: msg.text
    }));

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      id,
      role: 'user',
      text: userText || '(Image search)',
      imagePreview: currentImagePreview || undefined
    };
    
    setMessages((prev) => [...prev, newUserMessage]);

    setInput('');
    setIsLoading(true);

    let imageBase64: string | null = null;

    if (imageFile) {
      try {
        imageBase64 = await fileToBase64(imageFile);
      } catch (err) {
        console.error('[ChatPane] Error converting image:', err);
      }
    }

    try {
      const resp = await fetch(`${API_URL}/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant,
          sessionId,
          message: userText || null,
          imageBase64,
          // Send conversation history for contextual awareness
          history
        })
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        const errorText = data.error || 'Something went wrong while talking to SAAI.';
        setMessages((prev) => [
          ...prev,
          {
            id: `${id}-err`,
            role: 'assistant',
            text: errorText,
            error: true
          }
        ]);
        onError?.(errorText);
        return;
      }

      // Add assistant reply
      setMessages((prev) => [
        ...prev,
        {
          id: `${id}-assistant`,
          role: 'assistant',
          text: data.reply
        }
      ]);

      // Tell parent which products to highlight
      if (onHighlightProducts && Array.isArray(data.matchedProductIds)) {
        onHighlightProducts(data.matchedProductIds);
      }
    } catch (err) {
      console.error('[ChatPane] Network error:', err);
      const errorText = 'Network error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: `${id}-err2`,
          role: 'assistant',
          text: errorText,
          error: true
        }
      ]);
      onError?.(errorText);
    } finally {
      setIsLoading(false);
      handleRemoveImage();
    }
  }, [input, imageFile, imagePreviewUrl, isLoading, tenant, sessionId, messages, onHighlightProducts, onError, handleRemoveImage]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const canSend = (input.trim() || imageFile) && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 bg-linear-to-r from-emerald-500 to-blue-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-2xl">🛍️</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">SAAI</h1>
              <p className="text-sm text-white/80">Your AI Shopping Assistant</p>
            </div>
          </div>
          <button 
            type="button"
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="View cart"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-full bg-linear-to-br from-emerald-100 to-blue-100 flex items-center justify-center mb-4">
              <span className="text-4xl">👋</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Welcome to SAAI!</h2>
            <p className="text-slate-500 max-w-sm">
              I can help you find the perfect products. Try asking me about styles, 
              or upload an image to find similar items!
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : msg.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                    : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-bl-md'
              }`}
            >
              {/* Show image preview for user messages with images */}
              {msg.imagePreview && (
                <div className="mb-2 rounded-lg overflow-hidden">
                  <Image
                    src={msg.imagePreview}
                    alt="Uploaded image"
                    width={200}
                    height={150}
                    className="object-cover"
                  />
                </div>
              )}
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-700 shadow-sm border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="typing-indicator flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
        {/* Image Preview */}
        {imagePreviewUrl && (
          <div className="mb-3 relative inline-block">
            <Image
              src={imagePreviewUrl}
              alt="Selected image"
              width={80}
              height={80}
              className="rounded-lg object-cover border border-slate-200"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              aria-label="Remove image"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Upload image"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask SAAI anything..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-full border border-slate-300 bg-slate-50 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       text-slate-800 placeholder-slate-400 text-[15px]
                       disabled:bg-slate-100 disabled:cursor-not-allowed
                       transition-all duration-200"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="w-11 h-11 rounded-full bg-linear-to-br from-emerald-500 to-blue-500 
                       text-white flex items-center justify-center shadow-md
                       hover:from-emerald-600 hover:to-blue-600 active:scale-95
                       disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed
                       transition-all duration-200"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
