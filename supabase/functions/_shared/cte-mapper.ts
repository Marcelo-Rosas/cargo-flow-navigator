// @ts-nocheck
/**
 * cte-mapper: build a Focus NFe CT-e payload from a CFN quote + shipper + client.
 *
 * Caller responsibility:
 *   - Load quote, shipper, client rows from DB.
 *   - Allocate (serie, numero) via public.next_cte_numero RPC.
 *   - Provide Vectra emitter config (env-derived).
 *   - Resolve missing IBGE via ibge-lookup if needed.
 *
 * This function only transforms data → no DB access, no network.
 */

import { resolveCfopCte, type IndicadorIE } from './cfop-resolver.ts';

export interface VectraConfig {
  cnpj: string;
  nome: string;
  fantasia: string;
  ie: string;
  iest: string; // may equal IE if no ST registration
  rntrc: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  ibge: number;
  uf: string;
  cep: string;
  telefone?: string;
  crt: number; // 1=Simples, 2=Simples sublimite, 3=Normal/LP
}

export interface QuoteRow {
  id: string;
  quote_code?: string | null;
  client_id?: string | null;
  shipper_id?: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_cep?: string | null;
  destination_cep?: string | null;
  origin_ibge?: number | null;
  destination_ibge?: number | null;
  origin_uf?: string | null;
  destination_uf?: string | null;
  value: number; // total CT-e (R$, NOT centavos in this column per existing schema)
  cargo_value?: number | null;
  weight?: number | null; // kg
  cubage_weight?: number | null;
  billable_weight?: number | null;
  cargo_type?: string | null;
  freight_type?: string | null; // 'fracionado' | 'lotacao' | etc
  freight_modality?: string | null;
  pricing_breakdown?: PricingBreakdown | null;
  toll_value?: number | null;
  tomador_tipo: number; // 0-4 (required for CT-e)
  nfe_keys?: string[] | null;
}

