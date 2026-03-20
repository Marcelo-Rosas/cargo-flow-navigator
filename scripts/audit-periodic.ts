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
    return execSync(cmd, { encoding: 'utf-8', cwd: ROOT, timeout: 30000 }).trim();
  } catch {
    return '(falhou)';
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

// ─── 1. Estrutura do Projeto ────────────────────────────────

h1('Auditoria Periódica — Cargo Flow Navigator');
line(`**Data:** ${new Date().toISOString().split('T')[0]}`);
line(`**Branch:** ${runCmd('git branch --show-current')}`);
line(`**Último commit:** ${runCmd('git log -1 --format="%h %s"')}`);

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
let errorBoundaryUsages = 0;

for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf-8');
  if (content.includes('react-error-boundary')) hasErrorBoundaryLib = true;
  if (content.includes('ErrorBoundary') || content.includes('errorBoundary')) errorBoundaryUsages++;
}

line(`**Library instalada:** ${hasErrorBoundaryLib ? '✅ sim' : '❌ não'}`);
line(`**Componentes com error boundary:** ${errorBoundaryUsages}`);
line(
  `**Páginas sem error boundary:** ${pageFiles.length - errorBoundaryUsages} de ${pageFiles.length}`
);
if (!hasErrorBoundaryLib) {
  line('\n⚠️ **Recomendação:** `npm install react-error-boundary`');
}

// ─── 4. Code Splitting ──────────────────────────────────────

h2('4. Code Splitting / Lazy Loading');

let lazyImports = 0;
let suspenseUsages = 0;

for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf-8');
  if (content.includes('React.lazy') || content.includes('lazy(() =>')) lazyImports++;
  if (content.includes('<Suspense')) suspenseUsages++;
}

line(`**React.lazy imports:** ${lazyImports}`);
line(`**Suspense wrappers:** ${suspenseUsages}`);
line(`**Páginas total:** ${pageFiles.length}`);
if (lazyImports < pageFiles.length) {
  line(`\n⚠️ **Recomendação:** ${pageFiles.length - lazyImports} páginas sem lazy loading`);
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

for (const file of [...tsxFiles, ...tsFiles]) {
  const content = readFileSync(file, 'utf-8');
  const rel = relative(ROOT, file);

  // Mutations sem invalidate
  const mutationMatches = content.match(/useMutation/g);
  if (mutationMatches) {
    const blocks = content.split('useMutation');
    blocks.slice(1).forEach((block) => {
      const chunk = block.substring(0, 500);
      if (!chunk.includes('invalidateQueries') && !chunk.includes('invalidate')) {
        mutationsWithoutInvalidate++;
      }
    });
  }

  // useEffect com fetch
  if (
    content.includes('useEffect') &&
    (content.includes('fetch(') || content.includes('supabase.from('))
  ) {
    useEffectFetches++;
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

// ─── Score Final ────────────────────────────────────────────

h2('Score de Compliance');

const totalChecks = 8;
let passed = 0;
if (brlIncorrect === 0) passed++;
if (hasErrorBoundaryLib && errorBoundaryUsages >= pageFiles.length * 0.5) passed++;
if (lazyImports >= pageFiles.length * 0.5) passed++;
if (securityIssues.length === 0) passed++;
if (mutationsWithoutInvalidate === 0) passed++;
if (useEffectFetches === 0) passed++;
if (externalStateLibs === 0) passed++;
if (testFiles.length > 0) passed++;

const score = Math.round((passed / totalChecks) * 100);

line(`\n**Score: ${score}% (${passed}/${totalChecks} checks passando)**\n`);
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
