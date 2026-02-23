export interface ParsedPriceRow {
  km_from: number;
  km_to: number;
  cost_per_ton?: number | null;
  cost_per_kg?: number | null;
  cost_value_percent?: number | null;
  gris_percent?: number | null;
  tso_percent?: number | null; // TSO (Seguro Obrigatório) - novo nome para ad_valorem
  toll_percent?: number | null;
  // LTL (Fracionado) weight range columns
  weight_rate_10?: number | null;
  weight_rate_20?: number | null;
  weight_rate_30?: number | null;
  weight_rate_50?: number | null;
  weight_rate_70?: number | null;
  weight_rate_100?: number | null;
  weight_rate_150?: number | null;
  weight_rate_200?: number | null;
  weight_rate_above_200?: number | null;
  isValid: boolean;
  errors: string[];
}

export interface ParsedIcmsRow {
  origin_state: string;
  destination_state: string;
  rate_percent: number;
  isValid: boolean;
  errors: string[];
}

export interface ParseResult<T> {
  rows: T[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
}

// Brazilian number normalization: "1.234,56" -> 1234.56
function normalizeBrazilianNumber(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  let str = String(value).trim();

  // Remove currency symbols and spaces
  str = str.replace(/[R$\s]/g, '');

  // Check if it's Brazilian format (uses . as thousands separator and , as decimal)
  // Pattern: 1.234,56 or 1.234
  const hasBrazilianFormat = /^\d{1,3}(\.\d{3})*(,\d+)?$/.test(str);

  if (hasBrazilianFormat) {
    // Remove thousand separators (dots) and convert decimal comma to dot
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // Assume it might be simple format with comma as decimal
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Parse KM range from text like "0-100", "101 - 200", "1.001-1.100"
export function parseKmRange(
  value: string | number | undefined | null
): { from: number; to: number } | null {
  if (value === null || value === undefined || value === '') return null;

  const str = String(value).trim();

  // Try to match patterns like "0-100", "101 - 200", "1.001-1.100"
  const rangeMatch = str.match(/^(\d[\d.,]*)\s*[-–—]\s*(\d[\d.,]*)$/);
  if (rangeMatch) {
    const from = normalizeBrazilianNumber(rangeMatch[1]);
    const to = normalizeBrazilianNumber(rangeMatch[2]);
    if (from !== null && to !== null) {
      return { from: Math.floor(from), to: Math.floor(to) };
    }
  }

  return null;
}

// Parse single KM value, handling Brazilian number format
export function parseKmStrict(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === '') return null;

  const str = String(value).trim();

  // Remove any non-numeric characters except . and ,
  const cleaned = str.replace(/[^\d.,]/g, '');

  // Brazilian format: 1.000 means 1000, not 1.0
  // Check if it matches Brazilian thousands pattern (no decimal part or ,XX decimal)
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Pure thousands format like 1.000 or 1.000.000
    return parseInt(cleaned.replace(/\./g, ''), 10);
  }

  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    // Brazilian format with optional decimal
    return Math.floor(parseFloat(cleaned.replace(/\./g, '').replace(',', '.')));
  }

  // Simple integer
  if (/^\d+$/.test(cleaned)) {
    return parseInt(cleaned, 10);
  }

  // Fallback: try to parse as float and floor
  const num = parseFloat(cleaned.replace(',', '.'));
  return isNaN(num) ? null : Math.floor(num);
}

