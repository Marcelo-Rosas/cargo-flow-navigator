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
        .filter(row => row.isValid)
        .map(row => ({
          km_from: row.km_from,
          km_to: row.km_to,
          cost_per_ton: row.cost_per_ton,
          cost_per_kg: row.cost_per_kg,
          cost_value_percent: row.cost_value_percent,
          gris_percent: row.gris_percent,
          tso_percent: row.tso_percent,
          toll_percent: row.toll_percent,
          ad_valorem_percent: row.ad_valorem_percent,
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

      const { data, error } = await supabase.functions.invoke('import-price-table', {
        body: {
          priceTable: params.priceTable,
          rows: validRows,
          importMode: params.importMode,
        },
      });

      if (error) {
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
