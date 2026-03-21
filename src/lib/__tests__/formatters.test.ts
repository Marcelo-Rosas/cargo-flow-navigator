import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyFromCents,
  formatQuoteValue,
  formatNumber,
  formatCpfDisplay,
} from '../formatters';

describe('formatCurrency', () => {
  it('formats positive values with R$ and 2 decimals', () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain('1.500,50');
    expect(result).toContain('R$');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0,00');
    expect(result).toContain('R$');
  });

  it('formats negative values', () => {
    const result = formatCurrency(-250.1);
    expect(result).toContain('250,10');
  });

  it('returns em dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('always shows 2 decimal places', () => {
    const result = formatCurrency(100);
    expect(result).toContain('100,00');
  });
});

describe('formatCurrencyFromCents', () => {
  it('converts centavos to BRL: 150000 → R$ 1.500,00', () => {
    const result = formatCurrencyFromCents(150000);
    expect(result).toContain('1.500,00');
  });

  it('converts 150050 → R$ 1.500,50', () => {
    const result = formatCurrencyFromCents(150050);
    expect(result).toContain('1.500,50');
  });

  it('returns em dash for null', () => {
    expect(formatCurrencyFromCents(null)).toBe('—');
  });

  it('handles zero centavos', () => {
    const result = formatCurrencyFromCents(0);
    expect(result).toContain('0,00');
  });
});

describe('formatQuoteValue', () => {
  it('delegates to formatCurrency', () => {
    expect(formatQuoteValue(1500.5)).toBe(formatCurrency(1500.5));
    expect(formatQuoteValue(null)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('formats without currency symbol', () => {
    const result = formatNumber(1500.5);
    expect(result).toBe('1.500,50');
    expect(result).not.toContain('R$');
  });

  it('returns em dash for null/undefined', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });

  it('always shows 2 decimal places', () => {
    expect(formatNumber(100)).toBe('100,00');
  });
});

describe('formatCpfDisplay', () => {
  it('formats 11 digits as CPF mask', () => {
    expect(formatCpfDisplay('52998224725')).toBe('529.982.247-25');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatCpfDisplay(null)).toBe('');
    expect(formatCpfDisplay(undefined)).toBe('');
  });

  it('returns raw value if not 11 digits', () => {
    expect(formatCpfDisplay('123')).toBe('123');
  });

  it('strips non-digit chars before formatting', () => {
    expect(formatCpfDisplay('529.982.247-25')).toBe('529.982.247-25');
  });
});
