#!/bin/bash

# Test script for RECO STEP 6 - Outfit Rendering

echo "========================================="
echo "RECO STEP 6 - Testing Outfit Rendering"
echo "========================================="
echo ""

# Test 1: Backend outfit recommendation
echo "TEST 1: Backend /chat endpoint returns outfit type"
echo "-------------------------------------------------"
RESPONSE=$(curl -s -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"dress me for eid","tenant":"client1"}')

REPLY_TYPE=$(echo "$RESPONSE" | jq -r '.replyType')
ACTION=$(echo "$RESPONSE" | jq -r '.llm.action')
RESULT_TYPE=$(echo "$RESPONSE" | jq -r '.actionResult.type')
ITEM_KEYS=$(echo "$RESPONSE" | jq -r '.actionResult.items | keys | join(", ")')

echo "Reply Type: $REPLY_TYPE"
echo "Action: $ACTION"
echo "Result Type: $RESULT_TYPE"
echo "Item Keys: $ITEM_KEYS"

if [ "$RESULT_TYPE" = "outfit" ]; then
  echo "✅ Backend returns outfit type correctly"
else
  echo "❌ Backend does NOT return outfit type (got: $RESULT_TYPE)"
fi

echo ""

# Test 2: Check item structure
echo "TEST 2: Outfit items structure"
echo "-------------------------------"
SHIRT_NAME=$(echo "$RESPONSE" | jq -r '.actionResult.items.shirt.name // "N/A"')
PANT_NAME=$(echo "$RESPONSE" | jq -r '.actionResult.items.pant.name // "N/A"')
SHOE_NAME=$(echo "$RESPONSE" | jq -r '.actionResult.items.shoe.name // "N/A"')

echo "Shirt: $SHIRT_NAME"
echo "Pant: $PANT_NAME"
echo "Shoe: $SHOE_NAME"

if [ "$SHIRT_NAME" != "N/A" ] && [ "$PANT_NAME" != "N/A" ] && [ "$SHOE_NAME" != "N/A" ]; then
  echo "✅ All 3 outfit items present"
else
  echo "⚠️  Some outfit items missing"
fi

echo ""

# Test 3: Frontend components exist
echo "TEST 3: Frontend components exist"
echo "----------------------------------"
if [ -f "/home/sali/saai-platform/frontend/components/OutfitBubble.tsx" ]; then
  echo "✅ OutfitBubble.tsx exists"
else
  echo "❌ OutfitBubble.tsx NOT found"
fi

if grep -q "type: 'outfit'" /home/sali/saai-platform/frontend/components/MessageBubble.tsx 2>/dev/null; then
  echo "✅ MessageBubble.tsx supports outfit type"
else
  echo "❌ MessageBubble.tsx does NOT support outfit type"
fi

if grep -q "handleAddMultipleToCart" /home/sali/saai-platform/frontend/app/page.tsx 2>/dev/null; then
  echo "✅ page.tsx has handleAddMultipleToCart handler"
else
  echo "❌ page.tsx missing handleAddMultipleToCart handler"
fi

echo ""
echo "========================================="
echo "RECO STEP 6 - Testing Complete"
echo "========================================="
echo ""
echo "To test in browser:"
echo "1. Open http://localhost:3002 (or your frontend URL)"
echo "2. Type: 'dress me for eid'"
echo "3. Verify: OutfitBubble renders with 3 ProductCards"
echo "4. Verify: 'Add Full Outfit to Cart' button appears"
echo ""
