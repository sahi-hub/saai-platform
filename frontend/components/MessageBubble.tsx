'use client';

import React from 'react';

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  headerTitle: string;
  logoUrl: string;
}

interface MessageBubbleProps {
  message: string;
  sender: 'user' | 'saai';
  timestamp?: string;
  isLoading?: boolean;
  theme?: Theme;
}

export default function MessageBubble({ 
  message, 
  sender, 
  timestamp,
  isLoading = false,
  theme
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  
  // Get SAAI bubble color from theme or use default
  const saaiBackgroundColor = theme?.primaryColor || '#4A90E2';

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
              {message}
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
