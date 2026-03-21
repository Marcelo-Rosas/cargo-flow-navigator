import { describe, it, expect } from 'vitest';
import { parseCSVPriceTable, parseKmRange, parseKmStrict } from '../priceTableParser';

// ─── parseKmRange ────────────────────────────────────────────────────────────

describe('parseKmRange', () => {
  it('parses "0-100"', () => {
    expect(parseKmRange('0-100')).toEqual({ from: 0, to: 100 });
  });

  it('parses "101 - 200" with spaces', () => {
    expect(parseKmRange('101 - 200')).toEqual({ from: 101, to: 200 });
  });

  it('parses "1.001-1.100" with Brazilian thousands separator', () => {
    expect(parseKmRange('1.001-1.100')).toEqual({ from: 1001, to: 1100 });
  });

  it('returns null for empty/null', () => {
    expect(parseKmRange(null)).toBeNull();
    expect(parseKmRange(undefined)).toBeNull();
    expect(parseKmRange('')).toBeNull();
  });

  it('returns null for non-range values', () => {
    expect(parseKmRange('abc')).toBeNull();
  });
});

// ─── parseKmStrict ───────────────────────────────────────────────────────────

describe('parseKmStrict', () => {
  it('parses simple integer', () => {
    expect(parseKmStrict('500')).toBe(500);
  });

  it('parses Brazilian thousands format: 1.000 → 1000', () => {
    expect(parseKmStrict('1.000')).toBe(1000);
  });

  it('parses 1.234.567 as 1234567', () => {
    expect(parseKmStrict('1.234.567')).toBe(1234567);
  });

  it('returns null for empty/null', () => {
    expect(parseKmStrict(null)).toBeNull();
    expect(parseKmStrict('')).toBeNull();
  });

  it('parses numeric input', () => {
    expect(parseKmStrict(500)).toBe(500);
  });
});

// ─── parseCSVPriceTable ──────────────────────────────────────────────────────

describe('parseCSVPriceTable', () => {
  it('parses valid CSV with separate km_from/km_to columns', () => {
    const csv = [
      'km_from;km_to;custo_ton',
      '0;100;120,50',
      '101;200;135,00',
      '201;300;150,00',
    ].join('\n');

    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(3);
    expect(result.invalidRows).toBe(0);
    expect(result.errors).toHaveLength(0);

    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
    expect(result.rows[0].cost_per_ton).toBe(120.5);

    expect(result.rows[1].cost_per_ton).toBe(135);
  });

  it('parses km_range column format', () => {
    // faixa maps to km_range; need 3+ columns for semicolon detection
    const csv = ['faixa;custo_ton;gris', '0-100;120;0.3', '101-200;135;0.3'].join('\n');

    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
  });

  it('handles Brazilian number format: 1.234,56 → 1234.56', () => {
    const csv = ['km_from;km_to;custo_ton', '0;100;1.234,56'].join('\n');

    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].cost_per_ton).toBe(1234.56);
  });

  it('returns error for empty file', () => {
    const result = parseCSVPriceTable('');
    expect(result.totalRows).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for file with only header', () => {
    const result = parseCSVPriceTable('km_from;km_to;custo_ton');
    expect(result.totalRows).toBe(0);
  });

  it('returns error when km columns are missing', () => {
    const csv = ['nome;valor', 'A;100'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validates km_to >= km_from', () => {
    const csv = ['km_from;km_to;custo_ton', '200;100;120'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].isValid).toBe(false);
  });

  it('validates percentage fields (0-100)', () => {
    const csv = ['km_from;km_to;gris', '0;100;150'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.invalidRows).toBe(1);
  });

  it('auto-detects comma delimiter', () => {
    const csv = ['km_from,km_to,custo_ton', '0,100,120'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
  });

  it('skips empty rows', () => {
    const csv = ['km_from;km_to;custo_ton', '0;100;120', '', '101;200;135'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(2);
  });

  it('parses LTL weight rate columns', () => {
    const csv = [
      'km_from;km_to;de_1_a_10_k;ate_20;acima_200',
      '0;100;15,00;12,50;3,00',
    ].join('\n');

    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].weight_rate_10).toBe(15);
    expect(result.rows[0].weight_rate_20).toBe(12.5);
    expect(result.rows[0].weight_rate_above_200).toBe(3);
  });
});
