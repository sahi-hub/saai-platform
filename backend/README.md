# SAAI Backend - Multi-Tenant AI Orchestration Platform

A modular, tenant-aware backend for orchestrating AI agents and tools across multiple tenants.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start server
node server.js
```

Server runs on **http://localhost:3001**

## 📦 Current Implementation Status

### ✅ Completed Steps

| Step | Feature | Status | Documentation |
|------|---------|--------|---------------|
| 1 | Basic Express Server | ✅ Complete | - |
| 2 | Modular Routing | ✅ Complete | - |
| 3 | Tenant Configuration Loader | ✅ Complete | - |
| 4 | Action Registry Loader | ✅ Complete | [STEP_4_COMPLETE.md](./STEP_4_COMPLETE.md) |
| 5 | Adapters + Tools Orchestrator | ✅ Complete | [STEP_5_COMPLETE.md](./STEP_5_COMPLETE.md) |

### 🔄 Upcoming Steps

| Step | Feature | Status |
|------|---------|--------|
| 6 | Memory/Conversation History | 🔜 Planned |
| 7 | LLM Integration | 🔜 Planned |
| 8 | Real Adapter Implementations | 🔜 Planned |

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Request                       │
│   POST /chat { tenant, message, action, params }        │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Chat Controller                        │
│  - Load Tenant Config (STEP 3)                          │
│  - Load Action Registry (STEP 4)                        │
│  - Execute Action (STEP 5)                              │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│                Tools Orchestrator                       │
│  - Validate Action                                      │
│  - Resolve Adapter (tenant-specific or generic)         │
│  - Execute Function                                     │
│  - Return Result with Metadata                          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Adapters Layer                         │
│                                                         │
│  Tenant-Specific       Generic Adapters                │
│  (/tenants/)          (/adapters/)                      │
│  ├─ example.adapter   ├─ commerceAdapter                │
│  └─ client1.adapter   ├─ settingsAdapter                │
│                       └─ supportAdapter                 │
└─────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE_STEP5.md](./ARCHITECTURE_STEP5.md) for detailed architecture documentation.

## 📁 Project Structure

```
backend/
├── server.js                    # Express server entry point
├── package.json                 # Dependencies
│
├── src/
│   ├── api/
│   │   └── chat.controller.js   # Main API endpoint
│   │
│   ├── config/                  # STEP 3: Tenant Configurations
│   │   ├── example.config.json
│   │   └── client1.config.json
│   │
│   ├── registry/                # STEP 4: Action Registries
│   │   ├── example.registry.json
│   │   └── client1.registry.json
│   │
│   ├── adapters/                # STEP 5: Generic Adapters
│   │   ├── commerceAdapter.js   # E-commerce operations
│   │   ├── settingsAdapter.js   # User preferences
│   │   └── supportAdapter.js    # Support operations
│   │
│   ├── tenants/                 # STEP 5: Tenant-Specific Adapters
│   │   └── example.adapter.js   # Custom overrides for "example" tenant
│   │
│   ├── orchestrator/            # STEP 5: Tools Dispatcher
│   │   └── tools.js             # runAction() coordinator
│   │
│   └── loaders/
│       ├── tenantLoader.js      # STEP 3: Load tenant config
│       └── registryLoader.js    # STEP 4: Load action registry
│
├── STEP_4_COMPLETE.md           # Action Registry documentation
├── STEP_5_COMPLETE.md           # Orchestrator documentation
└── ARCHITECTURE_STEP5.md        # Detailed architecture guide
```

## 🔌 API Endpoints

### POST /chat

Primary endpoint for chat interactions with action execution.

**Request:**
```json
{
  "tenant": "example",
  "message": "Add laptop to my cart",
  "action": "add_to_cart",
  "params": {
    "productId": "laptop-123",
    "quantity": 1
  }
}
```

**Response:**
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
    "handler": "commerce.addToCart",
    "cartId": "cart-abc123",
    "items": [
      {
        "productId": "laptop-123",
        "name": "Laptop",
        "quantity": 1,
        "price": 999.99
      }
    ],
    "total": 999.99,
    "_meta": {
      "action": "add_to_cart",
      "handler": "commerce.addToCart",
      "adapterSource": "generic",
      "executionTime": 105,
      "timestamp": "2025-11-25T10:30:45.123Z"
    }
  },
  "echo": {
    "message": "Add laptop to my cart",
    "action": "add_to_cart",
    "params": { ... }
  }
}
```

## 🎯 Key Features

### 1. Multi-Tenant Architecture

Each tenant has:
- **Custom Configuration** (`/src/config/{tenant}.config.json`)
- **Custom Action Registry** (`/src/registry/{tenant}.registry.json`)
- **Optional Custom Adapters** (`/src/tenants/{tenant}.adapter.js`)

### 2. Intelligent Adapter Resolution

The orchestrator uses a smart fallback system:

```
1. Try tenant-specific adapter (/tenants/example.adapter.js)
   └─ Check if specific function exists
   
2. If not found, fallback to generic adapter (/adapters/commerceAdapter.js)
   └─ All tenants have access to base functionality
```

**Example:** "example" tenant has custom `checkout()` with 10% discount, but uses generic `addToCart()`

