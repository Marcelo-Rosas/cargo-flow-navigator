import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateLiquidityIndicators } from '@/lib/financialLiquidity';

export function useLiquidityIndicators() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['liquidity-indicators'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const in12Months = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [{ data: fatDocs }, { data: pagDocs }] = await Promise.all([
        supabase.from('financial_documents').select('id').eq('type', 'FAT'),
        supabase.from('financial_documents').select('id').eq('type', 'PAG'),
      ]);

      const fatIds = (fatDocs ?? []).map((d) => d.id);
      const pagIds = (pagDocs ?? []).map((d) => d.id);

      const [{ data: fat12 }, { data: pag12 }, { data: fat30 }] = await Promise.all([
        fatIds.length
          ? supabase
              .from('financial_installments')
              .select('amount')
              .in('financial_document_id', fatIds)
              .eq('status', 'pendente')
              .gte('due_date', today)
              .lte('due_date', in12Months)
          : Promise.resolve({ data: [] }),
        pagIds.length
          ? supabase
              .from('financial_installments')
              .select('amount')
              .in('financial_document_id', pagIds)
              .eq('status', 'pendente')
              .gte('due_date', today)
              .lte('due_date', in12Months)
          : Promise.resolve({ data: [] }),
        fatIds.length
          ? supabase
              .from('financial_installments')
              .select('amount')
              .in('financial_document_id', fatIds)
              .eq('status', 'pendente')
              .gte('due_date', today)
              .lte('due_date', in30Days)
          : Promise.resolve({ data: [] }),
      ]);

      const sum = (rows: { amount: number | null }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0);

      const indicators = calculateLiquidityIndicators(sum(fat12), sum(pag12), sum(fat30));

      return {
        liquidezCorrente: indicators.liquidezCorrente,
        statusCorrente: indicators.liquidezCorrente,
        liquidezSeca: indicators.liquidezSeca,
        statusSeca: indicators.liquidezSeca,
        liquidezImediata: indicators.liquidezImediata,
        statusImediata: indicators.liquidezImediata,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return { result, isLoading };
}
