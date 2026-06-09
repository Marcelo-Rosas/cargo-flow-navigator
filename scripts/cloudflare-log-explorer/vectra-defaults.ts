import type { LogExplorerDatasetSpec } from './types.ts';

/** Conta Vectra (inventário 2026-05-26). Sobrescreva via env. */
export const DEFAULT_ACCOUNT_ID = '361e9e1383bfa8e95e1db54e6c2a3bba';

/** Zona vectracargo.com.br */
export const DEFAULT_ZONE_ID = 'ab3194eaa570c46a0dcb3c7a91062c77';

export const DEFAULT_ZONE_NAME = 'vectracargo.com.br';

/** Datasets recomendados após auditoria da conta (Log Explorer). */
export const VECTRA_RECOMMENDED_DATASETS: LogExplorerDatasetSpec[] = [
  {
    dataset: 'audit_logs',
    scope: 'account',
    priority: 'critical',
    service: 'Conta Cloudflare',
    justification: 'Auditoria de mudanças (Pages, Workers, WAF, Access)',
  },
  {
    dataset: 'access_requests',
    scope: 'account',
    priority: 'critical',
    service: 'Cloudflare Access',
    justification: '2 apps Access (cargo-flow previews + workers.dev)',
  },
  {
    dataset: 'workers_trace_events',
    scope: 'account',
    priority: 'optional',
    service: 'Workers / Pages workers',
    justification:
      'Requer plano/entitlement compatível (Free retorna 400 unsupported). Alternativa: observability.logs no wrangler.toml + wrangler tail',
  },
  {
    dataset: 'http_requests',
    scope: 'zone',
    priority: 'critical',
    service: 'Pages / HTTP',
    justification: 'Tráfego web (app.vectracargo.com.br e demais hosts na zona)',
  },
  {
    dataset: 'firewall_events',
    scope: 'zone',
    priority: 'critical',
    service: 'WAF / DDoS L7',
    justification: 'Managed Free Ruleset + DDoS ativos na zona',
  },
  {
    dataset: 'dns_logs',
    scope: 'zone',
    priority: 'high',
    service: 'DNS Cloudflare',
    justification: 'Zona full com nameservers Cloudflare',
  },
  {
    dataset: 'nel_reports',
    scope: 'zone',
    priority: 'optional',
    service: 'Network Error Logging',
    justification: 'Diagnóstico de conectividade no browser (opcional)',
  },
];

export function resolveDatasetPlan(includeOptional: boolean): LogExplorerDatasetSpec[] {
  return VECTRA_RECOMMENDED_DATASETS.filter((d) => includeOptional || d.priority !== 'optional');
}
