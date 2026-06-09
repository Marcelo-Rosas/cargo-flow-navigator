/**
 * Inspeciona qualificação de motorista por os_number.
 *   npx tsx scripts/inspect-driver-qualification.ts OS-2026-06-0002
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const osNumber = process.argv[2] ?? 'OS-2026-06-0002';
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SR_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SR_KEY no .env');
  process.exit(1);
}

const sb = createClient(url, key);

async function main() {
  const { data: order, error: orderErr } = await sb
    .from('orders')
    .select(
      'id, os_number, stage, driver_name, driver_phone, vehicle_plate, vehicle_type_name, has_cnh, has_crlv, has_comp_residencia, has_antt_motorista, cargo_value, driver_id, drivers!orders_driver_id_fkey(cpf, cnh, antt, contract_type)'
    )
    .eq('os_number', osNumber)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) {
    console.error(`OS não encontrada: ${osNumber}`);
    process.exit(1);
  }

  const { data: qualifications, error: dqErr } = await sb
    .from('driver_qualifications')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (dqErr) throw dqErr;

  const { data: riskEval } = await sb
    .from('risk_evaluations')
    .select('id, status, criticality, cargo_value_evaluated')
    .eq('entity_type', 'order')
    .eq('entity_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1);

  console.log(
    JSON.stringify(
      {
        order: {
          os_number: order.os_number,
          stage: order.stage,
          driver_name: order.driver_name,
          vehicle_plate: order.vehicle_plate,
          docs: {
            has_cnh: order.has_cnh,
            has_crlv: order.has_crlv,
            has_comp_residencia: order.has_comp_residencia,
            has_antt_motorista: order.has_antt_motorista,
          },
          cargo_value_centavos: order.cargo_value,
          driver: order.drivers,
        },
        driver_qualification: qualifications?.[0] ?? null,
        risk_evaluation: riskEval?.[0] ?? null,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
