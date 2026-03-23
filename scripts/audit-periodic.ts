#!/usr/bin/env npx tsx
/**
 * Cargo Flow Navigator — Auditoria Periódica (Camada 2)
 *
 * Auditoria completa para rodar semanalmente ou por sprint.
 * Vai além da Camada 1 — analisa estrutura, cobertura, bundle, e padrões de negócio.
 *
 * Uso: npx tsx scripts/audit-periodic.ts
 * Gera: audit-periodic-report.md (relatório legível)
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

// ─── Helpers ────────────────────────────────────────────────

function collectFiles(dir: string, exts: string[]): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (
        stat.isDirectory() &&
        !['node_modules', 'dist', '.vite', 'coverage', '.git'].includes(entry)
      ) {
        files.push(...collectFiles(full, exts));
      } else if (exts.includes(extname(entry))) {
        files.push(full);
      }
    }
  } catch {
    /* */
  }
  return files;
}

function runCmd(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: ROOT, timeout: 120000 }).trim();
  } catch {
    return '(falhou)';
  }
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

const report: string[] = [];
function h1(text: string) {
  report.push(`\n# ${text}\n`);
}
function h2(text: string) {
  report.push(`\n## ${text}\n`);
}
function line(text: string) {
  report.push(text);
}
function table(headers: string[], rows: string[][]) {
  report.push(`| ${headers.join(' | ')} |`);
  report.push(`| ${headers.map(() => '---').join(' | ')} |`);
  rows.forEach((r) => report.push(`| ${r.join(' | ')} |`));
}

// ─── Header ─────────────────────────────────────────────────

h1('Auditoria Periódica — Cargo Flow Navigator');
line(`**Data:** ${new Date().toISOString().split('T')[0]}`);
line(`**Branch:** ${runCmd('git branch --show-current')}`);
line(`**Último commit:** ${runCmd('git log -1 --format="%h %s"')}`);

// ─── 0. Pipeline Health ─────────────────────────────────────

h2('0. Pipeline Health');

// 0a. Build
const buildResult = (() => {
  try {
    execSync('npm run build', { cwd: ROOT, timeout: 120_000, stdio: 'pipe' });
    return { status: 'PASS' as const, error: '' };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer };
    return { status: 'FAILED' as const, error: err.stderr?.toString()?.slice(-200) || '' };
  }
})();

// 0b. TypeScript
const tscResult = (() => {
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, timeout: 60_000, stdio: 'pipe' });
    return { status: 'PASS' as const, errors: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer };
    const output = err.stdout?.toString() || '';
    const errorCount = (output.match(/error TS\d+/g) || []).length;
    return { status: 'FAILED' as const, errors: errorCount };
  }
})();

// 0c. Linting
const lintResult = (() => {
  try {
    execSync('npm run lint', { cwd: ROOT, timeout: 60_000, stdio: 'pipe' });
    return { status: 'PASS' as const, errors: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer };
    const output = err.stdout?.toString() || '';
    const errorLines = output.split('\n').filter((l: string) => l.includes('error')).length;
    return { status: 'FAILED' as const, errors: errorLines };
  }
})();

