import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type DateFilterMode,
  type DateFilterRange as DateFilterRangeType,
  getCurrentMonthYear,
  getQuarterFromMonth,
  getRangeFromMonth,
  getRangeFromQuarter,
  getRangeFromYear,
} from '@/lib/dateFilterUtils';

const MODE_OPTIONS: { value: DateFilterMode; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'month', label: 'Mês' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
];

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const QUARTER_LABELS = ['Q1 (Jan–Mar)', 'Q2 (Abr–Jun)', 'Q3 (Jul–Set)', 'Q4 (Out–Dez)'];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

interface DateFilterRangeProps {
  mode: DateFilterMode;
  dateFrom: string;
  dateTo: string;
  onModeChange: (mode: DateFilterMode) => void;
  onRangeChange: (range: DateFilterRangeType) => void;
}

export function DateFilterRange({
  mode,
  dateFrom,
  dateTo,
  onModeChange,
  onRangeChange,
}: DateFilterRangeProps) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    getQuarterFromMonth(curMonth)
  );
  const [selectedYear, setSelectedYear] = useState(curYear);

  // Ao trocar de modo, preencher com defaults inteligentes
  useEffect(() => {
    if (mode === 'month') {
      onRangeChange(getRangeFromMonth(selectedMonth, selectedYear));
    } else if (mode === 'quarter') {
      onRangeChange(getRangeFromQuarter(selectedQuarter, selectedYear));
    } else if (mode === 'year') {
      onRangeChange(getRangeFromYear(selectedYear));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    onRangeChange(getRangeFromMonth(month, selectedYear));
  };

  const handleQuarterChange = (q: 1 | 2 | 3 | 4) => {
    setSelectedQuarter(q);
    onRangeChange(getRangeFromQuarter(q, selectedYear));
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (mode === 'month') onRangeChange(getRangeFromMonth(selectedMonth, year));
    else if (mode === 'quarter') onRangeChange(getRangeFromQuarter(selectedQuarter, year));
    else if (mode === 'year') onRangeChange(getRangeFromYear(year));
  };

  const selectClass =
    'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Tipo de período */}
      <div className="grid gap-1.5">
        <Label className="text-xs">Período</Label>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as DateFilterMode)}
          className={selectClass}
        >
          {MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Modo Dia: inputs manuais */}
      {mode === 'day' && (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs">De</Label>
            <Input
              placeholder="dd/mm/aaaa"
              value={dateFrom}
              onChange={(e) => onRangeChange({ dateFrom: e.target.value, dateTo })}
              className="w-32"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Até</Label>
            <Input
              placeholder="dd/mm/aaaa"
              value={dateTo}
              onChange={(e) => onRangeChange({ dateFrom, dateTo: e.target.value })}
              className="w-32"
            />
          </div>
        </>
      )}

      {/* Modo Mês: select mês + ano */}
      {mode === 'month' && (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs">Mês</Label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className={selectClass}
            >
              {MONTH_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Ano</Label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className={selectClass}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Modo Trimestre: select Q1-Q4 + ano */}
      {mode === 'quarter' && (
        <>
          <div className="grid gap-1.5">
            <Label className="text-xs">Trimestre</Label>
            <select
              value={selectedQuarter}
              onChange={(e) => handleQuarterChange(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className={selectClass}
            >
              {QUARTER_LABELS.map((label, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Ano</Label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className={selectClass}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Modo Ano: select ano */}
      {mode === 'year' && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Ano</Label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className={selectClass}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
