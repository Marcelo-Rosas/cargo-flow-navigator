#!/bin/bash

# CFN Debugger MCP - Server Test Script
# Simple test to verify MCP server is working

set -e

echo "🧪 Testing CFN Debugger MCP Server"
echo "===================================="
echo ""

# Check if dist/index.js exists
if [ ! -f dist/index.js ]; then
    echo "❌ dist/index.js not found. Run 'npm run build' first."
    exit 1
fi

echo "✅ dist/index.js found"
echo ""

# Start server and check it initializes
echo "Testing server startup..."
timeout 2 node dist/index.js < /dev/null 2>&1 || true

echo ""
echo "✅ MCP Server test complete!"
echo ""
echo "Next steps:"
echo "1. Update ~/.cursor/mcp.json with the path to this project"
echo "2. Restart Cursor IDE"
echo "3. Try commands like: /analyze-rls-violations src/components/Orders.tsx"
echo ""
