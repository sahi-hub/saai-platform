/**
 * Example Tenant Adapter
 * 
 * Tenant-specific overrides for the "example" tenant.
 * These functions override the default adapter implementations
 * to provide custom behavior for this specific tenant.
 * 
 * Only include functions that need custom behavior.
 * Missing functions will fall back to the generic adapters.
 */

/**
 * Custom checkout for example tenant
 * 
 * This override demonstrates how a tenant can customize
 * specific actions while inheriting others from generic adapters.
 * 
 * @param {Object} params - Checkout parameters
 * @param {string} params.cartId - Cart ID
 * @param {Object} params.paymentMethod - Payment details
 * @param {Object} tenantConfig - Tenant configuration
 * 
 * @returns {Promise<Object>} Checkout result
 */
async function checkout(params, tenantConfig) {
  const cartId = params?.cartId;
  const paymentMethod = params?.paymentMethod || 'default';

  console.log(`[example.adapter.checkout] CUSTOM OVERRIDE for tenant: ${tenantConfig.tenantId}`);
  console.log(`  Cart: ${cartId}, Payment: ${JSON.stringify(paymentMethod)}`);

  if (!cartId) {
    throw new Error('Missing required parameter: cartId');
  }

  // Example tenant applies a special 10% discount
  const subtotal = 89.97;
  const discount = subtotal * 0.10;
  const total = subtotal - discount;

  await new Promise(resolve => setTimeout(resolve, 150));

  return {
    executed: true,
    handler: 'commerce.checkout',
    tenant: tenantConfig.tenantId,
    override: true,  // Indicates this is a tenant-specific override
    params: { cartId, paymentMethod },
    order: {
      orderId: `EXAMPLE-ORD-${Date.now()}`,
      status: 'confirmed',
      subtotal,
      discount,
      total,
      paymentStatus: 'paid',
      special: 'Example tenant receives 10% discount!'
    },
    message: `✨ Custom checkout for Example Tenant - 10% discount applied!`
  };
}

/**
 * Custom product search for example tenant
 * 
 * Example tenant has access to premium products
 * 
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query
 * @param {Object} tenantConfig - Tenant configuration
 * 
 * @returns {Promise<Object>} Search results
 */
async function search(params, tenantConfig) {
  const query = params?.query || '';
  const limit = params?.limit || 10;

  console.log(`[example.adapter.search] CUSTOM OVERRIDE for tenant: ${tenantConfig.tenantId}`);
  console.log(`  Query: "${query}" (premium products included)`);

  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    executed: true,
    handler: 'commerce.search',
    tenant: tenantConfig.tenantId,
    override: true,
    params: { query, limit },
    results: [
      {
        id: 'premium-001',
        name: `Premium: ${query}`,
        price: 99.99,
        inStock: true,
        tier: 'premium'
      },
      {
        id: 'premium-002',
        name: `Exclusive: ${query}`,
        price: 149.99,
        inStock: true,
        tier: 'exclusive'
      }
    ],
    totalFound: 2,
    message: `✨ Found 2 PREMIUM products for query: "${query}"`
  };
}

// Export only the functions that need custom behavior
// Other functions will fall back to generic adapters
module.exports = {
  checkout,
  search
};
