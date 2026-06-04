/**
 * Smoke de integração local: PDF contrato (Deno) + PDF ordem de coleta (Node).
 * Grava métricas em scripts/smoke-run-metrics.json.
 *
 *   npx tsx scripts/smoke-integration.ts
 *   npx tsx scripts/smoke-integration.ts --real   # company_settings do Supabase
 *   npx tsx scripts/smoke-integration.ts --report # gera scripts/SETUP_REPORT.md
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupEnvironment, checkHealth } from './integration-health.ts';

const useReal = process.argv.includes('--real');
const writeReport = process.argv.includes('--report');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface StepResult {
  name: string;
  ok: boolean;
  duration_sec: number;
  detail?: string;
}

function run(cmd: string, args: string[], cwd = repoRoot): StepResult {
  const name = `${cmd} ${args.join(' ')}`.trim();
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  return {
    name,
    ok: r.status === 0,
    duration_sec: Math.round(((Date.now() - t0) / 1000) * 10) / 10,
  };
}

function assertFile(path: string, minBytes: number): StepResult {
  const t0 = Date.now();
  if (!existsSync(path)) {
    return {
      name: `assert ${path}`,
      ok: false,
      duration_sec: 0,
      detail: 'arquivo não encontrado',
    };
  }
  const size = statSync(path).size;
  const ok = size >= minBytes;
  return {
    name: `assert ${path}`,
    ok,
    duration_sec: Math.round(((Date.now() - t0) / 1000) * 10) / 10,
    detail: `${size} bytes (mín ${minBytes})`,
  };
}

async function main() {
  const started = Date.now();
  const steps: StepResult[] = [];

  const missing = setupEnvironment(useReal);
  if (missing.length > 0) {
    console.error('[smoke] Variáveis ausentes:', missing.join(', '));
    process.exit(1);
  }

  if (useReal) {
    const fetchStep = run('npx', ['tsx', 'scripts/fetch-company-settings-fixture.ts']);
    steps.push(fetchStep);
    if (!fetchStep.ok) process.exit(1);
  }

  const healthOk = await checkHealth();
  steps.push({
    name: 'integration-health',
    ok: healthOk,
    duration_sec: 0,
  });
  if (!healthOk) process.exit(1);

  const contractArgs = [
    'run',
    '-A',
    '--config',
    'supabase/functions/generate-contract-pdf/deno.json',
    'scripts/smoke-contract-pdf.ts',
  ];
  if (useReal) contractArgs.push('--real');
  steps.push(run('deno', contractArgs));

  steps.push(run('npx', ['tsx', 'scripts/smoke-oc-pdf.ts']));

  const contractPdf = resolve(repoRoot, 'tests/smoke/contract/contract-smoke.pdf');
  const ocPdf = resolve(repoRoot, 'tests/smoke/oc/OC-SMOKE-2026-05-0001.pdf');
  const minContract = useReal ? 50_000 : 5_000;
  steps.push(assertFile(contractPdf, minContract));
  steps.push(assertFile(ocPdf, 5_000));

  const tempoTotal = Math.round(((Date.now() - started) / 1000) * 10) / 10;
  const allOk = steps.every((s) => s.ok);
  const veredito =
    allOk && tempoTotal < 120 ? 'GO' : allOk && tempoTotal < 180 ? 'AJUSTAR' : 'NO-GO';

  const metrics = {
    status: allOk ? 'done' : 'failed',
    tempo_execucao_segundos: tempoTotal,
    veredito,
    modo: useReal ? 'real' : 'mock',
    steps,
    artefatos: {
      contract_pdf: contractPdf,
      oc_pdf: ocPdf,
      company_fixture: useReal ? resolve(repoRoot, 'tests/fixtures/company-settings.json') : null,
    },
    gerado_em: new Date().toISOString(),
  };

  const metricsPath = resolve(repoRoot, 'scripts/smoke-run-metrics.json');
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), 'utf8');
  console.log(`\n[smoke] Métricas → ${metricsPath}`);
  console.log(`[smoke] Status: ${metrics.status} | ${tempoTotal}s | veredito: ${veredito}`);

  if (writeReport) {
    writeSetupReport(metrics, repoRoot);
  }

  process.exit(allOk ? 0 : 1);
}

function writeSetupReport(
  metrics: {
    status: string;
    tempo_execucao_segundos: number;
    veredito: string;
    modo: string;
    steps: StepResult[];
  },
  repoRoot: string
) {
  const nodeVersion = process.version;
  const report = `# Relatório de Setup — Cargo Flow Navigator

## Data: ${new Date().toLocaleString('pt-BR')}

## Execução do Smoke Test
- Status: ${metrics.status === 'done' ? 'SUCESSO' : 'FALHA'}
- Modo: ${metrics.modo}
- Tempo: ${metrics.tempo_execucao_segundos}s
- Veredito: ${metrics.veredito}

## Passos
${metrics.steps.map((s) => `- ${s.ok ? '✅' : '❌'} ${s.name}${s.detail ? ` (${s.detail})` : ''} — ${s.duration_sec}s`).join('\n')}

## Ambiente
- Node: ${nodeVersion}
- Deno: \`deno --version\` (requerido para smoke de contrato)
- Projeto Supabase: epgedaiukjippepujuzc (sa-east-1)

## Próximos Passos
1. Smoke com dados reais: \`npx tsx scripts/smoke-integration.ts --real --report\`
2. Contrato em produção: \`npx tsx scripts/generate-contract-by-code.ts COT-XXXX --force\`
3. Validação completa: \`npm run lint && npm run build\`
`;

  const reportPath = resolve(repoRoot, 'scripts/SETUP_REPORT.md');
  mkdirSync(resolve(repoRoot, 'scripts'), { recursive: true });
  writeFileSync(reportPath, report, 'utf8');
  console.log(`[smoke] Relatório → ${reportPath}`);
}

void main();
