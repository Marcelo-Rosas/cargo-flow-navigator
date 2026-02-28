import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ParsedPriceRow } from '@/lib/priceTableParser';

export interface PriceTableImportInput {
  id?: string | 'new';
  name: string;
  modality: 'lotacao' | 'fracionado';
  valid_from?: string | null;
  valid_until?: string | null;
  active?: boolean;
}

export interface ImportPriceTableParams {
  priceTable: PriceTableImportInput;
  rows: ParsedPriceRow[];
  importMode: 'replace' | 'upsert';
}

export interface ImportPriceTableResult {
  success: boolean;
  priceTableId?: string;
  rowsTotal: number;
  rowsInserted: number;
  rowsUpdated: number;
  duplicatesRemoved: number;
  errors: string[];
}

export function useImportPriceTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ImportPriceTableParams): Promise<ImportPriceTableResult> => {
      // Filter only valid rows and map to the expected format
      const validRows = params.rows
        .filter((row) => row.isValid)
        .map((row) => ({
          km_from: row.km_from,
          km_to: row.km_to,
          cost_per_ton: row.cost_per_ton,
          cost_per_kg: row.cost_per_kg,
          cost_value_percent: row.cost_value_percent,
          gris_percent: row.gris_percent,
          tso_percent: row.tso_percent,
          toll_percent: row.toll_percent,
          // LTL weight range columns
          weight_rate_10: row.weight_rate_10,
          weight_rate_20: row.weight_rate_20,
          weight_rate_30: row.weight_rate_30,
          weight_rate_50: row.weight_rate_50,
          weight_rate_70: row.weight_rate_70,
          weight_rate_100: row.weight_rate_100,
          weight_rate_150: row.weight_rate_150,
          weight_rate_200: row.weight_rate_200,
          weight_rate_above_200: row.weight_rate_above_200,
        }));

      if (validRows.length === 0) {
        return {
          success: false,
          rowsTotal: 0,
          rowsInserted: 0,
          rowsUpdated: 0,
          duplicatesRemoved: 0,
          errors: ['Nenhuma linha válida para importar'],
        };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token ?? undefined;
      }
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke('import-price-table', {
        body: {
          priceTable: params.priceTable,
          rows: validRows,
          importMode: params.importMode,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        // Try to extract detailed error from Edge Function response
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.errors?.length) {
              throw new Error(body.errors.join('; '));
            }
          } catch {
            // ignore parse errors
          }
        }
        throw new Error(error.message || 'Erro ao chamar função de importação');
      }

      return data as ImportPriceTableResult;
    },
    onSuccess: () => {
      // Invalidate all price table related queries
      queryClient.invalidateQueries({ queryKey: ['price_tables'] });
      queryClient.invalidateQueries({ queryKey: ['price_table_rows'] });
    },
  });
}