// Column name mappings for flexibility
const COLUMN_MAPPINGS: Record<string, string[]> = {
  km_from: ['km_from', 'km_de', 'de_km', 'faixa_de', 'km_inicio', 'km inicio', 'de'],
  km_to: ['km_to', 'km_ate', 'ate_km', 'faixa_ate', 'km_fim', 'km fim', 'ate'],
  km_range: ['km', 'faixa', 'faixa_km', 'range', 'distancia'],
  cost_per_ton: [
    'cost_per_ton',
    'custo_ton',
    'custo_tonelada',
    'custo_peso',
    'r$/ton',
    'valor_ton',
    'ton',
    'r$/t',
    'preco_ton',
    'preço_ton',
    'valor_frete',
    'frete_ton',
    'custo_frete',
    'valor',
    'preco',
    'preço',
  ],
  cost_per_kg: [
    'cost_per_kg',
    'custo_kg',
    'r$/kg',
    'valor_kg',
    'kg',
    'preco_kg',
    'preço_kg',
    'frete_kg',
  ],
  cost_value_percent: ['cost_value_percent', 'custo_valor', 'percent_valor', 'valor%', '%valor', 'valor_percent'],
  gris_percent: ['gris_percent', 'gris', 'gris%', '%gris'],
  // TSO aceita ambos: tso_percent (novo) e ad_valorem_percent (legado)
  tso_percent: [
    'tso_percent',
    'tso',
    'tso%',
    '%tso',
    'ad_valorem_percent',
    'ad_valorem',
    'advalorem',
    'ad valorem',
    '%ad_valorem',
  ],
  toll_percent: ['toll_percent', 'pedagio', 'pedagio%', 'toll', '%pedagio'],
  // LTL (Fracionado) weight range columns
  weight_rate_10: ['weight_rate_10', '10', 'de_1_a_10', '1_a_10_kg', 'ate_10kg', 'ate_10'],
  weight_rate_20: ['weight_rate_20', '20', 'de_11_a_20', '11_a_20_kg', 'ate_20kg', 'ate_20'],
  weight_rate_30: ['weight_rate_30', '30', 'de_21_a_30', '21_a_30_kg', 'ate_30kg', 'ate_30'],
  weight_rate_50: ['weight_rate_50', '50', 'de_31_a_50', '31_a_50_kg', 'ate_50kg', 'ate_50'],
  weight_rate_70: ['weight_rate_70', '70', 'de_51_a_70', '51_a_70_kg', 'ate_70kg', 'ate_70'],
  weight_rate_100: ['weight_rate_100', '100', 'de_71_a_100', '71_a_100_kg', 'ate_100kg', 'ate_100'],
  weight_rate_150: ['weight_rate_150', '150', 'de_101_a_150', '101_a_150_kg', 'ate_150kg', 'ate_150'],
  weight_rate_200: ['weight_rate_200', '200', 'de_151_a_200', '151_a_200_kg', 'ate_200kg', 'ate_200'],
  weight_rate_above_200: ['weight_rate_above_200', 'acima_200', 'acima_de_200', 'acima_200_kg', 'r$/kg', 'r$porkg'],
};

function findColumnIndex(headers: string[], fieldName: string): number {
  const possibleNames = COLUMN_MAPPINGS[fieldName] || [fieldName];
  const normalizedHeaders = headers.map(
    (h) =>
      h
        ?.toString()
        .toLowerCase()
        .trim()
        .replace(/[_\s]+/g, '_') || ''
  );

  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[_\s]+/g, '_');
    const index = normalizedHeaders.findIndex(
      (h) => h === normalizedName || h.includes(normalizedName)
    );
    if (index !== -1) return index;
  }

  return -1;
}

