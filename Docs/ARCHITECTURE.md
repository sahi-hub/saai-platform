# SAAI Backend Architecture - Step 2

## Request Flow Diagram

```
Client Request
     │
     ├─→ GET /
     │       │
     │       └─→ server.js (health check) → { status: "ok", service: "SAAI backend" }
     │
     └─→ POST /chat
             │
             └─→ server.js
                     │
                     └─→ apiRoutes (src/api/routes.js)
                             │
                             └─→ router.post('/chat', handleChat)
                                     │
                                     └─→ handleChat (src/api/chat.controller.js)
                                             │
                                             ├─→ Extract { message, tenant } from req.body
                                             │
                                             ├─→ [Future: Load tenant config]
                                             ├─→ [Future: Initialize orchestrator]
                                             ├─→ [Future: Process with LLM]
                                             │
                                             └─→ Response
                                                     │
                                                     ├─→ Success: { success: true, echo: { tenant, message } }
                                                     └─→ Error: { success: false, error, message }
```

## File Structure & Responsibilities

```
backend/
│
├── server.js                           # Express app setup & configuration
│   ├── Environment config (dotenv)
│   ├── Middleware (CORS, JSON parsing)
│   ├── Health check route (GET /)
│   ├── API routes mounting (app.use)
│   └── Server startup & graceful shutdown
│
├── src/
│   └── api/
│       │
│       ├── routes.js                   # Route definitions
│       │   ├── Express Router setup
│       │   ├── POST /chat → handleChat
│       │   └── [Future: Additional routes]
│       │
│       └── chat.controller.js          # Business logic
│           ├── handleChat function
│           ├── Request validation
│           ├── Error handling
│           └── [Future: Tenant, Orchestrator, Memory, Adapters]
│
├── .env                                # Environment variables
├── package.json                        # Dependencies & scripts
└── README.md                           # Documentation
```

## Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                               │
│                    (client1.saai.pro)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /chat
                         │ { message, tenant: "client1" }
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    server.js (Port 3001)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Middleware Stack                                      │  │
│  │  • CORS                                               │  │
│  │  • express.json()                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              src/api/routes.js (Router)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ POST /chat → handleChat                               │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         src/api/chat.controller.js (Controller)             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ handleChat(req, res)                                  │  │
│  │  1. Extract message & tenant                          │  │
│  │  2. [Future: Load tenant config]                      │  │
│  │  3. [Future: Orchestrate LLM call]                    │  │
│  │  4. Return response                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                    Response
        { success: true, echo: { ... } }
```

## Future Architecture (Step 3+)

```
chat.controller.js
     │
     ├─→ Tenant Loader
     │       │
     │       └─→ Load config for "client1"
     │               ├─→ LLM provider (OpenAI/Anthropic/etc)
     │               ├─→ Model settings
     │               ├─→ System prompts
     │               └─→ Rate limits
     │
     ├─→ Orchestrator
     │       │
     │       ├─→ Validate tenant
     │       ├─→ Load conversation history
     │       ├─→ Build prompt
     │       ├─→ Call LLM adapter
     │       └─→ Store response
     │
     ├─→ Memory Manager
     │       │
     │       ├─→ Retrieve chat history
     │       ├─→ Store new messages
     │       └─→ Manage context window
     │
     └─→ LLM Adapters
             │
             ├─→ OpenAI Adapter
             ├─→ Anthropic Adapter
             ├─→ Azure OpenAI Adapter
             └─→ Local Model Adapter
```

## Key Design Decisions

1. **CommonJS over ES Modules**: Consistent with existing Node.js ecosystem
2. **Async/Await**: Modern async handling in controllers
3. **Structured Responses**: Standardized `{ success, echo/error }` format
4. **Separation of Concerns**: Routes → Controllers → Business Logic
5. **Future-Proof**: TODO comments mark integration points for upcoming features
6. **Error Handling**: Try/catch with proper error responses
7. **Scalability**: Easy to add new routes and controllers

## API Contract

### Request
```typescript
POST /chat
Content-Type: application/json

{
  message: string,   // User's message
  tenant: string     // Tenant identifier (e.g., "client1")
}
```

### Response (Success)
```typescript
{
  success: true,
  echo: {
    tenant: string,
    message: string
  }
}
```

### Response (Error)
```typescript
{
  success: false,
  error: string,
  message: string
}
```

---

**Next**: Implement tenant configuration loader and orchestrator
