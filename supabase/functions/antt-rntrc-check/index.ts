/**
 * antt-rntrc-check
 * Consulta pública RNTRC (ANTT) — por enquanto apenas stub.
 * Integração real (ALTCHA + WebForms) deve substituir o bloco stub mantendo o mesmo contrato JSON.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-api-key',
};

interface AnttRntrcCheckRequest {
  order_id: string;
  cpf_cnpj: string;
  vehicle_plate: string;
}

interface AnttRntrcCheckResponse {
  situacao: 'regular' | 'irregular' | 'indeterminado';
  rntrc?: string | null;
  message?: string;
  is_stub: boolean;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

export default async (req: Request): Promise<Response> => {
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

  const cpfCnpj = onlyDigits(body.cpf_cnpj ?? '');
  const plate = normalizePlate(body.vehicle_plate ?? '');
  if (!body.order_id || !cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    return new Response(
      JSON.stringify({
        error: 'Campos obrigatórios: order_id, cpf_cnpj (11 ou 14 dígitos), vehicle_plate',
      }),
      {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      }
    );
  }
  if (!plate || plate.length < 7) {
    return new Response(JSON.stringify({ error: 'Placa do veículo inválida' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Stub: substituir por fluxo real (Playwright/serviço) quando disponível.
  const stub: AnttRntrcCheckResponse = {
    situacao: 'regular',
    rntrc: `STUB-${plate.slice(-4)}-${cpfCnpj.slice(-4)}`,
    message: 'Resultado simulado — configure integração ANTT para consulta real.',
    is_stub: true,
  };

  return new Response(JSON.stringify(stub), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
};
