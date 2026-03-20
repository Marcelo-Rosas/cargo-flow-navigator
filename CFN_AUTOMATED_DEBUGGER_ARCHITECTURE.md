# 🤖 CFN Automated Debugger Agent — Architecture & Design

**Objetivo:** Criar um agente Claude que usa Chrome DevTools MCP para auditar 100% dos componentes do CFN, identificar bugs em runtime e aplicar correções automáticas.

**Inspiração:** [CyberAgent's Debugging Workflow](https://developer.chrome.com/blog/autofix-runtime-devtools-mcp/)

---

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Developer (Git Push)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              GitHub Actions CI/CD Pipeline                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Trigger: PR opened / Push to main                        │  │
│  │ Step 1: Build CFN (npm run build)                        │  │
│  │ Step 2: Spin up Storybook server (npm run storybook)    │  │
│  │ Step 3: Launch Chrome DevTools MCP                       │  │
│  │ Step 4: Invoke Claude Agent with prompt                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           Claude Agent (Orchestrator)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Parse Storybook structure via MCP                     │  │
│  │ 2. Load Detection Rules Engine                           │  │
│  │ 3. Iterate: Navigate → Check → Detect → Fix             │  │
│  │ 4. Aggregate results → Generate report                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Chrome     │  │  Detection   │  │  Auto-Fix    │
│  DevTools    │  │   Engine     │  │   Engine     │
│   MCP        │  │              │  │              │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ - Navigate   │  │ - Runtime    │  │ - BRL format │
│ - Read DOM   │  │ - TypeScript │  │ - React deps │
│ - Read logs  │  │ - Warnings   │  │ - any types  │
│ - Execute JS │  │ - ESLint     │  │ - Fast ref   │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   File System                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Auto-Fix writes to src/ files (if passing validation)    │  │
│  │ OR commits to feature branch (for review)                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              GitHub Actions (Continued)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 5: Commit fixes (if any) to feature branch          │  │
│  │ Step 6: Run npm run lint / npm run build to validate     │  │
│  │ Step 7: Generate audit report                           │  │
│  │ Step 8: Post results to GitHub + Slack                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   GitHub     │  │    Slack     │  │  Dashboard   │
│    PR        │  │  Notification │  │    (Web)     │
│   Comment    │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔍 Detection Engine

Regras de detecção de bugs:

```typescript
interface DetectionRule {
  name: string                      // Ex: "brl-missing-decimals"
  category: string                  // Ex: "brl", "react", "typescript"
  severity: "error" | "warning"     // ESLint-style
  detect: (context: AuditContext) => Detection[]
  suggestedFix?: (detection: Detection) => CodeFix
}

// Example Rule
const BRL_MISSING_DECIMALS: DetectionRule = {
  name: "brl-missing-decimals",
  category: "brl",
  severity: "error",

  detect: (context: AuditContext) => {
    // 1. Read console.log output
    // 2. Look for currency values without 2 decimals
    // 3. Return list of detections
    return []
  },

  suggestedFix: (detection: Detection) => ({
    file: "src/components/Example.tsx",
    line: 142,
    old: 'maximumFractionDigits: 0',
    new: 'minimumFractionDigits: 2, maximumFractionDigits: 2'
  })
}
```

### Detection Rules to Implement

1. **BRL Formatting** (91 detections)
   - `maximumFractionDigits: 0` → `minimumFractionDigits: 2`
   - `toFixed().replace()` → `Intl.NumberFormat`
   - Missing `minimumFractionDigits` in NumberFormat

2. **React Hooks** (6 detections)
   - useEffect missing dependencies
   - useMemo/useCallback with complex expressions
   - Logical expressions in dependencies

3. **TypeScript** (3 detections)
   - `any` types → define proper interfaces
   - Missing type annotations

4. **Fast Refresh** (17 detections)
   - Constants exported with components
   - Complex expressions in exports

5. **Intl.NumberFormat** (41 detections)
   - Missing explicit fractionDigits

---

## 🔧 Auto-Fix Engine

```typescript
interface CodeFix {
  file: string
  line: number
  old: string
  new: string
  detection: Detection
  validated: boolean
}

interface AutoFixEngine {
  // Aplicar fix ao arquivo
  applyFix(fix: CodeFix): Promise<void>

  // Validar que fix não quebrou o build
  validate(fix: CodeFix): Promise<boolean>

  // Se falhar validação, tentar alternativa
  fallback(fix: CodeFix): Promise<CodeFix | null>
}

// Exemplo de fluxo
const fix = {
  file: "src/components/Example.tsx",
  line: 142,
  old: 'maximumFractionDigits: 0,',
  new: 'minimumFractionDigits: 2, maximumFractionDigits: 2,'
}

// 1. Apply
await engine.applyFix(fix)

// 2. Validate (npm run lint)
const isValid = await engine.validate(fix)

// 3. If not valid, fallback
if (!isValid) {
  const alternative = await engine.fallback(fix)
  // Try alternative fix
}
```

---

## 📝 Audit Context (What MCP Provides)

```typescript
interface AuditContext {
  // Browser State
  url: string                       // Ex: "http://localhost:6006?path=/docs/badge--docs"
  dom: string                       // Current DOM snapshot
  styles: CSSStyleDeclaration      // Computed styles

  // Console Output
  consoleLogs: ConsoleLine[]        // All console.log/warn/error
  errors: Error[]                   // Runtime errors

  // File System Access
  fileContent: Map<string, string>  // src/ files

  // Storybook Meta
  currentStory: {
    id: string                      // Ex: "badge--docs"
    title: string                   // Ex: "Badge"
    kind: string                    // Component name
    story: string                   // Story name
  }

  // Metadata
  timestamp: Date
  stories: string[]                 // List of all stories (for navigation)
}
```

---

## 🎯 Claude Agent Prompt (Sprint 2)

```markdown
# CFN Automated Debugger Agent

You are an expert debugging agent with access to Chrome DevTools MCP and the file system.
Your task is to audit 100% of components in the CFN Storybook, identify runtime errors,
and fix them autonomously.

## Context
- Storybook is running at http://localhost:6006
- You have access to src/ files for reading and editing
- Chrome DevTools MCP provides: DOM, console logs, error inspection, JavaScript execution

## Task
1. **Discover**: List all available stories in Storybook
2. **Navigate**: Click through EVERY story (no matter how many)
3. **Inspect**: Read console.log, console.error for each story
4. **Detect**: Use Detection Rules to identify bugs:
   - BRL formatting errors (missing decimals)
   - React hooks issues
   - TypeScript any types
   - Fast refresh violations
5. **Fix**: Apply Auto-Fix Engine for each bug
6. **Validate**: Re-render story after fix, confirm no new errors
7. **Report**: Generate summary of all detections and fixes

## Detection Rules
[Insert all 5 rules here with examples]

## Success Criteria
- ✅ Navigate through 100% of stories (X total)
- ✅ Identify all runtime errors
- ✅ Fix >= 80% of errors without breaking build
- ✅ Re-validate each fix
- ✅ Zero false positives in fixes

## Constraints
- Do NOT make changes you cannot validate
- Do NOT break the build (npm run lint must pass)
- Do NOT delete code, only modify
- DO ask MCP to navigate, read console, execute JS
- DO commit fixes to feature branch with clear messages

Start by navigating to Storybook and listing all stories.
```

---

## 🔄 Validation Loop (Critical)

```
┌──────────────────────────────────────────────────────┐
│  1. Detect Error in Story A                         │
│     - Type: "brl-missing-decimals"                  │
│     - File: src/components/Example.tsx:142          │
│     - Detection: maximumFractionDigits: 0           │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  2. Apply Fix                                        │
│     - Edit file                                      │
│     - Replace old → new                             │
│     - Write to disk                                 │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  3. Validate Fix                                     │
│     - Hot reload Storybook                          │
│     - Re-render story A                             │
│     - Check console for NEW errors                  │
│     - Run npm run lint                              │
└──────────────┬───────────────────────────────────────┘
               │
         ┌─────┴─────┐
         │           │
         ▼           ▼
    ✅ PASS      ❌ FAIL
         │           │
         │           ▼
         │    ┌──────────────────┐
         │    │ 4. Fallback      │
         │    │ - Undo change    │
         │    │ - Log failure    │
         │    │ - Try alt fix    │
         │    └──────────────────┘
         │           │
         │           ▼
         │        [Retry or Skip]
         │
         ▼
    ┌──────────────────────┐
    │ 5. Mark as Fixed     │
    │ - Move to next story │
    │ - Log success        │
    │ - Add to report      │
    └──────────────────────┘
```

---

## 📊 Audit Report (Output)

```json
{
  "timestamp": "2026-03-28T14:30:00Z",
  "duration_seconds": 3600,
  "summary": {
    "total_stories": 236,
    "stories_audited": 236,
    "audit_coverage_percent": 100,
    "errors_detected": 15,
    "errors_fixed": 12,
    "errors_failed": 3,
    "success_rate": 80
  },
  "detections": [
    {
      "story_id": "badge--docs",
      "rule": "brl-missing-decimals",
      "severity": "error",
      "file": "src/components/ui/badge.tsx",
      "line": 34,
      "message": "maximumFractionDigits: 0 detected",
      "detection_code": "maximumFractionDigits: 0,",
      "fix_applied": true,
      "validation_status": "PASS",
      "timestamp": "2026-03-28T14:31:45Z"
    },
    {
      "story_id": "button--primary",
      "rule": "react-hooks-deps",
      "severity": "warning",
      "file": "src/components/ui/button.tsx",
      "line": 48,
      "message": "useEffect missing dependency: 'onClick'",
      "fix_applied": false,
      "validation_status": "SKIPPED",
      "reason": "Complex case, requires manual review",
      "timestamp": "2026-03-28T14:35:12Z"
    }
  ],
  "stats_by_category": {
    "brl": { "detected": 8, "fixed": 7, "failed": 1 },
    "react": { "detected": 4, "fixed": 3, "failed": 1 },
    "typescript": { "detected": 2, "fixed": 2, "failed": 0 },
    "fastrefresh": { "detected": 1, "fixed": 0, "failed": 1 }
  },
  "github_actions": {
    "pr_comment": "✅ Audit complete! 12/15 errors fixed. [View Report](#)",
    "slack_message": "@channel CFN Automated Debugger: 100% audit coverage, 80% auto-fix success"
  },
  "next_steps": [
    "Review 3 failed fixes manually in PR",
    "Merge fixes to feature branch",
    "Run full test suite",
    "Deploy to staging"
  ]
}
```

---

## 🛠️ Implementation Phases

### Phase 1: Foundation (Days 1-2, Sprint 2)
1. Setup Chrome DevTools MCP
2. Setup Storybook for CFN
3. Basic navigation + console reading
4. Simple prompt for agentto navigate stories

### Phase 2: Detection (Days 3-4, Sprint 2)
1. Implement Detection Rules Engine
2. Add rule for BRL formatting (highest impact)
3. Test with 5 stories
4. Iterate & refine

### Phase 3: Auto-Fix (Days 5-6, Sprint 2)
1. Implement Auto-Fix Engine
2. Implement Validation Loop
3. Test with 10 stories
4. Handle edge cases

### Phase 4: Integration (Days 7-9, Sprint 2)
1. GitHub Actions CI/CD
2. Report generation
3. Slack notifications
4. Dashboard

### Phase 5: Operationalization (Day 10, Sprint 2)
1. Documentation
2. User manual
3. Runbook for team
4. Training

---

## 📦 File Structure

```
src/
├── agents/
│   ├── cfn-debugger.ts           # Main agent orchestrator
│   └── prompts/
│       └── audit-prompt.md       # Agent system prompt
├── detection/
│   ├── detection-engine.ts       # Core detection logic
│   └── rules/
│       ├── brl.ts               # BRL formatting rules
│       ├── react-hooks.ts       # React hooks rules
│       ├── typescript.ts        # TypeScript rules
│       ├── fast-refresh.ts      # Fast refresh rules
│       └── intl-format.ts       # Intl formatting rules
├── fix/
│   ├── auto-fix-engine.ts       # Core fix logic
│   └── fixes/
│       ├── brl-fixes.ts
│       ├── react-hooks-fixes.ts
│       ├── typescript-fixes.ts
│       ├── fast-refresh-fixes.ts
│       └── intl-format-fixes.ts
└── report/
    ├── report-generator.ts      # JSON report
    ├── github-comment.ts        # PR comment
    └── slack-notifier.ts        # Slack message

.github/
└── workflows/
    └── cfn-audit.yml            # GitHub Actions

docs/
└── DEBUGGER_MANUAL.md           # User guide
```

---

## 💡 Key Design Decisions

| Decisão | Racional |
|---------|----------|
| Use Chrome DevTools MCP (not Puppeteer) | Real browser state, matches actual user experience |
| Storybook as test surface | All components in isolation, easy to navigate |
| Validation loop mandatory | Ensure fixes don't break build |
| Commit to feature branch | Code review before merge, safety first |
| JSON report output | Machine-readable, easy to integrate |
| Slack + GitHub + Dashboard | Multi-channel awareness |
| Prompt-based agent | Flexible, extensible, no hardcoded logic |

---

## 🎓 Future Enhancements

1. **Performance Analysis**
   - Use DevTools Performance panel to check Core Web Vitals
   - Auto-fix for layout shifts, long tasks

2. **Visual Regression Detection**
   - Screenshot comparison before/after
   - Detect visual bugs not caught by console logs

3. **Accessibility Audit**
   - ARIA violations detection
   - Auto-fix common a11y issues

4. **Multi-environment Testing**
   - Run same audit across mobile, dark mode, RTL
   - Aggregate results

5. **Smart Learning**
   - Agent learns new rules over time
   - Community-contributed detection rules

---

## 📚 References

- [CyberAgent Case Study](https://developer.chrome.com/blog/autofix-runtime-devtools-mcp/)
- [Chrome DevTools MCP GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Storybook Documentation](https://storybook.js.org/)
- [Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-python)

---

**Created:** March 20, 2026
**Status:** Design phase (ready for Sprint 2 implementation)
**Owner:** Marcelo Rosas (@marcelo.rosas@vectracargo.com.br)
