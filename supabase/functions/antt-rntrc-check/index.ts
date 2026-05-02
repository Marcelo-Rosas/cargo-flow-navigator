/**
 * antt-rntrc-check
 * Consulta RNTRC via portal público ANTT (ConsultaRNTRC.aspx).
 * Fluxo: GET page → extract ViewState → solve ALTCHA PoW → POST UpdatePanel → parse delta.
 *
 * Quando a integração falha (portal fora, timeout, parsing impreciso), retorna
 * situacao='indeterminado' com HTTP 200 — nunca 500 — para não bloquear o wizard.
 * Timeout total: 25 segundos.
 */

const ANTT_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaRNTRC.aspx';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 25_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-api-key',
};

interface AnttRntrcCheckRequest {
  order_id: string;
  cpf_cnpj: string;
  vehicle_plate: string;
}

interface AnttRntrcCheckResponse {
  situacao: 'regular' | 'irregular' | 'indeterminado';
  rntrc?: string | null;
  message?: string;
  is_stub: boolean;
}

interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber?: number;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/** Creates an AbortSignal that fires after `ms` milliseconds. */
function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController();
  setTimeout(() => ac.abort(new DOMException(`Timeout after ${ms}ms`, 'TimeoutError')), ms);
  return ac.signal;
}

// ─── ASP.NET token extraction ────────────────────────────────────────────────

function extractHidden(html: string, id: string): string {
  const esc = id.replace(/[[\]$]/g, '\\$&');
  const m1 = html.match(new RegExp(`id="${esc}"[^>]*\\bvalue="([^"]*)"`, 'i'));
  if (m1) return m1[1];
  const m2 = html.match(new RegExp(`name="${esc}"[^>]*\\bvalue="([^"]*)"`, 'i'));
  if (m2) return m2[1];
  const m3 = html.match(new RegExp(`\\bvalue="([^"]*)"[^>]*\\bid="${esc}"`, 'i'));
  if (m3) return m3[1];
  return '';
}

// ─── ALTCHA proof-of-work (Web Crypto only — no node:crypto) ────────────────

async function solvePoW(
  salt: string,
  target: string,
  maxnumber = 1_000_000,
  signal?: AbortSignal
): Promise<number | null> {
  const enc = new TextEncoder();
  const cap = Math.min(maxnumber, 300_000);
  for (let n = 0; n <= cap; n++) {
    if (signal?.aborted) return null;
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(salt + String(n)));
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hex === target) return n;
  }
  return null;
}

function buildAltchaPayload(ch: AltchaChallenge, number: number): string {
  return btoa(
    JSON.stringify({
      algorithm: ch.algorithm,
      challenge: ch.challenge,
      number,
      salt: ch.salt,
      signature: ch.signature,
    })
  );
}

// ─── UpdatePanel delta parser ────────────────────────────────────────────────

function parseDelta(delta: string): Record<string, string> {
  const panels: Record<string, string> = {};
  let i = 0;
  while (i < delta.length) {
    const p1 = delta.indexOf('|', i);
    if (p1 < 0) break;
    const len = parseInt(delta.slice(i, p1), 10);
    if (isNaN(len)) break;
    i = p1 + 1;
    const p2 = delta.indexOf('|', i);
    if (p2 < 0) break;
    const type = delta.slice(i, p2);
    i = p2 + 1;
    const p3 = delta.indexOf('|', i);
    if (p3 < 0) break;
    const id = delta.slice(i, p3);
    i = p3 + 1;
    const content = delta.slice(i, i + len);
    i += len;
    if (i < delta.length && delta[i] === '|') i++;
    if (type === 'updatePanel') panels[id] = content;
  }
  return panels;
}

// ─── Result HTML parser ───────────────────────────────────────────────────────

function extractResult(html: string): {
  situacao: 'regular' | 'irregular' | 'indeterminado';
  rntrc: string | null;
} {
  const isRegular = /\b(regular|ativo|habilitado)\b/i.test(html);
  const isIrregular = /\b(irregular|inativo|cancelado|suspenso|impedido)\b/i.test(html);
  const noResult = /nenhum|n[aã]o.*encontrad|sem.*resultado|0.*registro/i.test(html);

  const rntrcMatch =
    html.match(/rntrc[^:>]{0,30}[:>]\s*(?:<[^>]*>)*\s*(\d{6,12})/i) ??
    html.match(/>\s*(\d{8,10})\s*</);
  const rntrc = rntrcMatch?.[1] ?? null;

  if (noResult) return { situacao: 'irregular', rntrc: null };
  if (isRegular && !isIrregular) return { situacao: 'regular', rntrc };
  if (isIrregular) return { situacao: 'irregular', rntrc };
  return { situacao: 'indeterminado', rntrc };
}

// ─── Main consultation flow ───────────────────────────────────────────────────

