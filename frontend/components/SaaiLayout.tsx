'use client';

import React, { useState, ReactNode } from 'react';
import SidePanel from '@/components/SidePanel';
import { Theme } from '@/config/tenant';
import { ProductItem } from '@/components/ProductCard';

interface CartSummary {
  totalItems: number;
  totalAmount: number;
}

interface OutfitItems {
  shirt?: ProductItem;
  pant?: ProductItem;
  shoe?: ProductItem;
}

interface SaaiLayoutProps {
  theme: Theme;
  children: ReactNode;
  recommendations: ProductItem[] | null;
  outfit: OutfitItems | null;
  cartSummary: CartSummary | null;
  onCheckout: () => void;
  onAddToCart: (productId: string) => void;
}

/**
 * SaaiLayout - Main layout with chat and side panel
 * 
 * Desktop: Two columns (chat ~65-70%, side panel ~30-35%)
 * Mobile: Side panel collapses to bottom drawer toggle
 */
export default function SaaiLayout({
  theme,
  children,
  recommendations,
  outfit,
  cartSummary,
  onCheckout,
  onAddToCart
}: Readonly<SaaiLayoutProps>) {
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  const hasCartItems = cartSummary && cartSummary.totalItems > 0;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 md:border-r md:border-slate-200">
        {children}
      </div>

      {/* Side Panel - Desktop */}
      <div className="hidden md:flex md:w-80 lg:w-96 flex-shrink-0">
        <SidePanel
          theme={theme}
          recommendations={recommendations}
          outfit={outfit}
          cartSummary={cartSummary}
          onCheckout={onCheckout}
          onAddToCart={onAddToCart}
        />
      </div>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
        className="md:hidden fixed bottom-20 right-4 z-50 p-3 rounded-full shadow-lg text-white flex items-center gap-2"
        style={{ backgroundColor: theme.primaryColor }}
        aria-label="Toggle shopping panel"
      >
        {hasCartItems ? (
          <>
            <span className="text-lg">🛒</span>
            <span className="text-sm font-medium">
              {cartSummary.totalItems}
            </span>
          </>
        ) : (
          <span className="text-lg">🛍️</span>
        )}
      </button>

      {/* Mobile Side Panel Drawer */}
      {isSidePanelOpen && (
        <>
          {/* Backdrop */}
          <button 
            type="button"
            className="md:hidden fixed inset-0 bg-black/50 z-40 border-0 cursor-default"
            onClick={() => setIsSidePanelOpen(false)}
            aria-label="Close panel"
          />
          
          {/* Drawer */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] bg-white rounded-t-2xl shadow-2xl overflow-hidden animate-slide-up">
            {/* Drag Handle */}
            <button 
              type="button"
              className="w-full flex justify-center py-2 cursor-pointer border-0 bg-transparent"
              onClick={() => setIsSidePanelOpen(false)}
              aria-label="Close panel"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </button>
            
            <div className="h-[65vh] overflow-hidden">
              <SidePanel
                theme={theme}
                recommendations={recommendations}
                outfit={outfit}
                cartSummary={cartSummary}
                onCheckout={() => {
                  onCheckout();
                  setIsSidePanelOpen(false);
                }}
                onAddToCart={(id) => {
                  onAddToCart(id);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
