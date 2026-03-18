/**
 * Branded Types para compile-time type safety
 * Previne misuse de IDs e garante type-correctness
 * Referência: https://egghead.io/articles/using-branded-types-in-typescript
 */

/**
 * Quote identifier - distinct from other string IDs at compile-time
 * Prevents accidental swapping of quote/policy/risk IDs
 *
 * @example
 * const quoteId = createQuoteId('quote-123')
 * type Q = typeof quoteId // Q is QuoteId, not string
 */
export type QuoteId = string & { readonly __brand: 'QuoteId' };

/**
 * Create a typed QuoteId from string
 * @param id - Raw quote identifier string
 * @returns Branded QuoteId type
 * @throws Never - accepts any string
 */
export const createQuoteId = (id: string): QuoteId => id as QuoteId;

/**
 * Policy number identifier - distinct from other string IDs at compile-time
 * Ensures policy numbers aren't confused with quote/risk IDs
 *
 * @example
 * const policy = createPolicyNumber('POL-2026-001')
 * type P = typeof policy // P is PolicyNumber, not string
 */
export type PolicyNumber = string & { readonly __brand: 'PolicyNumber' };

/**
 * Create a typed PolicyNumber from string
 * @param num - Raw policy number string
 * @returns Branded PolicyNumber type
 * @throws Never - accepts any string
 */
export const createPolicyNumber = (num: string): PolicyNumber => num as PolicyNumber;

/**
 * Risk assessment identifier - distinct from other string IDs at compile-time
 * Prevents accidental mixing of risk/quote/policy IDs
 *
 * @example
 * const riskId = createRiskId('risk-456')
 * type R = typeof riskId // R is RiskId, not string
 */
export type RiskId = string & { readonly __brand: 'RiskId' };

/**
 * Create a typed RiskId from string
 * @param id - Raw risk identifier string
 * @returns Branded RiskId type
 * @throws Never - accepts any string
 */
export const createRiskId = (id: string): RiskId => id as RiskId;

/**
 * Monetary value in Brazilian centavos (1 real = 100 centavos)
 * Enforces integer values and non-negative constraint at creation time
 *
 * @example
 * const premium = createCentavos(50000) // R$ 500,00
 * const calc = premium * 2 // Type error! Must unwrap first
 * const raw = unwrap(premium) // 50000
 */
export type Centavos = number & { readonly __brand: 'Centavos' };

/**
 * Create a typed Centavos monetary value from number
 * @param value - Non-negative integer representing centavos
 * @returns Branded Centavos type
 * @throws Error if value is not non-negative integer
 *
 * @example
 * createCentavos(50000) // ✓ R$ 500,00
 * createCentavos(50000.5) // ✗ Must be integer
 * createCentavos(-1000) // ✗ Must be non-negative
 */
