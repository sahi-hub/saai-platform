/**
 * SAAI Tool Schema
 * 
 * Unified function/tool definitions for all LLM providers.
 * This schema is converted to provider-specific formats by each provider.
 */

const toolDefinitions = [
  {
    name: "search_products",
    description: "Search products in the catalog by user query text. Use this when the user wants to find specific products or browse the catalog.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User search query for products (e.g. 'white shirt', 'formal shoes', 'blue jeans')."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "recommend_products",
    description: "Recommend products based on user intent and preferences. Use this when the user asks for suggestions or recommendations.",
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
    description: "Add a specific product (by ID) to the user's shopping cart. Use this when the user explicitly wants to add an item to their cart.",
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
