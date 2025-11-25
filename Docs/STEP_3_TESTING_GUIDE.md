# STEP 3 Testing Guide

## Multi-Tenant UI Testing

This guide helps you verify that STEP 3 multi-tenant features are working correctly.

---

## Prerequisites

✅ Backend server running on port 3001  
✅ Frontend server running on port 3002  
✅ Both servers accessible via curl or browser

---

## Quick Test Checklist

### 1. Backend Tenant Endpoint ✅

Test that the backend returns tenant configurations:

```bash
# Test default tenant
curl http://localhost:3001/tenant/example | jq '.tenant.theme'

# Expected output:
{
  "primaryColor": "#4A90E2",
  "secondaryColor": "#FFFFFF",
  "headerTitle": "SAAI Assistant",
  "logoUrl": "/default-logo.png"
}
```

### 2. Frontend Loading ✅

Open browser and navigate to:
```
http://localhost:3002
```

**Expected behavior**:
1. Brief loading screen with pulsing dots
2. Text: "Loading SAAI Assistant..."
3. UI appears with blue header (tenant: example)
4. Header shows "SAAI Assistant"
5. Subtitle shows "Tenant: example"

### 3. Themed Messages ✅

**Send a message**: "Hello"

**Expected behavior**:
1. User message: Blue bubble (right side)
2. SAAI response: Blue bubble (left side, matching header)
3. Both messages visible and readable

### 4. Different Tenant Themes

To test different themes, you need to modify the code temporarily.

**Option A: Modify getCurrentTenant()**

Edit `/frontend/utils/tenant.ts`:

```typescript
export function getCurrentTenant(): string {
  // Force client1 theme (green)
  return 'client1';
  
  // Original code (comment out):
  // if (typeof window !== 'undefined') {
  //   return getTenantFromHostname(window.location.hostname);
  // }
  // return 'default';
}
```

