import { useMutation } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface AnttRntrcCheckRequest {
  order_id: string;
  /** CPF ou CNPJ apenas dígitos — obrigatório para operation='rntrc' */
  cpf_cnpj?: string;
  /** Placa do veículo — obrigatório para 'veiculo' e 'vpo', usado por 'rntrc' */
  vehicle_plate?: string;
  /** RNTRC do motorista (drivers.antt) — obrigatório para 'ciot', melhora 'rntrc'/'veiculo' */
  rntrc?: string;
  /** RENAVAM do veículo — obrigatório para operation='ciot' */
  renavam?: string;
  /**
   * 'rntrc'   (default) — Por Transportador; cpf_cnpj obrigatório
   * 'veiculo'            — Por Veículo; identifica transportador vinculado à placa
   * 'ciot'               — Verifica CIOT Agregado; rntrc + renavam obrigatórios
   * 'vpo'                — Vale-Pedágio Obrigatório; vehicle_plate obrigatório
   */
  operation?: 'rntrc' | 'veiculo' | 'ciot' | 'vpo';
}

export type AnttRntrcSituacao = 'regular' | 'irregular' | 'indeterminado';

export interface CiotResult {
  found: boolean;
  ciot?: string | null;
  status?: string | null;
  transportador?: string | null;
  embarcador?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  mensagem?: string;
}

export interface AnttRntrcCheckResponse {
  situacao: AnttRntrcSituacao;
  /** ATIVO / VENCIDO / CANCELADO conforme tabela ANTT */
  situacao_raw?: string;
  rntrc?: string | null;
  /** Nome do transportador conforme cadastro ANTT */
  transportador?: string;
  /** CPF/CNPJ mascarado retornado pelo portal (ex: XXX.465.204-XX) */
  cpf_cnpj_mask?: string;
  cadastrado_desde?: string;
  municipio_uf?: string;
  /** true quando Corpo_lblMsg confirma "apto a realizar transporte" */
  apto?: boolean;
  /** Apenas para operation='veiculo': veículo está na frota do transportador */
  veiculo_na_frota?: boolean;
  /** Resultado da consulta CIOT (só presente quando operation='ciot') */
  ciot?: CiotResult;
  message?: string;
  is_stub: boolean;
}

export function useAnttRntrcCheck() {
  return useMutation<AnttRntrcCheckResponse, Error, AnttRntrcCheckRequest>({
    mutationFn: async (req) =>
      invokeEdgeFunction<AnttRntrcCheckResponse>('antt-rntrc-check', { body: req }),
  });
}
