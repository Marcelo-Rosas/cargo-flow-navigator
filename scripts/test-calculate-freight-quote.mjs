import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.local', override: true });
config({ path: '.env.e2e' });

const code = process.argv[2] ?? 'COT-2026-06-0004';
const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, sr);
const { data: q, error } = await admin
  .from('quotes')
  .select(
    'origin, destination, km_distance, weight, volume, cargo_value, toll_value, price_table_id, freight_modality, pricing_breakdown, vehicle_types(code), payment_terms(code)'
  )
  .eq('quote_code', code)
  .single();

if (error || !q) {
  console.error('quote not found', error?.message);
  process.exit(1);
}

const bd = q.pricing_breakdown ?? {};
const payload = {
  origin: q.origin,
  destination: q.destination,
  km_distance: Number(q.km_distance) || 0,
  weight_kg: Number(q.weight) || 1,
  volume_m3: Number(q.volume) || 0,
  cargo_value: Number(q.cargo_value) || 0,
  toll_value: Number(q.toll_value) || 0,
  price_table_id: q.price_table_id,
  vehicle_type_code: q.vehicle_types?.code,
  payment_term_code: q.payment_terms?.code ?? 'D30',
  descarga_value: bd.profitability?.custosDescarga ?? 0,
  aluguel_maquinas_value: bd.components?.aluguelMaquinas ?? 0,
  regime_lucro_presumido: true,
  ...(q.freight_modality === 'lotacao'
    ? { antt_composicao_veicular: false, antt_alto_desempenho: false, antt_retorno_vazio: false }
    : {}),
};

const user = createClient(url, anon);
await user.auth.signInWithPassword({
  email: process.env.PW_TEST_USER,
  password: process.env.PW_TEST_PASSWORD,
});
const {
  data: { session },
} = await user.auth.getSession();

const res = await fetch(`${url}/functions/v1/calculate-freight`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    apikey: anon,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log('status', res.status);
console.log(text.slice(0, 1500));
