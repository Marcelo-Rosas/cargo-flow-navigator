import type { MontagemSection } from './types.ts';

export const LOGO_URL = 'https://app.vectracargo.com.br/brand/logo_vectra.jpg';

export const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const sumSection = (s: MontagemSection) =>
  s.rows.reduce((acc, r) => acc + r.qty * r.unit, 0);

export const sumQty = (s: MontagemSection) => s.rows.reduce((acc, r) => acc + r.qty, 0);

export const buildSummaryFromSections = (
  sections: MontagemSection[],
  lines: { label: string; sectionIndex: number; qtyOverride?: number }[]
) =>
  lines.map(({ label, sectionIndex, qtyOverride }) => ({
    label,
    qty: qtyOverride ?? sumQty(sections[sectionIndex]),
    total: sumSection(sections[sectionIndex]),
  }));
