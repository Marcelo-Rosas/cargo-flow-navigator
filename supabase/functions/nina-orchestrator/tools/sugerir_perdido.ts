// supabase/functions/nina-orchestrator/tools/sugerir_perdido.ts
// Tool: sugerir_perdido — busca cotações paradas há +10 dias via followup_campaigns

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SugestaoItem {
  id: string;
  codigo: string;
  cliente: string;
  embarcador: string;
  dias_parado: number;
}

export interface SugerirPerdidoResult {
  sugestoes: SugestaoItem[];
  total: number;
}

export async function executeSugerirPerdido(): Promise<SugerirPerdidoResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .from('followup_campaigns')
    .select(`
      id,
      quote_id,
      quote_code,
      client_name,
      shipper_name,
      days_stalled
    `)
    .eq('status', 'pending')
    .gte('days_stalled', 10)
    .order('days_stalled', { ascending: false });

  if (error) {
    console.error('[sugerir_perdido] Query error:', error);
    throw new Error(`Erro ao buscar cotações paradas: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { sugestoes: [], total: 0 };
  }

  const sugestoes: SugestaoItem[] = data.map((c) => ({
    id: c.id,
    codigo: c.quote_code || c.id.slice(0, 8),
    cliente: c.client_name || 'Cliente não informado',
    embarcador: c.shipper_name || 'Embarcador não informado',
    dias_parado: c.days_stalled,
  }));

  console.log(`[sugerir_perdido] ${sugestoes.length} cotações elegíveis encontradas`);

  return { sugestoes, total: sugestoes.length };
}
