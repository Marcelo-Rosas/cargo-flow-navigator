// supabase/functions/nina-orchestrator/tools/mover_para_perdido.ts
// Tool: mover_para_perdido — move cotações confirmadas para stage "perdido"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface MoverParaPerdidoInput {
  quote_ids: string[];
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

  for (const quoteId of input.quote_ids) {
    try {
      // Fetch quote_code before update for audit trail
      const { data: quote, error: fetchError } = await sb
        .from('quotes')
        .select('id, quote_code')
        .eq('id', quoteId)
        .eq('stage', 'negociacao')
        .single();

      if (fetchError || !quote) {
        console.error(`[mover_para_perdido] Fetch error for ${quoteId}:`, fetchError);
        erros.push(quoteId);
        continue;
      }

      // UPDATE quote stage
      const { error: updateError } = await sb
        .from('quotes')
        .update({
          stage: 'perdido',
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .eq('stage', 'negociacao'); // Safety: only move if still in negociacao

      if (updateError) {
        console.error(`[mover_para_perdido] Update error for ${quoteId}:`, updateError);
        erros.push(quoteId);
        continue;
      }

      // INSERT workflow_event for audit trail
      const { data: event, error: eventError } = await sb
        .from('workflow_events')
        .insert({
          event_type: 'quote.marked_lost',
          entity_type: 'quote',
          entity_id: quoteId,
          payload: {
            quote_code: quote.quote_code,
            from_stage: 'negociacao',
            to_stage: 'perdido',
            notes: 'Movido via Navi — sugestão automática +10d',
          },
          status: 'processed',
        })
        .select('id')
        .single();

      if (eventError) {
        console.error(`[mover_para_perdido] Event insert error for ${quoteId}:`, eventError);
        // Quote was updated but event failed — log but count as moved
      }

      // INSERT workflow_event_log for detailed audit
      const { error: logError } = await sb.from('workflow_event_logs').insert({
        event_id: event?.id ?? null,
        action: 'move_to_perdido',
        agent: 'navi',
        details: {
          quote_id: quoteId,
          quote_code: quote.quote_code,
          from_stage: 'negociacao',
          to_stage: 'perdido',
          trigger: 'sugestao_automatica_10d',
        },
      });

      if (logError) {
        console.error(`[mover_para_perdido] Log insert error for ${quoteId}:`, logError);
      }

      movidas.push(quoteId);
    } catch (err) {
      console.error(`[mover_para_perdido] Unexpected error for ${quoteId}:`, err);
      erros.push(quoteId);
    }
  }

  console.log(
    `[mover_para_perdido] ${movidas.length} movidas, ${erros.length} erros`
  );

  return { movidas, erros };
}
