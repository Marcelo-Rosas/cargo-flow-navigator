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

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

const COLORS = {
  primary: [27, 42, 74] as [number, number, number],
  accent: [232, 117, 26] as [number, number, number],
  text: [45, 45, 45] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
};

const formatNumber = (value: number | null | undefined, unit?: string): string => {
  if (value == null) return '—';
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const toFilename = (quoteCode: string | null, mode: QuotePdfMode): string => {
  const base = (quoteCode || 'cotacao').replace(/[^\w-]+/g, '_');
  const suffix = mode === 'simplified' ? 'cliente' : 'interno';
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_${suffix}_${date}.pdf`;
};

export async function generateQuotePdf({
  quote,
  mode,
}: {
  quote: QuotePdfPayload;
  mode: QuotePdfMode;
}): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(16);
  doc.text('PROPOSTA DE FRETE', marginL, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(9);
  doc.text(
    mode === 'simplified' ? 'Versão Cliente (Simplificada)' : 'Versão Interna (Detalhada)',
    marginL,
    y
  );
  y += 4;

  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.6);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.text(quote.quote_code || 'Cotação sem código', marginL, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(10);
  doc.text(quote.client_name || 'Cliente não informado', marginL, y);
  y += 8;

  const summaryRows: string[][] = [
    ['Origem', quote.origin || '—'],
    ['Destino', quote.destination || '—'],
    ['Valor da proposta', formatCurrency(Number(quote.value ?? 0))],
    ['Data estimada de coleta', formatDate(quote.estimated_loading_date, { dateStyle: 'short' })],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: summaryRows,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 10, cellPadding: 2.4, textColor: COLORS.text },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 56, textColor: COLORS.muted },
      1: { cellWidth: contentWidth - 56 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 7;

  if (mode === 'detailed') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(12);
    doc.text('Detalhes Operacionais', marginL, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: [
        ['Tipo de carga', quote.cargo_type || '—'],
        ['Peso', formatNumber(quote.weight, 'kg')],
        ['Volume', formatNumber(quote.volume, 'm³')],
        ['Distância estimada', formatNumber(quote.km_distance, 'km')],
        ['Criada em', formatDate(quote.created_at, { dateStyle: 'short', timeStyle: 'short' })],
        [
          'Última atualização',
          formatDate(quote.updated_at, { dateStyle: 'short', timeStyle: 'short' }),
        ],
      ],
      theme: 'striped',
      margin: { left: marginL, right: marginR },
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: COLORS.text },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: contentWidth - 60 },
      },
    });
  }

  const fileName = toFilename(quote.quote_code, mode);
  const blob = doc.output('blob');
  return { blob, fileName };
}
