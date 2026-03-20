# Cursor Integration Guide - CFN Debugger MCP

## 🚀 Quick Setup (3 steps)

### 1. Build MCP Server

```bash
cd mcp-debugger
npm install
npm run build
```

### 2. Configure Cursor

**For macOS/Linux:**

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cfn-debugger": {
      "command": "node",
      "args": ["${CFN_PATH}/mcp-debugger/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://epgedaiukjippepujuzc.supabase.co",
        "SUPABASE_SERVICE_KEY": "your_service_key_here",
        "CFN_PROJECT_ROOT": "${CFN_PATH}/src"
      }
    }
  }
}
```

**For Windows:**

Edit `%APPDATA%\Cursor\mcp.json` (replace `${CFN_PATH}` with actual path)

### 3. Restart Cursor

Close and reopen Cursor. New MCP commands will be available via `/`.

---

## 📝 Usage Examples

### Analyze RLS Violations

**Command:**
```
/analyze-rls-violations
```

**In Cursor Composer:**
```
/analyze-rls-violations src/components/Orders.tsx --check-type queries
```

**Response:**
- ✅ Shows RLS policy status
- ⚠️ Flags missing `.eq()` filters
- 🔴 Alerts on security risks

---

### Validate Currency Formatting

**Command:**
```
/validate-intl-format
```

**In Cursor Composer:**
```
/validate-intl-format src/lib/formatters.ts --auto-fix
```

**Response:**
- ✅ Confirms BRL formatting (2 decimals)
- 🔧 Suggests fixes
- 📝 Can auto-apply fixes to file

---

### Monitor Edge Functions

**Command:**
```
/monitor-edge-functions
```

**In Cursor Composer:**
```
/monitor-edge-functions --function-name calculate-freight --time-range 24h
```

**Response:**
- 📊 Latency metrics (avg, P95, P99)
- 📈 Error rate and count
- 💡 Performance recommendations

---

### Debug React Components

**Command:**
```
/debug-component
```

**In Cursor Composer:**
```
/debug-component src/components/QuoteForm.tsx --checks hooks,renders
```

**Response:**
- ⚠️ Missing dependency arrays
- 🔄 Unnecessary re-renders
- 🐛 Common React pitfalls

---

## 🎯 Common Workflows

### Workflow 1: Code Review Check

Before committing, check for RLS and Intl issues:

```
In Cursor:
@cfn-debugger Please analyze RLS violations and currency formatting in:
- src/components/Orders.tsx
- src/hooks/useFinancialData.ts
- src/lib/formatters.ts
```

**Result:** Automated security + compliance check ✅

---

### Workflow 2: Performance Diagnosis

When users report slow responses:

```
In Cursor:
@cfn-debugger Monitor edge functions and debug components:
- /monitor-edge-functions --function-name calculate-freight
- /debug-component src/components/FreightCalculator.tsx
```

**Result:** Identifies bottlenecks instantly 🚀

---

### Workflow 3: Auto-Fix on Save

Enable MCP to auto-fix formatting issues:

```
In Cursor Composer:
@cfn-debugger Auto-fix all Intl.NumberFormat issues in src/
/validate-intl-format src/ --auto-fix
```

**Result:** Bulk fixes applied to entire directory ✨

---

## ⚙️ Configuration Details

### Environment Variables

```bash
SUPABASE_URL          # Supabase project URL
SUPABASE_SERVICE_KEY  # Service role key (for Edge Function logs)
CFN_PROJECT_ROOT      # Path to CFN src/ directory
MCP_LOG_LEVEL         # "debug" | "info" | "warn" | "error"
```

### Command-Line Flags

```bash
--check-type      # Scope of analysis (queries, functions, all)
--time-range      # For edge functions (1h, 24h, 7d)
--auto-fix        # Apply auto-fixes to files
--verbose         # Detailed output
```

---

## 🔧 Troubleshooting

### "Command not found" error

**Solution:**
1. Restart Cursor completely (Force Quit + reopen)
2. Check `~/.cursor/mcp.json` syntax is valid JSON
3. Verify file path to `dist/index.js` is correct
4. Check `npm run build` completed successfully

---

### "SUPABASE_SERVICE_KEY not found"

**Solution:**
1. Ensure `.env` file is in `mcp-debugger/` directory
2. Verify key format (should be very long string)
3. Get key from Supabase Dashboard → Settings → API → Service Role Key

---

### "Cannot read file" error

**Solution:**
1. Ensure file path is correct and relative to project root
2. For absolute paths, use full `/path/to/file.tsx`
3. Check file exists and is readable

---

## 📊 MCP Server Status

Check if server is running:

```bash
curl http://localhost:3000/health
# or in Cursor: /debug-server-status
```

View logs:

```bash
tail -f mcp-debugger/logs/mcp.log
```

---

## 🚀 Next Steps

1. ✅ Build and integrate MCP server
2. ⚡ Try `/analyze-rls-violations` on one file
3. 💵 Run `/validate-intl-format` on formatters
4. 🔄 Set up auto-fixing workflow
5. 📊 Monitor Edge Functions daily

---

## 💡 Pro Tips

- **Batch Analysis:** Use globs to check multiple files:
  ```
  /analyze-rls-violations src/**/*.tsx
  ```

- **CI/CD Integration:** Run MCP checks before commit:
  ```bash
  npm run lint && node mcp-debugger/dist/index.js < test-input.json
  ```

- **Team Sharing:** Share MCP config in `.cursor/team-mcp.json`

- **Custom Rules:** Extend tools by adding regex patterns in `src/tools/`

---

## 📖 Documentation

- Full tool reference: See `README.md`
- MCP Protocol spec: https://modelcontextprotocol.io
- Cursor MCP docs: https://docs.cursor.com/advanced/mcpServers

---

**Questions?** Contact: marcelo.rosas@vectracargo.com.br
