#!/usr/bin/env npx tsx
/**
 * Cargo Flow Navigator — Auditoria de Compliance MVP
 *
 * Roda via: npx tsx scripts/audit-compliance.ts
 * Flags:
 *   --fix        Corrige automaticamente o que for possivel
 *   --ci         Modo CI: exit code 1 se houver erros criticos
 *   --report     Gera relatorio JSON em audit-report.json
 *   --category   Filtra por categoria: brl | imports | security | architecture | performance | hygiene | a11y | all
 *   --history    Compara com audit-report.json anterior e mostra delta
 *
 * Exemplo:
 *   npx tsx scripts/audit-compliance.ts --ci --category=brl
 *   npx tsx scripts/audit-compliance.ts --report --history
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

// ─── Configuracao ───────────────────────────────────────────
const SRC_DIR = join(process.cwd(), 'src');
const SUPABASE_DIR = join(process.cwd(), 'supabase');
const EXTENSIONS = ['.ts', '.tsx'];
const REPORT_FILE = 'audit-report.json';

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const CI_MODE = args.includes('--ci');
const REPORT_MODE = args.includes('--report');
const HISTORY_MODE = args.includes('--history');
const CATEGORY_FLAG = args.find((a) => a.startsWith('--category='));
const CATEGORY = CATEGORY_FLAG ? CATEGORY_FLAG.split('=')[1] : 'all';

// ─── Tipos ──────────────────────────────────────────────────
type Severity = 'error' | 'warning' | 'info';
type Category =
  | 'brl'
  | 'imports'
  | 'security'
  | 'a11y'
  | 'performance'
  | 'architecture'
  | 'hygiene';

interface Finding {
  file: string;
  line: number;
  category: Category;
  severity: Severity;
  rule: string;
  message: string;
  code: string;
  fix?: string;
}

interface PreviousReport {
  timestamp: string;
  summary: {
    files_analyzed: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  by_rule: Record<string, number>;
}

// ─── Coletar arquivos ───────────────────────────────────────
function collectFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!['node_modules', 'dist', '.vite', 'coverage'].includes(entry)) {
          files.push(...collectFiles(full));
        }
      } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        files.push(full);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

// ─── Regras de Auditoria ────────────────────────────────────

const findings: Finding[] = [];

function addFinding(f: Omit<Finding, 'file' | 'line'> & { file: string; line: number }) {
  findings.push(f as Finding);
}

// --- BRL: Campos monetarios ---
function auditBRL(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // toFixed sem Intl.NumberFormat para valores monetarios
    if (
      line.includes('R$') &&
      line.includes('toFixed') &&
      !line.includes('toLocaleString') &&
      !line.includes('Intl.NumberFormat')
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'brl',
        severity: 'error',
        rule: 'brl/no-manual-format',
        message:
          'Valor monetario com toFixed() manual — usar Intl.NumberFormat ou formatCurrency()',
        code: line.trim(),
      });
    }

    // toFixed().replace('.', ',') — formatacao manual
    if (line.includes('.toFixed(') && line.includes(".replace('.', ','") && line.includes('R$')) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'brl',
        severity: 'error',
        rule: 'brl/no-replace-decimal',
        message:
          'Formatacao manual .toFixed().replace() para moeda — usar Intl.NumberFormat com locale pt-BR',
        code: line.trim(),
      });
    }

    // maximumFractionDigits: 0 em contexto monetario
    if (
      line.includes('maximumFractionDigits: 0') &&
      (line.includes('R$') ||
        lines
          .slice(Math.max(0, i - 3), i)
          .some(
            (l) =>
              l.includes('R$') ||
              l.includes('savings') ||
              l.includes('cost') ||
              l.includes('value') ||
              l.includes('total')
          ))
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'brl',
        severity: 'error',
        rule: 'brl/require-two-decimals',
        message:
          'Valor monetario sem casas decimais (maximumFractionDigits: 0) — BRL exige minimumFractionDigits: 2',
        code: line.trim(),
      });
    }

    // Intl.NumberFormat sem minimumFractionDigits para BRL
    if (
      line.includes("currency: 'BRL'") &&
      !line.includes('minimumFractionDigits') &&
      !lines
        .slice(i, Math.min(lines.length, i + 3))
        .some((l) => l.includes('minimumFractionDigits'))
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'brl',
        severity: 'warning',
        rule: 'brl/explicit-fraction-digits',
        message:
          'Intl.NumberFormat com BRL sem minimumFractionDigits explicito — adicionar minimumFractionDigits: 2',
        code: line.trim(),
      });
    }
  });
}

// --- Imports: Tipos e dependencias ---
function auditImports(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Importacao direta do types.generated inteiro
    if (line.includes("from '@/integrations/supabase/types.generated'") && !line.includes('type')) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'imports',
        severity: 'warning',
        rule: 'imports/use-type-import',
        message:
          'Importar tipos com "import type" para evitar carregar o arquivo inteiro em runtime',
        code: line.trim(),
      });
    }

    // Importacao sem alias @/
    if (
      (line.includes("from '../") ||
        line.includes("from '../../") ||
        line.includes("from '../../../")) &&
      file.includes('/src/')
    ) {
      const depth = (line.match(/\.\.\//g) || []).length;
      if (depth >= 3) {
        addFinding({
          file: relFile,
          line: lineNum,
          category: 'imports',
          severity: 'warning',
          rule: 'imports/use-alias',
          message: `Import relativo com ${depth} niveis — usar alias @/ para melhor legibilidade`,
          code: line.trim(),
        });
      }
    }
  });
}

// --- Security: Exposicao de dados sensiveis ---
function auditSecurity(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Service Role Key no frontend
    if (
      line.includes('service_role') &&
      file.includes('/src/') &&
      !line.trimStart().startsWith('//')
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'security',
        severity: 'error',
        rule: 'security/no-service-role-frontend',
        message: 'Service Role Key detectada no frontend — APENAS em Edge Functions',
        code: line.trim(),
      });
    }

    // Chamada direta a Evolution API
    if (line.includes('8080') && line.includes('evolution') && !line.trimStart().startsWith('//')) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'security',
        severity: 'error',
        rule: 'security/no-direct-evolution',
        message: 'Chamada direta a Evolution API — usar notification-hub Edge Function',
        code: line.trim(),
      });
    }

    // Console.log com dados sensiveis
    if (
      line.includes('console.log') &&
      (line.includes('password') ||
        line.includes('token') ||
        line.includes('secret') ||
        line.includes('key'))
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'security',
        severity: 'error',
        rule: 'security/no-log-sensitive',
        message: 'console.log com dados potencialmente sensiveis — remover antes de producao',
        code: line.trim(),
      });
    }

    // Env var sem VITE_ no frontend
    if (
      file.includes('/src/') &&
      line.includes('process.env.') &&
      !line.includes('VITE_') &&
      !line.trimStart().startsWith('//')
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'security',
        severity: 'warning',
        rule: 'security/vite-env-prefix',
        message: 'Env var sem prefixo VITE_ — nao sera exposta no frontend pelo Vite',
        code: line.trim(),
      });
    }
  });
}

// --- Architecture: Padroes do projeto ---
function auditArchitecture(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // useState para dados do servidor
    if (
      line.includes('useState') &&
      lines
        .slice(i, Math.min(lines.length, i + 5))
        .some((l) => l.includes('fetch(') || l.includes('supabase.from(') || l.includes('.select('))
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'architecture',
        severity: 'warning',
        rule: 'arch/use-tanstack-query',
        message: 'useState com fetch/supabase — usar useQuery do TanStack Query para server state',
        code: line.trim(),
      });
    }

    // Zustand, Redux, MobX
    if (
      line.includes("from 'zustand'") ||
      line.includes("from 'redux'") ||
      line.includes("from '@reduxjs'") ||
      line.includes("from 'mobx'")
    ) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'architecture',
        severity: 'error',
        rule: 'arch/no-external-state',
        message:
          'Estado externo (Zustand/Redux/MobX) nao permitido — usar TanStack Query + Context',
        code: line.trim(),
      });
    }

    // react-hot-toast ou react-toastify
    if (line.includes("from 'react-hot-toast'") || line.includes("from 'react-toastify'")) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'architecture',
        severity: 'error',
        rule: 'arch/use-sonner',
        message: 'Toast library incorreta — usar sonner (padrao do projeto)',
        code: line.trim(),
      });
    }

    // Mutation sem invalidateQueries
    if (line.includes('useMutation')) {
      // Skip import statements
      if (line.includes("from '") || line.includes('from "')) {
        return;
      }
      // Skip type annotations (e.g. UseMutationResult, UseMutationOptions)
      if (!line.includes('useMutation(') && !line.includes('useMutation<')) {
        return;
      }

      const mutationBlock = lines.slice(i, Math.min(lines.length, i + 50)).join('\n');
      if (
        !mutationBlock.includes('invalidateQueries') &&
        !mutationBlock.includes('invalidate') &&
        !mutationBlock.includes('queryClient.setQueryData')
      ) {
        addFinding({
          file: relFile,
          line: lineNum,
          category: 'architecture',
          severity: 'warning',
          rule: 'arch/invalidate-after-mutation',
          message: 'useMutation sem invalidateQueries — cache pode ficar desatualizado',
          code: line.trim(),
        });
      }
    }
  });
}

// --- Performance ---
function auditPerformance(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);
  const fullContent = lines.join('\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // useEffect com fetch
    if (line.includes('useEffect')) {
      const effectBlock = lines.slice(i, Math.min(lines.length, i + 10));
      const effectBlockStr = effectBlock.join('\n');

      const hasFetch = effectBlock.some(
        (l) => l.includes('fetch(') || l.includes('supabase.from(') || l.includes('.select(')
      );

      if (hasFetch) {
        // Skip if the effect block contains supabase.auth. (auth state management)
        if (effectBlockStr.includes('supabase.auth.')) {
          return;
        }
        // Skip if the file already imports useQuery (likely proper pattern coexisting)
        if (
          fullContent.includes('useQuery') &&
          (fullContent.includes("from '@tanstack") || fullContent.includes("from 'react-query"))
        ) {
          return;
        }

        addFinding({
          file: relFile,
          line: lineNum,
          category: 'performance',
          severity: 'warning',
          rule: 'perf/no-fetch-in-useeffect',
          message: 'Data fetching em useEffect — usar useQuery do TanStack Query',
          code: line.trim(),
        });
      }
    }
  });
}

// --- Hygiene: Code quality ---
function auditHygiene(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  // hygiene/no-console-log: only in src/ files, not in supabase/ dir
  if (file.includes('/src/') && !file.includes('/src/hooks/')) {
    lines.forEach((line, i) => {
      const lineNum = i + 1;
      const trimmed = line.trimStart();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return;
      }

      // Skip test files
      if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
        return;
      }

      if (line.includes('console.log(')) {
        addFinding({
          file: relFile,
          line: lineNum,
          category: 'hygiene',
          severity: 'warning',
          rule: 'hygiene/no-console-log',
          message: 'console.log() encontrado — remover antes de producao',
          code: line.trim(),
        });
      }
    });
  }

  // hygiene/large-component: .tsx files in components/ or pages/ with >400 lines
  if (
    file.endsWith('.tsx') &&
    (file.includes('/src/components/') || file.includes('/src/pages/'))
  ) {
    if (lines.length > 400) {
      addFinding({
        file: relFile,
        line: 1,
        category: 'hygiene',
        severity: 'info',
        rule: 'hygiene/large-component',
        message: `Componente com ${lines.length} linhas (>400) — considerar dividir em subcomponentes`,
        code: `${lines.length} lines`,
      });
    }
  }

  // hygiene/todo-fixme: Flag TODO, FIXME, HACK, XXX comments
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const match = line.match(/\b(TODO|FIXME|HACK|XXX)\b/);
    if (match) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'hygiene',
        severity: 'info',
        rule: 'hygiene/todo-fixme',
        message: `${match[1]} encontrado — resolver ou criar issue`,
        code: line.trim(),
      });
    }
  });

  // hygiene/duplicate-type-definition: type/interface matching Supabase table names
  const supabaseTableNames = [
    'quotes',
    'orders',
    'clients',
    'shippers',
    'vehicles',
    'drivers',
    'owners',
    'documents',
    'price_tables',
  ];

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trimStart();

    // Match "type Foo =" or "interface Foo {"
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)\s*=/);
    const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)\s*[{<]/);
    const name = typeMatch?.[1] || interfaceMatch?.[1];

    if (name) {
      const lowerName = name.toLowerCase().replace(/s$/, '');
      for (const tableName of supabaseTableNames) {
        const singularTable = tableName.replace(/s$/, '');
        if (
          lowerName === singularTable ||
          lowerName === tableName ||
          name.toLowerCase() === tableName
        ) {
          // Skip if it's in the types.generated file itself
          if (file.includes('types.generated')) {
            return;
          }
          addFinding({
            file: relFile,
            line: lineNum,
            category: 'hygiene',
            severity: 'warning',
            rule: 'hygiene/duplicate-type-definition',
            message: `Tipo "${name}" pode duplicar tabela Supabase "${tableName}" — usar tipos de types.generated`,
            code: trimmed.substring(0, 120),
          });
          break;
        }
      }
    }
  });
}

// --- A11y: Accessibility ---
function auditA11y(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  // Only check tsx files in src/
  if (!file.endsWith('.tsx') || !file.includes('/src/')) {
    return;
  }

  const fullContent = lines.join('\n');

  // a11y/img-no-alt: <img without alt=
  lines.forEach((line, i) => {
    const lineNum = i + 1;

    if (line.includes('<img') && !line.includes('alt=')) {
      // Check if alt= is on a subsequent line (multiline tag)
      const tagBlock = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
      // Find the closing > of the tag
      const closingIdx = tagBlock.indexOf('>');
      const tagContent = closingIdx >= 0 ? tagBlock.substring(0, closingIdx) : tagBlock;

      if (!tagContent.includes('alt=')) {
        addFinding({
          file: relFile,
          line: lineNum,
          category: 'a11y',
          severity: 'warning',
          rule: 'a11y/img-no-alt',
          message: '<img> sem atributo alt — adicionar alt para acessibilidade',
          code: line.trim(),
        });
      }
    }
  });

  // a11y/button-no-label: <Button with size="icon" but no aria-label
  // Use multiline matching on full content
  const buttonIconRegex = /<Button[^>]*size=["']icon["'][^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = buttonIconRegex.exec(fullContent)) !== null) {
    const tagContent = match[0];
    if (!tagContent.includes('aria-label')) {
      // Calculate line number
      const upToMatch = fullContent.substring(0, match.index);
      const lineNum = upToMatch.split('\n').length;
      const matchLine = lines[lineNum - 1] || '';

      addFinding({
        file: relFile,
        line: lineNum,
        category: 'a11y',
        severity: 'warning',
        rule: 'a11y/button-no-label',
        message: '<Button size="icon"> sem aria-label — adicionar aria-label para acessibilidade',
        code: matchLine.trim(),
      });
    }
  }

  // Also check for cases where size="icon" might appear before or after other props
  // across multiple lines
  const multilineButtonRegex = /<Button\s[\s\S]*?>/g;
  let mlMatch: RegExpExecArray | null;
  while ((mlMatch = multilineButtonRegex.exec(fullContent)) !== null) {
    const tagContent = mlMatch[0];
    if (tagContent.includes('size="icon"') || tagContent.includes("size='icon'")) {
      if (!tagContent.includes('aria-label')) {
        const upToMatch = fullContent.substring(0, mlMatch.index);
        const lineNum = upToMatch.split('\n').length;
        const matchLine = lines[lineNum - 1] || '';

        // Avoid duplicate findings on the same line (from the single-line regex above)
        const alreadyFound = findings.some(
          (f) => f.file === relFile && f.line === lineNum && f.rule === 'a11y/button-no-label'
        );
        if (!alreadyFound) {
          addFinding({
            file: relFile,
            line: lineNum,
            category: 'a11y',
            severity: 'warning',
            rule: 'a11y/button-no-label',
            message:
              '<Button size="icon"> sem aria-label — adicionar aria-label para acessibilidade',
            code: matchLine.trim(),
          });
        }
      }
    }
  }
}

// ─── History comparison ─────────────────────────────────────
function loadPreviousReport(): PreviousReport | null {
  const reportPath = join(process.cwd(), REPORT_FILE);
  if (!existsSync(reportPath)) {
    return null;
  }
  try {
    const content = readFileSync(reportPath, 'utf-8');
    return JSON.parse(content) as PreviousReport;
  } catch {
    return null;
  }
}

// ─── Executar Auditoria ─────────────────────────────────────

const previousReport = HISTORY_MODE ? loadPreviousReport() : null;

const allFiles = [...collectFiles(SRC_DIR), ...collectFiles(SUPABASE_DIR)];

const auditFunctions: Record<string, (file: string, lines: string[]) => void> = {
  brl: auditBRL,
  imports: auditImports,
  security: auditSecurity,
  architecture: auditArchitecture,
  performance: auditPerformance,
  hygiene: auditHygiene,
  a11y: auditA11y,
};

for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  if (CATEGORY === 'all') {
    Object.values(auditFunctions).forEach((fn) => fn(file, lines));
  } else if (auditFunctions[CATEGORY]) {
    auditFunctions[CATEGORY](file, lines);
  }
}

// ─── Relatorio ──────────────────────────────────────────────

const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warning');
const infos = findings.filter((f) => f.severity === 'info');

// Agrupar por categoria
const byCategory = findings.reduce(
  (acc, f) => {
    acc[f.category] = acc[f.category] || [];
    acc[f.category].push(f);
    return acc;
  },
  {} as Record<string, Finding[]>
);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║       CARGO FLOW NAVIGATOR — AUDITORIA DE COMPLIANCE       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log(`📁 Arquivos analisados: ${allFiles.length}`);
console.log(`🔴 Erros:    ${errors.length}`);
console.log(`🟡 Warnings: ${warnings.length}`);
console.log(`🔵 Info:     ${infos.length}`);
console.log('');

// History comparison output
if (HISTORY_MODE && previousReport) {
  const deltaErrors = errors.length - previousReport.summary.errors;
  const deltaWarnings = warnings.length - previousReport.summary.warnings;
  const deltaInfos = infos.length - previousReport.summary.infos;

  console.log('── COMPARACAO COM EXECUCAO ANTERIOR ──');
  console.log(`   Anterior: ${previousReport.timestamp}`);

  const formatDelta = (delta: number, label: string) => {
    if (delta === 0) return `   ${label}: sem alteracao`;
    if (delta < 0) return `   ${label}: ${Math.abs(delta)} fewer than last run`;
    return `   ${label}: ${delta} more than last run`;
  };

  console.log(formatDelta(deltaErrors, 'Erros'));
  console.log(formatDelta(deltaWarnings, 'Warnings'));
  console.log(formatDelta(deltaInfos, 'Info'));
  console.log('');
} else if (HISTORY_MODE && !previousReport) {
  console.log('── HISTORICO: nenhum audit-report.json anterior encontrado ──\n');
}

for (const [category, items] of Object.entries(byCategory)) {
  const catErrors = items.filter((i) => i.severity === 'error').length;
  const catWarnings = items.filter((i) => i.severity === 'warning').length;
  console.log(`\n── ${category.toUpperCase()} (${catErrors} erros, ${catWarnings} warnings) ──`);

  for (const item of items) {
    const icon = item.severity === 'error' ? '🔴' : item.severity === 'warning' ? '🟡' : '🔵';
    console.log(`  ${icon} ${item.file}:${item.line}`);
    console.log(`     ${item.rule}: ${item.message}`);
    console.log(`     > ${item.code.substring(0, 100)}`);
  }
}

// Resumo por regra
console.log('\n── RESUMO POR REGRA ──');
const byRule = findings.reduce(
  (acc, f) => {
    acc[f.rule] = (acc[f.rule] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);
for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}x ${rule}`);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(
  errors.length === 0
    ? '✅ COMPLIANCE OK — nenhum erro critico encontrado'
    : `❌ ${errors.length} ERROS CRITICOS — corrigir antes de deploy`
);
console.log(`${'═'.repeat(60)}\n`);

// Exportar relatorio JSON
if (REPORT_MODE) {
  const previousComparison =
    HISTORY_MODE && previousReport
      ? {
          previous_timestamp: previousReport.timestamp,
          delta_errors: errors.length - previousReport.summary.errors,
          delta_warnings: warnings.length - previousReport.summary.warnings,
          delta_infos: infos.length - previousReport.summary.infos,
          previous_by_rule: previousReport.by_rule,
        }
      : undefined;

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      files_analyzed: allFiles.length,
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
    },
    ...(previousComparison ? { previous_comparison: previousComparison } : {}),
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([cat, items]) => [
        cat,
        {
          errors: items.filter((i) => i.severity === 'error').length,
          warnings: items.filter((i) => i.severity === 'warning').length,
          items,
        },
      ])
    ),
    by_rule: byRule,
    findings,
  };
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log('📄 Relatorio salvo em audit-report.json\n');
}

// Exit code para CI
if (CI_MODE && errors.length > 0) {
  process.exit(1);
}
