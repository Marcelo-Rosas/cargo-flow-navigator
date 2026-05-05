/**
 * Consulta de CNPJ via BrasilAPI.
 *
 * BrasilAPI retorna numa unica chamada todos os campos do cartao CNPJ + QSA
 * (https://brasilapi.com.br/api/cnpj/v1/{cnpj}). Esse modulo normaliza a
 * resposta para o shape interno usado em clients e shippers.
 */

export interface CnpjPartner {
  name: string;
  role: string | null;
  role_code: string | null;
  document: string | null;
  entry_date: string | null;
  country: string | null;
  age_range: string | null;
}

export interface CnpjCnaeSecondary {
  codigo: string;
  descricao: string;
}

export interface CnpjLookupResult {
  // Identificacao
  cnpj: string;
  name: string | null;
  trade_name: string | null;

  // Contato
  email: string | null;
  phone: string | null;

  // Endereco
  address: string | null; // logradouro
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;

  // Dados juridicos
  legal_nature: string | null;
  legal_nature_code: string | null;
  company_size: string | null;
  opening_date: string | null; // ISO date
  registration_status: string | null;
  registration_status_date: string | null;
  registration_status_reason: string | null;
  efr: string | null;

  // CNAE
  cnae_main_code: string | null;
  cnae_main_description: string | null;
  cnaes_secondary: CnpjCnaeSecondary[];

  // QSA
  share_capital: number | null;
  partners: CnpjPartner[];
}

const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');

const safeStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

const safeNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n =
    typeof v === 'number'
      ? v
      : Number(
          String(v)
            .replace(/[^0-9.,-]/g, '')
            .replace(',', '.')
        );
  return Number.isFinite(n) ? n : null;
};

const ymd = (v: unknown): string | null => {
  const s = safeStr(v);
  if (!s) return null;
  // BrasilAPI retorna "YYYY-MM-DD"; reaproveita se ja esta no formato.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Fallback: tenta parsear DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};

interface BrasilApiCnpjPartner {
  nome_socio?: string;
  qualificacao_socio?: string;
  codigo_qualificacao_socio?: string | number;
  cnpj_cpf_do_socio?: string;
  data_entrada_sociedade?: string;
  pais?: string;
  faixa_etaria?: string;
}

interface BrasilApiCnpjCnaeSecundario {
  codigo?: string | number;
  descricao?: string;
}

interface BrasilApiCnpj {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  natureza_juridica?: string;
  codigo_natureza_juridica?: string | number;
  porte?: string;
  descricao_porte?: string;
  data_inicio_atividade?: string;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  ente_federativo_responsavel?: string;
  cnae_fiscal?: string | number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: BrasilApiCnpjCnaeSecundario[];
  capital_social?: number | string;
  qsa?: BrasilApiCnpjPartner[];
}

function mapPartner(p: BrasilApiCnpjPartner): CnpjPartner {
  return {
    name: safeStr(p.nome_socio) ?? '',
    role: safeStr(p.qualificacao_socio),
    role_code: safeStr(p.codigo_qualificacao_socio),
    document: safeStr(p.cnpj_cpf_do_socio),
    entry_date: ymd(p.data_entrada_sociedade),
    country: safeStr(p.pais),
    age_range: safeStr(p.faixa_etaria),
  };
}

function normalize(data: BrasilApiCnpj): CnpjLookupResult {
  const cnaes: CnpjCnaeSecondary[] = Array.isArray(data.cnaes_secundarios)
    ? data.cnaes_secundarios
        .map((c) => ({
          codigo: safeStr(c.codigo) ?? '',
          descricao: safeStr(c.descricao) ?? '',
        }))
        .filter((c) => c.codigo || c.descricao)
    : [];

  const partners: CnpjPartner[] = Array.isArray(data.qsa)
    ? data.qsa.map(mapPartner).filter((p) => p.name.length > 0)
    : [];

  return {
    cnpj: safeStr(data.cnpj) ?? '',
    name: safeStr(data.razao_social),
    trade_name: safeStr(data.nome_fantasia),

    email: safeStr(data.email),
    phone: safeStr(data.ddd_telefone_1) ?? safeStr(data.ddd_telefone_2),

    address: safeStr(data.logradouro),
    address_number: safeStr(data.numero),
    address_complement: safeStr(data.complemento),
    address_neighborhood: safeStr(data.bairro),
    zip_code: safeStr(data.cep),
    city: safeStr(data.municipio),
    state: (safeStr(data.uf) ?? '').toUpperCase().slice(0, 2) || null,

    legal_nature: safeStr(data.natureza_juridica),
    legal_nature_code: safeStr(data.codigo_natureza_juridica),
    company_size: safeStr(data.descricao_porte) ?? safeStr(data.porte),
    opening_date: ymd(data.data_inicio_atividade),
    registration_status: safeStr(data.descricao_situacao_cadastral),
    registration_status_date: ymd(data.data_situacao_cadastral),
    registration_status_reason: safeStr(data.motivo_situacao_cadastral),
    efr: safeStr(data.ente_federativo_responsavel),

    cnae_main_code: safeStr(data.cnae_fiscal),
    cnae_main_description: safeStr(data.cnae_fiscal_descricao),
    cnaes_secondary: cnaes,

    share_capital: safeNum(data.capital_social),
    partners,
  };
}

export class CnpjLookupError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID' | 'NOT_FOUND' | 'NETWORK' | 'STATUS'
  ) {
    super(message);
    this.name = 'CnpjLookupError';
  }
}

/**
 * Consulta CNPJ na BrasilAPI e retorna o shape normalizado.
 * @throws CnpjLookupError quando CNPJ invalido, nao encontrado, ou erro de rede.
 */
export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = sanitizeCnpj(rawCnpj);
  if (cnpj.length !== 14) {
    throw new CnpjLookupError('CNPJ deve ter 14 digitos', 'INVALID');
  }

  let res: Response;
  try {
    // BrasilAPI bloqueia o User-Agent default do undici (Node fetch) com 403.
    // Mandar um UA identificavel resolve. No browser este header nao tem efeito
    // (forbidden header), entao convive com o uso original em formularios.
    res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { 'User-Agent': 'vectra-cargo (cnpj-lookup; +https://vectracargo.com.br)' },
    });
  } catch (e) {
    throw new CnpjLookupError(
      e instanceof Error ? e.message : 'Falha de rede ao consultar CNPJ',
      'NETWORK'
    );
  }

  if (res.status === 404) {
    throw new CnpjLookupError('CNPJ nao encontrado na base da Receita Federal', 'NOT_FOUND');
  }
  if (!res.ok) {
    throw new CnpjLookupError(`Erro ao consultar CNPJ (status ${res.status})`, 'STATUS');
  }

  const data = (await res.json()) as BrasilApiCnpj;
  return normalize(data);
}

/**
 * Identifica o socio mais provavel para ser representante legal:
 * preferencia para qualificacoes que contenham "Administrador" / "Diretor" / "Socio".
 * Se houver multiplos, retorna o primeiro.
 */
export function pickLegalRepresentative(partners: CnpjPartner[]): CnpjPartner | null {
  if (!partners.length) return null;

  const adminPatterns = [/administrador/i, /diretor/i, /presidente/i];
  const partnerPatterns = [/s[oó]cio/i];

  for (const patterns of [adminPatterns, partnerPatterns]) {
    const found = partners.find((p) => p.role && patterns.some((rx) => rx.test(p.role!)));
    if (found) return found;
  }
  return partners[0] ?? null;
}
