/**
 * ProductListBubble Component
 * 
 * Container for displaying multiple product recommendations in a chat bubble.
 * Renders a vertical list of ProductCard components.
 * Styled consistently with SAAI message bubbles (left-aligned).
 */

import ProductCard, { ProductItem } from './ProductCard';
import { Theme } from '@/config/tenant';

interface ProductListBubbleProps {
  items: ProductItem[];
  theme: Theme;
  onAdd: (productId: string) => void;
}

export default function ProductListBubble({ items, theme, onAdd }: ProductListBubbleProps) {
  // If no items, show a fallback message
  if (!items || items.length === 0) {
    return (
      <div className="max-w-[85%] sm:max-w-md rounded-2xl rounded-tl-sm p-4 shadow-lg bg-gray-100">
        <p className="text-gray-600 text-sm">
          No products found matching your preferences.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] sm:max-w-2xl">
      {/* Header */}
      <div 
        className="rounded-t-2xl rounded-tl-sm p-3 shadow-md"
        style={{ backgroundColor: theme.primaryColor }}
      >
        <p className="text-white font-semibold text-sm">
          🎯 Found {items.length} {items.length === 1 ? 'product' : 'products'} for you
        </p>
      </div>

      {/* Product Cards Container */}
      <div className="bg-white rounded-b-2xl shadow-lg p-4 space-y-4">
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onAdd={onAdd}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
