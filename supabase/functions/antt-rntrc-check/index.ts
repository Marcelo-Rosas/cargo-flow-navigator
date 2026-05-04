/**
 * antt-rntrc-check  v3.0.0
 * Consulta RNTRC (Por Transportador / Por Veículo), CIOT Agregado e VPO
 * via portal público ANTT. Baseado em mapeamento real do DOM (mai/2026).
 *
 * operations:
 *   rntrc   — Por Transportador (rbTipoConsulta=1); cpf_cnpj obrigatório
 *   veiculo — Por Veículo (rbTipoConsulta=3); vehicle_plate obrigatório
 *   ciot    — CIOT Agregado; rntrc + renavam obrigatórios
 *   vpo     — Vale-Pedágio Obrigatório; vehicle_plate obrigatório
 *
 * Sempre retorna HTTP 200 — nunca 500 — para não bloquear o wizard.
 * Timeout total: 25 s. Requer Deno.serve() (Edge Runtime 1.73+).
 */

// ─── URLs ────────────────────────────────────────────────────────────────────

const RNTRC_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaRNTRC.aspx';
const CIOT_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaCIOT.aspx';
const VPO_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaVPO.aspx';
const ALTCHA_URL = 'https://captcha.srvs.antt.gov.br/altcha';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 25_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-api-key',
};

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AnttRntrcCheckRequest {
  order_id: string;
  cpf_cnpj?: string;
  vehicle_plate?: string;
  rntrc?: string;
  renavam?: string;
  operation?: 'rntrc' | 'veiculo' | 'ciot' | 'vpo';
}

interface CiotResult {
  found: boolean;
  ciot?: string | null;
  status?: string | null;
  transportador?: string | null;
  embarcador?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  mensagem?: string;
}

interface AnttRntrcCheckResponse {
  situacao: 'regular' | 'irregular' | 'indeterminado';
  /** ATIVO / VENCIDO / CANCELADO / SUSPENSO conforme a tabela ANTT */
  situacao_raw?: string;
  rntrc?: string | null;
  transportador?: string;
  /** CPF/CNPJ mascarado retornado pelo portal (ex: XXX.465.204-XX) */
  cpf_cnpj_mask?: string;
  cadastrado_desde?: string;
  municipio_uf?: string;
  /** true se "apto a realizar transporte remunerado" (Corpo_lblMsg) */
  apto?: boolean;
  /** Apenas para operation='veiculo': veículo está na frota do transportador */
  veiculo_na_frota?: boolean;
  ciot?: CiotResult;
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

// ─── UTILS ───────────────────────────────────────────────────────────────────

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), ms);
  return ac.signal;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── ASP.NET TOKEN EXTRACTION ────────────────────────────────────────────────

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

function extractCookies(res: Response): string {
  const getCookies =
    typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''].filter(Boolean);
  return getCookies.map((c: string) => c.split(';')[0]).join('; ');
}

