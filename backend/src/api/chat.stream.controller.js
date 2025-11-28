/**
 * Chat Streaming Controller
 * 
 * Handles streaming chat responses using Server-Sent Events (SSE).
 * Provides real-time response streaming for better UX.
 * 
 * Event Types:
 * - 'start': Indicates streaming has started
 * - 'chunk': Text chunk from LLM
 * - 'tool': Tool being called (e.g., search_products)
 * - 'products': Product results from tool execution
 * - 'done': Streaming complete
 * - 'error': Error occurred
 */

const { runLLMOrchestratorStreaming } = require('../orchestrator/llm.stream');
const { getEffectiveTenant } = require('../utils/tenantLoader');
const { loadActionRegistry } = require('../utils/registryLoader');

/**
 * Handle streaming chat request using SSE
 */
async function handleChatStream(req, res) {
  const { tenant, message, conversationHistory = [], history = [], sessionId } = req.body;
  const chatHistory = history.length > 0 ? history : conversationHistory;

  // Validate required fields
  if (!tenant || !message) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: tenant and message'
    });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Helper to send SSE events
  const sendEvent = (type, data) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log(`[ChatStream] Processing streaming request for tenant: ${tenant}`);
    sendEvent('start', { message: 'Processing your request...' });

    // Load tenant configuration
    const tenantConfig = await getEffectiveTenant(tenant);
    
    // Load action registry
    let actionRegistry;
    try {
      actionRegistry = await loadActionRegistry(tenantConfig._effectiveId || tenant);
    } catch {
      actionRegistry = { actions: {} };
    }

    // Run streaming orchestrator
    await runLLMOrchestratorStreaming({
      tenantConfig,
      actionRegistry,
      userMessage: message,
      conversationHistory: chatHistory,
      sessionId,
      onChunk: (chunk) => {
        sendEvent('chunk', { text: chunk });
      },
      onTool: (toolName, params) => {
        sendEvent('tool', { name: toolName, params });
      },
      onProducts: (products, action) => {
        sendEvent('products', { items: products, action });
      },
      onComplete: (result) => {
        sendEvent('done', {
          success: true,
          replyType: result.type,
          action: result.action,
          provider: result.provider,
          model: result.model
        });
      },
      onError: (error) => {
        sendEvent('error', { message: error });
      }
    });

  } catch (error) {
    console.error('[ChatStream] Error:', error.message);
    sendEvent('error', { message: error.message || 'Stream processing failed' });
  } finally {
    res.end();
  }
}

module.exports = { handleChatStream };
