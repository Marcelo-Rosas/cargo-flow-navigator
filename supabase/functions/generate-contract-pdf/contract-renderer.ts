import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

// Paleta Vectra
const NAVY = rgb(0.106, 0.165, 0.29);
const ORANGE = rgb(0.91, 0.459, 0.102);
const TEXT = rgb(0.118, 0.137, 0.176);
const MUTED = rgb(0.392, 0.431, 0.51);
const WHITE = rgb(1, 1, 1);

const PW = 595; // A4 width in pt
const PH = 842; // A4 height in pt
const ML = 50;
const MR = 50;
const CW = PW - ML - MR;
const LINE_H = 14;

function fmtCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '___/___/______';
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('pt-BR');
}

function buildAddress(client: Record<string, unknown>): string {
  const parts: string[] = [];
  if (client.address) parts.push(String(client.address));
  if (client.address_number) parts.push(String(client.address_number));
  if (client.address_complement) parts.push(String(client.address_complement));
  if (client.address_neighborhood) parts.push(String(client.address_neighborhood));
  if (client.city) parts.push(String(client.city));
  if (client.state) parts.push(String(client.state));
  if (client.zip_code) parts.push(String(client.zip_code_mask || client.zip_code));
  return parts.join(', ') || '[endereço não informado]';
}

function buildCompanyAddress(company: Record<string, unknown>): string {
  const parts: string[] = [];
  if (company.address_street) parts.push(String(company.address_street));
  if (company.address_number) parts.push(String(company.address_number));
  if (company.address_complement) parts.push(String(company.address_complement));
  if (company.address_neighborhood) parts.push(String(company.address_neighborhood));
  if (company.address_city) parts.push(`${company.address_city} - ${company.address_state}`);
  if (company.address_zip) parts.push(String(company.address_zip));
  return parts.join(', ');
}

class PdfWriter {
  private doc!: PDFDocument;
  private page!: ReturnType<PDFDocument['addPage']>;
  private fonts!: {
    regular: Awaited<ReturnType<PDFDocument['embedFont']>>;
    bold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    italic: Awaited<ReturnType<PDFDocument['embedFont']>>;
  };
  private y = PH - 50;
  private pageNum = 1;
  private totalPages = 0;
  private pages: Array<ReturnType<PDFDocument['addPage']>> = [];

  async init() {
    this.doc = await PDFDocument.create();
    this.fonts = {
      regular: await this.doc.embedFont(StandardFonts.Helvetica),
      bold: await this.doc.embedFont(StandardFonts.HelveticaBold),
      italic: await this.doc.embedFont(StandardFonts.HelveticaOblique),
    };
    this.newPage();
  }

