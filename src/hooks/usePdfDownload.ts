import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { generateLoadCompositionProposalPdf } from '@/lib/generateLoadCompositionProposalPdf';
import type { LoadCompositionSuggestionWithDetails } from '@/types/load-composition';

type QuotePdfMode = 'simplified' | 'detailed';

type GenerateQuoteEmailPdfResponse = {
  pdf_base64: string;
  file_name: string;
  quote_code?: string;
};

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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function usePdfDownload() {
  const [loading, setLoading] = useState<string | false>(false);

  const downloadQuotePdf = useCallback(async (quoteId: string, mode: QuotePdfMode) => {
    setLoading(`quote:${mode}`);
    try {
      const { data: anttCheck } = await supabase.rpc('validate_quote_antt_floor', {
        p_quote_id: quoteId,
      });
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

      const data = await invokeEdgeFunction<GenerateQuoteEmailPdfResponse>(
        'generate-quote-email-pdf',
        {
          body: { quoteId, emailMode: mode },
        }
      );

      if (!data?.pdf_base64 || !data.file_name) {
        throw new Error('Resposta inválida ao gerar PDF da cotação.');
      }

      const blob = base64ToBlob(data.pdf_base64, 'application/pdf');
      triggerBlobDownload(blob, data.file_name);
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
