import { FinancialDualStrip } from '@/components/forms/quote-form/FinancialDualStrip';
import type { QuoteFinancialStripModel } from '@/lib/quote-financial-strip';

interface QuoteModalFinancialSummaryProps {
  model: QuoteFinancialStripModel;
}

/** Resumo FAT × PAG × Lucro no topo do modal de cotação. */
export function QuoteModalFinancialSummary({ model }: QuoteModalFinancialSummaryProps) {
  return <FinancialDualStrip model={model} emphasizeFat />;
}
