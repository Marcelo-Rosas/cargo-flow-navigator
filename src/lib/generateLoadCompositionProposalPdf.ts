import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  LoadCompositionSuggestionWithDetails,
  DiscountProposal,
} from '@/hooks/useLoadCompositionSuggestions';

const fmtCurrency = (v: number) =>
  (v / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPercent = (v: number, decimals = 2) => `${(v * 100).toFixed(decimals).replace('.', ',')}%`;

function getMarginLabel(pct: number, minPct: number) {
  const pctNum = pct * 100;
  const minNum = minPct;
  return `${pctNum.toFixed(1).replace('.', ',')}% (mínimo ${minNum.toFixed(1).replace('.', ',')}%)`;
}

export async function generateLoadCompositionProposalPdf({
  suggestion,
}: {
  suggestion: LoadCompositionSuggestionWithDetails;
}): Promise<void> {
  const discounts = (suggestion.discounts ?? []) as DiscountProposal[];
  if (!discounts.length) {
    throw new Error('Nenhum desconto calculado para esta consolidação.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  type JsPdfWithAutoTable = jsPDF & {
    lastAutoTable?: {
      finalY?: number;
    };
  };
  const docWithAutoTable = doc as JsPdfWithAutoTable;

  type JsPdfWithPageCount = jsPDF & {
    getNumberOfPages: () => number;
  };
  const docWithPageCount = doc as JsPdfWithPageCount;

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  const primary: [number, number, number] = [30, 58, 95];
  const muted: [number, number, number] = [100, 116, 139];
  const black: [number, number, number] = [15, 23, 42];

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primary);
  doc.text('PROPOSTA DE CONSOLIDAÇÃO DE CARGAS', marginL, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const createdDate = new Date(suggestion.created_at).toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'normal');
  doc.text(`Sugestão: ${suggestion.id.slice(0, 8)} • Gerado em: ${createdDate}`, marginL, y);
  y += 6;

  // Divider
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 6;

  // Resumo da oportunidade
  doc.setFontSize(12);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo da oportunidade', marginL, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(...black);
  const resumoRows = [
    ['Cotações consolidadas', String(suggestion.quote_ids.length)],
    ['Score de viabilidade', `${suggestion.consolidation_score.toFixed(1).replace('.', ',')}%`],
    ['Economia estimada', fmtCurrency(suggestion.estimated_savings_brl)],
    ['Desvio de rota', `${suggestion.distance_increase_percent.toFixed(1).replace('.', ',')}%`],
  ];

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    head: [],
    body: resumoRows,
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 2, textColor: black },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: muted },
      1: { cellWidth: contentWidth - 60 },
    },
  });
  y = (docWithAutoTable.lastAutoTable?.finalY ?? y) + 8;

  // Descontos por cotação
  doc.setFontSize(12);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Descontos propostos por cotação', marginL, y);
  y += 6;

  const minMargin = discounts[0]?.minimum_margin_percent_applied ?? 30;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Estratégia: ${discounts[0]?.discount_strategy ?? 'desconhecida'} • Margem mínima aplicada: ${minMargin
      .toFixed(1)
      .replace('.', ',')}%`,
    marginL,
    y
  );
  y += 4;

  const discountRows = discounts.map((d) => [
    d.quote_id.slice(0, 8),
    fmtCurrency(d.original_quote_price_brl),
    `-${fmtCurrency(d.discount_offered_brl)} (${d.discount_percent.toFixed(2).replace('.', ',')}%)`,
    fmtCurrency(d.final_quote_price_brl),
    `${d.original_margin_percent.toFixed(1).replace('.', ',')}%`,
    getMarginLabel(d.final_margin_percent, minMargin),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['COT', 'Preço original', 'Desconto', 'Preço final', 'Margem orig.', 'Margem final']],
    body: discountRows,
    theme: 'striped',
    margin: { left: marginL, right: marginR },
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: black },
    columnStyles: {
      0: { cellWidth: 18 },
      2: { cellWidth: 42 },
      5: { cellWidth: 52 },
    },
  });
  y = (docWithAutoTable.lastAutoTable?.finalY ?? y) + 8;

  // Resumo de margens
  const finalMargins = discounts.map((d) => d.final_margin_percent);
  const avgFinal = finalMargins.reduce((sum, v) => sum + v, 0) / (finalMargins.length || 1);
  const minFinal = Math.min(...finalMargins);

  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo de margens', marginL, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'normal');
  const margemRows = [
    ['Margem mínima aplicada', `${minMargin.toFixed(1).replace('.', ',')}%`],
    ['Margem média final', `${avgFinal.toFixed(1).replace('.', ',')}%`],
    ['Menor margem final', `${minFinal.toFixed(1).replace('.', ',')}%`],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: margemRows,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 2, textColor: black },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: muted },
      1: { cellWidth: contentWidth - 60 },
    },
  });
  y = (docWithAutoTable.lastAutoTable?.finalY ?? y) + 8;

  // Observações finais
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  const obsLines = doc.splitTextToSize(
    'Todos os descontos propostos respeitam a margem mínima definida para esta consolidação. Esta proposta é válida apenas para fechamento nas condições de consolidação apresentadas.',
    contentWidth
  );
  doc.text(obsLines, marginL, y);

  // Footer com página
  const pageCount = docWithPageCount.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 15, pageWidth - marginR, pageH - 15);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.text('Vectra Cargo — Proposta de Consolidação de Cargas', marginL, pageH - 10);
    doc.text(`Página ${i}/${pageCount}`, pageWidth - marginR, pageH - 10, { align: 'right' });
  }

  const filename = `proposta_consolidacao_${suggestion.id.slice(0, 8)}_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
}
