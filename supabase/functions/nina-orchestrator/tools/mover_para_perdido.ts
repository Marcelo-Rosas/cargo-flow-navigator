// supabase/functions/nina-orchestrator/tools/mover_para_perdido.ts
// Tool: mover_para_perdido — move campanhas confirmadas para status "lost" via followup_campaigns

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface MoverParaPerdidoInput {
  campaign_ids: string[];
}

export interface MoverParaPerdidoResult {
  movidas: string[];
  erros: string[];
}

export async function executeMoverParaPerdido(
  input: MoverParaPerdidoInput
): Promise<MoverParaPerdidoResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, supabaseKey);

  const movidas: string[] = [];
  const erros: string[] = [];

  for (const campaignId of input.campaign_ids) {
    try {
      // Fetch campaign to get quote_id for audit trail
      const { data: campaign, error: fetchError } = await sb
        .from('followup_campaigns')
        .select('id, quote_id, quote_code')
        .eq('id', campaignId)
        .eq('status', 'pending')
        .single();

      if (fetchError || !campaign) {
        console.error(`[mover_para_perdido] Fetch error for ${campaignId}:`, fetchError);
        erros.push(campaignId);
        continue;
      }

      // UPDATE campaign status to lost
      const { error: updateError } = await sb
        .from('followup_campaigns')
        .update({ status: 'lost' })
        .eq('id', campaignId)
        .eq('status', 'pending'); // Safety: only move if still pending

      if (updateError) {
        console.error(`[mover_para_perdido] Update error for ${campaignId}:`, updateError);
        erros.push(campaignId);
        continue;
      }

      // INSERT workflow_event for audit trail
      const entityId = campaign.quote_id ?? campaignId;
      const { data: event, error: eventError } = await sb
        .from('workflow_events')
        .insert({
          event_type: 'quote.marked_lost',
          entity_type: 'followup_campaign',
          entity_id: entityId,
          payload: {
            campaign_id: campaignId,
            quote_code: campaign.quote_code,
            from_status: 'pending',
            to_status: 'lost',
            notes: 'Movido via Navi — sugestão automática +10d parado',
          },
          status: 'processed',
        })
        .select('id')
        .single();

      if (eventError) {
        console.error(`[mover_para_perdido] Event insert error for ${campaignId}:`, eventError);
      }

      // INSERT workflow_event_log for detailed audit
      const { error: logError } = await sb.from('workflow_event_logs').insert({
        event_id: event?.id ?? null,
        action: 'move_to_perdido',
        agent: 'navi',
        details: {
          campaign_id: campaignId,
          quote_id: campaign.quote_id,
          quote_code: campaign.quote_code,
          from_status: 'pending',
          to_status: 'lost',
          trigger: 'sugestao_automatica_10d',
        },
      });

      if (logError) {
        console.error(`[mover_para_perdido] Log insert error for ${campaignId}:`, logError);
      }

      movidas.push(campaignId);
    } catch (err) {
      console.error(`[mover_para_perdido] Unexpected error for ${campaignId}:`, err);
      erros.push(campaignId);
    }
  }

  console.log(
    `[mover_para_perdido] ${movidas.length} movidas, ${erros.length} erros`
  );

  return { movidas, erros };
}
