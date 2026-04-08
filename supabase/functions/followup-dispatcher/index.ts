// @ts-nocheck
/**
 * followup-dispatcher — Vectra commercial cadência (Fase 1)
 *
 * - Gera texto: OpenClaw `POST .../v1/chat/completions` com `model: openclaw/commercial-followup-agent`
 * - WhatsApp (ingress): `{ type: 'text', to, body }` — mesmo contrato que `notification-hub` → OpenClaw
 * - E-mail: Resend direto (este repo não envia `channel=email` pelo notification-hub)
 *
 * IMPORTANTE — Edge Function (Supabase):
 * Não use `127.0.0.1` / `localhost` em produção: a Edge não alcança a máquina local.
 * Defina `OPENCLAW_CHAT_COMPLETIONS_URL` com URL pública (ngrok, Tailscale, VPS) até `/v1/chat/completions`.
 * Para `supabase functions serve` local, use `ALLOW_LOCALHOST_OPENCLAW=true` e opcionalmente a URL local.
 *
 * Schema estático (ajustar SCHEMA_STATIC_VERSION ao mudar colunas em migrations):
 * @see SCHEMA_STATIC_VERSION abaixo
 *
 * Idempotência (recomendado antes do go-live):
 *   create unique index if not exists uq_commercial_followup_runs_quote_rule_attempt
 *   on public.commercial_followup_runs (quote_id, rule_id, attempt_no);
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Incrementar quando alterar getSchemaInfoStatic / inserts */
const SCHEMA_STATIC_VERSION = '2026-03-29.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function getOpenClawChatCompletionsUrl(): string {
  const raw = (Deno.env.get('OPENCLAW_CHAT_COMPLETIONS_URL') ?? '').trim();
  if (raw) return raw;
  if (String(Deno.env.get('ALLOW_LOCALHOST_OPENCLAW') ?? '').toLowerCase() === 'true') {
    return 'http://127.0.0.1:18789/v1/chat/completions';
  }
  return '';
}

function assertOpenClawChatUrlForNonDryRun(dryRun: boolean) {
  if (dryRun) return;
  const url = getOpenClawChatCompletionsUrl();
  if (!url) {
    throw new Error(
      'OPENCLAW_CHAT_COMPLETIONS_URL é obrigatório em execução real (não dry_run). ' +
        'A Edge do Supabase não alcança 127.0.0.1; configure URL pública do gateway até /v1/chat/completions. ' +
        'Para testes locais: ALLOW_LOCALHOST_OPENCLAW=true.'
    );
  }
  const lower = url.toLowerCase();
  const isLocal =
    lower.includes('127.0.0.1') ||
    lower.includes('localhost') ||
    lower.startsWith('http://0.0.0.0');
  if (isLocal && String(Deno.env.get('ALLOW_LOCALHOST_OPENCLAW') ?? '').toLowerCase() !== 'true') {
    throw new Error(
      'OPENCLAW_CHAT_COMPLETIONS_URL aponta para host local; bloqueado na Edge até ALLOW_LOCALHOST_OPENCLAW=true (somente dev).'
    );
  }
}

const OPENCLAW_CHAT_MODEL =
  Deno.env.get('OPENCLAW_CHAT_MODEL') ?? 'openclaw/commercial-followup-agent';

const OPENCLAW_GATEWAY_TOKEN =
  Deno.env.get('OPENCLAW_GATEWAY_TOKEN') ?? Deno.env.get('OPENCLAW_API_KEY') ?? '';

/** Mesma URL usada pelo notification-hub (Evolution/OpenClaw ingress) */
const OPENCLAW_WEBHOOK_URL = Deno.env.get('OPENCLAW_WEBHOOK_URL') ?? '';

const OPENCLAW_OUTBOUND_TOKEN =
  Deno.env.get('OPENCLAW_OUTBOUND_TOKEN') ?? Deno.env.get('OPENCLAW_API_KEY') ?? '';

const INTERNAL_BEARER =
  Deno.env.get('INTERNAL_FUNCTION_BEARER') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
/** Domínio verificado no Resend (obrigatório para e-mail real) */
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? '';

const ALLOW_STATIC_FALLBACK =
  String(Deno.env.get('ALLOW_STATIC_FALLBACK') ?? 'false').toLowerCase() === 'true';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/** Colunas conhecidas no CFN (evita information_schema inacessível via PostgREST) */
