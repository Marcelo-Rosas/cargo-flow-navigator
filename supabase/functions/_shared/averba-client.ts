// @ts-nocheck
/**
 * Cliente SOAP da Averba / AT&M (ATMWebSvr) — averbação de seguro de carga.
 * WSDL: https://webserver.averba.com.br/20/index.soap  (RPC/literal, urn:ATMWebSvr)
 *
 * Operação suportada aqui: averbaCTe (Retorno). NF-e/MDF-e reusam o mesmo parser.
 * Credenciais (usuario/senha/codatm) NUNCA são persistidas — só passam no envelope.
 */
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.4.1';

const NS = 'urn:ATMWebSvr';
const DEFAULT_URL = 'https://webserver.averba.com.br/20/index.soap';

export interface AverbaCreds {
  usuario: string;
  senha: string;
  codatm: string;
}

export interface DadosSeguro {
  numero_averbacao: string | null;
  cnpj_seguradora: string | null;
  nome_seguradora: string | null;
  num_apolice: string | null;
  tp_mov: string | null;
  tp_ddr: string | null;
  valor_averbado: string | null;
  ramo_averbado: string | null;
}

export interface AverbaRetorno {
  averbado: boolean;
  numero: string | null;
  serie: string | null;
  filial: string | null;
  cnpj_cli: string | null;
  tp_doc: string | null;
  protocolo: string | null;
  dh_averbacao: string | null;
  dados_seguro: DadosSeguro[];
  rcv: { protocolo: string | null; id_viagem: string | null; dh: string | null } | null;
  rcv_erro: { codigo: string | null; descricao: string | null } | null;
  erros: Array<{
    codigo: string | null;
    descricao: string | null;
    valor_esperado: string | null;
    valor_informado: string | null;
  }>;
  infos: Array<{ codigo: string | null; descricao: string | null }>;
}

/** Escapa string para caber como texto dentro de um elemento XML. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Monta o envelope SOAP 1.1 de averbaCTe (RPC/literal). */
export function buildAverbaCteEnvelope(creds: AverbaCreds, xmlCTe: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${NS}">
  <SOAP-ENV:Body>
    <tns:averbaCTe>
      <usuario>${xmlEscape(creds.usuario)}</usuario>
      <senha>${xmlEscape(creds.senha)}</senha>
      <codatm>${xmlEscape(creds.codatm)}</codatm>
      <xmlCTe>${xmlEscape(xmlCTe)}</xmlCTe>
    </tns:averbaCTe>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/** POST do envelope na Averba. Retorna { httpStatus, body } (body = XML cru). */
export async function callAverba(
  operacao: 'averbaCTe' | 'averbaNFe' | 'declaraMDFe',
  envelope: string,
  url = DEFAULT_URL
): Promise<{ httpStatus: number; body: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${NS}#${operacao}`,
    },
    body: envelope,
  });
  const body = await res.text();
  return { httpStatus: res.status, body };
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true, // some SOAP responses; deixa navegar sem prefixo
  parseTagValue: false, // mantém strings (chave/protocolo/valores com zeros)
  trimValues: true,
});

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

const s = (v: unknown): string | null => {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};

/** Parseia a resposta SOAP de averbaCTe/averbaNFe em `AverbaRetorno`. */
export function parseAverbaRetorno(xml: string): AverbaRetorno {
  const doc = parser.parse(xml);
  // Navega Envelope > Body > averbaCTeResponse > Response (namespaces removidos)
  const env = doc?.Envelope ?? doc;
  const body = env?.Body ?? env;
  // pega o primeiro elemento *Response
  let resp: Record<string, unknown> | undefined;
  for (const k of Object.keys(body ?? {})) {
    if (/Response$/i.test(k)) {
      const inner = (body as Record<string, unknown>)[k] as Record<string, unknown>;
      resp = (inner?.Response as Record<string, unknown>) ?? inner;
      break;
    }
  }
  const r = (resp ?? {}) as Record<string, any>;

  const averbado = r.Averbado ?? null;
  const rcv = r.AverbadoRCV ?? null;
  const erroRcv = r.ErroRCV ?? null;

  const dados = asArray<Record<string, any>>(averbado?.DadosSeguro).map((d) => ({
    numero_averbacao: s(d?.NumeroAverbacao),
    cnpj_seguradora: s(d?.CNPJSeguradora),
    nome_seguradora: s(d?.NomeSeguradora),
    num_apolice: s(d?.NumApolice),
    tp_mov: s(d?.TpMov),
    tp_ddr: s(d?.TpDDR),
    valor_averbado: s(d?.ValorAverbado),
    ramo_averbado: s(d?.RamoAverbado),
  }));

  const erros = asArray<Record<string, any>>(r.Erros?.Erro).map((e) => ({
    codigo: s(e?.Codigo),
    descricao: s(e?.Descricao),
    valor_esperado: s(e?.ValorEsperado),
    valor_informado: s(e?.ValorInformado),
  }));

  const infos = [...asArray<Record<string, any>>(r.Infos?.Info)].map((i) => ({
    codigo: s(i?.Codigo),
    descricao: s(i?.Descricao),
  }));

  return {
    averbado: !!averbado,
    numero: s(r.Numero),
    serie: s(r.Serie),
    filial: s(r.Filial),
    cnpj_cli: s(r.CNPJCli),
    tp_doc: s(r.TpDoc),
    protocolo: s(averbado?.Protocolo),
    dh_averbacao: s(averbado?.dhAverbacao),
    dados_seguro: dados,
    rcv: rcv
      ? { protocolo: s(rcv?.Protocolo), id_viagem: s(rcv?.IdViagem), dh: s(rcv?.dhAverbacao) }
      : null,
    rcv_erro: erroRcv ? { codigo: s(erroRcv?.Codigo), descricao: s(erroRcv?.Descricao) } : null,
    erros,
    infos,
  };
}
