import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from 'pdf-lib';
import { LOGO_BASE64 } from './logo-base64.ts';
import type { EmailRow, QuoteEmailContent } from './quote-email-types.ts';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const palette = {
  navy: rgb(0, 61 / 255, 102 / 255),
  orange: rgb(1, 140 / 255, 0),
  blue: rgb(0, 118 / 255, 190 / 255),
  gray: rgb(127 / 255, 140 / 255, 141 / 255),
  lightGray: rgb(248 / 255, 249 / 255, 250 / 255),
  taxBg: rgb(254 / 255, 249 / 255, 240 / 255),
  payBg: rgb(239 / 255, 246 / 255, 255 / 255),
  border: rgb(233 / 255, 236 / 255, 239 / 255),
  notesBg: rgb(248 / 255, 249 / 255, 250 / 255),
  footer: rgb(149 / 255, 165 / 255, 166 / 255),
  white: rgb(1, 1, 1),
  whiteMuted: rgb(0.85, 0.85, 0.85),
};

interface PdfCtx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
}

function decodeLogoBytes(): Uint8Array {
  const raw = LOGO_BASE64.startsWith('data:') ? LOGO_BASE64.split(',')[1]! : LOGO_BASE64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function newPage(ctx: PdfCtx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensureSpace(ctx: PdfCtx, needed: number): void {
  if (ctx.y - needed < MARGIN + 30) newPage(ctx);
}

function drawGradientBar(ctx: PdfCtx): void {
  const h = 8;
  ctx.y -= h;
  const third = CONTENT_W / 3;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: third, height: h, color: palette.orange });
  ctx.page.drawRectangle({
    x: MARGIN + third,
    y: ctx.y,
    width: third,
    height: h,
    color: palette.blue,
  });
  ctx.page.drawRectangle({
    x: MARGIN + third * 2,
    y: ctx.y,
    width: third,
    height: h,
    color: palette.orange,
  });
  ctx.y -= 18;
}

async function drawHeader(ctx: PdfCtx, content: QuoteEmailContent): Promise<void> {
  const logoBytes = decodeLogoBytes();
  const logo = await ctx.doc.embedJpg(logoBytes);
  const logoH = 38;
  const logoW = (logo.width / logo.height) * logoH;

  ctx.page.drawImage(logo, {
    x: MARGIN,
    y: ctx.y - logoH,
    width: logoW,
    height: logoH,
  });

  ctx.page.drawText('VECTRA CARGO', {
    x: MARGIN + logoW + 12,
    y: ctx.y - 14,
    size: 11,
    font: ctx.fontBold,
    color: palette.navy,
  });
  ctx.page.drawText('Cotação de Frete', {
    x: MARGIN + logoW + 12,
    y: ctx.y - 28,
    size: 9,
    font: ctx.font,
    color: palette.gray,
  });

  ctx.page.drawText('COTAÇÃO', {
    x: PAGE_W - MARGIN - 72,
    y: ctx.y - 12,
    size: 8,
    font: ctx.fontBold,
    color: palette.gray,
  });
  const codeSize = 16;
  const codeW = ctx.fontBold.widthOfTextAtSize(content.quoteCode, codeSize);
  ctx.page.drawText(content.quoteCode, {
    x: PAGE_W - MARGIN - codeW,
    y: ctx.y - 30,
    size: codeSize,
    font: ctx.fontBold,
    color: palette.orange,
  });

  ctx.y -= logoH + 16;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 1,
    color: palette.border,
  });
  ctx.y -= 22;
}

function drawSectionHeader(ctx: PdfCtx, title: string): void {
  ensureSpace(ctx, 44);
  const barH = 26;
  ctx.y -= barH;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: 4, height: barH, color: palette.orange });
  ctx.page.drawRectangle({
    x: MARGIN + 4,
    y: ctx.y,
    width: CONTENT_W - 4,
    height: barH,
    color: palette.lightGray,
  });
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN + 14,
    y: ctx.y + 8,
    size: 9,
    font: ctx.fontBold,
    color: palette.navy,
  });
  ctx.y -= 10;
}

function drawKeyValueRows(ctx: PdfCtx, rows: EmailRow[]): void {
  rows.forEach((row, index) => {
    ensureSpace(ctx, 22);
    ctx.page.drawText(row.label, {
      x: MARGIN,
      y: ctx.y - 12,
      size: 10,
      font: ctx.font,
      color: palette.gray,
      maxWidth: CONTENT_W * 0.48,
    });
    const valueWidth = ctx.font.widthOfTextAtSize(row.value, 10);
    ctx.page.drawText(row.value, {
      x: PAGE_W - MARGIN - valueWidth,
      y: ctx.y - 12,
      size: 10,
      font: ctx.font,
      color: palette.navy,
    });
    ctx.y -= 18;
    if (index < rows.length - 1) {
      ctx.page.drawLine({
        start: { x: MARGIN, y: ctx.y + 8 },
        end: { x: PAGE_W - MARGIN, y: ctx.y + 8 },
        thickness: 0.5,
        color: palette.border,
      });
    }
  });
  ctx.y -= 10;
}

