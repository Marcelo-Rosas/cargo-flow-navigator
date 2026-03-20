#!/bin/bash

# CFN Debugger MCP - Installation Script

set -e  # Exit on error

echo "🚀 CFN Debugger MCP Installation"
echo "=================================="

# Step 1: Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Step 2: Install dependencies
echo ""
echo "📦 Installing dependencies..."
rm -rf node_modules package-lock.json
npm install --force

# Step 3: Type check
echo ""
echo "🔍 Type checking..."
npm run type-check

# Step 4: Build
echo ""
echo "🏗️  Building MCP server..."
npm run build

# Step 5: Verify build
if [ -f dist/index.js ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed - dist/index.js not found"
    exit 1
fi

# Step 6: Cursor integration
echo ""
echo "🔌 Cursor Integration"
echo "===================="
echo ""
echo "Update ~/.cursor/mcp.json with:"
echo ""
echo '{
  "mcpServers": {
    "cfn-debugger": {
      "command": "node",
      "args": ["'$(pwd)'/dist/index.js"]
    }
  }
}'
echo ""
echo "Then restart Cursor!"
echo ""

# Step 7: Test
echo "🧪 Testing server..."
echo "node dist/index.js < /dev/null &"
sleep 2

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Update ~/.cursor/mcp.json with the config above"
echo "2. Restart Cursor"
echo "3. Try: /analyze-rls-violations src/components/Orders.tsx"
echo ""