function getSchemaInfoStatic() {
  return {
    quoteColumns: new Set([
      'id',
      'quote_code',
      'stage',
      'shipper_id',
      'shipper_name',
      'shipper_email',
      'client_id',
      'client_name',
      'origin',
      'destination',
      'value',
      'freight_modality',
      'cargo_type',
      'km_distance',
      'notes',
      'proposal_sent_at',
      'estimated_loading_date',
      'last_commercial_reply_at',
      'handoff_required',
      'commercial_owner_name',
      'followup_target_type',
      'updated_at',
    ]),
    shipperColumns: new Set(['id', 'name', 'email', 'phone', 'contact_name']),
    clientColumns: new Set(['id', 'name', 'email', 'phone', 'contact_name']),
    messageEventColumns: new Set([
      'quote_id',
      'shipper_id',
      'client_id',
      'phone',
      'channel',
      'direction',
      'external_message_id',
      'template_key',
      'message_text',
      'classification',
      'metadata',
      'created_at',
      'target_type',
      'target_name',
      'target_email',
    ]),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const dryRun = Boolean(body?.dry_run ?? false);
    const limit = Number(body?.limit ?? 200);
    const filterQuoteId = body?.filter_quote_id ?? null;
    const filterPhone = body?.filter_phone ?? null;
    const now = body?.now_iso ? new Date(body.now_iso) : new Date();

    assertOpenClawChatUrlForNonDryRun(dryRun);

    const schemaInfo = getSchemaInfoStatic();

    const rules = await fetchActiveRules();
    if (!rules.length) {
      return jsonResponse({
        ok: true,
        dry_run: dryRun,
        sent: 0,
        failed: 0,
        skipped: 0,
        reason: 'no_active_rules',
      });
    }

    const quotes = await fetchEligibleQuotes({
      filterQuoteId,
      filterPhone,
      limit,
      stages: [...new Set(rules.map((r) => normalizeStage(r.quote_stage)))],
      schemaInfo,
    });

    if (!quotes.length) {
      return jsonResponse({
        ok: true,
        dry_run: dryRun,
        sent: 0,
        failed: 0,
        skipped: 0,
        reason: 'no_quotes_found',
      });
    }

    const quoteIds = quotes.map((q) => q.id);

    const [runs, messageEvents] = await Promise.all([
      fetchFollowupRuns(quoteIds),
      fetchCommercialMessageEvents(quoteIds),
    ]);

    const runsMap = buildRunsMap(runs);
    const messageStateMap = buildMessageStateMap(messageEvents);

    const candidates = buildCandidates({
      quotes,
      rules,
      runsMap,
      messageStateMap,
      now,
      schemaInfo,
    });

    const grouped = groupCandidates(candidates);

    const quotesTouched = new Set(candidates.map((c) => c.quote.id));

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        quotes_considered: quotes.length,
        quotes_with_candidates: quotesTouched.size,
        candidates_count: candidates.length,
        groups_count: grouped.length,
        candidates: candidates.map(serializeCandidate),
        groups: grouped.map(serializeGroup),
      });
    }

    let sent = 0;
    let failed = 0;
    const errors: any[] = [];
    const groupsResult: any[] = [];

    for (const group of grouped) {
      try {
        const generation = await generateCommercialMessage(group);

        if (!generation.ok) {
          failed += group.items.length;
          errors.push({
            group_key: group.groupKey,
            channel: group.channel,
            recipient: group.recipient,
            error: generation.error ?? 'generation_failed',
            details: generation.details ?? null,
          });

          await persistFailedRuns(group, generation.error ?? 'generation_failed');
          continue;
        }

        group.generatedMessage = generation.payload;

        const sendResult = await dispatchGroup(group);

        if (!sendResult.ok) {
          failed += group.items.length;
          errors.push({
            group_key: group.groupKey,
            channel: group.channel,
            recipient: group.recipient,
            error: sendResult.error ?? 'dispatch_failed',
            details: sendResult.details ?? null,
          });

          await persistFailedRuns(group, sendResult.error ?? 'dispatch_failed');
          continue;
        }

        await persistSuccessfulDispatch(group, sendResult, schemaInfo);

        sent += group.items.length;
        groupsResult.push({
          group_key: group.groupKey,
          channel: group.channel,
          recipient: group.recipient,
          target_type: group.generatedMessage?.target_type ?? group.contact?.targetType ?? null,
          target_name: group.generatedMessage?.target_name ?? group.contact?.contactName ?? null,
          sent_quotes: group.items.map((i) => ({
            id: i.quote.id,
            quote_code: i.quote.quote_code,
          })),
          external_id: sendResult.externalId ?? null,
        });
      } catch (error) {
        failed += group.items.length;
        errors.push({
          group_key: group.groupKey,
          channel: group.channel,
          recipient: group.recipient,
          error: error?.message ?? String(error),
        });

        await persistFailedRuns(group, error?.message ?? String(error));
      }
    }

    return jsonResponse({
      ok: true,
      dry_run: false,
      schema_static_version: SCHEMA_STATIC_VERSION,
      sent,
      failed,
      skipped_quotes_without_candidate: quotes.length - quotesTouched.size,
      groups_executed: groupsResult.length,
      groups: groupsResult,
      errors,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error?.message ?? String(error),
      },
      500
    );
  }
});

/* =========================================================
 * Data fetch
 * =======================================================*/

