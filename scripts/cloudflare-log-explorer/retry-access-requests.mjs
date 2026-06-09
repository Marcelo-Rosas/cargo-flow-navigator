/**
 * Retry access_requests sem expor token na linha de comando.
 * Uso: CLOUDFLARE_API_TOKEN=... node scripts/cloudflare-log-explorer/retry-access-requests.mjs
 */
import { CloudflareLogExplorerClient, classifyFailure } from './client.ts';
import { DEFAULT_ACCOUNT_ID } from './vectra-defaults.ts';

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error('Defina CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
const client = new CloudflareLogExplorerClient(token);

const existing = await client.listAccountDatasets(accountId, false);
if (existing.some((d) => d.dataset === 'access_requests')) {
  console.log(JSON.stringify({ status: 'skipped', message: 'access_requests já provisionado' }));
  process.exit(0);
}

try {
  const result = await client.createAccountDataset(accountId, 'access_requests');
  console.log(
    JSON.stringify({
      status: 'created',
      dataset: result.dataset,
      dataset_id: result.dataset_id,
      enabled: result.enabled,
    })
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(
    JSON.stringify({
      status: 'failed',
      kind: classifyFailure(message),
      message,
    })
  );
  process.exit(2);
}
