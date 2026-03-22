// supabase/functions/nina-orchestrator/tools/index.ts
// Registry de tools do Navi (nina-orchestrator)

import { executeSugerirPerdido } from './sugerir_perdido.ts';
import { executeMoverParaPerdido } from './mover_para_perdido.ts';

// Gemini function declarations (tool definitions)
export const toolDeclarations = [
  {
    name: 'sugerir_perdido',
    description:
      'Busca cotações no estágio "negociação" paradas há mais de 10 dias e retorna uma lista agrupada por embarcador com sugestão de mover para perdido. Não requer parâmetros.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'mover_para_perdido',
    description:
      'Move cotações confirmadas pelo usuário do estágio "negociação" para "perdido". Registra evento de auditoria em workflow_events e workflow_event_logs.',
    parameters: {
      type: 'object',
      properties: {
        quote_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array de UUIDs das cotações a serem movidas para perdido',
        },
      },
      required: ['quote_ids'],
    },
  },
];

// Tool executor — dispatches function calls to handlers
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'sugerir_perdido':
      return await executeSugerirPerdido();

    case 'mover_para_perdido':
      return await executeMoverParaPerdido({
        quote_ids: args.quote_ids as string[],
      });

    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}
