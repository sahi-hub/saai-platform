/**
 * SAAI Tool Schema
 * 
 * Unified function/tool definitions for all LLM providers.
 * This schema is converted to provider-specific formats by each provider.
 */

const toolDefinitions = [
  {
    name: "search_products",
    description: "PRIMARY tool for finding products. Use when user says 'show me', 'find', 'I want', 'I need', 'looking for', or mentions a product type with price (e.g., 'shoes under $100'). Supports smart filtering by price, color, category automatically. ALWAYS use this first when user mentions ANY product with or without filters.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Full user search query INCLUDING price, color, category filters (e.g., 'blue running shoes under $150', 'formal shirts', 'electronics under $500'). Pass the complete user query."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "compare_products",
    description: "Use ONLY when user explicitly wants to COMPARE multiple specific products. Trigger words: 'compare', 'vs', 'versus', 'which is better', 'difference between', 'help me choose between X and Y'. DO NOT use for general product searches.",
    parameters: {
      type: "object",
      properties: {
        productIds: {
          type: "array",
          description: "Array of product IDs to compare if known (e.g., ['p001', 'p002']).",
          items: { type: "string" }
        },
        productNames: {
          type: "array",
          description: "Array of product names to compare (e.g., ['Running Shoes Pro', 'Smart Watch Elite']). Use when IDs are not known.",
          items: { type: "string" }
        },
        query: {
          type: "string",
          description: "Original comparison query from user to help find relevant products (e.g., 'compare headphones and smartwatch')."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "recommend_products",
    description: "Use ONLY when user asks for SUGGESTIONS or says 'recommend', 'suggest', 'what do you think', 'any ideas'. DO NOT use for searches like 'show me X' or 'I want X'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User request text or intent describing what they're looking for."
        },
        preferences: {
          type: "array",
          description: "List of preference keywords like colors, styles, categories, occasions.",
          items: { type: "string" }
        }
      },
      required: ["query"]
    }
  },
  {
    name: "recommend_outfit",
    description: "Recommend a complete outfit consisting of a shirt/top, pant/bottom, and shoes for a specific event, occasion, or style. Use this when the user asks for a full look, outfit, or what to wear.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User request describing the occasion or style (e.g. 'white eid outfit', 'smart casual office outfit', 'formal wedding attire')."
        },
        preferences: {
          type: "array",
          description: "Preference keywords (colors, fabrics, vibes, occasions).",
          items: { type: "string" }
        }
      },
      required: ["query"]
    }
  },
  {
    name: "add_to_cart",
    description: "Add a SINGLE specific product to cart by its ID. Only use this for ONE item at a time. Do NOT use this for outfits - use add_outfit_to_cart instead.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "The product ID from the catalog (e.g. 'p101', 'p109')."
        },
        quantity: {
          type: "integer",
          description: "Quantity to add. Defaults to 1.",
          default: 1
        }
      },
      required: ["productId"]
    }
  },
  {
    name: "add_outfit_to_cart",
    description: "Add a complete outfit to cart. Use this when: (1) user says 'add this outfit', 'add these items', 'add the outfit', 'buy this look', or (2) you previously recommended an outfit and user wants to add it. Extract shirt, pant, and shoe IDs from the conversation history.",
    parameters: {
      type: "object",
      properties: {
        shirtId: {
          type: "string",
          description: "The shirt/top product ID from the outfit (e.g. 'p109')."
        },
        pantId: {
          type: "string",
          description: "The pant/bottom product ID from the outfit (e.g. 'p110')."
        },
        shoeId: {
          type: "string",
          description: "The shoe product ID from the outfit (e.g. 'p111')."
        }
      },
      required: ["shirtId", "pantId", "shoeId"]
    }
  },
  {
    name: "remove_from_cart",
    description: "Remove a product from the cart by its ID. Use this when the user wants to remove an item or delete something from their cart.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "The product ID to remove (e.g. 'p101')."
        }
      },
      required: ["productId"]
    }
  },
  {
    name: "view_orders",
    description: "View the user's order history. Use this when the user asks to see their orders, check order history, or track their purchases.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_order_status",
    description: "Get the status of a specific order. Use this when the user asks about a specific order status or tracking.",
    parameters: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The order ID to check (e.g. 'ORD-1715432100')."
        }
      },
      required: ["orderId"]
    }
  },
  {
    name: "cancel_order",
    description: "Cancel a specific order. Use this when the user wants to cancel an order.",
    parameters: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The order ID to cancel."
        },
        reason: {
          type: "string",
          description: "Reason for cancellation (optional)."
        }
      },
      required: ["orderId"]
    }
  },
  {
    name: "view_cart",
    description: "View the current contents of the user's shopping cart. Use this when the user asks to see their cart, check what's in their cart, or view cart contents.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "checkout",
    description: "Complete the purchase and create an order for items in the cart. Use this when the user wants to checkout, place an order, complete their purchase, or proceed to payment.",
    parameters: {
      type: "object",
      properties: {
        paymentMethod: {
          type: "string",
          description: "Payment method. Defaults to 'COD' (Cash on Delivery).",
          default: "COD"
        }
      },
      required: []
    }
  }
];

/**
 * Convert tool definitions to OpenAI/Groq format
 * @returns {Array} Tools in OpenAI format
 */
function toOpenAIFormat() {
  return toolDefinitions.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

/**
 * Convert tool definitions to Gemini format
 * @returns {Object} Tools in Gemini format
 */
function toGeminiFormat() {
  return {
    functionDeclarations: toolDefinitions.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }))
  };
}

/**
 * Get tool definition by name
 * @param {string} name - Tool name
 * @returns {Object|null} Tool definition or null
 */
function getToolByName(name) {
  return toolDefinitions.find(t => t.name === name) || null;
}

module.exports = {
  toolDefinitions,
  toOpenAIFormat,
  toGeminiFormat,
  getToolByName
};
