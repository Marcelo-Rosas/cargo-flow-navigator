/**
 * Gera PDF do Orçamento Consolidado de Montagem (layout Vectra).
 *
 *   deno run -A --config supabase/functions/generate-contract-pdf/deno.json scripts/render-montagem-orcamento-pdf.ts
 */
/// <reference path="./deno-cli.d.ts" />
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { CORPUS_QUALITY_ORCAMENTO } from './montagem-orcamento/corpus-quality-data.ts';
import { formatBRL, LOGO_URL, sumSection } from './montagem-orcamento/format.ts';
import type { MontagemOrcamento, MontagemSection } from './montagem-orcamento/types.ts';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { left: 48, right: 48, top: 52, bottom: 56 };
const ROW_H = 18;
const TABLE_HEADER_H = 20;
const SECTION_HEADER_H = 22;
const FONT_SIZE = 8.5;
const FONT_SIZE_HEADER = 9;

const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;
const TABLE_COL_W = [68, 235, 38, 78, CONTENT_W - 68 - 235 - 38 - 78] as const;

type ColAlign = 'left' | 'center' | 'right';

const colAlign = (header: string): ColAlign => {
  if (header === 'Qtd' || header === 'Valor') return 'center';
  if (header === 'Valor Unit.' || header === 'Total') return 'right';
  return 'left';
};

const textX = (cx: number, colW: number, textW: number, align: ColAlign): number => {
  if (align === 'center') return cx + (colW - textW) / 2;
  if (align === 'right') return cx + colW - 5 - textW;
  return cx + 5;
};

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar asset: ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function drawSectionHeader(
  page: PDFPage,
  label: string,
  x: number,
  yTop: number,
  w: number,
  fontBold: PDFFont
): number {
  const h = SECTION_HEADER_H;
  page.drawRectangle({ x, y: yTop - h, width: 4, height: h, color: rgb(1, 0.549, 0) });
  page.drawRectangle({
    x: x + 4,
    y: yTop - h,
    width: w - 4,
    height: h,
    color: rgb(0.965, 0.973, 0.98),
  });
  page.drawText(label.toUpperCase(), {
    x: x + 10,
    y: yTop - h + 6,
    size: FONT_SIZE_HEADER,
    font: fontBold,
    color: rgb(0, 0.239, 0.4),
  });
  return yTop - h - 8;
}

function drawTable(
  page: PDFPage,
  header: string[],
  rows: string[][],
  x: number,
  yTop: number,
  colWidths: readonly number[],
  font: PDFFont,
  fontBold: PDFFont
): number {
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const totalH = TABLE_HEADER_H + rows.length * ROW_H;
  let y = yTop;

  page.drawRectangle({
    x,
    y: y - TABLE_HEADER_H,
    width: tableW,
    height: TABLE_HEADER_H,
    color: rgb(0.953, 0.961, 0.969),
  });

  let cx = x;
  for (let i = 0; i < header.length; i++) {
    const align = colAlign(header[i]);
    const textW = fontBold.widthOfTextAtSize(header[i], FONT_SIZE_HEADER);
    page.drawText(header[i], {
      x: textX(cx, colWidths[i], textW, align),
      y: y - TABLE_HEADER_H + 5,
      size: FONT_SIZE_HEADER,
      font: fontBold,
      color: rgb(0, 0.239, 0.4),
    });
    cx += colWidths[i];
  }

  page.drawRectangle({
    x,
    y: y - totalH,
    width: tableW,
    height: totalH,
    borderColor: rgb(0.88, 0.9, 0.93),
    borderWidth: 0.75,
  });

  for (let r = 0; r < rows.length; r++) {
    const rowTop = y - TABLE_HEADER_H - r * ROW_H;
    const rowBottom = rowTop - ROW_H;
    if (r > 0) {
      page.drawLine({
        start: { x, y: rowTop },
        end: { x: x + tableW, y: rowTop },
        thickness: 0.5,
        color: rgb(0.9, 0.92, 0.94),
      });
    }

    cx = x;
    for (let c = 0; c < header.length; c++) {
      const text = rows[r][c] ?? '';
      const colW = colWidths[c];
      const textW = font.widthOfTextAtSize(text, FONT_SIZE);
      const align = colAlign(header[c]);
      page.drawText(text, {
        x: textX(cx, colW, textW, align),
        y: rowBottom + 5,
        size: FONT_SIZE,
        font,
        color: rgb(0.1, 0.2, 0.28),
      });
      cx += colW;
    }
  }

  return yTop - totalH;
}

async function loadOrcamento(): Promise<MontagemOrcamento> {
  const jsonIdx = Deno.args.indexOf('--json');
  if (jsonIdx < 0) return CORPUS_QUALITY_ORCAMENTO;
  const path = Deno.args[jsonIdx + 1];
  if (!path) throw new Error('Uso: --json <arquivo.json>');
  return JSON.parse(await Deno.readTextFile(path)) as MontagemOrcamento;
}

