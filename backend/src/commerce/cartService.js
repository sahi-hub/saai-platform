/**
 * Cart Service
 * 
 * Business logic for cart operations: add, view, checkout.
 * Uses in-memory cartStore for prototype.
 */

const { getCartRecord, saveCartRecord, clearCart } = require('./cartStore');
const { loadProductsForTenant } = require('../utils/productLoader');
const { createOrder } = require('./orderService');

/**
 * Build cart summary (total items and amount)
 * 
 * @param {Object} cart - Cart record
 * @returns {Object} Summary with totalItems and totalAmount
 */
function buildCartSummary(cart) {
  let totalItems = 0;
  let totalAmount = 0;

  for (const item of cart.items) {
    totalItems += item.quantity;
    const p = item.productSnapshot;
    if (p && typeof p.price === 'number') {
      totalAmount += p.price * item.quantity;
    }
  }

  return {
    totalItems,
    totalAmount: Math.round(totalAmount * 100) / 100 // Round to 2 decimals
  };
}

/**
 * Add a product to cart
 * 
 * @param {Object} options - Add options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {string} options.sessionId - Session identifier
 * @param {string} options.productId - Product ID to add
 * @param {number} options.quantity - Quantity to add (default: 1)
 * @returns {Promise<Object>} Cart result
 */
async function addToCart({ tenantConfig, sessionId, productId, quantity = 1 }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  const cart = getCartRecord(tenantId, sessionId);

  console.log(`[cartService] Adding to cart: tenant=${tenantId}, product=${productId}, qty=${quantity}`);

  // Load products to find the one being added
  const products = await loadProductsForTenant(tenantId);
  const product = products.find(p => p.id === productId);

  if (!product) {
    console.log(`[cartService] Product ${productId} not found`);
    return {
      type: 'cart',
      success: false,
      action: 'add_to_cart',
      message: `Product ${productId} not found in catalog.`,
      cart: cart,
      summary: buildCartSummary(cart)
    };
  }

  // Check if already in cart
  const existing = cart.items.find(i => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
    console.log(`[cartService] Updated quantity for ${productId}: ${existing.quantity}`);
  } else {
    cart.items.push({
      productId,
      quantity,
      productSnapshot: {
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency || 'INR',
        category: product.category,
        imageUrl: product.imageUrl || product.image
      }
    });
    console.log(`[cartService] Added new item ${productId} to cart`);
  }

  saveCartRecord(tenantId, sessionId, cart);

  const summary = buildCartSummary(cart);
  console.log(`[cartService] Cart updated: ${summary.totalItems} items, total: ${summary.totalAmount}`);

  return {
    type: 'cart',
    success: true,
    action: 'add_to_cart',
    message: `Added ${product.name} to your cart. You now have ${summary.totalItems} item(s) totaling ₹${summary.totalAmount}.`,
    cart,
    summary,
    addedProduct: {
      id: product.id,
      name: product.name,
      price: product.price
    }
  };
}

/**
 * Add a complete outfit (shirt + pant + shoes) to cart
 * 
 * @param {Object} options - Add options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {string} options.sessionId - Session identifier
 * @param {string} options.shirtId - Shirt product ID
 * @param {string} options.pantId - Pant product ID
 * @param {string} options.shoeId - Shoe product ID
 * @returns {Promise<Object>} Cart result with all added items
 */
async function addOutfitToCart({ tenantConfig, sessionId, shirtId, pantId, shoeId }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  const cart = getCartRecord(tenantId, sessionId);

  console.log(`[cartService] Adding outfit to cart: tenant=${tenantId}, shirt=${shirtId}, pant=${pantId}, shoe=${shoeId}`);

  // Load products
  const products = await loadProductsForTenant(tenantId);
  const productMap = new Map(products.map(p => [p.id, p]));

  const itemsToAdd = [
    { id: shirtId, type: 'shirt' },
    { id: pantId, type: 'pant' },
    { id: shoeId, type: 'shoe' }
  ];

  const addedItems = [];
  const notFoundItems = [];

  for (const item of itemsToAdd) {
    const product = productMap.get(item.id);
    
    if (!product) {
      notFoundItems.push(item.id);
      continue;
    }

    // Check if already in cart
    const existing = cart.items.find(i => i.productId === item.id);
    if (existing) {
      existing.quantity += 1;
      console.log(`[cartService] Updated quantity for ${item.id}: ${existing.quantity}`);
    } else {
      cart.items.push({
        productId: item.id,
        quantity: 1,
        productSnapshot: {
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency || 'INR',
          category: product.category,
          imageUrl: product.imageUrl || product.image
        }
      });
      console.log(`[cartService] Added ${item.type} ${item.id} to cart`);
    }

    addedItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      type: item.type
    });
  }

  saveCartRecord(tenantId, sessionId, cart);
  const summary = buildCartSummary(cart);

  console.log(`[cartService] Outfit added: ${addedItems.length} items, total: ${summary.totalAmount}`);

  // Build response message
  let message;
  if (notFoundItems.length > 0) {
    message = `Added ${addedItems.length} outfit items to your cart. Could not find: ${notFoundItems.join(', ')}.`;
  } else {
    const names = addedItems.map(i => i.name).join(', ');
    message = `Added your complete outfit to cart: ${names}. Total: ₹${summary.totalAmount}.`;
  }

  return {
    type: 'cart',
    success: addedItems.length > 0,
    action: 'add_outfit_to_cart',
    message,
    cart,
    summary,
    addedItems,
    notFoundItems: notFoundItems.length > 0 ? notFoundItems : undefined
  };
}

