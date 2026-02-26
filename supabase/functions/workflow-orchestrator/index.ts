import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface WorkflowEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  max_retries: number;
  created_by: string | null;
}

interface EventResult {
  success: boolean;
  actions: string[];
  error?: string;
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function logAction(
  sb: SupabaseClient,
  eventId: string,
  action: string,
  agent: string,
  details: Record<string, unknown> = {}
) {
  await sb.from('workflow_event_logs').insert({
    event_id: eventId,
    action,
    agent,
    details,
  });
}

/** Fire-and-forget: trigger notification-hub to process a pending notification */
async function triggerNotificationHub(sb: SupabaseClient, logId: string) {
  try {
    await callEdgeFunction('notification-hub', { logId });
  } catch {
    // Non-critical — notification stays 'pending' and can be processed in batch later
  }
}

async function callEdgeFunction(fnName: string, body: Record<string, unknown>) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge function ${fnName} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────

async function handleQuoteStageChanged(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { new_stage, old_stage, client_name, client_email, quote_code } = event.payload;
  const actions: string[] = [];

  // Quote won → auto-create order + financial documents
  if (new_stage === 'ganho') {
    // 1. Auto-create order from quote
    const { data: orderResult, error: orderErr } = await sb.rpc('auto_create_order_from_quote', {
      p_quote_id: event.entity_id,
    });

    if (orderErr) {
      // If RPC doesn't exist yet, try manual creation
      if (orderErr.message.includes('does not exist')) {
        actions.push('skipped:auto_create_order (RPC not yet created)');
      } else {
        throw new Error(`Failed to create order: ${orderErr.message}`);
      }
    } else {
      actions.push(`order_created:${orderResult}`);

      // 2. Auto-create FAT document
      const { error: fatErr } = await sb.rpc('ensure_financial_document', {
        doc_type: 'FAT',
        source_id_in: event.entity_id,
      });
      if (!fatErr) actions.push('fat_created');

      // 3. Log notification for client + trigger immediate send
      const { data: quoteWonLog } = await sb
        .from('notification_logs')
        .insert({
          template_key: 'quote_won',
          channel: 'email',
          recipient_email: client_email as string,
          status: 'pending',
          entity_type: 'quote',
          entity_id: event.entity_id,
        })
        .select('id')
        .single();
      if (quoteWonLog) await triggerNotificationHub(sb, quoteWonLog.id);
      actions.push('notification_queued:quote_won');
    }
  }

  // Quote reached pricing stage → trigger AI analysis
  if (new_stage === 'precificacao') {
    try {
      await callEdgeFunction('ai-financial-agent', {
        analysisType: 'quote_profitability',
        entityId: event.entity_id,
        entityType: 'quote',
      });
      actions.push('ai_analysis:quote_profitability');
    } catch (e) {
      actions.push(`ai_analysis_failed:${(e as Error).message}`);
    }
  }

  // Quote sent → (email already handled by existing hook, just log)
  if (new_stage === 'enviado') {
    actions.push('quote_sent:tracked');
  }

  if (actions.length === 0) {
    actions.push(`no_action:${old_stage}->${new_stage}`);
  }

  return { success: true, actions };
}

async function handleOrderCreated(sb: SupabaseClient, event: WorkflowEvent): Promise<EventResult> {
  const { quote_id, carreteiro_antt, os_number } = event.payload;
  const actions: string[] = [];

  // Auto-create PAG document if order has carreteiro value
  if (carreteiro_antt && Number(carreteiro_antt) > 0) {
    const { error: pagErr } = await sb.rpc('ensure_financial_document', {
      doc_type: 'PAG',
      source_id_in: event.entity_id,
      total_amount_in: Number(carreteiro_antt),
    });
    if (!pagErr) actions.push('pag_created');
    else actions.push(`pag_failed:${pagErr.message}`);
  }

  // Queue notification + trigger immediate send
  const { data: orderCreatedLog } = await sb
    .from('notification_logs')
    .insert({
      template_key: 'order_created',
      channel: 'email',
      status: 'pending',
      entity_type: 'order',
      entity_id: event.entity_id,
    })
    .select('id')
    .single();
  if (orderCreatedLog) await triggerNotificationHub(sb, orderCreatedLog.id);
  actions.push('notification_queued:order_created');

  return { success: true, actions };
}

async function handleOrderStageChanged(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { new_stage, driver_name, driver_phone, os_number, quote_id } = event.payload;
  const actions: string[] = [];

  // Driver assigned (moved to busca_motorista with driver info)
  if (new_stage === 'busca_motorista' && driver_phone) {
    const { data: driverLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'driver_assigned',
        channel: 'whatsapp',
        recipient_phone: driver_phone as string,
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (driverLog) await triggerNotificationHub(sb, driverLog.id);
    actions.push('notification_queued:driver_assigned_whatsapp');

    // Trigger AI driver qualification
    try {
      await callEdgeFunction('ai-operational-agent', {
        analysisType: 'driver_qualification',
        entityId: event.entity_id,
        entityType: 'order',
        orderId: event.entity_id,
      });
      actions.push('ai_analysis:driver_qualification');
    } catch (e) {
      actions.push(`ai_analysis_failed:driver_qualification:${(e as Error).message}`);
    }
  }

  // Entered documentacao stage — trigger pre-coleta compliance check
  if (new_stage === 'documentacao') {
    try {
      await callEdgeFunction('ai-operational-agent', {
        analysisType: 'compliance_check',
        entityId: event.entity_id,
        entityType: 'order',
        checkType: 'pre_coleta',
      });
      actions.push('ai_analysis:compliance_check_pre_coleta');
    } catch (e) {
      actions.push(`ai_analysis_failed:compliance_check:${(e as Error).message}`);
    }
  }

  // Delivery confirmed
  if (new_stage === 'entregue') {
    // Advance FAT to GERADO (find FAT via source quote)
    if (quote_id) {
      const { data: fatDoc } = await sb
        .from('financial_documents')
        .select('id, status')
        .eq('source_type', 'quote')
        .eq('source_id', quote_id as string)
        .maybeSingle();

      if (fatDoc && fatDoc.status === 'INCLUIR') {
        await sb.from('financial_documents').update({ status: 'GERADO' }).eq('id', fatDoc.id);
        actions.push('fat_advanced:GERADO');
      }
    }

    // Advance PAG to GERADO
    const { data: pagDoc } = await sb
      .from('financial_documents')
      .select('id, status')
      .eq('source_type', 'order')
      .eq('source_id', event.entity_id)
      .maybeSingle();

    if (pagDoc && pagDoc.status === 'INCLUIR') {
      await sb.from('financial_documents').update({ status: 'GERADO' }).eq('id', pagDoc.id);
      actions.push('pag_advanced:GERADO');
    }

    // Notify client of delivery
    const { data: deliveryLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'delivery_confirmed',
        channel: 'both',
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (deliveryLog) await triggerNotificationHub(sb, deliveryLog.id);
    actions.push('notification_queued:delivery_confirmed');
  }

  if (actions.length === 0) {
    actions.push(`no_action:stage_${new_stage}`);
  }

  return { success: true, actions };
}

async function handleFinancialStatusChanged(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { new_status, total_amount, type, code } = event.payload;
  const actions: string[] = [];

  if (new_status === 'GERADO') {
    const amount = Number(total_amount) || 0;

    // Check approval rules
    const { data: rules } = await sb
      .from('approval_rules')
      .select('*')
      .eq('entity_type', 'financial_document')
      .eq('active', true);

    let needsApproval = false;

    if (rules) {
      for (const rule of rules) {
        const condition = rule.trigger_condition as Record<string, unknown>;

        // Simple field-value comparison
        if (condition.field === 'total_amount') {
          const threshold = Number(condition.value) || 0;
          const operator = condition.operator as string;

          if (
            (operator === '>' && amount > threshold) ||
            (operator === '>=' && amount >= threshold)
          ) {
            // Check additional conditions if any
            const additional = condition.additional as Record<string, unknown> | undefined;
            if (additional) {
              const addField = additional.field as string;
              const addValue = additional.value as string;
              const entityValue = event.payload[addField];
              if (entityValue !== addValue) continue;
            }

            needsApproval = true;

            // Create approval request
            await sb.from('approval_requests').insert({
              entity_type: 'financial_document',
              entity_id: event.entity_id,
              approval_type: rule.approval_type,
              title: `Aprovação: ${code || type} — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              description: `Documento financeiro ${type} no valor de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} requer aprovação.`,
              assigned_to_role: rule.approver_role,
              requested_by: event.created_by,
            });
            actions.push(`approval_created:${rule.approval_type}`);

            // Request AI analysis for the approval
            try {
              await callEdgeFunction('ai-financial-agent', {
                analysisType: 'approval_summary',
                entityId: event.entity_id,
                entityType: 'financial_document',
              });
              actions.push('ai_analysis:approval_summary');
            } catch (e) {
              actions.push(`ai_analysis_failed:${(e as Error).message}`);
            }

            // Notify approver
            const { data: approvalReqLog1 } = await sb
              .from('notification_logs')
              .insert({
                template_key: 'approval_requested',
                channel: 'email',
                status: 'pending',
                entity_type: 'financial_document',
                entity_id: event.entity_id,
              })
              .select('id')
              .single();
            if (approvalReqLog1) await triggerNotificationHub(sb, approvalReqLog1.id);
            actions.push('notification_queued:approval_requested');
            break;
          }
        }

        // Simple type match (e.g. all PAGs need approval)
        if (condition.field === 'type' && condition.operator === '=' && condition.value === type) {
          needsApproval = true;

          await sb.from('approval_requests').insert({
            entity_type: 'financial_document',
            entity_id: event.entity_id,
            approval_type: rule.approval_type,
            title: `Aprovação: ${code || type} — R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            description: `Documento financeiro ${type} requer aprovação do financeiro.`,
            assigned_to_role: rule.approver_role,
            requested_by: event.created_by,
          });
          actions.push(`approval_created:${rule.approval_type}`);

          const { data: approvalReqLog2 } = await sb
            .from('notification_logs')
            .insert({
              template_key: 'approval_requested',
              channel: 'email',
              status: 'pending',
              entity_type: 'financial_document',
              entity_id: event.entity_id,
            })
            .select('id')
            .single();
          if (approvalReqLog2) await triggerNotificationHub(sb, approvalReqLog2.id);
          actions.push('notification_queued:approval_requested');
          break;
        }
      }
    }

    // If no approval needed, auto-advance to AGUARDANDO
    if (!needsApproval) {
      await sb
        .from('financial_documents')
        .update({ status: 'AGUARDANDO' })
        .eq('id', event.entity_id);
      actions.push('auto_advanced:AGUARDANDO');
    }
  }

  if (actions.length === 0) {
    actions.push(`no_action:status_${new_status}`);
  }

  return { success: true, actions };
}

async function handleApprovalDecided(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { decision, entity_type, entity_id, approval_id, decision_notes } = event.payload;
  const actions: string[] = [];

  if (decision === 'approved') {
    // Auto-advance the financial document
    if (entity_type === 'financial_document') {
      const { data: doc } = await sb
        .from('financial_documents')
        .select('status')
        .eq('id', entity_id as string)
        .maybeSingle();

      if (doc && doc.status === 'GERADO') {
        await sb
          .from('financial_documents')
          .update({ status: 'AGUARDANDO' })
          .eq('id', entity_id as string);
        actions.push('auto_advanced:AGUARDANDO');
      }
    }

    // Notify requestor
    const { data: approvedLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'approval_decided',
        channel: 'email',
        status: 'pending',
        entity_type: entity_type as string,
        entity_id: entity_id as string,
      })
      .select('id')
      .single();
    if (approvedLog) await triggerNotificationHub(sb, approvedLog.id);
    actions.push('notification_queued:approval_approved');
  }

  if (decision === 'rejected') {
    const { data: rejectedLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'approval_decided',
        channel: 'email',
        status: 'pending',
        entity_type: entity_type as string,
        entity_id: entity_id as string,
      })
      .select('id')
      .single();
    if (rejectedLog) await triggerNotificationHub(sb, rejectedLog.id);
    actions.push('notification_queued:approval_rejected');
  }

  return { success: true, actions };
}

async function handleDocumentUploaded(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { type, order_id } = event.payload;
  const actions: string[] = [];

  if (!order_id) return { success: true, actions: ['no_action:no_order_id'] };

  // Update document flags on the order
  const flagMap: Record<string, string> = {
    nfe: 'has_nfe',
    cte: 'has_cte',
    pod: 'has_pod',
    cnh: 'has_cnh',
    crlv: 'has_crlv',
    comp_residencia: 'has_comp_residencia',
    antt_motorista: 'has_antt',
    mdfe: 'has_mdfe',
    analise_gr: 'has_analise_gr',
    doc_rota: 'has_doc_rota',
    comprovante_vpo: 'has_vpo',
  };

  const flag = flagMap[type as string];
  if (flag) {
    await sb
      .from('orders')
      .update({ [flag]: true })
      .eq('id', order_id as string);
    actions.push(`flag_set:${flag}`);
  }

  // Comprovantes de pagamento (adiantamento/saldo carreteiro) → process-payment-proof
  if (['adiantamento_carreteiro', 'saldo_carreteiro'].includes(type as string)) {
    try {
      await callEdgeFunction('process-payment-proof', { documentId: event.entity_id });
      actions.push('payment_proof_processing_triggered');
    } catch (e) {
      actions.push(`payment_proof_failed:${(e as Error).message}`);
    }
  }

  // Check if order can auto-advance
  const { data: order } = await sb
    .from('orders')
    .select(
      'stage, has_nfe, has_cte, has_pod, has_cnh, has_crlv, has_antt, has_analise_gr, has_doc_rota, has_vpo'
    )
    .eq('id', order_id as string)
    .maybeSingle();

  if (order) {
    // documentacao → coleta_realizada: requires NF-e + CT-e + Análise GR + Doc Rota + VPO
    if (
      order.stage === 'documentacao' &&
      order.has_nfe &&
      order.has_cte &&
      order.has_analise_gr &&
      order.has_doc_rota &&
      order.has_vpo
    ) {
      await sb
        .from('orders')
        .update({ stage: 'coleta_realizada' })
        .eq('id', order_id as string);
      actions.push('auto_advanced:coleta_realizada');
    }

    // em_transito → entregue: requires POD
    if (order.stage === 'em_transito' && order.has_pod) {
      await sb
        .from('orders')
        .update({ stage: 'entregue' })
        .eq('id', order_id as string);
      actions.push('auto_advanced:entregue');
    }
  }

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Driver Qualified Handler
// ─────────────────────────────────────────────────────

async function handleDriverQualified(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { status, driver_name, risk_score, risk_flags, os_number } = event.payload;
  const actions: string[] = [];

  if (status === 'aprovado') {
    const { data: approvedLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'driver_qualification_approved',
        channel: 'whatsapp',
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (approvedLog) await triggerNotificationHub(sb, approvedLog.id);
    actions.push('notification_queued:driver_qualification_approved');
  } else if (status === 'bloqueado') {
    const { data: blockedLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'driver_qualification_blocked',
        channel: 'whatsapp',
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (blockedLog) await triggerNotificationHub(sb, blockedLog.id);
    actions.push('notification_queued:driver_qualification_blocked');
  } else if (status === 'em_analise') {
    const { data: reviewLog } = await sb
      .from('notification_logs')
      .insert({
        template_key: 'driver_qualification_review',
        channel: 'whatsapp',
        status: 'pending',
        entity_type: 'order',
        entity_id: event.entity_id,
      })
      .select('id')
      .single();
    if (reviewLog) await triggerNotificationHub(sb, reviewLog.id);
    actions.push('notification_queued:driver_qualification_review');
  }

  if (actions.length === 0) {
    actions.push(`no_action:driver_status_${status}`);
  }

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Compliance Violation Handler
// ─────────────────────────────────────────────────────

async function handleComplianceViolation(
  sb: SupabaseClient,
  event: WorkflowEvent
): Promise<EventResult> {
  const { check_type, violations, os_number } = event.payload;
  const actions: string[] = [];

  // Create approval request for operational manager
  await sb.from('approval_requests').insert({
    entity_type: 'order',
    entity_id: event.entity_id,
    approval_type: 'compliance_override',
    title: `Violação de Compliance - ${os_number || event.entity_id}`,
    description: `Compliance check (${check_type}) encontrou violações que requerem revisão.`,
    assigned_to_role: 'operacao',
    requested_by: event.created_by,
  });
  actions.push('approval_created:compliance_override');

  // Notify via WhatsApp + Email
  const { data: violationLog } = await sb
    .from('notification_logs')
    .insert({
      template_key: 'compliance_violation',
      channel: 'both',
      status: 'pending',
      entity_type: 'order',
      entity_id: event.entity_id,
    })
    .select('id')
    .single();
  if (violationLog) await triggerNotificationHub(sb, violationLog.id);
  actions.push('notification_queued:compliance_violation');

  return { success: true, actions };
}

// ─────────────────────────────────────────────────────
// Main: Event Dispatcher
// ─────────────────────────────────────────────────────

async function processEvents(
  sb: SupabaseClient,
  eventId?: string
): Promise<{
  processed: number;
  results: Array<{ eventId: string; event_type: string; result: EventResult }>;
}> {
  // Fetch pending events
  let query = sb
    .from('workflow_events')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  if (eventId) {
    query = sb.from('workflow_events').select('*').eq('id', eventId).eq('status', 'pending');
  }

  const { data: events, error: fetchErr } = await query;
  if (fetchErr) throw new Error(`Failed to fetch events: ${fetchErr.message}`);
  if (!events || events.length === 0) return { processed: 0, results: [] };

  const results: Array<{ eventId: string; event_type: string; result: EventResult }> = [];

  for (const event of events as WorkflowEvent[]) {
    // Mark as processing
    await sb.from('workflow_events').update({ status: 'processing' }).eq('id', event.id);

    try {
      let result: EventResult;

      // Route to handler
      switch (true) {
        case event.event_type === 'quote.stage_changed':
          result = await handleQuoteStageChanged(sb, event);
          break;
        case event.event_type === 'order.created':
          result = await handleOrderCreated(sb, event);
          break;
        case event.event_type === 'order.stage_changed':
          result = await handleOrderStageChanged(sb, event);
          break;
        case event.event_type === 'financial.status_changed':
          result = await handleFinancialStatusChanged(sb, event);
          break;
        case event.event_type === 'approval.decided':
          result = await handleApprovalDecided(sb, event);
          break;
        case event.event_type === 'document.uploaded':
          result = await handleDocumentUploaded(sb, event);
          break;
        case event.event_type === 'driver.qualified':
          result = await handleDriverQualified(sb, event);
          break;
        case event.event_type === 'compliance.violation':
          result = await handleComplianceViolation(sb, event);
          break;
        default:
          result = { success: true, actions: [`unhandled:${event.event_type}`] };
      }

      // Mark as completed
      await sb
        .from('workflow_events')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', event.id);

      // Log all actions
      for (const action of result.actions) {
        await logAction(sb, event.id, action, 'workflow-orchestrator');
      }

      results.push({ eventId: event.id, event_type: event.event_type, result });
    } catch (e) {
      const errMsg = (e as Error).message;
      const newRetry = event.retry_count + 1;

      await sb
        .from('workflow_events')
        .update({
          status: newRetry >= event.max_retries ? 'failed' : 'pending',
          retry_count: newRetry,
          error_message: errMsg,
        })
        .eq('id', event.id);

      await logAction(sb, event.id, `error:${errMsg}`, 'workflow-orchestrator', {
        retry_count: newRetry,
      });

      results.push({
        eventId: event.id,
        event_type: event.event_type,
        result: { success: false, actions: [], error: errMsg },
      });
    }
  }

  return { processed: results.length, results };
}

// ─────────────────────────────────────────────────────
// HTTP Handler
// ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const sb = serviceClient();

    let eventId: string | undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        eventId = body?.eventId;

        // Support Supabase Database Webhook format
        if (body?.type === 'INSERT' && body?.record?.id) {
          eventId = body.record.id;
        }
      } catch {
        // empty body is fine (process all pending)
      }
    }

    const result = await processEvents(sb, eventId);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
