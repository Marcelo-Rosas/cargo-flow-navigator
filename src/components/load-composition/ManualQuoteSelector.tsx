/**
 * ManualQuoteSelector
 * Lets the user pick 2+ quotes from the same shipper and trigger manual analysis.
 * Used inside LoadCompositionOverlay / Panel.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyzeLoadComposition } from '@/hooks/useAnalyzeLoadComposition';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

const ELIGIBLE_STAGES = ['precificacao', 'enviado', 'negociacao'];

interface ManualQuoteSelectorProps {
  shipperId: string;
  onAnalysisComplete?: () => void;
}

interface QuoteRow {
  id: string;
  quote_code: string | null;
  client_name: string;
  origin: string;
  destination: string;
  value: number;
  weight: number | null;
  estimated_loading_date: string | null;
  km_distance: number | null;
  stage: string;
}

export function ManualQuoteSelector({ shipperId, onAnalysisComplete }: ManualQuoteSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['manual-selector-quotes', shipperId],
    queryFn: async () => {
      const { data } = await supabase
        .from('quotes')
        .select(
          'id, quote_code, client_name, origin, destination, value, weight, estimated_loading_date, km_distance, stage'
        )
        .eq('shipper_id', shipperId)
        .in('stage', ELIGIBLE_STAGES)
        .not('estimated_loading_date', 'is', null)
        .order('estimated_loading_date', { ascending: true });
      return (data ?? []) as QuoteRow[];
    },
    enabled: !!shipperId,
    staleTime: 2 * 60 * 1000,
  });

  const { mutate: analyze, isPending } = useAnalyzeLoadComposition();

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAnalyze = () => {
    if (selectedIds.size < 2) return;
    analyze(
      {
        shipper_id: shipperId,
        trigger_source: 'manual',
        quote_ids: Array.from(selectedIds),
      },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          onAnalysisComplete?.();
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma cotação elegível para este embarcador.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Selecione cotações para análise manual ({quotes.length} elegíveis)
        </h4>
        <Button
          size="sm"
          disabled={selectedIds.size < 2 || isPending}
          onClick={handleAnalyze}
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analisar {selectedIds.size} cotações
            </>
          )}
        </Button>
      </div>

      {selectedIds.size === 1 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertCircle className="w-3.5 h-3.5" />
          Selecione pelo menos 2 cotações
        </div>
      )}

      <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
        {quotes.map((q) => (
          <label
            key={q.id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggle(q.id)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{q.quote_code || q.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground truncate">{q.client_name}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {q.origin?.split(',')[0]} → {q.destination?.split(',')[0]}
                {q.weight ? ` • ${Number(q.weight).toLocaleString('pt-BR')}kg` : ''}
                {q.km_distance ? ` • ${Number(q.km_distance).toLocaleString('pt-BR')}km` : ''}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-semibold">{formatCurrency(Number(q.value))}</div>
              <div className="text-[10px] text-muted-foreground">
                {q.estimated_loading_date ? (
                  formatDate(q.estimated_loading_date)
                ) : (
                  <span className="text-amber-500">Sem data</span>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
