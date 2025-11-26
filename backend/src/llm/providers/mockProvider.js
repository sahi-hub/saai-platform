/**
 * Mock Provider
 * 
 * Fallback provider when all real providers fail.
 * Uses simple keyword matching to simulate tool decisions.
 */

/**
 * Call Mock provider with simulated tool calling
 * 
 * @param {Object} options
 * @param {Array} options.messages - Conversation messages
 * @param {boolean} options.enableTools - Whether to enable tool calling
 * @returns {Promise<Object>} Result with type: "message" or "tool"
 */
async function callWithTools({ messages, enableTools = true }) {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const lower = lastMessage.toLowerCase();

  console.log('[MOCK] Processing message (fallback mode)');

  // If tools enabled, try to detect intent
  if (enableTools) {
    // Outfit intent
    if (lower.includes('outfit') || 
        lower.includes('what to wear') || 
        lower.includes('what should i wear') ||
        lower.includes('dress me') ||
        lower.includes('complete look') ||
        lower.includes('full look')) {
      return {
        success: true,
        type: 'tool',
        provider: 'mock',
        model: 'mock-v1',
        text: '',
        toolCall: {
          name: 'recommend_outfit',
          arguments: { query: lastMessage }
        }
      };
    }

    // Recommend intent
    if (lower.includes('recommend') || 
        lower.includes('suggest') || 
        lower.includes('show me') ||
        lower.includes('find me') ||
        lower.includes('looking for')) {
      return {
        success: true,
        type: 'tool',
        provider: 'mock',
        model: 'mock-v1',
        text: '',
        toolCall: {
          name: 'recommend_products',
          arguments: { query: lastMessage }
        }
      };
    }

    // Search intent
    if (lower.includes('search') || lower.includes('browse')) {
      return {
        success: true,
        type: 'tool',
        provider: 'mock',
        model: 'mock-v1',
        text: '',
        toolCall: {
          name: 'search_products',
          arguments: { query: lastMessage }
        }
      };
    }

    // Add to cart intent
    if (lower.includes('add to cart') || lower.includes('add this')) {
      // Try to extract product ID
      const idMatch = lastMessage.match(/p\d+/i);
      return {
        success: true,
        type: 'tool',
        provider: 'mock',
        model: 'mock-v1',
        text: '',
        toolCall: {
          name: 'add_to_cart',
          arguments: { 
            productId: idMatch ? idMatch[0] : 'unknown',
            quantity: 1
          }
        }
      };
    }
  }

  // Default: conversational response
  let text = '';

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    text = "Hello! I'm your AI shopping assistant. How can I help you today? I can recommend products, create outfits, or help you find what you're looking for.";
  } else if (lower.includes('thank')) {
    text = "You're welcome! Is there anything else I can help you with?";
  } else if (lower.includes('help')) {
    text = "I'm here to help! I can:\n- Recommend products based on your preferences\n- Create complete outfit suggestions\n- Help you find specific items\n- Manage your shopping cart\n\nWhat would you like to do?";
  } else {
    text = "I understand you're interested in shopping. Would you like me to recommend some products or help you find something specific? I can also create complete outfit suggestions for any occasion!";
  }

  return {
    success: true,
    type: 'message',
    provider: 'mock',
    model: 'mock-v1',
    text
  };
}

/**
 * Call Mock without tools (plain text generation)
 * 
 * @param {Array} messages - Conversation messages
 * @returns {Promise<Object>} Result with type: "message"
 */
async function callPlain(messages) {
  return callWithTools({ messages, enableTools: false });
}

module.exports = {
  callWithTools,
  callPlain,
  MODEL: 'mock-v1'
};
