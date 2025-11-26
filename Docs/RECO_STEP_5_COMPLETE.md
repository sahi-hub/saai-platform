# RECO STEP 5: Full Outfit Recommendation Engine

## 🎯 Objective
Implement a backend feature that recommends a **complete outfit** (shirt + pant + shoes) instead of individual products, providing a cohesive styling solution for customers.

## ✅ Implementation Complete

### Files Created
1. **`/backend/src/recommender/outfitRecommender.js`** (~155 lines)
   - Main function: `recommendOutfit(tenantId, query, preferences)`
   - Algorithm:
     * Load all products for tenant
     * Embed products using existing `embedProduct` utility
     * Filter products into 3 categories: shirts, pants, shoes
     * Compute similarity scores per category
     * Return top-scoring item for each category
   - Returns: `{shirt: {...}, pant: {...}, shoe: {...}}`

### Files Modified
2. **Action Registries** (3 files)
   - `/backend/src/registry/default.registry.json`
   - `/backend/src/registry/example.registry.json`
   - `/backend/src/registry/client1.registry.json`
   - Added new action:
     ```json
     "recommend_outfit": {
       "enabled": true,
       "description": "Recommend a full outfit (shirt + pant + shoe)",
       "handler": "recommender.outfit"
     }
     ```

3. **`/backend/src/orchestrator/tools.js`** (~100 lines modified)
   - Added import: `const { recommendOutfit } = require('../recommender/outfitRecommender')`
   - Updated `recommender` namespace handler with branching logic:
     ```javascript
     if (functionName === 'outfit') {
       // Call outfit recommender
       const outfitResult = await recommendOutfit(tenantId, query, preferences);
       return {
         type: 'outfit',
         items: outfitResult,
         _meta: { adapterSource: 'outfit-recommender', ... }
       };
     } else {
       // Fallback to product recommender
       return {
         type: 'recommendations',
         items: products,
         _meta: { adapterSource: 'recommender-engine', ... }
       };
     }
     ```

4. **`/backend/src/orchestrator/llm.js`** (~17 lines added)
   - Added outfit-specific intent detection BEFORE general recommendation
   - Keywords: `"complete outfit"`, `"full outfit"`, `"dress me"`, `"what should i wear"`, `"eid outfit"`
   - Priority: Outfit detection checked first (more specific intent)
   - Returns: `{type: 'tool', action: 'recommend_outfit', params: {query, preferences}}`

## 🔍 Key Technical Details

### Category Filtering
```javascript
const shirts = allProducts.filter(p => 
  p.category.toLowerCase().includes('shirt')
);
const pants = allProducts.filter(p => 
  p.category.toLowerCase().includes('pant') || 
  p.category.toLowerCase().includes('trouser')
);
const shoes = allProducts.filter(p => 
  p.category.toLowerCase().includes('shoe') || 
  p.category.toLowerCase().includes('footwear')
);
```

### Response Format
**Outfit Response:**
```json
{
  "type": "outfit",
  "items": {
    "shirt": {
      "id": "p101",
      "name": "Premium Cotton White Shirt",
      "category": "shirt",
      "price": 1899,
      "currency": "INR",
      "tags": ["formal", "eid"],
      "_score": 0.23
    },
    "pant": {
      "id": "p103",
      "name": "Formal Black Trousers",
      "category": "pant",
      "price": 2199,
      "_score": 0.19
    },
    "shoe": {
      "id": "p106",
      "name": "Oxford Leather Shoes",
      "category": "shoe",
      "price": 3499,
      "_score": 0.18
    }
  },
  "_meta": {
    "adapterSource": "outfit-recommender"
  }
}
```

**Regular Product Recommendations:**
```json
{
  "type": "recommendations",
  "items": [ /* array of products */ ],
  "_meta": {
    "adapterSource": "recommender-engine"
  }
}
```

## 🧪 Testing Results