// ─── ALTCHA PROOF-OF-WORK ────────────────────────────────────────────────────
// Batched Promise.all eliminates per-iteration async overhead (~1µs/iter vs ~6µs).
// Salt concatenated directly: SHA256(salt + number) — no dot separator (confirmed working).

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function solvePoW(
  salt: string,
  target: string,
  maxnumber = 1_000_000,
  signal?: AbortSignal
): Promise<number | null> {
  const enc = new TextEncoder();
  const saltBytes = enc.encode(salt);
  const targetBytes = hexToBytes(target);
  const cap = Math.min(maxnumber, 1_000_000);
  const BATCH = 1_000;

  for (let base = 0; base <= cap; base += BATCH) {
    if (signal?.aborted) return null;
    const count = Math.min(BATCH, cap - base + 1);
    const promises: Promise<ArrayBuffer>[] = [];
    for (let i = 0; i < count; i++) {
      const numStr = String(base + i);
      const msg = new Uint8Array(saltBytes.length + numStr.length);
      msg.set(saltBytes);
      for (let j = 0; j < numStr.length; j++) msg[saltBytes.length + j] = numStr.charCodeAt(j);
      promises.push(crypto.subtle.digest('SHA-256', msg));
    }
    const hashes = await Promise.all(promises);
    for (let i = 0; i < count; i++) {
      if (bytesEqual(new Uint8Array(hashes[i]), targetBytes)) return base + i;
    }
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

async function fetchAltchaAndSolve(referer: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(ALTCHA_URL, {
    headers: { 'User-Agent': UA, Referer: referer },
    signal,
  });
  if (!res.ok) throw new Error(`ALTCHA challenge ${res.status}`);
  const ch: AltchaChallenge = await res.json();
  console.log('[antt] solving PoW maxnumber=', ch.maxnumber);
  const n = await solvePoW(ch.salt, ch.challenge, ch.maxnumber, signal);
  if (n === null) throw new Error('ALTCHA: solução PoW não encontrada');
  return buildAltchaPayload(ch, n);
}

// ─── UPDATE PANEL DELTA PARSER ───────────────────────────────────────────────

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

/** Extracts UpdatePanel HTML or falls back to raw response. */
function extractPanelHtml(responseText: string, ct: string): string {
  const isDelta = ct.includes('text/plain') || /^\d+\|/.test(responseText);
  if (!isDelta) return responseText;
  const panels = parseDelta(responseText);
  const keys = Object.keys(panels);
  console.log('[antt] panelKeys=', keys.join(','));
  return keys.length > 0 ? Object.values(panels).join('') : responseText;
}

// ─── RNTRC RESULT PARSER ─────────────────────────────────────────────────────
/**
 * Parses Corpo_gvResultadoPesquisa (6 cols) + Corpo_lblMsg.
 * Used for both Por Transportador (rbTipoConsulta=1) and Por Veículo (3).
 *
 * Table columns: [0]Transportador [1]CPF/CNPJ [2]RNTRC [3]Situação RNTRC [4]Cadastrado desde [5]Município/UF
 *
 * Situação values confirmed: ATIVO, VENCIDO (e.g. Correios), CANCELADO.
 * veiculoNaFrota discrimination: Corpo_lblMsg contains <u><b>NÃO</b></u> when negative.
 */
function extractRntrcResult(
  html: string,
  isVeiculo: boolean
): Omit<AnttRntrcCheckResponse, 'is_stub'> {
  // ── 1. Table ──────────────────────────────────────────────────────────────
  const tblIdx = html.indexOf('Corpo_gvResultadoPesquisa');
  if (tblIdx !== -1) {
    const tblEnd = html.indexOf('</table>', tblIdx);
    const tblHtml = html.slice(tblIdx, tblEnd !== -1 ? tblEnd + 8 : tblIdx + 6000);

    // Second <tr> = data row (first is header)
    const rows = [...tblHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const dataRow = rows[1]?.[1] ?? '';
    const cells = [...dataRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));

    if (cells.length >= 4) {
      const [transportador, cpfCnpjMask, rntrc, situacaoRaw, cadastradoDesde, municipioUf] = cells;

      // Map raw situacao → canonical
      const situRaw = (situacaoRaw ?? '').trim().toUpperCase();
      let situacao: 'regular' | 'irregular';
      if (/^ATIVO$/.test(situRaw)) {
        situacao = 'regular';
      } else {
        // VENCIDO, CANCELADO, SUSPENSO, IMPEDIDO, INATIVO → irregular
        situacao = 'irregular';
      }

      // ── 2. Corpo_lblMsg ────────────────────────────────────────────────
      const lblRaw = html.match(/id="Corpo_lblMsg"[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i)?.[1] ?? '';
      const lblText = stripTags(lblRaw);

      const apto = /apto a realizar o transporte remunerado/i.test(lblRaw);

      // veiculoNaFrota: negative when lblMsg contains <b>NÃO</b> or "não está cadastrado"
      let veiculoNaFrota: boolean | undefined;
      if (isVeiculo) {
        const negativo =
          /<u[^>]*>\s*<b[^>]*>\s*N[AÃ]O\s*<\/b>/i.test(lblRaw) ||
          /n[aã]o\s+est[aá]\s+cadastrad/i.test(lblText);
        veiculoNaFrota = !negativo;
      }

      return {
        situacao,
        situacao_raw: situRaw || undefined,
        rntrc: rntrc || null,
        transportador: transportador || undefined,
        cpf_cnpj_mask: cpfCnpjMask || undefined,
        cadastrado_desde: cadastradoDesde || undefined,
        municipio_uf: municipioUf || undefined,
        apto,
        veiculo_na_frota: veiculoNaFrota,
      };
    }
  }

  // ── Fallback: no table found ──────────────────────────────────────────────
  const noResult = /não foram encontrados transportadores|nenhum.*encontrad|sem.*resultado/i.test(
    html
  );
  if (noResult) return { situacao: 'irregular', rntrc: null };

  const isRegular = /\b(regular|ativo|habilitado)\b/i.test(html);
  const isIrregular = /\b(irregular|inativo|cancelado|suspenso|impedido|vencido)\b/i.test(html);
  const lblMsg = stripTags(
    html.match(/id="Corpo_lblMsg"[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i)?.[1] ?? ''
  );

  if (isRegular && !isIrregular) return { situacao: 'regular', rntrc: null, message: lblMsg };
  if (isIrregular) return { situacao: 'irregular', rntrc: null, message: lblMsg };
  return {
    situacao: 'indeterminado',
    rntrc: null,
    message: `preview=${html.slice(0, 300)}`,
  };
}

// ─── CIOT RESULT PARSER ──────────────────────────────────────────────────────
/**
 * Negative result lives in modal: #MessageBox_LabelMensagem
 * "Não existem registros de Operações de Transporte (CIOT) vigentes..."
 *
 * Positive result: to be confirmed — parseCiotTable returns [] until captured.
 */
function extractCiotResult(html: string): CiotResult {
  // Modal message (present in both positive and negative responses)
  const modalMsg = stripTags(
    html.match(/id="MessageBox_LabelMensagem"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''
  );

  const noResult =
    /n[aã]o existem registros/i.test(modalMsg) ||
    /nenhum|n[aã]o.*encontrad|sem.*resultado|0.*registro|n[aã]o.*localizado/i.test(html);

  if (noResult) {
    return { found: false, mensagem: modalMsg || 'Sem registros CIOT' };
  }

  // Try to parse a results table (ID TBD — placeholder until positive result captured)
  const tblMatch = html.match(/id="(?:Corpo_gv[^"]*|gvCIOT[^"]*)"[\s\S]*?<\/table>/i);
  if (tblMatch) {
    const rows = [...tblMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rows.length >= 2) {
      const dataRow = rows[1][1];
      const cells = [...dataRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        stripTags(m[1])
      );
      const ciotCode = cells.find((c) => /^\d{14,}$/.test(c)) ?? null;
      const dates = cells.filter((c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c));
      const statusCell = cells.find((c) =>
        /\b(ativo|vigente|encerrado|cancelado|irregular)\b/i.test(c)
      );
      const names = cells.filter(
        (c) => c.length > 5 && !/^\d/.test(c) && !/^\d{2}\/\d{2}\/\d{4}$/.test(c)
      );
      return {
        found: true,
        ciot: ciotCode,
        status: statusCell ?? null,
        transportador: names[0] ?? null,
        embarcador: names[1] ?? null,
        data_inicio: dates[0] ?? null,
        data_fim: dates[1] ?? null,
        mensagem: modalMsg || undefined,
      };
    }
  }

  // Fallback: any 14-digit number in HTML = CIOT code
  const ciotMatch = html.match(/\b(\d{14,})\b/);
  const isActive = /\b(ativo|vigente)\b/i.test(html);

  if (ciotMatch || isActive || modalMsg) {
    return {
      found: true,
      ciot: ciotMatch?.[1] ?? null,
      status: isActive ? 'ativo' : null,
      mensagem: modalMsg || undefined,
    };
  }

  return { found: false, mensagem: 'Indeterminado' };
}

// ─── PAGE FETCHER ─────────────────────────────────────────────────────────────

interface PageTokens {
  viewState: string;
  viewStateGen: string;
  eventValidation: string;
  altchaUrl: string;
  cookies: string;
}

async function fetchPage(url: string, signal: AbortSignal): Promise<PageTokens> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal,
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const html = await res.text();

  return {
    viewState: extractHidden(html, '__VIEWSTATE'),
    viewStateGen: extractHidden(html, '__VIEWSTATEGENERATOR'),
    eventValidation: extractHidden(html, '__EVENTVALIDATION'),
    altchaUrl:
      extractHidden(html, 'ctl00$Corpo$hfAltchaUrl') ||
      extractHidden(html, 'Corpo_hfAltchaUrl') ||
      ALTCHA_URL,
    cookies: extractCookies(res),
  };
}

// ─── CONSULTATION FLOWS ──────────────────────────────────────────────────────

async function consultaRntrc(
  cpfCnpj: string,
  plate: string,
  rntrc: string | undefined,
  tipoConsulta: '1' | '3',
  signal: AbortSignal
): Promise<AnttRntrcCheckResponse> {
  console.log('[antt] GET RNTRC page tipo=', tipoConsulta);
  const { viewState, viewStateGen, eventValidation, altchaUrl, cookies } = await fetchPage(
    RNTRC_URL,
    signal
  );

  if (!viewState) throw new Error('RNTRC ViewState não encontrado');

  const altchaPayload = await fetchAltchaAndSolve(RNTRC_URL, signal);

  console.log('[antt] POST RNTRC tipo=', tipoConsulta);
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
    ctl00$Corpo$rbTipoConsulta: tipoConsulta,
    ctl00$Corpo$txtPlaca: tipoConsulta === '3' ? plate : '',
    ctl00$Corpo$txtRNTRC: rntrc ?? '',
    ctl00$Corpo$txtCpfCnpj: cpfCnpj,
    altcha: altchaPayload,
    ctl00$Corpo$btnConsulta: 'Consultar',
  });

  const postRes = await fetch(RNTRC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      Referer: RNTRC_URL,
      Cookie: cookies,
      'X-MicrosoftAjax': 'Delta=true',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: '*/*',
    },
    body: formBody.toString(),
    redirect: 'follow',
    signal,
  });
  if (!postRes.ok) throw new Error(`RNTRC POST ${postRes.status}`);

  const responseText = await postRes.text();
  const ct = postRes.headers.get('content-type') ?? '';
  console.log('[antt] RNTRC ct=', ct, 'response[:300]=', responseText.slice(0, 300));

  const resultHtml = extractPanelHtml(responseText, ct);
  console.log('[antt] RNTRC resultHtml[:500]=', resultHtml.slice(0, 500));

  const parsed = extractRntrcResult(resultHtml, tipoConsulta === '3');
  console.log('[antt] RNTRC parsed=', JSON.stringify(parsed));

  if (parsed.situacao === 'indeterminado') {
    parsed.message = `ct=${ct}; preview=${responseText.slice(0, 300)}`;
  }

  return { ...parsed, is_stub: false };
}

