# 🚀 Next Steps: Cursor Integration

**Status:** MCP Server Build Complete ✅
**What's Ready:** `dist/index.js` compiled and tested

---

## Step 1: Get the Full Path 📍

Run this command in the mcp-debugger directory:
```bash
cd mcp-debugger
pwd
```

Copy the path shown. Example:
```
/Users/yourname/projects/cargo-flow-navigator/mcp-debugger
```

---

## Step 2: Update Cursor Config 🔧

Edit or create `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cfn-debugger": {
      "command": "node",
      "args": ["/path/from/step1/dist/index.js"]
    }
  }
}
```

**Important:** Replace `/path/from/step1` with your actual path!

---

## Step 3: Restart Cursor 🔄

1. **Force quit** Cursor (Cmd+Q on Mac, or Alt+F4 on Windows)
2. **Reopen** Cursor
3. **Wait** a few seconds for MCP to initialize

---

## Step 4: Test in Cursor 🧪

Open any CFN TypeScript/React file and type these commands:

### Test 1: RLS Violations
```
/analyze-rls-violations src/components/Orders.tsx
```

### Test 2: Currency Formatting
```
/validate-intl-format src/lib/formatters.ts
```

### Test 3: Edge Functions
```
/monitor-edge-functions --function-name calculate-freight
```

### Test 4: React Component
```
/debug-component src/components/QuoteForm.tsx --checks hooks
```

---

## Troubleshooting 🔧

### ❌ "Command not found" in Cursor
- **Solution:** Restart Cursor (Force Quit + Reopen)
- **Check:** `~/.cursor/mcp.json` syntax is valid JSON
- **Verify:** Path in config is absolute (starts with `/` not `./`)

### ❌ Path errors when running commands
- **Use full paths:** `/path/to/src/components/Orders.tsx`
- **Check working directory:** Commands run from project root

### ❌ "CFN Debugger MCP Server running on stdio" appears
- ✅ This is expected! Server is working
- Commands should work after this message

### ❌ Timeout or no response
- Check that file path exists
- Make sure TypeScript file is valid
- Try a simpler command first

---

## How to Check Cursor Logs 📋

If something isn't working:

```bash
# On Mac/Linux
tail -f ~/.cursor/mcp.log

# Watch for "CFN Debugger MCP Server running on stdio"
# This confirms the server connected successfully
```

---

## Example: Full Workflow 🎯

```bash
# 1. Terminal: Go to CFN project
cd /path/to/cargo-flow-navigator

# 2. Cursor: Open a TypeScript file (e.g., src/components/Orders.tsx)
# Ctrl/Cmd+Shift+P to open Cursor Chat

# 3. Type command in Cursor:
/analyze-rls-violations src/components/Orders.tsx

# 4. You'll see:
{
  "file": "src/components/Orders.tsx",
  "violations": [
    {
      "location": "src/components/Orders.tsx:45",
      "type": "missing_rls",
      "severity": "warning",
      "suggestion": "Add filtering condition: .eq('user_id', userId)"
    }
  ],
  "riskLevel": "medium",
  "summary": "⚠️ Found 1 potential RLS issue"
}
```

---

## What Each Tool Does 🔍

| Tool | Command | Purpose |
|------|---------|---------|
| **RLS Analyzer** | `/analyze-rls-violations` | Find Row Level Security bypasses |
| **Currency Validator** | `/validate-intl-format` | Check BRL formatting (2 decimals) |
| **Edge Function Monitor** | `/monitor-edge-functions` | Monitor performance & errors |
| **React Debugger** | `/debug-component` | Find hooks & render issues |

---

## Success Checklist ✅

- [ ] Cursor config updated with correct path
- [ ] Cursor restarted completely
- [ ] At least one `/analyze-rls-violations` command works
- [ ] Getting JSON output with issues/results
- [ ] Can run commands on different files

---

## Need Help? 📚

- **Full Setup Guide:** `CURSOR-SETUP.md`
- **Comprehensive Docs:** `README.md`
- **Quick Reference:** `QUICKSTART.md`
- **Build Info:** `../SPRINT-2-BUILD-RESOLVED.md`

---

**Ready?** Open Cursor and run your first command! 🎯
