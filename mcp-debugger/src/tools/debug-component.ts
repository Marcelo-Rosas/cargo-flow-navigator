/**
 * React Component Debugger
 *
 * Analyzes React components for common issues: missing dependencies, unnecessary renders, performance problems.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface ComponentIssue {
  type: 'missing_dependency' | 'unnecessary_render' | 'stale_hook' | 'console_log';
  line: number;
  description: string;
  fix: string;
  severity: 'warning' | 'error';
}

interface ComponentDebugResult {
  file: string;
  componentName?: string;
  issues: ComponentIssue[];
  summary: string;
  hooksFound: string[];
  renderCalls: number;
}

export async function debugComponent(input: {
  filePath: string;
  checks?: ('hooks' | 'renders' | 'performance' | 'all')[];
}): Promise<ComponentDebugResult> {
  const { filePath, checks = ['all'] } = input;

  try {
    const fullPath = resolve(filePath);
    const code = readFileSync(fullPath, 'utf-8');
    const lines = code.split('\n');
    const issues: ComponentIssue[] = [];
    const hooksFound: string[] = [];
    let renderCalls = 0;

    const shouldCheck = (check: string) => checks.includes('all') || checks.includes(check as any);

    // Extract component name
    const componentNameMatch = code.match(/(?:function|const)\s+(\w+)\s*(?:=|:|\()/);
    const componentName = componentNameMatch?.[1];

    if (shouldCheck('hooks')) {
      // Pattern: useState, useEffect, useCallback, useMemo, etc.
      const hookPattern = /use([A-Z]\w+)\(/g;
      let match;
      while ((match = hookPattern.exec(code)) !== null) {
        const hookName = `use${match[1]}`;
        if (!hooksFound.includes(hookName)) {
          hooksFound.push(hookName);
        }

        // Check for useEffect without dependencies
        if (match[1] === 'Effect') {
          const lineNumber = code.substring(0, match.index).split('\n').length;
          const contextStart = Math.max(0, match.index - 100);
          const contextEnd = Math.min(code.length, match.index + 500);
          const context = code.substring(contextStart, contextEnd);

          // Check if useEffect has dependency array
          if (!context.includes('[]') && !context.includes('[') + '(' + ']') {
            const cleanContext = context.replace(/\s+/g, ' ');
            if (!cleanContext.match(/useEffect\s*\(\s*[^)]+\s*,\s*\[\s*[^\]]*\s*\]/)) {
              issues.push({
                type: 'missing_dependency',
                line: lineNumber,
                description:
                  'useEffect may be missing dependency array or has incomplete dependencies',
                fix: 'Add a dependency array: useEffect(() => { ... }, [dep1, dep2])',
                severity: 'warning',
              });
            }
          }
        }

        // Check for useCallback without dependencies
        if (match[1] === 'Callback') {
          const lineNumber = code.substring(0, match.index).split('\n').length;
          const contextStart = Math.max(0, match.index - 100);
          const contextEnd = Math.min(code.length, match.index + 500);
          const context = code.substring(contextStart, contextEnd);

          if (!context.includes('[]')) {
            issues.push({
              type: 'missing_dependency',
              line: lineNumber,
              description:
                'useCallback should have explicit dependency array to optimize memoization',
              fix: 'Add dependency array: useCallback(() => { ... }, [dep1, dep2])',
              severity: 'warning',
            });
          }
        }

        // Check for useMemo
        if (match[1] === 'Memo') {
          const lineNumber = code.substring(0, match.index).split('\n').length;
          hooksFound.push('useMemo');
        }
      }

      // Pattern: Missing dependencies in useEffect
      const useEffectPattern = /useEffect\s*\(\s*(?:async\s+)?\(\s*\)\s*=>\s*\{([^}]+)\}/g;
      while ((match = useEffectPattern.exec(code)) !== null) {
        const effect = match[1];
        const lineNumber = code.substring(0, match.index).split('\n').length;

        // Check for state/prop usage without dependency
        const hasStateRef = /\b(state|prop|variable)\b/i.test(effect);
        if (hasStateRef) {
          const contextStart = Math.max(0, match.index - 50);
          const contextEnd = Math.min(code.length, match.index + match[0].length + 100);
          const context = code.substring(contextStart, contextEnd);

          if (!/\[\s*[^\]]*\s*\]/.test(context)) {
            issues.push({
              type: 'missing_dependency',
              line: lineNumber,
              description: 'State or props are used in useEffect but may not be in dependencies',
              fix: 'Ensure all used state/props are in the dependency array',
              severity: 'error',
            });
          }
        }
      }
    }

    if (shouldCheck('renders')) {
      // Pattern: inline object/array creation in JSX (causes re-renders)
      const inlineObjectPattern = /=\s*\{\s*\w+\s*:\s*[^}]+\}/g;
      let inlineMatches = 0;
      let match: RegExpExecArray | null;

      while ((match = inlineObjectPattern.exec(code)) !== null) {
        if (match.index > code.indexOf('return')) {
          // Only in JSX
          inlineMatches++;
          const lineNumber = code.substring(0, match.index).split('\n').length;

          issues.push({
            type: 'unnecessary_render',
            line: lineNumber,
            description: 'Inline object creation in JSX causes re-renders. Move to useMemo.',
            fix: `const obj = useMemo(() => ({ ${match[0].substring(2)} }), [deps]);`,
            severity: 'warning',
          });
        }
      }

      renderCalls = (code.match(/<\w+/g) || []).length;
    }

    if (shouldCheck('performance')) {
      // Pattern: console.log in production
      const consolePattern = /console\.(log|warn|error)\(/g;
      let consoleMatch: RegExpExecArray | null;
      while ((consoleMatch = consolePattern.exec(code)) !== null) {
        const match = consoleMatch;
        const lineNumber = code.substring(0, match.index).split('\n').length;
        issues.push({
          type: 'console_log',
          line: lineNumber,
          description: `console.${match[1]} found in component - remove for production`,
          fix: `Remove or wrap with: if (process.env.NODE_ENV === 'development') { console.${match[1]}(...) }`,
          severity: 'warning',
        });
      }
    }

    // Summary
    const summary =
      issues.length === 0
        ? '✅ Component looks good'
        : `⚠️ Found ${issues.length} potential issue(s)`;

    return {
      file: filePath,
      componentName,
      issues,
      summary,
      hooksFound,
      renderCalls,
    };
  } catch (error) {
    throw new Error(
      `Failed to debug component ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
