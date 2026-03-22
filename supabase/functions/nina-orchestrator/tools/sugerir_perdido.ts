// supabase/functions/nina-orchestrator/tools/sugerir_perdido.ts
// Tool: sugerir_perdido — busca cotações em negociação paradas há +10 dias

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

  // Cotações em negociação com updated_at há mais de 10 dias
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const { data, error } = await sb
    .from('quotes')
    .select(`
      id,
      quote_number,
      client_name,
      shipper_name,
      updated_at
    `)
    .eq('status', 'negociacao')
    .lt('updated_at', tenDaysAgo.toISOString())
    .order('updated_at', { ascending: true });

  if (error) {
    console.error('[sugerir_perdido] Query error:', error);
    throw new Error(`Erro ao buscar cotações: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { sugestoes: [], total: 0 };
  }

  const now = new Date();
  const sugestoes: SugestaoItem[] = data.map((q) => {
    const updatedAt = new Date(q.updated_at);
    const diffMs = now.getTime() - updatedAt.getTime();
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return {
      id: q.id,
      codigo: q.quote_number || q.id.slice(0, 8),
      cliente: q.client_name || 'Cliente não informado',
      embarcador: q.shipper_name || 'Embarcador não informado',
      dias_parado: dias,
    };
  });

  console.log(`[sugerir_perdido] ${sugestoes.length} cotações elegíveis encontradas`);

  return { sugestoes, total: sugestoes.length };
}
