import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  quoteId: string;
  recipientEmail: string;
  cc?: string;
  bcc?: string;
}

interface PaymentTerm {
  name: string;
  advance_percent: number | null;
  days: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  outro: 'Outro',
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const LOGO_URL = 'https://app.vectracargo.com.br/brand/logo_vectra.jpg';

interface RouteStop {
  sequence: number;
  name: string | null;
  city_uf: string | null;
  cep: string | null;
}

function buildEmailHtml(
  quote: Record<string, unknown>,
  paymentTerm: PaymentTerm | null,
  routeStops: RouteStop[] = []
): string {
  const breakdown = quote.pricing_breakdown as Record<string, unknown> | null;
  const meta = breakdown?.meta as Record<string, unknown> | null;
  const components = breakdown?.components as Record<string, unknown> | null;
  const totals = breakdown?.totals as Record<string, unknown> | null;

  const value = Number(quote.value) || 0;
  const origin = (quote.origin as string) || '—';
  const destination = (quote.destination as string) || '—';
  const clientName = (quote.client_name as string) || '—';
  const shipperName = (quote.shipper_name as string) || '—';
  const quoteCode = (quote.quote_code as string) || '—';
  const freightType = ((quote.freight_type as string) || '').toUpperCase();
  const isCIF = freightType === 'CIF';
  const freightModality = (quote.freight_modality as string) || '';
  const modalityLabel =
    freightModality === 'lotacao'
      ? 'Lotação'
      : freightModality === 'fracionado'
        ? 'Fracionado'
        : '';
  const kmBand = (meta?.kmBandLabel as string) || '';
  const routeUf = (meta?.routeUfLabel as string) || '';

  const profitability = breakdown?.profitability as Record<string, unknown> | null;
  const rates = breakdown?.rates as Record<string, unknown> | null;

  const toll = components?.toll as number | null;
  const insurance = components?.insurance as number | null;
  const aluguelMaquinas = components?.aluguelMaquinas as number | null;
  const custosDescarga = profitability?.custosDescarga as number | null;

  // Taxes
  const das = totals?.das as number | null;
  const dasPercent = rates?.dasPercent as number | null;

  // Notes
  const notes = (quote.notes as string) || '';

  // Payment method
  const paymentMethod = (quote.payment_method as string) || '';
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[paymentMethod] || '';

  // Payment calculations
  const advancePercent = paymentTerm?.advance_percent ?? 0;
  const balancePercent = 100 - advancePercent;
  const advanceAmount = value * (advancePercent / 100);
  const balanceAmount = value - advanceAmount;

  // Section header helper (email-safe table with left orange border)
  const sectionHeader = (title: string) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="border-left:4px solid #FF8C00;background:linear-gradient(90deg,#f8f9fa 0%,#f0f2f5 100%);padding:12px 16px;border-radius:4px;">
          <p style="margin:0;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;">${title}</p>
        </td>
      </tr>
    </table>`;

  // Info row helper
  const infoRow = (label: string, val: string, isLast = false) => `
    <tr>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f0f0f0;'}color:#7f8c8d;font-size:13px;font-weight:600;width:40%;">${label}</td>
      <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #f0f0f0;'}color:#003d66;font-size:13px;font-weight:500;text-align:right;">${val}</td>
    </tr>`;

  // Pricing row helper
  const pricingRow = (label: string, val: string, isLast = false) => `
    <tr>
      <td style="padding:12px 14px;${isLast ? '' : 'border-bottom:1px solid #e9ecef;'}color:#7f8c8d;font-size:13px;font-weight:500;">${label}</td>
      <td style="padding:12px 14px;${isLast ? '' : 'border-bottom:1px solid #e9ecef;'}color:#003d66;font-size:13px;font-weight:600;text-align:right;">${val}</td>
    </tr>`;

  // Build pricing rows
  const pricingRows: string[] = [];
  if (toll != null && toll > 0) pricingRows.push(pricingRow('Pedágio', formatBRL(toll)));
  if (insurance != null && insurance > 0)
    pricingRows.push(pricingRow('Seguro', formatBRL(insurance)));
  if (aluguelMaquinas != null && aluguelMaquinas > 0)
    pricingRows.push(pricingRow('Aluguel de Máquinas', formatBRL(aluguelMaquinas)));
  if (custosDescarga != null && custosDescarga > 0)
    pricingRows.push(pricingRow('Descarga', formatBRL(custosDescarga)));
  // Mark last row
  if (pricingRows.length > 0) {
    pricingRows[pricingRows.length - 1] = pricingRows[pricingRows.length - 1].replace(
      'border-bottom:1px solid #e9ecef;',
      ''
    );
  }

  // Build tax section
  const hasTaxInfo = das != null && das > 0;
  const taxHtml = hasTaxInfo
    ? `
    ${sectionHeader('Impostos')}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9f0;border-left:4px solid #FF8C00;border-radius:6px;overflow:hidden;margin-bottom:24px;">
      <tr>
        <td style="padding:12px 14px;color:#7f8c8d;font-size:13px;font-weight:500;">DAS Simples Nacional${dasPercent ? ` (${dasPercent}%)` : ''}</td>
        <td style="padding:12px 14px;color:#003d66;font-size:13px;font-weight:600;text-align:right;">${formatBRL(das!)}</td>
      </tr>
    </table>`
    : '';

  // Build client section: CIF = embarcador, FOB = cliente(s) + destinatários
  const clientRows: string[] = [];
  if (isCIF) {
    clientRows.push(infoRow('Cliente (Embarcador)', shipperName || '—', true));
  } else {
    clientRows.push(infoRow('Cliente', clientName, routeStops.length === 0));
    routeStops.forEach((s, i) => {
      const val = s.name?.trim() || s.city_uf?.trim() || s.cep || '—';
      clientRows.push(infoRow(`Destinatário ${i + 1}`, val, i === routeStops.length - 1));
    });
  }
  if (clientRows.length > 0) {
    const lastIdx = clientRows.length - 1;
    clientRows[lastIdx] = clientRows[lastIdx].replace('border-bottom:1px solid #f0f0f0;', '');
  }

  // Build route info rows: Origem, Parada(s), Destino, Faixa KM, Tipo Frete
  const routeRows: string[] = [];
  routeRows.push(infoRow('Origem', origin));
  routeStops.forEach((s, i) => {
    const val = s.city_uf?.trim() || s.name?.trim() || s.cep || '—';
    routeRows.push(infoRow(`Parada ${i + 1}`, val));
  });
  routeRows.push(infoRow('Destino', destination));
  if (routeUf) routeRows.push(infoRow('Rota UF', routeUf));
  if (kmBand) routeRows.push(infoRow('Faixa KM', `${kmBand} km`));
  if (freightType)
    routeRows.push(
      infoRow('Tipo Frete', `${freightType}${modalityLabel ? ` — ${modalityLabel}` : ''}`, true)
    );

  // Payment section (show if paymentTerm or paymentMethod exists)
  const hasPaymentInfo = paymentTerm || paymentMethodLabel;
  const paymentHtml = hasPaymentInfo
    ? `
    <!-- Payment Condition -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-left:4px solid #0076BE;border-radius:6px;margin-bottom:24px;">
      <tr>
        <td colspan="2" style="padding:16px 16px 6px;">
          <p style="margin:0 0 12px;color:#003d66;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;">Condição de Pagamento</p>
          ${paymentTerm ? `<p style="margin:0 0 12px;padding:0 0 12px;border-bottom:1px solid rgba(0,61,102,0.2);color:#003d66;font-size:13px;font-weight:600;">${paymentTerm.name}</p>` : ''}
        </td>
      </tr>
      ${
        paymentMethodLabel
          ? `
      <tr>
        <td style="padding:6px 16px;color:#7f8c8d;font-size:12px;font-weight:500;">Forma de Pagamento</td>
        <td style="padding:6px 16px;color:#003d66;font-size:12px;font-weight:600;text-align:right;">${paymentMethodLabel}</td>
      </tr>`
          : ''
      }
      ${
        paymentTerm && advancePercent > 0
          ? `
      <tr>
        <td style="padding:6px 16px;color:#7f8c8d;font-size:12px;font-weight:500;">Adiantamento (${advancePercent}%)</td>
        <td style="padding:6px 16px;color:#003d66;font-size:12px;font-weight:600;text-align:right;">${formatBRL(advanceAmount)}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 16px;color:#7f8c8d;font-size:12px;font-weight:500;">Saldo (${balancePercent}%)</td>
        <td style="padding:6px 16px 16px;color:#003d66;font-size:12px;font-weight:600;text-align:right;">${formatBRL(balanceAmount)}</td>
      </tr>`
          : paymentTerm
            ? `
      <tr>
        <td colspan="2" style="padding:0 16px 16px;color:#7f8c8d;font-size:12px;">
          Prazo: ${paymentTerm.days} dias
        </td>
      </tr>`
            : `
      <tr><td colspan="2" style="padding:0 16px 16px;">&nbsp;</td></tr>`
      }
    </table>`
    : '';

  // Notes section
  const notesHtml = notes
    ? `
    ${sectionHeader('Observações')}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-left:4px solid #e9ecef;border-radius:4px;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 16px;color:#555;font-size:13px;line-height:1.7;font-style:italic;">${notes.replace(/\n/g, '<br />')}</td>
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

        <!-- Gradient Bar -->
        <tr>
          <td style="height:8px;background:linear-gradient(90deg,#FF8C00 0%,#0076BE 50%,#FF8C00 100%);font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Header -->
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
                  <p style="margin:4px 0 0;color:#FF8C00;font-size:20px;font-weight:700;">${quoteCode}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">

            <!-- Client Section: CIF = embarcador, FOB = cliente(s) -->
            ${sectionHeader('Informações do Cliente')}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${clientRows.join('')}
            </table>

            <!-- Route Section -->
            ${sectionHeader('Informações da Rota')}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${routeRows.join('')}
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="height:1px;background:#e9ecef;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Pricing Section -->
            ${sectionHeader('Detalhamento de Custos')}
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              ${pricingRows.join('')}
            </table>

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#003d66;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 16px;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Valor Total</td>
                <td style="padding:20px 16px;color:#FF8C00;font-size:28px;font-weight:700;text-align:right;">${formatBRL(value)}</td>
              </tr>
            </table>

            ${taxHtml}

            ${paymentHtml}

            ${notesHtml}

          </td>
        </tr>

        <!-- Footer -->
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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    if (!body?.quoteId || !isUuid(body.quoteId)) {
      return new Response(JSON.stringify({ error: 'Invalid quoteId (expected uuid)' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    if (!body?.recipientEmail || !body.recipientEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid recipientEmail' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // Fetch quote from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', body.quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: quoteError?.message || 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: routeStops = [] } = await supabase
      .from('quote_route_stops')
      .select('sequence, name, city_uf, cep')
      .eq('quote_id', body.quoteId)
      .eq('stop_type', 'stop')
      .order('sequence', { ascending: true });

    // Fetch payment term if available
    let paymentTerm: PaymentTerm | null = null;
    if (quote.payment_term_id) {
      const { data } = await supabase
        .from('payment_terms')
        .select('name, advance_percent, days')
        .eq('id', quote.payment_term_id)
        .maybeSingle();
      paymentTerm = data;
    }

    const quoteCode = quote.quote_code || quote.id.slice(0, 8);
    const html = buildEmailHtml(quote, paymentTerm, routeStops ?? []);

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vectra Cargo <cotacao@cotacao.vectracargo.com.br>',
        to: [body.recipientEmail],
        ...(body.cc ? { cc: [body.cc] } : {}),
        ...(body.bcc ? { bcc: [body.bcc] } : {}),
        subject: `Cotação ${quoteCode} — Vectra Cargo`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      return new Response(JSON.stringify({ error: `Resend error: ${resendError}` }), {
        status: 502,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const resendData = await resendRes.json();

    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
