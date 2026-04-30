import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import logoUrl from '@/assets/logo_vectra_cargo.png?url';

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
  border: [218, 222, 230] as [number, number, number],
  success: [22, 101, 52] as [number, number, number],
};

const PW = 210;
const ML = 14;
const MR = 14;
const CW = PW - ML - MR;

// ── Helpers ────────────────────────────────────────────────────────────────────

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

const humanizeCargoType = (raw: string | null): string => {
  if (!raw) return '—';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Draws a clean arrow without relying on Unicode → (not in jsPDF Helvetica charset)
function drawArrow(doc: PdfDoc, cx: number, cy: number): void {
  const shaft = 7;
  const head = 3;
  const x0 = cx - shaft / 2;
  const x1 = cx + shaft / 2;
  doc.setDrawColor(...C.orange);
  doc.setLineWidth(1.3);
  doc.line(x0, cy, x1 - head * 0.6, cy);
  doc.setLineWidth(1.1);
  doc.line(x1 - head, cy - 2, x1, cy);
  doc.line(x1 - head, cy + 2, x1, cy);
}

async function loadLogoBase64(): Promise<string | null> {
  try {
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

// ── Section drawers ────────────────────────────────────────────────────────────

function drawHeader(doc: PdfDoc, mode: QuotePdfMode, logoBase64: string | null): number {
  const H = 32;

  // Background
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');

  // Subtle right-side accent rectangle
  doc.setFillColor(...C.navyDark);
  doc.rect(PW - 70, 0, 70, H, 'F');

  // Orange bottom bar
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 3, 'F');

  // Left side: logo or wordmark
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', ML, 4, 24, 24);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...C.white);
    doc.text('VECTRA CARGO', ML, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 180, 210);
    doc.text('Navegantes / Itajai - SC', ML, 23);
  }

  // Right side: document type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...C.white);
  doc.text('PROPOSTA COMERCIAL DE FRETE', PW - MR, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(
    mode === 'simplified' ? 'Versao Cliente' : 'USO INTERNO - Versao Detalhada',
    PW - MR,
    23,
    { align: 'right' }
  );

  return H + 3; // return Y after the orange bar
}

function drawClientBlock(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const H = 20;

  // Background
  doc.setFillColor(...C.light);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, H, 2, 2, 'FD');

  // Orange left accent
  doc.setFillColor(...C.orange);
  doc.roundedRect(ML, y, 3.5, H, 2, 2, 'F');
  doc.rect(ML + 1.5, y, 2, H, 'F'); // fill the right side of the radius gap

  // "PROPOSTO PARA" label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('PROPOSTO PARA', ML + 8, y + 6.5);

  // Client name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.navy);
  const clientFit = doc.splitTextToSize(quote.client_name || 'Cliente nao informado', CW / 2 - 10);
  doc.text(clientFit[0] as string, ML + 8, y + 14);

  // "Nº DA PROPOSTA" label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('No DA PROPOSTA', PW - MR - 4, y + 6.5, { align: 'right' });

  // Quote code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.navy);
  doc.text(quote.quote_code || '—', PW - MR - 4, y + 14, { align: 'right' });

  return y + H + 5;
}

function drawRoute(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const half = (CW - 10) / 2;
  const H = 24;

  // Origin box
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.35);
  doc.roundedRect(ML, y, half, H, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('ORIGEM', ML + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  const originLines = doc.splitTextToSize(quote.origin || '—', half - 10);
  doc.text(originLines[0] as string, ML + 5, y + 15);
  if (originLines[1]) {
    doc.setFontSize(7.5);
    doc.text(originLines[1] as string, ML + 5, y + 20.5);
  }

  // Arrow in center gap (draw manually — avoids jsPDF charset issue with →)
  drawArrow(doc, ML + half + 5, y + H / 2);

  // Destination box
  const dx = ML + half + 10;
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.border);
  doc.roundedRect(dx, y, half, H, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('DESTINO', dx + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  const destLines = doc.splitTextToSize(quote.destination || '—', half - 10);
  doc.text(destLines[0] as string, dx + 5, y + 15);
  if (destLines[1]) {
    doc.setFontSize(7.5);
    doc.text(destLines[1] as string, dx + 5, y + 20.5);
  }

  return y + H + 5;
}

function drawCargoInfo(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const H = 20;
  const cols = [
    { label: 'TIPO DE CARGA', value: humanizeCargoType(quote.cargo_type) },
    { label: 'PESO', value: formatWeight(quote.weight != null ? Number(quote.weight) : null) },
    { label: 'VOLUME', value: fmtNum(quote.volume != null ? Number(quote.volume) : null, 'm3') },
    {
      label: 'DISTANCIA',
      value: fmtNum(quote.km_distance != null ? Number(quote.km_distance) : null, 'km'),
    },
  ];
  const colW = CW / cols.length;

  doc.setFillColor(...C.light);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, H, 2, 2, 'FD');

  // Top orange accent line
  doc.setFillColor(...C.orange);
  doc.rect(ML, y, CW, 2, 'F');
  doc.roundedRect(ML, y, CW, 4, 2, 2, 'F'); // cover corners

  cols.forEach(({ label, value }, i) => {
    const x = ML + i * colW + 5;

    // Divider (except first)
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(ML + i * colW, y + 4, ML + i * colW, y + H - 2);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(label, x, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text);
    doc.text(value, x, y + 16.5);
  });

  return y + H + 5;
}

function drawValueBlock(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const H = quote.payment_term_name ? 34 : 28;

  // Main navy background
  doc.setFillColor(...C.navy);
  doc.roundedRect(ML, y, CW, H, 3, 3, 'F');

  // Orange left accent bar
  doc.setFillColor(...C.orange);
  doc.roundedRect(ML, y, 5, H, 3, 3, 'F');
  doc.rect(ML + 2, y, 3, H, 'F');

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 180, 210);
  doc.text('VALOR DA PROPOSTA', ML + 11, y + 9);

  // Value — big and bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...C.white);
  doc.text(formatCurrency(Number(quote.value ?? 0)), ML + 11, y + 22);

  // Payment term (if available)
  if (quote.payment_term_name) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.orangeLight);
    doc.text(`Pagamento: ${quote.payment_term_name}`, ML + 11, y + 30);
  }

  return y + H + 6;
}

