# 🚀 CFN Debugger MCP - Quick Start

## 📦 Installation (2 minutes)

```bash
cd mcp-debugger

# Option 1: Automated (Recommended)
chmod +x INSTALL.sh
./INSTALL.sh

# Option 2: Manual
npm install
npm run build
```

---

## 🔌 Cursor Integration (1 minute)

**File:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "cfn-debugger": {
      "command": "node",
      "args": ["/path/to/mcp-debugger/dist/index.js"]
    }
  }
}
```

Then: **Restart Cursor** ↻

---

## ⚡ Usage (Once Cursor is open)

### Check RLS Security
```
/analyze-rls-violations src/components/Orders.tsx
```
**Detects:** Missing RLS filters, security bypasses

### Validate Currency Formatting
```
/validate-intl-format src/lib/formatters.ts --auto-fix
```
**Detects:** Missing decimal places, wrong currency

### Monitor Edge Functions
```
/monitor-edge-functions --function-name calculate-freight
```
**Shows:** Latency, error rate, performance alerts

### Debug React Components
```
/debug-component src/components/QuoteForm.tsx --checks hooks,renders
```
**Detects:** Missing dependencies, unnecessary renders

---

## 📊 What Each Tool Does

```
┌────────────────────────────────────────────────────────────┐
│              CFN DEBUGGER MCP SERVER                        │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  🔐 RLS Analyzer          → Security violations             │
│     └─ Detects client-side filtering, missing .eq()        │
│                                                              │
│  💵 Currency Validator    → Formatting compliance           │
│     └─ Ensures 2 decimals, pt-BR locale, BRL currency      │
│                                                              │
│  ⚡ Edge Function Monitor  → Performance metrics             │
│     └─ Latency, error rate, recommendations                │
│                                                              │
│  ⚛️  React Debugger       → Component issues                │
│     └─ Hooks deps, re-renders, console.log                 │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 Common Workflows

### **Workflow 1: Code Review Check**

```
Before committing:

@cfn-debugger analyze this:
- /analyze-rls-violations src/components/Orders.tsx
- /validate-intl-format src/lib/formatters.ts
- /debug-component src/components/QuoteForm.tsx
```

### **Workflow 2: Performance Diagnosis**

```
When users report slow responses:

@cfn-debugger diagnose:
- /monitor-edge-functions --function-name calculate-freight
- /debug-component src/components/FreightSimulator.tsx --checks performance
```

### **Workflow 3: Auto-Fix Issues**

```
Bulk fix currency formatting:

/validate-intl-format src/ --auto-fix
```

---

## 📋 Output Examples

### RLS Violations Output
```
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

### Currency Validation Output
```
{
  "file": "src/lib/formatters.ts",
  "issues": [
    {
      "location": "src/lib/formatters.ts:15",
      "issue": "missing_fraction_digits",
      "current": "new Intl.NumberFormat('pt-BR', { currency: 'BRL' })",
      "suggested": "Add minimumFractionDigits: 2, maximumFractionDigits: 2"
    }
  ],
  "conforming": 2,
  "totalIntlCalls": 3,
  "summary": "⚠️ Found 1 formatting issue(s)"
}
```

### Edge Function Metrics
```
{
  "functionName": "calculate-freight",
  "metrics": {
    "avgLatency": 200,
    "p95Latency": 300,
    "p99Latency": 400,
    "errorRate": 0.5,
    "successCount": 480,
    "errorCount": 2
  },
  "alerts": [
    {
      "severity": "warning",
      "message": "Edge Function latency is high",
      "threshold": 250,
      "actual": 200
    }
  ],
  "recommendation": "Consider optimizing database queries"
}
```

### Component Issues
```
{
  "componentName": "QuoteForm",
  "issues": [
    {
      "type": "missing_dependency",
      "line": 45,
      "description": "useEffect missing dependency array",
      "fix": "useEffect(() => { ... }, [dependencies])"
    }
  ],
  "hooksFound": ["useState", "useEffect", "useCallback"],
  "summary": "⚠️ Found 1 potential issue(s)"
}
```

---

## 🔧 Troubleshooting

### ❌ "Command not found" error
✅ Restart Cursor completely (Force Quit)

### ❌ "Cannot read file" error
✅ Use full path: `/path/to/file.tsx`

### ❌ npm install fails
✅ Run: `npm install --force --legacy-peer-deps`

### ❌ Build fails
✅ Check: `npm run type-check`

---

## 📚 Learn More

- **Full Guide:** See `README.md`
- **Cursor Setup:** See `CURSOR-SETUP.md`
- **Installation:** See `INSTALL.sh`
- **All Tools:** Each tool documented in `src/tools/`

---

## 🚦 Status

✅ **Implementation Complete**
🔄 **Next:** Integration Testing
📋 **Then:** Evaluation & Documentation

---

## 💬 Get Help

1. Read `CURSOR-SETUP.md` for integration issues
2. Check `README.md` for tool details
3. Run `INSTALL.sh` if you hit issues
4. Review tool examples in this file

---

**Ready to debug like a pro!** 🎯

Next: Run `./INSTALL.sh` and restart Cursor.