function drawPricingTable(ctx: PdfCtx, rows: EmailRow[]): void {
  if (rows.length === 0) return;
  ensureSpace(ctx, 28 + rows.length * 20);
  const tableTop = ctx.y;
  const tableH = rows.length * 20 + 8;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: tableTop - tableH,
    width: CONTENT_W,
    height: tableH,
    color: palette.lightGray,
  });
  ctx.y = tableTop - 6;
  rows.forEach((row, index) => {
    ctx.page.drawText(row.label, {
      x: MARGIN + 10,
      y: ctx.y - 12,
      size: 10,
      font: ctx.font,
      color: palette.gray,
      maxWidth: CONTENT_W * 0.62,
    });
    const valueWidth = ctx.font.widthOfTextAtSize(row.value, 10);
    ctx.page.drawText(row.value, {
      x: PAGE_W - MARGIN - 10 - valueWidth,
      y: ctx.y - 12,
      size: 10,
      font: ctx.fontBold,
      color: palette.navy,
    });
    ctx.y -= 20;
    if (index < rows.length - 1) {
      ctx.page.drawLine({
        start: { x: MARGIN + 8, y: ctx.y + 10 },
        end: { x: PAGE_W - MARGIN - 8, y: ctx.y + 10 },
        thickness: 0.5,
        color: palette.border,
      });
    }
  });
  ctx.y -= 8;
}

function drawTotalBox(ctx: PdfCtx, content: QuoteEmailContent): void {
  ensureSpace(ctx, 56);
  const boxH = 48;
  ctx.y -= boxH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y,
    width: CONTENT_W,
    height: boxH,
    color: palette.navy,
  });
  ctx.page.drawText('VALOR TOTAL', {
    x: MARGIN + 14,
    y: ctx.y + 18,
    size: 10,
    font: ctx.fontBold,
    color: palette.whiteMuted,
  });
  const totalSize = 22;
  const totalW = ctx.fontBold.widthOfTextAtSize(content.valueFormatted, totalSize);
  ctx.page.drawText(content.valueFormatted, {
    x: PAGE_W - MARGIN - 14 - totalW,
    y: ctx.y + 14,
    size: totalSize,
    font: ctx.fontBold,
    color: palette.orange,
  });
  ctx.y -= 18;
}

function drawTaxRow(ctx: PdfCtx, row: EmailRow): void {
  ensureSpace(ctx, 52);
  drawSectionHeader(ctx, 'Impostos');
  const boxH = 30;
  ctx.y -= boxH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y,
    width: CONTENT_W,
    height: boxH,
    color: palette.taxBg,
  });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: 4, height: boxH, color: palette.orange });
  ctx.page.drawText(row.label, {
    x: MARGIN + 14,
    y: ctx.y + 10,
    size: 10,
    font: ctx.font,
    color: palette.gray,
    maxWidth: CONTENT_W * 0.62,
  });
  const valueW = ctx.fontBold.widthOfTextAtSize(row.value, 10);
  ctx.page.drawText(row.value, {
    x: PAGE_W - MARGIN - 14 - valueW,
    y: ctx.y + 10,
    size: 10,
    font: ctx.fontBold,
    color: palette.navy,
  });
  ctx.y -= 16;
}

