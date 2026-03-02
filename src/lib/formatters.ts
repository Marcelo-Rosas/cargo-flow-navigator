// src/lib/formatters.ts

/**
 * Formata um número para a moeda Real (BRL).
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata uma string de data para o padrão brasileiro.
 * O padrão é dd/mmm/aaaa (ex: 01 de mar de 2026), mas pode ser sobrescrito.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(new Date(dateStr));
}
