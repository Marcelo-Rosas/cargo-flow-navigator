/**
 * RLS Violation Analyzer
 *
 * Detects Row Level Security bypasses and permission issues in Supabase code.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface RLSViolation {
  location: string;
  type: 'missing_rls' | 'insecure_query' | 'bypass_risk';
  severity: 'error' | 'warning';
  suggestion: string;
}

interface RLSAnalysisResult {
  file: string;
  violations: RLSViolation[];
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  passedChecks: string[];
}

export async function analyzeRlsViolations(input: {
  filePath: string;
  checkType?: 'queries' | 'functions' | 'all';
  verbose?: boolean;
}): Promise<RLSAnalysisResult> {
  const { filePath, checkType = 'all', verbose = false } = input;

  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, 'utf-8');
    const violations: RLSViolation[] = [];
    const passedChecks: string[] = [];

    // Check for Supabase query patterns
    if (checkType === 'queries' || checkType === 'all') {
      // Pattern 1: supabase.from().select() without .eq() or RLS policy check
      const selectPattern = /supabase\.from\(['"`](\w+)['"`]\)\.select\(/g;
      let match;
      while ((match = selectPattern.exec(code)) !== null) {
        const lineNumber = code.substring(0, match.index).split('\n').length;
        const tableName = match[1];

        // Check if there's a filtering condition nearby
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(code.length, match.index + 500);
        const context = code.substring(contextStart, contextEnd);

        if (
          !context.includes('.eq(') &&
          !context.includes('.neq(') &&
          !context.includes('.lt(') &&
          !context.includes('.gt(')
        ) {
          violations.push({
            location: `${filePath}:${lineNumber}`,
            type: 'missing_rls',
            severity: 'warning',
            suggestion: `Add filtering condition to query on table '${tableName}' or ensure RLS policy is enforced. Example: .eq('user_id', userId)`,
          });
        }
      }

      // Pattern 2: Using .rls() explicitly (good!)
      if (code.includes('.rls()')) {
        passedChecks.push('✅ Found explicit .rls() calls');
      }

      // Pattern 3: Client-side filtering (security risk!)
      const clientFilterPattern = /const\s+(\w+)\s*=\s*[^;]*\.select\(\)[^;]*;\s*const\s+filtered/g;
      if (clientFilterPattern.test(code)) {
        violations.push({
          location: `${filePath}:client-side filtering`,
          type: 'bypass_risk',
          severity: 'error',
          suggestion:
            'Never filter data on client side. Use RLS policies and database-level filtering instead.',
        });
      }
    }

    // Check for Edge Function patterns
    if (checkType === 'functions' || checkType === 'all') {
      // Pattern: Service role key usage (should only be in functions, not client)
      if (code.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        if (!filePath.includes('supabase/functions')) {
          violations.push({
            location: `${filePath}:service role`,
            type: 'bypass_risk',
            severity: 'error',
            suggestion:
              'Service role key should only be used in Edge Functions, never in client code.',
          });
        } else {
          passedChecks.push('✅ Service role key only in Edge Functions');
        }
      }

      // Pattern: Auth context usage
      if (code.includes('supabase.auth.getUser()')) {
        passedChecks.push('✅ Using auth.getUser() for user context');
      }
    }

    // Summary
    const riskLevel =
      violations.length === 0
        ? 'low'
        : violations.some((v) => v.severity === 'error')
          ? 'critical'
          : 'medium';

    const summary =
      violations.length === 0
        ? '✅ No RLS violations detected'
        : `⚠️ Found ${violations.length} potential RLS issue(s)`;

    return {
      file: filePath,
      violations,
      summary,
      riskLevel,
      passedChecks,
    };
  } catch (error) {
    throw new Error(
      `Failed to analyze RLS violations in ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
