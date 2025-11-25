# SAAI Backend Architecture - STEP 4: Action Registry System

## System Overview

The SAAI backend now includes a complete multi-tenant configuration system with:

1. **Tenant Configuration System** (STEP 3)
2. **Action Registry System** (STEP 4) ← Current Focus

This document focuses on the Action Registry System architecture.

## Action Registry System Design

### Purpose

The Action Registry System enables **per-tenant customization of available actions and tools** while maintaining a consistent fallback mechanism for new or unconfigured tenants.

### Key Concepts

- **Action**: A discrete capability/tool available to the AI agent (e.g., search_products, checkout)
- **Registry**: A JSON configuration file defining which actions are available and enabled
- **Tenant-Specific Registry**: Custom action configuration for a specific tenant
- **Default Registry**: Fallback configuration used when tenant-specific registry doesn't exist
- **Metadata**: Runtime information about which registry was loaded

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Chat Request Flow                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. POST /chat { tenant: "example", message: "..." }        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. chat.controller.handleChat()                            │
│     - Validate input                                        │
│     - Load tenant config (STEP 3)                           │
│     - Load action registry (STEP 4) ← NEW                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. registryLoader.loadActionRegistry(tenant)               │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌───────────────────────┐   ┌──────────────────────┐
│ Try: tenant-specific  │   │ Fallback: default    │
│ example.registry.json │   │ default.registry.json│
└───────────────────────┘   └──────────────────────┘
                │                       │
                └───────────┬───────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Return registry with _meta field                        │
