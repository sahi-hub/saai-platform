# RECO STEP 2 — Vector-Based Recommendation Engine ✅

## 📋 Overview
Successfully implemented a lightweight, vector-based recommendation engine that converts products into feature vectors, computes similarity between vectors, and ranks products by relevance. The system supports multiple recommendation modes including query-based, similar products, and personalized recommendations.

---

## 🎯 Implementation Summary

### **1. Product Embedding System** (`productEmbedding.js`)
Converts products and queries into numerical feature vectors for similarity computation.

**Key Components:**
- **`embedProduct(product)`**: Converts product to feature vector
  - Category encoding (1.0 weight)
  - Tag encoding (0.8 weight per tag)
  - Color encoding (0.5 weight per color)
  - Name tokenization (0.3 weight per keyword)
  
- **`embedQuery(query, preferences)`**: Converts search query + preferences to vector
  - Query text tokenization
  - Preference boost (1.5x weight)
  
- **`tokenize(text)`**: Extracts keywords from text
  - Lowercase normalization
  - Non-alphanumeric removal
  - Common word filtering (stop words)

**Example Vector:**
```javascript
{
  'category:shirt': 1.0,
  'tag:formal': 0.8,
  'tag:premium': 0.8,
  'color:white': 0.5,
  'name:cotton': 0.3
}
```

---

### **2. Similarity Engine** (`similarity.js`)
Computes similarity scores between feature vectors using multiple algorithms.

**Key Functions:**
- **`computeSimilarity(vecA, vecB)`**: Cosine similarity implementation
  - Formula: `similarity = dotProduct / (magnitudeA × magnitudeB)`
  - Range: 0.0 (completely different) to 1.0 (identical)
  - Zero-division protection
  
- **`computeJaccardSimilarity(vecA, vecB)`**: Alternative metric
  - Set-based similarity (intersection / union)
  - Useful for categorical matching
  
- **`rankBySimilarity(queryVec, items)`**: Sorting helper
  - Computes scores for all items
  - Returns sorted array by score (descending)

**Example Calculation:**
```
Product A: { 'tag:formal': 0.8, 'color:white': 0.5 }
Product B: { 'tag:formal': 0.8, 'tag:premium': 0.8 }

Dot Product = 0.8 × 0.8 = 0.64
Magnitude A = √(0.8² + 0.5²) = 0.943
Magnitude B = √(0.8² + 0.8²) = 1.131
Similarity = 0.64 / (0.943 × 1.131) = 0.60
```

---

### **3. Recommendation Engine** (`recommender.js`)
Main engine that orchestrates product loading, embedding, and ranking.

**Key Functions:**

#### **`recommendProducts(tenantId, query, preferences, options)`**
Query-based recommendations with user preferences.

**Parameters:**
- `tenantId`: Tenant identifier
- `query`: Search text (e.g., "eid outfit", "formal shoes")
- `preferences`: Array of preferred terms (e.g., ["white", "shirt"])
- `options`: 
  - `limit`: Max results (default: 10)
  - `minScore`: Minimum similarity threshold (default: 0.1)
  - `includeScores`: Return similarity scores (default: true)

**Returns:**
```javascript
[
  {
    id: "p101",
    name: "Premium Cotton White Shirt",
    category: "shirt",
    price: 1899,
    similarityScore: 0.523
  },
  // ... more products
]
```

#### **`getSimilarProducts(tenantId, productId, options)`**
Find products similar to a specific product.

**Use Case:** "Show me similar items" on product detail page

**Returns:** Products ranked by similarity to the target product

#### **`getPersonalizedRecommendations(tenantId, viewedProducts, likedCategories, options)`**
Personalized recommendations based on user history.

**Parameters:**
- `viewedProducts`: Array of product IDs user viewed
- `likedCategories`: Array of categories user prefers

**Use Case:** "Recommended for you" based on browsing history

---

### **4. API Controllers** (`recommend.controller.js`)
HTTP endpoint handlers for recommendation requests.

**Controllers:**

#### **`recommendController(req, res)`**
Main recommendation endpoint (supports POST and GET).

**POST Request:**
```bash
curl -X POST http://localhost:3001/recommend/client1 \
  -H "Content-Type: application/json" \
  -d '{
    "query": "eid outfit",
    "preferences": ["white", "shirt"],
    "limit": 5
  }'
```

**GET Request:**
```bash
curl "http://localhost:3001/recommend/client1?query=formal&preferences=shoes&limit=3"
```

