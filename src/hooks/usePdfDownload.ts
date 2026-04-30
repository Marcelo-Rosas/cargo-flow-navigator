import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateLoadCompositionProposalPdf } from '@/lib/generateLoadCompositionProposalPdf';
import type { QuotePdfPayload } from '@/lib/generateQuotePdf';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import type { LoadCompositionSuggestionWithDetails } from '@/types/load-composition';

type QuotePdfMode = 'simplified' | 'detailed';

const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  // Append to <html> instead of <body> — Radix Dialog applies aria-hidden to
  // <body>/<div#root> while a modal is open, which causes window.open and
  // body-appended anchors to lose user-activation context in Chromium.
  document.documentElement.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export function usePdfDownload() {
  const [loading, setLoading] = useState<string | false>(false);

  const downloadQuotePdf = useCallback(async (quoteId: string, mode: QuotePdfMode) => {
    setLoading(`quote:${mode}`);
    try {
      const { data: rawQuote, error } = (await supabase
        .from('quotes')
        .select(
          'id, quote_code, client_name, origin, destination, value, cargo_type, weight, volume, km_distance, estimated_loading_date, validity_date, notes, created_at, updated_at, payment_term_id'
        )
        .eq('id', quoteId)
        .single()) as {
        data: (QuotePdfPayload & { payment_term_id?: string | null }) | null;
        error: { message: string } | null;
      };

      if (error || !rawQuote) {
        throw new Error(error?.message || 'Cotação não encontrada para gerar PDF.');
      }

      let payment_term_name: string | null = null;
      if (rawQuote.payment_term_id) {
        const { data: termData } = await supabase
          .from('payment_terms')
          .select('name')
          .eq('id', rawQuote.payment_term_id)
          .maybeSingle();
        payment_term_name = (termData as { name?: string | null } | null)?.name ?? null;
      }

      const data: QuotePdfPayload = { ...rawQuote, payment_term_name };

      const { blob, fileName } = await generateQuotePdf({
        quote: data,
        mode,
      });
      triggerBlobDownload(blob, fileName);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível gerar o PDF da cotação.';
      toast.error('Falha ao gerar PDF da cotação', { description: message });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadLoadCompositionPdf = useCallback(async (compositionId: string) => {
    setLoading('composition');
    try {
      const { data, error } = (await supabase
        .from('load_composition_suggestions' as never)
        .select(
          `
            *,
            routings:load_composition_routings(*),
            metrics:load_composition_metrics(*),
            discounts:load_composition_discount_breakdown(*)
          `
        )
        .eq('id', compositionId)
        .single()) as {
        data: LoadCompositionSuggestionWithDetails | null;
        error: { message: string } | null;
      };

      if (error || !data) {
        throw new Error(error?.message || 'Sugestão de composição não encontrada.');
      }

      const quoteIds = data.quote_ids ?? [];
      const quoteCodeById: Record<string, string | null> = {};
      if (quoteIds.length > 0) {
        const { data: quotes, error: quotesError } = await supabase
          .from('quotes')
          .select('id, quote_code')
          .in('id', quoteIds);

        if (quotesError) {
          throw new Error(quotesError.message);
        }

        (quotes ?? []).forEach((quote) => {
          quoteCodeById[quote.id] = quote.quote_code;
        });
      }

      await generateLoadCompositionProposalPdf({
        suggestion: data,
        quoteCodeById,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível gerar o PDF da composição.';
      toast.error('Falha ao gerar PDF da composição', { description: message });
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { downloadQuotePdf, downloadLoadCompositionPdf, loading };
}
