import { formatBRL, LOGO_URL } from './format.ts';
import type { MontagemOrcamento } from './types.ts';

const sectionHeader = (title: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <tr>
      <td style="border-left:4px solid #FF8C00;background:linear-gradient(90deg,#f8f9fa 0%,#f0f2f5 100%);padding:12px 16px;border-radius:4px;">
        <p style="margin:0;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;">${title}</p>
      </td>
    </tr>
  </table>`;

const summaryRow = (label: string, qty: string, valor: string, bold = false) => {
  const fw = bold ? '800' : '500';
  const bg = bold ? 'background:#f0f7ff;' : '';
  return `
  <tr style="${bg}">
    <td style="padding:10px 14px;border-bottom:1px solid #e9ecef;color:#003d66;font-size:13px;font-weight:${fw};">${label}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e9ecef;color:#003d66;font-size:13px;font-weight:${fw};text-align:center;width:72px;">${qty}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #e9ecef;color:#003d66;font-size:13px;font-weight:${fw};text-align:center;width:120px;">${valor}</td>
  </tr>`;
};

/**
 * HTML no layout Vectra (mesma linguagem visual de send-quote-email).
 * Uso: corpo de e-mail ou base para PDF via Playwright.
 */
export function buildMontagemEmailHtml(data: MontagemOrcamento): string {
  const totalQty = data.summary.reduce((a, s) => a + s.qty, 0);
  const totalValue = data.summary.reduce((a, s) => a + s.total, 0);

  const summaryRows = [
    ...data.summary.map((s) => summaryRow(s.label, String(s.qty), formatBRL(s.total))),
    summaryRow('TOTAL GERAL', String(totalQty), formatBRL(totalValue), true),
  ].join('');

  const excludedBlock =
    data.excluded && data.excluded.length > 0
      ? `
    ${sectionHeader('Itens excluídos')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f3f6f9;">
        <th style="padding:10px 14px;text-align:left;color:#003d66;font-size:11px;text-transform:uppercase;">Código</th>
        <th style="padding:10px 14px;text-align:left;color:#003d66;font-size:11px;text-transform:uppercase;">Descrição</th>
        <th style="padding:10px 14px;text-align:left;color:#003d66;font-size:11px;text-transform:uppercase;">Motivo</th>
      </tr>
      ${data.excluded
        .map(
          (e) => `
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #e9ecef;font-size:12px;">${e.code}</td>
        <td style="padding:10px 14px;border-top:1px solid #e9ecef;font-size:12px;">${e.description}</td>
        <td style="padding:10px 14px;border-top:1px solid #e9ecef;font-size:12px;">${e.reason}</td>
      </tr>`
        )
        .join('')}
    </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><title>Orçamento de Montagem — ${data.clientName}</title></head>
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
                <td style="vertical-align:middle;padding-left:16px;">
                  <p style="margin:0;color:#003d66;font-size:18px;font-weight:800;line-height:1.3;">Orçamento Consolidado de Montagem</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px;">
            <p style="margin:0 0 20px;color:#555;font-size:14px;"><strong style="color:#003d66;">Cliente:</strong> ${data.clientName}</p>
            ${sectionHeader('Resumo')}
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f3f6f9;">
                <th style="padding:10px 14px;text-align:left;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;">Categoria</th>
                <th style="padding:10px 14px;text-align:center;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;width:72px;">Qtd</th>
                <th style="padding:10px 14px;text-align:center;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;width:120px;">Valor</th>
              </tr>
              ${summaryRows}
            </table>
            <p style="margin:0 0 24px;color:#7f8c8d;font-size:12px;line-height:1.6;">
              O detalhamento por equipamento (código, quantidade e valor unitário) segue no PDF anexo.
            </p>
            ${excludedBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;background:#f8f9fa;border-top:1px solid #e9ecef;">
            <p style="margin:0;color:#7f8c8d;font-size:11px;text-align:center;line-height:1.5;">
              Vectra Cargo · Navegantes/SC · contato@vectracargo.com.br
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
