'use client';

import React, { useState, useCallback } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
  colors?: string[];
  tags?: string[];
  rating?: number;
  inStock?: boolean;
}

interface InlineProductGridProps {
  products: Product[];
  onAddToCart?: (product: Product) => void;
  isLoading?: boolean;
}

const getCategoryEmoji = (category: string): string => {
  const emojiMap: Record<string, string> = {
    electronics: '????',
    accessories: '???',
    beauty: '????',
    grocery: '????',
    clothing: '????',
    fitness: '????',
    footwear: '????',
    furniture: '???????',
    home: '????',
  };
  return emojiMap[category?.toLowerCase()] || '????';
};

const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    electronics: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    accessories: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    beauty: 'from-rose-500/20 to-pink-500/20 border-rose-500/30',
    grocery: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    clothing: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30',
    fitness: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
    footwear: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
    furniture: 'from-stone-500/20 to-neutral-500/20 border-stone-500/30',
    home: 'from-teal-500/20 to-cyan-500/20 border-teal-500/30',
  };
  return colorMap[category?.toLowerCase()] || 'from-gray-500/20 to-slate-500/20 border-gray-500/30';
};

export default function InlineProductGrid({ products, onAddToCart, isLoading = false }: InlineProductGridProps) {
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());

  const handleAddToCart = useCallback(async (product: Product) => {
    if (addingToCart || addedToCart.has(product.id)) return;
    
    setAddingToCart(product.id);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (onAddToCart) {
      onAddToCart(product);
    }
    
    setAddedToCart(prev => new Set(prev).add(product.id));
    setAddingToCart(null);
    
    // Reset after 2 seconds
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  }, [addingToCart, addedToCart, onAddToCart]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gradient-to-br from-[#2A2B2B] to-[#232424] rounded-xl p-3 animate-pulse"
          >
            <div className="aspect-square bg-[#3A3B3B] rounded-lg mb-3" />
            <div className="h-4 bg-[#3A3B3B] rounded mb-2 w-3/4" />
            <div className="h-3 bg-[#3A3B3B] rounded mb-3 w-1/2" />
            <div className="h-8 bg-[#3A3B3B] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <span className="text-4xl mb-3">????</span>
        <p className="text-sm">No products found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
      {products.map((product, index) => {
        const isAdding = addingToCart === product.id;
        const isAdded = addedToCart.has(product.id);
        const categoryColor = getCategoryColor(product.category);
        const categoryEmoji = getCategoryEmoji(product.category);
        
        return (
          <div
            key={product.id}
            className={`group relative bg-gradient-to-br ${categoryColor} backdrop-blur-sm rounded-xl p-3 border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
            style={{
              animationDelay: `${index * 50}ms`,
              animation: 'fadeSlideIn 0.4s ease-out forwards',
              opacity: 0,
            }}
          >
            {/* Category Badge */}
            <div className="absolute top-2 right-2 z-10">
              <span className="text-lg" title={product.category}>
                {categoryEmoji}
              </span>
            </div>

            {/* Product Image */}
            <div className="aspect-square bg-[#1A1B1B]/50 rounded-lg mb-3 overflow-hidden relative">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl opacity-50">
                  {categoryEmoji}
                </div>
              )}
              
              {/* Stock Badge */}
              {product.inStock === false && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-red-400 text-xs font-medium px-2 py-1 bg-red-500/20 rounded">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-1.5">
              <h3 className="font-medium text-white text-sm leading-tight line-clamp-2 group-hover:text-white/90 transition-colors">
                {product.name}
              </h3>
              
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-base">
                  ${product.price.toFixed(2)}
                </span>
                {product.rating && (
                  <span className="text-yellow-400 text-xs flex items-center gap-0.5">
                    ??? {product.rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Colors */}
              {product.colors && product.colors.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {product.colors.slice(0, 4).map((color, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: color.toLowerCase() }}
                      title={color}
                    />
                  ))}
                  {product.colors.length > 4 && (
                    <span className="text-xs text-gray-400">+{product.colors.length - 4}</span>
                  )}
                </div>
              )}
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={() => handleAddToCart(product)}
              disabled={isAdding || isAdded || product.inStock === false}
              className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                isAdded
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : isAdding
                  ? 'bg-white/5 text-gray-400 border border-white/10'
                  : product.inStock === false
                  ? 'bg-gray-500/20 text-gray-500 border border-gray-500/30 cursor-not-allowed'
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 active:scale-95'
              }`}
            >
              {isAdding ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adding...
                </>
              ) : isAdded ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Added!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Add to Cart
                </>
              )}
            </button>
          </div>
        );
      })}
      
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
