// @ts-nocheck
/**
 * mdfe-mapper: build a Focus NFe MDF-e (modelo 58) payload aggregating N CT-es
 * for a single (veículo + motorista + data + UF rota) operation.
 *
 * Caller responsibility:
 *   - Allocate (serie, numero) via public.next_mdfe_numero RPC.
 *   - Load CT-e rows already AUTHORIZED with chave_cte populated.
 *   - Load vehicle, driver, vectra config.
 *   - Provide percurso UFs (intermediate states between origin and destination).
 *
 * No DB access, no network.
 */

import type { VectraConfig } from './cte-mapper.ts';

export interface VehicleRow {
  id: string;
  plate: string;
  plate_2?: string | null; // reboque
  renavam?: string | null;
  brand?: string | null;
  model?: string | null;
  // Optional CT-e/MDF-e specific fields (may not be persisted yet)
  tara_kg?: number | null;
  capacidade_kg?: number | null;
  capacidade_m3?: number | null;
  tipo_rodado?: string | null; // '01'..'06' (truck/cavalo/etc)
  tipo_carroceria?: string | null; // '00'..'09'
  uf_licenciamento?: string | null;
  // Capacidade (nomes reais da tabela vehicles)
  capacity_kg?: number | null;
  capacity_m3?: number | null;
  // Reboque/complemento (quando plate_2 presente)
  reboque_tara_kg?: number | null;
  reboque_capacity_kg?: number | null;
  reboque_tipo_carroceria?: string | null;
  reboque_uf_licenciamento?: string | null;
}

/** Proprietário do veículo (terceiro/TAC) — vem do owner vinculado (owner_id). */
export interface MdfeProprietario {
  rntrc?: string | null;
  cpf_cnpj?: string | null;
  nome?: string | null;
  ie?: string | null;
  uf?: string | null;
  tipo_proprietario?: number | null; // 0=TAC Agregado, 1=TAC Independente, 2=Outros
}

export interface DriverRow {
  id: string;
  name: string;
  cpf?: string | null;
  cnh?: string | null;
}

export interface CteRowForMdfe {
  chave_cte: string; // 44 chars
  municipio_destino_ibge: number;
  municipio_destino_nome: string;
  uf_destino: string;
  valor_carga: number; // R$
  peso_kg: number;
}

export interface MunicipioCarregamento {
  codigo: number;
  nome: string;
}

/** Seguro da carga (grupo seguros_carga do MDF-e). responsavel_seguro: 1=emitente, 2=contratante. */
export interface MdfeSeguro {
  responsavel_seguro: '1' | '2';
  cnpj_responsavel?: string;
  nome_seguradora?: string;
  cnpj_seguradora?: string;
  numero_apolice?: string;
  numero_averbacao?: string;
}

export interface BuildMdfeInput {
  ctes: CteRowForMdfe[];
  vehicle: VehicleRow;
  driver: DriverRow;
  serie: number;
  numero: number;
  vectra: VectraConfig;
  municipiosCarregamento: MunicipioCarregamento[]; // 1..50 (where cargo was picked up)
  percursoUfs?: string[]; // intermediate UFs between uf_inicio and uf_fim
  /** Apólices ativas (RCTR-C / RC-DC). Responsável = emitente (Vectra). */
  seguros?: MdfeSeguro[];
  /** Proprietário do veículo (do owner vinculado). Ausente = veículo próprio Vectra. */
  proprietario?: MdfeProprietario;
  produtoPredominante?: {
    descricao: string;
    tipoCarga?: string; // tpCarga: 01..14 (default 05 = Carga Geral)
    ncm?: string;
    cean?: string; // GTIN if available
  };
}

export interface BuildMdfeResult {
  ref: string;
  payload: Record<string, unknown>;
  warnings: string[];
}

function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

/**
 * Campos do proprietário do veículo de tração, no formato FLAT do
 * modal_rodoviário Focus (sufixo `_proprietario_veiculo`). Só preenche quando o
 * veículo é de terceiro (TAC) — há rntrc ou cpf_cnpj do owner. Veículo próprio
 * Vectra → retorna {} (sem grupo proprietário; Vectra é o transportador via
 * registro_nacional_transporte).
 */
function buildProprietarioFields(prop: MdfeProprietario | undefined): Record<string, unknown> {
  const isThirdParty = Boolean(prop && (prop.rntrc || prop.cpf_cnpj));
  if (!isThirdParty) return {};

  const doc = digits(prop!.cpf_cnpj);
  const docField =
    doc.length === 14
      ? { cnpj_proprietario_veiculo: doc }
      : doc.length === 11
        ? { cpf_proprietario_veiculo: doc }
        : {};

  // Ordem do grupo `prop` (XSD MDF-e): CPF|CNPJ, RNTRC, xNome, IE?, tpProp.
  // NÃO há `UF` neste grupo — SEFAZ rejeita (erro_validacao_schema:
  // "Element 'UF' not expected. Expected is one of (IE, tpProp)").
  return {
    ...docField,
    rntrc_proprietario_veiculo: digits(prop!.rntrc),
    razao_social_proprietario_veiculo: prop!.nome ?? '',
    ...(prop!.ie ? { inscricao_estadual_proprietario_veiculo: prop!.ie } : {}),
    tipo_proprietario_veiculo: prop!.tipo_proprietario ?? 2, // 2 = Outros (fallback ETC)
  };
}

