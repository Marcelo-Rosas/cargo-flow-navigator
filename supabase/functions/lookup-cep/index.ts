const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  formatted: string;
}

async function fetchViaCep(cep: string): Promise<CepData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const json = await response.json();
    if (json.erro) return null;

    return {
      cep: json.cep,
      logradouro: json.logradouro || '',
      complemento: json.complemento || '',
      bairro: json.bairro || '',
      localidade: json.localidade,
      uf: json.uf,
      ibge: json.ibge || '',
      formatted: `${json.localidade} - ${json.uf}`,
    };
  } catch {
    return null;
  }
}

async function fetchBrasilApi(cep: string): Promise<CepData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const json = await response.json();

    return {
      cep: json.cep,
      logradouro: json.street || '',
      complemento: '',
      bairro: json.neighborhood || '',
      localidade: json.city,
      uf: json.state,
      ibge: json.ibge || '',
      formatted: `${json.city} - ${json.state}`,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cep } = await req.json();

    // Validação: apenas dígitos, 8 caracteres
    const cleanCep = cep?.replace(/\D/g, '');
    if (!cleanCep || cleanCep.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'CEP inválido. Informe 8 dígitos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lookup-cep] Buscando CEP:', cleanCep);

    // Tentar ViaCEP primeiro
    let data = await fetchViaCep(cleanCep);

    // Fallback para BrasilAPI se ViaCEP falhar
    if (!data) {
      console.log('[lookup-cep] ViaCEP falhou, tentando BrasilAPI');
      data = await fetchBrasilApi(cleanCep);
    }

    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: 'CEP não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[lookup-cep] Sucesso:', data.formatted);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[lookup-cep] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao buscar CEP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
