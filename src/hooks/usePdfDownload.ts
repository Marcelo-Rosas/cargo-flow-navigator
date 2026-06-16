import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateLoadCompositionProposalPdf } from '@/lib/generateLoadCompositionProposalPdf';
import { generateQuotePdf } from '@/lib/generateQuotePdf';
import type { LoadCompositionSuggestionWithDetails } from '@/types/load-composition';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

type QuotePdfMode = 'simplified' | 'detailed';

const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
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
      const [{ data: anttCheck }, { data: quoteRow, error: quoteError }] = await Promise.all([
        supabase.rpc('validate_quote_antt_floor', { p_quote_id: quoteId }),
        supabase
          .from('quotes')
          .select(
            `id, quote_code, client_name, origin, destination, value, cargo_type, weight, volume,
             km_distance, estimated_loading_date, validity_date, notes, created_at, updated_at,
             pricing_breakdown, freight_modality,
             payment_terms(name)`
          )
          .eq('id', quoteId)
          .single(),
      ]);

      if (quoteError || !quoteRow) {
        throw new Error(quoteError?.message || 'Cotação não encontrada.');
      }

      const anttResult = anttCheck as {
        is_below_antt_floor?: boolean;
        piso?: number;
        current_value?: number;
      } | null;

      if (anttResult?.is_below_antt_floor && mode === 'simplified') {
        const pisoFmt = (anttResult.piso ?? 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });
        const valueFmt = (anttResult.current_value ?? 0).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });
        throw new Error(
          `PDF do cliente bloqueado: valor ${valueFmt} está abaixo do Piso ANTT (${pisoFmt}). Abra a cotação e clique em "Aplicar Piso ANTT".`
        );
      }

      const pt = quoteRow.payment_terms as { name: string } | null;
      const breakdown = quoteRow.pricing_breakdown as StoredPricingBreakdown | null;

      const { blob, fileName } = await generateQuotePdf({
        quote: {
          id: quoteRow.id,
          quote_code: quoteRow.quote_code,
          client_name: quoteRow.client_name ?? '—',
          origin: quoteRow.origin,
          destination: quoteRow.destination,
          value: quoteRow.value,
          cargo_type: quoteRow.cargo_type,
          weight: quoteRow.weight,
          volume: quoteRow.volume,
          km_distance: quoteRow.km_distance,
          estimated_loading_date: quoteRow.estimated_loading_date,
          validity_date: quoteRow.validity_date,
          notes: quoteRow.notes,
          created_at: quoteRow.created_at,
          updated_at: quoteRow.updated_at,
          payment_term_name: pt?.name ?? null,
          pricing_breakdown: breakdown,
          freight_modality: quoteRow.freight_modality as 'lotacao' | 'fracionado' | null,
          antt_compliance: anttResult?.is_below_antt_floor
            ? { piso: anttResult.piso ?? 0, below: true, modality: '' }
            : undefined,
        },
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
