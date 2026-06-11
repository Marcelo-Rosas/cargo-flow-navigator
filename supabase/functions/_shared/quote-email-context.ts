import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCompanySettings } from './company-settings.ts';
import type { PaymentTerm, RouteStop } from './quote-email-types.ts';

export async function fetchQuoteEmailContext(
  supabase: SupabaseClient,
  quoteId: string
): Promise<{
  quote: Record<string, unknown>;
  routeStops: RouteStop[];
  paymentTerm: PaymentTerm | null;
  company: Record<string, unknown> | null;
}> {
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (quoteError || !quote) {
    throw new Error(quoteError?.message || 'Quote not found');
  }

  const { data: routeStops = [] } = await supabase
    .from('quote_route_stops')
    .select('sequence, name, city_uf, cep, stop_type')
    .eq('quote_id', quoteId)
    .in('stop_type', ['stop', 'destination'])
    .order('sequence', { ascending: true });

  let paymentTerm: PaymentTerm | null = null;
  if (quote.payment_term_id) {
    const { data } = await supabase
      .from('payment_terms')
      .select('name, advance_percent, days')
      .eq('id', quote.payment_term_id)
      .maybeSingle();
    paymentTerm = data;
  }

  const company = await fetchCompanySettings(supabase);

  return {
    quote: quote as Record<string, unknown>,
    routeStops: (routeStops ?? []) as RouteStop[],
    paymentTerm,
    company: (company as Record<string, unknown> | null) ?? null,
  };
}
