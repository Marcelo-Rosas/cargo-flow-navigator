import { useMutation } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface ProfessionalCheckRequest {
  order_id: string;
  driver_cpf: string;
  vehicle_plate: string;
  cargo_value: number;
  origin_uf: string;
  destination_uf: string;
  origin_city?: string;
  destination_city?: string;
}

export type BuonnyDriverStatus =
  | 'PERFIL ADEQUADO AO RISCO'
  | 'PERFIL DIVERGENTE'
  | 'PERFIL COM INSUFICIÊNCIA DE DADOS'
  | 'EM ANÁLISE'
  | 'PERFIL EXPIRADO';

export interface ProfessionalCheckResponse {
  status: BuonnyDriverStatus;
  numero_liberacao?: string;
  message?: string;
  qualification_id?: string;
  is_stub: boolean;
}

export function useBuonnyProfessionalCheck() {
  return useMutation<ProfessionalCheckResponse, Error, ProfessionalCheckRequest>({
    mutationFn: async (req) => {
      // #region agent log
      fetch('http://127.0.0.1:7333/ingest/7c74a617-3c22-440f-aba9-f084415888f1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '609233' },
        body: JSON.stringify({
          sessionId: '609233',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'src/hooks/useBuonnyProfessionalCheck.ts:33',
          message: 'useBuonnyProfessionalCheck mutation start',
          data: {
            orderId: req.order_id,
            originUf: req.origin_uf,
            destinationUf: req.destination_uf,
            cargoValue: req.cargo_value,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return invokeEdgeFunction<ProfessionalCheckResponse>('buonny-professional-check', {
        body: req,
      });
    },
  });
}