export interface PartyRow {
  id: string;
  name: string;
  cnpj?: string | null;
  cpf?: string | null;
  state_registration?: string | null;
  ie_indicator?: IndicadorIE | null;
  ibge_code?: number | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PricingBreakdown {
  // Edge calculate-freight returns snake_case
  frete_peso?: number;
  frete_valor?: number;
  gris?: number;
  tso?: number;
  pedagio?: number;
  ad_valorem?: number;
  tac?: number;
  dispatch_fee?: number;
  // ICMS
  icms_base?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  [key: string]: unknown;
}

export interface BuildCteInput {
  quote: QuoteRow;
  shipper: PartyRow;
  client: PartyRow;
  serie: number;
  numero: number;
  vectra: VectraConfig;
  // Optional: override tomador (party defaults to client/destinatario)
  expedidor?: PartyRow; // defaults to shipper
  recebedor?: PartyRow; // defaults to client
  naturezaOperacao?: string;
}

export interface BuildCteResult {
  ref: string;
  payload: Record<string, unknown>;
  warnings: string[];
}

function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

function moneyToBRL(value: number | null | undefined): number {
  if (value == null) return 0;
  // quote.value is already in R$ (numeric), not centavos
  return Number(value.toFixed(2));
}

function nz<T>(value: T | null | undefined, fallback: T): T {
  return value == null ? fallback : value;
}

function requireField(
  value: string | number | null | undefined,
  name: string,
  warnings: string[]
): string {
  if (value == null || value === '') {
    warnings.push(`Missing required field: ${name}`);
    return '';
  }
  return String(value);
}

function partyDoc(p: PartyRow): { cnpj?: string; cpf?: string } {
  const cnpj = digits(p.cnpj);
  if (cnpj.length === 14) return { cnpj };
  const cpf = digits(p.cpf);
  if (cpf.length === 11) return { cpf };
  return {};
}

function buildEnderecoFields(prefix: string, p: PartyRow): Record<string, unknown> {
  return {
    [`logradouro_${prefix}`]: p.address ?? '',
    [`numero_${prefix}`]: p.address_number ?? 'S/N',
    ...(p.address_complement ? { [`complemento_${prefix}`]: p.address_complement } : {}),
    [`bairro_${prefix}`]: p.address_neighborhood ?? '',
    [`codigo_municipio_${prefix}`]: p.ibge_code ?? null,
    [`municipio_${prefix}`]: p.city ?? '',
    [`uf_${prefix}`]: p.state ?? '',
    [`cep_${prefix}`]: digits(p.zip_code),
    [`codigo_pais_${prefix}`]: 1058,
    [`pais_${prefix}`]: 'Brasil',
  };
}

function buildComponentes(
  pb: PricingBreakdown | null | undefined
): Array<{ nome: string; valor: number }> {
  if (!pb) return [];
  const map: Array<[string, number | undefined]> = [
    ['FRETE PESO', pb.frete_peso],
    ['FRETE VALOR', pb.frete_valor],
    ['GRIS', pb.gris],
    ['TSO', pb.tso],
    ['PEDAGIO', pb.pedagio],
    ['AD VALOREM', pb.ad_valorem],
    ['TAC', pb.tac],
    ['DESPACHO', pb.dispatch_fee],
  ];
  return map
    .filter(([_, v]) => typeof v === 'number' && v > 0)
    .map(([nome, valor]) => ({ nome, valor: Number((valor as number).toFixed(2)) }));
}

export function buildCteRef(quoteCode: string, retry = 0): string {
  const code = quoteCode || 'NOCODE';
  return retry > 0 ? `CFN-CTE-${code}-r${retry}` : `CFN-CTE-${code}`;
}

export function buildCtePayload(input: BuildCteInput): BuildCteResult {
  const { quote, shipper, client, serie, numero, vectra } = input;
  const expedidor = input.expedidor ?? shipper;
  const recebedor = input.recebedor ?? client;
  const warnings: string[] = [];

  const ufOrigem = (quote.origin_uf || shipper.state || vectra.uf).toUpperCase();
  const ufDestino = (quote.destination_uf || client.state || '').toUpperCase();

  const tomadorIndicadorIE = (client.ie_indicator ?? 1) as IndicadorIE;
  const cfop = resolveCfopCte({
    ufOrigem,
    ufDestino,
    tomadorIndicadorIE,
  });

  const componentes = buildComponentes(quote.pricing_breakdown ?? undefined);
  const valorTotal = moneyToBRL(quote.value);
  const valorReceber = moneyToBRL(quote.value);

  const ref = buildCteRef(quote.quote_code ?? quote.id);

  // ICMS — Lucro Presumido / Normal: CST 00 (tributação integral)
  const icmsAliquota = quote.pricing_breakdown?.icms_aliquota ?? null;
  const icmsBase = quote.pricing_breakdown?.icms_base ?? valorTotal;
  const icmsValor = quote.pricing_breakdown?.icms_valor ?? null;

  const payload: Record<string, unknown> = {
    // === ide ===
    cfop,
    natureza_operacao: input.naturezaOperacao ?? 'PRESTACAO DE SERVICO DE TRANSPORTE',
    data_emissao: new Date().toISOString().slice(0, 19),
    tipo_documento: 0, // 0 = Normal
    modal: '01', // 01 = Rodoviário
    tipo_servico: 0, // 0 = Normal
    serie,
    numero,
    codigo_municipio_envio: shipper.ibge_code ?? null,
    municipio_envio: shipper.city ?? '',
    uf_envio: ufOrigem,
    codigo_municipio_inicio: quote.origin_ibge ?? shipper.ibge_code ?? null,
    municipio_inicio: quote.origin ?? shipper.city ?? '',
    uf_inicio: ufOrigem,
    codigo_municipio_fim: quote.destination_ibge ?? client.ibge_code ?? null,
    municipio_fim: quote.destination ?? client.city ?? '',
    uf_fim: ufDestino,
    retirar_mercadoria: 0,
    detalhes_retirar: nz(quote.cargo_type, 'CARGA GERAL'),

    // === emitente ===
    cnpj_emitente: vectra.cnpj,
    inscricao_estadual_emitente: vectra.ie,
    inscricao_estadual_st_emitente: vectra.iest,
    nome_emitente: vectra.nome,
    nome_fantasia_emitente: vectra.fantasia,
    crt_emitente: vectra.crt,
    logradouro_emitente: vectra.logradouro,
    numero_emitente: vectra.numero,
    ...(vectra.complemento ? { complemento_emitente: vectra.complemento } : {}),
    bairro_emitente: vectra.bairro,
    codigo_municipio_emitente: vectra.ibge,
    municipio_emitente: vectra.municipio,
    uf_emitente: vectra.uf,
    cep_emitente: vectra.cep,
    ...(vectra.telefone ? { telefone_emitente: vectra.telefone } : {}),

    // === remetente ===
    ...(shipper.cnpj ? { cnpj_remetente: digits(shipper.cnpj) } : {}),
    ...(shipper.cpf ? { cpf_remetente: digits(shipper.cpf) } : {}),
    nome_remetente: requireField(shipper.name, 'remetente.name', warnings),
    ...(shipper.state_registration && shipper.state_registration.trim() !== ''
      ? { inscricao_estadual_remetente: shipper.state_registration }
      : {}),
    telefone_remetente: digits(shipper.phone) || undefined,
    ...buildEnderecoFields('remetente', shipper),

    // === expedidor ===
    nome_expedidor: expedidor.name,
    ...(expedidor.cnpj ? { cnpj_expedidor: digits(expedidor.cnpj) } : {}),
    ...(expedidor.cpf ? { cpf_expedidor: digits(expedidor.cpf) } : {}),
    telefone_expedidor: digits(expedidor.phone) || undefined,
    ...buildEnderecoFields('expedidor', expedidor),

    // === recebedor ===
    nome_recebedor: recebedor.name,
    ...(recebedor.cnpj ? { cnpj_recebedor: digits(recebedor.cnpj) } : {}),
    ...(recebedor.cpf ? { cpf_recebedor: digits(recebedor.cpf) } : {}),
    telefone_recebedor: digits(recebedor.phone) || undefined,
    ...buildEnderecoFields('recebedor', recebedor),

    // === destinatário ===
    nome_destinatario: requireField(client.name, 'destinatario.name', warnings),
    ...(client.cnpj ? { cnpj_destinatario: digits(client.cnpj) } : {}),
    ...(client.cpf ? { cpf_destinatario: digits(client.cpf) } : {}),
    ...(client.state_registration && client.state_registration.trim() !== ''
      ? { inscricao_estadual_destinatario: client.state_registration }
      : {}),
    telefone_destinatario: digits(client.phone) || undefined,
    ...buildEnderecoFields('destinatario', client),

    // === tomador ===
    indicador_inscricao_estadual_tomador: tomadorIndicadorIE,
    tomador: quote.tomador_tipo,

    // === vPrest ===
    valor_total: valorTotal,
    valor_receber: valorReceber,
    componentes_valor_servico: componentes,

    // === ICMS (CST 00 — tributação normal LP) ===
    icms_situacao_tributaria: '00',
    ...(icmsBase != null ? { base_calculo_icms: Number(icmsBase.toFixed(2)) } : {}),
    ...(icmsAliquota != null ? { aliquota_icms: Number(icmsAliquota.toFixed(2)) } : {}),
    ...(icmsValor != null ? { valor_icms: Number(icmsValor.toFixed(2)) } : {}),

    // === infCarga ===
    valor_carga: moneyToBRL(quote.cargo_value),
    produto_predominante: nz(quote.cargo_type, 'CARGA GERAL'),
    quantidades: [
      {
        codigo_unidade_medida: '01', // 01 = KG
        tipo_medida: 'PESO BRUTO',
        quantidade: Number((quote.weight ?? 0).toFixed(3)),
      },
    ],

    // === modal rodoviário ===
    modal_rodoviario: {
      rntrc: vectra.rntrc,
    },

    // === documentos vinculados ===
    ...(quote.nfe_keys && quote.nfe_keys.length > 0
      ? { nfes: quote.nfe_keys.map((chave_nfe) => ({ chave_nfe })) }
      : {
          outros_documentos: [
            {
              tipo_documento: '99',
              descricao: 'DECLARACAO DE CARGA',
              numero: quote.quote_code ?? quote.id.slice(0, 8),
              data_emissao: new Date().toISOString().slice(0, 10),
              valor: moneyToBRL(quote.cargo_value),
            },
          ],
        }),

    // === info adicionais ===
    informacoes_adicionais_contribuinte: `Cotacao ${quote.quote_code ?? quote.id.slice(0, 8)} — emitido via CFN`,
  };

  // Validation warnings (non-blocking — caller decides)
  if (!shipper.ibge_code)
    warnings.push('shipper.ibge_code missing — codigo_municipio_remetente will be null');
  if (!client.ibge_code)
    warnings.push('client.ibge_code missing — codigo_municipio_destinatario will be null');
  if (!quote.origin_ibge)
    warnings.push('quote.origin_ibge missing — codigo_municipio_inicio fallback used');
  if (!quote.destination_ibge)
    warnings.push('quote.destination_ibge missing — codigo_municipio_fim fallback used');
  if (!ufDestino) warnings.push('destination_uf could not be resolved');
  if (quote.tomador_tipo == null) warnings.push('quote.tomador_tipo not set — required by SEFAZ');
  if (!quote.nfe_keys || quote.nfe_keys.length === 0)
    warnings.push('No NFe keys — using outros_documentos fallback (declaração de carga)');

  return { ref, payload, warnings };
}