**Refresh browser**:
- Header should be **green** (#10B981)
- Header title: "Client One AI Assistant"
- SAAI messages: Green bubbles

**Option B: Test client2 (purple)**

Change return value to `'client2'`:
- Header should be **purple** (#8B5CF6)
- Header title: "Client Two Support Bot"
- SAAI messages: Purple bubbles

---

## Visual Verification

### Example Tenant (Blue)
- [x] Header background: Blue (#4A90E2)
- [x] Header title: "SAAI Assistant"
- [x] Tenant label: "Tenant: example"
- [x] SAAI bubbles: Blue background, white text
- [x] User bubbles: Blue gradient, white text

### Client1 Tenant (Green)
- [ ] Header background: Green (#10B981)
- [ ] Header title: "Client One AI Assistant"
- [ ] Tenant label: "Tenant: client1"
- [ ] SAAI bubbles: Green background, white text
- [ ] User bubbles: Blue gradient, white text

### Client2 Tenant (Purple)
- [ ] Header background: Purple (#8B5CF6)
- [ ] Header title: "Client Two Support Bot"
- [ ] Tenant label: "Tenant: client2"
- [ ] SAAI bubbles: Purple background, white text
- [ ] User bubbles: Blue gradient, white text

---

## Functional Tests

### Test 1: Tenant Detection

**Browser Console**:
```javascript
// Check tenant detection functions
import { getTenantFromHostname } from '@/utils/tenant';

getTenantFromHostname('client1.saai.pro');  // Should return: "client1"
getTenantFromHostname('ui.saai.pro');       // Should return: "default"
getTenantFromHostname('localhost');         // Should return: "example"
```

**Expected**: All functions return correct tenant IDs

### Test 2: Theme Loading

**Browser Console**:
```javascript
// Check theme loading
import { loadTenantTheme } from '@/config/tenant';

const result = await loadTenantTheme('client1');
console.log(result.theme);
// Should show green theme: { primaryColor: "#10B981", ... }
```

**Expected**: Theme object with correct colors

### Test 3: Fallback Behavior

**Stop backend server**:
```bash
pkill -f "node server.js"
```

**Refresh browser**:
- Should show loading screen briefly
- Should load with **default blue theme**
- Console should show error: "Error loading tenant theme"
- UI should be functional despite backend error

**Expected**: Graceful fallback to default theme

### Test 4: Unknown Tenant

**Test backend with unknown tenant**:
```bash
curl http://localhost:3001/tenant/nonexistent | jq '.tenant'
```

**Expected output**:
```json
{
  "id": "default",
  "name": "SAAI Platform",
  "theme": {
    "primaryColor": "#4A90E2",
    ...
  }
}
```

**Expected**: Returns default configuration

---

## Integration Tests

### Test 5: End-to-End Conversation

**With client1 theme active**:

1. Type: "Search for laptops"
2. Observe: User message (blue), SAAI response (green)
3. Verify: Green matches header color
4. Type: "Add laptop to cart"
5. Observe: Tool execution message in green bubble
6. Type: "Hello"
7. Observe: Normal conversation in green bubble

**Expected**: All SAAI messages use tenant's primary color

### Test 6: Loading States

1. Send message: "Tell me a story"
2. Observe loading indicator (3 dots)
3. Verify dots are **white** on colored bubble (green/purple)
4. Verify dots are **gray** on default theme

**Expected**: Loading dots adapt to bubble color

---

## Network Verification

### Check API Calls

**Open Browser DevTools > Network tab**

**Refresh page**:
1. Look for: `GET /tenant/example`
2. Status: `200 OK`
3. Response: Contains theme object
4. Timing: < 100ms

**Send message**:
1. Look for: `POST /chat`
2. Request body: `{ tenant: "example", message: "..." }`
3. Status: `200 OK`
4. Response: Contains LLM response

**Expected**: Correct tenant ID sent to backend

---

## Error Scenarios

### Scenario 1: Backend Down
- [x] UI loads with default theme
- [x] Error logged in console
- [x] No crash or blank screen

### Scenario 2: Invalid Response
- [x] Theme validation fills missing fields
- [x] UI renders with defaults
- [x] No TypeScript errors

### Scenario 3: Network Timeout
- [x] Promise rejects gracefully
- [x] Fallback theme applied
- [x] User can still chat

---

## Performance Checks

### Initial Load Time
- Theme load: < 200ms
- First paint: < 1s
- Interactive: < 2s

### Memory Usage
- No memory leaks
- Theme object cached
- No unnecessary re-renders

---

## Browser Console Checks

**Open DevTools > Console**

**Should NOT see**:
- ❌ TypeScript errors
- ❌ React warnings
- ❌ Network errors (except when testing failures)
- ❌ Unhandled promise rejections

**Should see**:
- ✅ "Response from: GROQ" (on messages)
- ✅ Theme loaded successfully (no errors)

---

## Troubleshooting

### Issue: White screen on load
**Solution**: Check backend is running, check console for errors

### Issue: Theme not applying
**Solution**: Clear browser cache, verify tenant endpoint returns data

### Issue: Wrong tenant detected
**Solution**: Check hostname, verify `getCurrentTenant()` logic

### Issue: SAAI bubbles not themed
**Solution**: Verify `theme` prop passed to MessageBubble

### Issue: Header shows wrong color
**Solution**: Check inline style in ChatLayout, verify theme.primaryColor

---

## Rollback to Previous Step

If STEP 3 has issues, you can revert:

```bash
# Restore STEP 2 version of page.tsx
git checkout HEAD~1 frontend/app/page.tsx
git checkout HEAD~1 frontend/components/ChatLayout.tsx
git checkout HEAD~1 frontend/components/MessageBubble.tsx

# Remove new files
rm frontend/utils/tenant.ts
rm frontend/config/tenant.ts

# Restart servers
```

---

## Success Criteria

All tests pass when:
- ✅ Tenant detected correctly
- ✅ Theme loaded from backend
- ✅ Header uses theme color
- ✅ SAAI messages use theme color
- ✅ User messages stay blue
- ✅ Fallback works on errors
- ✅ No console errors
- ✅ Smooth loading experience

---

## Next Steps After Testing

If all tests pass:
- Document any custom tenants added
- Deploy to production
- Set up DNS for subdomain routing
- Configure SSL for tenant domains
- Monitor tenant usage and performance

**Testing Complete!** 🎉
