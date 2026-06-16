import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

type QuotePdfMode = 'simplified' | 'detailed';

export interface QuotePdfPayload {
  id: string;
  quote_code: string | null;
  client_name: string;
  origin: string | null;
  destination: string | null;
  value: number | null;
  cargo_type: string | null;
  weight: number | null;
  volume: number | null;
  km_distance: number | null;
  estimated_loading_date: string | null;
  validity_date?: string | null;
  notes?: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_term_name?: string | null;
  antt_compliance?: { piso: number; below: boolean; modality: string };
  pricing_breakdown?: StoredPricingBreakdown | null;
  freight_modality?: 'lotacao' | 'fracionado' | null;
}

type PdfDoc = jsPDF & { lastAutoTable?: { finalY?: number } };

const C = {
  navy: [27, 42, 74] as [number, number, number],
  navyDark: [18, 28, 52] as [number, number, number],
  orange: [232, 117, 26] as [number, number, number],
  orangeLight: [249, 200, 150] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [30, 35, 45] as [number, number, number],
  muted: [100, 110, 130] as [number, number, number],
  light: [246, 248, 251] as [number, number, number],
  border: [200, 206, 214] as [number, number, number],
  success: [22, 101, 52] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
};

const PW = 210;
const ML = 12;
const MR = 12;
const CW = PW - ML - MR;

const VECTRA = {
  name: 'VECTRA CARGO LTDA',
  cnpj: '59.650.913/0001-04',
  ie: '263450562',
  address: 'AV. PREFEITO CIRINO ADOLFO, 495',
  city: 'NAVEGANTES',
  uf: 'SC',
  phone: '(47) 93385-1351',
  email: 'comercial@vectracargo.com.br',
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  try {
    return formatDate(d);
  } catch {
    return d;
  }
};

