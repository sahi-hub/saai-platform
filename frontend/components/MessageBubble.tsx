'use client';

import React from 'react';
import ProductListBubble from './ProductListBubble';
import OutfitBubble from './OutfitBubble';
import { ProductItem } from './ProductCard';

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  headerTitle: string;
  logoUrl: string;
}

interface OutfitItems {
  shirt?: ProductItem;
  pant?: ProductItem;
  shoe?: ProductItem;
}

// Support text messages, recommendations, and outfit messages
type MessageContent = 
  | string 
  | { type: 'text'; text: string; }
  | { type: 'recommendations'; items: ProductItem[]; }
  | { type: 'outfit'; items: OutfitItems; };

interface MessageBubbleProps {
  message: MessageContent;
  sender: 'user' | 'saai';
  timestamp?: string;
  isLoading?: boolean;
  theme?: Theme;
  onAddToCart?: (productId: string) => void;
  onAddMultipleToCart?: (productIds: string[]) => void;
}

export default function MessageBubble({ 
  message, 
  sender, 
  timestamp,
  isLoading = false,
  theme,
  onAddToCart,
  onAddMultipleToCart
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  
  // Get SAAI bubble color from theme or use default
  const saaiBackgroundColor = theme?.primaryColor || '#4A90E2';

  // Check message type
  const isRecommendation = typeof message === 'object' && message.type === 'recommendations';
  const isOutfit = typeof message === 'object' && message.type === 'outfit';
  const isExplicitText = typeof message === 'object' && message.type === 'text';

  // If this is an outfit message, render OutfitBubble
  if (isOutfit && !isUser) {
    return (
      <div className="flex justify-start">
        <div className="flex flex-col max-w-[90%] sm:max-w-[80%]">
          {/* Sender Label */}
          <span className="text-xs font-medium mb-1 px-1 text-left text-slate-600">
            SAAI
          </span>

          {/* Outfit Bubble */}
          <OutfitBubble 
            items={message.items}
            theme={theme || { primaryColor: saaiBackgroundColor, secondaryColor: '#FFFFFF', headerTitle: 'SAAI', logoUrl: '' }}
            onAddSingle={onAddToCart || (() => {})}
            onAddAll={onAddMultipleToCart || (() => {})}
          />

          {/* Timestamp */}
          {timestamp && (
            <span className="text-[11px] text-slate-400 mt-1 px-1 text-left">
              {timestamp}
            </span>
          )}
        </div>
      </div>
    );
  }

  // If this is a recommendation message, render ProductListBubble
  if (isRecommendation && !isUser) {
    return (
      <div className="flex justify-start">
        <div className="flex flex-col max-w-[90%] sm:max-w-[80%]">
          {/* Sender Label */}
          <span className="text-xs font-medium mb-1 px-1 text-left text-slate-600">
            SAAI
          </span>

          {/* Product List */}
          <ProductListBubble 
            items={message.items}
            theme={theme || { primaryColor: saaiBackgroundColor, secondaryColor: '#FFFFFF', headerTitle: 'SAAI', logoUrl: '' }}
            onAdd={onAddToCart || (() => {})}
          />

          {/* Timestamp */}
          {timestamp && (
            <span className="text-[11px] text-slate-400 mt-1 px-1 text-left">
              {timestamp}
            </span>
          )}
        </div>
      </div>
    );
  }

  // For text messages, extract the string
  // Handle both plain strings and explicit { type: 'text', text: '...' } format
  let textMessage = '';
  if (typeof message === 'string') {
    textMessage = message;
  } else if (isExplicitText && 'text' in message) {
    textMessage = message.text;
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col max-w-[80%] sm:max-w-[70%]`}>
        {/* Sender Label */}
        <span className={`text-xs font-medium mb-1 px-1 ${
          isUser ? 'text-right text-slate-600' : 'text-left text-slate-600'
        }`}>
          {isUser ? 'You' : 'SAAI'}
        </span>

        {/* Message Bubble */}
        <div 
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser 
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm' 
              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
          }`}
          style={
            !isUser && theme
              ? { 
                  backgroundColor: saaiBackgroundColor,
                  color: '#ffffff',
                  borderColor: saaiBackgroundColor
                }
              : undefined
          }
        >
          {isLoading ? (
            // Loading indicator with pulsing dots
            <div className="flex items-center space-x-1">
              <div 
                className="w-2 h-2 rounded-full animate-pulse" 
                style={{ 
                  backgroundColor: !isUser && theme ? '#ffffff' : '#94a3b8',
                  animationDelay: '0ms' 
                }}
              ></div>
              <div 
                className="w-2 h-2 rounded-full animate-pulse" 
                style={{ 
                  backgroundColor: !isUser && theme ? '#ffffff' : '#94a3b8',
                  animationDelay: '150ms' 
                }}
              ></div>
              <div 
                className="w-2 h-2 rounded-full animate-pulse" 
                style={{ 
                  backgroundColor: !isUser && theme ? '#ffffff' : '#94a3b8',
                  animationDelay: '300ms' 
                }}
              ></div>
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {textMessage}
            </p>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span className={`text-[11px] text-slate-400 mt-1 px-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}>
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
