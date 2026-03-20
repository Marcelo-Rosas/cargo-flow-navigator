/**
 * JSON Schema definitions for tool input validation
 * Typed for MCP SDK compatibility
 */

export const RLSAnalysisSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Path to file to analyze (e.g., "src/components/Orders.tsx")',
    },
    checkType: {
      type: 'string',
      enum: ['queries', 'functions', 'all'],
      description: 'Type of RLS check to perform (default: "all")',
    },
    verbose: {
      type: 'boolean',
      description: 'Include detailed analysis output',
    },
  },
  required: ['filePath'] as string[],
};

export const IntlValidationSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Path to file to validate (e.g., "src/lib/formatters.ts")',
    },
    checkType: {
      type: 'string',
      enum: ['currency', 'numbers', 'all'],
      description: 'Type of Intl check to perform (default: "all")',
    },
    autoFix: {
      type: 'boolean',
      description: 'Auto-fix issues if possible',
    },
  },
  required: ['filePath'] as string[],
};

export const EdgeFunctionSchema = {
  type: 'object' as const,
  properties: {
    functionName: {
      type: 'string',
      description: 'Name of edge function to monitor (e.g., "calculate-freight")',
    },
    timeRange: {
      type: 'string',
      enum: ['1h', '24h', '7d'],
      description: 'Time range for metrics (default: 24h)',
    },
    limit: {
      type: 'number',
      description: 'Number of log entries to analyze (default: 100)',
    },
  },
};

export const ComponentDebugSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Path to React component file (e.g., "src/components/Orders.tsx")',
    },
    checks: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['hooks', 'renders', 'performance', 'all'],
      },
      description: 'Which checks to run (default: all)',
    },
  },
  required: ['filePath'] as string[],
};