│     {                                                       │
│       "tenantId": "example",                                │
│       "actions": { ... },                                   │
│       "_meta": {                                            │
│         "loadedFrom": "tenant-specific" | "default",        │
│         "requestedTenant": "example",                       │
│         "actualTenant": "example" | "default"               │
│       }                                                     │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
backend/
├── src/
│   ├── api/
│   │   └── chat.controller.js      # Orchestrates config + registry loading
│   ├── utils/
│   │   ├── tenantLoader.js         # Loads tenant configs
│   │   └── registryLoader.js       # Loads action registries ← NEW
│   ├── config/
│   │   └── tenants/
│   │       ├── example.json        # Tenant configs
│   │       └── client1.json
│   └── registry/                   # ← NEW
│       ├── default.registry.json   # Fallback for all tenants
│       └── example.registry.json   # Tenant-specific registries
```

## Registry Loader Implementation

### Core Function: `loadActionRegistry(tenantId)`

```javascript
async function loadActionRegistry(tenantId) {
  // 1. Sanitize tenant ID
  const sanitizedTenant = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
  
  // 2. Try tenant-specific registry
  const tenantRegistryPath = path.join(__dirname, '..', 'registry', `${sanitizedTenant}.registry.json`);
  
  if (await fileExists(tenantRegistryPath)) {
    // Load tenant-specific
    return loadAndValidateRegistry(tenantRegistryPath, sanitizedTenant, 'tenant-specific');
  }
  
  // 3. Fallback to default
  const defaultPath = path.join(__dirname, '..', 'registry', 'default.registry.json');
  return loadAndValidateRegistry(defaultPath, 'default', 'default');
}
```

### Loading Strategy

1. **Sanitize Input**: Remove unsafe characters from tenant ID
2. **Try Tenant-Specific**: Look for `{tenant}.registry.json`
3. **Fallback to Default**: Use `default.registry.json` if specific not found
4. **Add Metadata**: Include `_meta` field with loading information

### Error Handling

| Error | When | HTTP Status | Response |
|-------|------|-------------|----------|
| `RegistryNotFoundError` | Default registry missing | 500 | "Default action registry not found" |
| `InvalidRegistryError` | Registry malformed | 500 | "Action registry is invalid" |

## Registry JSON Structure

### Schema

```json
{
  "tenantId": "string (required)",
  "actions": {
    "action_name": {
      "enabled": "boolean (required)",
      "description": "string (required)",
      "handler": "string (required)"
    }
  }
}
```

### Example: Default Registry

```json
{
  "tenantId": "default",
  "actions": {
    "search_products": {
      "enabled": true,
      "description": "Search products by query text",
      "handler": "commerce.search"
    },
    "add_to_cart": {
      "enabled": true,
      "description": "Add a product to cart",
      "handler": "commerce.addToCart"
    },
    "checkout": {
      "enabled": false,
      "description": "Create an order from cart",
      "handler": "commerce.checkout"
    }
  }
}
```

### Example: Tenant-Specific Registry

```json
{
  "tenantId": "enterprise-client",
  "actions": {
    "search_products": {
      "enabled": true,
      "description": "Search products with enterprise pricing",
      "handler": "commerce.enterpriseSearch"
    },
    "bulk_order": {
      "enabled": true,
      "description": "Place bulk orders with volume discount",
      "handler": "commerce.bulkOrder"
    },
    "export_invoice": {
      "enabled": true,
      "description": "Export invoice to accounting system",
      "handler": "accounting.exportInvoice"
    }
  }
}
```

## Response Metadata

The `_meta` field provides runtime information about registry loading:

```json
{
  "_meta": {
    "loadedFrom": "tenant-specific",  // or "default"
    "requestedTenant": "client1",      // What was requested
    "actualTenant": "client1"          // What was actually loaded
  }
}
```

This helps with:
- **Debugging**: Know which registry was used
- **Monitoring**: Track fallback usage
- **Client-side logic**: Detect when default is used

## Integration with Chat Controller

### Updated Flow

```javascript
async function handleChat(req, res) {
  const { message, tenant } = req.body;
  
  // Validate input
  // ...
  
  // Load tenant config (STEP 3)
  const tenantConfig = await loadTenantConfig(tenant);
  
  // Load action registry (STEP 4)
  const actionRegistry = await loadActionRegistry(tenant);
  
  // Future: Initialize orchestrator
  // const orchestrator = new Orchestrator(tenantConfig, actionRegistry);
  
  // Return both
  res.json({
    success: true,
    tenantConfig,
    actionRegistry,  // ← NEW
    echo: { tenant, message }
  });
}
```

## Security Considerations

### Input Sanitization

```javascript
// Remove unsafe characters
const sanitizedTenant = tenantId.replace(/[^a-zA-Z0-9-_]/g, '');
```

**Prevents**:
- Directory traversal: `../../../etc/passwd`
- Path injection: `tenant/../default`
- Special characters: `tenant@#$%`

### File System Safety

```javascript
// Construct path safely
const registryPath = path.join(
  __dirname,
  '..',
  'registry',
  `${sanitizedTenant}.registry.json`
);
```

**Ensures**:
- All registry files in `/registry` directory
- No access to files outside registry directory
- Consistent path construction

## Design Decisions

### Why Separate Config and Registry?

| Tenant Config | Action Registry |
|---------------|-----------------|
| Display branding | Available actions |
| API endpoints | Tool configurations |
| Feature flags | Handler mappings |
| UI customization | Agent capabilities |

**Benefits**:
- Clear separation of concerns
- Independent evolution
- Different update cycles

### Why Fallback to Default?

**Without Fallback**:
- New tenants fail immediately
- Requires registry setup before onboarding
- Service disruption if file missing

**With Fallback**:
- New tenants work immediately
- Gradual customization possible
- Graceful degradation

### Why Metadata Field?

**Use Cases**:
1. **Debugging**: "Why is this action not available?"
   - Check `_meta.loadedFrom` to see if default was used
   
2. **Monitoring**: "How many tenants use custom registries?"
   - Track `loadedFrom: "default"` vs `loadedFrom: "tenant-specific"`
   
3. **Client Notifications**: "You're using default actions"
   - Display banner encouraging customization

## Testing Coverage

### Test Cases

1. ✅ **Tenant with custom registry** → Loads tenant-specific
2. ✅ **Tenant without custom registry** → Falls back to default
3. ⏳ **Invalid registry JSON** → Returns InvalidRegistryError
4. ⏳ **Missing actions object** → Returns InvalidRegistryError
5. ⏳ **Default registry missing** → Returns RegistryNotFoundError

## Performance Considerations

### Current Implementation
- Reads file from disk on every request
- Parses JSON synchronously

### Future Optimizations
1. **In-Memory Cache**: Cache parsed registries
2. **File Watching**: Reload on file change
3. **Lazy Loading**: Load only when needed
4. **Preloading**: Load common registries at startup

## Future Enhancements

### Dynamic Registry Management
```javascript
// POST /admin/registry/{tenant}
async function updateRegistry(tenantId, newRegistry) {
  // Validate registry
  // Write to file
  // Invalidate cache
  // Notify running instances
}
```

### Registry Versioning
```json
{
  "version": "2.0.0",
  "tenantId": "example",
  "actions": { ... }
}
```

### Action Dependencies
```json
{
  "checkout": {
    "enabled": true,
    "requires": ["add_to_cart"],  // Dependencies
    "handler": "commerce.checkout"
  }
}
```

### Permission-Based Actions
```json
{
  "admin_panel": {
    "enabled": true,
    "permissions": ["admin"],  // Required roles
    "handler": "admin.panel"
  }
}
```

## Next Steps

With STEP 4 complete, the foundation is ready for:

1. **STEP 5: Orchestrator**
   - Use tenantConfig + actionRegistry together
   - Route to appropriate handlers
   - Coordinate multi-step flows

2. **STEP 6: Memory System**
   - Store conversation history per tenant
   - Context management
   - Session handling

3. **STEP 7: LLM Adapters**
   - OpenAI integration
   - Anthropic integration
   - Per-tenant model selection

4. **STEP 8: Handler Implementation**
   - Implement `commerce.search`
   - Implement `commerce.addToCart`
   - Implement `commerce.checkout`

---

**Architecture Version**: 1.0  
**Last Updated**: STEP 4 Completion  
**Status**: Production-Ready Foundation ✅
