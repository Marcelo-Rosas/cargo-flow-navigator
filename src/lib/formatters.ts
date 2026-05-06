// src/lib/formatters.ts

/**
 * Formata um número para a moeda Real (BRL).
 * IMPORTANTE: Sempre exibe 2 casas decimais conforme padrão do projeto.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata um valor em centavos para a moeda Real (BRL).
 * Exemplo: 150050 → "R$ 1.500,50"
 */
export function formatCurrencyFromCents(centavos: number | null | undefined): string {
  if (centavos == null) return '—';
  return formatCurrency(centavos / 100);
}

/**
 * Formata um valor BRL de quote (decimal, não centavos).
 * Exemplo: 1500.50 → "R$ 1.500,50"
 */
export function formatQuoteValue(value: number | null | undefined): string {
  return formatCurrency(value);
}

/**
 * Formata um número para número com 2 casas decimais (sem moeda).
 * Exemplo: 1500.5 → "1.500,50"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

/**
 * Formata string de dígitos para CPF (000.000.000-00)
 */
export function formatCpfDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length !== 11) return value;
  // Format using the mask pattern: 000.000.000-00
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/**
 * Formata string de dígitos para CNPJ (00.000.000/0000-00)
 */
export function formatCnpjDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const d = value.replace(/\D/g, '').slice(0, 14);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/**
 * Formata string de dígitos para telefone brasileiro.
 * 11 dígitos -> (XX) XXXXX-XXXX (celular)
 * 10 dígitos -> (XX) XXXX-XXXX (fixo)
 * Outros tamanhos -> retorna como está.
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const d = value.replace(/\D/g, '');
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  return value;
}
