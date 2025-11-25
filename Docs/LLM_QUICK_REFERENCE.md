# Quick Reference: Multi-Provider LLM

## 🚀 Quick Start

### 1. Verify Installation
```bash
npm list | grep -E "(groq|gemini|mistral)"
```

Should show:
```
├── @google/generative-ai@0.21.0
├── @mistralai/mistralai@1.3.2
└── groq-sdk@0.8.0
```

### 2. Check Environment
```bash
cat .env | grep -E "(LLM|GROQ|GEMINI|MISTRAL)"
```

Should show:
```env
LLM_PRIORITY=GROQ,GEMINI,MISTRAL,MOCK
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
MISTRAL_API_KEY=IO1A...
```

### 3. Start Server
```bash
cd /home/sali/saai-platform/backend
node server.js
```

### 4. Test Provider
```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}' \
  | jq '.llm.provider'
```

Expected: `"GROQ"`

---

## 🔄 Common Operations

### Change Provider Priority

Edit `.env`:
```env
# Try GEMINI first, then GROQ
LLM_PRIORITY=GEMINI,GROQ,MISTRAL,MOCK

# Use only GROQ
LLM_PRIORITY=GROQ,MOCK

# Use only MOCK (testing)
LLM_PRIORITY=MOCK
```

Restart server:
```bash
pkill -f "node server.js"
node server.js
```

### Test Specific Provider

**Test GROQ**:
```bash
curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"find laptops"}' \
  | jq '.llm.provider'
```

**Check Response Time**:
```bash
time curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}'
```

**Check Token Usage**:
```bash
curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}' \
  | jq '.llm._meta.usage'
```

### Monitor Logs

**Follow server logs**:
```bash
tail -f /tmp/saai-server.log | grep llm
```

**Check provider attempts**:
```bash
tail -100 /tmp/saai-server.log | grep "Trying provider"
```

**Check successes/failures**:
```bash
tail -100 /tmp/saai-server.log | grep -E "(✓ Success|✗.*failed)"
```

---

## 🎯 Testing Checklist

- [ ] Tool calling works (search, add_to_cart, checkout)
- [ ] Conversational responses work
- [ ] Provider metadata included in response
- [ ] Token usage tracked
- [ ] Fallback works when provider fails
- [ ] Backward compatibility (direct actions)

### Quick Test Script

```bash
echo "Test 1: Tool call"
curl -s http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"search laptops"}' \
  | jq '{provider: .llm.provider, action: .llm.action}'

echo "Test 2: Conversation"
curl -s http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}' \
  | jq '{provider: .llm.provider, hasText: (.llm.text != null)}'

echo "Test 3: Backward compat"
curl -s http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","action":"search_products","params":{"query":"x"}}' \
  | jq '{replyType}'
```

---

## 🔧 Troubleshooting

### Provider Not Working

**Check API Key**:
```bash
echo $GROQ_API_KEY  # Should show key
```

**Check .env**:
```bash
cat .env | grep GROQ_API_KEY
```

**Check logs**:
```bash
tail -50 /tmp/saai-server.log | grep GROQ
```

### All Providers Failing

**Should fall back to MOCK**:
```bash
curl -s http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}' \
  | jq '.llm.provider'
```

Expected: `"MOCK"` (if all other providers failed)

### Response Format Issues

**Check full response**:
```bash
curl -s http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}' \
  | jq '.'
```

**Should contain**:
- `success: true`
- `replyType: "message" or "tool"`
- `llm.provider: "GROQ" or "GEMINI" or "MISTRAL" or "MOCK"`
- `llm._meta.model: "..."`
- `llm._meta.usage: {...}`

---

## 📊 Performance Benchmarks

| Operation | GROQ | GEMINI | MISTRAL | MOCK |
|-----------|------|--------|---------|------|
| Simple query | ~300ms | ~400ms | ~350ms | 50ms |
| Tool call | ~400ms | ~500ms | ~450ms | 50ms |
| Long response | ~600ms | ~700ms | ~650ms | 50ms |

*Actual times depend on network latency and API load*

---

## 🎓 Examples

### E-commerce Chat

```bash
# Search
curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"I need a laptop for gaming"}' \
  | jq '.llm.action'
# Expected: "search_products"

# Add to cart
curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"add it to my cart"}' \
  | jq '.llm.action'
# Expected: "add_to_cart"

# Checkout
curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"checkout now"}' \
  | jq '.llm.action'
# Expected: "checkout"
```

### Conversational

```bash
# General query
curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"What can you help me with?"}' \
  | jq '.llm.text'
# Expected: Conversational response about available services
```

---

## 📝 Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_PRIORITY` | No | `GROQ,GEMINI,MISTRAL,MOCK` | Provider fallback order |
| `GROQ_API_KEY` | For GROQ | - | Groq API key |
| `GEMINI_API_KEY` | For GEMINI | - | Google Gemini API key |
| `MISTRAL_API_KEY` | For MISTRAL | - | Mistral API key |

### Provider Models

| Provider | Model | Notes |
|----------|-------|-------|
| GROQ | `llama-3.3-70b-versatile` | Fast, 70B parameter model |
| GEMINI | `gemini-1.5-flash` | Fast, cost-effective |
| MISTRAL | `mistral-small-latest` | Balanced performance |
| MOCK | Pattern matching | Instant, no API |

---

## 🔗 Related Files

- **Implementation**: `/src/orchestrator/llm.js`
- **Controller**: `/src/orchestrator/controller.js`
- **Environment**: `/.env`
- **Dependencies**: `/package.json`
- **Documentation**: `/MULTI_PROVIDER_LLM_COMPLETE.md`
- **Original**: `/STEP_6_COMPLETE.md`

---

## ✅ Success Criteria

Your multi-provider LLM is working if:

1. ✅ Server starts without errors
2. ✅ Chat endpoint responds
3. ✅ `llm.provider` field shows active provider
4. ✅ Tool calling works (search, cart, checkout)
5. ✅ Conversational responses work
6. ✅ Token usage tracked in `_meta`
7. ✅ Fallback to MOCK when all fail
8. ✅ Backward compatibility with direct actions

---

**Quick Check Command**:
```bash
curl -s http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"tenant":"example","message":"hello"}' \
  | jq '{ok: .success, provider: .llm.provider, type: .replyType}'
```

Expected:
```json
{
  "ok": true,
  "provider": "GROQ",
  "type": "message"
}
```

✅ If you see this, your multi-provider LLM is working!
