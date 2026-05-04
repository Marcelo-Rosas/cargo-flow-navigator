/**
 * buonny-professional-check
 * Fase 2 — OS/Atribuição de motorista.
 *
 * Três modos (precedência: Nstech > Buonny SOAP > Stub):
 *
 * 1. NSTECH_USE_CADASTRO=true
 *    POST https://nscadastro.nstech.com.br/cadastrons/sets/v1/sendToAnalysis
 *    Env: NSTECH_TOKEN (service account), NSTECH_SET_ID (default: 1206937)
 *
 * 2. BUONNY_TOKEN + BUONNY_CNPJ configurados
 *    SOAP consultaProfissional via BUONNY_ENDPOINT
 *
 * 3. Fallback stub (retorna PERFIL ADEQUADO com numero_liberacao: STUB-...)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfessionalCheckRequest {
  order_id: string;
  driver_cpf: string; // 11 dígitos, sem pontuação
  vehicle_plate: string; // placa do cavalo mecânico
  cargo_value: number; // valor em reais (float)
  origin_uf: string; // 2 letras maiúsculas
  destination_uf: string;
  origin_city?: string;
  destination_city?: string;
  produto?: 1 | 2; // 1=STANDARD, 2=PLUS; default 1
}

export type BuonnyDriverStatus =
  | 'PERFIL ADEQUADO AO RISCO'
  | 'PERFIL DIVERGENTE'
  | 'PERFIL COM INSUFICIÊNCIA DE DADOS'
  | 'EM ANÁLISE'
  | 'PERFIL EXPIRADO';

interface ProfessionalCheckResponse {
  status: BuonnyDriverStatus;
  numero_liberacao?: string;
  message?: string;
  qualification_id?: string; // UUID em driver_qualifications
  is_stub: boolean;
}

// ─── SOAP builder ────────────────────────────────────────────────────────────

function buildSoapEnvelope(p: {
  cnpj: string;
  token: string;
  produto: number;
  cpf: string;
  placa: string;
  carga_valor: string;
  uf_origem: string;
  cidade_origem: string;
  uf_destino: string;
  cidade_destino: string;
}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <consultaProfissional xmlns="http://portal.buonny.com.br/">
      <consulta>
        <cnpj_cliente>${p.cnpj}</cnpj_cliente>
        <autenticacao>
          <token>${p.token}</token>
        </autenticacao>
        <produto>${p.produto}</produto>
        <profissional>
          <documento>${p.cpf}</documento>
          <carreteiro>S</carreteiro>
        </profissional>
        <veiculos>
          <placa>${p.placa}</placa>
        </veiculos>
        <carga_tipo>0</carga_tipo>
        <carga_valor>${p.carga_valor}</carga_valor>
        <pais_origem>0</pais_origem>
        <uf_origem>${p.uf_origem}</uf_origem>
        <cidade_origem>${p.cidade_origem}</cidade_origem>
        <pais_destino>0</pais_destino>
        <uf_destino>${p.uf_destino}</uf_destino>
        <cidade_destino>${p.cidade_destino}</cidade_destino>
      </consulta>
    </consultaProfissional>
  </soap:Body>
</soap:Envelope>`;
}

// ─── XML response parser ──────────────────────────────────────────────────────

function extractXml(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`));
  return m ? m[1].trim() : null;
}

function parseConsultaResponse(xml: string): {
  status: BuonnyDriverStatus;
  numero_liberacao?: string;
  message?: string;
} {
  const status = (extractXml(xml, 'status') ??
    extractXml(xml, 'Status') ??
    '') as BuonnyDriverStatus;
  const numero_liberacao =
    extractXml(xml, 'consulta') ?? extractXml(xml, 'numeroLiberacao') ?? undefined;
  const message = extractXml(xml, 'mensagem') ?? extractXml(xml, 'message') ?? undefined;
  return { status, numero_liberacao: numero_liberacao ?? undefined, message: message ?? undefined };
}

// ─── Buonny status → DB status ────────────────────────────────────────────────

function toDbStatus(s: BuonnyDriverStatus): 'aprovado' | 'reprovado' | 'em_analise' | 'bloqueado' {
  if (s === 'PERFIL ADEQUADO AO RISCO') return 'aprovado';
  if (s === 'EM ANÁLISE') return 'em_analise';
  if (s === 'PERFIL COM INSUFICIÊNCIA DE DADOS') return 'bloqueado';
  return 'reprovado'; // DIVERGENTE | EXPIRADO
}

// ─── Nstech Cadastro REST ─────────────────────────────────────────────────────

interface NstechSendToAnalysisResult {
  setId: number;
  consultId: number;
  statusId: number;
  statusDescription: string;
  resultTypeId: number | null;
  resultDescription: string | null;
  isResultExpired: boolean;
}

async function callNstechCadastro(p: {
  token: string;
  setId: number;
  cpf: string;
  plate: string;
  driverName?: string;
}): Promise<{ status: BuonnyDriverStatus; numero_liberacao: string; message: string }> {
  const res = await fetch('https://nscadastro.nstech.com.br/cadastrons/sets/v1/sendToAnalysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.token}`,
    },
    body: JSON.stringify({
      setId: p.setId,
      advancedAnalysis: false,
      professionals: [
        {
          countryId: 1,
          cpfNumber: p.cpf,
          name: p.driverName ?? '',
          jobId: 1,
          countryPhoneCode1: 55,
        },
      ],
      vehicles: [
        {
          countryId: 1,
          licensePlate: p.plate,
          licensingProvinceId: 24,
        },
      ],
      facialBiometrics: null,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data: NstechSendToAnalysisResult = await res.json();

  // resultTypeId: 1 = aprovado (confirmar mapeamento completo em homologação)
  const approved =
    data.resultTypeId === 1 || data.statusDescription?.toLowerCase().includes('conclu');
  const pending = data.statusId < 3;

  const status: BuonnyDriverStatus = pending
    ? 'EM ANÁLISE'
    : approved
      ? 'PERFIL ADEQUADO AO RISCO'
      : 'PERFIL DIVERGENTE';

  return {
    status,
    numero_liberacao: String(data.consultId),
    message: `Nstech: ${data.statusDescription ?? ''}${data.resultDescription ? ' — ' + data.resultDescription : ''}`,
  };
}

// ─── Stub response ────────────────────────────────────────────────────────────

function stubResponse(): { status: BuonnyDriverStatus; numero_liberacao: string; message: string } {
  return {
    status: 'PERFIL ADEQUADO AO RISCO',
    numero_liberacao: `STUB-${Date.now()}`,
    message: '[STUB] Credenciais não configuradas — resultado simulado',
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-api-key',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });

  let body: ProfessionalCheckRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { order_id, driver_cpf, vehicle_plate, cargo_value, origin_uf, destination_uf } = body;
  if (!order_id || !driver_cpf || !vehicle_plate || !cargo_value || !origin_uf || !destination_uf) {
    return new Response(
      JSON.stringify({
        error:
          'Campos obrigatórios: order_id, driver_cpf, vehicle_plate, cargo_value, origin_uf, destination_uf',
      }),
      {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const nstechToken = Deno.env.get('NSTECH_TOKEN');
  const useNstech = Deno.env.get('NSTECH_USE_CADASTRO') === 'true' && !!nstechToken;
  const buonnyToken = Deno.env.get('BUONNY_TOKEN');
  const buonnyCnpj = Deno.env.get('BUONNY_CNPJ');
  const useBuonny = !useNstech && !!buonnyToken && !!buonnyCnpj;
  const useStub = !useNstech && !useBuonny;

  let buonnyResult: { status: BuonnyDriverStatus; numero_liberacao?: string; message?: string };
  let provider: 'nstech' | 'buonny_soap' | 'stub';

  if (useNstech) {
    provider = 'nstech';
    const setId = Number(Deno.env.get('NSTECH_SET_ID') ?? '1206937');
    try {
      buonnyResult = await callNstechCadastro({
        token: nstechToken!,
        setId,
        cpf: driver_cpf.replace(/\D/g, ''),
        plate: vehicle_plate.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
      });
    } catch (err) {
      console.error('[buonny-professional-check] Nstech error:', String(err));
      return new Response(JSON.stringify({ error: `Falha ao contatar Nstech: ${String(err)}` }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  } else if (useBuonny) {
    provider = 'buonny_soap';
    const endpoint =
      Deno.env.get('BUONNY_ENDPOINT') ??
      'https://tstportal.buonny.com.br/portal/services/consultaProfissional';

    const soapBody = buildSoapEnvelope({
      cnpj: buonnyCnpj!,
      token: buonnyToken!,
      produto: body.produto ?? 1,
      cpf: driver_cpf.replace(/\D/g, ''),
      placa: vehicle_plate.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
      carga_valor: cargo_value.toFixed(2),
      uf_origem: origin_uf,
      cidade_origem: (body.origin_city ?? 'NAVEGANTES').toUpperCase(),
      uf_destino: destination_uf,
      cidade_destino: (body.destination_city ?? 'SAO PAULO').toUpperCase(),
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '"consultaProfissional"',
        },
        body: soapBody,
        signal: AbortSignal.timeout(15_000),
      });
      const xml = await res.text();
      buonnyResult = parseConsultaResponse(xml);
    } catch (err) {
      console.error('[buonny-professional-check] SOAP error:', String(err));
      return new Response(JSON.stringify({ error: `Falha ao contatar Buonny: ${String(err)}` }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  } else {
    provider = 'stub';
    buonnyResult = stubResponse();
  }

  // Persist em driver_qualifications
  const { data: qualRow, error: insertError } = await supabase
    .from('driver_qualifications')
    .insert({
      order_id,
      driver_cpf: driver_cpf.replace(/\D/g, ''),
      qualification_type: 'buonny_consulta_profissional',
      status: toDbStatus(buonnyResult.status),
      risk_score: buonnyResult.status === 'PERFIL ADEQUADO AO RISCO' ? 100 : 0,
      checklist: {},
      risk_flags: {
        buonny_status: buonnyResult.status,
        numero_liberacao: buonnyResult.numero_liberacao ?? null,
        message: buonnyResult.message ?? null,
        provider,
        is_stub: provider === 'stub',
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[buonny-professional-check] DB insert error:', insertError.message);
  }

  const response: ProfessionalCheckResponse = {
    status: buonnyResult.status,
    numero_liberacao: buonnyResult.numero_liberacao,
    message: buonnyResult.message,
    qualification_id: qualRow?.id,
    is_stub: provider === 'stub',
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
