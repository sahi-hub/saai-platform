# SAAI Backend - Quick Reference

## 🚀 Quick Start

```bash
npm install
node server.js
```

Server: http://localhost:3001

## 📡 API Endpoint

### POST /chat

**With Action:**
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": "example",
    "message": "Search for laptops",
    "action": "search_products",
    "params": {"query": "laptop"}
  }'
```

**Without Action:**
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant": "example", "message": "Hello"}'
```

## 🎯 Available Actions

### Commerce
| Action | Handler | Required Params |
|--------|---------|-----------------|
| search_products | commerce.search | query |
| add_to_cart | commerce.addToCart | productId, quantity |
| checkout | commerce.checkout | cartId |
| recommend_products | commerce.recommend | userId |

### Settings
| Action | Handler | Required Params |
|--------|---------|-----------------|
| get_preferences | settings.getPreferences | userId |
| update_preferences | settings.updatePreferences | userId, preferences |
| get_account_settings | settings.getAccountSettings | accountId |

### Support
| Action | Handler | Required Params |
|--------|---------|-----------------|
| create_ticket | support.createTicket | subject, description |
| get_ticket_status | support.getTicketStatus | ticketId |
| search_knowledge_base | support.searchKnowledgeBase | query |

## 🧪 Test Commands

```bash
# Test 1: No action (backward compatibility)
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"client1","message":"hello"}' | jq

# Test 2: Generic adapter
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"client1","message":"search","action":"search_products","params":{"query":"laptop"}}' | jq

# Test 3: Tenant override
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"search","action":"search_products","params":{"query":"laptop"}}' | jq

# Test 4: Fallback to generic
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"add","action":"add_to_cart","params":{"productId":"laptop-123","quantity":1}}' | jq

# Test 5: Tenant custom checkout (10% discount)
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"checkout","action":"checkout","params":{"cartId":"cart-123"}}' | jq

# Test 6: Disabled action error
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"client1","message":"recommend","action":"recommend_products","params":{"userId":"user-123"}}' | jq

# Test 7: Invalid action error
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"invalid","action":"invalid_action","params":{}}' | jq
```

## 📁 Key Files

```
backend/
├── server.js                           # Start here
├── src/
│   ├── api/chat.controller.js          # Main endpoint
│   ├── orchestrator/tools.js           # Action dispatcher
│   ├── adapters/                       # Generic adapters
│   │   ├── commerceAdapter.js
│   │   ├── settingsAdapter.js
│   │   └── supportAdapter.js
│   ├── tenants/                        # Tenant overrides
│   │   └── example.adapter.js
│   ├── config/                         # Tenant configs
│   │   ├── example.config.json
│   │   └── client1.config.json
│   └── registry/                       # Action registries
│       ├── example.registry.json
│       └── client1.registry.json
```

## ⚡ Adding New Features

### Add a New Action

1. **Add to adapter** (`/src/adapters/commerceAdapter.js`):
```javascript
async function newFunction(params, tenantConfig) {
  return {
    executed: true,
    handler: 'commerce.newFunction',
    // ... your implementation
  };
}

module.exports = {
  // ... existing functions
  newFunction
};
```

2. **Add to registry** (`/src/registry/example.registry.json`):
```json
{
  "new_action": {
    "enabled": true,
    "handler": "commerce.newFunction",
    "description": "Does something new",
    "requiredParams": ["param1", "param2"]
  }
}
```

3. **Test it**:
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","action":"new_action","params":{"param1":"value1","param2":"value2"}}'
```

### Add a Tenant Override

Create `/src/tenants/{tenant}.adapter.js`:

```javascript
module.exports = {
  // Override specific function
  checkout(params, tenantConfig) {
    // Custom implementation for this tenant
    return {
      executed: true,
      handler: 'commerce.checkout',
      override: true,
      // ... custom logic
    };
  }
  
  // Other functions fall back to generic adapter
};
```

### Add a New Adapter Namespace

1. Create `/src/adapters/analyticsAdapter.js`:
```javascript
module.exports = {
  async trackEvent(params, tenantConfig) {
    return {
      executed: true,
      handler: 'analytics.trackEvent',
      eventId: 'evt-123',
      tracked: true
    };
  }
};
```

2. Add to registry:
```json
{
  "track_event": {
    "enabled": true,
    "handler": "analytics.trackEvent",
    "requiredParams": ["event", "userId"]
  }
}
```

## 🔍 Debugging

### Check Server Logs

```bash
# Server logs show:
# - Adapter loading decisions
# - Function execution
# - Error details

# Example output:
# [tools] Loading adapter: commerce for tenant: example
# [tools] Trying tenant-specific: /src/tenants/example.adapter.js
# [tools] ✓ Using tenant-specific adapter
```

### Check Metadata

Every response includes `_meta`:

```json
{
  "_meta": {
    "action": "search_products",
    "handler": "commerce.search",
    "adapterSource": "tenant-specific",  // or "generic"
    "executionTime": 105,
    "timestamp": "2025-11-25T10:30:45.123Z"
  }
}
```

## ❌ Error Codes

| HTTP Code | Error | Meaning |
|-----------|-------|---------|
| 404 | ActionNotFoundError | Action not in registry |
| 403 | ActionDisabledError | Action disabled in registry |
| 500 | InvalidHandlerError | Bad handler format |
| 500 | AdapterNotFoundError | No adapter file |
| 500 | FunctionNotFoundError | Function not found |

## 📊 Response Format

```json
{
  "success": true,
  "tenantConfig": {
    "tenantId": "example",
    "displayName": "Example Corp",
    "features": { ... }
  },
  "actionRegistry": {
    "search_products": { ... },
    "add_to_cart": { ... }
  },
  "actionResult": {
    "executed": true,
    "handler": "commerce.search",
    // ... action-specific data
    "_meta": {
      "action": "search_products",
      "handler": "commerce.search",
      "adapterSource": "generic",
      "executionTime": 105,
      "timestamp": "2025-11-25T..."
    }
  },
  "echo": {
    "message": "Search for laptops",
    "action": "search_products",
    "params": { ... }
  }
}
```

## 🛠️ Common Tasks

### Restart Server
```bash
pkill -f "node server.js"
sleep 1
node server.js &
```

### Check if Server is Running
```bash
curl http://localhost:3001/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"ping"}'
```

### View All Actions for Tenant
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"test"}' | jq '.actionRegistry'
```

### Disable an Action
Edit `/src/registry/{tenant}.registry.json`:
```json
{
  "action_name": {
    "enabled": false,  // Set to false
    "handler": "...",
    ...
  }
}
```

## 📚 Documentation

- [README.md](./README.md) - Project overview
- [STEP_4_COMPLETE.md](./STEP_4_COMPLETE.md) - Action registry
- [STEP_5_COMPLETE.md](./STEP_5_COMPLETE.md) - Orchestrator details
- [ARCHITECTURE_STEP5.md](./ARCHITECTURE_STEP5.md) - Full architecture
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Complete summary

## ✅ Current Status

- ✅ Multi-tenant support
- ✅ Action orchestration
- ✅ Intelligent adapter fallback
- ✅ Error handling
- ✅ Metadata tracking
- ✅ 7/7 tests passing
- ✅ Production ready

## 🔜 Next: STEP 6

**Memory/Conversation History**
- Session management
- Context storage
- Conversation history

---

**Quick Start**: `npm install && node server.js`  
**Test**: `curl -X POST http://localhost:3001/chat -H "Content-Type: application/json" -d '{"tenant":"example","message":"hello"}'`  
**Status**: ✅ Production Ready