// 0d. NPM Vulnerabilities
const npmAuditResult = (() => {
  try {
    const raw = execSync('npm audit --json 2>&1 || true', {
      cwd: ROOT,
      timeout: 30_000,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(raw);
    const vulns = parsed.metadata?.vulnerabilities || {};
    return {
      critical: (vulns.critical as number) || 0,
      high: (vulns.high as number) || 0,
      total: ((vulns.critical as number) || 0) + ((vulns.high as number) || 0),
    };
  } catch {
    return { critical: 0, high: 0, total: 0 };
  }
})();

// 0e. RLS Policies (conta CREATE POLICY nos migrations)
const rlsResult = (() => {
  try {
    const migrationsDir = join(ROOT, 'supabase', 'migrations');
    if (!existsSync(migrationsDir)) return { count: 0, source: 'sem migrations' };
    const migFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    let policyCount = 0;
    for (const f of migFiles) {
      const sql = readFileSync(join(migrationsDir, f), 'utf-8');
      const matches = sql.match(/CREATE POLICY/gi);
      if (matches) policyCount += matches.length;
    }
    return { count: policyCount, source: 'migrations' };
  } catch {
    return { count: 0, source: 'erro' };
  }
})();

table(
  ['Verificação', 'Status', 'Detalhe'],
  [
    ['Build', buildResult.status === 'PASS' ? '✅ PASS' : '🔴 FAILED', buildResult.error || '—'],
    [
      'TypeScript',
      tscResult.status === 'PASS' ? '✅ PASS' : '🔴 FAILED',
      `${tscResult.errors} errors`,
    ],
    [
      'Linting',
      lintResult.status === 'PASS' ? '✅ PASS' : '🔴 FAILED',
      `${lintResult.errors} errors`,
    ],
    [
      'NPM Vulnerabilities',
      npmAuditResult.total === 0 ? '✅ PASS' : '🔴 CRITICAL',
      `${npmAuditResult.critical} critical, ${npmAuditResult.high} high`,
    ],
    [
      'RLS Policies',
      rlsResult.count > 0 ? '✅ PASS' : '⚠️',
      `${rlsResult.count} policies (${rlsResult.source})`,
    ],
  ]
);

// ─── 1. Estrutura do Projeto ────────────────────────────────

h2('1. Estrutura do Projeto');

const tsxFiles = collectFiles(SRC, ['.tsx']);
const tsFiles = collectFiles(SRC, ['.ts']);
const testFiles = [...tsxFiles, ...tsFiles].filter(
  (f) => f.includes('.test.') || f.includes('.spec.')
);
const componentFiles = tsxFiles.filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
const hookFiles = tsFiles.filter((f) => f.includes('/hooks/') && !f.includes('.test.'));
const pageFiles = tsxFiles.filter((f) => f.includes('/pages/'));

table(
  ['Métrica', 'Quantidade'],
  [
    ['Componentes (.tsx)', String(componentFiles.length)],
    ['Hooks (.ts em hooks/)', String(hookFiles.length)],
    ['Páginas', String(pageFiles.length)],
    ['Arquivos de teste', String(testFiles.length)],
    [
      'Cobertura de teste',
      `${testFiles.length}/${componentFiles.length + hookFiles.length} (${Math.round((testFiles.length / (componentFiles.length + hookFiles.length)) * 100)}%)`,
    ],
  ]
);

// ─── 2. Formatação BRL ──────────────────────────────────────

h2('2. Compliance de Formatação BRL');

let brlCorrect = 0;
let brlIncorrect = 0;
const brlIssues: string[] = [];

for (const file of [...tsxFiles, ...tsFiles]) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const rel = relative(ROOT, file);

  lines.forEach((ln, i) => {
    // Correto: Intl.NumberFormat com BRL
    if (
      ln.includes("currency: 'BRL'") ||
      (ln.includes('formatCurrency') && !ln.includes('import'))
    ) {
      brlCorrect++;
    }
    // Incorreto: toFixed manual com R$
    if (ln.includes('R$') && ln.includes('toFixed') && !ln.includes('toLocaleString')) {
      brlIncorrect++;
      brlIssues.push(`- \`${rel}:${i + 1}\` — toFixed manual`);
    }
    if (
      ln.includes('maximumFractionDigits: 0') &&
      (ln.includes('R$') ||
        content
          .slice(Math.max(0, content.indexOf(ln) - 200), content.indexOf(ln))
          .includes('savings'))
    ) {
      brlIncorrect++;
      brlIssues.push(`- \`${rel}:${i + 1}\` — sem casas decimais`);
    }
  });
}

line(`**Formatação correta:** ${brlCorrect} ocorrências`);
line(`**Formatação incorreta:** ${brlIncorrect} ocorrências`);
if (brlIssues.length > 0) {
  line('\n**Arquivos com problemas:**');
  brlIssues.forEach((issue) => line(issue));
}

// ─── 3. Error Boundaries ────────────────────────────────────

h2('3. Error Boundaries');

let hasErrorBoundaryLib = false;
let errorBoundaryUsagesInPages = 0;
let errorBoundaryUsagesInAppTsx = 0;

// Check individual page files for ErrorBoundary usage
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf-8');
  if (content.includes('react-error-boundary')) hasErrorBoundaryLib = true;
  if (file.includes('/pages/')) {
    if (content.includes('ErrorBoundary') || content.includes('errorBoundary')) {
      errorBoundaryUsagesInPages++;
    }
  }
}

// Check App.tsx for RouteErrorBoundary wrapping page components
const appTsxPath = join(SRC, 'App.tsx');
if (existsSync(appTsxPath)) {
  const appContent = readFileSync(appTsxPath, 'utf-8');
  if (appContent.includes('ErrorBoundary')) hasErrorBoundaryLib = true;

  // Count <RouteErrorBoundary ...> wrapping page components
  const routeErrorBoundaryMatches = appContent.match(
    /<RouteErrorBoundary[\s\S]*?<\/RouteErrorBoundary>/g
  );
  if (routeErrorBoundaryMatches) {
    errorBoundaryUsagesInAppTsx = routeErrorBoundaryMatches.length;
  }
}

