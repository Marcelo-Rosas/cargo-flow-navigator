export interface RouteStop {
  sequence: number;
  name: string | null;
  city_uf: string | null;
  cep: string | null;
  stop_type?: 'origin' | 'stop' | 'destination';
}

export interface PaymentTerm {
  name: string;
  advance_percent: number | null;
  days: number;
}

export interface EmailRow {
  label: string;
  value: string;
}

export interface QuoteEmailPaymentInfo {
  termName?: string;
  methodLabel?: string;
  advancePercent: number;
  balancePercent: number;
  advanceAmount: string;
  balanceAmount: string;
  days?: number;
}

export interface QuoteEmailContent {
  quoteCode: string;
  value: number;
  valueFormatted: string;
  clientRows: EmailRow[];
  routeRows: EmailRow[];
  cargoRows: EmailRow[];
  pricingRows: EmailRow[];
  taxRow?: EmailRow;
  payment?: QuoteEmailPaymentInfo;
  bankRows?: EmailRow[];
  notes?: string;
  emittedAt?: string;
}

export type QuoteEmailMode = 'simplified' | 'detailed';
