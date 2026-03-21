/**
 * Intl.NumberFormat Validator
 *
 * Ensures BRL currency formatting follows CFN standard (2 decimals).
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface IntlIssue {
  location: string;
  issue: 'missing_fraction_digits' | 'wrong_locale' | 'wrong_currency' | 'wrong_notation';
  current: string;
  suggested: string;
  line: number;
}

interface IntlValidationResult {
  file: string;
  issues: IntlIssue[];
  totalIntlCalls: number;
  conforming: number;
  fixedCode?: string;
  summary: string;
}

export async function validateIntlFormat(input: {
  filePath: string;
  checkType?: 'currency' | 'numbers' | 'all';
  autoFix?: boolean;
}): Promise<IntlValidationResult> {
  const { filePath, checkType = 'all', autoFix = false } = input;

  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, 'utf-8');
    const lines = code.split('\n');
    const issues: IntlIssue[] = [];

    let totalIntlCalls = 0;
    let conforming = 0;
    let fixedCode = code;

    // Pattern: new Intl.NumberFormat with currency
    const intlPattern =
      /new\s+Intl\.NumberFormat\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}\s*\)/g;

    let match;
    while ((match = intlPattern.exec(code)) !== null) {
      totalIntlCalls++;
      const locale = match[1];
      const options = match[2];
      const fullMatch = match[0];
      const lineNumber = code.substring(0, match.index).split('\n').length;

      // Check if it has currency: 'BRL'
      if (options.includes('currency') && options.includes("'BRL'")) {
        // Check for minimumFractionDigits and maximumFractionDigits
        if (
          !options.includes('minimumFractionDigits') ||
          !options.includes('maximumFractionDigits')
        ) {
          const suggested = `new Intl.NumberFormat('${locale}', {\n    ${options.trim()},\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2,\n  })`;

          issues.push({
            location: `${filePath}:${lineNumber}`,
            issue: 'missing_fraction_digits',
            current: fullMatch,
            suggested,
            line: lineNumber,
          });

          if (autoFix) {
            fixedCode = fixedCode.replace(
              fullMatch,
              `new Intl.NumberFormat('${locale}', {\n    ${options.trim()},\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2,\n  })`
            );
          }
        } else {
          conforming++;
        }

        // Check wrong locale
        if (locale !== 'pt-BR' && !options.includes('pt-BR')) {
          issues.push({
            location: `${filePath}:${lineNumber}`,
            issue: 'wrong_locale',
            current: locale,
            suggested: 'pt-BR',
            line: lineNumber,
          });
        }

        // Check notation field (should be used carefully with currency)
        if (options.includes('notation:') && options.includes('compact')) {
          if (!options.includes('minimumFractionDigits: 2')) {
            issues.push({
              location: `${filePath}:${lineNumber}`,
              issue: 'missing_fraction_digits',
              current: fullMatch,
              suggested:
                "Add minimumFractionDigits: 2 when using notation: 'compact' with currency",
              line: lineNumber,
            });
          }
        }
      }
    }

    // Summary
    const summary =
      issues.length === 0
        ? `✅ All ${totalIntlCalls} Intl.NumberFormat calls are properly formatted`
        : `⚠️ Found ${issues.length} formatting issue(s) in ${totalIntlCalls} calls`;

    const result: IntlValidationResult = {
      file: filePath,
      issues,
      totalIntlCalls,
      conforming,
      summary,
    };

    if (autoFix && fixedCode !== code) {
      result.fixedCode = fixedCode;
      writeFileSync(fullPath, fixedCode);
    }

    return result;
  } catch (error) {
    throw new Error(
      `Failed to validate Intl format in ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
