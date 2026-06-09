import { LOGO_URL } from './quote-email-format.ts';
import { buildQuoteEmailContent } from './quote-email-content.ts';
import type {
  PaymentTerm,
  QuoteEmailContent,
  QuoteEmailMode,
  RouteStop,
} from './quote-email-types.ts';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionHeader(title: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="border-left:4px solid #FF8C00;background:linear-gradient(90deg,#f8f9fa 0%,#f0f2f5 100%);padding:12px 16px;border-radius:4px;">
          <p style="margin:0;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;">${escapeHtml(title)}</p>
        </td>
      </tr>
    </table>`;
}

function infoRow(label: string, val: string, isLast = false): string {
  return `
    <tr>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f0f0f0;'}color:#7f8c8d;font-size:13px;font-weight:600;width:40%;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f0f0f0;'}color:#003d66;font-size:13px;font-weight:500;text-align:right;">${escapeHtml(val)}</td>
    </tr>`;
}

function pricingRow(label: string, val: string, isLast = false): string {
  return `
    <tr>
      <td style="padding:12px 14px;${isLast ? '' : 'border-bottom:1px solid #e9ecef;'}color:#7f8c8d;font-size:13px;font-weight:500;">${escapeHtml(label)}</td>
      <td style="padding:12px 14px;${isLast ? '' : 'border-bottom:1px solid #e9ecef;'}color:#003d66;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(val)}</td>
    </tr>`;
}

export function buildQuoteEmailHtmlFromContent(content: QuoteEmailContent): string {
  const clientRowsHtml = content.clientRows
    .map((row, i) => infoRow(row.label, row.value, i === content.clientRows.length - 1))
    .join('');

  const routeRowsHtml = content.routeRows
    .map((row, i) => infoRow(row.label, row.value, i === content.routeRows.length - 1))
    .join('');

  const pricingRowsHtml = content.pricingRows
    .map((row, i) => pricingRow(row.label, row.value, i === content.pricingRows.length - 1))
    .join('');

  const taxHtml = content.taxRow
    ? `
    ${sectionHeader('Impostos')}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9f0;border-left:4px solid #FF8C00;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="padding:12px 14px;color:#7f8c8d;font-size:13px;font-weight:500;">${escapeHtml(content.taxRow.label)}</td>
        <td style="padding:12px 14px;color:#003d66;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(content.taxRow.value)}</td>
      </tr>
    </table>`
    : '';

  const payment = content.payment;
  const paymentHtml = payment
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-left:4px solid #0076BE;border-radius:6px;margin-bottom:24px;">
      <tr>
        <td colspan="2" style="padding:16px 16px 6px;">
          <p style="margin:0 0 12px;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;">Condição de Pagamento</p>
          ${payment.termName ? `<p style="margin:0 0 12px;padding:0 0 12px;border-bottom:1px solid rgba(0,61,102,0.2);color:#003d66;font-size:13px;font-weight:600;">${escapeHtml(payment.termName)}</p>` : ''}
        </td>
      </tr>
      ${
        payment.methodLabel
          ? `
      <tr>
        <td style="padding:6px 16px;color:#7f8c8d;font-size:12px;font-weight:500;">Forma de Pagamento</td>
        <td style="padding:6px 16px;color:#003d66;font-size:12px;font-weight:600;text-align:right;">${escapeHtml(payment.methodLabel)}</td>
      </tr>`
          : ''
      }
      ${
        payment.termName && payment.advancePercent > 0
          ? `
      <tr>
        <td style="padding:6px 16px;color:#7f8c8d;font-size:12px;font-weight:500;">Adiantamento (${payment.advancePercent}%)</td>
        <td style="padding:6px 16px;color:#003d66;font-size:12px;font-weight:600;text-align:right;">${escapeHtml(payment.advanceAmount)}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 16px;color:#7f8c8d;font-size:12px;font-weight:500;">Saldo (${payment.balancePercent}%)</td>
        <td style="padding:6px 16px 16px;color:#003d66;font-size:12px;font-weight:600;text-align:right;">${escapeHtml(payment.balanceAmount)}</td>
      </tr>`
          : `
      <tr><td colspan="2" style="padding:0 16px 16px;">&nbsp;</td></tr>`
      }
    </table>`
    : '';

  const bankRowsHtml = content.bankRows?.length
    ? content.bankRows
        .map((row, i) => infoRow(row.label, row.value, i === content.bankRows!.length - 1))
        .join('')
    : '';

  const bankHtml = bankRowsHtml
    ? `
    ${sectionHeader('Dados bancários')}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-left:4px solid #e9ecef;border-radius:6px;overflow:hidden;margin-bottom:24px;padding:0 16px;">
      ${bankRowsHtml}
    </table>`
    : '';

  const notesHtml = content.notes
    ? `
    ${sectionHeader('Observações')}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-left:4px solid #e9ecef;border-radius:4px;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 16px;color:#555;font-size:13px;line-height:1.7;font-style:italic;">${escapeHtml(content.notes).replace(/\n/g, '<br />')}</td>
      </tr>
    </table>`
    : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2c3e50;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
        <tr>
          <td style="height:8px;background:linear-gradient(90deg,#FF8C00 0%,#0076BE 50%,#FF8C00 100%);font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #e9ecef;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:90px;vertical-align:middle;">
                  <img src="${LOGO_URL}" alt="Vectra Cargo" width="80" style="display:block;max-width:80px;height:auto;" />
                </td>
                <td style="padding-left:20px;vertical-align:middle;">
                  <p style="margin:0;color:#003d66;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Vectra Cargo</p>
                  <p style="margin:4px 0 0;color:#7f8c8d;font-size:12px;">Cotação de Frete</p>
                </td>
                <td style="vertical-align:middle;text-align:right;">
                  <p style="margin:0;color:#7f8c8d;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Cotação</p>
                  <p style="margin:4px 0 0;color:#FF8C00;font-size:20px;font-weight:700;">${escapeHtml(content.quoteCode)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            ${sectionHeader('Informações do Cliente')}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${clientRowsHtml}
            </table>
            ${sectionHeader('Informações da Rota')}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${routeRowsHtml}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="height:1px;background:#e9ecef;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            ${sectionHeader('Detalhamento de Custos')}
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              ${pricingRowsHtml}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#003d66;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 16px;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Valor Total</td>
                <td style="padding:20px 16px;color:#FF8C00;font-size:28px;font-weight:700;text-align:right;">${escapeHtml(content.valueFormatted)}</td>
              </tr>
            </table>
            ${taxHtml}
            ${paymentHtml}
            ${bankHtml}
            ${notesHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fa;padding:20px 32px;border-top:1px solid #e9ecef;">
            <p style="margin:0;color:#95a5a6;font-size:11px;line-height:1.6;text-align:center;">
              Esta cotação é válida por 10 dias a partir da data de envio.<br />
              Para dúvidas, responda este e-mail ou entre em contato com a Vectra Cargo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildQuoteEmailHtml(
  quote: Record<string, unknown>,
  paymentTerm: PaymentTerm | null,
  routeStops: RouteStop[] = [],
  emailMode: QuoteEmailMode = 'simplified',
  company: Record<string, unknown> | null = null
): string {
  return buildQuoteEmailHtmlFromContent(
    buildQuoteEmailContent(quote, paymentTerm, routeStops, emailMode, company)
  );
}
