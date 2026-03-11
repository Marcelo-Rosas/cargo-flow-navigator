/** Agrupamento do relatório DRE comparativo */
export type DreGroupBy = 'order' | 'trip' | 'quote';

/** Linha do DRE comparativo Presumido vs Real Operacional
 * Regra contábil: receita, tributos e overhead permanecem fixos.
 * Apenas custos operacionais reais variam. */
export interface DreComparativoRow {
  entityId: string;
  entityLabel: string;
  entityType: DreGroupBy;

  /** Faturamento (Total Cliente) - FIXO entre presumido e real */
  receitaPresumida: number;
  receitaReal: number;

  dasPresumido: number;
  dasReal: number;

  icmsPresumido: number;
  icmsReal: number;

  receitaLiquidaPresumida: number;
  receitaLiquidaReal: number;

  /** Custos operacionais - VARIAM no real */
  custoMotoristaPresumido: number;
  custoMotoristaReal: number;

  pedagioPresumido: number;
  pedagioReal: number;

  /** Aluguel de máquinas - orders não tem aluguel_maquinas_real, usa presumido */
  aluguelMaquinasPresumido: number;
  aluguelMaquinasReal: number;

  /** Carga e descarga - descarga_real em orders */
  descargaPresumida: number;
  descargaReal: number;

  /** Mão de obra - não existe campo real em orders, mantém 0 */
  maoDeObraPresumida: number;
  maoDeObraReal: number;

  custosDiretosPresumidos: number;
  custosDiretosReais: number;

  /** Overhead - FIXO entre presumido e real */
  overheadPresumido: number;
  overheadReal: number;

  resultadoPresumido: number;
  resultadoReal: number;

  margemPresumidaPercent: number;
  margemRealPercent: number;

  deltaResultado: number;
  deltaPercent: number;
}

/** Estrutura do pricing_breakdown em orders (JSON do quote) */
export interface OrderPricingBreakdown {
  totals?: {
    receitaBruta?: number;
    totalCliente?: number;
    das?: number;
    icms?: number;
  };
  profitability?: {
    custoMotorista?: number;
    custosCarreteiro?: number;
    custosDescarga?: number;
    custosDiretos?: number;
    receitaLiquida?: number;
    overhead?: number;
    resultadoLiquido?: number;
    margemPercent?: number;
  };
  components?: {
    toll?: number;
    aluguelMaquinas?: number;
  };
}

/** Dados brutos de uma ordem para cálculo DRE */
export interface OrderDreInput {
  id: string;
  os_number: string;
  quote_id: string | null;
  trip_id: string | null;
  value: number;
  created_at: string;
  pricing_breakdown: OrderPricingBreakdown | null;
  carreteiro_real: number | null;
  pedagio_real: number | null;
  descarga_real: number | null;
  quote_code?: string | null;
  trip_number?: string | null;
}
