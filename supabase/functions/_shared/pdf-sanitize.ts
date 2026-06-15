// Substitui caracteres Unicode comuns que NAO existem na codificacao WinAnsi
// usada pelo pdf-lib + StandardFonts.Helvetica. Sem isso, drawText() lanca
// `WinAnsi cannot encode "<char>" (0x<hex>)` e quebra a geracao do PDF.
//
// Mantemos os caracteres bonitos em outras camadas (UI, breakdown.meta, etc.)
// e so aplicamos esta sanitizacao no momento de desenhar texto no PDF.

const REPLACEMENTS: Record<string, string> = {
  '→': '->', // RIGHTWARDS ARROW
  '←': '<-', // LEFTWARDS ARROW
  '↑': '^', // UPWARDS ARROW
  '↓': 'v', // DOWNWARDS ARROW
  '↔': '<->', // LEFT RIGHT ARROW
  '⇒': '=>', // RIGHTWARDS DOUBLE ARROW
  '⇐': '<=', // LEFTWARDS DOUBLE ARROW
  '–': '-', // EN DASH
  '—': '-', // EM DASH
  '−': '-', // MINUS SIGN
  '“': '"', // LEFT DOUBLE QUOTATION MARK
  '”': '"', // RIGHT DOUBLE QUOTATION MARK
  '‘': "'", // LEFT SINGLE QUOTATION MARK
  '’': "'", // RIGHT SINGLE QUOTATION MARK
  '…': '...', // HORIZONTAL ELLIPSIS
  '•': '*', // BULLET
  '·': '.', // MIDDLE DOT
  '×': 'x', // MULTIPLICATION SIGN
  '÷': '/', // DIVISION SIGN
  '≈': '~', // ALMOST EQUAL TO
  '≤': '<=', // LESS-THAN OR EQUAL TO
  '≥': '>=', // GREATER-THAN OR EQUAL TO
  '≠': '!=', // NOT EQUAL TO
  ' ': ' ', // NO-BREAK SPACE
  '​': '', // ZERO WIDTH SPACE
  '‎': '', // LEFT-TO-RIGHT MARK
  '‏': '', // RIGHT-TO-LEFT MARK
  '﻿': '', // BYTE ORDER MARK
};

export function sanitizeForPdf(input: string): string {
  let out = input;
  for (const [from, to] of Object.entries(REPLACEMENTS)) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

// Embrulha um PDFPage para interceptar todos os drawText() automaticamente,
// sanitizando o texto antes do font encoder do pdf-lib v-lo.
export function patchPageDrawText<
  P extends { drawText: (t: string, ...rest: unknown[]) => unknown },
>(page: P): P {
  const original = page.drawText.bind(page);
  (page as { drawText: typeof original }).drawText = ((text: string, ...rest: unknown[]) =>
    original(typeof text === 'string' ? sanitizeForPdf(text) : text, ...rest)) as typeof original;
  return page;
}
