/**
 * Tools Orchestrator
 * 
 * Dispatches action requests to appropriate adapters.
 * This is the central coordinator that:
 * 1. Validates actions against the registry
 * 2. Resolves the correct adapter (tenant-specific or generic)
 * 3. Executes the action
 * 4. Returns the result
 * 
 * Architecture:
 * - Actions are defined in the registry (e.g., example.registry.json)
 * - Handler strings map to adapter functions (e.g., "commerce.search")
 * - Tenant-specific adapters override generic ones
 */

const path = require('path');
const fs = require('fs').promises;
const { logToolExecution } = require('../utils/logger');
const { recommendProducts } = require('../recommender/recommender');
const { recommendOutfit } = require('../recommender/outfitRecommender');
const { addToCart, addOutfitToCart, addMultipleToCart, removeFromCart, viewCart, checkoutCart } = require('../commerce/cartService');
const { getOrders, getOrderStatus, cancelOrder } = require('../commerce/orderService');
const { saveSessionContext } = require('../personalization/sessionContextStore');
const { updateProfileFromProducts } = require('../personalization/profileUpdater');
const { loadProductsForTenant } = require('../utils/productLoader');

/**
 * Custom error for action not found in registry
 */
class ActionNotFoundError extends Error {
  constructor(action, tenantId) {
    super(`Action '${action}' not found in registry for tenant '${tenantId}'`);
    this.name = 'ActionNotFoundError';
    this.action = action;
    this.tenantId = tenantId;
  }
}

/**
 * Custom error for disabled actions
 */
class ActionDisabledError extends Error {
  constructor(action, tenantId) {
    super(`Action '${action}' is disabled for tenant '${tenantId}'`);
    this.name = 'ActionDisabledError';
    this.action = action;
    this.tenantId = tenantId;
  }
}

/**
 * Custom error for invalid handler
 */
class InvalidHandlerError extends Error {
  constructor(handler, action) {
    super(`Invalid handler format '${handler}' for action '${action}'. Expected format: 'namespace.function'`);
    this.name = 'InvalidHandlerError';
    this.handler = handler;
    this.action = action;
  }
}

/**
 * Custom error for adapter not found
 */
class AdapterNotFoundError extends Error {
  constructor(namespace, action) {
    super(`Adapter not found for namespace '${namespace}' (action: '${action}')`);
    this.name = 'AdapterNotFoundError';
    this.namespace = namespace;
    this.action = action;
  }
}

/**
 * Custom error for function not found in adapter
 */
class FunctionNotFoundError extends Error {
  constructor(functionName, namespace, action) {
    super(`Function '${functionName}' not found in adapter '${namespace}' (action: '${action}')`);
    this.name = 'FunctionNotFoundError';
    this.functionName = functionName;
    this.namespace = namespace;
    this.action = action;
  }
}

/**
 * Check if a file exists
 * 
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load adapter module (tenant-specific or generic)
 * 
 * @param {string} namespace - Adapter namespace (e.g., "commerce")
 * @param {string} functionName - Function name to execute
 * @param {string} tenantId - Tenant ID
 * @param {string} action - Action name (for error messages)
 * 
 * @returns {Promise<Object>} Adapter module with source
 */
async function loadAdapter(namespace, functionName, tenantId, action) {
  // Sanitize inputs
  const sanitizedTenant = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
  const sanitizedNamespace = namespace.replace(/[^a-zA-Z0-9-_]/g, '');

  // Try tenant-specific adapter first
  const tenantAdapterPath = path.join(
    __dirname,
    '..',
    'tenants',
    `${sanitizedTenant}.adapter.js`
  );

  if (await fileExists(tenantAdapterPath)) {
    console.log(`[tools] Checking tenant-specific adapter: ${sanitizedTenant}.adapter.js`);
    try {
      const adapter = require(tenantAdapterPath);
      // Check if the specific function exists in tenant adapter
      if (adapter[functionName] && typeof adapter[functionName] === 'function') {
        console.log(`[tools] Using tenant-specific function: ${functionName}`);
        return { adapter, source: 'tenant-specific' };
      } else {
        console.log(`[tools] Function '${functionName}' not found in tenant adapter, falling back to generic`);
      }
    } catch (error) {
      console.warn(`[tools] Failed to load tenant adapter: ${error.message}`);
      // Fall through to generic adapter
    }
  }

  // Fall back to generic adapter
  const genericAdapterPath = path.join(
    __dirname,
    '..',
    'adapters',
    `${sanitizedNamespace}Adapter.js`
  );

  if (await fileExists(genericAdapterPath)) {
    console.log(`[tools] Loading generic adapter: ${sanitizedNamespace}Adapter.js`);
    try {
      const adapter = require(genericAdapterPath);
      return { adapter, source: 'generic' };
    } catch (error) {
      console.error(`[tools] Failed to load generic adapter: ${error.message}`);
      throw new AdapterNotFoundError(namespace, action);
    }
  }

  // No adapter found
  throw new AdapterNotFoundError(namespace, action);
}