  private newPage() {
    const p = this.doc.addPage([PW, PH]);
    this.pages.push(p);
    this.page = p;
    this.y = PH - 50;
    this.pageNum = this.pages.length;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < 70) {
      this.newPage();
    }
  }

  drawRect(x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  text(
    content: string,
    opts: {
      x?: number;
      size?: number;
      bold?: boolean;
      italic?: boolean;
      color?: ReturnType<typeof rgb>;
      align?: 'left' | 'center' | 'right';
      maxWidth?: number;
    } = {}
  ) {
    const {
      x = ML,
      size = 9,
      bold = false,
      italic = false,
      color = TEXT,
      align = 'left',
      maxWidth = CW,
    } = opts;
    const font = bold ? this.fonts.bold : italic ? this.fonts.italic : this.fonts.regular;
    const textX = align === 'center' ? ML + CW / 2 : align === 'right' ? PW - MR : x;
    const anchorPoint = align === 'center' ? 'center' : align === 'right' ? 'right' : undefined;

    // Word wrap
    const words = content.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(test, size);
      if (testWidth > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      this.ensureSpace(LINE_H);
      const lw = font.widthOfTextAtSize(l, size);
      const drawX = align === 'center' ? PW / 2 - lw / 2 : align === 'right' ? PW - MR - lw : textX;
      this.page.drawText(l, { x: drawX, y: this.y, size, font, color });
      this.y -= LINE_H;
    }
  }

  gap(pts = 8) {
    this.y -= pts;
  }

  rule(color = NAVY, thickness = 0.5) {
    this.page.drawLine({
      start: { x: ML, y: this.y },
      end: { x: PW - MR, y: this.y },
      thickness,
      color,
    });
    this.y -= 6;
  }

  heading(label: string) {
    this.ensureSpace(20);
    this.gap(4);
    this.page.drawRectangle({ x: ML, y: this.y - 2, width: CW, height: 14, color: NAVY });
    this.page.drawText(label, {
      x: ML + 6,
      y: this.y + 1,
      size: 9,
      font: this.fonts.bold,
      color: WHITE,
    });
    this.y -= 16;
    this.gap(2);
  }

  clause(num: string, title: string, body: string) {
    this.ensureSpace(40);
    this.gap(6);
    this.text(`${num} – ${title}`, { bold: true, size: 9 });
    this.gap(2);
    this.text(body, { size: 8.5, maxWidth: CW });
    this.gap(4);
  }

  subItem(label: string) {
    this.text(label, { x: ML + 12, size: 8.5, maxWidth: CW - 12 });
  }

  async drawLogo(_logoBase64?: string) {
    if (!_logoBase64) return;
    try {
      const logoBytes = Uint8Array.from(atob(_logoBase64), (c) => c.charCodeAt(0));
      const logoImage = await this.doc.embedPng(logoBytes);
      const logoDims = logoImage.scale(0.13);
      this.page.drawImage(logoImage, {
        x: ML,
        y: PH - 50,
        width: logoDims.width,
        height: logoDims.height,
      });
    } catch {
      // logo embed failed, skip silently
    }
  }

  drawFooter(pageIndex: number, total: number) {
    const p = this.pages[pageIndex];
    p.drawRectangle({ x: 0, y: 0, width: PW, height: 22, color: NAVY });
    const footerFont = this.fonts.regular;
    p.drawText(`Página ${pageIndex + 1} de ${total}`, {
      x: ML,
      y: 7,
      size: 7,
      font: footerFont,
      color: WHITE,
    });
    p.drawText('Proposta comercial — documento sujeito a conferência das partes', {
      x: PW / 2 - 130,
      y: 7,
      size: 7,
      font: footerFont,
      color: WHITE,
    });
  }

  async finish(): Promise<Uint8Array> {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      this.drawFooter(i, total);
    }
    return this.doc.save();
  }
}

// ── Main renderer ──────────────────────────────────────────────────────────────