**Response:**
```json
{
  "success": true,
  "tenantId": "client1",
  "query": "eid outfit",
  "preferences": ["white", "shirt"],
  "count": 5,
  "recommendations": [
    {
      "id": "p101",
      "name": "Premium Cotton White Shirt",
      "category": "shirt",
      "price": 1899,
      "currency": "INR",
      "colors": ["white", "blue", "light-gray"],
      "sizes": ["S", "M", "L", "XL", "XXL"],
      "tags": ["formal", "office", "premium", "cotton", "eid"],
      "imageUrl": "https://mellbizz.com/images/white-shirt.jpg",
      "similarityScore": 0.5229763603684908
    }
    // ... more products
  ]
}
```

#### **`getSimilarProductsController(req, res)`**
Similar products endpoint.

**Request:**
```bash
curl "http://localhost:3001/recommend/client1/similar/p101?limit=5"
```

**Response:**
```json
{
  "success": true,
  "tenantId": "client1",
  "productId": "p101",
  "count": 5,
  "similarProducts": [
    {
      "id": "p105",
      "name": "Oxford Leather Shoes",
      "similarityScore": 0.4444444444444444
    }
    // ... more products
  ]
}
```

#### **`getPersonalizedController(req, res)`**
Personalized recommendations endpoint.

**Request:**
```bash
curl -X POST http://localhost:3001/recommend/client1/personalized \
  -H "Content-Type: application/json" \
  -d '{
    "viewedProducts": ["p101", "p103"],
    "likedCategories": ["shirt", "pant"],
    "limit": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "tenantId": "client1",
  "viewedProducts": ["p101", "p103"],
  "likedCategories": ["shirt", "pant"],
  "count": 5,
  "recommendations": [
    {
      "id": "p105",
      "name": "Oxford Leather Shoes",
      "similarityScore": 0.427008410146899
    }
    // ... more products
  ]
}
```

---

### **5. API Routes** (`routes.js`)
Express route definitions for recommendation endpoints.

**New Routes Added:**
```javascript
// Main recommendation endpoint (POST and GET)
router.post('/recommend/:tenantId', recommendController);
router.get('/recommend/:tenantId', recommendController);

// Similar products endpoint
router.get('/recommend/:tenantId/similar/:productId', getSimilarProductsController);

// Personalized recommendations endpoint
router.post('/recommend/:tenantId/personalized', getPersonalizedController);
```

---

## 🧪 Testing Results

### **Test 1: Query-Based Recommendation**
**Request:**
```bash
curl -X POST http://localhost:3001/recommend/client1 \
  -H "Content-Type: application/json" \
  -d '{"query": "eid outfit", "preferences": ["white", "shirt"]}'
```

**Result:** ✅ SUCCESS
- Returned 8 products ranked by similarity
- Top result: Premium Cotton White Shirt (score: 0.523)
- Correctly prioritized products matching "eid", "white", and "shirt"

### **Test 2: Similar Products**
**Request:**
```bash
curl "http://localhost:3001/recommend/client1/similar/p101?limit=5"
```

**Result:** ✅ SUCCESS
- Found 5 similar products to Premium Cotton White Shirt
- Top result: Oxford Leather Shoes (score: 0.444) - formal + eid tags match
- Correctly ranked by shared features (category, tags, colors)

### **Test 3: Personalized Recommendations**
**Request:**
```bash
curl -X POST http://localhost:3001/recommend/client1/personalized \
  -H "Content-Type: application/json" \
  -d '{
    "viewedProducts": ["p101", "p103"],
    "likedCategories": ["shirt", "pant"],
    "limit": 5
  }'
```

**Result:** ✅ SUCCESS
- Generated 5 personalized recommendations
- Top result: Oxford Leather Shoes (score: 0.427) - complements formal outfit
- User profile boosted shirt and pant categories

### **Test 4: GET Method with Query Params**
**Request:**
```bash
curl "http://localhost:3001/recommend/client1?query=formal&preferences=shoes&limit=3"
```

**Result:** ✅ SUCCESS
- Returned 3 recommendations
- Top result: Oxford Leather Shoes (score: 0.462)
- Correctly interpreted query parameters

---

## 📊 Algorithm Performance

### **Similarity Score Distribution:**
- **High Similarity (0.4 - 1.0):** Direct matches (same category + multiple shared tags)
- **Medium Similarity (0.2 - 0.4):** Partial matches (shared tags or colors)
- **Low Similarity (0.1 - 0.2):** Weak matches (minimal overlap)

### **Example Scores:**
| Product Pair | Score | Reason |
|--------------|-------|--------|
| White Shirt ↔ Denim Shirt | 0.25 | Same category, different style |
| White Shirt ↔ Oxford Shoes | 0.44 | Shared formal + eid tags |
| White Shirt ↔ Casual Sneakers | 0.20 | Shared white color only |
| Oxford Shoes ↔ Leather Belt | 0.33 | Shared formal + leather tags |

