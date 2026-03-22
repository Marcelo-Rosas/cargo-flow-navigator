// supabase/functions/nina-orchestrator/tools/mover_para_perdido.ts
// Tool: mover_para_perdido — move cotações confirmadas para status "perdido"

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
      // UPDATE quote status
      const { error: updateError } = await sb
        .from('quotes')
        .update({
          status: 'perdido',
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .eq('status', 'negociacao'); // Safety: only move if still in negociacao

      if (updateError) {
        console.error(`[mover_para_perdido] Update error for ${quoteId}:`, updateError);
        erros.push(quoteId);
        continue;
      }

      // INSERT audit event in quote_events
      const { error: eventError } = await sb.from('quote_events').insert({
        quote_id: quoteId,
        event_type: 'status_change',
        from_status: 'negociacao',
        to_status: 'perdido',
        notes: 'Movido via Navi — sugestão automática +10d',
        created_at: new Date().toISOString(),
      });

      if (eventError) {
        console.error(`[mover_para_perdido] Event insert error for ${quoteId}:`, eventError);
        // Quote was updated but event failed — log but count as moved
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
