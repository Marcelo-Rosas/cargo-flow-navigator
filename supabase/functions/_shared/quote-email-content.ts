import { formatQuoteBRL, PAYMENT_METHOD_LABELS } from './quote-email-format.ts';
import type {
  EmailRow,
  PaymentTerm,
  QuoteEmailContent,
  QuoteEmailMode,
  RouteStop,
} from './quote-email-types.ts';

export function buildQuoteEmailContent(
  quote: Record<string, unknown>,
  paymentTerm: PaymentTerm | null,
  routeStops: RouteStop[] = [],
  emailMode: QuoteEmailMode = 'simplified',
  company: Record<string, unknown> | null = null
): QuoteEmailContent {
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

  const baseFreight = components?.baseFreight as number | null;
  const toll = components?.toll as number | null;
  const gris = components?.gris as number | null;
  const tso = components?.tso as number | null;
  const rctrc = components?.rctrc as number | null;
  const adValorem = components?.adValorem as number | null;
  const tde = components?.tde as number | null;
  const tear = components?.tear as number | null;
  const dispatchFee = components?.dispatchFee as number | null;
  const conditionalFeesTotal = components?.conditionalFeesTotal as number | null;
  const insurance = components?.insurance as number | null;
  const aluguelMaquinas = components?.aluguelMaquinas as number | null;
  const waitingTimeCost = components?.waitingTimeCost as number | null;
  const custosDescarga = profitability?.custosDescarga as number | null;

  const grisPercent = rates?.grisPercent as number | null;
  const tsoPercent = rates?.tsoPercent as number | null;
  const costValuePercent = rates?.costValuePercent as number | null;
  const adValoremPercent = rates?.adValoremPercent as number | null;

  const das = totals?.das as number | null;
  const dasPercent = rates?.dasPercent as number | null;

  const notes = ((quote.notes as string) || '').trim();
  const paymentMethod = (quote.payment_method as string) || '';
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[paymentMethod] || '';

  const advancePercent = paymentTerm?.advance_percent ?? 0;
  const balancePercent = 100 - advancePercent;
  const advanceAmount = value * (advancePercent / 100);
  const balanceAmount = value - advanceAmount;

  const isDetailed = emailMode === 'detailed';
  const pricingRows: EmailRow[] = [];

  if (isDetailed && baseFreight != null && baseFreight > 0) {
    pricingRows.push({ label: 'Frete Base', value: formatQuoteBRL(baseFreight) });
  }
  if (toll != null && toll > 0) {
    pricingRows.push({ label: 'Pedágio', value: formatQuoteBRL(toll) });
  }

  if (isDetailed) {
    if (gris != null && gris > 0) {
      pricingRows.push({
        label: `GRIS (${(grisPercent ?? 0).toFixed(2)}%)`,
        value: formatQuoteBRL(gris),
      });
    }
    if (tso != null && tso > 0) {
      pricingRows.push({
        label: `TSO (${(tsoPercent ?? 0).toFixed(2)}%)`,
        value: formatQuoteBRL(tso),
      });
    }
    if (rctrc != null && rctrc > 0) {
      pricingRows.push({
        label: `RCTR-C (${(costValuePercent ?? 0).toFixed(2)}%)`,
        value: formatQuoteBRL(rctrc),
      });
    }
    if (adValorem != null && adValorem > 0) {
      pricingRows.push({
        label: `Ad Valorem (${(adValoremPercent ?? 0).toFixed(3)}%)`,
        value: formatQuoteBRL(adValorem),
      });
    }
    if (tde != null && tde > 0) pricingRows.push({ label: 'TDE', value: formatQuoteBRL(tde) });
    if (tear != null && tear > 0) pricingRows.push({ label: 'TEAR', value: formatQuoteBRL(tear) });
    if (dispatchFee != null && dispatchFee > 0) {
      pricingRows.push({ label: 'Taxa de Despacho', value: formatQuoteBRL(dispatchFee) });
    }
    if (conditionalFeesTotal != null && conditionalFeesTotal > 0) {
      pricingRows.push({
        label: 'Taxas Condicionais',
        value: formatQuoteBRL(conditionalFeesTotal),
      });
    }
  }

  if (insurance != null && insurance > 0) {
    pricingRows.push({ label: 'Seguro', value: formatQuoteBRL(insurance) });
  }
  if (aluguelMaquinas != null && aluguelMaquinas > 0) {
    pricingRows.push({ label: 'Aluguel de Máquinas', value: formatQuoteBRL(aluguelMaquinas) });
  }
  if (waitingTimeCost != null && waitingTimeCost > 0) {
    pricingRows.push({ label: 'Estadia / Hora Parada', value: formatQuoteBRL(waitingTimeCost) });
  }
  if (custosDescarga != null && custosDescarga > 0) {
    pricingRows.push({ label: 'Descarga', value: formatQuoteBRL(custosDescarga) });
  }

  const clientRows: EmailRow[] = [];
  const additionalShippers = (
    Array.isArray(quote.additional_shippers) ? quote.additional_shippers : []
  ) as Array<{ name?: string }>;
  const destinations = routeStops.filter((s) => s.stop_type === 'destination');
  const stops = routeStops.filter((s) => s.stop_type === 'stop');

  if (isCIF) {
    clientRows.push({ label: 'Cliente (Embarcador)', value: shipperName || '—' });
    additionalShippers.forEach((s, i) => {
      clientRows.push({ label: `Embarcador ${i + 2}`, value: s.name || '—' });
    });
  } else {
    clientRows.push({ label: 'Cliente', value: clientName });
    destinations.forEach((s, i) => {
      const val = s.name?.trim() || s.city_uf?.trim() || s.cep || '—';
      clientRows.push({ label: `Destinatário ${i + 1}`, value: val });
    });
  }

  const routeRows: EmailRow[] = [{ label: 'Origem', value: origin }];
  stops.forEach((s, i) => {
    const val = s.city_uf?.trim() || s.name?.trim() || s.cep || '—';
    routeRows.push({ label: `Parada ${i + 1}`, value: val });
  });
  routeRows.push({ label: 'Destino', value: destination });
  if (routeUf) routeRows.push({ label: 'Rota UF', value: routeUf });
  if (kmBand) routeRows.push({ label: 'Faixa KM', value: `${kmBand} km` });
  if (freightType) {
    routeRows.push({
      label: 'Tipo Frete',
      value: `${freightType}${modalityLabel ? ` — ${modalityLabel}` : ''}`,
    });
  }

  const taxRow =
    das != null && das > 0
      ? {
          label: `DAS Simples Nacional${dasPercent ? ` (${dasPercent}%)` : ''}`,
          value: formatQuoteBRL(das),
        }
      : undefined;

  const hasPaymentInfo = Boolean(paymentTerm || paymentMethodLabel);
  const payment = hasPaymentInfo
    ? {
        termName: paymentTerm?.name,
        methodLabel: paymentMethodLabel || undefined,
        advancePercent,
        balancePercent,
        advanceAmount: formatQuoteBRL(advanceAmount),
        balanceAmount: formatQuoteBRL(balanceAmount),
        days: paymentTerm?.days,
      }
    : undefined;

  const bankRows: EmailRow[] = [];
  const bankName = (company?.bank_name as string | null) ?? null;
  const bankAgency = (company?.bank_agency as string | null) ?? null;
  const bankAccount = (company?.bank_account as string | null) ?? null;
  const bankPixKey = (company?.bank_pix_key as string | null) ?? null;
  if (bankName) bankRows.push({ label: 'Banco', value: bankName });
  if (bankAgency) bankRows.push({ label: 'Agência', value: bankAgency });
  if (bankAccount) bankRows.push({ label: 'Conta', value: bankAccount });
  if (bankPixKey) bankRows.push({ label: 'Chave Pix', value: bankPixKey });

  return {
    quoteCode,
    value,
    valueFormatted: formatQuoteBRL(value),
    clientRows,
    routeRows,
    pricingRows,
    taxRow,
    payment,
    bankRows: bankRows.length ? bankRows : undefined,
    notes: notes || undefined,
  };
}
