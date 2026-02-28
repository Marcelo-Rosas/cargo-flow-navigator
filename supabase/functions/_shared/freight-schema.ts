/**
 * Zod schema for calculate-freight payload validation
 */
import { z } from 'zod';

export const calculateFreightInputSchema = z
  .object({
    origin: z.string().min(1, 'Campo "origin" é obrigatório'),
    destination: z.string().min(1, 'Campo "destination" é obrigatório'),
    km_distance: z.number().min(0, 'km_distance deve ser >= 0'),
    weight_kg: z.number().min(0, 'weight_kg deve ser >= 0'),
    volume_m3: z.number().min(0, 'volume_m3 deve ser >= 0'),
    cargo_value: z.number().min(0, 'cargo_value deve ser >= 0'),
    toll_value: z.number().min(0).optional(),
    price_table_id: z
      .string()
      .optional()
      .transform((v: string | undefined) => (v === '' ? undefined : v)),
    vehicle_type_code: z.string().optional(),
    payment_term_code: z.string().optional(),
    tde_enabled: z.boolean().optional(),
    tear_enabled: z.boolean().optional(),
    conditional_fees: z.array(z.string()).optional(),
    waiting_hours: z.number().min(0).optional(),
    das_percent: z.number().min(0).max(100).optional(),
    markup_percent: z.number().min(0).optional(),
    overhead_percent: z.number().min(0).optional(),
    carreteiro_percent: z.number().min(0).max(100).optional(),
    descarga_value: z.number().min(0).optional(),
    aluguel_maquinas_value: z.number().min(0).optional(),
  })
  .refine(
    (data: { weight_kg: number; volume_m3: number }) => data.weight_kg > 0 || data.volume_m3 > 0,
    {
      message: 'weight_kg e volume_m3 não podem ser ambos zero',
      path: ['weight_kg'],
    }
  );