async function consultaCIOT(
  rntrc: string,
  renavam: string,
  signal: AbortSignal
): Promise<AnttRntrcCheckResponse> {
  console.log('[antt] GET CIOT page rntrc=', rntrc, 'renavam=', renavam);
  const { viewState, viewStateGen, eventValidation, altchaUrl, cookies } = await fetchPage(
    CIOT_URL,
    signal
  );

  if (!viewState) throw new Error('CIOT ViewState não encontrado');

  const altchaPayload = await fetchAltchaAndSolve(CIOT_URL, signal);

  console.log('[antt] POST CIOT');
  const formBody = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen || '64C8F81D',
    __EVENTVALIDATION: eventValidation,
    ctl00$bMostraAlerta: 'true',
    ctl00$Corpo$hfPnlConsultaCIOT: '1',
    ctl00$Corpo$hfAltchaUrl: altchaUrl,
    ctl00$Corpo$rbTipoConsultaCIOT: '1',
    ctl00$Corpo$txtRntrc: rntrc,
    ctl00$Corpo$txtRenavam: renavam,
    altcha: altchaPayload,
    // Confirmed button name from portal DOM mapping (mai/2026)
    ctl00$Corpo$btnConsultar: 'Consultar',
  });

  // CIOT result arrives in a modal (MessageBox_LabelMensagem), not UpdatePanel.
  // Use regular POST headers — no X-MicrosoftAjax.
  const postRes = await fetch(CIOT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      Referer: CIOT_URL,
      Cookie: cookies,
      Accept: 'text/html,application/xhtml+xml',
    },
    body: formBody.toString(),
    redirect: 'follow',
    signal,
  });
  if (!postRes.ok) throw new Error(`CIOT POST ${postRes.status}`);

  const responseText = await postRes.text();
  const ct = postRes.headers.get('content-type') ?? '';
  console.log('[antt] CIOT ct=', ct, 'response[:300]=', responseText.slice(0, 300));

  // Handle both full HTML and delta (defensive)
  const resultHtml = extractPanelHtml(responseText, ct);
  console.log('[antt] CIOT resultHtml[:500]=', resultHtml.slice(0, 500));

  const ciot = extractCiotResult(resultHtml);
  console.log('[antt] CIOT result=', JSON.stringify(ciot));

  return {
    situacao: ciot.found ? 'regular' : 'irregular',
    ciot,
    is_stub: false,
  };
}