const formatWeight = (raw: number | null | undefined): string => {
  if (raw == null) return '—';
  const kg = Number(raw);
  return kg >= 1000
    ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(kg / 1000)} t`
    : `${new Intl.NumberFormat('pt-BR').format(kg)} kg`;
};

const fmtNum = (raw: number | null | undefined, unit = ''): string => {
  if (raw == null) return '—';
  const s = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(raw));
  return unit ? `${s} ${unit}` : s;
};

const humanizeCargoType = (raw: string | null | undefined): string => {
  if (!raw) return '—';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

async function loadLogoBase64(): Promise<string | null> {
  try {
    const mod = (await import('@/assets/logo_vectra_cargo.jpg?url')) as { default?: string };
    const logoUrl = mod.default;
    if (!logoUrl) return null;
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(
  doc: PdfDoc,
  payload: QuotePdfPayload,
  mode: QuotePdfMode,
  logoBase64: string | null
): number {
  const H = 28;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'JPEG', ML, 3, 22, 22);
  }

  const ix = ML + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text(VECTRA.name, ix, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 215, 235);
  doc.text(`CNPJ: ${VECTRA.cnpj}    IE: ${VECTRA.ie}`, ix, 13);
  doc.text(`${VECTRA.address} - ${VECTRA.city}/${VECTRA.uf}`, ix, 17.5);
  doc.text(`Fone: ${VECTRA.phone}`, ix, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('PROPOSTA COMERCIAL DE FRETE', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(`Cotação: ${payload.quote_code ?? '—'}`, PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(
    `${mode === 'detailed' ? 'Uso Interno • ' : ''}Emissão: ${fmtDate(new Date().toISOString())}`,
    PW - MR,
    19,
    { align: 'right' }
  );

  return H + 2 + 6;
}

function drawStatusBadge(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const badgeH = 8;
  doc.setFillColor(...C.successLight);
  doc.roundedRect(ML, y, CW, badgeH, 2, 2, 'F');
  doc.setFillColor(...C.success);
  doc.roundedRect(ML, y, 3, badgeH, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.success);
  const text = payload.validity_date
    ? `PROPOSTA VÁLIDA ATÉ ${fmtDate(payload.validity_date)}`
    : 'PROPOSTA VÁLIDA POR 5 DIAS ÚTEIS A PARTIR DA EMISSÃO';
  doc.text(text, ML + 6, y + 5.5);
  return y + badgeH + 4;
}

function drawInfoGrid(
  doc: PdfDoc,
  payload: QuotePdfPayload,
  mode: QuotePdfMode,
  y: number
): number {
  const modality = payload.freight_modality;
  const modalityLabel =
    modality === 'lotacao' ? 'Lotação' : modality === 'fracionado' ? 'Fracionado' : '—';

  const rows: string[][] = [
    ['Cliente', payload.client_name, 'Modalidade', modalityLabel],
    ['Origem', payload.origin ?? '—', 'Destino', payload.destination ?? '—'],
    ['Tipo de Carga', humanizeCargoType(payload.cargo_type), 'Peso', formatWeight(payload.weight)],
    ['Volume', fmtNum(payload.volume, 'm³'), 'Distância', fmtNum(payload.km_distance, 'km')],
    [
      'Coleta Estimada',
      payload.estimated_loading_date ? fmtDate(payload.estimated_loading_date) : 'A confirmar',
      'Pagamento',
      payload.payment_term_name ?? '—',
    ],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    body: rows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 32 },
      1: { textColor: C.text, cellWidth: CW / 2 - 32 },
      2: { fontStyle: 'bold', textColor: C.muted, cellWidth: 32 },
      3: { textColor: C.text, cellWidth: CW / 2 - 32 },
    },
    alternateRowStyles: { fillColor: C.light },
  });

  return (doc as PdfDoc).lastAutoTable?.finalY ?? y + rows.length * 8;
}

function drawPricingTable(
  doc: PdfDoc,
  payload: QuotePdfPayload,
  mode: QuotePdfMode,
  y: number
): number {
  const bd = payload.pricing_breakdown;
  const rows: string[][] = [];

  if (bd?.components) {
    const c = bd.components;
    if ((c.baseFreight ?? 0) > 0) rows.push(['Frete', formatCurrency(c.baseFreight ?? 0)]);
    if ((c.toll ?? 0) > 0) rows.push(['Pedágio', formatCurrency(c.toll ?? 0)]);
    if ((c.insurance ?? 0) > 0) rows.push(['Seguro', formatCurrency(c.insurance ?? 0)]);
    if ((c.aluguelMaquinas ?? 0) > 0)
      rows.push(['Aluguel de Máquinas', formatCurrency(c.aluguelMaquinas ?? 0)]);
    if ((c.waitingTimeCost ?? 0) > 0)
      rows.push(['Estadia / Hora Parada', formatCurrency(c.waitingTimeCost ?? 0)]);

    if (mode === 'detailed') {
      if ((c.gris ?? 0) > 0) rows.push(['GRIS', formatCurrency(c.gris ?? 0)]);
      if ((c.tso ?? 0) > 0) rows.push(['TSO', formatCurrency(c.tso ?? 0)]);
      if ((c.rctrc ?? 0) > 0) rows.push(['RCTR-C', formatCurrency(c.rctrc ?? 0)]);
      if ((c.adValorem ?? 0) > 0) rows.push(['Ad Valorem', formatCurrency(c.adValorem ?? 0)]);
      if ((c.tde ?? 0) > 0) rows.push(['TDE', formatCurrency(c.tde ?? 0)]);
      if ((c.tear ?? 0) > 0) rows.push(['TEAR', formatCurrency(c.tear ?? 0)]);
      if ((c.dispatchFee ?? 0) > 0)
        rows.push(['Taxa de Despacho', formatCurrency(c.dispatchFee ?? 0)]);
      if ((c.conditionalFeesTotal ?? 0) > 0)
        rows.push(['Taxas Condicionais', formatCurrency(c.conditionalFeesTotal ?? 0)]);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('DETALHAMENTO DE CUSTOS', ML, y + 4);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y + 5.5, PW - MR, y + 5.5);
  y += 8;

  if (rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      body: rows,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 90 },
        1: { textColor: C.text, halign: 'right' },
      },
      alternateRowStyles: { fillColor: C.light },
    });
    y = (doc as PdfDoc).lastAutoTable?.finalY ?? y + rows.length * 6;
  }

  y += 2;
  doc.setFillColor(...C.navy);
  doc.roundedRect(ML, y, CW, 12, 2, 2, 'F');
  doc.setFillColor(...C.orange);
  doc.roundedRect(ML, y, 4, 12, 2, 2, 'F');
  doc.rect(ML + 2, y, 2, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text('VALOR TOTAL DA PROPOSTA', ML + 8, y + 7.5);

  doc.setFontSize(13);
  doc.setTextColor(...C.orangeLight);
  doc.text(formatCurrency(Number(payload.value ?? 0)), PW - MR - 4, y + 7.5, { align: 'right' });

  return y + 12 + 4;
}

function drawNotes(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  if (!payload.notes?.trim()) return y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('OBSERVAÇÕES', ML, y + 4);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y + 5.5, PW - MR, y + 5.5);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(payload.notes, CW);
  doc.text(lines, ML, y + 4);
  return y + 4 + lines.length * 4 + 4;
}

function drawFooter(doc: PdfDoc, payload: QuotePdfPayload): void {
  const ph = doc.internal.pageSize.getHeight();
  const fy = ph - 10;

  doc.setFillColor(...C.navy);
  doc.rect(0, ph - 12, PW, 12, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 215, 235);
  doc.text(
    `Vectra Cargo TMS • Cotação ${payload.quote_code ?? '—'} • ${VECTRA.phone} • ${VECTRA.email}`,
    ML,
    fy + 0.5
  );
  doc.text('Proposta comercial — não constitui contrato', PW - MR, fy + 0.5, { align: 'right' });
}

const toFilename = (code: string | null, mode: QuotePdfMode): string =>
  `cotacao-${(code || 'cotacao').replace(/[^\w-]+/g, '-')}-${mode === 'simplified' ? 'cliente' : 'interno'}.pdf`;

export async function generateQuotePdf({
  quote,
  mode,
}: {
  quote: QuotePdfPayload;
  mode: QuotePdfMode;
}): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logoBase64 = await loadLogoBase64();

  let y = drawHeader(doc, quote, mode, logoBase64);

  if (mode === 'detailed' && quote.antt_compliance?.below) {
    const banner = `ATENÇÃO: VALOR ABAIXO DO PISO ANTT (${formatCurrency(quote.antt_compliance.piso)}). NÃO ENVIAR AO CLIENTE.`;
    doc.setFillColor(220, 38, 38);
    doc.rect(ML, y, CW, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.white);
    doc.text(banner, ML + CW / 2, y + 6.5, { align: 'center' });
    y += 14;
  }

  y = drawStatusBadge(doc, quote, y);
  y = drawInfoGrid(doc, quote, mode, y + 2);
  y = drawPricingTable(doc, quote, mode, y + 4);
  y = drawNotes(doc, quote, y);

  drawFooter(doc, quote);

  return { blob: doc.output('blob'), fileName: toFilename(quote.quote_code, mode) };
}