const totalErrorBoundaryUsages = errorBoundaryUsagesInPages + errorBoundaryUsagesInAppTsx;

line(`**Library instalada:** ${hasErrorBoundaryLib ? '✅ sim' : '❌ não'}`);
line(`**Páginas com error boundary (no próprio arquivo):** ${errorBoundaryUsagesInPages}`);
line(`**Páginas com RouteErrorBoundary (em App.tsx):** ${errorBoundaryUsagesInAppTsx}`);
line(`**Total de páginas protegidas:** ${totalErrorBoundaryUsages}`);
line(
  `**Páginas sem error boundary:** ${Math.max(0, pageFiles.length - totalErrorBoundaryUsages)} de ${pageFiles.length}`
);
if (!hasErrorBoundaryLib) {
  line('\n⚠️ **Recomendação:** `npm install react-error-boundary`');
}

// ─── 4. Code Splitting / Lazy Loading ───────────────────────

h2('4. Code Splitting / Lazy Loading');

let lazyImportsInPages = 0;
let lazyImportsInAppTsx = 0;
let suspenseUsages = 0;

// Check individual page files for lazy usage
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf-8');
  if (file.includes('/pages/')) {
    if (content.includes('React.lazy') || content.includes('lazy(() =>')) {
      lazyImportsInPages++;
    }
  }
  if (content.includes('<Suspense')) suspenseUsages++;
}