### 3. Action Registry System

Each tenant defines available actions:

```json
{
  "search_products": {
    "enabled": true,
    "handler": "commerce.search",
    "description": "Search for products",
    "requiredParams": ["query"]
  },
  "add_to_cart": {
    "enabled": true,
    "handler": "commerce.addToCart",
    "requiredParams": ["productId", "quantity"]
  }
}
```

### 4. Metadata Tracking

Every action result includes execution metadata:

```json
{
  "_meta": {
    "action": "search_products",
    "handler": "commerce.search",
    "adapterSource": "tenant-specific",
    "executionTime": 105,
    "timestamp": "2025-11-25T10:30:45.123Z"
  }
}
```

### 5. Comprehensive Error Handling

5 error types with specific HTTP status codes:

- **ActionNotFoundError** (404): Action not in registry
- **ActionDisabledError** (403): Action exists but disabled
- **InvalidHandlerError** (500): Invalid handler format
- **AdapterNotFoundError** (500): No adapter file for namespace
- **FunctionNotFoundError** (500): Function not found in adapters

## 🧪 Testing

### Test Suite

```bash
# Test 1: Chat without action (backward compatibility)
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"client1","message":"hello"}' | jq

# Test 2: Generic adapter usage
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"client1","message":"search","action":"search_products","params":{"query":"laptop"}}' | jq

# Test 3: Tenant-specific override
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"search","action":"search_products","params":{"query":"laptop"}}' | jq

# Test 4: Fallback to generic
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"add","action":"add_to_cart","params":{"productId":"laptop-123","quantity":1}}' | jq

# Test 5: Tenant override with discount
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"checkout","action":"checkout","params":{"cartId":"cart-123"}}' | jq

# Test 6: Disabled action
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"client1","message":"recommend","action":"recommend_products","params":{"userId":"user-123"}}' | jq

# Test 7: Invalid action
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"invalid","action":"invalid_action","params":{}}' | jq
```

**Expected Results:** 7/7 tests passing ✅

See [STEP_5_COMPLETE.md](./STEP_5_COMPLETE.md) for detailed test results.

## 🛠️ Available Actions

### Commerce Actions

| Action | Handler | Description | Required Params |
|--------|---------|-------------|-----------------|
| search_products | commerce.search | Search product catalog | query |
| add_to_cart | commerce.addToCart | Add item to cart | productId, quantity |
| checkout | commerce.checkout | Complete purchase | cartId |
| recommend_products | commerce.recommend | Get recommendations | userId |

### Settings Actions

| Action | Handler | Description | Required Params |
|--------|---------|-------------|-----------------|
| get_preferences | settings.getPreferences | Get user preferences | userId |
| update_preferences | settings.updatePreferences | Update preferences | userId, preferences |
| get_account_settings | settings.getAccountSettings | Get account settings | accountId |

### Support Actions

| Action | Handler | Description | Required Params |
|--------|---------|-------------|-----------------|
| create_ticket | support.createTicket | Create support ticket | subject, description |
| get_ticket_status | support.getTicketStatus | Check ticket status | ticketId |
| search_knowledge_base | support.searchKnowledgeBase | Search KB articles | query |

## 🔧 Configuration

### Tenant Configuration Example

`/src/config/example.config.json`:

```json
{
  "tenantId": "example",
  "displayName": "Example Corp",
  "apiGateway": "https://api.example.com",
  "features": {
    "aiEnabled": true,
    "maxTokens": 2000,
    "model": "gpt-4"
  },
  "customSettings": {
    "theme": "dark",
    "language": "en"
  }
}
```

### Action Registry Example

`/src/registry/example.registry.json`:

```json
{
  "search_products": {
    "enabled": true,
    "handler": "commerce.search",
    "description": "Search for products in the catalog",
    "requiredParams": ["query"],
    "optionalParams": ["filters", "limit"]
  }
}
```

## 📚 Documentation

- **[STEP_4_COMPLETE.md](./STEP_4_COMPLETE.md)** - Action Registry System
- **[STEP_5_COMPLETE.md](./STEP_5_COMPLETE.md)** - Orchestrator & Adapters
- **[ARCHITECTURE_STEP5.md](./ARCHITECTURE_STEP5.md)** - Detailed Architecture Guide

## 🔜 Roadmap

### STEP 6: Memory/Conversation History
- Session management
- Conversation context storage
- Context window management for LLM integration

### STEP 7: LLM Integration
- OpenAI/Anthropic adapter
- Intent detection (natural language → action mapping)
- Per-tenant model selection

### STEP 8: Real Adapter Implementations
- Replace mock functions with real API calls
- Shopify, WooCommerce integrations
- Real payment processing
- Zendesk, Freshdesk support integrations

## 🧰 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 5.1.0
- **Module System**: CommonJS
- **Dependencies**: body-parser

## 🤝 Contributing

When adding new features:

1. Follow the modular structure
2. Add comprehensive error handling
3. Include metadata in responses
4. Update relevant documentation
5. Test with multiple tenants
6. Consider fallback scenarios

## 📄 License

MIT

---

**Version**: 2.0  
**Last Updated**: STEP 5 Complete  
**Status**: Production-Ready Orchestration ✅