### Test 1: "dress me for eid"
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"dress me for eid","tenant":"client1"}'
```

**Result:**
- ✅ Action: `recommend_outfit`
- ✅ Type: `outfit`
- ✅ Items: `{shirt, pant, shoe}`
- ✅ Source: `outfit-recommender`

### Test 2: "give me a complete eid outfit"
**Recommended Outfit:**
- **Shirt**: Premium Cotton White Shirt (₹1,899)
- **Pant**: Formal Black Trousers (₹2,199)
- **Shoe**: Oxford Leather Shoes (₹3,499)
- **Total**: ₹7,597

## 🚀 Usage Examples

### Outfit Intent Keywords (triggers outfit recommendation)
- "dress me for eid"
- "give me a complete outfit"
- "full formal look"
- "what should I wear for a wedding"
- "eid outfit ideas"

### Product Intent Keywords (triggers product recommendation)
- "recommend shirts"
- "suggest formal pants"
- "show me shoes"
- "outfit ideas" (generic)
- "style suggestions"

## 🔄 Integration with Existing Systems

### Reuses:
- ✅ `productLoader.js` - Load tenant products
- ✅ `productEmbedding.js` - `embedProduct()` and `embedQuery()`
- ✅ `similarity.js` - `computeSimilarity()`
- ✅ Existing registry system
- ✅ Existing tools dispatcher
- ✅ Existing LLM orchestration

### Non-Breaking:
- ✅ Product recommendations still work normally
- ✅ All existing actions unchanged
- ✅ Backward compatible response format (different `type` field)

## 📊 Comparison: Outfit vs Product Recommendations

| Feature | Outfit Recommendation | Product Recommendation |
|---------|----------------------|----------------------|
| **Action** | `recommend_outfit` | `recommend_products` |
| **Handler** | `recommender.outfit` | `recommender.product` |
| **Response Type** | `outfit` | `recommendations` |
| **Items Format** | Object `{shirt, pant, shoe}` | Array `[...]` |
| **Category Filtering** | ✅ Yes (3 categories) | ❌ No (all similar items) |
| **Item Count** | Fixed 3 (one per category) | Variable (limit param) |
| **Use Case** | Complete styling solution | Browse similar items |
| **Frontend Rendering** | Side-by-side outfit view | Vertical product list |

## 🛠️ Technical Decisions

1. **Category-Based Filtering**: Ensures diversity (one item per category) instead of all similar shirts
2. **Reuse Embeddings**: No new ML infrastructure needed, uses existing similarity engine
3. **Distinct Response Type**: `type: "outfit"` vs `type: "recommendations"` allows frontend to render differently
4. **Priority Intent Detection**: Outfit intent checked BEFORE product intent (more specific query)
5. **Graceful Degradation**: If a category has no products, returns partial outfit (e.g., only shirt + pant)

## 🔮 Future Enhancements

- [ ] **Color Coordination**: Match colors across items (e.g., black belt with black shoes)
- [ ] **Price Range Matching**: Ensure similar price points across items
- [ ] **Style Consistency**: Filter by style (formal, casual, traditional)
- [ ] **Multiple Outfit Options**: Return top 3 outfit combinations
- [ ] **Occasion-Based Filtering**: Tag outfits for eid, wedding, office, party
- [ ] **Brand Consistency**: Option to recommend all items from same brand
- [ ] **Weather/Season Aware**: Consider seasonal appropriateness

## 📝 Notes

- **Import Path Fix**: Initial bug with `require('../data/productLoader')` → fixed to `require('../utils/productLoader')`
- **Server Restart Required**: Code changes require full backend restart to take effect
- **Testing**: Use curl or frontend to test, verify `type: "outfit"` in response
- **Frontend Integration**: Not yet implemented (future step)

## ✅ RECO STEP 5: COMPLETE

All tasks completed successfully:
1. ✅ Created outfitRecommender.js module
2. ✅ Updated all 3 action registries
3. ✅ Updated tools.js dispatcher
4. ✅ Updated mock LLM logic
5. ✅ Tested outfit recommendation

**Ready for frontend integration (RECO STEP 6).**
