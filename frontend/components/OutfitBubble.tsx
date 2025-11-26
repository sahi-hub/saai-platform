/**
 * OutfitBubble Component
 * 
 * Displays a complete outfit recommendation (shirt, pant, shoes) in a chat bubble.
 * Shows each item as a ProductCard with section headings.
 * Provides "Add to Cart" for individual items and "Add Full Outfit" for all items.
 */

import ProductCard, { ProductItem } from './ProductCard';
import { Theme } from '@/config/tenant';

interface OutfitItems {
  shirt?: ProductItem;
  pant?: ProductItem;
  shoe?: ProductItem;
}

interface OutfitBubbleProps {
  items: OutfitItems;
  theme: Theme;
  onAddSingle: (productId: string) => void;
  onAddAll: (productIds: string[]) => void;
}

export default function OutfitBubble({ items, theme, onAddSingle, onAddAll }: OutfitBubbleProps) {
  // Extract available items
  const availableItems = [
    { key: 'shirt', item: items.shirt, label: '👔 Shirt' },
    { key: 'pant', item: items.pant, label: '👖 Pant' },
    { key: 'shoe', item: items.shoe, label: '👞 Shoes' }
  ].filter(entry => entry.item !== undefined);

  // If no items, show fallback
  if (availableItems.length === 0) {
    return (
      <div className="max-w-[85%] sm:max-w-md rounded-2xl rounded-tl-sm p-4 shadow-lg bg-gray-100">
        <p className="text-gray-600 text-sm">
          No outfit items found matching your preferences.
        </p>
      </div>
    );
  }

  // Collect all product IDs for "Add Full Outfit" button
  const allProductIds = availableItems
    .map(entry => entry.item!.id)
    .filter(Boolean);

  // Determine if we should show "Add Full Outfit" button (at least 2 items)
  const showAddAllButton = allProductIds.length >= 2;

  return (
    <div className="max-w-[85%] sm:max-w-2xl">
      {/* Header */}
      <div 
        className="rounded-t-2xl rounded-tl-sm p-3 shadow-md"
        style={{ backgroundColor: theme.primaryColor }}
      >
        <p className="text-white font-semibold text-sm">
          ✨ Complete Outfit Recommendation
        </p>
        <p className="text-white/80 text-xs mt-1">
          {availableItems.length} {availableItems.length === 1 ? 'item' : 'items'} selected for you
        </p>
      </div>

      {/* Outfit Items Container */}
      <div className="bg-white rounded-b-2xl shadow-lg p-4 space-y-6">
        {/* Render each outfit item with section heading */}
        {availableItems.map(({ key, item, label }) => (
          <div key={key} className="space-y-2">
            {/* Section Heading */}
            <h3 
              className="text-sm font-bold uppercase tracking-wider px-2 py-1 rounded inline-block"
              style={{ 
                color: theme.primaryColor,
                backgroundColor: `${theme.primaryColor}15` // 15% opacity
              }}
            >
              {label}
            </h3>

            {/* Product Card */}
            <ProductCard
              item={item!}
              onAdd={onAddSingle}
              theme={theme}
            />
          </div>
        ))}

        {/* Add Full Outfit Button */}
        {showAddAllButton && (
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => onAddAll(allProductIds)}
              className="w-full py-3 px-6 rounded-lg font-bold text-white text-base transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-98 flex items-center justify-center space-x-2"
              style={{ backgroundColor: theme.primaryColor }}
              aria-label="Add full outfit to cart"
            >
              <span>🛒</span>
              <span>Add Full Outfit to Cart</span>
            </button>

            {/* Total Price Summary */}
            {availableItems.length > 0 && (
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-600">
                  Total: {' '}
                  <span className="font-bold text-gray-900">
                    {items.shirt?.currency || 'INR'}{' '}
                    {availableItems.reduce((sum, entry) => sum + (entry.item?.price || 0), 0).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
