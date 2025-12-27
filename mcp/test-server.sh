#!/bin/bash

# MCP Test Server - Quick test script

BASE_URL="http://localhost:3030"

echo "🧪 Testing MCP Server"
echo "===================="
echo

# Test 1: Server info
echo "1️⃣  GET / (Server Info)"
curl -s $BASE_URL | python3 -m json.tool
echo
echo

# Test 2: Health check
echo "2️⃣  GET /health (Health Check)"
curl -s $BASE_URL/health | python3 -m json.tool
echo
echo

# Test 3: List tools
echo "3️⃣  POST / tools/list (List Available Tools)"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }' | python3 -m json.tool
echo
echo

# Test 4: Call tool (summary format)
echo "4️⃣  POST / tools/call (Scott's Physics Facts - Summary)"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "scottPhysicsFacts",
      "arguments": {
        "format": "summary"
      }
    }
  }' | python3 -c "import sys, json; result = json.load(sys.stdin); print(result['result']['result'])"
echo
echo

echo "✅ All tests completed!"