async function main() {
  const orcamento = await loadOrcamento();
  const { clientName, sections, summary, excluded } = orcamento;
  const slug = orcamento.outputSlug ?? 'orcamento';

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await fetchBytes(LOGO_URL);
  const logo = await pdf.embedJpg(logoBytes);

  const totalQty = summary.reduce((acc, s) => acc + s.qty, 0);
  const totalValue = summary.reduce((acc, s) => acc + s.total, 0);

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN.top;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - MARGIN.top;
  };

  const minY = () => MARGIN.bottom;

  const fits = (height: number) => y - height >= minY();

  const ensureSpace = (height: number) => {
    if (!fits(height)) newPage();
  };

  const maxRowsForHeight = (available: number) =>
    Math.max(0, Math.floor((available - TABLE_HEADER_H) / ROW_H));

  const drawDetailTableChunk = (
    header: string[],
    rows: string[][],
    colWidths: readonly number[]
  ) => {
    const h = TABLE_HEADER_H + rows.length * ROW_H;
    y = drawTable(page, header, rows, MARGIN.left, y, colWidths, font, fontBold);
    return y;
  };

  // Capa
  const logoW = 110;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: MARGIN.left, y: y - logoH, width: logoW, height: logoH });
  y -= logoH + 12;

  page.drawText('ORÇAMENTO CONSOLIDADO DE MONTAGEM', {
    x: MARGIN.left,
    y: y - 14,
    size: 15,
    font: fontBold,
    color: rgb(0, 0.239, 0.4),
  });
  y -= 22;
  page.drawText(`Cliente: ${clientName}`, {
    x: MARGIN.left,
    y: y - 10,
    size: 10,
    font,
    color: rgb(0.2, 0.25, 0.28),
  });
  y -= 24;

  y = drawSectionHeader(page, 'Resumo (capa)', MARGIN.left, y, CONTENT_W, fontBold);
  const coverRows = [
    ...summary.map((s) => [s.label, String(s.qty), formatBRL(s.total)]),
    ['TOTAL GERAL', String(totalQty), formatBRL(totalValue)],
  ];
  y = drawTable(
    page,
    ['Categoria', 'Qtd', 'Valor'],
    coverRows,
    MARGIN.left,
    y,
    [CONTENT_W - 38 - 92, 38, 92],
    font,
    fontBold
  );
  y -= 20;

  const detailHeader = ['Código', 'Descrição', 'Qtd', 'Valor Unit.', 'Total'];

  for (const section of sections as MontagemSection[]) {
    const tableRows = section.rows.map((r) => [
      r.code,
      r.description,
      String(r.qty),
      formatBRL(r.unit),
      formatBRL(r.qty * r.unit),
    ]);

    const sectionTotal = sumSection(section);
    const subtotalBlock = 22;
    let rowIdx = 0;
    let isFirstPageOfSection = true;

    while (rowIdx < tableRows.length) {
      const sectionTitle = isFirstPageOfSection ? section.title : `${section.title} (continuação)`;
      const headerOverhead = SECTION_HEADER_H + 8 + TABLE_HEADER_H;

      if (!fits(headerOverhead + ROW_H)) {
        newPage();
        isFirstPageOfSection = false;
      }

      y = drawSectionHeader(page, sectionTitle, MARGIN.left, y, CONTENT_W, fontBold);

      const remaining = tableRows.length - rowIdx;
      let maxRows = maxRowsForHeight(y - minY() - 6);
      maxRows = Math.min(maxRows, remaining);

      if (remaining <= maxRows) {
        const withSubtotal = TABLE_HEADER_H + maxRows * ROW_H + subtotalBlock;
        if (y - withSubtotal < minY()) {
          maxRows = maxRowsForHeight(y - minY() - subtotalBlock);
          maxRows = Math.min(maxRows, remaining);
        }
      }

      if (maxRows < 1) {
        newPage();
        isFirstPageOfSection = false;
        continue;
      }
      const chunk = tableRows.slice(rowIdx, rowIdx + maxRows);
      y = drawDetailTableChunk(detailHeader, chunk, TABLE_COL_W);
      rowIdx += maxRows;
      isFirstPageOfSection = false;

      if (rowIdx < tableRows.length) {
        const nextNeeds = SECTION_HEADER_H + 8 + TABLE_HEADER_H + ROW_H;
        if (!fits(nextNeeds)) newPage();
      }
    }

    ensureSpace(subtotalBlock);
    page.drawText(`Subtotal: ${formatBRL(sectionTotal)}`, {
      x: MARGIN.left + CONTENT_W - 120,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: rgb(0, 0.239, 0.4),
    });
    y -= 24;
  }

  if (excluded && excluded.length > 0) {
    ensureSpace(SECTION_HEADER_H + 8 + TABLE_HEADER_H + ROW_H + 16);
    y = drawSectionHeader(
      page,
      '11. ITENS EXCLUÍDOS DO ORÇAMENTO',
      MARGIN.left,
      y,
      CONTENT_W,
      fontBold
    );
    y = drawTable(
      page,
      ['Código', 'Descrição', 'Motivo'],
      excluded.map((e) => [e.code, e.description, e.reason]),
      MARGIN.left,
      y,
      [72, CONTENT_W - 72 - 180, 180],
      font,
      fontBold
    );
    y -= 20;
  }

  const bytes = await pdf.save();
  const outPath = `tests/smoke/montagem/orcamento-montagem-${slug}.pdf`;
  const outUrl = new URL(outPath, `file://${Deno.cwd().replace(/\\/g, '/')}/`);
  await Deno.mkdir(new URL('./', outUrl), { recursive: true });
  await Deno.writeFile(outUrl, bytes);
  console.log(`[montagem-pdf] OK — ${bytes.byteLength} bytes → ${outUrl.href}`);
}

await main();
