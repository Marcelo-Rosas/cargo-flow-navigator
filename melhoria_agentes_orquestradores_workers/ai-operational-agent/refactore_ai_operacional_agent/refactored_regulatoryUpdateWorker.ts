import { callLLM } from '../aiClient.ts';
import { SYSTEM_PROMPT_REGULATORY, MAX_TOKENS_REGULATORY } from '../prompts/system_regulatory.ts';
import { validateAndParse, type RegulatoryUpdateResult } from '../prompts/schemas.ts';

interface ParsedArticle {
  title: string;
  url: string;
  date: string | null;
  source: string;
}

// Nova interface para o contexto do worker refatorado
interface RefactoredWorkerContext {
  articlesToProcess: ParsedArticle[]; // Artigos já pré-buscados e filtrados pelo orquestrador
  model: string;
  previousInsights?: string; // Insights anteriores, se houver
}

// Nova interface para o retorno do worker refatorado
interface RefactoredWorkerResult {
  analysisSummary: { new_articles: number; high_relevance_count: number };
  durationMs: number;
  provider: string;
  notifications: Array<{
    template: string;
    channel: string;
    payload: any;
    status: string;
    created_at: string;
  }>;
  regulatory_updates_data: Array<any>; // Dados para inserção na tabela regulatory_updates
}

function parsePortugueseDate(raw: string | null): string | null {
  if (!raw) return null;

  const cleaned = raw.trim().toLowerCase();
  const monthMap: Record<string, number> = {
    janeiro: 0,
    fevereiro: 1,
    março: 2,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  };

  const m = cleaned.match(
    /(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s+)?(\d{4})/
  );
  if (!m) return null;

  const day = Number(m[1]);
  const month = monthMap[m[2]];
  const year = Number(m[3]);
  if (Number.isNaN(day) || Number.isNaN(year) || month == null) return null;

  return new Date(Date.UTC(year, month, day, 12, 0, 0)).toISOString();
}

export async function executeRegulatoryUpdateWorker(
  ctx: RefactoredWorkerContext
): Promise<RefactoredWorkerResult> {
  const { articlesToProcess, model, previousInsights } = ctx;
  const startTime = Date.now();
  let provider = '';

  const regulatoryUpdatesData: Array<any> = [];
  const notifications: Array<{
    template: string;
    channel: string;
    payload: any;
    status: string;
    created_at: string;
  }> = [];
  let highRelevanceCount = 0;

  // Processamento paralelo das chamadas ao LLM
  const llmAnalysisPromises = articlesToProcess.map(async (article) => {
    const prompt =
      `Avalie a relevância desta notícia/publicação para uma transportadora rodoviária de cargas (TRC):\n\n` +
      `**Título**: ${article.title}\n` +
      `**URL**: ${article.url}\n` +
      `**Fonte**: ${article.source}\n` +
      `**Data**: ${article.date || 'não identificada'}\n\n` +
      `Classifique a relevância de 0 a 10 e indique se requer ação imediata da transportadora.`;

    const result = await callLLM({
      prompt,
      system: SYSTEM_PROMPT_REGULATORY,
      maxTokens: MAX_TOKENS_REGULATORY,
      analysisType: 'regulatory_update',
      entityType: null,
      entityId: null,
    });
    provider = result.provider; // Assume que o provider é o mesmo para todas as chamadas

    const analysis = validateAndParse<RegulatoryUpdateResult>(result.text, 'regulatory_update');

    const updateData = {
      title: article.title,
      source: article.source,
      url: article.url,
      source_url: article.url,
      source_name: article.source,
      published_at: parsePortugueseDate(article.date),
      relevance_score: analysis.relevance_score ?? 0,
      summary: analysis.summary || '',
      action_required: analysis.action_required ?? false,
      impact_areas: analysis.impact_areas || [],
      recommendation: analysis.recommendation || '',
      analysis,
      ai_analysis: analysis,
      created_at: new Date().toISOString(),
    };
    regulatoryUpdatesData.push(updateData);

    if ((analysis.relevance_score ?? 0) >= 7) {
      highRelevanceCount++;
      notifications.push({
        template: 'regulatory_alert',
        channel: 'whatsapp',
        payload: {
          title: article.title,
          url: article.url,
          summary: analysis.summary,
          relevance_score: analysis.relevance_score,
          action_required: analysis.action_required,
        },
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
    return analysis; // Retorna a análise para Promise.all
  });

  await Promise.all(llmAnalysisPromises); // Espera todas as análises do LLM serem concluídas

  const durationMs = Date.now() - startTime;

  return {
    analysisSummary: {
      new_articles: articlesToProcess.length,
      high_relevance_count: highRelevanceCount,
    },
    durationMs,
    provider,
    notifications,
    regulatory_updates_data: regulatoryUpdatesData,
  };
}
