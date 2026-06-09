#!/usr/bin/env npx tsx
/**
 * Provisiona datasets do Cloudflare Log Explorer (API v4).
 *
 * Requer token com permissões de logs (ex.: Account → Analytics → Edit, Logs → Edit).
 *
 * Uso:
 *   npx tsx scripts/cloudflare-log-explorer/provision-log-explorer.ts --dry-run
 *   CLOUDFLARE_API_TOKEN=xxx npx tsx scripts/cloudflare-log-explorer/provision-log-explorer.ts --apply
 *   npm run cf:log-explorer -- --list
 *
 * Env (qualquer um):
 *   CLOUDFLARE_API_TOKEN   — variável de ambiente
 *   .env.local             — CLOUDFLARE_API_TOKEN=cfut_... (gitignored)
 *   .cloudflare-api-token.local — uma linha com o token (gitignored)
 *   CLOUDFLARE_ACCOUNT_ID  — default: conta Vectra (auditoria 2026-05)
 *   CLOUDFLARE_ZONE_ID     — default: vectracargo.com.br
 */

import { CloudflareLogExplorerClient, classifyFailure, isAlreadyExistsError } from './client.ts';
import { printTokenHelp, resolveCloudflareLogExplorerToken } from './load-token.mjs';
import {
  DEFAULT_ACCOUNT_ID,
  DEFAULT_ZONE_ID,
  DEFAULT_ZONE_NAME,
  resolveDatasetPlan,
} from './vectra-defaults.ts';
import type { LogExplorerScope, ProvisionResult } from './types.ts';

const args = process.argv.slice(2);

const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');
const LIST = args.includes('--list');
const INCLUDE_OPTIONAL = args.includes('--include-optional');
const JSON_OUT = args.includes('--json');
const ONLY = argValue('--only')
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID ?? argValue('--account-id') ?? DEFAULT_ACCOUNT_ID;

const zoneId = process.env.CLOUDFLARE_ZONE_ID ?? argValue('--zone-id') ?? DEFAULT_ZONE_ID;

