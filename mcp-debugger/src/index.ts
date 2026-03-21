#!/usr/bin/env node
/**
 * CFN Debugger MCP Server
 *
 * Provides automated debugging tools for Cargo Flow Navigator:
 * - RLS violation detection
 * - Currency formatting validation
 * - Edge Function monitoring
 * - React component analysis
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { analyzeRlsViolations } from './tools/analyze-rls.js';
import { validateIntlFormat } from './tools/validate-intl.js';
import { monitorEdgeFunctions } from './tools/monitor-edge-functions.js';
import { debugComponent } from './tools/debug-component.js';

import {
  RLSAnalysisSchema,
  IntlValidationSchema,
  EdgeFunctionSchema,
  ComponentDebugSchema,
} from './schemas/validation.js';

const server = new Server(
  {
    name: 'cfn-debugger',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define all available tools
const tools: Tool[] = [
  {
    name: 'analyze-rls-violations',
    description:
      'Detects RLS (Row Level Security) bypasses and permission issues in TypeScript/Supabase code',
    inputSchema: RLSAnalysisSchema,
  },
  {
    name: 'validate-intl-format',
    description:
      'Ensures all BRL currency formatting follows CFN standard (Intl.NumberFormat with 2 decimals)',
    inputSchema: IntlValidationSchema,
  },
  {
    name: 'monitor-edge-functions',
    description: 'Monitors Supabase Edge Function performance metrics, errors, and latency',
    inputSchema: EdgeFunctionSchema,
  },
  {
    name: 'debug-component',
    description:
      'Analyzes React component issues: missing hooks dependencies, unnecessary renders, performance problems',
    inputSchema: ComponentDebugSchema,
  },
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'analyze-rls-violations': {
        const result = await analyzeRlsViolations(
          args as Parameters<typeof analyzeRlsViolations>[0]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'validate-intl-format': {
        const result = await validateIntlFormat(args as Parameters<typeof validateIntlFormat>[0]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'monitor-edge-functions': {
        const result = await monitorEdgeFunctions(
          args as Parameters<typeof monitorEdgeFunctions>[0]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'debug-component': {
        const result = await debugComponent(args as Parameters<typeof debugComponent>[0]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CFN Debugger MCP Server running on stdio');
}

main().catch(console.error);
