import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '@/lib/formatters';

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
  created_at: string | null;
  updated_at: string | null;
}

type PdfDoc = jsPDF & { lastAutoTable?: { finalY?: number } };

const C = {
  navy: [27, 42, 74] as [number, number, number],
  orange: [232, 117, 26] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [45, 45, 45] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  light: [245, 247, 250] as [number, number, number],
  border: [220, 224, 230] as [number, number, number],
};

const PW = 210;
const ML = 15;
const MR = 15;
const CW = PW - ML - MR;

const formatWeight = (raw: number | null): string => {
  if (raw == null) return '—';
  const kg = Number(raw);
  return kg >= 1000
    ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(kg / 1000)} t`
    : `${new Intl.NumberFormat('pt-BR').format(kg)} kg`;
};

const fmtNum = (raw: number | null, unit = ''): string => {
  if (raw == null) return '—';
  const s = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(raw));
  return unit ? `${s} ${unit}` : s;
};

const toFilename = (code: string | null, mode: QuotePdfMode): string =>
  `${(code || 'cotacao').replace(/[^\w-]+/g, '_')}_${mode === 'simplified' ? 'cliente' : 'interno'}_${new Date().toISOString().slice(0, 10)}.pdf`;

// ── Drawing helpers ────────────────────────────────────────────────────────────

function drawHeader(doc: PdfDoc, mode: QuotePdfMode): number {
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 28, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, 28, PW, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.white);
  doc.text('VECTRA CARGO', ML, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 215);
  doc.text('Navegantes / Itajaí — SC', ML, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text('PROPOSTA COMERCIAL DE FRETE', PW - MR, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 195, 215);
  doc.text(
    mode === 'simplified' ? 'Versão Cliente' : 'USO INTERNO — Versão Detalhada',
    PW - MR,
    19,
    { align: 'right' }
  );

  return 38;
}

function drawClientBlock(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  doc.setFillColor(...C.light);
  doc.roundedRect(ML, y, CW, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('PROPOSTO PARA', ML + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  doc.text(quote.client_name || 'Cliente não informado', ML + 4, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('Nº DA PROPOSTA', PW - MR - 4, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.navy);
  doc.text(quote.quote_code || '—', PW - MR - 4, y + 13, { align: 'right' });

  return y + 24;
}

function drawRoute(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const half = (CW - 8) / 2;

  // Origin
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, half, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('ORIGEM', ML + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  const originLines = doc.splitTextToSize(quote.origin || '—', half - 8);
  doc.text(originLines[0], ML + 4, y + 13);
  if (originLines[1]) {
    doc.setFontSize(7.5);
    doc.text(originLines[1], ML + 4, y + 18.5);
  }

  // Arrow
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.orange);
  doc.text('→', ML + half + 4, y + 13);

  // Destination
  const dx = ML + half + 8;
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.roundedRect(dx, y, half, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('DESTINO', dx + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  const destLines = doc.splitTextToSize(quote.destination || '—', half - 8);
  doc.text(destLines[0], dx + 4, y + 13);
  if (destLines[1]) {
    doc.setFontSize(7.5);
    doc.text(destLines[1], dx + 4, y + 18.5);
  }

  return y + 28;
}

function drawCargoInfo(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const cols = [
    { label: 'TIPO DE CARGA', value: quote.cargo_type || '—' },
    { label: 'PESO', value: formatWeight(quote.weight != null ? Number(quote.weight) : null) },
    { label: 'VOLUME', value: fmtNum(quote.volume != null ? Number(quote.volume) : null, 'm³') },
    {
      label: 'DISTÂNCIA',
      value: fmtNum(quote.km_distance != null ? Number(quote.km_distance) : null, 'km'),
    },
  ];
  const colW = CW / cols.length;

  doc.setFillColor(...C.light);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 18, 2, 2, 'FD');

  cols.forEach(({ label, value }, i) => {
    const x = ML + i * colW + 4;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.line(ML + i * colW, y + 3, ML + i * colW, y + 15);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(label, x, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(value, x, y + 14);
  });

  return y + 24;
}

function drawValueBlock(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  doc.setFillColor(...C.navy);
  doc.roundedRect(ML, y, CW, 26, 3, 3, 'F');
  doc.setFillColor(...C.orange);
  doc.roundedRect(ML, y, 4, 26, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 215);
  doc.text('VALOR DA PROPOSTA', ML + 10, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.white);
  doc.text(formatCurrency(Number(quote.value ?? 0)), ML + 10, y + 21);

  return y + 32;
}

function drawInfoRows(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const rows: string[][] = [];

  if (quote.estimated_loading_date) {
    rows.push(['Data estimada de coleta', formatDate(quote.estimated_loading_date)]);
  } else {
    rows.push(['Data estimada de coleta', 'A confirmar']);
  }
  rows.push(['Validade desta proposta', '5 dias úteis a partir da emissão']);
  rows.push(['Emitida em', formatDate(new Date().toISOString())]);

  autoTable(doc as jsPDF, {
    startY: y,
    head: [],
    body: rows,
    theme: 'plain',
    margin: { left: ML, right: MR },
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: C.text as number[] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 64, textColor: C.muted as number[] },
      1: { cellWidth: CW - 64 },
    },
  });

  return ((doc as PdfDoc).lastAutoTable?.finalY ?? y) + 6;
}

function drawDetailedSection(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  doc.setFillColor(...C.navy);
  doc.rect(ML, y, CW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.white);
  doc.text('DETALHES OPERACIONAIS', ML + 4, y + 5.5);
  y += 10;

  autoTable(doc as jsPDF, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Tipo de carga', quote.cargo_type || '—'],
      ['Peso bruto', formatWeight(quote.weight != null ? Number(quote.weight) : null)],
      ['Volume', fmtNum(quote.volume != null ? Number(quote.volume) : null, 'm³')],
      [
        'Distância estimada',
        fmtNum(quote.km_distance != null ? Number(quote.km_distance) : null, 'km'),
      ],
      ['Valor cotado', formatCurrency(Number(quote.value ?? 0))],
      [
        'Data estimada de coleta',
        quote.estimated_loading_date ? formatDate(quote.estimated_loading_date) : '—',
      ],
      ['Criada em', quote.created_at ? formatDate(quote.created_at) : '—'],
      ['Última atualização', quote.updated_at ? formatDate(quote.updated_at) : '—'],
      ['ID interno', quote.id],
    ],
    theme: 'striped',
    margin: { left: ML, right: MR },
    headStyles: {
      fillColor: C.navy as number[],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8.5, textColor: C.text as number[] },
    alternateRowStyles: { fillColor: C.light as number[] },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold', textColor: C.muted as number[] },
      1: { cellWidth: CW - 60 },
    },
  });

  return ((doc as PdfDoc).lastAutoTable?.finalY ?? y) + 6;
}

function drawPageFooter(doc: PdfDoc): void {
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C.navy);
  doc.rect(0, h - 11, PW, 11, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 175, 200);
  doc.text('Vectra Cargo — Navegantes / Itajaí, SC', ML, h - 4);
  doc.text('Proposta comercial — não constitui contrato.', PW - MR, h - 4, { align: 'right' });
}

// ── Main ───────────────────────────────────────────────────────────────────────

export async function generateQuotePdf({
  quote,
  mode,
}: {
  quote: QuotePdfPayload;
  mode: QuotePdfMode;
}): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;

  let y = drawHeader(doc, mode);
  y += 6;
  y = drawClientBlock(doc, quote, y);
  y = drawRoute(doc, quote, y);
  y = drawCargoInfo(doc, quote, y);
  y = drawValueBlock(doc, quote, y);
  y = drawInfoRows(doc, quote, y);

  if (mode === 'detailed') {
    y = drawDetailedSection(doc, quote, y);
  }

  drawPageFooter(doc);

  return { blob: doc.output('blob'), fileName: toFilename(quote.quote_code, mode) };
}