function argValue(flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=').slice(1).join('=');
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

function printHelp(): void {
  console.log(`
Cloudflare Log Explorer — provisionamento (Vectra defaults)

Flags:
  --dry-run            Mostra o plano sem chamar a API de escrita
  --apply              Cria datasets que ainda não existem
  --list               Lista datasets habilitados e disponíveis
  --include-optional   Inclui nel_reports e workers_trace_events
  --only <a,b>         Provisiona só estes datasets (ex.: access_requests)
  --json               Saída JSON (com --apply ou --list)
  --account-id <id>    Sobrescreve CLOUDFLARE_ACCOUNT_ID
  --zone-id <id>       Sobrescreve CLOUDFLARE_ZONE_ID
  --help               Esta ajuda

Defaults: account=${DEFAULT_ACCOUNT_ID}, zone=${DEFAULT_ZONE_NAME} (${DEFAULT_ZONE_ID})
`);
}

async function main(): Promise<void> {
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(args.includes('--help') ? 0 : 1);
  }

  if (!DRY_RUN && !APPLY && !LIST) {
    console.error('Informe --dry-run, --apply ou --list');
    process.exit(1);
  }

  const plan = resolveDatasetPlan(INCLUDE_OPTIONAL).filter(
    (d) => !ONLY?.length || ONLY.includes(d.dataset)
  );

  if (ONLY?.length && plan.length === 0) {
    console.error(`Nenhum dataset do plano corresponde a --only=${ONLY.join(',')}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    const output = {
      account_id: accountId,
      zone_id: zoneId,
      zone_name: DEFAULT_ZONE_NAME,
      mode: 'dry-run',
      datasets: plan,
    };
    if (JSON_OUT) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('Plano Log Explorer (dry-run)\n');
      console.table(
        plan.map((d) => ({
          dataset: d.dataset,
          scope: d.scope,
          priority: d.priority,
          service: d.service,
        }))
      );
      console.log(
        `\nPara aplicar: CLOUDFLARE_API_TOKEN=<token> npm run cf:log-explorer -- --apply`
      );
    }
    return;
  }

  const token =
    process.env.CLOUDFLARE_API_TOKEN?.trim() || (await resolveCloudflareLogExplorerToken());
  if (!token) {
    printTokenHelp();
    process.exit(1);
  }

  const client = new CloudflareLogExplorerClient(token);

  if (LIST) {
    const [accountDatasets, zoneDatasets, accountAvailable, zoneAvailable] = await Promise.all([
      client.listAccountDatasets(accountId, true),
      client.listZoneDatasets(zoneId),
      client.listAvailableAccountDatasets(accountId).catch(() => [] as string[]),
      client.listAvailableZoneDatasets(zoneId).catch(() => [] as string[]),
    ]);

    const payload = {
      account_id: accountId,
      zone_id: zoneId,
      enabled: {
        account: accountDatasets,
        zone: zoneDatasets,
      },
      available: {
        account: accountAvailable,
        zone: zoneAvailable,
      },
      recommended: plan.map((d) => d.dataset),
    };

    if (JSON_OUT) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log('Habilitados (conta, incl. zonas):');
      console.table(
        accountDatasets.map((d) => ({
          dataset: d.dataset,
          scope: d.object_type,
          enabled: d.enabled,
          object_id: d.object_id,
        }))
      );
      console.log('\nHabilitados (zona):');
      console.table(
        zoneDatasets.map((d) => ({
          dataset: d.dataset,
          enabled: d.enabled,
        }))
      );
    }
    return;
  }

  // --apply
  const existingAccount = new Set(
    (await client.listAccountDatasets(accountId, false)).map((d) => d.dataset)
  );
  const existingZone = new Set((await client.listZoneDatasets(zoneId)).map((d) => d.dataset));

  const results: ProvisionResult[] = [];

  for (const spec of plan) {
    const exists =
      spec.scope === 'account' ? existingAccount.has(spec.dataset) : existingZone.has(spec.dataset);

    if (exists) {
      results.push({
        dataset: spec.dataset,
        scope: spec.scope,
        status: 'skipped',
        message: 'Já provisionado',
      });
      continue;
    }

    try {
      if (spec.scope === 'account') {
        await client.createAccountDataset(accountId, spec.dataset);
        existingAccount.add(spec.dataset);
      } else {
        await client.createZoneDataset(zoneId, spec.dataset);
        existingZone.add(spec.dataset);
      }
      results.push({
        dataset: spec.dataset,
        scope: spec.scope,
        status: 'created',
        message: 'Criado com sucesso',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isAlreadyExistsError(message)) {
        results.push({
          dataset: spec.dataset,
          scope: spec.scope,
          status: 'skipped',
          message: 'Já existe (409)',
        });
      } else {
        results.push({
          dataset: spec.dataset,
          scope: spec.scope,
          status: 'failed',
          message,
        });
      }
    }
  }

  const failed = results.filter((r) => r.status === 'failed');
  const created = results.filter((r) => r.status === 'created');
  const skipped = results.filter((r) => r.status === 'skipped');

  const failureHints = failed.map((f) => ({
    dataset: f.dataset,
    kind: classifyFailure(f.message),
    message: f.message,
  }));

  if (JSON_OUT) {
    console.log(
      JSON.stringify(
        {
          account_id: accountId,
          zone_id: zoneId,
          summary: { created: created.length, skipped: skipped.length, failed: failed.length },
          results,
          failure_hints: failureHints,
        },
        null,
        2
      )
    );
  } else {
    console.log('Resultado do provisionamento:\n');
    console.table(results);
    console.log(
      `\nResumo: ${created.length} criado(s), ${skipped.length} já existente(s), ${failed.length} falha(s).`
    );
    if (failed.length > 0) {
      for (const f of failureHints) {
        if (f.kind === 'unsupported') {
          console.warn(
            `• ${f.dataset}: dataset não disponível neste plano/conta — ignore ou use alternativa (ex.: wrangler observability).`
          );
        } else if (f.kind === 'internal') {
          console.warn(
            `• ${f.dataset}: erro interno da Cloudflare — tente novamente em alguns minutos ou habilite no dashboard.`
          );
        } else if (f.kind === 'auth') {
          const hint = /9106/.test(f.message)
            ? ' (verifique espaços no início/fim do token ao colar no PowerShell)'
            : '';
          console.error(`• ${f.dataset}: token inválido ou sem permissão${hint}.`);
        } else {
          console.warn(`• ${f.dataset}: ${f.message}`);
        }
      }
    }
  }

  const authFailures = failureHints.filter((f) => f.kind === 'auth');
  process.exit(authFailures.length > 0 ? 1 : failed.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
