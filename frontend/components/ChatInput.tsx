'use client';

import React, { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({ 
  onSendMessage, 
  placeholder = 'Type a message...',
  disabled = false
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Text Input */}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-4 py-3 rounded-full border border-slate-300 bg-slate-50 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   text-slate-800 placeholder-slate-400 text-[15px]
                   disabled:bg-slate-100 disabled:cursor-not-allowed
                   transition-all duration-200"
      />

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 
                   text-white flex items-center justify-center shadow-md
                   hover:from-blue-600 hover:to-blue-700 active:scale-95
                   disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed
                   transition-all duration-200"
        aria-label="Send message"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={2} 
          stroke="currentColor" 
          className="w-5 h-5"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" 
          />
        </svg>
      </button>
    </div>
  );
}