function drawInfoRows(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  const rows: string[][] = [];

  if (quote.estimated_loading_date) {
    rows.push(['Data estimada de coleta', formatDate(quote.estimated_loading_date)]);
  } else {
    rows.push(['Data estimada de coleta', 'A confirmar']);
  }

  if (quote.validity_date) {
    rows.push(['Valida ate', formatDate(quote.validity_date)]);
  } else {
    rows.push(['Validade desta proposta', '5 dias uteis a partir da emissao']);
  }

  rows.push(['Emitida em', formatDate(new Date().toISOString())]);

  if (quote.notes) {
    rows.push(['Observacoes', quote.notes]);
  }

  autoTable(doc as jsPDF, {
    startY: y,
    head: [],
    body: rows,
    theme: 'plain',
    margin: { left: ML, right: MR },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: C.text as number[],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 68, textColor: C.muted as number[] },
      1: { cellWidth: CW - 68 },
    },
  });

  return ((doc as PdfDoc).lastAutoTable?.finalY ?? y) + 6;
}

function drawDetailedSection(doc: PdfDoc, quote: QuotePdfPayload, y: number): number {
  // Section header
  doc.setFillColor(...C.navy);
  doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.white);
  doc.text('DETALHES OPERACIONAIS', ML + 5, y + 6.5);
  y += 13;

  autoTable(doc as jsPDF, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Tipo de carga', humanizeCargoType(quote.cargo_type)],
      ['Peso bruto', formatWeight(quote.weight != null ? Number(quote.weight) : null)],
      ['Volume', fmtNum(quote.volume != null ? Number(quote.volume) : null, 'm3')],
      [
        'Distancia estimada',
        fmtNum(quote.km_distance != null ? Number(quote.km_distance) : null, 'km'),
      ],
      ['Valor cotado', formatCurrency(Number(quote.value ?? 0))],
      [
        'Data estimada de coleta',
        quote.estimated_loading_date ? formatDate(quote.estimated_loading_date) : '—',
      ],
      ['Criada em', quote.created_at ? formatDate(quote.created_at) : '—'],
      ['Ultima atualizacao', quote.updated_at ? formatDate(quote.updated_at) : '—'],
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
  const footerH = 13;

  doc.setFillColor(...C.navy);
  doc.rect(0, h - footerH, PW, footerH, 'F');

  // Orange accent line on top of footer
  doc.setFillColor(...C.orange);
  doc.rect(0, h - footerH, PW, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text('Vectra Cargo', ML, h - 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 170, 200);
  doc.text('Navegantes / Itajai, SC', ML, h - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 170, 200);
  doc.text('Proposta comercial - nao constitui contrato.', PW - MR, h - 5, { align: 'right' });
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
  const logoBase64 = await loadLogoBase64();

  let y = drawHeader(doc, mode, logoBase64);
  y += 7;
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
