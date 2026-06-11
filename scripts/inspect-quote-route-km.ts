/**
 * Rota, paradas e origem do km_distance de uma cotação.
 *   npx tsx scripts/inspect-quote-route-km.ts COT-2026-06-0004
 */
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import { createClient } from '@supabase/supabase-js';

const quoteCode = process.argv[2] ?? 'COT-2026-06-0004';
const { url, serviceRoleKey } = loadSupabaseScriptEnv();
const sb = createClient(url, serviceRoleKey);

const { data: q, error } = await sb
  .from('quotes')
  .select(
    `id, quote_code, origin, destination, origin_cep, destination_cep, km_distance,
     freight_modality, vehicle_type_id, price_table_id,
     vehicle_types ( name, code, axes_count ),
     pricing_breakdown`
  )
  .eq('quote_code', quoteCode)
  .maybeSingle();

if (error || !q) {
  console.error(error?.message ?? `Cotação não encontrada: ${quoteCode}`);
  process.exit(1);
}

const { data: stops } = await sb
  .from('quote_route_stops')
  .select('stop_order, city, uf, cep, km_from_previous, lat, lng')
  .eq('quote_id', q.id)
  .order('stop_order', { ascending: true });

const meta = (q.pricing_breakdown as { meta?: Record<string, unknown> } | null)?.meta;
const antt = meta?.antt as Record<string, unknown> | undefined;
const kmSaved = Number(q.km_distance ?? 0);
const kmAnttMeta = Number(antt?.kmDistance ?? 0);
const kmStopsSum = stops?.reduce((s, st) => s + (Number(st.km_from_previous) || 0), 0) ?? 0;

console.log('=== COT', quoteCode, '===');
console.log({
  origin: q.origin,
  destination: q.destination,
  origin_cep: q.origin_cep,
  destination_cep: q.destination_cep,
  freight_modality: q.freight_modality,
  vehicle: q.vehicle_types,
  km_distance_quotes: kmSaved,
  km_meta_antt: kmAnttMeta,
  km_sum_route_stops: kmStopsSum || null,
  km_band: meta?.kmBandLabel,
  route_uf: meta?.routeUfLabel,
});

console.log('\n=== Paradas (quote_route_stops) ===');
if (!stops?.length) {
  console.log('(nenhuma parada cadastrada — km veio do roteirizador no wizard ou edição manual)');
} else {
  for (const st of stops) {
    console.log(
      `  #${st.stop_order} ${st.city ?? ''}-${st.uf ?? ''} | +${st.km_from_previous ?? '?'} km`
    );
  }
}

console.log('\n=== ANTT no breakdown ===');
console.log(antt ?? '(sem meta.antt)');

if (kmSaved > 0 && kmAnttMeta > 0 && Math.abs(kmSaved - kmAnttMeta) > 0.5) {
  console.log('\n⚠ km_distance da cotação difere do km gravado no meta.antt');
}