export async function renderContractPdf(ctx: {
  quote: Record<string, unknown>;
  company: Record<string, unknown>;
  version: number;
}): Promise<Uint8Array> {
  const { quote, company, version } = ctx;
  const client = (quote.clients as Record<string, unknown> | null) ?? {};
  const paymentTerm = (quote.payment_terms as Record<string, unknown> | null) ?? {};

  const w = new PdfWriter();
  await w.init();

  // ── Header ───────────────────────────────────────────────────────────────────
  await w.drawLogo(); // logo omitted (loaded separately if needed)
  w.gap(45);

  // Orange bar
  w.drawRect(ML, w['y'], CW, 4, ORANGE);
  w.gap(8);

  w.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE RODOVIÁRIO DE CARGAS', {
    align: 'center',
    bold: true,
    size: 11,
    color: NAVY,
  });
  w.gap(4);
  w.text(`Referência: ${String(quote.quote_code ?? '')}  —  Versão ${version}`, {
    align: 'center',
    size: 8,
    color: MUTED,
  });
  w.gap(6);
  w.rule(ORANGE, 1);
  w.gap(4);

  w.text('Pelo presente instrumento particular, de um lado:', {
    italic: true,
    size: 8.5,
    color: MUTED,
  });
  w.gap(6);

  // ── CONTRATADA ────────────────────────────────────────────────────────────────
  w.heading('CONTRATADA');
  w.text(
    `${String(company.legal_name ?? '')}, pessoa jurídica de direito privado, inscrita no CNPJ nº ${String(company.cnpj ?? '')}, ` +
      `com sede na ${buildCompanyAddress(company)}, doravante denominada CONTRATADA.`,
    { size: 8.5 }
  );
  w.gap(8);

  // ── CONTRATANTE ───────────────────────────────────────────────────────────────
  w.heading('CONTRATANTE');
  const clientName = String(client.name ?? quote.client_name ?? '[cliente não informado]');
  const clientCnpj = String(client.cnpj ?? '');
  const clientAddr = buildAddress(client);
  w.text(
    `${clientName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${clientCnpj || '[CNPJ não informado]'}, ` +
      `com sede na ${clientAddr}, doravante denominada CONTRATANTE.`,
    { size: 8.5 }
  );
  w.gap(6);
  w.text('As partes ajustam o presente contrato, mediante as cláusulas e condições seguintes:', {
    italic: true,
    size: 8.5,
    color: MUTED,
  });
  w.gap(8);

  // ── Cláusulas ─────────────────────────────────────────────────────────────────

  w.clause(
    'CLÁUSULA 1ª',
    'DO OBJETO',
    '1.1. O presente contrato tem por objeto a prestação de serviços de transporte rodoviário de cargas, podendo a CONTRATADA executar os serviços diretamente ou por meio de transportadores autônomos de cargas – TAC, empresas terceirizadas ou agregados, regularmente constituídos e habilitados.'
  );
  w.text(
    '1.2. A CONTRATADA atua como operadora logística e intermediadora do transporte, não sendo proprietária, necessariamente, dos veículos utilizados nas operações.',
    { size: 8.5, x: ML + 12 }
  );

  w.clause(
    'CLÁUSULA 2ª',
    'DA FORMA DE EXECUÇÃO DOS SERVIÇOS',
    '2.1. A CONTRATADA poderá, a seu exclusivo critério, subcontratar, intermediar ou repassar a execução do transporte a TACs ou transportadores terceirizados, nos termos da Lei nº 11.442/2007.'
  );
  w.subItem(
    '2.2. A escolha, contratação, remuneração e fiscalização dos transportadores terceirizados são de responsabilidade exclusiva da CONTRATADA, inexistindo qualquer vínculo jurídico direto entre o CONTRATANTE e os referidos terceiros.'
  );
  w.subItem(
    '2.3. O CONTRATANTE reconhece e concorda que não poderá interferir, negociar ou efetuar pagamentos diretamente a motoristas, TACs ou transportadores subcontratados.'
  );
  w.subItem(
    '2.4. O CONTRATANTE declara ciência de que o tipo de veículo a ser utilizado na operação será definido em conjunto com a CONTRATADA, em razão da dificuldade de acesso ao local de entrega, podendo a CONTRATADA realizar os ajustes operacionais necessários para a adequada execução dos serviços. Na hipótese de existirem restrições de acesso, exigências específicas do local, necessidade de veículo especial, transbordo, redespacho ou qualquer outra medida operacional extraordinária que gere custos adicionais, tais valores serão previamente informados pela CONTRATADA ao CONTRATANTE e somente poderão ser cobrados e/ou executados mediante aprovação expressa e por escrito do CONTRATANTE.'
  );

  w.clause('CLÁUSULA 3ª', 'DAS OBRIGAÇÕES DA CONTRATADA', 'A CONTRATADA obriga-se a:');
  w.subItem(
    'a) Coordenar e intermediar a operação de transporte, observando a legislação vigente aplicável ao transporte rodoviário de cargas;'
  );
  w.subItem(
    'b) Exigir dos transportadores terceirizados a regularidade documental mínima exigida por lei (ANTT, CNH, veículo, quando aplicável);'
  );
  w.subItem(
    'c) Cumprir os prazos de coleta e entrega ajustados, os quais possuem caráter estimativo, não se configurando como prazos fatais, não respondendo por atrasos decorrentes de fatos alheios à sua atuação, incluindo, mas não se limitando a: (i) atraso na liberação, carregamento ou descarregamento da mercadoria; (ii) indisponibilidade de motorista terceirizado por motivo justificado; (iii) atraso ou inadimplemento do pagamento de entrada ou sinal do frete; (iv) informações incorretas ou incompletas fornecidas pelo CONTRATANTE; (v) caso fortuito ou força maior (art. 393 do Código Civil);'
  );
  w.subItem(
    'd) Nas hipóteses acima, os prazos serão automaticamente prorrogados, sem aplicação de penalidades.'
  );

  w.clause('CLÁUSULA 4ª', 'DAS OBRIGAÇÕES DO CONTRATANTE', '4.1. O CONTRATANTE obriga-se a:');
  w.subItem(
    'a) Fornecer informações corretas e completas sobre a carga, locais, prazos e exigências operacionais;'
  );
  w.subItem('b) Garantir que a mercadoria esteja adequadamente acondicionada e regularizada;');
  w.subItem('c) Efetuar os pagamentos exclusivamente à CONTRATADA, nos prazos acordados;');
  w.subItem('d) Abster-se de manter qualquer relação direta com motoristas ou TACs.');

  // Cláusula 5 — Pagamento (com dados dinâmicos)
  const freightValue =
    typeof quote.value === 'number' ? fmtCurrency(quote.value) : '[valor não informado]';
  const paymentName = String(paymentTerm.name ?? '[condição de pagamento não informada]');

  w.clause(
    'CLÁUSULA 5ª',
    'DO PAGAMENTO',
    `5.1. O pagamento do frete deverá ser realizado exclusivamente em conta bancária de titularidade jurídica da CONTRATADA, no valor total de ${freightValue}.`
  );
  w.subItem(
    '5.2. O valor do frete informado contempla os seguintes itens inclusos: Impostos, Pedágio, Carga, Descarga, Seguro.'
  );
  w.subItem(`5.3. O pagamento será realizado conforme a condição negociada: ${paymentName}.`);
  w.subItem(
    `5.4. O pagamento deverá ser efetuado através dos seguintes dados bancários da ${String(company.legal_name ?? 'CONTRATADA')}:`
  );
  w.gap(2);
  w.text(`CNPJ: ${String(company.cnpj ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Banco: ${String(company.bank_name ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Agência: ${String(company.bank_agency ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Conta Corrente: ${String(company.bank_account ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Chave (PIX): ${String(company.bank_pix_key ?? '')}`, { x: ML + 24, size: 8.5 });
  w.gap(4);
  w.subItem(
    '5.5. O inadimplemento autoriza a CONTRATADA a suspender, reter ou cancelar a operação, sem caracterizar descumprimento contratual.'
  );

  w.clause(
    'CLÁUSULA 6ª',
    'DA VEDAÇÃO A PAGAMENTOS DIRETOS E MULTA',
    '6.1. É estritamente vedado ao CONTRATANTE efetuar pagamentos diretos a motoristas, TACs, agregados ou transportadores subcontratados.'
  );
  w.subItem(
    '6.2. O descumprimento desta cláusula acarretará multa compensatória equivalente a 30% (trinta por cento) do valor do frete, além da obrigação de pagamento integral do frete contratado, nos termos dos arts. 408, 409, 410 e 416 do Código Civil, que autorizam a estipulação de cláusula penal para o caso de inadimplemento, sem prejuízo das demais medidas cabíveis para resguardar o cumprimento das obrigações assumidas.'
  );

  w.clause(
    'CLÁUSULA 7ª',
    'DA RESPONSABILIDADE E LIMITAÇÕES',
    '7.1. A responsabilidade da CONTRATADA limita-se à intermediação e coordenação do transporte, nos termos da Lei nº 11.442/2007.'
  );
  w.subItem(
    '7.2. A CONTRATADA não responde solidária ou subsidiariamente por obrigações trabalhistas, previdenciárias ou fiscais dos transportadores terceirizados.'
  );
  w.subItem(
    '7.3. A CONTRATADA não será responsável por prejuízos decorrentes de: a) vício próprio da carga; b) embalagem inadequada; c) atos/erros de terceiros; d) força maior ou caso fortuito.'
  );

  w.clause(
    'CLÁUSULA 8ª',
    'DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA',
    '8.1. Não existe qualquer vínculo empregatício, societário ou solidário entre o CONTRATANTE e os motoristas, TACs ou transportadores terceirizados utilizados na operação.'
  );
  w.subItem(
    '8.2. Qualquer tentativa de caracterização de vínculo será de inteira responsabilidade de quem a der causa.'
  );

  w.clause(
    'CLÁUSULA 9ª',
    'DA VIGÊNCIA E RESCISÃO',
    '9.1. O presente contrato terá prazo determinado, iniciando-se na data de sua assinatura e encerrando-se automaticamente com o cumprimento integral do serviço contratado.'
  );
  w.subItem(
    '9.2. Poderá ser rescindido mediante aviso prévio de 30 dias, mantendo-se exigíveis os valores pendentes.'
  );

  const jurisdiction = String(company.default_jurisdiction ?? 'Navegantes/SC');
  const signatureCity = String(company.signature_city ?? 'Navegantes');

  w.clause(
    'CLÁUSULA 10ª',
    'DO FORO',
    `10.1. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de ${jurisdiction}, com renúncia expressa a qualquer outro, por mais privilegiado que seja. E, por estarem justas e contratadas, firmam o presente instrumento em duas vias de igual teor e forma.`
  );

  // ── Assinaturas ───────────────────────────────────────────────────────────────
  w['ensureSpace'](120);
  w.gap(16);
  w.text(`${signatureCity}, ${fmtDate(new Date().toISOString())}`, {
    align: 'center',
    size: 9,
    color: MUTED,
  });
  w.gap(20);

  // Left: CONTRATANTE
  const midX = ML + CW / 2;
  const lineWidth = 180;
  w['page'].drawLine({
    start: { x: ML, y: w['y'] },
    end: { x: ML + lineWidth, y: w['y'] },
    thickness: 0.5,
    color: TEXT,
  });
  w['page'].drawLine({
    start: { x: midX + 15, y: w['y'] },
    end: { x: midX + 15 + lineWidth, y: w['y'] },
    thickness: 0.5,
    color: TEXT,
  });
  w.gap(5);
  w.text('CONTRATANTE', { x: ML, bold: true, size: 8 });
  w.text('CONTRATADA', { x: midX + 15, bold: true, size: 8 });
  w.gap(2);
  w.text(clientName, { x: ML, size: 8, color: MUTED });
  w.text(String(company.legal_name ?? ''), { x: midX + 15, size: 8, color: MUTED });

  if (client.legal_representative_name) {
    w.gap(1);
    w.text(String(client.legal_representative_name), {
      x: ML,
      size: 7.5,
      italic: true,
      color: MUTED,
    });
  }
  if (company.legal_representative_name) {
    w.gap(1);
    w.text(String(company.legal_representative_name), {
      x: midX + 15,
      size: 7.5,
      italic: true,
      color: MUTED,
    });
  }

  w.gap(10);
  w.rule(MUTED, 0.3);
  w.gap(2);
  w.text(
    `Contrato gerado automaticamente em ${new Date().toLocaleString('pt-BR')} — Ref. ${String(quote.quote_code ?? '')} v${version}`,
    {
      align: 'center',
      size: 7,
      color: MUTED,
    }
  );

  return w.finish();
}
