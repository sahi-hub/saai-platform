'use client';

import React from 'react';
import Image from 'next/image';
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

interface SidePanelProps {
  theme: Theme;
  recommendations: ProductItem[] | null;
  outfit: OutfitItems | null;
  cartSummary: CartSummary | null;
  onCheckout?: () => void;
  onAddToCart?: (productId: string) => void;
}

/**
 * Mini product card for side panel (compact version)
 */
function MiniProductCard({ 
  item, 
  theme, 
  onAdd 
}: { 
  item: ProductItem; 
  theme: Theme; 
  onAdd?: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      {/* Product Image */}
      <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
        <Image
          src={item.imageUrl || '/placeholder-product.png'}
          alt={item.name}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
      
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-slate-800 truncate">
          {item.name}
        </h4>
        <p className="text-xs text-slate-500 truncate">
          {item.category}
        </p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">
          {item.currency} {item.price.toFixed(0)}
        </p>
      </div>

      {/* Add Button */}
      {onAdd && (
        <button
          onClick={() => onAdd(item.id)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          style={{ color: theme.primaryColor }}
          aria-label={`Add ${item.name} to cart`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Side Panel Component
 * Shows recommendations/outfit and cart summary
 */
export default function SidePanel({
  theme,
  recommendations,
  outfit,
  cartSummary,
  onCheckout,
  onAddToCart
}: SidePanelProps) {
  const hasOutfit = outfit && (outfit.shirt || outfit.pant || outfit.shoe);
  const hasRecommendations = recommendations && recommendations.length > 0;
  const hasCart = cartSummary && cartSummary.totalItems > 0;

  return (
    <div className="h-full flex flex-col bg-slate-50 border-l border-slate-200">
      {/* Panel Header */}
      <div 
        className="px-4 py-3 border-b border-slate-200"
        style={{ backgroundColor: `${theme.primaryColor}10` }}
      >
        <h2 
          className="text-lg font-semibold"
          style={{ color: theme.primaryColor }}
        >
          Shopping Assistant
        </h2>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Outfit Section */}
        {hasOutfit && (
          <section>
            <h3 
              className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
              style={{ color: theme.primaryColor }}
            >
              <span>👔</span>
              Your Outfit
            </h3>
            <div className="space-y-2">
              {outfit.shirt && (
                <MiniProductCard 
                  item={outfit.shirt} 
                  theme={theme} 
                  onAdd={onAddToCart}
                />
              )}
              {outfit.pant && (
                <MiniProductCard 
                  item={outfit.pant} 
                  theme={theme} 
                  onAdd={onAddToCart}
                />
              )}
              {outfit.shoe && (
                <MiniProductCard 
                  item={outfit.shoe} 
                  theme={theme} 
                  onAdd={onAddToCart}
                />
              )}
            </div>
          </section>
        )}

        {/* Recommendations Section */}
        {hasRecommendations && !hasOutfit && (
          <section>
            <h3 
              className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
              style={{ color: theme.primaryColor }}
            >
              <span>✨</span>
              Recommended for You
            </h3>
            <div className="space-y-2">
              {recommendations.slice(0, 5).map((item) => (
                <MiniProductCard 
                  key={item.id} 
                  item={item} 
                  theme={theme}
                  onAdd={onAddToCart}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!hasOutfit && !hasRecommendations && (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-3">🛍️</div>
            <p className="text-sm">
              Ask me for recommendations<br />
              or help finding an outfit!
            </p>
          </div>
        )}
      </div>

      {/* Cart Summary Footer */}
      <div className="border-t border-slate-200 p-4 bg-white">
        <h3 
          className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
          style={{ color: theme.primaryColor }}
        >
          <span>🛒</span>
          Your Cart
        </h3>
        
        {hasCart ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-sm">
                {cartSummary.totalItems} item{cartSummary.totalItems !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold">
                ₹{cartSummary.totalAmount.toFixed(0)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: theme.primaryColor }}
            >
              Checkout
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-2">
            Your cart is empty
          </p>
        )}
      </div>
    </div>
  );
}