async function consultaAntt(cpfCnpj: string, signal: AbortSignal): Promise<AnttRntrcCheckResponse> {
  // 1. GET page — tokens + session cookies
  console.log('[antt-rntrc-check] GET page');
  const getRes = await fetch(ANTT_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal,
  });
  if (!getRes.ok) throw new Error(`ANTT GET ${getRes.status}`);

  const pageHtml = await getRes.text();
  const cookieHeader = (
    typeof (getRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie ===
    'function'
      ? ((getRes.headers as Headers & { getSetCookie: () => string[] }).getSetCookie() ?? [])
      : [getRes.headers.get('set-cookie') ?? ''].filter(Boolean)
  )
    .map((c: string) => c.split(';')[0])
    .join('; ');

  const viewState = extractHidden(pageHtml, '__VIEWSTATE');
  const viewStateGen = extractHidden(pageHtml, '__VIEWSTATEGENERATOR');
  const eventValidation = extractHidden(pageHtml, '__EVENTVALIDATION');
  const altchaUrl =
    extractHidden(pageHtml, 'ctl00$Corpo$hfAltchaUrl') ||
    extractHidden(pageHtml, 'Corpo_hfAltchaUrl') ||
    'https://captcha.srvs.antt.gov.br/altcha';

  if (!viewState) {
    throw new Error('ViewState não encontrado — estrutura da página pode ter mudado');
  }

  // 2. Fetch ALTCHA challenge
  console.log('[antt-rntrc-check] GET ALTCHA challenge from', altchaUrl);
  const challengeRes = await fetch(altchaUrl, {
    headers: { 'User-Agent': UA, Referer: ANTT_URL },
    signal,
  });
  if (!challengeRes.ok) throw new Error(`ALTCHA challenge ${challengeRes.status}`);
  const challenge: AltchaChallenge = await challengeRes.json();

  // 3. Solve proof-of-work
  console.log('[antt-rntrc-check] solving PoW maxnumber=', challenge.maxnumber);
  const n = await solvePoW(challenge.salt, challenge.challenge, challenge.maxnumber, signal);
  if (n === null) throw new Error('ALTCHA: solução PoW não encontrada no intervalo ou timeout');
  const altchaPayload = buildAltchaPayload(challenge, n);

  // 4. POST — UpdatePanel async
  console.log('[antt-rntrc-check] POST consulta cpfCnpj length=', cpfCnpj.length);
  const formBody = new URLSearchParams({
    ctl00$ScriptManagerMain: 'ctl00$ScriptManagerMain|ctl00$Corpo$btnConsulta',
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen,
    __EVENTVALIDATION: eventValidation,
    ctl00$bMostraAlerta: 'true',
    ctl00$Corpo$hfPnlConsulta: '1',
    ctl00$Corpo$hfAltchaUrl: altchaUrl,
    ctl00$Corpo$rbTipoConsulta: '1',
    ctl00$Corpo$txtRNTRC: '',
    ctl00$Corpo$txtCpfCnpj: cpfCnpj,
    altcha: altchaPayload,
    ctl00$Corpo$btnConsulta: 'Consultar',
  });

  const postRes = await fetch(ANTT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      Referer: ANTT_URL,
      Cookie: cookieHeader,
      'X-MicrosoftAjax': 'Delta=true',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: '*/*',
    },
    body: formBody.toString(),
    redirect: 'follow',
    signal,
  });
  if (!postRes.ok) throw new Error(`ANTT POST ${postRes.status}`);

  const responseText = await postRes.text();

  // 5. Parse — delta or full page fallback
  const ct = postRes.headers.get('content-type') ?? '';
  let resultHtml: string;
  if (
    ct.includes('text/plain') ||
    responseText.startsWith('0|') ||
    responseText.includes('|updatePanel|')
  ) {
    const panels = parseDelta(responseText);
    resultHtml =
      panels['UpdatePanelMain'] ??
      panels['Corpo_updPnlTipoConsulta'] ??
      Object.values(panels).join('');
  } else {
    resultHtml = responseText;
  }

  const { situacao, rntrc } = extractResult(resultHtml);
  console.log('[antt-rntrc-check] result situacao=', situacao, 'rntrc=', rntrc);
  return { situacao, rntrc, is_stub: false };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: AnttRntrcCheckRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const cpfCnpj = onlyDigits(body.cpf_cnpj ?? '');
  const plate = normalizePlate(body.vehicle_plate ?? '');

  if (!body.order_id || !cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    return new Response(
      JSON.stringify({
        error: 'Campos obrigatórios: order_id, cpf_cnpj (11 ou 14 dígitos), vehicle_plate',
      }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
  if (!plate || plate.length < 7) {
    return new Response(JSON.stringify({ error: 'Placa do veículo inválida' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const signal = timeoutSignal(FETCH_TIMEOUT_MS);
    const result = await consultaAntt(cpfCnpj, signal);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[antt-rntrc-check]', message);
    const fallback: AnttRntrcCheckResponse = {
      situacao: 'indeterminado',
      rntrc: null,
      message: `Consulta indisponível: ${message}`,
      is_stub: false,
    };
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};
