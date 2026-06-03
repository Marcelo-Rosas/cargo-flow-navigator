/**
 * Filtro de período para DRE com botões de trimestre e mês/ano.
 * UX direta: sem digitar datas.
 */

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  getRangeFromMonth,
  getRangeFromQuarter,
  getRangeFromYear,
  getCurrentMonthYear,
  getQuarterFromMonth,
} from '@/lib/dateFilterUtils';
import type { DateFilterRange } from '@/lib/dateFilterUtils';
import type { PeriodType } from '@/modules/dre';

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const QUARTER_LABELS = ['1º Trimestre', '2º Trimestre', '3º Trimestre', '4º Trimestre'];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

export interface DrePeriodFilterValue {
  range: DateFilterRange;
  periodType: PeriodType;
}

interface DrePeriodFilterProps {
  value: DrePeriodFilterValue;
  onChange: (value: DrePeriodFilterValue) => void;
}

type FilterMode = 'month' | 'quarter' | 'year';

export function DrePeriodFilter({ value, onChange }: DrePeriodFilterProps) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const [mode, setMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    getQuarterFromMonth(curMonth)
  );
  const [selectedYear, setSelectedYear] = useState(curYear);

  // Sincroniza com valor externo na montagem (opcional)
  useEffect(() => {
    if (mode === 'month') {
      onChange({
        range: getRangeFromMonth(selectedMonth, selectedYear),
        periodType: 'month',
      });
    } else if (mode === 'quarter') {
      onChange({
        range: getRangeFromQuarter(selectedQuarter, selectedYear),
        periodType: 'quarter',
      });
    } else {
      onChange({
        range: getRangeFromYear(selectedYear),
        periodType: 'year',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModeChange = (newMode: FilterMode) => {
    setMode(newMode);
    if (newMode === 'month') {
      onChange({
        range: getRangeFromMonth(selectedMonth, selectedYear),
        periodType: 'month',
      });
    } else if (newMode === 'quarter') {
      onChange({
        range: getRangeFromQuarter(selectedQuarter, selectedYear),
        periodType: 'quarter',
      });
    } else {
      onChange({
        range: getRangeFromYear(selectedYear),
        periodType: 'year',
      });
    }
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    onChange({
      range: getRangeFromMonth(month, selectedYear),
      periodType: 'month',
    });
  };

  const handleQuarterClick = (q: 1 | 2 | 3 | 4) => {
    setSelectedQuarter(q);
    onChange({
      range: getRangeFromQuarter(q, selectedYear),
      periodType: 'quarter',
    });
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (mode === 'month') {
      onChange({
        range: getRangeFromMonth(selectedMonth, year),
        periodType: 'month',
      });
    } else if (mode === 'quarter') {
      onChange({
        range: getRangeFromQuarter(selectedQuarter, year),
        periodType: 'quarter',
      });
    } else {
      onChange({
        range: getRangeFromYear(year),
        periodType: 'year',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Ano + Modo */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Ano</Label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && handleModeChange(v as FilterMode)}
          className="h-9"
        >
          <ToggleGroupItem value="month" aria-label="Mês" className="text-xs px-3">
            Mês
          </ToggleGroupItem>
          <ToggleGroupItem value="quarter" aria-label="Trimestre" className="text-xs px-3">
            Trimestre
          </ToggleGroupItem>
          <ToggleGroupItem value="year" aria-label="Ano" className="text-xs px-3">
            Ano
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Botões de Mês */}
      {mode === 'month' && (
        <div className="flex flex-wrap gap-1.5">
          {MONTH_LABELS.map((label, idx) => {
            const active = selectedMonth === idx;
            return (
              <Button
                key={label}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-8 px-2.5 min-w-[3rem]"
                onClick={() => handleMonthClick(idx)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Botões de Trimestre */}
      {mode === 'quarter' && (
        <div className="flex flex-wrap gap-2">
          {(QUARTER_LABELS as string[]).map((label, idx) => {
            const q = (idx + 1) as 1 | 2 | 3 | 4;
            const active = selectedQuarter === q;
            return (
              <Button
                key={label}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-8 px-3"
                onClick={() => handleQuarterClick(q)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Modo Ano: só mostra info */}
      {mode === 'year' && (
        <div className="text-sm text-muted-foreground">
          Exibindo DRE consolidada para o ano de <strong>{selectedYear}</strong>.
        </div>
      )}

      {/* Range atual */}
      <div className="text-xs text-muted-foreground">
        Período: {value.range.dateFrom} → {value.range.dateTo}
      </div>
    </div>
  );
}
