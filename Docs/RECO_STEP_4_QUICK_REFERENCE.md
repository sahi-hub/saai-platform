# RECO STEP 4 — Quick Reference Guide

> 🎯 **Product Cards in Chat** — Display recommendations as interactive product cards

---

## 🚀 Quick Start

### Test the Feature
```bash
# 1. Start backend
cd backend && npm start

# 2. Start frontend  
cd frontend && npm run dev

# 3. Open browser at http://localhost:3000 (or :3002)

# 4. Send recommendation query
Type: "suggest an eid outfit"
```

**Expected Result**: Chat displays 5 product cards with images, details, and "Add to Cart" buttons.

---

## 📦 Component Structure

```
MessageBubble (updated)
  ├── Check message.type
  ├── If 'recommendations':
  │   └── ProductListBubble
  │       ├── Header (🎯 Found X products)
  │       └── ProductCard (repeated)
  │           ├── Image
  │           ├── Name
  │           ├── Category
  │           ├── Price
  │           └── Add to Cart Button
  └── Else: Text Bubble
```

---

## 🔧 Component APIs

### ProductCard
```tsx
<ProductCard 
  item={{
    id: "eid-kurta-001",
    name: "Eid Special Kurta",
    category: "Traditional",
    price: 1299,
    currency: "PKR",
    imageUrl: "/images/eid-kurta.jpg",
    similarity: 0.85  // Optional
  }}
  onAdd={(productId) => handleAddToCart(productId)}
  theme={theme}
/>
```

### ProductListBubble
```tsx
<ProductListBubble 
  items={[
    { id: "1", name: "Product 1", category: "Cat1", price: 100, currency: "PKR", imageUrl: "/1.jpg" },
    { id: "2", name: "Product 2", category: "Cat2", price: 200, currency: "PKR", imageUrl: "/2.jpg" }
  ]}
  theme={theme}
  onAdd={(productId) => console.log(`Add ${productId} to cart`)}
/>
```

### MessageBubble (Updated)
```tsx
// Text message (backward compatible)
<MessageBubble 
  message="Hello, how can I help?"
  sender="saai"
  timestamp="10:30 AM"
  theme={theme}
/>

// Recommendation message (new)
<MessageBubble 
  message={{
    type: 'recommendations',
    items: [{ id: "1", name: "Product", ... }]
  }}
  sender="saai"
  timestamp="10:30 AM"
  theme={theme}
  onAddToCart={(id) => handleAddToCart(id)}
/>
```

---

## 🎨 Styling & Theming

### Theme Usage
All product card buttons use the tenant's `primaryColor`:
```tsx
// In ProductCard
<button style={{ backgroundColor: theme.primaryColor }}>
  Add to Cart
</button>

// In ProductListBubble header
<div style={{ backgroundColor: theme.primaryColor }}>
  🎯 Found {items.length} products for you
</div>
```

### Responsive Design
```css
/* Product cards are mobile-first */
max-w-sm        /* 384px on desktop */
max-w-[85%]     /* 85% width on mobile */
w-full          /* Full width within container */
```

---

## 📡 API Response Format

### Recommendation Response
```json
{
  "replyType": "tool",
  "llm": {
    "action": "recommend_products",
    "provider": "groq",
    "text": "Here are some great options for Eid!"
  },
  "actionResult": {
    "type": "recommendations",
    "items": [
      {
        "id": "eid-kurta-001",
        "name": "Eid Special Kurta",
        "category": "Traditional",
        "price": 1299,
        "currency": "PKR",
        "imageUrl": "/images/products/eid-kurta.jpg",
        "tags": ["eid", "formal", "traditional"],
        "colors": ["white", "gold"],
        "_score": 0.85
      }
      // ... more products
    ],
    "_meta": {
      "query": "eid outfit",
      "limit": 5,
      "totalMatches": 8
    }
  }
}
```

---

## 🔄 User Flow

### Complete Interaction Flow
```
1. User types: "suggest an eid outfit"
   ↓
2. Frontend sends to: POST /chat
   ↓
3. Backend:
   - LLM detects recommendation intent
   - Calls recommend_products action
   - Returns products with similarity scores
   ↓
4. Frontend:
   - Detects actionResult.type === 'recommendations'
   - Creates message with { type: 'recommendations', items: [...] }
   - Renders ProductListBubble
   ↓
5. User sees:
   - SAAI message bubble
   - Header: "🎯 Found 5 products for you"
   - 5 product cards with images, details, buttons
   ↓
6. User clicks: "Add to Cart" on Kurta
   ↓
7. Frontend:
   - Calls handleAddToCart("eid-kurta-001")
   - Sends message: "Add product eid-kurta-001 to cart"
   ↓
8. Backend:
   - LLM detects add_to_cart intent
   - Executes add_to_cart action
   - Returns confirmation
   ↓
9. User sees: "🛒 Adding product to cart (ID: eid-kurta-001)..."
```

---

## 🧪 Testing Commands

### Manual Testing
```bash
# Test 1: Basic recommendation
User: "suggest an eid outfit"
Expected: 5 product cards displayed

# Test 2: Add to cart
Click: "Add to Cart" button
Expected: Message sent "Add product {id} to cart"

# Test 3: Mobile view
Resize: Browser to 375px width
Expected: Cards remain readable, responsive layout

# Test 4: Theme colors
Check: Button color matches tenant primaryColor
Expected: All buttons same color as theme

# Test 5: Empty state
Query: "recommend quantum computers" (no matches)
Expected: "No products found matching your preferences."
```