// Check App.tsx for lazy(() => import('./pages/...')) patterns
if (existsSync(appTsxPath)) {
  const appContent = readFileSync(appTsxPath, 'utf-8');
  const lazyPageMatches = appContent.match(/lazy\(\s*\(\)\s*=>\s*import\(\s*['"]\.\/pages\//g);
  if (lazyPageMatches) {
    lazyImportsInAppTsx = lazyPageMatches.length;
  }
}

const totalLazyImports = lazyImportsInPages + lazyImportsInAppTsx;

line(`**React.lazy imports (em arquivos de página):** ${lazyImportsInPages}`);
line(`**React.lazy imports (em App.tsx para páginas):** ${lazyImportsInAppTsx}`);
line(`**Total lazy imports:** ${totalLazyImports}`);
line(`**Suspense wrappers:** ${suspenseUsages}`);
line(`**Páginas total:** ${pageFiles.length}`);
if (totalLazyImports < pageFiles.length) {
  line(`\n⚠️ **Recomendação:** ${pageFiles.length - totalLazyImports} páginas sem lazy loading`);
}

// ─── 5. Segurança ───────────────────────────────────────────

h2('5. Segurança');

const securityIssues: string[] = [];

for (const file of collectFiles(SRC, ['.ts', '.tsx'])) {
  const content = readFileSync(file, 'utf-8');
  const rel = relative(ROOT, file);

  if (content.includes('service_role') && !content.trimStart().startsWith('//')) {
    securityIssues.push(`- \`${rel}\` — referência a service_role no frontend`);
  }
  if (content.includes('evolution') && content.includes('8080')) {
    securityIssues.push(`- \`${rel}\` — chamada direta à Evolution API`);
  }
}

// Check .env.example for sensitive vars
if (existsSync(join(ROOT, '.env.example'))) {
  const envExample = readFileSync(join(ROOT, '.env.example'), 'utf-8');
  if (envExample.includes('SERVICE_ROLE') || envExample.includes('service_role')) {
    securityIssues.push('- `.env.example` — contém referência a SERVICE_ROLE');
  }
}

line(
  securityIssues.length === 0
    ? '✅ Nenhum problema de segurança encontrado'
    : `❌ ${securityIssues.length} problemas encontrados:`
);
securityIssues.forEach((issue) => line(issue));

// ─── 6. Padrões de Arquitetura ──────────────────────────────

h2('6. Padrões de Arquitetura');

let mutationsWithoutInvalidate = 0;
let useEffectFetches = 0;
let externalStateLibs = 0;
const useEffectFetchFiles: string[] = [];

for (const file of [...tsxFiles, ...tsFiles]) {
  const content = readFileSync(file, 'utf-8');
  const rel = relative(ROOT, file);

  // Mutations sem invalidate — verifica por arquivo
  // Se o arquivo contém useMutation({ mas NÃO contém invalidateQueries, conta como problema
  // Exceção: mutations read-only (validate, calculate, analyze, generate) não alteram dados
  const hasMutationCall = /useMutation\(\{/.test(content);
  if (hasMutationCall) {
    const hasInvalidate = content.includes('invalidateQueries') || content.includes('invalidate(');
    const isReadOnlyMutation = /use(Validate|Calculate|Analyze|Generate)/.test(rel);
    if (!hasInvalidate && !isReadOnlyMutation) {
      mutationsWithoutInvalidate++;
    }
  }

  // useEffect com fetch — only flag when fetch/supabase.from is INSIDE useEffect callback
  // Skip hook files that use useQuery and form files (forms use supabase.from in handlers, not in useEffect)
  if (content.includes('useEffect')) {
    const isHookWithQuery = file.includes('/hooks/') && content.includes('useQuery');
    const isFormFile = /Form\.tsx$|Form\.ts$/.test(file);
    if (!isHookWithQuery && !isFormFile) {
      // Find useEffect blocks and check if fetch/supabase.from appears within ~15 lines
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('useEffect')) {
          // Look at next 15 lines for fetch or supabase.from
          const windowEnd = Math.min(i + 15, lines.length);
          let foundFetchInEffect = false;
          for (let j = i + 1; j < windowEnd; j++) {
            if (
              (lines[j].includes('fetch(') || lines[j].includes('supabase.from(')) &&
              !lines[j].includes('supabase.channel') &&
              !lines[j].includes('.refetch')
            ) {
              foundFetchInEffect = true;
              break;
            }
          }
          if (foundFetchInEffect) {
            useEffectFetches++;
            useEffectFetchFiles.push(rel);
            break; // Count each file only once
          }
        }
      }
    }
  }

  // State libs proibidas
  if (
    content.includes("from 'zustand'") ||
    content.includes("from 'redux'") ||
    content.includes("from 'mobx'")
  ) {
    externalStateLibs++;
  }
}

table(
  ['Padrão', 'Status', 'Ocorrências'],
  [
    [
      'useMutation sem invalidateQueries',
      mutationsWithoutInvalidate === 0 ? '✅' : '⚠️',
      String(mutationsWithoutInvalidate),
    ],
    [
      'useEffect com fetch/supabase',
      useEffectFetches === 0 ? '✅' : '⚠️',
      String(useEffectFetches),
    ],
    [
      'State libs proibidas (Zustand/Redux)',
      externalStateLibs === 0 ? '✅' : '❌',
      String(externalStateLibs),
    ],
  ]
);

if (useEffectFetchFiles.length > 0) {
  line('\n**Arquivos com useEffect + fetch/supabase:**');
  useEffectFetchFiles.forEach((f) => line(`- \`${f}\``));
}

// ─── 7. Bundle & Dependencies ───────────────────────────────

h2('7. Dependências');

if (existsSync(join(ROOT, 'package.json'))) {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  const deps = Object.keys(pkg.dependencies || {}).length;
  const devDeps = Object.keys(pkg.devDependencies || {}).length;
  line(`**Dependências:** ${deps} produção, ${devDeps} dev`);

  // Check for duplicate/conflicting libs
  const hasReactHotToast =
    pkg.dependencies?.['react-hot-toast'] || pkg.devDependencies?.['react-hot-toast'];
  const hasReactToastify =
    pkg.dependencies?.['react-toastify'] || pkg.devDependencies?.['react-toastify'];
  if (hasReactHotToast || hasReactToastify) {
    line('⚠️ Toast library duplicada — remover react-hot-toast/react-toastify, manter sonner');
  }
}

// ─── 8. Acessibilidade ──────────────────────────────────────

h2('8. Acessibilidade');

let imgWithoutAlt = 0;
let buttonWithoutLabel = 0;

for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf-8');

  // <img sem alt
  const imgMatches = content.match(/<img[^>]*>/g) || [];
  imgMatches.forEach((m) => {
    if (!m.includes('alt=') && !m.includes('alt =')) imgWithoutAlt++;
  });

  // Botões sem texto acessível (simplificado)
  const iconBtnMatches = content.match(/<Button[^>]*>\s*<[A-Z]\w+Icon/g) || [];
  iconBtnMatches.forEach((m) => {
    if (!m.includes('aria-label')) buttonWithoutLabel++;
  });
}

table(
  ['Verificação', 'Status', 'Ocorrências'],
  [
    ['Imagens sem alt', imgWithoutAlt === 0 ? '✅' : '⚠️', String(imgWithoutAlt)],
    [
      'Botões de ícone sem aria-label',
      buttonWithoutLabel === 0 ? '✅' : '⚠️',
      String(buttonWithoutLabel),
    ],
    [
      'eslint-plugin-jsx-a11y instalado',
      existsSync(join(ROOT, 'node_modules/eslint-plugin-jsx-a11y')) ? '✅' : '❌',
      '—',
    ],
  ]
);

// ─── 9. Código & Higiene ────────────────────────────────────

h2('9. Código & Higiene');

let todoCount = 0;
let fixmeCount = 0;
let hackCount = 0;
let consoleLogCount = 0;
let largeComponents = 0;
const fileSizes: { rel: string; lines: number }[] = [];

const allSrcFiles = collectFiles(SRC, ['.ts', '.tsx']);

for (const file of allSrcFiles) {
  const content = readFileSync(file, 'utf-8');
  const rel = relative(ROOT, file);
  const lineCount = content.split('\n').length;
  const isTestFile = file.includes('.test.') || file.includes('.spec.');

  // Count TODO/FIXME/HACK
  const todoMatches = content.match(/\/\/\s*TODO/gi);
  if (todoMatches) todoCount += todoMatches.length;
  const fixmeMatches = content.match(/\/\/\s*FIXME/gi);
  if (fixmeMatches) fixmeCount += fixmeMatches.length;
  const hackMatches = content.match(/\/\/\s*HACK/gi);
  if (hackMatches) hackCount += hackMatches.length;

  // Count console.log (not in test files)
  if (!isTestFile) {
    const consoleMatches = content.match(/console\.log\(/g);
    if (consoleMatches) consoleLogCount += consoleMatches.length;
  }

  // Components >400 lines (only .tsx, not tests)
  if (file.endsWith('.tsx') && !isTestFile && lineCount > 400) {
    largeComponents++;
  }

  // Track file sizes for top 5
  fileSizes.push({ rel, lines: lineCount });
}

// Sort by line count descending and take top 5
fileSizes.sort((a, b) => b.lines - a.lines);
const top5 = fileSizes.slice(0, 5);

table(
  ['Métrica', 'Quantidade'],
  [
    ['TODO comments', String(todoCount)],
    ['FIXME comments', String(fixmeCount)],
    ['HACK comments', String(hackCount)],
    ['console.log em src/ (excl. testes)', String(consoleLogCount)],
    ['Componentes >400 linhas', String(largeComponents)],
  ]
);

line('\n**Top 5 maiores arquivos:**');
top5.forEach((f, i) => {
  line(`${i + 1}. \`${f.rel}\` — ${f.lines} linhas`);
});

// ─── 10. Tendências ─────────────────────────────────────────

h2('10. Tendências');

const reportPath = join(ROOT, 'audit-periodic-report.md');
let previousScore: number | null = null;

if (existsSync(reportPath)) {
  try {
    const previousReport = readFileSync(reportPath, 'utf-8');
    const scoreMatch = previousReport.match(/\*\*Score:\s*(\d+)%/);
    if (scoreMatch) {
      previousScore = parseInt(scoreMatch[1], 10);
    }
  } catch {
    /* */
  }
}

// ─── Score Final ────────────────────────────────────────────

h2('Score de Compliance');

const totalChecks = 14;
let passed = 0;
// Pipeline Health (5 novos)
if (buildResult.status === 'PASS') passed++;
if (tscResult.status === 'PASS') passed++;
if (lintResult.status === 'PASS') passed++;
if (npmAuditResult.total === 0) passed++;
if (rlsResult.count > 0) passed++;
// Compliance original (9)
if (brlIncorrect === 0) passed++;
if (hasErrorBoundaryLib && totalErrorBoundaryUsages >= pageFiles.length * 0.5) passed++;
if (totalLazyImports >= pageFiles.length * 0.5) passed++;
if (securityIssues.length === 0) passed++;
if (mutationsWithoutInvalidate === 0) passed++;
if (useEffectFetches === 0) passed++;
if (externalStateLibs === 0) passed++;
if (testFiles.length > 0) passed++;
if (consoleLogCount < 10) passed++;

const score = Math.round((passed / totalChecks) * 100);

line(`\n**Score: ${score}% (${passed}/${totalChecks} checks passando)**\n`);

// Show trend
if (previousScore !== null) {
  const delta = score - previousScore;
  const deltaStr = delta >= 0 ? `+${delta}` : String(delta);
  line(`**Score anterior:** ${previousScore}% → **Score atual:** ${score}% (${deltaStr})`);
} else {
  line('**Primeiro relatório — sem histórico**');
}

line('');
line(
  score >= 80
    ? '✅ Projeto em boa forma para MVP'
    : score >= 50
      ? '⚠️ Melhorias necessárias antes de release'
      : '❌ Compliance crítico — priorizar correções'
);

// ─── Salvar ─────────────────────────────────────────────────

const reportContent = report.join('\n');
writeFileSync('audit-periodic-report.md', reportContent);
console.log(reportContent);
console.log('\n📄 Relatório salvo em audit-periodic-report.md');
