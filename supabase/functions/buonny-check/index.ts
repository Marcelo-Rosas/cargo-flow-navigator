import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * buonny-check (stub v1)
 * Simulates Buonny SOAP API consultation for driver/vehicle risk check.
 * Returns: status, consulta_id, validade (now+90d), cadastro, monitoramento flags.
 * Future: replace stub with real SOAP integration.
 */

interface BuonnyCheckRequest {
  driver_cpf: string;
  vehicle_plate: string;
  order_id?: string;
  evaluation_id?: string;
}

interface BuonnyCheckResponse {
  success: boolean;
  status: 'aprovado' | 'reprovado' | 'em_analise' | 'nao_cadastrado' | 'erro';
  consulta_id: string;
  validade: string;
  cadastro_existente: boolean;
  monitoramento_ativo: boolean;
  score: number;
  detalhes: {
    nome_motorista?: string;
    cnh_status?: string;
    veiculo_status?: string;
    alertas?: string[];
  };
  error?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return json({ success: false, error: 'Missing Authorization header' }, 401);
    }

    let body: BuonnyCheckRequest;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.driver_cpf || !body.vehicle_plate) {
      return json({ success: false, error: 'driver_cpf and vehicle_plate are required' }, 400);
    }

    // ─── STUB: Simulate Buonny API response ───
    // In production, this will call Buonny SOAP API
    const now = new Date();
    const validade = new Date(now);
    validade.setDate(validade.getDate() + 90);

    const consultaId = `BNY-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(
      Math.random() * 999999
    )
      .toString()
      .padStart(6, '0')}`;

    const response: BuonnyCheckResponse = {
      success: true,
      status: 'aprovado',
      consulta_id: consultaId,
      validade: validade.toISOString(),
      cadastro_existente: true,
      monitoramento_ativo: false,
      score: 85,
      detalhes: {
        cnh_status: 'valida',
        veiculo_status: 'regular',
        alertas: [],
      },
    };

    // If evaluation_id provided, persist evidence to DB
    if (body.evaluation_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('risk_evidence').insert({
        evaluation_id: body.evaluation_id,
        evidence_type: 'buonny_check',
        payload: {
          status: response.status,
          consulta_id: response.consulta_id,
          cadastro: response.cadastro_existente,
          monitoramento: response.monitoramento_ativo,
          score: response.score,
          detalhes: response.detalhes,
          driver_cpf: body.driver_cpf,
          vehicle_plate: body.vehicle_plate,
        },
        status: 'valid',
        expires_at: response.validade,
        notes: 'Consulta Buonny (stub v1)',
      });
    }

    return json(response);
  } catch (err) {
    console.error('buonny-check error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      500
    );
  }
});