function drawPaymentBlock(ctx: PdfCtx, content: QuoteEmailContent): void {
  const payment = content.payment;
  if (!payment) return;

  ensureSpace(ctx, 90);
  const startY = ctx.y;
  const boxH = payment.advancePercent > 0 ? 92 : payment.termName ? 72 : 48;
  ctx.y -= boxH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y,
    width: CONTENT_W,
    height: boxH,
    color: palette.payBg,
  });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: 4, height: boxH, color: palette.blue });

  let lineY = startY - 18;
  ctx.page.drawText('CONDIÇÃO DE PAGAMENTO', {
    x: MARGIN + 14,
    y: lineY - 12,
    size: 9,
    font: ctx.fontBold,
    color: palette.navy,
  });
  lineY -= 22;

  if (payment.termName) {
    ctx.page.drawText(payment.termName, {
      x: MARGIN + 14,
      y: lineY - 10,
      size: 10,
      font: ctx.fontBold,
      color: palette.navy,
    });
    lineY -= 20;
  }

  if (payment.methodLabel) {
    ctx.page.drawText('Forma de Pagamento', {
      x: MARGIN + 14,
      y: lineY - 10,
      size: 9,
      font: ctx.font,
      color: palette.gray,
    });
    const methodW = ctx.fontBold.widthOfTextAtSize(payment.methodLabel, 9);
    ctx.page.drawText(payment.methodLabel, {
      x: PAGE_W - MARGIN - 14 - methodW,
      y: lineY - 10,
      size: 9,
      font: ctx.fontBold,
      color: palette.navy,
    });
    lineY -= 18;
  }

  if (payment.termName && payment.advancePercent > 0) {
    const advLabel = `Adiantamento (${payment.advancePercent}%)`;
    ctx.page.drawText(advLabel, {
      x: MARGIN + 14,
      y: lineY - 10,
      size: 9,
      font: ctx.font,
      color: palette.gray,
    });
    const advW = ctx.fontBold.widthOfTextAtSize(payment.advanceAmount, 9);
    ctx.page.drawText(payment.advanceAmount, {
      x: PAGE_W - MARGIN - 14 - advW,
      y: lineY - 10,
      size: 9,
      font: ctx.fontBold,
      color: palette.navy,
    });
    lineY -= 16;
    const balLabel = `Saldo (${payment.balancePercent}%)`;
    ctx.page.drawText(balLabel, {
      x: MARGIN + 14,
      y: lineY - 10,
      size: 9,
      font: ctx.font,
      color: palette.gray,
    });
    const balW = ctx.fontBold.widthOfTextAtSize(payment.balanceAmount, 9);
    ctx.page.drawText(payment.balanceAmount, {
      x: PAGE_W - MARGIN - 14 - balW,
      y: lineY - 10,
      size: 9,
      font: ctx.fontBold,
      color: palette.navy,
    });
  } else if (payment.termName && payment.days != null) {
    ctx.page.drawText(`Prazo: ${payment.days} dias`, {
      x: MARGIN + 14,
      y: lineY - 10,
      size: 9,
      font: ctx.font,
      color: palette.gray,
    });
  }

  ctx.y -= 12;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawNotes(ctx: PdfCtx, notes: string): void {
  drawSectionHeader(ctx, 'Observações');
  const lines = notes.split('\n').flatMap((paragraph) => wrapText(paragraph, 88));
  ensureSpace(ctx, 24 + lines.length * 14);
  const boxH = lines.length * 14 + 16;
  ctx.y -= boxH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y,
    width: CONTENT_W,
    height: boxH,
    color: palette.notesBg,
  });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: 4, height: boxH, color: palette.border });
  let lineY = ctx.y + boxH - 18;
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN + 14,
      y: lineY,
      size: 9,
      font: ctx.font,
      color: rgb(0.33, 0.33, 0.33),
      maxWidth: CONTENT_W - 28,
    });
    lineY -= 14;
  }
  ctx.y -= 8;
}

function drawFooter(ctx: PdfCtx): void {
  ensureSpace(ctx, 40);
  ctx.page.drawLine({
    start: { x: MARGIN, y: MARGIN + 28 },
    end: { x: PAGE_W - MARGIN, y: MARGIN + 28 },
    thickness: 0.5,
    color: palette.border,
  });
  const footerLines = [
    'Esta cotação é válida por 10 dias a partir da data de envio.',
    'Para dúvidas, responda este e-mail ou entre em contato com a Vectra Cargo.',
  ];
  let y = MARGIN + 16;
  for (const line of footerLines) {
    const w = ctx.font.widthOfTextAtSize(line, 8);
    ctx.page.drawText(line, {
      x: (PAGE_W - w) / 2,
      y,
      size: 8,
      font: ctx.font,
      color: palette.footer,
    });
    y -= 11;
  }
}

export async function renderQuoteEmailPdf(content: QuoteEmailContent): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfCtx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    font,
    fontBold,
  };

  drawGradientBar(ctx);
  await drawHeader(ctx, content);

  drawSectionHeader(ctx, 'Informações do Cliente');
  drawKeyValueRows(ctx, content.clientRows);

  drawSectionHeader(ctx, 'Informações da Rota');
  drawKeyValueRows(ctx, content.routeRows);

  drawSectionHeader(ctx, 'Detalhamento de Custos');
  drawPricingTable(ctx, content.pricingRows);
  drawTotalBox(ctx, content);

  if (content.taxRow) drawTaxRow(ctx, content.taxRow);
  drawPaymentBlock(ctx, content);
  if (content.notes) drawNotes(ctx, content.notes);
  drawFooter(ctx);

  return doc.save();
}
