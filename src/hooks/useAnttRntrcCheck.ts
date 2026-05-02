import { useMutation } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface AnttRntrcCheckRequest {
  order_id: string;
  /** CPF ou CNPJ apenas dígitos */
  cpf_cnpj: string;
  /** Placa do veículo (normalizada no servidor) */
  vehicle_plate: string;
}

/** Situação retornada pela consulta (portal ANTT / stub). */
export type AnttRntrcSituacao = 'regular' | 'irregular' | 'indeterminado';

export interface AnttRntrcCheckResponse {
  situacao: AnttRntrcSituacao;
  rntrc?: string | null;
  message?: string;
  is_stub: boolean;
}

export function useAnttRntrcCheck() {
  return useMutation<AnttRntrcCheckResponse, Error, AnttRntrcCheckRequest>({
    mutationFn: async (req) =>
      invokeEdgeFunction<AnttRntrcCheckResponse>('antt-rntrc-check', { body: req }),
  });
}
