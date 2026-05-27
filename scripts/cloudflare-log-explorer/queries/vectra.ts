export interface LogExplorerQueryPreset {
  id: string;
  title: string;
  description: string;
  scope: 'zone' | 'account';
  /** SQL para Log Explorer (campos PascalCase conforme docs Cloudflare) */
  sql: string;
}

/** Host principal do TMS */
export const APP_HOST = 'app.vectracargo.com.br';

export const VECTRA_LOG_QUERIES: LogExplorerQueryPreset[] = [
  {
    id: 'app-5xx',
    title: 'Erros 5xx — app.vectracargo.com.br',
    description:
      'Requisições com falha de servidor no TMS (últimas 24h implícito no filtro de tempo do explorer)',
    scope: 'zone',
    sql: `SELECT EdgeStartTimestamp, EdgeResponseStatus, ClientRequestMethod, ClientRequestURI, ClientIP, RayID
FROM http_requests
WHERE ClientRequestHost = '${APP_HOST}'
  AND EdgeResponseStatus >= 500
ORDER BY EdgeStartTimestamp DESC
LIMIT 50`,
  },
  {
    id: 'app-waf-blocks',
    title: 'Bloqueios WAF / challenges — app',
    description: 'IPs e URIs que dispararam ação de segurança',
    scope: 'zone',
    sql: `SELECT EdgeStartTimestamp, ClientIP, ClientRequestURI, SecurityAction, SecurityActions, RayID
FROM http_requests
WHERE ClientRequestHost = '${APP_HOST}'
  AND SecurityAction IS NOT NULL
  AND SecurityAction != 'unknown'
  AND SecurityAction != 'allow'
ORDER BY EdgeStartTimestamp DESC
LIMIT 50`,
  },
  {
    id: 'app-traffic-summary',
    title: 'Resumo de tráfego — app (por status)',
    description: 'Contagem de requisições por código HTTP',
    scope: 'zone',
    sql: `SELECT EdgeResponseStatus, COUNT(*) AS requests
FROM http_requests
WHERE ClientRequestHost = '${APP_HOST}'
GROUP BY EdgeResponseStatus
ORDER BY requests DESC
LIMIT 20`,
  },
  {
    id: 'app-slow-paths',
    title: 'Paths mais lentos (TTFB) — app',
    description: 'Endpoints com maior time-to-first-byte',
    scope: 'zone',
    sql: `SELECT ClientRequestPath, AVG(EdgeTimeToFirstByteMs) AS avg_ttfb_ms, COUNT(*) AS requests
FROM http_requests
WHERE ClientRequestHost = '${APP_HOST}'
GROUP BY ClientRequestPath
ORDER BY avg_ttfb_ms DESC
LIMIT 15`,
  },
  {
    id: 'firewall-events',
    title: 'Eventos de firewall (zona)',
    description: 'Ações do WAF na zona vectracargo.com.br',
    scope: 'zone',
    sql: `SELECT Datetime, Action, ClientIP, ClientRequestHost, RayID
FROM firewall_events
ORDER BY Datetime DESC
LIMIT 50`,
  },
  {
    id: 'audit-recent',
    title: 'Auditoria — mudanças recentes na conta',
    description: 'Quem alterou config (Pages, WAF, tokens, Log Explorer)',
    scope: 'account',
    sql: `SELECT ActionType, ActionResult, ActorEmail, ResourceType, When
FROM audit_logs
ORDER BY When DESC
LIMIT 30`,
  },
];

export function getQueryPreset(id: string): LogExplorerQueryPreset | undefined {
  return VECTRA_LOG_QUERIES.find((q) => q.id === id);
}
