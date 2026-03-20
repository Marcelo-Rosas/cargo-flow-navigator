# CFN Debugger MCP Server

Automated debugging server for **Cargo Flow Navigator** (TMS - Transport Management System).

Provides AI-powered tools to detect and fix code issues matching CFN conventions:
- 🔐 **RLS Violations** - Detects Row Level Security bypasses
- 💵 **Currency Formatting** - Validates BRL Intl.NumberFormat (2 decimals)
- ⚡ **Edge Functions** - Monitors performance and errors
- ⚛️ **React Components** - Analyzes hooks, renders, performance

## Setup

### 1. Install Dependencies

```bash
cd mcp-debugger
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Build

```bash
npm run build
```

### 4. Integrate with Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cfn-debugger": {
      "command": "node",
      "args": ["/path/to/mcp-debugger/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://epgedaiukjippepujuzc.supabase.co",
        "SUPABASE_SERVICE_KEY": "your_key_here"
      }
    }
  }
}
```

Then restart Cursor.

## Usage in Cursor

All tools are available as Cursor MCP commands:

### 1. RLS Violation Analysis

```
/debug-rls src/components/Orders.tsx
/debug-rls src/hooks/useFinancialData.ts --check-type=queries
```

**Detects:**
- Missing `.eq()`, `.neq()` filtering
- Client-side filtering (security risk)
- Service role key in client code

### 2. Currency Validation

```
/validate-currency src/lib/formatters.ts
/validate-currency src/components --auto-fix
```

**Checks:**
- `Intl.NumberFormat` with `minimumFractionDigits: 2`
- Correct locale (`pt-BR`) and currency (`BRL`)
- Auto-fixes if possible

### 3. Edge Function Monitoring

```
/monitor-edge calculate-freight
/monitor-edge notification-hub --time-range=7d
```

**Metrics:**
- Average latency, P95, P99
- Error rate
- Last error and timestamp
- Performance recommendations

### 4. Component Analysis

```
/debug-component src/components/QuoteForm.tsx
/debug-component src/pages --checks=hooks,renders
```

**Checks:**
- Missing useEffect dependencies
- Inline object/array creation (causes re-renders)
- console.log in production
- Hook usage patterns

## Tools Available

### `analyze-rls-violations`

**Input:**
```json
{
  "filePath": "src/components/Orders.tsx",
  "checkType": "queries",      // "queries" | "functions" | "all"
  "verbose": false
}
```

**Output:**
```json
{
  "file": "src/components/Orders.tsx",
  "violations": [
    {
      "location": "src/components/Orders.tsx:45",
      "type": "missing_rls",
      "severity": "warning",
      "suggestion": "Add filtering condition or RLS policy"
    }
  ],
  "summary": "⚠️ Found 1 potential RLS issue",
  "riskLevel": "medium",
  "passedChecks": ["✅ Service role key only in Edge Functions"]
}
```

### `validate-intl-format`

**Input:**
```json
{
  "filePath": "src/lib/formatters.ts",
  "checkType": "currency",     // "currency" | "numbers" | "all"
  "autoFix": true
}
```

**Output:**
```json
{
  "file": "src/lib/formatters.ts",
  "issues": [
    {
      "location": "src/lib/formatters.ts:15",
      "issue": "missing_fraction_digits",
      "current": "new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })",
      "suggested": "Add minimumFractionDigits: 2, maximumFractionDigits: 2"
    }
  ],
  "totalIntlCalls": 3,
  "conforming": 2,
  "summary": "⚠️ Found 1 formatting issue(s)"
}
```

### `monitor-edge-functions`

**Input:**
```json
{
  "functionName": "calculate-freight",
  "timeRange": "24h",          // "1h" | "24h" | "7d"
  "limit": 100
}
```

**Output:**
```json
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
      "metric": "avgLatency",
      "threshold": 250,
      "actual": 200
    }
  ],
  "recommendation": "✅ Edge Function is performing well",
  "timeRange": "24h"
}
```

### `debug-component`

**Input:**
```json
{
  "filePath": "src/components/QuoteForm.tsx",
  "checks": ["hooks", "renders", "performance"]
}
```

**Output:**
```json
{
  "file": "src/components/QuoteForm.tsx",
  "componentName": "QuoteForm",
  "issues": [
    {
      "type": "missing_dependency",
      "line": 45,
      "description": "useEffect may be missing dependency array",
      "fix": "Add dependency array: useEffect(() => { ... }, [deps])",
      "severity": "warning"
    }
  ],
  "summary": "⚠️ Found 1 potential issue(s)",
  "hooksFound": ["useState", "useEffect", "useCallback"],
  "renderCalls": 12
}
```

## Architecture

```
mcp-debugger/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── tools/                   # Tool implementations
│   │   ├── analyze-rls.ts
│   │   ├── validate-intl.ts
│   │   ├── monitor-edge-functions.ts
│   │   └── debug-component.ts
│   └── schemas/
│       └── validation.ts        # Zod schemas for input validation
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Watch mode
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Start server
npm start
```

## Integration with CFN

The MCP server is designed to be **environment-aware**:

1. **RLS Detection** - Uses pattern matching for Supabase `.from()` queries
2. **Currency Validation** - Enforces CFN standard (2 decimals, pt-BR, BRL)
3. **Edge Function Monitoring** - Queries Supabase Edge Function logs
4. **Component Analysis** - AST parsing for React hooks and patterns

## Future Enhancements

- [ ] Git integration (lint staged files)
- [ ] PR checks automation
- [ ] Performance budgets and thresholds
- [ ] Custom rule creation
- [ ] Integration with GitHub Actions
- [ ] Slack notifications for critical issues
- [ ] Metrics dashboard

## Support

For issues or feature requests, contact: marcelo.rosas@vectracargo.com.br