/**
 * Run an action
 * 
 * This is the main entry point for executing actions.
 * 
 * @param {Object} options - Run options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {Object} options.actionRegistry - Action registry
 * @param {string} options.action - Action name to execute
 * @param {Object} [options.params={}] - Action parameters
 * 
 * @returns {Promise<Object>} Action execution result
 * 
 * @throws {ActionNotFoundError} If action not in registry
 * @throws {ActionDisabledError} If action is disabled
 * @throws {InvalidHandlerError} If handler format is invalid
 * @throws {AdapterNotFoundError} If adapter module not found
 * @throws {FunctionNotFoundError} If function not found in adapter
 */
async function runAction({ tenantConfig, actionRegistry, action, params = {} }) {
  const tenantId = tenantConfig.tenantId;

  console.log(`[tools.runAction] Executing action: ${action}`);
  console.log(`  Tenant: ${tenantId}`);
  console.log(`  Params:`, params);

  // 1. Validate action exists in registry
  if (!actionRegistry.actions || !actionRegistry.actions[action]) {
    throw new ActionNotFoundError(action, tenantId);
  }

  const actionConfig = actionRegistry.actions[action];

  // 2. Check if action is enabled
  if (!actionConfig.enabled) {
    throw new ActionDisabledError(action, tenantId);
  }

  // 3. Parse handler string (format: "namespace.function")
  const handler = actionConfig.handler;
  if (!handler || typeof handler !== 'string') {
    throw new InvalidHandlerError(handler, action);
  }

  const handlerParts = handler.split('.');
  if (handlerParts.length !== 2) {
    throw new InvalidHandlerError(handler, action);
  }

  const [namespace, functionName] = handlerParts;

  // 4. Handle special namespaces
  // 4a. Recommender namespace - call recommendation engine directly
  if (namespace === 'recommender') {
    console.log(`[tools] Executing recommender action: ${functionName}`);
    const startTime = Date.now();

    try {
      // Handle different recommender methods
      if (functionName === 'outfit') {
        // Outfit recommendation - returns shirt, pant, shoe
        const query = params?.query || params?.message || '';
        const preferences = params?.preferences || [];

        console.log(`[tools] Outfit recommender params:`, { query, preferences });

        // Call outfit recommendation engine
        const outfitResult = await recommendOutfit(
          tenantConfig.tenantId || tenantConfig.id || tenantId,
          query,
          preferences
        );

        const executionTime = Date.now() - startTime;
        console.log(`[tools] Outfit recommendation completed in ${executionTime}ms`);

        // Format result for tool response
        const enrichedResult = {
          type: 'outfit',
          items: outfitResult,
          _meta: {
            action,
            handler,
            adapterSource: 'outfit-recommender',
            executionTime,
            timestamp: new Date().toISOString()
          }
        };

        // Log successful tool execution
        logToolExecution(tenantId, action, params, enrichedResult);

        return enrichedResult;
      } else {
        // Product recommendation - returns list of similar products
        const query = params?.query || params?.message || '';
        const preferences = params?.preferences || [];
        const limit = params?.limit || 10;
        const minScore = params?.minScore || 0.1;

        console.log(`[tools] Product recommender params:`, { query, preferences, limit, minScore });

        // Call recommendation engine
        const results = await recommendProducts(
          tenantConfig.tenantId || tenantConfig.id || tenantId,
          query,
          preferences,
          { limit, minScore, includeScores: true }
        );

        const executionTime = Date.now() - startTime;
        console.log(`[tools] Product recommendation completed in ${executionTime}ms, ${results.length} products`);

        // Format result for tool response
        const enrichedResult = {
          type: 'recommendations',
          items: results,
          _meta: {
            action,
            handler,
            adapterSource: 'recommender-engine',
            executionTime,
            timestamp: new Date().toISOString()
          }
        };

        // Log successful tool execution
        logToolExecution(tenantId, action, params, enrichedResult);

        return enrichedResult;
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[tools] Recommender action failed after ${executionTime}ms:`, error.message);

      // Re-throw with additional context
      error.action = action;
      error.handler = handler;
      error.executionTime = executionTime;
      throw error;
    }
  }

  // 4b. Commerce namespace - cart and checkout operations
  if (namespace === 'commerce') {
    console.log(`[tools] Executing commerce action: ${functionName}`);
    const startTime = Date.now();
    const sessionId = params?.sessionId || params?.userId || null;

    try {
      let result;

      if (functionName === 'addToCart') {
        result = await addToCart({
          tenantConfig,
          sessionId,
          productId: params?.productId,
          quantity: params?.quantity || 1
        });
      } else if (functionName === 'addMultipleToCart') {
        result = await addMultipleToCart({
          tenantConfig,
          sessionId,
          productIds: params?.productIds || []
        });
      } else if (functionName === 'addOutfitToCart') {
        result = await addOutfitToCart({
          tenantConfig,
          sessionId,
          shirtId: params?.shirtId,
          pantId: params?.pantId,
          shoeId: params?.shoeId
        });
      } else if (functionName === 'removeFromCart') {
        result = await removeFromCart({
          tenantConfig,
          sessionId,
          productId: params?.productId
        });
      } else if (functionName === 'viewCart') {
        result = await viewCart({
          tenantConfig,
          sessionId
        });
      } else if (functionName === 'checkout') {
        result = await checkoutCart({
          tenantConfig,
          sessionId,
          paymentMethod: params?.paymentMethod || 'COD'
        });
      } else if (functionName === 'viewOrders') {
        result = await getOrders({
          tenantConfig,
          sessionId
        });
      } else if (functionName === 'getOrderStatus') {
        result = await getOrderStatus({
          tenantConfig,
          orderId: params?.orderId
        });
      } else if (functionName === 'cancelOrder') {
        result = await cancelOrder({
          tenantConfig,
          orderId: params?.orderId,
          reason: params?.reason
        });
      } else if (functionName === 'search') {
        // Handle product search using actual product data
        const query = params?.query || '';
        const limit = params?.limit || 10;
        
        console.log(`[tools] Executing product search for query: "${query}"`);
        
        // Load products for tenant
        const products = await loadProductsForTenant(tenantConfig.tenantId || tenantConfig.id || tenantId);
        
        // ===== SMART PRICE FILTERING =====
        // Extract price constraints from query (e.g., "under $100", "below 50", "less than ₹5000")
        const pricePatterns = [
          /(?:under|below|less than|cheaper than|max|maximum|up to|within|budget)\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
          /[$₹€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:or less|max|maximum|budget)/i,
          /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:or less|and under|and below)/i
        ];
        
        let maxPrice = null;
        let minPrice = null;
        
        // Check for max price
        for (const pattern of pricePatterns) {
          const match = query.match(pattern);
          if (match) {
            maxPrice = parseFloat(match[1].replace(/,/g, ''));
            console.log(`[tools] Detected max price filter: $${maxPrice}`);
            break;
          }
        }
        
        // Check for min price patterns
        const minPricePatterns = [
          /(?:over|above|more than|at least|minimum|starting|from)\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
          /[$₹€£]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:or more|minimum|and above|and up|\+)/i
        ];
        
        for (const pattern of minPricePatterns) {
          const match = query.match(pattern);
          if (match) {
            minPrice = parseFloat(match[1].replace(/,/g, ''));
            console.log(`[tools] Detected min price filter: $${minPrice}`);
            break;
          }
        }
        
        // Check for price range (e.g., "$50-100", "between 50 and 100")
        const rangePatterns = [
          /[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–to]+\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
          /between\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*and\s*[$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i
        ];
        
        for (const pattern of rangePatterns) {
          const match = query.match(pattern);
          if (match) {
            minPrice = parseFloat(match[1].replace(/,/g, ''));
            maxPrice = parseFloat(match[2].replace(/,/g, ''));
            console.log(`[tools] Detected price range: $${minPrice} - $${maxPrice}`);
            break;
          }
        }
        
        // ===== CATEGORY DETECTION =====
        const categoryKeywords = {
          electronics: ['electronics', 'electronic', 'gadget', 'tech', 'device', 'headphone', 'speaker', 'camera', 'audio', 'wireless', 'bluetooth', 'laptop', 'computer', 'phone', 'tablet', 'webcam', 'keyboard', 'mouse'],
          accessories: ['accessories', 'accessory', 'watch', 'jewelry', 'bag', 'belt', 'wallet', 'backpack'],
          beauty: ['beauty', 'cosmetic', 'skincare', 'makeup', 'fragrance', 'perfume', 'serum', 'cream', 'lotion'],
          grocery: ['grocery', 'groceries', 'food', 'snack', 'beverage', 'drink'],
          clothing: ['clothing', 'clothes', 'shirt', 'pant', 'pants', 'dress', 'jacket', 'apparel', 'tshirt', 't-shirt', 'hoodie', 'jeans', 'shorts', 'skirt', 'blouse', 'sweater'],
          fitness: ['fitness', 'gym', 'exercise', 'workout', 'sport', 'athletic', 'yoga', 'dumbbell', 'weights', 'resistance'],
          footwear: ['footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals', 'slipper', 'loafer'],
          furniture: ['furniture', 'chair', 'table', 'desk', 'sofa', 'bed', 'shelf', 'cabinet'],
          home: ['kitchen', 'decor', 'appliance', 'household', 'lamp', 'purifier']
        };
        
        const queryLower = query.toLowerCase();
        let detectedCategory = null;
        
        // Use word boundary matching to avoid partial matches (e.g., "laptop" matching "top")
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
          const hasMatch = keywords.some(kw => {
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            return regex.test(queryLower);
          });
          if (hasMatch) {
            detectedCategory = category;
            console.log(`[tools] Detected category filter: ${category}`);
            break;
          }
        }
        
        // ===== COLOR DETECTION =====
        const colorKeywords = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'grey', 'brown', 'pink', 'purple', 'orange', 'navy', 'beige', 'tan', 'silver', 'gold', 'rose', 'cream', 'maroon', 'teal', 'cyan'];
        const detectedColors = colorKeywords.filter(color => queryLower.includes(color));
        if (detectedColors.length > 0) {
          console.log(`[tools] Detected color filters: ${detectedColors.join(', ')}`);
        }
        
        // Simple search: filter products by name, description, category, or tags
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        
        // Remove price-related words and stop words from search terms
        const priceWords = ['under', 'below', 'above', 'over', 'less', 'more', 'than', 'budget', 'cheap', 'expensive', 'affordable', 'maximum', 'minimum'];
        const stopWords = ['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'does', 'did', 'doing', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'need', 'want', 'looking', 'find', 'show', 'get', 'give', 'something', 'anything', 'some', 'any', 'good', 'best', 'great', 'nice', 'options', 'option', 'like', 'help', 'please'];
        const filteredQueryWords = queryWords.filter(w => !priceWords.includes(w) && !stopWords.includes(w) && !/^\d+$/.test(w));
        
        // Create search variants (singular/plural forms) for better matching
        const createWordVariants = (word) => {
          const variants = [word];
          // Handle common plural/singular conversions
          if (word.endsWith('s') && word.length > 3) {
            // Remove trailing 's' for singular form
            variants.push(word.slice(0, -1));
          }
          if (word.endsWith('es') && word.length > 4) {
            // Remove trailing 'es' for singular form
            variants.push(word.slice(0, -2));
          }
          if (!word.endsWith('s')) {
            // Add 's' for plural form
            variants.push(word + 's');
          }
          return variants;
        };
        
        const matchedProducts = products
          // First, apply hard filters (price, category, color)
          .filter(product => {
            // Price filter
            if (maxPrice !== null && product.price > maxPrice) return false;
            if (minPrice !== null && product.price < minPrice) return false;
            
            // Category filter (if detected)
            if (detectedCategory && product.category !== detectedCategory) return false;
            
            // Color filter (if detected)
            if (detectedColors.length > 0) {
              const productColors = (product.colors || []).map(c => c.toLowerCase());
              const hasMatchingColor = detectedColors.some(color => 
                productColors.some(pc => pc.includes(color) || color.includes(pc))
              );
              if (!hasMatchingColor) return false;
            }
            
            return true;
          })
          .map(product => {
            let score = 0;
            const searchFields = [
              product.name || '',
              product.description || '',
              product.category || '',
              ...(product.tags || [])
            ].join(' ').toLowerCase();
            
            // Count matching words (including variants)
            for (const word of queryWords) {
              const variants = createWordVariants(word);
              for (const variant of variants) {
                if (searchFields.includes(variant)) {
                  score += 1;
                  break; // Only count once per original word
                }
              }
            }
            // Bonus for exact phrase match
            if (searchFields.includes(queryLower)) score += 2;
            
            // Bonus for price relevance (if price filter applied)
            if (maxPrice !== null) {
              // Give slight preference to items closer to budget (better value)
              const priceRatio = product.price / maxPrice;
              if (priceRatio >= 0.7 && priceRatio <= 1.0) score += 0.5;
            }
            
            return { ...product, searchScore: score };
          })
          .filter(p => {
            // STRICT RELEVANCE: Always require SOME text match for quality results
            // Even with filters, we want at least partial text relevance
            const hasFilters = maxPrice !== null || minPrice !== null || detectedCategory || detectedColors.length > 0;
            
            // If we have explicit filters AND a text score, show the product
            if (hasFilters && p.searchScore > 0) return true;
            
            // If we have explicit filters but no text match, require the product to
            // at least be in the detected category (not just any product passing price filter)
            if (hasFilters && detectedCategory && p.searchScore === 0) {
              // Allow if the detected category matches AND the product is relevant
              // But skip if the search has very specific non-matching terms
              return filteredQueryWords.length <= 1; // Allow only if query is generic
            }
            
            // For queries with no explicit filters, require text match
            return p.searchScore > 0;
          })
          .sort((a, b) => b.searchScore - a.searchScore)
          .slice(0, limit)
          .map(({ searchScore, ...product }) => product);
        
        // Build informative message
        let filterInfo = [];
        if (maxPrice !== null) filterInfo.push(`under $${maxPrice}`);
        if (minPrice !== null) filterInfo.push(`over $${minPrice}`);
        if (detectedCategory) filterInfo.push(`in ${detectedCategory}`);
        if (detectedColors.length > 0) filterInfo.push(`in ${detectedColors.join('/')}`);
        
        const filterSuffix = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';
        
        result = {
          type: 'recommendations',
          items: matchedProducts,
          totalFound: matchedProducts.length,
          filters: { maxPrice, minPrice, category: detectedCategory, colors: detectedColors },
          message: matchedProducts.length > 0 
            ? `Found ${matchedProducts.length} products${filterSuffix}`
            : `No products found for "${query}"${filterSuffix}`
        };
      } else if (functionName === 'compareProducts') {
        // Handle product comparison
        const productIds = params?.productIds || [];
        const productNames = params?.productNames || [];
        
        console.log(`[tools] Executing product comparison for:`, { productIds, productNames });
        
        // Load products for tenant
        const products = await loadProductsForTenant(tenantConfig.tenantId || tenantConfig.id || tenantId);
        
        // Find products by ID or name
        const productsToCompare = [];
        
        // First try to find by IDs
        for (const id of productIds) {
          const product = products.find(p => p.id === id);
          if (product) productsToCompare.push(product);
        }
        
        // Then try to find by names (fuzzy match)
        for (const name of productNames) {
          const nameLower = name.toLowerCase();
          const product = products.find(p => 
            p.name.toLowerCase().includes(nameLower) || 
            nameLower.includes(p.name.toLowerCase())
          );
          if (product && !productsToCompare.some(p => p.id === product.id)) {
            productsToCompare.push(product);
          }
        }
        
        // If we still don't have products, search by query terms
        if (productsToCompare.length === 0 && params?.query) {
          const queryLower = params.query.toLowerCase();
          const matches = products.filter(p => 
            p.name.toLowerCase().includes(queryLower) || 
            p.description?.toLowerCase().includes(queryLower)
          ).slice(0, 3);
          productsToCompare.push(...matches);
        }
        
        if (productsToCompare.length < 2) {
          result = {
            type: 'comparison',
            items: productsToCompare,
            success: false,
            message: 'Please specify at least 2 products to compare. You can search for products first.'
          };
        } else {
          // Build comparison data
          const comparison = {
            products: productsToCompare.map(p => ({
              id: p.id,
              name: p.name,
              category: p.category,
              price: p.price,
              currency: p.currency || 'USD',
              description: p.description,
              tags: p.tags || [],
              colors: p.colors || [],
              sizes: p.sizes || [],
              rating: p.rating || null,
              inStock: p.inStock !== false
            })),
            // Generate comparison summary
            priceRange: {
              lowest: Math.min(...productsToCompare.map(p => p.price)),
              highest: Math.max(...productsToCompare.map(p => p.price))
            },
            categories: [...new Set(productsToCompare.map(p => p.category))],
            commonTags: productsToCompare.length > 0 
              ? (productsToCompare[0].tags || []).filter(tag => 
                  productsToCompare.every(p => (p.tags || []).includes(tag))
                )
              : []
          };
          
          result = {
            type: 'comparison',
            items: productsToCompare,
            comparison,
            success: true,
            message: `Comparing ${productsToCompare.length} products`
          };
        }
      } else {
        // Fall through to adapter loading for other commerce functions
        console.log(`[tools] Commerce function ${functionName} not handled directly, falling through to adapter`);
      }

      if (result) {
        const executionTime = Date.now() - startTime;
        console.log(`[tools] Commerce action completed in ${executionTime}ms`);

        // Add metadata to result
        const enrichedResult = {
          ...result,
          _meta: {
            action,
            handler,
            adapterSource: 'cart-service',
            executionTime,
            timestamp: new Date().toISOString()
          }
        };

        // Log successful tool execution
        logToolExecution(tenantId, action, params, enrichedResult);

        return enrichedResult;
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[tools] Commerce action failed after ${executionTime}ms:`, error.message);

      error.action = action;
      error.handler = handler;
      error.executionTime = executionTime;
      throw error;
    }
  }

  // 4c. Load adapter for other namespaces (commerce.search, settings, etc.)
  const { adapter, source } = await loadAdapter(namespace, functionName, tenantId, action);

  // 5. Get function from adapter
  const adapterFunction = adapter[functionName];
  if (!adapterFunction || typeof adapterFunction !== 'function') {
    throw new FunctionNotFoundError(functionName, namespace, action);
  }

  // 6. Execute the function
  console.log(`[tools] Executing: ${handler} (source: ${source})`);
  const startTime = Date.now();

  try {
    const result = await adapterFunction(params, tenantConfig);
    const executionTime = Date.now() - startTime;

    console.log(`[tools] Action completed in ${executionTime}ms`);

    // Normalize result structure for product-related actions
    let normalizedResult = { ...result };
    
    // If this is a search/product action with 'results' array, normalize to 'items' format
    if (action === 'search_products' && result.results && Array.isArray(result.results)) {
      normalizedResult = {
        type: 'recommendations', // Use same type for consistent UI handling
        items: result.results,
        totalFound: result.totalFound,
        message: result.message
      };
    }

    // Add metadata to result
    const enrichedResult = {
      ...normalizedResult,
      _meta: {
        action,
        handler,
        adapterSource: source,
        executionTime,
        timestamp: new Date().toISOString()
      }
    };

    // Log successful tool execution
    logToolExecution(tenantId, action, params, enrichedResult);

    return enrichedResult;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[tools] Action failed after ${executionTime}ms:`, error.message);

    // Re-throw with additional context
    error.action = action;
    error.handler = handler;
    error.executionTime = executionTime;
    throw error;
  }
}

module.exports = {
  runAction,
  ActionNotFoundError,
  ActionDisabledError,
  InvalidHandlerError,
  AdapterNotFoundError,
  FunctionNotFoundError
};
