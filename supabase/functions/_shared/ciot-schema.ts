/**
 * Zod schemas para validação de payloads CIOT
 * Alinhados ao DCS da ANTT — camelCase nos campos de payload oficial
 */
import { z } from 'zod';

export const ciotAmbienteSchema = z.enum(['homologacao', 'producao']);

export const ciotOperacaoPayloadSchema = z.object({
  cpfCnpj: z.string().min(11).max(14).regex(/^\d+$/, 'cpfCnpj deve conter apenas números'),
  transportadorCnpj: z
    .string()
    .length(14)
    .regex(/^\d+$/, 'transportadorCnpj deve conter apenas números'),
  placa: z
    .string()
    .min(7)
    .max(7)
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i, 'placa deve estar no padrão Mercosul ou antigo'),
  valorFrete: z.number().min(0, 'valorFrete deve ser >= 0'),
  pesoTotalKg: z.number().min(0, 'pesoTotalKg deve ser >= 0'),
  ambiente: ciotAmbienteSchema,
  distanciaKm: z.number().min(0).optional(),
  serviceOrderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
});

export const ciotGenerateRequestSchema = z.object({
  orderId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  payload: ciotOperacaoPayloadSchema.optional(),
  allowBelowFloor: z.boolean().optional(),
});

export const ciotBridgeResponseSchema = z.object({
  success: z.boolean(),
  ciotNumber: z.string().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});