export const createCentavos = (value: number): Centavos => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid centavos value: ${value}. Must be non-negative integer.`);
  }
  return value as Centavos;
};

/**
 * Brazilian state abbreviation (UF = Unidade Federativa)
 * Validated at creation to match 2-letter format (SP, RJ, MG, etc.)
 *
 * @example
 * const origin = createUF('SP') // ✓
 * const origin2 = createUF('são paulo') // ✗ Must be 2-letter code
 */
export type UF = string & { readonly __brand: 'UF' };

/**
 * Create a validated UF state identifier
 * @param uf - State abbreviation (case-insensitive, auto-uppercased)
 * @returns Branded UF type (uppercase)
 * @throws Error if not exactly 2 letters
 *
 * @example
 * createUF('sp') // ✓ Returns 'SP'
 * createUF('SP') // ✓ Returns 'SP'
 * createUF('s') // ✗ Too short
 * createUF('são paulo') // ✗ Invalid format
 */
export const createUF = (uf: string): UF => {
  const normalized = uf.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error(`Invalid UF: ${uf}. Must be 2-letter state code.`);
  }
  return normalized as UF;
};

/**
 * Insurance coverage types with validation
 * BASIC: Minimal coverage for low-risk routes
 * STANDARD: Recommended for most commercial routes
 * PLUS: Complete coverage with premium features
 */
export const COVERAGE_TYPES = {
  BASIC: 'BASIC',
  STANDARD: 'STANDARD',
  PLUS: 'PLUS',
} as const;

/**
 * Typed coverage level - enforced by TypeScript for exhaustiveness
 * @example
 * type C = CoverageType // 'BASIC' | 'STANDARD' | 'PLUS'
 * const coverage: CoverageType = 'STANDARD' // ✓
 * const coverage2: CoverageType = 'INVALID' // ✗ Type error
 */
export type CoverageType = (typeof COVERAGE_TYPES)[keyof typeof COVERAGE_TYPES];

/**
 * Insurance policy statuses with lifecycle tracking
 * PENDING: Created but not yet active
 * ACTIVE: Policy in force and covering shipments
 * CONCLUDED: Completed successfully
 * INACTIVE: Disabled or expired
 */
export const INSURANCE_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CONCLUDED: 'concluded',
  INACTIVE: 'inactive',
} as const;

/**
 * Typed insurance status - enforced by TypeScript for exhaustiveness checks
 * @example
 * type S = InsuranceStatus // 'pending' | 'active' | 'concluded' | 'inactive'
 * const status: InsuranceStatus = 'active' // ✓
 * const status2: InsuranceStatus = 'unknown' // ✗ Type error
 */
export type InsuranceStatus = (typeof INSURANCE_STATUSES)[keyof typeof INSURANCE_STATUSES];

/**
 * ISO 8601 timestamp with validation at creation time
 * Ensures temporal data is properly formatted for logging/auditing
 *
 * @example
 * const ts = createTimestamp('2026-03-17T15:30:00') // ✓
 * const ts2 = createTimestamp('invalid') // ✗ Type error at runtime
 */
export type Timestamp = string & { readonly __brand: 'Timestamp' };

/**
 * Create a validated ISO 8601 timestamp
 * @param iso - ISO format datetime string (YYYY-MM-DDTHH:mm:ss)
 * @returns Branded Timestamp type
 * @throws Error if not valid ISO 8601 format
 *
 * @example
 * createTimestamp('2026-03-17T15:30:00') // ✓
 * createTimestamp('2026-03-17T15:30:00Z') // ✓ With timezone
 * createTimestamp('03/17/2026') // ✗ Invalid format
 */
export const createTimestamp = (iso: string): Timestamp => {
  if (!iso.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    throw new Error(`Invalid ISO timestamp: ${iso}`);
  }
  return iso as Timestamp;
};

/**
 * Risk assessment levels for insurance eligibility
 * LOW: Safe routes (known routes, reliable drivers, domestic)
 * MEDIUM: Standard routes (interstate, some unknowns)
 * HIGH: Risky routes (remote areas, new routes, international)
 */
export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

/**
 * Typed risk level - enforced by TypeScript for exhaustiveness
 * @example
 * type R = RiskLevel // 'low' | 'medium' | 'high'
 * const risk: RiskLevel = 'medium' // ✓
 * const risk2: RiskLevel = 'critical' // ✗ Type error
 */
export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

/**
 * Extract raw primitive value from branded type
 * ⚠️ Use sparingly - defeats purpose of branding!
 * Only use when interfacing with untyped APIs or serialization
 *
 * @param branded - Branded value (QuoteId, Centavos, UF, etc.)
 * @returns Unwrapped primitive value (string or number)
 *
 * @example
 * const quoteId = createQuoteId('quote-123')
 * const raw = unwrap(quoteId) // 'quote-123' (no longer typed as QuoteId)
 *
 * ⚠️ Avoid:
 * const premium = createCentavos(50000)
 * const bad = unwrap(premium) // Loses type safety!
 */
export const unwrap = <T extends string | number>(
  branded: T
): T extends (string | number) & { readonly __brand: string } ? string | number : never => {
  return branded as T;
};