async function fetchActiveRules() {
  const { data, error } = await supabase
    .from('commercial_followup_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: true });

  if (error) throw new Error(`fetchActiveRules: ${error.message}`);
  // `quote_stage` nas regras deve coincidir com `quotes.stage` (ex.: negociacao). Comparação normalizada em buildCandidates.
  return data ?? [];
}

async function fetchEligibleQuotes({
  filterQuoteId,
  filterPhone,
  limit,
  stages,
  schemaInfo,
}: {
  filterQuoteId?: string | null;
  filterPhone?: string | null;
  limit?: number;
  stages: string[];
  schemaInfo: any;
}) {
  const selectClause = buildQuoteSelect(schemaInfo);

  let query = supabase
    .from('quotes')
    .select(selectClause)
    .in('stage', stages)
    .order('updated_at', { ascending: false })
    .limit(limit ?? 200);

  if (filterQuoteId) {
    query = query.eq('id', filterQuoteId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchEligibleQuotes: ${error.message}`);

  let rows = data ?? [];

  if (filterPhone) {
    const normalizedFilter = normalizePhone(filterPhone);
    rows = rows.filter((quote) => {
      const contact = buildContactContext(quote, schemaInfo);
      return normalizePhone(contact.phone) === normalizedFilter;
    });
  }

  return rows;
}

function buildQuoteSelect(schemaInfo: any) {
  const quoteCols = schemaInfo.quoteColumns;
  const shipperCols = schemaInfo.shipperColumns;
  const clientCols = schemaInfo.clientColumns;

  const baseQuoteCols = [
    'id',
    'quote_code',
    'stage',
    'shipper_id',
    'shipper_name',
    'shipper_email',
    'client_id',
    'client_name',
    'origin',
    'destination',
    'value',
    'freight_modality',
    'cargo_type',
    'km_distance',
    'notes',
  ];

  const optionalQuoteCols = [
    'proposal_sent_at',
    'estimated_loading_date',
    'last_commercial_reply_at',
    'handoff_required',
    'commercial_owner_name',
    'followup_target_type',
  ].filter((col) => hasColumn(quoteCols, col));

  const shipperSelectCols = ['id', 'name', 'email', 'phone']
    .concat(hasColumn(shipperCols, 'contact_name') ? ['contact_name'] : [])
    .join(', ');

  const clientSelectCols = ['id', 'name', 'email', 'phone']
    .concat(hasColumn(clientCols, 'contact_name') ? ['contact_name'] : [])
    .join(', ');

  return `
    ${baseQuoteCols.join(', ')},
    ${optionalQuoteCols.join(', ')},
    shippers:shipper_id (${shipperSelectCols}),
    clients:client_id (${clientSelectCols})
  `;
}

function hasColumn(columns: Set<string>, columnName: string) {
  return columns?.has(columnName);
}

async function fetchFollowupRuns(quoteIds: string[]) {
  if (!quoteIds.length) return [];

  const { data, error } = await supabase
    .from('commercial_followup_runs')
    .select('*')
    .in('quote_id', quoteIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`fetchFollowupRuns: ${error.message}`);
  return data ?? [];
}

async function fetchCommercialMessageEvents(quoteIds: string[]) {
  if (!quoteIds.length) return [];

  const { data, error } = await supabase
    .from('commercial_message_events')
    .select('*')
    .in('quote_id', quoteIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`fetchCommercialMessageEvents: ${error.message}`);
  return data ?? [];
}

/* =========================================================
 * Candidate resolution
 * =======================================================*/

function buildRunsMap(runs: any[]) {
  const map = new Map<string, any[]>();

  for (const run of runs) {
    const key = `${run.quote_id}|${run.rule_id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(run);
  }

  return map;
}

function buildMessageStateMap(events: any[]) {
  const map = new Map<
    string,
    {
      lastInboundAt: Date | null;
      lastOutboundAt: Date | null;
      lastInboundClassification: string | null;
    }
  >();

  for (const event of events) {
    const state = map.get(event.quote_id) ?? {
      lastInboundAt: null,
      lastOutboundAt: null,
      lastInboundClassification: null,
    };

    const eventAt = event.created_at ? new Date(event.created_at) : null;
    if (!eventAt) continue;

    if (event.direction === 'inbound') {
      if (!state.lastInboundAt || eventAt > state.lastInboundAt) {
        state.lastInboundAt = eventAt;
        state.lastInboundClassification = event.classification ?? null;
      }
    }

    if (event.direction === 'outbound') {
      if (!state.lastOutboundAt || eventAt > state.lastOutboundAt) {
        state.lastOutboundAt = eventAt;
      }
    }

    map.set(event.quote_id, state);
  }

  return map;
}

function buildCandidates({
  quotes,
  rules,
  runsMap,
  messageStateMap,
  now,
  schemaInfo,
}: {
  quotes: any[];
  rules: any[];
  runsMap: Map<string, any[]>;
  messageStateMap: Map<string, any>;
  now: Date;
  schemaInfo: any;
}) {
  const candidates = [];

  for (const quote of quotes) {
    const contact = buildContactContext(quote, schemaInfo);

    if (!contact?.phone && !contact?.email) {
      continue;
    }

    for (const rule of rules) {
      if (normalizeStage(quote.stage) !== normalizeStage(rule.quote_stage)) continue;
      if (quote.handoff_required === true) continue;

      const requiresDate = Boolean(rule.requires_estimated_loading_date ?? false);
      if (requiresDate && !quote.estimated_loading_date) continue;

      const anchorDate = resolveAnchorDate(quote, rule);
      if (!anchorDate) continue;

      const offsetMinutes =
        typeof rule.offset_minutes === 'number'
          ? rule.offset_minutes
          : Number(rule.trigger_after_minutes ?? 0);

      const dueAt = addMinutes(anchorDate, offsetMinutes);
      if (now < dueAt) continue;

      const recipient = rule.channel === 'email' ? contact.email : normalizePhone(contact.phone);

      if (!recipient) continue;

      const runKey = `${quote.id}|${rule.id}`;
      const existingRuns = runsMap.get(runKey) ?? [];

      const hasBlockingRun = existingRuns.some((run) =>
        ['sent', 'delivered', 'replied', 'cancelled', 'skipped'].includes(run.status)
      );

      if (hasBlockingRun) continue;

      const failedAttempts = existingRuns.filter((run) => run.status === 'failed').length;
      if (failedAttempts >= Number(rule.max_attempts ?? 3)) continue;

      const attemptNo = existingRuns.length + 1;

      const messageState = messageStateMap.get(quote.id) ?? {
        lastInboundAt: null,
        lastOutboundAt: null,
        lastInboundClassification: null,
      };

      if (
        shouldStopBecauseOfReply({
          quote,
          rule,
          messageState,
          anchorDate,
        })
      ) {
        continue;
      }

      candidates.push({
        quote,
        rule,
        contact,
        recipient,
        attemptNo,
        anchorDate,
        dueAt,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (a.rule.priority !== b.rule.priority) {
      return a.rule.priority - b.rule.priority;
    }
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

function shouldStopBecauseOfReply({
  quote,
  rule,
  messageState,
  anchorDate,
}: {
  quote: any;
  rule: any;
  messageState: any;
  anchorDate: Date;
}) {
  if (!rule.stop_on_reply) return false;

  const lastReplyAt = quote.last_commercial_reply_at
    ? parseFlexibleDate(quote.last_commercial_reply_at)
    : messageState.lastInboundAt;

  if (!lastReplyAt) return false;

  const referenceOutboundAt = messageState.lastOutboundAt ?? anchorDate;
  return lastReplyAt > referenceOutboundAt;
}

function resolveAnchorDate(quote: any, rule: any) {
  const anchor = rule.trigger_anchor ?? 'proposal_sent_at';

  if (anchor === 'estimated_loading_date') {
    if (!quote.estimated_loading_date) return null;
    return parseFlexibleDate(quote.estimated_loading_date, true);
  }

  if (anchor === 'proposal_sent_at') {
    if (!quote.proposal_sent_at) return null;
    return parseFlexibleDate(quote.proposal_sent_at);
  }

  return null;
}

/**
 * Nome para saudação: prioridade absoluta a `contact_name` da entidade (shipper/client).
 * Só depois usa nomes ao nível da cotação / tabela — nunca troca ordem com empresa quando contact_name existe.
 */
function pickDisplayName(
  entityContactName: string | null | undefined,
  quoteLevelName: string | null | undefined,
  entityTableName: string | null | undefined
): string {
  const cn = String(entityContactName ?? '').trim();
  if (cn) return cn;
  const qn = String(quoteLevelName ?? '').trim();
  if (qn) return qn;
  const en = String(entityTableName ?? '').trim();
  if (en) return en;
  return 'Contato';
}

function normalizeStage(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function buildContactContext(quote: any, schemaInfo: any) {
  const shipper = quote.shippers ?? {};
  const client = quote.clients ?? {};

  const rawTarget = hasColumn(schemaInfo.quoteColumns, 'followup_target_type')
    ? (quote.followup_target_type ?? 'shipper')
    : 'shipper';
  const targetType = String(rawTarget).trim().toLowerCase() === 'client' ? 'client' : 'shipper';

  if (targetType === 'client') {
    return {
      targetType: 'client',
      contactName: pickDisplayName(client.contact_name, quote.client_name, client.name),
      companyName: quote.client_name || client.name || null,
      phone: client.phone ? String(client.phone).trim() : null,
      email: client.email ? String(client.email).trim() : null,
    };
  }

  return {
    targetType: 'shipper',
    contactName: pickDisplayName(shipper.contact_name, quote.shipper_name, shipper.name),
    companyName: quote.shipper_name || shipper.name || null,
    phone: shipper.phone ? String(shipper.phone).trim() : null,
    email:
      quote.shipper_email || shipper.email
        ? String(quote.shipper_email || shipper.email).trim()
        : null,
  };
}

/* =========================================================
 * Grouping
 * =======================================================*/

function groupCandidates(candidates: any[]) {
  const map = new Map<string, any>();

  for (const candidate of candidates) {
    const groupKey = [
      candidate.rule.channel,
      candidate.recipient,
      candidate.rule.template_key,
      candidate.rule.strategy_key,
      candidate.contact.targetType,
    ].join('|');

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        groupKey,
        channel: candidate.rule.channel,
        recipient: candidate.recipient,
        templateKey: candidate.rule.template_key,
        strategyKey: candidate.rule.strategy_key,
        contact: candidate.contact,
        items: [],
      });
    }

    map.get(groupKey).items.push(candidate);
  }

  const groups = Array.from(map.values());

  for (const group of groups) {
    group.items.sort((a: any, b: any) => {
      const aKey =
        a.quote.estimated_loading_date || a.quote.proposal_sent_at || a.quote.quote_code || '';
      const bKey =
        b.quote.estimated_loading_date || b.quote.proposal_sent_at || b.quote.quote_code || '';
      return String(aKey).localeCompare(String(bKey));
    });
  }

  return groups;
}

/* =========================================================
 * OpenClaw generation
 * =======================================================*/

async function generateCommercialMessage(group: any) {
  try {
    const first = group.items[0];
    const mirofishCtx = await fetchMirofishContextForRoute(
      first?.quote?.origin ?? null,
      first?.quote?.destination ?? null
    ).catch(() => null);
    const prompt = buildCommercialAgentUserPrompt(group, mirofishCtx);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (OPENCLAW_GATEWAY_TOKEN) {
      headers['Authorization'] = `Bearer ${OPENCLAW_GATEWAY_TOKEN}`;
    }

    const payload = {
      model: OPENCLAW_CHAT_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    };

    const chatUrl = getOpenClawChatCompletionsUrl();
    if (!chatUrl) {
      return {
        ok: false,
        error: 'openclaw_chat_url_missing',
        details: { hint: 'Configure OPENCLAW_CHAT_COMPLETIONS_URL' },
      };
    }

    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error: `openclaw_generation_http_${res.status}`,
        details: raw,
      };
    }

    const content = extractChatCompletionContent(raw);
    const parsed = parseCommercialAgentResponse(content);

    if (!parsed.ok) {
      if (ALLOW_STATIC_FALLBACK) {
        return {
          ok: true,
          payload: buildStaticFallbackMessage(group),
          details: {
            warning: 'agent_parse_failed_using_static_fallback',
            raw_content: content,
          },
        };
      }

      return {
        ok: false,
        error: parsed.error ?? 'agent_parse_failed',
        details: {
          raw_content: content,
        },
      };
    }

    return {
      ok: true,
      payload: parsed.payload,
      details: raw,
    };
  } catch (error) {
    if (ALLOW_STATIC_FALLBACK) {
      return {
        ok: true,
        payload: buildStaticFallbackMessage(group),
        details: {
          warning: 'agent_generation_exception_using_static_fallback',
          error: error?.message ?? String(error),
        },
      };
    }

    return {
      ok: false,
      error: error?.message ?? String(error),
    };
  }
}

function buildCommercialAgentUserPrompt(group: any, mirofishContext?: any) {
  const first = group.items[0];
  const quotes = group.items.map((item: any) => ({
    quote_code: item.quote.quote_code ?? null,
    origin: item.quote.origin ?? null,
    destination: item.quote.destination ?? null,
    estimated_loading_date: item.quote.estimated_loading_date ?? null,
    proposal_sent_at: item.quote.proposal_sent_at ?? null,
    value: item.quote.value ?? null,
    freight_modality: item.quote.freight_modality ?? null,
    cargo_type: item.quote.cargo_type ?? null,
  }));

  const facts: any = {
    target_type: group.contact.targetType,
    target_name: group.contact.contactName,
    company_name: group.contact.companyName,
    channel: group.channel,
    strategy_key: group.strategyKey,
    quote_stage: first?.quote?.stage ?? null,
    grouped_quotes_count: group.items.length,
    quotes,
    commercial_owner_name: first?.quote?.commercial_owner_name ?? 'Marcelo',
  };

  // Inject MiroFish intelligence context if available
  if (mirofishContext) {
    facts.market_intelligence = mirofishContext;
  }

  return [
    'Gere a mensagem comercial conforme o seu AGENTS.md.',
    'Use apenas os fatos abaixo. Não invente dados.',
    'Responda APENAS com um único objeto JSON válido (sem markdown, sem ```, sem texto antes ou depois).',
    'Use exatamente estas chaves string no JSON:',
    'target_type, target_name, channel, strategy_key, message_text, classification_intent, handoff_required, handoff_reason',
    'handoff_reason deve ser string ou null.',
    mirofishContext
      ? 'Se market_intelligence estiver presente, mencione de forma consultiva o impacto de mercado relevante na mensagem (ex: ajuste NTC, rota high-margin) sem forçar venda.'
      : '',
    '',
    JSON.stringify(facts, null, 2),
  ].join('\n');
}

async function fetchMirofishContextForRoute(origin: string | null, destination: string | null) {
  if (!origin || !destination) return null;
  // Extract state codes from "Cidade/UF" format (e.g. "Florianópolis/SC" → "SC")
  const originState = origin.split('/').pop()?.trim().toUpperCase();
  const destState = destination.split('/').pop()?.trim().toUpperCase();
  if (!originState || !destState) return null;

  const route = `${originState}-${destState}`;

  const { data: routeInsight } = await supabase
    .from('mirofish_route_insights')
    .select('route, avg_ticket, ntc_impact, volume_ctes')
    .eq('route', route)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!routeInsight) return null;

  return {
    route: routeInsight.route,
    avg_market_ticket: routeInsight.avg_ticket,
    ntc_impact_per_cte: routeInsight.ntc_impact,
    volume_ctes: routeInsight.volume_ctes,
    intelligence_note: routeInsight.ntc_impact
      ? `A rota ${route} teve ajuste NTC de R$${routeInsight.ntc_impact?.toFixed(2)} por CT-e`
      : null,
  };
}

function extractChatCompletionContent(raw: any) {
  const content = raw?.choices?.[0]?.message?.content;

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text ?? '';
        if (part?.text) return part.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function parseCommercialAgentResponse(content: string) {
  const normalized = stripMarkdownCodeFence(content).trim();

  let parsed: any;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    const extracted = extractJsonObject(normalized);
    if (!extracted) {
      return { ok: false, error: 'agent_response_not_json' };
    }
    try {
      parsed = JSON.parse(extracted);
    } catch (error) {
      return {
        ok: false,
        error: `agent_json_parse_failed:${error?.message ?? String(error)}`,
      };
    }
  }

  const messageText = String(parsed?.message_text ?? '').trim();
  if (!messageText) {
    return { ok: false, error: 'agent_response_missing_message_text' };
  }

  const classificationIntent =
    parsed?.classification_intent ??
    parsed?.classification_intent_esperada ??
    parsed?.['classification_intent esperada'] ??
    'question';

  return {
    ok: true,
    payload: {
      target_type: parsed?.target_type ?? 'shipper',
      target_name: parsed?.target_name ?? null,
      channel: parsed?.channel ?? null,
      strategy_key: parsed?.strategy_key ?? null,
      message_text: messageText,
      classification_intent: classificationIntent,
      handoff_required: Boolean(parsed?.handoff_required ?? false),
      handoff_reason:
        parsed?.handoff_reason === null || parsed?.handoff_reason === undefined
          ? null
          : String(parsed.handoff_reason),
    },
  };
}

function stripMarkdownCodeFence(value: string) {
  if (!value) return '';
  let s = value.trim();
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

function extractJsonObject(text: string) {
  if (!text) return null;

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function buildStaticFallbackMessage(group: any) {
  const messageText = renderGroupedMessageStatic(group);

  return {
    target_type: group.contact.targetType ?? 'shipper',
    target_name: group.contact.contactName ?? null,
    channel: group.channel,
    strategy_key: group.strategyKey,
    message_text: messageText,
    classification_intent: 'question',
    handoff_required: false,
    handoff_reason: null,
  };
}

/* =========================================================
 * Dispatch
 * =======================================================*/

async function dispatchGroup(group: any) {
  if (!group.generatedMessage?.message_text) {
    return { ok: false, error: 'missing_generated_message' };
  }

  if (group.channel === 'openclaw') {
    return await sendViaOpenClaw(group);
  }

  if (group.channel === 'email') {
    return await sendViaResendEmail(group);
  }

  if (group.channel === 'meta') {
    return await sendViaNotificationHubMetaTemplate(group);
  }

  return { ok: false, error: `unsupported_channel:${group.channel}` };
}

/**
 * Contrato alinhado ao notification-hub sendWhatsApp (texto livre):
 * POST OPENCLAW_WEBHOOK_URL com { type: 'text', to, body }
 */
async function sendViaOpenClaw(group: any) {
  if (!OPENCLAW_WEBHOOK_URL) {
    return { ok: false, error: 'OPENCLAW_WEBHOOK_URL_not_configured' };
  }

  const to = normalizePhone(group.recipient);
  if (!to) {
    return { ok: false, error: 'invalid_phone_for_openclaw' };
  }

  // Mesmo shape que notification-hub → sendWhatsApp (texto livre)
  const hookBody = {
    type: 'text',
    to,
    body: group.generatedMessage.message_text,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (OPENCLAW_OUTBOUND_TOKEN) {
    headers['Authorization'] = `Bearer ${OPENCLAW_OUTBOUND_TOKEN}`;
  }

  const res = await fetch(OPENCLAW_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(hookBody),
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: `openclaw_outbound_http_${res.status}`,
      details: result,
    };
  }

  return {
    ok: true,
    channel: 'openclaw',
    externalId: result?.message_id ?? result?.external_id ?? result?.id ?? null,
    providerResponse: result,
  };
}

async function sendViaResendEmail(group: any) {
  if (!RESEND_API_KEY || !RESEND_FROM) {
    return {
      ok: false,
      error: 'RESEND_not_configured',
      details: {
        hint: 'Defina RESEND_API_KEY e RESEND_FROM (domínio verificado). O notification-hub deste repo não trata channel=email.',
      },
    };
  }

  const to = String(group.recipient || '').trim();
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'invalid_email_recipient' };
  }

  const subject = `Vectra Cargo — follow-up (${group.items.length} cotação(ões))`;
  const safe = escapeHtml(group.generatedMessage.message_text);
  const codes = formatQuoteCodes(group.items.map((i: any) => i.quote.quote_code));

  const html = `<p>Olá, ${escapeHtml(group.generatedMessage.target_name ?? group.contact.contactName ?? '')},</p>
<p style="white-space:pre-wrap">${safe}</p>
<hr/><p style="font-size:12px;color:#666">Cotações: ${escapeHtml(codes)} · template ${escapeHtml(group.templateKey ?? '')}</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: `resend_http_${res.status}`,
      details: result,
    };
  }

  return {
    ok: true,
    channel: 'email',
    externalId: result?.id ?? null,
    providerResponse: result,
  };
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Usa notification-hub apenas para templates Meta aprovados (regras com channel meta) */
async function sendViaNotificationHubMetaTemplate(group: any) {
  const payload = {
    channel: 'whatsapp',
    template_id: group.templateKey,
    recipient: group.recipient,
    variables: {
      contact_name: group.generatedMessage?.target_name ?? group.contact.contactName,
      company_name: group.contact.companyName,
      quote_count: String(group.items.length),
      quote_codes: formatQuoteCodes(group.items.map((i: any) => i.quote.quote_code)),
      message_text: group.generatedMessage.message_text,
      target_type: group.generatedMessage?.target_type ?? group.contact.targetType,
    },
  };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/notification-hub`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${INTERNAL_BEARER}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: `notification_hub_meta_http_${res.status}`,
      details: result,
    };
  }

  return {
    ok: true,
    channel: 'meta',
    externalId: result?.notification_log_id ?? result?.external_id ?? result?.id ?? null,
    providerResponse: result,
  };
}

/* =========================================================
 * Persistence
 * =======================================================*/

async function persistSuccessfulDispatch(group: any, sendResult: any, schemaInfo: any) {
  const sentAt = new Date().toISOString();
  const recipientPhone = group.channel === 'email' ? null : normalizePhone(group.recipient);
  const recipientEmail = group.channel === 'email' ? String(group.recipient).trim() : null;
  const targetType = group.generatedMessage.target_type ?? group.contact.targetType ?? 'shipper';

  for (const item of group.items) {
    const notificationLogId = await insertNotificationLog({
      quote: item.quote,
      contact: item.contact,
      channel: group.channel,
      recipient: group.recipient,
      templateKey: group.templateKey,
      externalId: sendResult.externalId,
      messageText: group.generatedMessage.message_text,
      status: 'sent',
      generatedMessage: group.generatedMessage,
    });

    await insertCommercialMessageEvent({
      quote: item.quote,
      contact: item.contact,
      channel: group.channel,
      direction: 'outbound',
      externalMessageId: sendResult.externalId,
      templateKey: group.templateKey,
      messageText: group.generatedMessage.message_text,
      classification: group.generatedMessage.classification_intent ?? null,
      metadata: {
        strategy_key: group.strategyKey,
        grouped: group.items.length > 1,
        quote_codes: group.items.map((x: any) => x.quote.quote_code),
        handoff_required: group.generatedMessage.handoff_required ?? false,
        handoff_reason: group.generatedMessage.handoff_reason ?? null,
        llm_model: OPENCLAW_CHAT_MODEL,
      },
      schemaInfo,
      generatedMessage: group.generatedMessage,
    });

    const runPayload: any = {
      quote_id: item.quote.id,
      rule_id: item.rule.id,
      attempt_no: item.attemptNo,
      channel: group.channel,
      template_key: group.templateKey,
      status: 'sent',
      notification_log_id: notificationLogId,
      sent_at: sentAt,
      stopped_reason: null,
      target_type: targetType,
      recipient_phone: recipientPhone,
      recipient_email: recipientEmail,
    };

    const { error } = await supabase.from('commercial_followup_runs').insert(runPayload);

    if (error) {
      if (isPostgresUniqueViolation(error)) {
        console.warn(
          '[followup-dispatcher] duplicate commercial_followup_runs ignorado (corrida entre workers):',
          item.quote.id,
          item.rule.id,
          item.attemptNo
        );
        continue;
      }
      throw new Error(`persistSuccessfulDispatch: ${error.message}`);
    }
  }
}

function isPostgresUniqueViolation(err: any): boolean {
  return (
    err?.code === '23505' || /duplicate key|unique constraint/i.test(String(err?.message ?? ''))
  );
}

async function persistFailedRuns(group: any, reason: string) {
  for (const item of group.items) {
    const notificationLogId = await insertNotificationLog({
      quote: item.quote,
      contact: item.contact,
      channel: group.channel,
      recipient: group.recipient,
      templateKey: group.templateKey,
      externalId: null,
      messageText: group.generatedMessage?.message_text ?? null,
      status: 'failed',
      errorMessage: reason,
      generatedMessage: group.generatedMessage ?? null,
    });

    const recipientPhone = group.channel === 'email' ? null : normalizePhone(group.recipient);
    const recipientEmail = group.channel === 'email' ? String(group.recipient).trim() : null;
    const targetType =
      group.generatedMessage?.target_type ?? group.contact?.targetType ?? 'shipper';

    const { error } = await supabase.from('commercial_followup_runs').insert({
      quote_id: item.quote.id,
      rule_id: item.rule.id,
      attempt_no: item.attemptNo,
      channel: group.channel,
      template_key: group.templateKey,
      status: 'failed',
      notification_log_id: notificationLogId,
      stopped_reason: reason,
      target_type: targetType,
      recipient_phone: recipientPhone,
      recipient_email: recipientEmail,
    });

    if (error) {
      console.error('persistFailedRuns', error);
    }
  }
}

async function insertNotificationLog({
  quote,
  contact,
  channel,
  recipient,
  templateKey,
  externalId,
  messageText,
  status,
  errorMessage = null,
  generatedMessage = null,
}: any) {
  const payload = {
    template_key: templateKey,
    channel,
    recipient_email: channel === 'email' ? recipient : null,
    recipient_phone: channel !== 'email' ? recipient : null,
    status,
    external_id: externalId,
    error_message: errorMessage,
    entity_type: 'quote',
    entity_id: quote.id,
    metadata: {
      quote_code: quote.quote_code,
      shipper_name: quote.shipper_name,
      client_name: quote.client_name,
      target_type: generatedMessage?.target_type ?? contact?.targetType ?? 'shipper',
      target_name: generatedMessage?.target_name ?? contact?.contactName ?? null,
      strategy_key: generatedMessage?.strategy_key ?? null,
      handoff_required: generatedMessage?.handoff_required ?? false,
      handoff_reason: generatedMessage?.handoff_reason ?? null,
      llm_model: OPENCLAW_CHAT_MODEL,
      message_text: messageText,
    },
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('notification_logs')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('insertNotificationLog', error);
    return null;
  }

  return data?.id ?? null;
}

async function insertCommercialMessageEvent({
  quote,
  contact,
  channel,
  direction,
  externalMessageId,
  templateKey,
  messageText,
  classification = null,
  metadata = {},
  schemaInfo,
  generatedMessage = null,
}: any) {
  const messageEventColumns = schemaInfo.messageEventColumns;

  const payload: any = {
    quote_id: quote.id,
    shipper_id: quote.shipper_id ?? null,
    client_id: quote.client_id ?? null,
    phone: normalizePhone(contact?.phone),
    channel,
    direction,
    external_message_id: externalMessageId,
    template_key: templateKey,
    message_text: messageText,
    classification,
    metadata: {
      ...metadata,
      target_type: generatedMessage?.target_type ?? contact?.targetType ?? 'shipper',
      target_name: generatedMessage?.target_name ?? contact?.contactName ?? null,
      target_email: contact?.email ?? null,
    },
  };

  if (hasColumn(messageEventColumns, 'target_type')) {
    payload.target_type = generatedMessage?.target_type ?? contact?.targetType ?? 'shipper';
  }

  if (hasColumn(messageEventColumns, 'target_name')) {
    payload.target_name = generatedMessage?.target_name ?? contact?.contactName ?? null;
  }

  if (hasColumn(messageEventColumns, 'target_email')) {
    payload.target_email = contact?.email ?? null;
  }

  const { error } = await supabase.from('commercial_message_events').insert(payload);

  if (error) {
    console.error('insertCommercialMessageEvent', error);
  }
}

/* =========================================================
 * Static fallback rendering
 * =======================================================*/

function renderGroupedMessageStatic(group: any) {
  if (group.items.length === 1) {
    return renderSingleMessageStatic(group.items[0]);
  }

  const contactName = group.contact.contactName;
  const quoteCodes = formatQuoteCodes(group.items.map((i: any) => i.quote.quote_code));

  const nearestDate = group.items
    .map((i: any) => i.quote.estimated_loading_date)
    .filter(Boolean)
    .sort()[0];

  const dateCtx = nearestDate
    ? ` com a próxima previsão de coleta para ${formatDateBR(nearestDate)}`
    : '';

  if (group.strategyKey === 'consultive') {
    return `Olá, ${contactName}. Tudo bem? Estou retomando algumas cotações (${quoteCodes})${dateCtx}. Quis te chamar de forma organizada para entender como está o cenário por aí e se faz sentido seguirmos com essas programações. Se ajudar, posso consolidar contigo o contexto e revisar a melhor forma de avançarmos.`;
  }

  if (group.strategyKey === 'value_reinforcement') {
    return `Olá, ${contactName}. Passando para retomar as cotações ${quoteCodes}${dateCtx}. Aqui a ideia é te apoiar com previsibilidade operacional e melhor desenho da operação, não só em oferta. Se fizer sentido, posso revisar contigo o melhor formato para avançarmos nessas cargas.`;
  }

  if (group.strategyKey === 'closing') {
    return `Olá, ${contactName}. Queria alinhar contigo a definição das cotações ${quoteCodes}${dateCtx}, para organizarmos a programação e disponibilidade operacional. Se ainda fizer sentido seguir, me sinaliza que deixamos o fluxo preparado.`;
  }

  return `Olá, ${contactName}. Retomando as cotações ${quoteCodes}.`;
}

function renderSingleMessageStatic(item: any) {
  const route = compactRoute(item.quote.origin, item.quote.destination);
  const dateCtx = item.quote.estimated_loading_date
    ? ` com previsão de coleta para ${formatDateBR(item.quote.estimated_loading_date)}`
    : '';

  const quoteRef = item.quote.quote_code ? `da cotação ${item.quote.quote_code}` : 'da cotação';

  if (item.rule.strategy_key === 'consultive') {
    return `Olá, ${item.contact.contactName}. Tudo bem? Estou retomando ${quoteRef}${route ? ` da rota ${route}` : ''}${dateCtx}. Queria entender como está o cenário por aí e se ainda faz sentido seguirmos com essa programação. Se precisar, posso te ajudar a revisar janela, formato da operação ou qualquer ajuste para ficar mais aderente ao que você precisa.`;
  }

  if (item.rule.strategy_key === 'value_reinforcement') {
    return `Olá, ${item.contact.contactName}. Passando para reforçar ${quoteRef}${route ? ` da rota ${route}` : ''}${dateCtx}. A ideia aqui não é só oferta, e sim previsibilidade da operação: alinhamento de coleta, tipo de veículo e execução com mais segurança. Se achar útil, reviso contigo o melhor desenho para essa carga antes de seguirmos.`;
  }

  if (item.rule.strategy_key === 'closing') {
    return `Olá, ${item.contact.contactName}. Queria alinhar contigo a definição ${quoteRef}${route ? ` da rota ${route}` : ''}${dateCtx}, para organizarmos disponibilidade e programação operacional. Se ainda fizer sentido avançar, me sinaliza que deixamos tudo preparado. Se preferir, também posso revisar contigo antes de bater o martelo.`;
  }

  return `Olá, ${item.contact.contactName}. Estou retomando ${quoteRef}${route ? ` da rota ${route}` : ''}. Se fizer sentido, sigo contigo nos próximos passos.`;
}

/* =========================================================
 * Helpers
 * =======================================================*/

function normalizePhone(phone?: string | null) {
  if (!phone) return null;

  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;

  return digits;
}

function parseFlexibleDate(value: string | Date, isDateOnly = false) {
  if (value instanceof Date) return value;

  if (typeof value !== 'string') {
    return new Date(value);
  }

  if (isDateOnly || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T09:00:00-03:00`);
  }

  return new Date(value);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatDateBR(input?: string | Date | null) {
  if (!input) return null;

  const date = parseFlexibleDate(
    input,
    typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
  );

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function compactRoute(origin?: string | null, destination?: string | null) {
  const a = origin?.trim();
  const b = destination?.trim();

  if (!a || !b) return null;
  return `${a} → ${b}`;
}

function formatQuoteCodes(codes: string[]) {
  const list = [...new Set((codes ?? []).filter(Boolean))];
  if (list.length <= 3) return list.join(', ');
  return `${list.slice(0, 3).join(', ')} e mais ${list.length - 3}`;
}

function serializeCandidate(candidate: any) {
  return {
    quote_id: candidate.quote.id,
    quote_code: candidate.quote.quote_code,
    shipper_name: candidate.quote.shipper_name,
    client_name: candidate.quote.client_name,
    target_type: candidate.contact.targetType,
    target_name: candidate.contact.contactName,
    channel: candidate.rule.channel,
    rule_name: candidate.rule.name,
    strategy_key: candidate.rule.strategy_key,
    due_at: candidate.dueAt.toISOString(),
    recipient: candidate.recipient,
  };
}

function serializeGroup(group: any) {
  return {
    group_key: group.groupKey,
    channel: group.channel,
    recipient: group.recipient,
    template_key: group.templateKey,
    strategy_key: group.strategyKey,
    target_type: group.contact.targetType,
    target_name: group.contact.contactName,
    quotes: group.items.map((i: any) => ({
      id: i.quote.id,
      quote_code: i.quote.quote_code,
      shipper_name: i.quote.shipper_name,
      client_name: i.quote.client_name,
    })),
  };
}

function jsonResponse(payload: any, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: corsHeaders,
  });
}