function uniqByCode<T extends { codigo: number }>(arr: T[]): T[] {
  const seen = new Set<number>();
  return arr.filter((x) => (seen.has(x.codigo) ? false : (seen.add(x.codigo), true)));
}

export function buildMdfeRef(serie: number, numero: number, retry = 0): string {
  return retry > 0 ? `CFN-MDFE-${serie}-${numero}-r${retry}` : `CFN-MDFE-${serie}-${numero}`;
}

export function buildMdfePayload(input: BuildMdfeInput): BuildMdfeResult {
  const { ctes, vehicle, driver, serie, numero, vectra } = input;
  const warnings: string[] = [];

  if (ctes.length === 0) throw new Error('[mdfe-mapper] at least 1 CT-e required');

  // UF início = vectra (origem operação Vectra é sempre SC)
  // UF fim = última UF presente nos CT-es (heurística — caller pode sobrescrever)
  const ufInicio = vectra.uf;
  const ufFim = ctes[ctes.length - 1]?.uf_destino ?? ufInicio;

  // infMunDescarga groups CT-es by destination município
  const grupos = new Map<number, { nome: string; uf: string; ctes: CteRowForMdfe[] }>();
  for (const c of ctes) {
    const g = grupos.get(c.municipio_destino_ibge);
    if (g) g.ctes.push(c);
    else
      grupos.set(c.municipio_destino_ibge, {
        nome: c.municipio_destino_nome,
        uf: c.uf_destino,
        ctes: [c],
      });
  }

  const municipios_descarregamento = Array.from(grupos.entries()).map(([codigo, g]) => ({
    codigo,
    nome: g.nome,
    documentos: g.ctes.map((c) => ({ chave_cte: c.chave_cte })),
  }));

  // Totalizadores
  const vCarga = ctes.reduce((sum, c) => sum + c.valor_carga, 0);
  const pesoBruto = ctes.reduce((sum, c) => sum + c.peso_kg, 0);

  const municipiosCarregamento = uniqByCode(input.municipiosCarregamento);
  if (municipiosCarregamento.length === 0)
    warnings.push('municipiosCarregamento empty — SEFAZ requires at least 1');

  // Motorista
  const cpfMotorista = digits(driver.cpf);
  if (cpfMotorista.length !== 11)
    warnings.push('driver.cpf invalid — required for MDF-e modal rodoviário');

  // Vehicle critical
  if (!vehicle.tara_kg) warnings.push('vehicle.tara_kg missing — required by SEFAZ');
  if (!vehicle.tipo_rodado)
    warnings.push('vehicle.tipo_rodado missing — required by SEFAZ (01-06)');
  if (!vehicle.tipo_carroceria)
    warnings.push('vehicle.tipo_carroceria missing — required by SEFAZ (00-09)');

  const ref = buildMdfeRef(serie, numero);

  // Veículo de terceiro (TAC) → exige grupo proprietário + contratante (578).
  const isTerceiro = Boolean(
    input.proprietario && (input.proprietario.rntrc || input.proprietario.cpf_cnpj)
  );

  const payload: Record<string, unknown> = {
    // === ide ===
    emitente: 1, // 1 = Prestador serviço transporte (transportadora)
    serie,
    numero,
    // Modal é sinalizado pela presença da chave `modal_rodoviario` (Focus NFe),
    // não por um campo `modal` numérico — ver bloco abaixo.
    // Horário local Brasil (UTC-3 fixo). UTC puro → SEFAZ rejeita 212. Ver cte-mapper.
    data_emissao: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 19) + '-03:00',
    uf_inicio: ufInicio,
    uf_fim: ufFim,
    // tpTransp — chave Focus é `tipo_transporte` (não `tipo_transportador`).
    // 1=ETC, 2=TAC, 3=CTC. Sem isto, CNPJ de proprietário gera rejeição 744.
    // tpEmit já vai no campo `emitente` acima; não há `tipo_emitente` no Focus.
    tipo_transporte: 1, // 1 = ETC (Empresa Transporte Cargas)
    ...(input.percursoUfs && input.percursoUfs.length > 0
      ? { percursos: input.percursoUfs.map((uf_percurso) => ({ uf_percurso })) }
      : {}),

    // === emitente ===
    cnpj_emitente: vectra.cnpj,
    inscricao_estadual_emitente: vectra.ie,
    nome_emitente: vectra.nome,
    nome_fantasia_emitente: vectra.fantasia,
    logradouro_emitente: vectra.logradouro,
    numero_emitente: vectra.numero,
    ...(vectra.complemento ? { complemento_emitente: vectra.complemento } : {}),
    bairro_emitente: vectra.bairro,
    codigo_municipio_emitente: vectra.ibge,
    municipio_emitente: vectra.municipio,
    cep_emitente: vectra.cep,
    uf_emitente: vectra.uf,

    // === modal rodoviário ===
    // Focus NFe: bloco do modal vai sob a chave `modal_rodoviario`, com campos
    // FLAT (sufixo `_veiculo`). Sem esse wrapper → erro
    // `parametros_modal_nao_informados`.
    modal_rodoviario: {
      registro_nacional_transporte: digits(vectra.rntrc), // RNTRC do transportador (Vectra)
      placa_veiculo: vehicle.plate.toUpperCase(),
      renavam_veiculo: digits(vehicle.renavam),
      tara_veiculo: vehicle.tara_kg ?? 0,
      capacidade_kg_veiculo: vehicle.capacity_kg ?? 0,
      ...(vehicle.capacity_m3 ? { capacidade_m3_veiculo: vehicle.capacity_m3 } : {}),
      tipo_rodado_veiculo: vehicle.tipo_rodado ?? '02', // 02 = Toco fallback
      tipo_carroceria_veiculo: vehicle.tipo_carroceria ?? '02', // 02 = Fechada/Baú fallback
      uf_licenciamento_veiculo: vehicle.uf_licenciamento ?? vectra.uf,
      condutores: [
        {
          nome: driver.name,
          cpf: cpfMotorista,
        },
      ],
      // Proprietário (terceiro/TAC) — campos flat; vazio = veículo próprio Vectra.
      ...buildProprietarioFields(input.proprietario),
      // Contratante do frete (Vectra/ETC) — obrigatório quando o veículo é de
      // terceiro (TAC); SEFAZ rejeita 578 sem isto. Veículo próprio → omite.
      ...(isTerceiro
        ? { contratantes: [{ nome: vectra.nome.slice(0, 60), cnpj: digits(vectra.cnpj) }] }
        : {}),
      ...(vehicle.plate_2
        ? {
            veiculos_reboque: [
              {
                placa: vehicle.plate_2.toUpperCase(),
                tara: vehicle.reboque_tara_kg ?? 0,
                capacidade_kg: vehicle.reboque_capacity_kg ?? 0,
                tipo_carroceria: vehicle.reboque_tipo_carroceria ?? '02',
                uf_licenciamento: vehicle.reboque_uf_licenciamento ?? vectra.uf,
              },
            ],
          }
        : {}),
    },

    // === municípios carregamento ===
    municipios_carregamento: municipiosCarregamento.map((m) => ({
      codigo: m.codigo,
      nome: m.nome,
    })),

    // === documentos vinculados (CT-es agrupados por município descarga) ===
    municipios_descarregamento,

    // === totalizadores (tot) — chaves FLAT no root (Focus NFe) ===
    quantidade_total_cte: ctes.length,
    valor_total_carga: Number(vCarga.toFixed(2)),
    peso_bruto: Number(pesoBruto.toFixed(3)),
    codigo_unidade_medida_peso_bruto: '01', // 01 = KG, 02 = TON

    // === produto predominante (prodPred) — chaves FLAT no root ===
    tipo_carga: input.produtoPredominante?.tipoCarga ?? '05', // 05 = Carga Geral (obrigatório)
    descricao_produto: input.produtoPredominante?.descricao ?? 'CARGA GERAL',
    ...(input.produtoPredominante?.ncm
      ? { codigo_ncm_produto: input.produtoPredominante.ncm }
      : {}),
    ...(input.produtoPredominante?.cean
      ? { codigo_barras_produto: input.produtoPredominante.cean }
      : {}),

    // === seguro da carga (RCTR-C / RC-DC) ===
    ...(input.seguros && input.seguros.length > 0 ? { seguros_carga: input.seguros } : {}),

    informacoes_adicionais_contribuinte: `MDF-e CFN — ${ctes.length} CT-e(s) agregados`,
  };
  if (!input.seguros || input.seguros.length === 0)
    warnings.push('seguros vazio — MDF-e sem apólice (RCTR-C/RC-DC). Verificar risk_policies.');

  return { ref, payload, warnings };
}

/**
 * Payload for MDF-e encerramento (após descarga).
 */
export interface EncerrarMdfeInput {
  protocolo: string; // protocolo da autorização do MDF-e
  uf: string; // UF onde foi encerrado
  municipio_descarga_ibge: number;
}

export function buildEncerramentoPayload(input: EncerrarMdfeInput): Record<string, unknown> {
  return {
    protocolo: input.protocolo,
    // Horário local Brasil (UTC-3 fixo) — mesmo motivo do data_emissao (rejeição 212).
    data_encerramento: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 19) + '-03:00',
    uf: input.uf,
    codigo_municipio: input.municipio_descarga_ibge,
  };
}
