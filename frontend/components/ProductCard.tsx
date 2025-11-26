/**
 * ProductCard Component
 * 
 * Displays a single product recommendation as a card with:
 * - Product image
 * - Product name
 * - Category
 * - Price
 * - "Add to Cart" button
 * 
 * Used within ProductListBubble to show recommended products.
 */

import Image from 'next/image';
import { Theme } from '@/config/tenant';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string;
  similarity?: number; // Optional similarity score from recommendation engine
}

interface ProductCardProps {
  item: ProductItem;
  onAdd: (productId: string) => void;
  theme: Theme;
}

export default function ProductCard({ item, onAdd, theme }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 w-full max-w-sm">
      {/* Product Image */}
      <div className="relative w-full h-40 bg-gray-100">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 384px"
          onError={(e) => {
            // Fallback to placeholder if image fails to load
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-product.png';
          }}
        />
      </div>

      {/* Product Details */}
      <div className="p-4 space-y-2">
        {/* Product Name */}
        <h3 className="font-bold text-gray-800 text-lg line-clamp-2">
          {item.name}
        </h3>

        {/* Category */}
        <p className="text-sm text-gray-500 uppercase tracking-wide">
          {item.category}
        </p>

        {/* Price */}
        <p className="font-bold text-xl text-gray-900">
          {item.currency} {item.price.toFixed(2)}
        </p>

        {/* Similarity Score (if available) */}
        {item.similarity !== undefined && (
          <p className="text-xs text-gray-400">
            Match: {(item.similarity * 100).toFixed(0)}%
          </p>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={() => onAdd(item.id)}
          className="w-full mt-3 py-2 px-4 rounded-lg font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ backgroundColor: theme.primaryColor }}
          aria-label={`Add ${item.name} to cart`}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
