/**
 * Buonny Insurance Check Worker
 * Edge Function para validação e cotação de seguro de carga
 *
 * Fluxo:
 * 1. Recebe: origin_uf, destination_uf, weight, product_type
 * 2. Valida elegibilidade + chama API Buonny (ou fallback)
 * 3. Grava log estruturado em insurance_logs
 * 4. Retorna: { options: InsuranceOption[], cached?, timestamp? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface InsuranceOption {
  coverage_type: 'BASIC' | 'STANDARD' | 'PLUS';
  estimated_premium: number; // centavos
  features: string[];
  restrictions: string[];
  risk_level?: 'low' | 'medium' | 'high';
}

interface CheckWorkerRequest {
  origin_uf: string;
  destination_uf: string;
  weight: number;
  product_type: string;
}

interface CheckWorkerResponse {
  options: InsuranceOption[];
  cached?: boolean;
  timestamp?: string;
}

interface InsuranceLog {
  environment: string;
  source: string;
  function_name: string;
  request_id: string;
  status: 'success' | 'error' | 'timeout' | 'rate_limit' | 'fallback';
  error_code?: string;
  duration_ms: number;
  origin_uf: string;
  destination_uf: string;
  weight: number;
  product_type: string;
  fallback_used: boolean;
  premium_estimate?: number; // centavos, média ou principal opção
  raw: Record<string, unknown>;
}

// Default coverage options (fallback)
const DEFAULT_COVERAGE_OPTIONS: InsuranceOption[] = [
  {
    coverage_type: 'BASIC',
    estimated_premium: 50000, // R$ 500
    features: ['Cobertura básica contra danos', 'Roubo total do veículo', 'Assistência 24h'],
    restrictions: ['Limite máximo: R$ 50.000', 'Franquia: R$ 1.000'],
    risk_level: 'low',
  },
  {
    coverage_type: 'STANDARD',
    estimated_premium: 100000, // R$ 1.000
    features: [
      'Cobertura completa contra danos',
      'Roubo total do veículo',
      'Avarias em carga',
      'Assistência 24h prioritária',
      'Cobertura de atraso',
    ],
    restrictions: ['Limite máximo: R$ 100.000', 'Franquia: R$ 500'],
    risk_level: 'medium',
  },
  {
    coverage_type: 'PLUS',
    estimated_premium: 150000, // R$ 1.500
    features: [
      'Cobertura total sem limites',
      'Roubo total do veículo',
      'Avarias em carga premium',
      'Responsabilidade civil',
      'Assistência 24h VIP',
      'Cobertura internacional',
      'Cobertura de atraso estendida',
    ],
    restrictions: ['Limite máximo: Sem limite', 'Franquia: Sem franquia'],
    risk_level: 'high',
  },
];

/**
 * Grava log estruturado em insurance_logs
 */
async function logInsuranceCheck(
  supabase: ReturnType<typeof createClient>,
  log: InsuranceLog
): Promise<void> {
  try {
    const { error } = await supabase.from('insurance_logs').insert([
      {
        environment: log.environment,
        source: log.source,
        function_name: log.function_name,
        request_id: log.request_id,
        status: log.status,
        error_code: log.error_code,
        duration_ms: log.duration_ms,
        origin_uf: log.origin_uf,
        destination_uf: log.destination_uf,
        weight: log.weight,
        product_type: log.product_type,
        fallback_used: log.fallback_used,
        premium_estimate: log.premium_estimate,
        raw: log.raw,
      },
    ]);

    if (error) {
      console.error(
        JSON.stringify({
          level: 'ERROR',
          context: 'log_insert_failed',
          error: error.message,
          request_id: log.request_id,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        context: 'log_insert_exception',
        error: String(err),
        request_id: log.request_id,
      })
    );
  }
}

/**
 * Valida request e extrai UF
 */
function validateRequest(req: CheckWorkerRequest): { valid: boolean; error?: string } {
  if (!req.origin_uf || !/^[A-Z]{2}$/.test(req.origin_uf)) {
    return { valid: false, error: 'Invalid origin_uf format' };
  }
  if (!req.destination_uf || !/^[A-Z]{2}$/.test(req.destination_uf)) {
    return { valid: false, error: 'Invalid destination_uf format' };
  }
  if (!req.weight || req.weight <= 0) {
    return { valid: false, error: 'Invalid weight (must be > 0)' };
  }
  if (!req.product_type) {
    return { valid: false, error: 'Missing product_type' };
  }
  return { valid: true };
}

/**
 * Main handler
 */
export default async (req: Request): Promise<Response> => {
  const startTime = performance.now();
  const requestId = crypto.randomUUID();
  const environment = Deno.env.get('ENVIRONMENT') || 'prod';

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Parse request
  let body: CheckWorkerRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate
  const validation = validateRequest(body);
  if (!validation.valid) {
    const duration = performance.now() - startTime;

    // Initialize Supabase for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      await logInsuranceCheck(supabase, {
        environment,
        source: 'edge_function',
        function_name: 'buonny-check-worker',
        request_id: requestId,
        status: 'error',
        error_code: 'VALIDATION_ERROR',
        duration_ms: Math.round(duration),
        origin_uf: body.origin_uf || '??',
        destination_uf: body.destination_uf || '??',
        weight: body.weight || 0,
        product_type: body.product_type || 'unknown',
        fallback_used: false,
        raw: { validation_error: validation.error },
      });
    }

    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Initialize Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        context: 'missing_supabase_env',
        request_id: requestId,
      })
    );

    return new Response(
      JSON.stringify({
        options: DEFAULT_COVERAGE_OPTIONS,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const duration = Math.round(performance.now() - startTime);

  try {
    // TODO: Call real Buonny API here
    // For now, use DEFAULT_COVERAGE_OPTIONS as mock
    const options = DEFAULT_COVERAGE_OPTIONS;
    const fallbackUsed = false;

    // Log success
    await logInsuranceCheck(supabase, {
      environment,
      source: 'edge_function',
      function_name: 'buonny-check-worker',
      request_id: requestId,
      status: 'success',
      duration_ms: duration,
      origin_uf: body.origin_uf,
      destination_uf: body.destination_uf,
      weight: body.weight,
      product_type: body.product_type,
      fallback_used: fallbackUsed,
      premium_estimate: options[1]?.estimated_premium || options[0]?.estimated_premium, // STANDARD or BASIC
      raw: {
        options_count: options.length,
      },
    });

    const response: CheckWorkerResponse = {
      options,
      cached: false,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = errorMessage.includes('timeout')
      ? 'TIMEOUT_ERROR'
      : errorMessage.includes('429')
        ? 'RATE_LIMIT_ERROR'
        : 'API_ERROR';

    // Log error
    await logInsuranceCheck(supabase, {
      environment,
      source: 'edge_function',
      function_name: 'buonny-check-worker',
      request_id: requestId,
      status:
        errorCode === 'TIMEOUT_ERROR'
          ? 'timeout'
          : errorCode === 'RATE_LIMIT_ERROR'
            ? 'rate_limit'
            : 'error',
      error_code: errorCode,
      duration_ms: duration,
      origin_uf: body.origin_uf,
      destination_uf: body.destination_uf,
      weight: body.weight,
      product_type: body.product_type,
      fallback_used: true,
      premium_estimate: DEFAULT_COVERAGE_OPTIONS[1]?.estimated_premium,
      raw: {
        error: errorMessage,
      },
    });

    // Return fallback
    const response: CheckWorkerResponse = {
      options: DEFAULT_COVERAGE_OPTIONS,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
