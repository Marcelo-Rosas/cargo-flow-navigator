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

export interface BuildMdfeInput {
  ctes: CteRowForMdfe[];
  vehicle: VehicleRow;
  driver: DriverRow;
  serie: number;
  numero: number;
  vectra: VectraConfig;
  municipiosCarregamento: MunicipioCarregamento[]; // 1..50 (where cargo was picked up)
  percursoUfs?: string[]; // intermediate UFs between uf_inicio and uf_fim
  produtoPredominante?: {
    descricao: string;
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

  const payload: Record<string, unknown> = {
    // === ide ===
    emitente: 1, // 1 = Prestador serviço transporte (transportadora)
    serie,
    numero,
    modal: 1, // 1 = Rodoviário
    data_emissao: new Date().toISOString().slice(0, 19),
    uf_inicio: ufInicio,
    uf_fim: ufFim,
    tipo_emitente: 1, // 1 = Prestador
    tipo_transportador: 1, // 1 = ETC (Empresa Transporte Cargas)
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
    veiculo_tracao: {
      placa: vehicle.plate.toUpperCase(),
      renavam: digits(vehicle.renavam),
      tara: vehicle.tara_kg ?? 0,
      capacidade_kg: vehicle.capacidade_kg ?? 0,
      ...(vehicle.capacidade_m3 ? { capacidade_m3: vehicle.capacidade_m3 } : {}),
      tipo_rodado: vehicle.tipo_rodado ?? '02', // 02 = Toco fallback
      tipo_carroceria: vehicle.tipo_carroceria ?? '02', // 02 = Aberta fallback
      uf_licenciamento: vehicle.uf_licenciamento ?? vectra.uf,
      condutor: [
        {
          nome: driver.name,
          cpf: cpfMotorista,
        },
      ],
      proprietario: {
        cnpj: vectra.cnpj,
        rntrc: vectra.rntrc,
        nome: vectra.nome,
        ie: vectra.ie,
        uf: vectra.uf,
        tipo_proprietario: 0, // 0 = TAC Agregado / 1 = TAC Independente / 2 = Outros / null = próprio
      },
    },
    ...(vehicle.plate_2
      ? {
          veiculos_reboque: [
            {
              placa: vehicle.plate_2.toUpperCase(),
              tara: 0,
              capacidade_kg: 0,
              tipo_carroceria: '02',
              uf_licenciamento: vectra.uf,
            },
          ],
        }
      : {}),

    // === municípios carregamento ===
    municipios_carregamento: municipiosCarregamento.map((m) => ({
      codigo: m.codigo,
      nome: m.nome,
    })),

    // === documentos vinculados (CT-es agrupados por município descarga) ===
    municipios_descarregamento,

    // === produto predominante (informação carga) ===
    informacoes_carga: {
      valor_total_carga: Number(vCarga.toFixed(2)),
      codigo_unidade_medida_peso_bruto: '01', // 01 = KG, 02 = TON
      peso_bruto_total: Number(pesoBruto.toFixed(3)),
      produto_predominante: input.produtoPredominante?.descricao ?? 'CARGA GERAL',
      ...(input.produtoPredominante?.ncm ? { ncm: input.produtoPredominante.ncm } : {}),
      ...(input.produtoPredominante?.cean ? { cean: input.produtoPredominante.cean } : {}),
    },

    informacoes_adicionais_contribuinte: `MDF-e CFN — ${ctes.length} CT-e(s) agregados`,
  };

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
    data_encerramento: new Date().toISOString().slice(0, 19),
    uf: input.uf,
    codigo_municipio: input.municipio_descarga_ibge,
  };
}
