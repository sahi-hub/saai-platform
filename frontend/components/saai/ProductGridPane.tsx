'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';

const API_URL = process.env.NEXT_PUBLIC_SAAI_API || 'http://localhost:3001';

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  tags?: string[];
}

interface ProductGridPaneProps {
  tenant: string;
  highlightedIds: string[];
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get emoji for product category
 */
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    shirt: '👔',
    pant: '👖',
    pants: '👖',
    shoes: '👟',
    jacket: '🧥',
    kurta: '🥻',
    accessories: '⌚',
    watch: '⌚',
    sunglasses: '🕶️',
    bag: '👜',
    belt: '🥋',
    tie: '👔'
  };
  return emojiMap[category?.toLowerCase()] || '🛍️';
}

/**
 * ProductGridPane - Product grid with search and highlighting
 * 
 * Features:
 * - Load products from API
 * - Search filter
 * - AI-based product highlighting
 * - Skeleton loading state
 * - Add to cart button
 */
export default function ProductGridPane({
  tenant,
  highlightedIds
}: Readonly<ProductGridPaneProps>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all products on mount
  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        setError(null);
        const resp = await fetch(`${API_URL}/products/${tenant}`);
        const data = await resp.json();
        
        if (!data.success) {
          setError(data.error || 'Failed to load products.');
          setProducts([]);
          setFiltered([]);
          return;
        }
        
        setProducts(data.products || []);
        setFiltered(data.products || []);
      } catch (err) {
        console.error('[ProductGridPane] Load error:', err);
        setError('Network error while loading products.');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadProducts();
  }, [tenant]);

  // Handle search with debounce
  const handleSearch = useCallback(async (value: string) => {
    setSearch(value);
    
    if (!value.trim()) {
      setFiltered(products);
      return;
    }

    try {
      const resp = await fetch(`${API_URL}/products/${tenant}?q=${encodeURIComponent(value.trim())}`);
      const data = await resp.json();
      
      if (data.success) {
        setFiltered(data.products || []);
      } else {
        // Fallback to local filter
        const q = value.toLowerCase();
        setFiltered(products.filter(p => 
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q) ||
          p.tags?.some(t => t.toLowerCase().includes(q))
        ));
      }
    } catch (err) {
      console.error('[ProductGridPane] Search error:', err);
      // Fallback to local filter on error
      const q = value.toLowerCase();
      setFiltered(products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      ));
    }
  }, [tenant, products]);

  // Debounced search handler
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    
    // Debounce the API call
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [handleSearch]);

  // Sort products: highlighted ones first
  const sortedProducts = [...filtered].sort((a, b) => {
    const aHighlighted = highlightedIds.includes(a.id);
    const bHighlighted = highlightedIds.includes(b.id);
    if (aHighlighted && !bHighlighted) return -1;
    if (!aHighlighted && bHighlighted) return 1;
    return 0;
  });

  // Handle add to cart (placeholder)
  const handleAddToCart = useCallback((product: Product) => {
    console.log('[ProductGridPane] Add to cart:', product.id, product.name);
    // TODO: Integrate with cart API or chat
    alert(`Added ${product.name} to cart!`);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-white border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Products</h2>
        
        {/* Search Input */}
        <div className="relative">
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50
                       text-sm text-slate-700 placeholder-slate-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-all duration-200"
          />
        </div>
        
        {/* Results count */}
        <p className="text-xs text-slate-500 mt-2">
          {isLoading ? 'Loading...' : `${filtered.length} products`}
          {highlightedIds.length > 0 && ` • ${highlightedIds.length} highlighted`}
        </p>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`skeleton-${i + 1}`} className="bg-white rounded-xl p-3 animate-pulse">
                <div className="w-12 h-12 bg-slate-200 rounded-lg mb-3" />
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-full mb-2" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-2xl">🔍</span>
            </div>
            <p className="text-slate-500">No products found</p>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setFiltered(products); }}
                className="mt-2 text-sm text-blue-500 hover:text-blue-600"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Product Cards */}
        {!isLoading && !error && sortedProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedProducts.map((product) => {
              const isHighlighted = highlightedIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className={`product-card bg-white rounded-xl p-3 transition-all duration-200
                              hover:shadow-lg hover:-translate-y-0.5
                              ${isHighlighted 
                                ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-100' 
                                : 'shadow-sm border border-slate-100'
                              }`}
                >
                  {/* Highlighted Badge */}
                  {isHighlighted && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        AI Match
                      </span>
                    </div>
                  )}

                  {/* Product Icon */}
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mb-2">
                    <span className="text-2xl">{getCategoryEmoji(product.category)}</span>
                  </div>

                  {/* Product Name */}
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-1 line-clamp-2">
                    {product.name}
                  </h3>

                  {/* Product Description */}
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                    {truncate(product.description, 60)}
                  </p>

                  {/* Price and Category */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-900">
                      ₹{product.price?.toLocaleString() || '0'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs capitalize">
                      {product.category}
                    </span>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    className="w-full py-2 rounded-lg bg-slate-800 text-white text-sm font-medium
                               hover:bg-slate-700 active:scale-98 transition-all duration-150
                               flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add to Cart
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
