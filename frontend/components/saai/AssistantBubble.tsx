'use client';

import React from 'react';

interface AssistantBubbleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Styled bubble component for assistant messages
 * Used for text responses, confirmations, and cart/order summaries
 */
export default function AssistantBubble({ children, className = '' }: AssistantBubbleProps) {
  return (
    <div className={`rounded-2xl px-4 py-3 bg-transparent ${className}`}>
      <div className="text-[15px] leading-relaxed text-white/80">
        {children}
      </div>
    </div>
  );
}