async function consultaVPO(
  plate: string,
  cpfCnpj: string,
  signal: AbortSignal
): Promise<AnttRntrcCheckResponse> {
  console.log('[antt] GET VPO page plate=', plate);
  const { viewState, viewStateGen, eventValidation, altchaUrl, cookies } = await fetchPage(
    VPO_URL,
    signal
  );

  if (!viewState) throw new Error('VPO ViewState não encontrado');

  const altchaPayload = await fetchAltchaAndSolve(VPO_URL, signal);

  console.log('[antt] POST VPO');
  const formBody = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen || 'F4FFBDCA',
    __EVENTVALIDATION: eventValidation,
    ctl00$bMostraAlerta: 'true',
    ctl00$Corpo$hfAltchaUrl: altchaUrl,
    ctl00$Corpo$txtPlaca: plate,
    ctl00$Corpo$txtCpfCnpj: cpfCnpj,
    altcha: altchaPayload,
    ctl00$Corpo$btnConsultar: 'Consultar',
  });

  const postRes = await fetch(VPO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      Referer: VPO_URL,
      Cookie: cookies,
      Accept: 'text/html,application/xhtml+xml',
    },
    body: formBody.toString(),
    redirect: 'follow',
    signal,
  });
  if (!postRes.ok) throw new Error(`VPO POST ${postRes.status}`);

  const responseText = await postRes.text();
  const ct = postRes.headers.get('content-type') ?? '';
  console.log('[antt] VPO ct=', ct, 'response[:300]=', responseText.slice(0, 300));

  const resultHtml = extractPanelHtml(responseText, ct);

  // VPO result: modal or lblMsg
  const modalMsg = stripTags(
    resultHtml.match(/id="MessageBox_LabelMensagem"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''
  );
  const lblMsg = stripTags(
    resultHtml.match(/id="Corpo_lblMsg"[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i)?.[1] ?? ''
  );
  const mensagem = modalMsg || lblMsg;
  const found =
    !/n[aã]o foram encontrados|n[aã]o existem|sem registros/i.test(mensagem) && mensagem.length > 0;

  return {
    situacao: found ? 'regular' : 'irregular',
    message: mensagem || undefined,
    is_stub: false,
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
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

  if (!body.order_id) {
    return new Response(JSON.stringify({ error: 'Campo obrigatório: order_id' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const operation = body.operation ?? 'rntrc';
  const cpfCnpj = onlyDigits(body.cpf_cnpj ?? '');
  const plate = normalizePlate(body.vehicle_plate ?? '');
  const rntrcNorm = body.rntrc ? onlyDigits(String(body.rntrc)) : undefined;

  // Validate required fields per operation
  if (operation === 'rntrc') {
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      return new Response(
        JSON.stringify({ error: 'operation=rntrc requer cpf_cnpj (11 ou 14 dígitos)' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
  }
  if (operation === 'rntrc' || operation === 'veiculo' || operation === 'vpo') {
    if (!plate || plate.length < 7) {
      return new Response(JSON.stringify({ error: 'Placa do veículo inválida' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }
  if (operation === 'ciot') {
    const renavamNorm = onlyDigits(String(body.renavam ?? ''));
    if (!rntrcNorm || !renavamNorm) {
      return new Response(JSON.stringify({ error: 'operation=ciot requer rntrc e renavam' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }

  console.log('[antt] operation=', operation, 'order_id=', body.order_id);

  try {
    const signal = timeoutSignal(FETCH_TIMEOUT_MS);
    let result: AnttRntrcCheckResponse;

    switch (operation) {
      case 'veiculo':
        result = await consultaRntrc(cpfCnpj, plate, rntrcNorm, '3', signal);
        break;
      case 'ciot':
        result = await consultaCIOT(rntrcNorm!, onlyDigits(String(body.renavam)), signal);
        break;
      case 'vpo':
        result = await consultaVPO(plate, cpfCnpj, signal);
        break;
      default:
        result = await consultaRntrc(cpfCnpj, plate, rntrcNorm, '1', signal);
        break;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[antt] error:', message);
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
});
