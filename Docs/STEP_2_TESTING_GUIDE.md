# SAAI UI - STEP 2 Quick Test Guide

## Access the Application

**Frontend (UI)**: http://localhost:3002  
**Backend (API)**: http://localhost:3001

## Quick Start Testing

### 1. Open the UI
```bash
open http://localhost:3002
# Or visit in your browser
```

### 2. You should see:
- ✅ Header: "SAAI Assistant for Demo Store"
- ✅ Welcome message from SAAI about being connected to backend
- ✅ Input field at bottom
- ✅ Send button

### 3. Test Message Response
**Type:** `Hello, how are you?`  
**Expected:** 
- Your message appears on right (blue bubble)
- Loading dots appear briefly
- SAAI responds with conversational text
- Response from GROQ provider

### 4. Test Search Tool
**Type:** `Search for laptops`  
**Expected:**
- Message: `🔍 Searching for products: "laptops"...`
- Tool execution confirmed
- Action handler executed

### 5. Test Add to Cart Tool
**Type:** `Add laptop to my cart`  
**Expected:**
- Message: `🛒 Adding product to cart...`
- Cart action executed

### 6. Test Checkout Tool
**Type:** `I want to checkout`  
**Expected:**
- Message: `✅ Processing checkout with 10% discount!`
- Example tenant gets 10% discount

### 7. Test Support Ticket
**Type:** `I need help with my order`  
**Expected:**
- Message: `🎫 Support ticket created! Ticket ID: ...`
- Ticket ID generated

### 8. Test Loading States
**Observe:**
- Input field becomes disabled while sending
- Send button grays out
- Pulsing dots appear
- Input re-enables after response

### 9. Test Error Handling
**Steps:**
1. Stop backend: `pkill -f "node server.js"`
2. Type any message in UI
3. Expected: `⚠️ Connection error. Please check if the backend server is running and try again.`
4. Restart backend: `cd backend && node server.js &`

### 10. Test Auto-Scroll
**Steps:**
1. Send multiple messages quickly
2. Expected: Chat automatically scrolls to show latest message

## Visual Verification Checklist

- [ ] Header shows "SAAI Assistant"
- [ ] Tenant name displays "for Demo Store"
- [ ] AI icon visible in header
- [ ] User messages on right (blue)
- [ ] SAAI messages on left (white)
- [ ] Timestamps visible
- [ ] Input field has placeholder
- [ ] Send button has paper plane icon
- [ ] Loading dots animate during API call
- [ ] Error messages display clearly
- [ ] Auto-scroll works smoothly
- [ ] Mobile responsive (resize browser)

## Backend Integration Verification

### Check Network Tab (Browser DevTools)
1. Open DevTools (F12)
2. Go to Network tab
3. Send a message
4. Look for POST to `/chat`
5. Verify:
   - Status: 200 OK
   - Request payload has `tenant` and `message`
   - Response has `success`, `replyType`, `llm` fields

### Check Console (Browser DevTools)
1. Open Console tab
2. Send a message
3. Look for: `Response from: GROQ { model: '...', usage: {...} }`
4. No errors should appear (except when testing error handling)

### Backend Logs
```bash
tail -f /tmp/saai-server.log | grep -E "(llm|provider|GROQ)"
```

Should show:
- Provider priority: GROQ → GEMINI → MISTRAL → MOCK
- Trying provider: GROQ
- ✓ Success with GROQ
- Tool selected: [action_name]

## API Response Examples

### Message Response
```json
{
  "success": true,
  "replyType": "message",
  "llm": {
    "type": "message",
    "text": "Hello! How can I help you today?",
    "provider": "GROQ",
    "_meta": {
      "model": "llama-3.3-70b-versatile",
      "usage": {
        "total_tokens": 471,
        "prompt_tokens": 427,
        "completion_tokens": 44
      }
    }
  }
}
```

### Tool Response
```json
{
  "success": true,
  "replyType": "tool",
  "llm": {
    "type": "tool",
    "action": "search_products",
    "params": {
      "query": "laptops"
    },
    "provider": "GROQ"
  },
  "actionResult": {
    "handler": "search_products",
    "products": [...]
  }
}
```

## Troubleshooting

### Frontend not loading
```bash
# Check if running
curl http://localhost:3002

# Restart
cd /home/sali/saai-platform/frontend
npm run dev
```

### Backend not responding
```bash
# Check if running
curl http://localhost:3001/chat -X POST -H "Content-Type: application/json" -d '{"tenant":"example","message":"test"}'

# Restart
cd /home/sali/saai-platform/backend
node server.js
```

### Connection errors in UI
1. Verify backend is running on port 3001
2. Check `.env.local` has correct API_URL
3. Restart frontend after env changes
4. Check browser console for CORS errors

### Messages not appearing
1. Open browser console
2. Look for JavaScript errors
3. Verify API response format
4. Check network tab for failed requests

## Expected Behavior Summary

| Action | Expected Result |
|--------|----------------|
| Type message | Input accepts text |
| Click Send | Message appears, input disabled |
| During API call | Loading dots visible, input grayed |
| After response | SAAI message appears, input enabled |
| Conversational | Shows LLM text response |
| Tool execution | Shows formatted action message |
| Network error | Shows error message, input enabled |
| Auto-scroll | Always shows latest message |

## Performance Expectations

- **User message appears**: Instantly (< 50ms)
- **Loading indicator**: Immediately after send
- **API response time**: 500-2000ms (depends on LLM)
- **UI responsiveness**: No freezing, always interactive
- **Auto-scroll**: Smooth animation

## Success Indicators ✅

If all these work, STEP 2 is successful:

1. ✅ Can send messages
2. ✅ Receives real AI responses
3. ✅ Tool executions formatted nicely
4. ✅ Loading states work
5. ✅ Error handling graceful
6. ✅ Auto-scroll smooth
7. ✅ No console errors
8. ✅ Backend logs show GROQ provider
9. ✅ Network tab shows successful API calls
10. ✅ Mobile responsive

---

**Status**: Ready for testing  
**Last Updated**: 25 November 2025  
**Next**: Test all scenarios above
