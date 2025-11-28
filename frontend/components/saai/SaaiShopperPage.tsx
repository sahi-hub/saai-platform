'use client';

import React, { useState, useCallback } from 'react';
import ChatPane from './ChatPane';

interface SaaiShopperPageProps {
  tenant: string;
}

/**
 * SaaiShopperPage - Main SAAI Shopping Assistant Page
 * 
 * Full-screen dark mode UI inspired by Perplexity AI
 * Optimized for both desktop and mobile
 */
export default function SaaiShopperPage({ tenant }: Readonly<SaaiShopperPageProps>) {
  // Generate a session ID for this browsing session
  const [sessionId] = useState(() => `saai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const handleHighlightProducts = useCallback((ids: string[]) => {
    // Log for debugging - products are displayed inline in chat
    console.log('[SaaiShopperPage] Highlighted products:', ids);
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('[SaaiShopperPage] Error:', error);
  }, []);

  return (
    <div className="saai-root fixed inset-0 bg-[#191A1A]">
      <ChatPane
        tenant={tenant}
        sessionId={sessionId}
        onHighlightProducts={handleHighlightProducts}
        onError={handleError}
      />
    </div>
  );
}
