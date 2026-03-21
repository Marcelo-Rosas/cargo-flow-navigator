import { describe, it, expect, vi } from 'vitest';
import {
  parseCSVPriceTable,
  parseCSVIcms,
  parseKmRange,
  parseKmStrict,
  parsePriceTableFile,
  parseIcmsFile,
  parseXLSXPriceTable,
} from '../priceTableParser';

function createMockFile(content: string, name: string): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], name, { type: 'text/csv' });
}

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

  it('parses range with em-dash "100–200"', () => {
    expect(parseKmRange('100–200')).toEqual({ from: 100, to: 200 });
  });

  it('parses range with em-dash "100—200"', () => {
    expect(parseKmRange('100—200')).toEqual({ from: 100, to: 200 });
  });

  it('returns null when range parse fails (non-numeric parts)', () => {
    expect(parseKmRange('abc-def')).toBeNull();
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

  it('parses Brazilian format with decimal: "1.234,5" → 1234', () => {
    expect(parseKmStrict('1.234,5')).toBe(1234);
  });

  it('strips non-numeric chars: "km 500" → 500', () => {
    expect(parseKmStrict('km 500')).toBe(500);
  });

  it('fallback float parse: "100.5" → 100', () => {
    expect(parseKmStrict('100.5')).toBe(100);
  });

  it('returns null for completely non-numeric', () => {
    expect(parseKmStrict('abc')).toBeNull();
  });

  it('parses "1.000.000" as 1000000', () => {
    expect(parseKmStrict('1.000.000')).toBe(1000000);
  });

  it('returns null for undefined', () => {
    expect(parseKmStrict(undefined)).toBeNull();
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

  it('parses TSO/ad_valorem column', () => {
    const csv = ['km_from;km_to;tso;gris', '0;100;0,5;0,3'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].tso_percent).toBe(0.5);
    expect(result.rows[0].gris_percent).toBe(0.3);
  });

  it('parses cost_per_kg column', () => {
    const csv = ['km_from;km_to;custo_kg', '0;100;2,50'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].cost_per_kg).toBe(2.5);
  });

  it('parses cost_value_percent column', () => {
    const csv = ['km_from;km_to;custo_valor', '0;100;5,0'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].cost_value_percent).toBe(5);
  });

  it('parses toll_percent column', () => {
    const csv = ['km_from;km_to;pedagio', '0;100;1,5'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].toll_percent).toBe(1.5);
  });

  it('handles rows where km_range parse fails but km_from/km_to exist', () => {
    // faixa column exists but data is bad; fallback to km_from/km_to
    const csv = ['faixa;km_from;km_to;custo_ton', 'invalid;0;100;120'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
  });

  it('skips rows without valid KM data (sub-headers)', () => {
    const csv = ['km_from;km_to;custo_ton', 'Sub-header;text;here', '0;100;120'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(1);
  });

  it('validates negative percentage', () => {
    const csv = ['km_from;km_to;gris', '0;100;-5'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors[0]).toContain('gris_percent');
  });

  it('null values in optional columns', () => {
    const csv = ['km_from;km_to', '0;100'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(1);
    expect(result.rows[0].cost_per_ton).toBeNull();
    expect(result.rows[0].gris_percent).toBeNull();
  });

  it('handles semicolon delimiter detection (more ; than ,)', () => {
    const csv = ['km_from;km_to;custo_ton;gris', '0;100;120;0.3'].join('\n');
    const result = parseCSVPriceTable(csv); // delimiter default ';'
    expect(result.totalRows).toBe(1);
  });

  it('uses explicit delimiter when not default', () => {
    const csv = ['km_from\tkm_to\tcusto_ton', '0\t100\t120'].join('\n');
    const result = parseCSVPriceTable(csv, '\t');
    expect(result.totalRows).toBe(1);
  });

  it('handles \r\n line endings', () => {
    const csv = 'km_from;km_to;custo_ton\r\n0;100;120\r\n101;200;135';
    const result = parseCSVPriceTable(csv);
    expect(result.totalRows).toBe(2);
  });

  it('parses all LTL weight columns (30-200)', () => {
    const csv = [
      'km_from;km_to;ate_30;ate_50;ate_70;ate_100;ate_150;ate_200',
      '0;100;10;8;7;6;5;4',
    ].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].weight_rate_30).toBe(10);
    expect(result.rows[0].weight_rate_50).toBe(8);
    expect(result.rows[0].weight_rate_70).toBe(7);
    expect(result.rows[0].weight_rate_100).toBe(6);
    expect(result.rows[0].weight_rate_150).toBe(5);
    expect(result.rows[0].weight_rate_200).toBe(4);
  });

  it('NaN in cost column becomes null', () => {
    const csv = ['km_from;km_to;custo_ton', '0;100;abc'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].cost_per_ton).toBeNull();
  });

  it('findColumnIndex handles various aliases (preço_ton, valor_frete)', () => {
    const csv = ['km_from;km_to;preço_ton', '0;100;120'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].cost_per_ton).toBe(120);
  });

  it('findColumnIndex handles ad_valorem alias for tso_percent', () => {
    const csv = ['km_from;km_to;ad_valorem', '0;100;0,5'].join('\n');
    const result = parseCSVPriceTable(csv);
    expect(result.rows[0].tso_percent).toBe(0.5);
  });
});

