// Utilitários para filtro de datas: dia / mês / trimestre / ano

export type DateFilterMode = 'day' | 'month' | 'quarter' | 'year';

export interface DateFilterRange {
  dateFrom: string; // dd/mm/yyyy
  dateTo: string; // dd/mm/yyyy
}

export function formatDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function parseDdMmYyyy(s: string | null): Date | null {
  if (!s || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim())) return null;
  const [day, month, year] = s.trim().split('/').map(Number);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function getRangeFromMonth(month: number, year: number): DateFilterRange {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { dateFrom: formatDdMmYyyy(first), dateTo: formatDdMmYyyy(last) };
}

export function getRangeFromQuarter(q: 1 | 2 | 3 | 4, year: number): DateFilterRange {
  const startMonth = (q - 1) * 3;
  const first = new Date(year, startMonth, 1);
  const last = new Date(year, startMonth + 3, 0);
  return { dateFrom: formatDdMmYyyy(first), dateTo: formatDdMmYyyy(last) };
}

export function getRangeFromYear(year: number): DateFilterRange {
  return {
    dateFrom: formatDdMmYyyy(new Date(year, 0, 1)),
    dateTo: formatDdMmYyyy(new Date(year, 11, 31)),
  };
}

/** Retorna o quarter (1-4) de um mês (0-11) */
export function getQuarterFromMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
}

/** Mês e ano atuais */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}