### **Query Performance:**
- **"eid outfit"** → Prioritizes products with "eid" tag
- **"formal shoes"** → Ranks formal footwear highest
- **"white" + "shirt"** → Boosts white-colored shirts

---

## 🔧 Technical Details

### **Feature Weights:**
```javascript
{
  category: 1.0,      // Primary classification
  tags: 0.8,          // Per tag (cumulative)
  colors: 0.5,        // Per color (cumulative)
  nameTokens: 0.3     // Per keyword (cumulative)
}
```

### **Preference Boosting:**
- User preferences receive 1.5x weight multiplier
- Example: If user prefers "white", all white products get +0.75 boost

### **Stop Words Filtered:**
```javascript
['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'of']
```

### **Error Handling:**
- Graceful fallback on empty product catalogs
- Returns empty array if no products found
- Validates all inputs with sensible defaults
- Comprehensive logging for debugging

---

## 📁 Files Created

```
backend/src/recommender/
├── productEmbedding.js   (~140 lines) - Feature vector conversion
├── similarity.js         (~120 lines) - Cosine similarity computation
└── recommender.js        (~220 lines) - Main recommendation engine

backend/src/api/
└── recommend.controller.js (~200 lines) - HTTP controllers

backend/src/api/
└── routes.js             (updated) - Added 4 recommendation routes
```

**Total Lines Added:** ~680 lines of production code

---

## 🚀 Next Steps

### **RECO STEP 3: Chat Integration**
Integrate recommendations into the chat orchestrator:
- Detect recommendation intent in chat messages
  - Example: "Show me eid outfits" → Trigger recommendation
- Return formatted product recommendations in chat responses
- Add recommendation context to LLM orchestrator
- Support follow-up queries ("show me more", "cheaper options")

### **Potential Enhancements:**
1. **Advanced Algorithms:**
   - Collaborative filtering (user-based, item-based)
   - Matrix factorization (SVD, ALS)
   - Deep learning embeddings (Word2Vec, BERT)

2. **Business Logic:**
   - Price range filtering
   - Inventory-aware recommendations
   - Trending products boost
   - Seasonal adjustments

3. **Performance:**
   - Vector caching
   - Precomputed similarity matrices
   - Redis-based recommendation cache

4. **Analytics:**
   - Click-through rate tracking
   - A/B testing framework
   - Recommendation effectiveness metrics

---

## 📚 API Reference

### **Endpoints Summary:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recommend/:tenantId` | Query-based recommendations |
| GET | `/recommend/:tenantId` | Query-based (query params) |
| GET | `/recommend/:tenantId/similar/:productId` | Similar products |
| POST | `/recommend/:tenantId/personalized` | Personalized recommendations |

### **Common Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | "" | Search text |
| `preferences` | string[] | [] | Preferred terms (colors, styles, etc.) |
| `limit` | number | 10 | Max results |
| `minScore` | number | 0.1 | Minimum similarity threshold |
| `includeScores` | boolean | true | Return similarity scores |
| `viewedProducts` | string[] | [] | Product IDs viewed by user |
| `likedCategories` | string[] | [] | Categories user prefers |

---

## ✅ Completion Checklist

- [x] **Task 1:** Created `productEmbedding.js` with embedding functions
- [x] **Task 2:** Created `similarity.js` with cosine similarity algorithm
- [x] **Task 3:** Created `recommender.js` with 3 recommendation modes
- [x] **Task 4:** Created `recommend.controller.js` with HTTP controllers
- [x] **Task 5:** Updated `routes.js` with 4 new endpoints
- [x] **Task 6:** Tested all endpoints with various queries

**All tasks completed successfully!** 🎉

---

## 📝 Notes

### **Design Decisions:**
1. **Vector-based approach:** Simple, fast, and effective for small catalogs
2. **Cosine similarity:** Standard metric for text similarity
3. **Feature weights:** Tuned based on importance (category > tags > colors > name)
4. **Fallback mechanisms:** Prevent crashes on missing data
5. **Comprehensive logging:** Aids debugging and monitoring

### **Known Limitations:**
- No collaborative filtering (requires user interaction data)
- Simple tokenization (no stemming or lemmatization)
- Single language support (English)
- No context-aware recommendations (time, location, weather)

### **Production Readiness:**
- ✅ Error handling and validation
- ✅ Input sanitization
- ✅ Comprehensive logging
- ✅ Configurable parameters
- ✅ Graceful fallbacks
- ⚠️ Consider adding:
  - Rate limiting
  - Response caching
  - Performance monitoring
  - A/B testing framework

---

**Status:** ✅ **RECO STEP 2 COMPLETE**

**Date:** 2025-01-XX  
**Developer:** GitHub Copilot  
**Backend Server:** Running on port 3001  
**All Tests:** PASSED ✅