function validatePriceRow(
  row: Partial<ParsedPriceRow>,
  index: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (row.km_from === undefined || row.km_from === null) {
    errors.push(`Linha ${index + 1}: km_from é obrigatório`);
  }
  if (row.km_to === undefined || row.km_to === null) {
    errors.push(`Linha ${index + 1}: km_to é obrigatório`);
  }
  if (row.km_from !== undefined && row.km_to !== undefined && row.km_to < row.km_from) {
    errors.push(`Linha ${index + 1}: km_to deve ser >= km_from`);
  }

  // Validate percentages (0-100)
  const percentFields: (keyof ParsedPriceRow)[] = [
    'cost_value_percent',
    'gris_percent',
    'tso_percent',
    'toll_percent',
  ];
  for (const field of percentFields) {
    const value = row[field] as number | null | undefined;
    if (value !== null && value !== undefined && (value < 0 || value > 100)) {
      errors.push(`Linha ${index + 1}: ${field} deve estar entre 0 e 100`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function parseCSVPriceTable(
  content: string,
  delimiter: string = ';'
): ParseResult<ParsedPriceRow> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const errors: string[] = [];
  const rows: ParsedPriceRow[] = [];

  if (lines.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: ['Arquivo vazio ou sem dados'],
    };
  }

  // Detect headers (first non-empty line)
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  // Find column indices
  const kmFromIdx = findColumnIndex(headers, 'km_from');
  const kmToIdx = findColumnIndex(headers, 'km_to');
  const kmRangeIdx = findColumnIndex(headers, 'km_range');
  const costPerTonIdx = findColumnIndex(headers, 'cost_per_ton');
  const costPerKgIdx = findColumnIndex(headers, 'cost_per_kg');
  const costValuePercentIdx = findColumnIndex(headers, 'cost_value_percent');
  const grisIdx = findColumnIndex(headers, 'gris_percent');
  const tsoIdx = findColumnIndex(headers, 'tso_percent'); // Também encontra ad_valorem_percent por alias
  const tollIdx = findColumnIndex(headers, 'toll_percent');

  // LTL weight range columns
  const wr10Idx = findColumnIndex(headers, 'weight_rate_10');
  const wr20Idx = findColumnIndex(headers, 'weight_rate_20');
  const wr30Idx = findColumnIndex(headers, 'weight_rate_30');
  const wr50Idx = findColumnIndex(headers, 'weight_rate_50');
  const wr70Idx = findColumnIndex(headers, 'weight_rate_70');
  const wr100Idx = findColumnIndex(headers, 'weight_rate_100');
  const wr150Idx = findColumnIndex(headers, 'weight_rate_150');
  const wr200Idx = findColumnIndex(headers, 'weight_rate_200');
  const wrAbove200Idx = findColumnIndex(headers, 'weight_rate_above_200');

  const hasKmRange = kmRangeIdx !== -1;
  const hasKmSeparate = kmFromIdx !== -1 && kmToIdx !== -1;

  if (!hasKmRange && !hasKmSeparate) {
    errors.push('Colunas de KM não encontradas. Esperado: km_from/km_to ou faixa');
    return { rows: [], totalRows: 0, validRows: 0, invalidRows: 0, errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());

    // Skip empty or header-like rows
    if (values.every((v) => !v || v === '')) continue;

    let km_from: number | null = null;
    let km_to: number | null = null;

    if (hasKmRange) {
      const range = parseKmRange(values[kmRangeIdx]);
      if (range) {
        km_from = range.from;
        km_to = range.to;
      }
    }

    if (km_from === null && hasKmSeparate) {
      km_from = parseKmStrict(values[kmFromIdx]);
      km_to = parseKmStrict(values[kmToIdx]);
    }

    // Skip rows that don't have valid KM data (likely sub-headers)
    if (km_from === null || km_to === null) {
      continue;
    }

    const row: Partial<ParsedPriceRow> = {
      km_from,
      km_to,
      cost_per_ton: costPerTonIdx !== -1 ? normalizeBrazilianNumber(values[costPerTonIdx]) : null,
      cost_per_kg: costPerKgIdx !== -1 ? normalizeBrazilianNumber(values[costPerKgIdx]) : null,
      cost_value_percent:
        costValuePercentIdx !== -1 ? normalizeBrazilianNumber(values[costValuePercentIdx]) : null,
      gris_percent: grisIdx !== -1 ? normalizeBrazilianNumber(values[grisIdx]) : null,
      tso_percent: tsoIdx !== -1 ? normalizeBrazilianNumber(values[tsoIdx]) : null,
      toll_percent: tollIdx !== -1 ? normalizeBrazilianNumber(values[tollIdx]) : null,
      // LTL weight rates
      weight_rate_10: wr10Idx !== -1 ? normalizeBrazilianNumber(values[wr10Idx]) : null,
      weight_rate_20: wr20Idx !== -1 ? normalizeBrazilianNumber(values[wr20Idx]) : null,
      weight_rate_30: wr30Idx !== -1 ? normalizeBrazilianNumber(values[wr30Idx]) : null,
      weight_rate_50: wr50Idx !== -1 ? normalizeBrazilianNumber(values[wr50Idx]) : null,
      weight_rate_70: wr70Idx !== -1 ? normalizeBrazilianNumber(values[wr70Idx]) : null,
      weight_rate_100: wr100Idx !== -1 ? normalizeBrazilianNumber(values[wr100Idx]) : null,
      weight_rate_150: wr150Idx !== -1 ? normalizeBrazilianNumber(values[wr150Idx]) : null,
      weight_rate_200: wr200Idx !== -1 ? normalizeBrazilianNumber(values[wr200Idx]) : null,
      weight_rate_above_200: wrAbove200Idx !== -1 ? normalizeBrazilianNumber(values[wrAbove200Idx]) : null,
    };

    const validation = validatePriceRow(row, rows.length);
    rows.push({
      ...row,
      isValid: validation.isValid,
      errors: validation.errors,
    } as ParsedPriceRow);

    errors.push(...validation.errors);
  }

  return {
    rows,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.isValid).length,
    invalidRows: rows.filter((r) => !r.isValid).length,
    errors,
  };
}

function worksheetToRows(worksheet: {
  rowCount: number;
  getRow: (rowIdx: number) => {
    cellCount: number;
    actualCellCount: number;
    getCell: (colIdx: number) => { text?: string };
  };
}): string[][] {
  const rows: string[][] = [];

  for (let rowIdx = 1; rowIdx <= worksheet.rowCount; rowIdx++) {
    const row = worksheet.getRow(rowIdx);
    const maxCol = Math.max(row.cellCount, row.actualCellCount);
    const values: string[] = [];

    for (let colIdx = 1; colIdx <= maxCol; colIdx++) {
      const text = row.getCell(colIdx).text;
      values.push(String(text ?? '').trim());
    }

    rows.push(values);
  }

  return rows;
}

export async function parseXLSXPriceTable(file: File): Promise<ParseResult<ParsedPriceRow>> {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    // Get first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        rows: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: ['Planilha vazia ou sem abas'],
      };
    }

    const rawRows = worksheetToRows(worksheet);
    if (rawRows.length < 2) {
      return {
        rows: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: ['Planilha vazia ou sem dados'],
      };
    }

    // Detect header row (skip any blank rows at top)
    let headerRowIdx = 0;
    while (
      headerRowIdx < rawRows.length &&
      rawRows[headerRowIdx].every((cell) => !cell || cell === '')
    ) {
      headerRowIdx++;
    }

    // Check for legacy format (2 header rows)
    const possibleHeaders = rawRows[headerRowIdx];
    const nextRow = rawRows[headerRowIdx + 1];

    // If the row after headers also looks like headers (contains text like "DE" or "ATE"), skip it
    let dataStartIdx = headerRowIdx + 1;
    if (
      nextRow &&
      nextRow.some((cell) => {
        const lower = String(cell).toLowerCase().trim();
        return (
          lower === 'de' || lower === 'ate' || lower === 'até' || lower === 'from' || lower === 'to'
        );
      })
    ) {
      dataStartIdx = headerRowIdx + 2;
    }

    const headers = possibleHeaders.map((h) => String(h || '').trim());

    // Find column indices
    const kmFromIdx = findColumnIndex(headers, 'km_from');
    const kmToIdx = findColumnIndex(headers, 'km_to');
    const kmRangeIdx = findColumnIndex(headers, 'km_range');
    const costPerTonIdx = findColumnIndex(headers, 'cost_per_ton');
    const costPerKgIdx = findColumnIndex(headers, 'cost_per_kg');
    const costValuePercentIdx = findColumnIndex(headers, 'cost_value_percent');
    const grisIdx = findColumnIndex(headers, 'gris_percent');
    const tsoIdx = findColumnIndex(headers, 'tso_percent'); // Também encontra ad_valorem_percent por alias
    const tollIdx = findColumnIndex(headers, 'toll_percent');

    // LTL weight range columns
    const wr10Idx = findColumnIndex(headers, 'weight_rate_10');
    const wr20Idx = findColumnIndex(headers, 'weight_rate_20');
    const wr30Idx = findColumnIndex(headers, 'weight_rate_30');
    const wr50Idx = findColumnIndex(headers, 'weight_rate_50');
    const wr70Idx = findColumnIndex(headers, 'weight_rate_70');
    const wr100Idx = findColumnIndex(headers, 'weight_rate_100');
    const wr150Idx = findColumnIndex(headers, 'weight_rate_150');
    const wr200Idx = findColumnIndex(headers, 'weight_rate_200');
    const wrAbove200Idx = findColumnIndex(headers, 'weight_rate_above_200');

    const hasKmRange = kmRangeIdx !== -1;
    const hasKmSeparate = kmFromIdx !== -1 && kmToIdx !== -1;

    if (!hasKmRange && !hasKmSeparate) {
      return {
        rows: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: ['Colunas de KM não encontradas. Esperado: km_from/km_to ou faixa'],
      };
    }

    const rows: ParsedPriceRow[] = [];
    const errors: string[] = [];

    for (let i = dataStartIdx; i < rawRows.length; i++) {
      const values = rawRows[i];

      // Skip empty rows
      if (!values || values.every((v) => !v || v === '')) continue;

      let km_from: number | null = null;
      let km_to: number | null = null;

      if (hasKmRange) {
        const range = parseKmRange(values[kmRangeIdx]);
        if (range) {
          km_from = range.from;
          km_to = range.to;
        }
      }

      if (km_from === null && hasKmSeparate) {
        km_from = parseKmStrict(values[kmFromIdx]);
        km_to = parseKmStrict(values[kmToIdx]);
      }

      // Skip rows without valid KM data
      if (km_from === null || km_to === null) continue;

      const row: Partial<ParsedPriceRow> = {
        km_from,
        km_to,
        cost_per_ton: costPerTonIdx !== -1 ? normalizeBrazilianNumber(values[costPerTonIdx]) : null,
        cost_per_kg: costPerKgIdx !== -1 ? normalizeBrazilianNumber(values[costPerKgIdx]) : null,
        cost_value_percent:
          costValuePercentIdx !== -1 ? normalizeBrazilianNumber(values[costValuePercentIdx]) : null,
        gris_percent: grisIdx !== -1 ? normalizeBrazilianNumber(values[grisIdx]) : null,
        tso_percent: tsoIdx !== -1 ? normalizeBrazilianNumber(values[tsoIdx]) : null,
        toll_percent: tollIdx !== -1 ? normalizeBrazilianNumber(values[tollIdx]) : null,
        // LTL weight rates
        weight_rate_10: wr10Idx !== -1 ? normalizeBrazilianNumber(values[wr10Idx]) : null,
        weight_rate_20: wr20Idx !== -1 ? normalizeBrazilianNumber(values[wr20Idx]) : null,
        weight_rate_30: wr30Idx !== -1 ? normalizeBrazilianNumber(values[wr30Idx]) : null,
        weight_rate_50: wr50Idx !== -1 ? normalizeBrazilianNumber(values[wr50Idx]) : null,
        weight_rate_70: wr70Idx !== -1 ? normalizeBrazilianNumber(values[wr70Idx]) : null,
        weight_rate_100: wr100Idx !== -1 ? normalizeBrazilianNumber(values[wr100Idx]) : null,
        weight_rate_150: wr150Idx !== -1 ? normalizeBrazilianNumber(values[wr150Idx]) : null,
        weight_rate_200: wr200Idx !== -1 ? normalizeBrazilianNumber(values[wr200Idx]) : null,
        weight_rate_above_200: wrAbove200Idx !== -1 ? normalizeBrazilianNumber(values[wrAbove200Idx]) : null,
      };

      const validation = validatePriceRow(row, rows.length);
      rows.push({
        ...row,
        isValid: validation.isValid,
        errors: validation.errors,
      } as ParsedPriceRow);

      errors.push(...validation.errors);
    }

    return {
      rows,
      totalRows: rows.length,
      validRows: rows.filter((r) => r.isValid).length,
      invalidRows: rows.filter((r) => !r.isValid).length,
      errors,
    };
  } catch (err) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: [
        `Erro ao processar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
      ],
    };
  }
}

export async function parsePriceTableFile(file: File): Promise<ParseResult<ParsedPriceRow>> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const content = await file.text();
    return parseCSVPriceTable(content);
  }

  if (extension === 'xlsx' || extension === 'xlsm') {
    return parseXLSXPriceTable(file);
  }

  return {
    rows: [],
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: [`Formato não suportado: ${extension}. Use CSV, XLSX ou XLSM.`],
  };
}

// ICMS Parser
const ICMS_COLUMN_MAPPINGS: Record<string, string[]> = {
  origin_state: ['origin_state', 'uf_origem', 'origem', 'estado_origem', 'uf_de', 'de'],
  destination_state: [
    'destination_state',
    'uf_destino',
    'destino',
    'estado_destino',
    'uf_para',
    'para',
  ],
  rate_percent: ['rate_percent', 'aliquota', 'percent', 'icms', 'taxa', '%'],
};

function findIcmsColumnIndex(headers: string[], fieldName: string): number {
  const possibleNames = ICMS_COLUMN_MAPPINGS[fieldName] || [fieldName];
  const normalizedHeaders = headers.map(
    (h) =>
      h
        ?.toString()
        .toLowerCase()
        .trim()
        .replace(/[_\s]+/g, '_') || ''
  );

  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[_\s]+/g, '_');
    const index = normalizedHeaders.findIndex(
      (h) => h === normalizedName || h.includes(normalizedName)
    );
    if (index !== -1) return index;
  }

  return -1;
}

/**
 * Normaliza rate_percent para escala "humana" (3-25)
 * - 0.12 → 12 (multiplicar por 100)
 * - 0.7 → 7 (multiplicar por 10)
 * - 70, 120 → 7, 12 (dividir por 10)
 * - 7, 12 → 7, 12 (manter)
 */
function normalizeIcmsRate(value: number): { normalized: number; error?: string } {
  const VALID_MIN = 3;
  const VALID_MAX = 25;

  // Already in valid range (3-25)
  if (value >= VALID_MIN && value <= VALID_MAX) {
    return { normalized: value };
  }

  // Decimal scale (0 < x < 1): try *100 first, then *10
  if (value > 0 && value < 1) {
    const times100 = value * 100;
    if (times100 >= VALID_MIN && times100 <= VALID_MAX) {
      return { normalized: times100 };
    }
    const times10 = value * 10;
    if (times10 >= VALID_MIN && times10 <= VALID_MAX) {
      return { normalized: times10 };
    }
    return { normalized: value, error: `Valor ${value} não pode ser normalizado para escala 3-25` };
  }

  // Value between 1 and 3: might be 1.2 meaning 12
  if (value >= 1 && value < VALID_MIN) {
    const times10 = value * 10;
    if (times10 >= VALID_MIN && times10 <= VALID_MAX) {
      return { normalized: times10 };
    }
  }

  // High values (>25): try dividing by 10
  if (value > VALID_MAX && value <= 250) {
    const divided = value / 10;
    if (divided >= VALID_MIN && divided <= VALID_MAX) {
      return { normalized: divided };
    }
  }

  // Value is 0 - special case for same state (intra-state might be 0 or different)
  if (value === 0) {
    return { normalized: 0 };
  }

  return { normalized: value, error: `Valor ${value} fora do intervalo esperado (3-25)` };
}

function validateIcmsRow(
  row: Partial<ParsedIcmsRow>,
  index: number,
  originalRate?: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const VALID_STATES = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ];

  if (!row.origin_state || !/^[A-Z]{2}$/.test(row.origin_state)) {
    errors.push(`Linha ${index + 1}: UF origem inválida (esperado 2 letras maiúsculas)`);
  } else if (!VALID_STATES.includes(row.origin_state)) {
    errors.push(`Linha ${index + 1}: UF origem "${row.origin_state}" não existe`);
  }

  if (!row.destination_state || !/^[A-Z]{2}$/.test(row.destination_state)) {
    errors.push(`Linha ${index + 1}: UF destino inválida (esperado 2 letras maiúsculas)`);
  } else if (!VALID_STATES.includes(row.destination_state)) {
    errors.push(`Linha ${index + 1}: UF destino "${row.destination_state}" não existe`);
  }

  if (row.rate_percent === undefined || row.rate_percent === null) {
    errors.push(`Linha ${index + 1}: Alíquota é obrigatória`);
  } else if (row.rate_percent !== 0 && (row.rate_percent < 3 || row.rate_percent > 25)) {
    const origDisplay = originalRate !== undefined ? ` (original: ${originalRate})` : '';
    errors.push(
      `Linha ${index + 1}: Alíquota ${row.rate_percent}${origDisplay} fora do intervalo 3-25%`
    );
  }

  return { isValid: errors.length === 0, errors };
}

export function parseCSVIcms(content: string, delimiter: string = ';'): ParseResult<ParsedIcmsRow> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const errors: string[] = [];
  const rows: ParsedIcmsRow[] = [];

  if (lines.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: ['Arquivo vazio ou sem dados'],
    };
  }

  const headers = lines[0].split(delimiter).map((h) => h.trim());

  const originIdx = findIcmsColumnIndex(headers, 'origin_state');
  const destIdx = findIcmsColumnIndex(headers, 'destination_state');
  const rateIdx = findIcmsColumnIndex(headers, 'rate_percent');

  if (originIdx === -1 || destIdx === -1 || rateIdx === -1) {
    errors.push('Colunas não encontradas. Esperado: uf_origem, uf_destino, aliquota');
    return { rows: [], totalRows: 0, validRows: 0, invalidRows: 0, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());

    if (values.every((v) => !v || v === '')) continue;

    const originState = values[originIdx]?.toUpperCase().trim() || '';
    const destState = values[destIdx]?.toUpperCase().trim() || '';
    const rawRate = normalizeBrazilianNumber(values[rateIdx]) ?? 0;

    // Normalize rate to human scale (3-25)
    const { normalized: normalizedRate, error: rateError } = normalizeIcmsRate(rawRate);

    const row: Partial<ParsedIcmsRow> = {
      origin_state: originState,
      destination_state: destState,
      rate_percent: normalizedRate,
    };

    const validation = validateIcmsRow(
      row,
      rows.length,
      rawRate !== normalizedRate ? rawRate : undefined
    );

    // Add rate normalization error if present
    if (rateError) {
      validation.errors.push(`Linha ${i}: ${rateError}`);
      validation.isValid = false;
    }

    rows.push({
      ...row,
      isValid: validation.isValid,
      errors: validation.errors,
    } as ParsedIcmsRow);

    errors.push(...validation.errors);
  }

  return {
    rows,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.isValid).length,
    invalidRows: rows.filter((r) => !r.isValid).length,
    errors,
  };
}

export async function parseIcmsFile(file: File): Promise<ParseResult<ParsedIcmsRow>> {
  const content = await file.text();
  return parseCSVIcms(content);
}
