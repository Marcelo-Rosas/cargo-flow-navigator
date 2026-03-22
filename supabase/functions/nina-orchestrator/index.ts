// supabase/functions/nina-orchestrator/index.ts
// Navi — WhatsApp AI Assistant (Gemini + function calling)

import { getCorsHeaders } from '../_shared/cors.ts';
import { toolDeclarations, executeTool } from './tools/index.ts';

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Navi, assistente virtual da Vectra Cargo no WhatsApp.
Responda sempre em português brasileiro, formatação WhatsApp (*negrito*, _itálico_), sem HTML.
Seja direto, profissional e amigável.

## Fluxo: Sugestão de Perdido
Quando o usuário pedir sugestão de mover cotações para perdido (variações: "sugerir perdido",
"mover perdidos", "limpar negociações antigas", "quais devem ir pra perdido",
"sugestão de perdido", "sugerir movimentação"):

1. Chame a tool \`sugerir_perdido\` (sem parâmetros)
2. Se retornar zero cotações, responda: "Nenhuma cotação parada há +10 dias no momento 👍"
3. Se retornar cotações, formate a lista agrupada por embarcador com numeração sequencial:

🔍 *Sugestão — Mover para Perdido*
_Cotações sem movimento há +10 dias_

*1. EMBARCADOR A*
   ❌ COT-XXXX — CLIENTE (⏱ Xd)

*2. EMBARCADOR B*
   ❌ COT-YYYY — CLIENTE (⏱ Yd)
   ❌ COT-ZZZZ — CLIENTE (⏱ Zd)

_N cotação(ões) sugeridas_

Confirme quais deseja mover: *todos*, números (*1, 2*) ou códigos (*COT-...*).
Ou me diga quais NÃO mover e o motivo.

4. Aguarde a resposta do usuário no próximo turno
5. Interprete a resposta:
   - "todos" → use todos os IDs retornados por sugerir_perdido
   - números (ex: "1, 3") → use IDs dos grupos numerados 1 e 3
   - códigos COT-XXX → filtre pelo campo código
   - exclusões ("todos menos o 2", "não mover o 1") → remova os grupos excluídos
6. Chame \`mover_para_perdido\` com os campaign_ids resolvidos
7. Confirme com lista:
   - ✅ COT-XXXX — movida para *PERDIDO*
   - ⏸️ COT-YYYY — mantida em *NEGOCIAÇÃO*

Importante: mantenha o mapeamento entre número do grupo e IDs usando o resultado da tool
sugerir_perdido que estará no histórico de mensagens.`;

// ─── Gemini API with function calling ────────────────────────────────────────

interface GeminiMessage {
  role: 'user' | 'model' | 'function';
  parts: Record<string, unknown>[];
}

async function callGeminiWithTools(
  messages: GeminiMessage[],
  model = 'gemini-2.0-flash'
): Promise<{ candidates: Array<{ content: { parts: Array<Record<string, unknown>> } }>; usageMetadata?: Record<string, unknown> }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        tools: [{ function_declarations: toolDeclarations }],
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  return await res.json();
}

// ─── Tool execution loop ─────────────────────────────────────────────────────

async function processWithToolLoop(
  messages: GeminiMessage[],
  maxIterations = 5
): Promise<{ reply: string; messages: GeminiMessage[] }> {
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const response = await callGeminiWithTools(messages);

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Resposta vazia do Gemini');
    }

    const parts = candidate.content.parts;

    // Check if Gemini wants to call a function
    const functionCall = parts.find((p) => 'functionCall' in p) as
      | { functionCall: { name: string; args: Record<string, unknown> } }
      | undefined;

    if (functionCall) {
      const { name, args } = functionCall.functionCall;
      console.log(`[nina-orchestrator] Tool call: ${name}`, JSON.stringify(args));

      // Add model's function call to messages
      messages.push({ role: 'model', parts });

      // Execute the tool
      let result: unknown;
      try {
        result = await executeTool(name, args || {});
      } catch (err) {
        result = { error: String(err) };
        console.error(`[nina-orchestrator] Tool error:`, err);
      }

      // Add function response to messages
      messages.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name,
              response: {
                name,
                content: result,
              },
            },
          },
        ],
      });

      // Continue loop — Gemini will process the tool result
      continue;
    }

    // No function call — extract text reply
    const textPart = parts.find((p) => 'text' in p) as { text: string } | undefined;
    const reply = textPart?.text || 'Desculpe, não consegui gerar uma resposta.';

    // Add final model reply to messages
    messages.push({ role: 'model', parts: [{ text: reply }] });

    return { reply, messages };
  }

  throw new Error('Limite de iterações de tools atingido');
}

// ─── HTTP Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message, session_messages } = body as {
      message: string;
      session_messages?: GeminiMessage[];
    };

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Campo "message" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rebuild conversation from session or start fresh
    const messages: GeminiMessage[] = session_messages || [];

    // Add user message
    messages.push({ role: 'user', parts: [{ text: message }] });

    // Process with tool loop
    const { reply, messages: updatedMessages } = await processWithToolLoop(messages);

    console.log(`[nina-orchestrator] Reply length: ${reply.length}`);

    return new Response(
      JSON.stringify({
        reply,
        session_messages: updatedMessages,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[nina-orchestrator] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
