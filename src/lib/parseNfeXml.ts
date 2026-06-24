/**
 * Parser de NF-e (modelo 55) a partir do XML autorizado.
 *
 * Extrai apenas o necessário para o relatório de itens: emitente (remetente),
 * destinatário e as linhas de produto (código, descrição, quantidade).
 *
 * O XML da NF-e usa namespace default (http://www.portalfiscal.inf.br/nfe), sem
 * prefixo — logo `getElementsByTagName('<tag>')` casa pelo nome local.
 */

export interface NfeParty {
  name: string;
  fantasia: string;
  cnpj_cpf: string;
  ie: string;
  phone: string;
  email: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  uf: string;
  zip: string;
}

export interface NfeItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
}

export interface ParsedNfe {
  nf_number: string;
  serie: string;
  issued_at: string;
  access_key: string | null;
  emit: NfeParty;
  dest: NfeParty;
  items: NfeItem[];
}

/** Texto do primeiro filho com a tag informada, dentro de `scope`. */
function tagText(scope: Element | Document | null, tag: string): string {
  if (!scope) return '';
  const el = scope.getElementsByTagName(tag)[0];
  return el?.textContent?.trim() ?? '';
}

function parseParty(node: Element | null): NfeParty {
  const ender =
    node?.getElementsByTagName('enderEmit')[0] ??
    node?.getElementsByTagName('enderDest')[0] ??
    null;
  return {
    name: tagText(node, 'xNome'),
    fantasia: tagText(node, 'xFant'),
    cnpj_cpf: tagText(node, 'CNPJ') || tagText(node, 'CPF'),
    ie: tagText(node, 'IE'),
    phone: tagText(ender, 'fone'),
    email: tagText(node, 'email'),
    address: tagText(ender, 'xLgr'),
    address_number: tagText(ender, 'nro'),
    neighborhood: tagText(ender, 'xBairro'),
    city: tagText(ender, 'xMun'),
    uf: tagText(ender, 'UF'),
    zip: tagText(ender, 'CEP'),
  };
}

/**
 * Parseia uma string XML de NF-e em estrutura tipada.
 * @throws Error quando o XML é inválido ou não contém uma NF-e.
 */
export function parseNfeXml(xml: string): ParsedNfe {
  const dom = new DOMParser().parseFromString(xml, 'application/xml');

  if (dom.getElementsByTagName('parsererror').length > 0) {
    throw new Error('XML da NF-e inválido ou corrompido.');
  }

  const infNFe = dom.getElementsByTagName('infNFe')[0];
  if (!infNFe) {
    throw new Error('XML não é uma NF-e (tag infNFe ausente).');
  }

  const ide = infNFe.getElementsByTagName('ide')[0] ?? null;
  const emitNode = infNFe.getElementsByTagName('emit')[0] ?? null;
  const destNode = infNFe.getElementsByTagName('dest')[0] ?? null;

  const accessKey = (infNFe.getAttribute('Id') || '').replace(/^NFe/, '') || null;

  const items: NfeItem[] = Array.from(infNFe.getElementsByTagName('det')).map((det) => {
    const prod = det.getElementsByTagName('prod')[0] ?? null;
    return {
      code: tagText(prod, 'cProd'),
      description: tagText(prod, 'xProd'),
      quantity: Number(tagText(prod, 'qCom')) || 0,
      unit: tagText(prod, 'uCom'),
    };
  });

  return {
    nf_number: tagText(ide, 'nNF'),
    serie: tagText(ide, 'serie'),
    issued_at: tagText(ide, 'dhEmi'),
    access_key: accessKey,
    emit: parseParty(emitNode),
    dest: parseParty(destNode),
    items,
  };
}