// ─── parseCSVIcms ────────────────────────────────────────────────────────────

describe('parseCSVIcms', () => {
  it('happy path: parses valid ICMS CSV', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;12', 'SP;SC;12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.rows[0].origin_state).toBe('SC');
    expect(result.rows[0].destination_state).toBe('SP');
    expect(result.rows[0].rate_percent).toBe(12);
  });

  it('returns error for empty file', () => {
    const result = parseCSVIcms('');
    expect(result.errors).toContain('Arquivo vazio ou sem dados');
  });

  it('returns error when columns not found', () => {
    const csv = ['nome;valor', 'A;100'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.errors[0]).toContain('Colunas não encontradas');
  });

  it('validates UF origem inválida (lowercase)', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'sc;SP;12'].join('\n');
    const result = parseCSVIcms(csv);
    // toUpperCase é aplicado → 'SC' válido
    expect(result.rows[0].origin_state).toBe('SC');
    expect(result.validRows).toBe(1);
  });

  it('validates UF that does not exist', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'XX;SP;12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors[0]).toContain('não existe');
  });

  it('validates UF destino inválida', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;123;12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors[0]).toContain('UF destino inválida');
  });

  it('validates missing rate', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;'].join('\n');
    const result = parseCSVIcms(csv);
    // normalizeBrazilianNumber('') = null → ?? 0 → rate=0 → valid (0 is special case)
    expect(result.rows[0].rate_percent).toBe(0);
  });

  it('validates rate out of range (> 25)', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;500'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors[0]).toContain('fora do intervalo');
  });

  it('normalizes rate 0.12 → 12', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;0,12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(12);
  });

  it('normalizes rate 0.7 → 7', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;0,7'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(7);
  });

  it('normalizes rate 70 → 7', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;70'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(7);
  });

  it('normalizes rate 120 → 12', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;120'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(12);
  });

  it('rate already in valid range stays unchanged', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;18'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(18);
  });

  it('rate 0 is valid (same state)', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SC;0'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].rate_percent).toBe(0);
  });

  it('normalizes rate 1.2 → 12 (×10)', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;1,2'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(12);
  });

  it('rate too small to normalize → error', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;0,001'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
  });

  it('rate > 250 → fora do intervalo', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;999'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
  });

  it('skips empty rows', () => {
    const csv = ['uf_origem;uf_destino;aliquota', '', 'SC;SP;12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.totalRows).toBe(1);
  });

  it('handles UF empty string', () => {
    const csv = ['uf_origem;uf_destino;aliquota', ';SP;12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errors[0]).toContain('UF origem inválida');
  });

  it('handles alternative column names (origem, destino, icms)', () => {
    const csv = ['origem;destino;icms', 'SC;SP;12'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.validRows).toBe(1);
  });

  it('displays original rate in error when normalized differs', () => {
    // rate 30 → /10 = 3 → valid BUT original was 30
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;30'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.rows[0].rate_percent).toBe(3); // 30/10 = 3
    expect(result.validRows).toBe(1);
  });

  it('negative rate', () => {
    const csv = ['uf_origem;uf_destino;aliquota', 'SC;SP;-5'].join('\n');
    const result = parseCSVIcms(csv);
    expect(result.invalidRows).toBe(1);
  });
});

// ─── parsePriceTableFile ────────────────────────────────────────────────────