### Automated Testing (Future)
```typescript
// Test recommendation rendering
test('renders product cards from recommendation response', () => {
  const mockResponse = {
    replyType: 'tool',
    actionResult: {
      type: 'recommendations',
      items: [{ id: '1', name: 'Test Product', ... }]
    }
  };
  
  render(<MessageBubble message={mockResponse.actionResult} ... />);
  expect(screen.getByText('Test Product')).toBeInTheDocument();
});

// Test add to cart
test('calls handleAddToCart when button clicked', () => {
  const mockOnAdd = jest.fn();
  render(<ProductCard item={mockItem} onAdd={mockOnAdd} ... />);
  
  fireEvent.click(screen.getByText('Add to Cart'));
  expect(mockOnAdd).toHaveBeenCalledWith('product-id');
});
```

---

## 🐛 Troubleshooting

### Products not displaying
**Issue**: Recommendation query returns no cards

**Debug**:
```bash
# Check backend response
curl http://localhost:3001/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"suggest eid outfit","tenantId":"client1"}'

# Expected: actionResult.type === "recommendations"
# Expected: actionResult.items.length > 0
```

**Fix**: Ensure products exist in `/backend/src/data/products/client1.json`

---

### Images not loading
**Issue**: Product cards show broken images

**Debug**:
```typescript
// Check imageUrl in product data
console.log(product.imageUrl);

// Expected: Valid URL or path
// Actual: Might be missing or incorrect
```

**Fix**: 
1. Add placeholder images to `/frontend/public/images/products/`
2. Or use external URLs like `https://via.placeholder.com/400x300`
3. ProductCard has fallback to `/placeholder-product.png`

---

### Add to Cart not working
**Issue**: Clicking button does nothing

**Debug**:
```typescript
// In page.tsx
const handleAddToCart = (productId: string) => {
  console.log('Add to cart:', productId);  // Should log
  handleSendMessage(`Add product ${productId} to cart`);
};
```

**Fix**: Ensure `onAddToCart={handleAddToCart}` is passed to MessageBubble

---

### Theme colors not applied
**Issue**: Buttons are default color, not tenant color

**Debug**:
```typescript
// Check theme prop
console.log(theme.primaryColor);  // Should be hex color like "#4A90E2"
```

**Fix**: Ensure theme is loaded from backend and passed to components

---

## 📊 Performance Tips

### Image Optimization
```typescript
// Use Next.js Image component (already implemented)
<Image 
  src={item.imageUrl}
  alt={item.name}
  fill
  sizes="(max-width: 768px) 100vw, 384px"  // Responsive sizes
  className="object-cover"
/>
```

### Lazy Loading
```typescript
// Future: Load products as user scrolls
const [visibleProducts, setVisibleProducts] = useState(items.slice(0, 3));

useEffect(() => {
  // Intersection Observer for infinite scroll
}, [items]);
```

### Memoization
```typescript
// Future: Memoize product cards to prevent re-renders
const ProductCard = React.memo(({ item, onAdd, theme }) => {
  // ...
});
```

---

## 🔗 Related Files

### Frontend
- `/frontend/components/ProductCard.tsx` (98 lines)
- `/frontend/components/ProductListBubble.tsx` (54 lines)
- `/frontend/components/MessageBubble.tsx` (modified, ~140 lines)
- `/frontend/app/page.tsx` (modified, ~310 lines)

### Backend
- `/backend/src/recommender/recommender.js` (recommendation logic)
- `/backend/src/orchestrator/tools.js` (action dispatcher)
- `/backend/src/orchestrator/llm.js` (intent detection)
- `/backend/src/data/products/client1.json` (product catalog)

### Documentation
- `/RECO_STEP_4_COMPLETE.md` (detailed documentation)
- `/RECO_STEP_3_QUICK_REFERENCE.md` (backend API reference)
- `/RECO_STEP_2_COMPLETE.md` (recommendation engine)

---

## 🎯 Key Takeaways

1. **Type Discrimination**: MessageBubble checks `message.type` to decide rendering
2. **Backward Compatibility**: Text messages still work with `msg.content || msg.text || ''`
3. **Theme Integration**: All UI components respect tenant's `primaryColor`
4. **Mobile-First**: Responsive design with Tailwind CSS utilities
5. **Simple Cart Integration**: "Add to Cart" just sends a chat message

---

## 🚀 Future Enhancements

### Short-Term
- [ ] Add product detail modal on card click
- [ ] Show loading state for "Add to Cart" action
- [ ] Display cart icon with item count in header
- [ ] Add "View Full Details" link in product card

### Medium-Term
- [ ] Implement product image carousel (multiple images)
- [ ] Add product filtering (by category, price range)
- [ ] Show "Why recommended?" tooltip with similarity details
- [ ] Add product comparison feature

### Long-Term
- [ ] Personalized recommendations based on user history
- [ ] Real-time inventory updates
- [ ] Product reviews and ratings
- [ ] Advanced search within recommendations

---

**That's it!** You now have a complete, production-ready product card system integrated into your chat interface. 🎉

For questions or issues, refer to:
- [RECO_STEP_4_COMPLETE.md](./RECO_STEP_4_COMPLETE.md) for detailed implementation
- [RECO_STEP_3_QUICK_REFERENCE.md](./RECO_STEP_3_QUICK_REFERENCE.md) for backend API