/**
 * View cart contents
 * 
 * @param {Object} options - View options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {string} options.sessionId - Session identifier
 * @returns {Promise<Object>} Cart result
 */
async function viewCart({ tenantConfig, sessionId }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  const cart = getCartRecord(tenantId, sessionId);
  const summary = buildCartSummary(cart);

  console.log(`[cartService] Viewing cart: tenant=${tenantId}, items=${summary.totalItems}`);

  let message;
  if (cart.items.length === 0) {
    message = 'Your cart is empty. Start shopping to add items!';
  } else {
    const itemList = cart.items.map(i => 
      `${i.productSnapshot.name} (x${i.quantity}) - ₹${(i.productSnapshot.price * i.quantity).toFixed(2)}`
    ).join(', ');
    message = `Your cart has ${summary.totalItems} item(s): ${itemList}. Total: ₹${summary.totalAmount}.`;
  }

  return {
    type: 'cart',
    success: true,
    action: 'view_cart',
    message,
    cart,
    summary
  };
}

/**
 * Checkout cart and create order
 * 
 * @param {Object} options - Checkout options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {string} options.sessionId - Session identifier
 * @param {string} options.paymentMethod - Payment method (default: COD)
 * @returns {Promise<Object>} Checkout result
 */
async function checkoutCart({ tenantConfig, sessionId, paymentMethod = 'COD' }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  const cart = getCartRecord(tenantId, sessionId);
  const summary = buildCartSummary(cart);

  console.log(`[cartService] Checkout: tenant=${tenantId}, items=${summary.totalItems}, payment=${paymentMethod}`);

  if (!cart.items || cart.items.length === 0) {
    return {
      type: 'checkout',
      success: false,
      action: 'checkout',
      message: 'Your cart is empty. Add some items before checking out!',
      order: null
    };
  }

  // Generate order ID
  const orderId = `ORD-${Date.now()}`;
  
  const order = {
    orderId,
    tenantId,
    sessionId: sessionId || 'demo-session',
    items: cart.items.map(item => ({
      productId: item.productId,
      name: item.productSnapshot.name,
      price: item.productSnapshot.price,
      quantity: item.quantity,
      subtotal: item.productSnapshot.price * item.quantity
    })),
    summary,
    paymentMethod,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString()
  };

  // Save order to order service
  createOrder(order);

  // Clear cart after successful checkout (prototype behavior)
  clearCart(tenantId, sessionId);

  console.log(`[cartService] Order created: ${orderId}`);

  return {
    type: 'checkout',
    success: true,
    action: 'checkout',
    message: `🎉 Order ${orderId} confirmed! Total: ₹${summary.totalAmount}. Payment method: ${paymentMethod}. Thank you for your purchase!`,
    order
  };
}

/**
 * Remove a product from cart
 * 
 * @param {Object} options - Remove options
 * @param {Object} options.tenantConfig - Tenant configuration
 * @param {string} options.sessionId - Session identifier
 * @param {string} options.productId - Product ID to remove
 * @returns {Promise<Object>} Cart result
 */
async function removeFromCart({ tenantConfig, sessionId, productId }) {
  const tenantId = tenantConfig?.tenantId || tenantConfig?.id || 'example';
  const cart = getCartRecord(tenantId, sessionId);

  console.log(`[cartService] Removing from cart: tenant=${tenantId}, product=${productId}`);

  const initialCount = cart.items.length;
  cart.items = cart.items.filter(item => item.productId !== productId);
  
  if (cart.items.length === initialCount) {
    return {
      type: 'cart',
      success: false,
      action: 'remove_from_cart',
      message: `Product ${productId} was not found in your cart.`,
      cart,
      summary: buildCartSummary(cart)
    };
  }

  saveCartRecord(tenantId, sessionId, cart);
  const summary = buildCartSummary(cart);

  return {
    type: 'cart',
    success: true,
    action: 'remove_from_cart',
    message: `Removed item from your cart. You have ${summary.totalItems} item(s) remaining.`,
    cart,
    summary
  };
}

module.exports = {
  addToCart,
  addOutfitToCart,
  removeFromCart,
  viewCart,
  checkoutCart,
  buildCartSummary
};
