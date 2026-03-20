#!/usr/bin/env npx tsx
/**
 * Cargo Flow Navigator — Auditoria de Compliance MVP
 *
 * Roda via: npx tsx scripts/audit-compliance.ts
 * Flags:
 *   --fix        Corrige automaticamente o que for possível
 *   --ci         Modo CI: exit code 1 se houver erros críticos
 *   --report     Gera relatório JSON em audit-report.json
 *   --category   Filtra por categoria: brl | imports | security | a11y | performance | all
 *
 * Exemplo:
 *   npx tsx scripts/audit-compliance.ts --ci --category=brl
 *   npx tsx scripts/audit-compliance.ts --report
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

// ─── Configuração ───────────────────────────────────────────
const SRC_DIR = join(process.cwd(), 'src');
const SUPABASE_DIR = join(process.cwd(), 'supabase');
const EXTENSIONS = ['.ts', '.tsx'];

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const CI_MODE = args.includes('--ci');
const REPORT_MODE = args.includes('--report');
const CATEGORY_FLAG = args.find((a) => a.startsWith('--category='));
const CATEGORY = CATEGORY_FLAG ? CATEGORY_FLAG.split('=')[1] : 'all';

// ─── Tipos ──────────────────────────────────────────────────
type Severity = 'error' | 'warning' | 'info';
type Category = 'brl' | 'imports' | 'security' | 'a11y' | 'performance' | 'architecture';

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

// --- BRL: Campos monetários ---
function auditBRL(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // toFixed sem Intl.NumberFormat para valores monetários
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
          'Valor monetário com toFixed() manual — usar Intl.NumberFormat ou formatCurrency()',
        code: line.trim(),
      });
    }

    // toFixed().replace('.', ',') — formatação manual
    if (line.includes('.toFixed(') && line.includes(".replace('.', ','") && line.includes('R$')) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'brl',
        severity: 'error',
        rule: 'brl/no-replace-decimal',
        message:
          'Formatação manual .toFixed().replace() para moeda — usar Intl.NumberFormat com locale pt-BR',
        code: line.trim(),
      });
    }

    // maximumFractionDigits: 0 em contexto monetário
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
          'Valor monetário sem casas decimais (maximumFractionDigits: 0) — BRL exige minimumFractionDigits: 2',
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
          'Intl.NumberFormat com BRL sem minimumFractionDigits explícito — adicionar minimumFractionDigits: 2',
        code: line.trim(),
      });
    }
  });
}

// --- Imports: Tipos e dependências ---
function auditImports(file: string, lines: string[]) {
  const relFile = relative(process.cwd(), file);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Importação direta do types.generated inteiro
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

    // Importação sem alias @/
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
          message: `Import relativo com ${depth} níveis — usar alias @/ para melhor legibilidade`,
          code: line.trim(),
        });
      }
    }
  });
}

// --- Security: Exposição de dados sensíveis ---
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

    // Chamada direta à Evolution API
    if (line.includes('8080') && line.includes('evolution') && !line.trimStart().startsWith('//')) {
      addFinding({
        file: relFile,
        line: lineNum,
        category: 'security',
        severity: 'error',
        rule: 'security/no-direct-evolution',
        message: 'Chamada direta à Evolution API — usar notification-hub Edge Function',
        code: line.trim(),
      });
    }

    // Console.log com dados sensíveis
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
        message: 'console.log com dados potencialmente sensíveis — remover antes de produção',
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
        message: 'Env var sem prefixo VITE_ — não será exposta no frontend pelo Vite',
        code: line.trim(),
      });
    }
  });
}

// --- Architecture: Padrões do projeto ---
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
          'Estado externo (Zustand/Redux/MobX) não permitido — usar TanStack Query + Context',
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
        message: 'Toast library incorreta — usar sonner (padrão do projeto)',
        code: line.trim(),
      });
    }

    // Mutation sem invalidateQueries
    if (line.includes('useMutation')) {
      const mutationBlock = lines.slice(i, Math.min(lines.length, i + 15)).join('\n');
      if (!mutationBlock.includes('invalidateQueries') && !mutationBlock.includes('invalidate')) {
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

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // useEffect com fetch
    if (
      line.includes('useEffect') &&
      lines
        .slice(i, Math.min(lines.length, i + 10))
        .some((l) => l.includes('fetch(') || l.includes('supabase.from(') || l.includes('.select('))
    ) {
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
  });
}

// ─── Executar Auditoria ─────────────────────────────────────

const allFiles = [...collectFiles(SRC_DIR), ...collectFiles(SUPABASE_DIR)];

const auditFunctions: Record<string, (file: string, lines: string[]) => void> = {
  brl: auditBRL,
  imports: auditImports,
  security: auditSecurity,
  architecture: auditArchitecture,
  performance: auditPerformance,
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

// ─── Relatório ──────────────────────────────────────────────

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
    ? '✅ COMPLIANCE OK — nenhum erro crítico encontrado'
    : `❌ ${errors.length} ERROS CRÍTICOS — corrigir antes de deploy`
);
console.log(`${'═'.repeat(60)}\n`);

// Exportar relatório JSON
if (REPORT_MODE) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      files_analyzed: allFiles.length,
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
    },
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
  writeFileSync('audit-report.json', JSON.stringify(report, null, 2));
  console.log('📄 Relatório salvo em audit-report.json\n');
}

// Exit code para CI
if (CI_MODE && errors.length > 0) {
  process.exit(1);
}