describe('parsePriceTableFile', () => {
  it('dispatches CSV file correctly', async () => {
    const csv = 'km_from;km_to;custo_ton\n0;100;120';
    const file = createMockFile(csv, 'table.csv');
    const result = await parsePriceTableFile(file);
    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
  });

  it('returns error for unsupported extension', async () => {
    const file = createMockFile('data', 'table.txt');
    const result = await parsePriceTableFile(file);
    expect(result.errors[0]).toContain('Formato não suportado');
  });

  it('dispatches XLSX file', async () => {
    // XLSX parsing will fail because content is not real XLSX,
    // but the dispatch path is exercised
    const file = createMockFile('not-xlsx', 'table.xlsx');
    const result = await parsePriceTableFile(file);
    // Should get an error from exceljs trying to parse invalid content
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('dispatches XLSM file', async () => {
    const file = createMockFile('not-xlsm', 'table.xlsm');
    const result = await parsePriceTableFile(file);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── parseIcmsFile ──────────────────────────────────────────────────────────

describe('parseIcmsFile', () => {
  it('reads file content and parses ICMS CSV', async () => {
    const csv = 'uf_origem;uf_destino;aliquota\nSC;SP;12';
    const file = createMockFile(csv, 'icms.csv');
    const result = await parseIcmsFile(file);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].origin_state).toBe('SC');
  });
});

// ─── parseXLSXPriceTable ────────────────────────────────────────────────────

// We mock exceljs to test the XLSX parsing logic without real Excel files
function createMockWorksheet(rows: string[][]): {
  rowCount: number;
  getRow: (idx: number) => {
    cellCount: number;
    actualCellCount: number;
    getCell: (col: number) => { text: string };
  };
} {
  return {
    rowCount: rows.length,
    getRow(idx: number) {
      const row = rows[idx - 1] ?? [];
      return {
        cellCount: row.length,
        actualCellCount: row.length,
        getCell(col: number) {
          return { text: row[col - 1] ?? '' };
        },
      };
    },
  };
}

describe('parseXLSXPriceTable', () => {
  it('returns error for invalid XLSX content (catch block)', async () => {
    const file = createMockFile('not-valid-xlsx', 'test.xlsx');
    const result = await parseXLSXPriceTable(file);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Erro ao processar arquivo');
  });

  it('parses valid XLSX with km_from/km_to columns', async () => {
    const worksheetData = [
      ['km_from', 'km_to', 'custo_ton'],
      ['0', '100', '120,50'],
      ['101', '200', '135'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    // Mock exceljs module
    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    // Re-import to get the mocked version
    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(2);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
    expect(result.rows[0].cost_per_ton).toBe(120.5);

    vi.doUnmock('exceljs');
  });

  it('returns error for empty worksheet', async () => {
    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets: unknown[] = [];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.errors[0]).toContain('Planilha vazia');
    vi.doUnmock('exceljs');
  });

  it('returns error when worksheet has only 1 row', async () => {
    const mockWorksheet = createMockWorksheet([['km_from', 'km_to']]);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.errors[0]).toContain('Planilha vazia ou sem dados');
    vi.doUnmock('exceljs');
  });

  it('handles legacy 2-row headers (DE/ATE subheader)', async () => {
    const worksheetData = [
      ['faixa', 'custo_ton'],
      ['de', 'valor'],  // sub-header row → should be skipped
      ['0-100', '120'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
    vi.doUnmock('exceljs');
  });

  it('returns error when km columns not found in XLSX', async () => {
    const worksheetData = [
      ['nome', 'valor'],
      ['A', '100'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.errors[0]).toContain('Colunas de KM não encontradas');
    vi.doUnmock('exceljs');
  });

  it('skips blank leading rows in XLSX', async () => {
    const worksheetData = [
      ['', ''],           // blank row
      ['km_from', 'km_to', 'custo_ton'],
      ['0', '100', '120'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
    vi.doUnmock('exceljs');
  });

  it('skips empty data rows in XLSX', async () => {
    const worksheetData = [
      ['km_from', 'km_to', 'custo_ton'],
      ['', '', ''],  // empty row → skipped
      ['0', '100', '120'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(1);
    vi.doUnmock('exceljs');
  });

  it('parses XLSX with km_range column and all LTL weight columns', async () => {
    const worksheetData = [
      ['faixa', 'custo_ton', 'ate_10', 'ate_20', 'ate_30', 'ate_50', 'ate_70', 'ate_100', 'ate_150', 'ate_200', 'acima_200', 'custo_kg', 'custo_valor', 'gris', 'tso', 'pedagio'],
      ['0-100', '120', '15', '12', '10', '8', '7', '6', '5', '4', '3', '2,5', '5', '0,3', '0,5', '1,5'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
    expect(result.rows[0].km_to).toBe(100);
    expect(result.rows[0].weight_rate_10).toBe(15);
    expect(result.rows[0].weight_rate_above_200).toBe(3);
    expect(result.rows[0].cost_per_kg).toBe(2.5);
    expect(result.rows[0].tso_percent).toBe(0.5);
    vi.doUnmock('exceljs');
  });

  it('XLSX validation: km_to < km_from', async () => {
    const worksheetData = [
      ['km_from', 'km_to', 'custo_ton'],
      ['200', '100', '120'],  // invalid
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.invalidRows).toBe(1);
    vi.doUnmock('exceljs');
  });

  it('XLSX skips rows without valid km data', async () => {
    const worksheetData = [
      ['km_from', 'km_to', 'custo_ton'],
      ['invalid', 'text', '120'],  // no valid km
      ['0', '100', '120'],
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(1);
    vi.doUnmock('exceljs');
  });

  it('XLSX with km_range fallback to km_from/km_to', async () => {
    const worksheetData = [
      ['faixa', 'km_from', 'km_to', 'custo_ton'],
      ['invalid', '0', '100', '120'],  // faixa fails → uses km_from/km_to
    ];
    const mockWorksheet = createMockWorksheet(worksheetData);

    vi.doMock('exceljs', () => ({
      Workbook: class {
        worksheets = [mockWorksheet];
        xlsx = {
          load: vi.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const { parseXLSXPriceTable: parseMocked } = await import('../priceTableParser');
    const file = createMockFile('fake', 'test.xlsx');
    const result = await parseMocked(file);

    expect(result.totalRows).toBe(1);
    expect(result.rows[0].km_from).toBe(0);
    vi.doUnmock('exceljs');
  });
});
