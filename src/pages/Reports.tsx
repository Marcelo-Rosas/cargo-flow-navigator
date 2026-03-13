import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Receipt, Download } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDreOperacionalReport } from '@/hooks/useDreOperacionalReport';
import { useVehicleTypes } from '@/hooks/usePricingRules';
import { DreOperacionalTable } from '@/components/reports/DreOperacionalTable';
import { DateFilterRange } from '@/components/filters/DateFilterRange';
import {
  type DateFilterMode,
  type DateFilterRange as DateFilterRangeType,
  getRangeFromMonth,
  getCurrentMonthYear,
} from '@/lib/dateFilterUtils';
import type { PeriodType } from '@/modules/dre';

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'detail', label: 'Detalhado' },
  { value: 'month', label: 'Mês' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
];

const { month: CUR_MONTH, year: CUR_YEAR } = getCurrentMonthYear();
const DEFAULT_RANGE = getRangeFromMonth(CUR_MONTH, CUR_YEAR);

export default function Reports() {
  const [filterMode, setFilterMode] = useState<DateFilterMode>('month');
  const [dateFrom, setDateFrom] = useState<string>(DEFAULT_RANGE.dateFrom);
  const [dateTo, setDateTo] = useState<string>(DEFAULT_RANGE.dateTo);
  const [quoteCode, setQuoteCode] = useState<string>('');
  const [osNumber, setOsNumber] = useState<string>('');
  const [periodType, setPeriodType] = useState<PeriodType>('detail');
  const [vehicleTypeId, setVehicleTypeId] = useState<string | null>(null);

  const handleRangeChange = (range: DateFilterRangeType) => {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const { data: vehicleTypes } = useVehicleTypes();
  const { data: dreTables, isLoading: isLoadingDre } = useDreOperacionalReport({
    dateFrom,
    dateTo,
    quoteCode: quoteCode.trim() || null,
    osNumber: osNumber.trim() || null,
    periodType,
    vehicleTypeId,
    enabled: true,
  });

  const exportDreCsv = () => {
    if (!dreTables || dreTables.length === 0) return;
    const lines: string[] = [];
    for (const table of dreTables) {
      lines.push(`"${table.period_key}"`);
      lines.push('Item,Presumido,Real,Var R$,Var %,Badge');
      for (const row of table.rows) {
        const isPct = row.line_code === 'margem_liquida';
        const presumido = isPct
          ? `${row.presumed_value.toFixed(2)}%`
          : row.presumed_value.toFixed(2);
        const real = isPct ? `${row.real_value.toFixed(2)}%` : row.real_value.toFixed(2);
        const varR = isPct ? `${row.variance_value.toFixed(1)} pp` : row.variance_value.toFixed(2);
        lines.push(
          `"${row.line_label}",${presumido},${real},${varR},${row.variance_percent.toFixed(2)},${row.badge_color}`
        );
      }
      lines.push('');
    }
    const csv = ['\uFEFF' + lines.join('\n')];
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dre-operacional-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BarChart3 className="w-8 h-8 text-primary" />
            Relatórios
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            DRE Operacional Comparativa — Presumido (COT) vs Real (OS)
          </motion.p>
        </div>
      </div>

      {/* Tela principal: DRE comparativa tabular */}
      <motion.div
        className="bg-card rounded-xl border border-border shadow-card p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <DateFilterRange
            mode={filterMode}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onModeChange={setFilterMode}
            onRangeChange={handleRangeChange}
          />
          <div className="grid gap-1.5">
            <Label className="text-xs">COT</Label>
            <Input
              placeholder="COT-2026-02-0001"
              value={quoteCode}
              onChange={(e) => setQuoteCode(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">OS</Label>
            <Input
              placeholder="OS-2026-02-0001"
              value={osNumber}
              onChange={(e) => setOsNumber(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Visão</Label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Tipo veículo</Label>
            <select
              value={vehicleTypeId ?? ''}
              onChange={(e) => setVehicleTypeId(e.target.value || null)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[140px]"
            >
              <option value="">Todos</option>
              {(vehicleTypes ?? []).map((vt) => (
                <option key={vt.id} value={vt.id}>
                  {vt.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={exportDreCsv}
            disabled={!dreTables || dreTables.length === 0}
            className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted/50 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">DRE Operacional Comparativa</h2>
          <span
            className="text-xs text-muted-foreground cursor-help"
            title="Recomposição por linhas contábeis. Presumido = COT fechada. Real = OS com custos pagos."
          >
            (i)
          </span>
        </div>

        <DreOperacionalTable tables={dreTables ?? []} isLoading={isLoadingDre} />
      </motion.div>
    </MainLayout>
  );
}
