import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyFromCents, formatDate } from '@/lib/formatters';
import type {
  DiscountProposal,
  LoadCompositionSuggestionWithDetails,
} from '@/types/load-composition';

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
  getNumberOfPages: () => number;
};

const COLORS: Record<'primary' | 'muted' | 'black' | 'negative', [number, number, number]> = {
  primary: [30, 58, 95],
  muted: [100, 116, 139],
  black: [15, 23, 42],
  negative: [185, 28, 28],
};

const normalizePercent = (rawValue: number, maxExpectedPercent: number): number => {
  if (!Number.isFinite(rawValue)) return 0;
  const absValue = Math.abs(rawValue);

  // 0.343 -> 34.3
  if (absValue <= 1) return rawValue * 100;
  // 3426 -> 34.26
  if (absValue > maxExpectedPercent) return rawValue / 100;
  // 34.3 -> 34.3
  return rawValue;
};

const formatPercent = (value: number, decimals = 1): string =>
  `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}%`;

const formatNormalizedPercent = (
  rawValue: number,
  decimals: number,
  maxExpectedPercent: number
): string => formatPercent(normalizePercent(rawValue, maxExpectedPercent), decimals);

const formatNegativeCurrencyFromCents = (value: number): string =>
  `-${formatCurrencyFromCents(Math.abs(value))}`;

export const DISCOUNT_TOTAL_LABEL = 'Desconto total concedido';

export const shouldHighlightDiscountSummaryValue = (label: string, columnIndex: number): boolean =>
  columnIndex === 1 && label === DISCOUNT_TOTAL_LABEL;

const getSuggestionDisplayCode = (
  suggestion: LoadCompositionSuggestionWithDetails,
  sequence?: number
): string => {
  const dynamicSuggestionCode = (suggestion as { suggestion_code?: string | null }).suggestion_code;
  if (dynamicSuggestionCode && dynamicSuggestionCode.trim()) return dynamicSuggestionCode;

  const createdAt = new Date(suggestion.created_at);
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const sequenceNumber =
    sequence && sequence > 0
      ? sequence
      : Math.max(1, parseInt(suggestion.id.replace(/\D/g, '').slice(-4) || '1', 10));

  return `SG-${year}-${month}-${String(sequenceNumber).padStart(4, '0')}`;
};

function loadLogo(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => resolve(null);
    img.src = '/brand/logo_vectra.jpg';
  });
}

const buildSummaryRows = (suggestion: LoadCompositionSuggestionWithDetails): string[][] => [
  ['Cotações consolidadas', String(suggestion.quote_ids.length)],
  ['Score de viabilidade', formatNormalizedPercent(suggestion.consolidation_score, 1, 100)],
  ['Economia estimada', formatCurrencyFromCents(suggestion.estimated_savings_brl)],
  ['Desvio de rota', formatNormalizedPercent(suggestion.distance_increase_percent, 1, 100)],
];

const buildDiscountRows = (
  discounts: DiscountProposal[],
  quoteCodeById: Record<string, string | null | undefined>
): string[][] =>
  discounts.map((discount) => [
    quoteCodeById[discount.quote_id] || 'COT sem código',
    formatCurrencyFromCents(discount.original_quote_price_brl),
    formatNegativeCurrencyFromCents(discount.discount_offered_brl),
    formatNormalizedPercent(discount.discount_percent, 2, 100),
    formatCurrencyFromCents(discount.final_quote_price_brl),
  ]);

const buildDiscountSummaryRows = (
  discounts: DiscountProposal[],
  tollEconomyCentavos?: number,
  anttEconomyCentavos?: number
): string[][] => {
  const totalOriginal = discounts.reduce(
    (sum, discount) => sum + discount.original_quote_price_brl,
    0
  );
  const totalDiscount = discounts.reduce((sum, discount) => sum + discount.discount_offered_brl, 0);
  const totalFinal = discounts.reduce((sum, discount) => sum + discount.final_quote_price_brl, 0);
  const avgDiscountPercent =
    discounts.reduce((sum, discount) => sum + normalizePercent(discount.discount_percent, 100), 0) /
    (discounts.length || 1);
  const effectiveDiscountPercent = totalOriginal > 0 ? (totalDiscount / totalOriginal) * 100 : 0;

  const rows: string[][] = [
    ['Cotações incluídas', String(discounts.length)],
    ['Valor total original', formatCurrencyFromCents(totalOriginal)],
    [DISCOUNT_TOTAL_LABEL, formatNegativeCurrencyFromCents(totalDiscount)],
  ];

  // Economy breakdown (ANTT + toll)
  if (anttEconomyCentavos && anttEconomyCentavos > 0) {
    rows.push(['  Economia ANTT (CCD/CC)', formatCurrencyFromCents(anttEconomyCentavos)]);
  }
  if (tollEconomyCentavos && tollEconomyCentavos > 0) {
    rows.push(['  Economia de pedágio', formatCurrencyFromCents(tollEconomyCentavos)]);
  }

  rows.push(
    ['Desconto médio por cotação (%)', formatPercent(avgDiscountPercent, 2)],
    ['Desconto efetivo da proposta (%)', formatPercent(effectiveDiscountPercent, 2)],
    ['Valor total final da proposta', formatCurrencyFromCents(totalFinal)]
  );

  return rows;
};

