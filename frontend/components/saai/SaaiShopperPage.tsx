'use client';

import React, { useState, useCallback } from 'react';
import ChatPane from './ChatPane';
import ProductGridPane from './ProductGridPane';

interface SaaiShopperPageProps {
  tenant: string;
}

/**
 * SaaiShopperPage - Main SAAI Shopping Assistant Page
 * 
 * Layout:
 * - Desktop: flex row, left (chat) ~60%, right (products) ~40%
 * - Mobile: stack vertically (chat first, products second)
 * 
 * Features:
 * - Text-based chat with AI assistant
 * - Image-based product search
 * - Product grid with search and AI highlighting
 */
export default function SaaiShopperPage({ tenant }: Readonly<SaaiShopperPageProps>) {
  // Generate a session ID for this browsing session
  const [sessionId] = useState(() => `saai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  
  // Product IDs to highlight (from AI responses)
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  
  // Global error state (optional - for toast notifications)
  const [, setGlobalError] = useState<string | null>(null);

  const handleHighlightProducts = useCallback((ids: string[]) => {
    setHighlightedIds(ids);
  }, []);

  const handleError = useCallback((error: string) => {
    setGlobalError(error);
    // Could show a toast notification here
    console.error('[SaaiShopperPage] Error:', error);
  }, []);

  return (
    <div className="saai-root min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="saai-shell bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Left Pane - Chat */}
        <div className="saai-left flex-1 md:w-[60%] lg:w-[62%] flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-200">
          <ChatPane
            tenant={tenant}
            sessionId={sessionId}
            onHighlightProducts={handleHighlightProducts}
            onError={handleError}
          />
        </div>
        
        {/* Right Pane - Products */}
        <div className="saai-right md:w-[40%] lg:w-[38%] flex flex-col min-h-0 overflow-hidden">
          <ProductGridPane
            tenant={tenant}
            highlightedIds={highlightedIds}
          />
        </div>
      </div>
    </div>
  );
}
