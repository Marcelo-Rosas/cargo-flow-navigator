/**
 * ============================================
 * CIOT - Comprovante de Interesse de Operação de Transporte
 * Tipos alinhados ao DCS da ANTT (camelCase para payload oficial)
 * ============================================
 */

export type CiotAmbiente = 'homologacao' | 'producao';
export type CiotStatus = 'pending' | 'generated' | 'cancelled' | 'error' | 'validation_failed';

export interface CiotContratante {
  cpfCnpj: string;
  nome?: string;
}

export interface CiotVeiculo {
  placa: string;
  renavam?: string;
  tara?: number;
  capacidadeKg?: number;
}

export interface CiotEndereco {
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio: string;
  uf: string;
  cep: string;
}

export interface CiotOperacaoPayload {
  /** CPF/CNPJ do contratante (quem paga o frete) — 11 ou 14 dígitos */
  cpfCnpj: string;
  /** CNPJ do transportador — 14 dígitos */
  transportadorCnpj: string;
  /** Placa no padrão Mercosul ou antigo */
  placa: string;
  /** Valor do frete em R$ (deve ser >= piso ANTT) */
  valorFrete: number;
  /** Peso total da carga em kg */
  pesoTotalKg: number;
  /** Ambiente: homologacao ou producao */
  ambiente: CiotAmbiente;
  /** Distância em km (para validação de piso) */
  distanciaKm?: number;
  /** Identificador interno da ordem de serviço */
  serviceOrderId?: string;
  /** Identificador interno da cotação */
  quoteId?: string;
}

export interface CiotOperacao {
  id: string;
  serviceOrderId?: string;
  quoteId?: string;
  /** Número do CIOT retornado pela ANTT */
  ciotNumber?: string;
  status: CiotStatus;
  ambiente: CiotAmbiente;
  payload: CiotOperacaoPayload;
  /** Resposta bruta da ANTT (ou do bridge) */
  rawResponse?: Record<string, unknown>;
  /** Mensagem de erro, se houver */
  errorMessage?: string;
  /** Valor do piso ANTT calculado no momento da geração */
  anttPisoMinimo?: number;
  /** true se o valor do frete está abaixo do piso ANTT */
  belowFloor?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CiotGenerateRequest {
  orderId?: string;
  quoteId?: string;
  /** Dados da operação (obrigatórios se orderId não fornecido) */
  payload?: CiotOperacaoPayload;
  /** Permitir geração mesmo abaixo do piso (apenas homologação) */
  allowBelowFloor?: boolean;
}

export interface CiotGenerateResponse {
  success: boolean;
  ciotNumber?: string;
  status: CiotStatus;
  message?: string;
  operationId?: string;
  anttPisoMinimo?: number;
  belowFloor?: boolean;
}

export interface CiotBridgeRequest {
  operation: 'generate' | 'query' | 'cancel';
  payload: CiotOperacaoPayload;
}

export interface CiotBridgeResponse {
  success: boolean;
  ciotNumber?: string;
  status?: string;
  message?: string;
  raw?: Record<string, unknown>;
}