const renderFooter = (doc: PdfDoc, pageWidth: number, marginL: number, marginR: number): void => {
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    doc.setPage(pageNumber);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageHeight - 15, pageWidth - marginR, pageHeight - 15);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text('Vectra Cargo — Proposta de Consolidação de Cargas', marginL, pageHeight - 10);
    doc.text(`Página ${pageNumber}/${pageCount}`, pageWidth - marginR, pageHeight - 10, {
      align: 'right',
    });
  }
};

export async function generateLoadCompositionProposalPdf({
  suggestion,
  quoteCodeById = {},
  suggestionSequence,
  tollEconomyCentavos,
  anttEconomyCentavos,
}: {
  suggestion: LoadCompositionSuggestionWithDetails;
  quoteCodeById?: Record<string, string | null | undefined>;
  suggestionSequence?: number;
  tollEconomyCentavos?: number;
  anttEconomyCentavos?: number;
}): Promise<void> {
  const discounts = (suggestion.discounts ?? []) as DiscountProposal[];
  if (!discounts.length) {
    throw new Error('Nenhum desconto calculado para esta consolidação.');
  }

  const suggestionCode = getSuggestionDisplayCode(suggestion, suggestionSequence);
  const logoData = await loadLogo();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  // Header
  const logoSize = 16;
  if (logoData) {
    doc.addImage(logoData, 'JPEG', marginL, y - 2, logoSize, logoSize);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.primary);
  doc.text('PROPOSTA DE CONSOLIDAÇÃO DE CARGAS', marginL + (logoData ? logoSize + 4 : 0), y + 4);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  const createdDate = formatDate(suggestion.created_at, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Sugestão: ${suggestionCode} • Gerado em: ${createdDate}`,
    marginL + (logoData ? logoSize + 4 : 0),
    y
  );
  y += 6;

  // Divider
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 6;

  // Resumo da oportunidade
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo da oportunidade', marginL, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  const resumoRows = buildSummaryRows(suggestion);

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    head: [],
    body: resumoRows,
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 2, textColor: COLORS.black },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: COLORS.muted },
      1: { cellWidth: contentWidth - 60 },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 1) return;
      const cellText = String(hookData.cell.raw ?? '');
      if (cellText.includes('-')) {
        hookData.cell.styles.textColor = [...COLORS.negative];
      }
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Descontos por cotação
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Descontos propostos por cotação', marginL, y);
  y += 6;

  const discountRows = buildDiscountRows(discounts, quoteCodeById);

  autoTable(doc, {
    startY: y,
    head: [['COT', 'Preço original', 'Desconto', 'Desconto (%)', 'Preço final']],
    body: discountRows,
    theme: 'striped',
    margin: { left: marginL, right: marginR },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: COLORS.black },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 34, halign: 'right' },
      2: { cellWidth: 34, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;

      // Desconto em valor (coluna 2) sempre negativo no cliente: pintar de vermelho.
      if (hookData.column.index === 2) {
        hookData.cell.styles.textColor = [...COLORS.negative];
        hookData.cell.styles.fontStyle = 'bold';
      }

      // Qualquer valor textual que represente número negativo também fica vermelho.
      const cellText = String(hookData.cell.raw ?? '');
      if (cellText.includes('-')) {
        hookData.cell.styles.textColor = [...COLORS.negative];
      }
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Resumo comercial
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo comercial da proposta', marginL, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  doc.setFont('helvetica', 'normal');
  const discountSummaryRows = buildDiscountSummaryRows(
    discounts,
    tollEconomyCentavos,
    anttEconomyCentavos
  );

  autoTable(doc, {
    startY: y,
    head: [],
    body: discountSummaryRows,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 2, textColor: COLORS.black },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: COLORS.muted },
      1: { cellWidth: contentWidth - 60 },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const label = String(hookData.row.raw?.[0] ?? '');
      if (shouldHighlightDiscountSummaryValue(label, hookData.column.index)) {
        hookData.cell.styles.textColor = [...COLORS.negative];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Observações finais
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  const obsLines = doc.splitTextToSize(
    'Os descontos apresentados são válidos para esta proposta de consolidação e podem variar conforme atualização operacional e comercial.',
    contentWidth
  );
  doc.text(obsLines, marginL, y);

  renderFooter(doc, pageWidth, marginL, marginR);

  const filename = `proposta_consolidacao_${suggestion.id.slice(0, 8)}_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
}
