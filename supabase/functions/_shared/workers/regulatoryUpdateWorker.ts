import { callLLM } from '../aiClient.ts';
import { SYSTEM_PROMPT_REGULATORY, MAX_TOKENS_REGULATORY } from '../prompts/system_regulatory.ts';
import { validateAndParse, type RegulatoryUpdateResult } from '../prompts/schemas.ts';

export interface ParsedArticle {
  title: string;
  url: string;
  date: string | null;
  source: string;
}

export interface RegulatoryUpdateWorkerContext {
  articlesToProcess: ParsedArticle[];
  model: string;
}

export interface RegulatoryUpdateWorkerResult {
  analysisSummary: { new_articles: number; high_relevance_count: number };
  durationMs: number;
  provider: string;
  notifications: Array<{
    template: string;
    channel: string;
    payload: Record<string, unknown>;
    status: string;
    created_at: string;
  }>;
  regulatory_updates_data: Array<Record<string, unknown>>;
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
  ctx: RegulatoryUpdateWorkerContext
): Promise<RegulatoryUpdateWorkerResult> {
  const { articlesToProcess, model } = ctx;
  const startTime = Date.now();
  let provider = '';

  const regulatory_updates_data: Array<Record<string, unknown>> = [];
  const notifications: RegulatoryUpdateWorkerResult['notifications'] = [];
  let highRelevanceCount = 0;

  // Parallel LLM calls — replaces the sequential for loop
  await Promise.all(
    articlesToProcess.map(async (article) => {
      const prompt = `Avalie a relevância desta notícia/publicação para uma transportadora rodoviária de cargas (TRC):

**Título**: ${article.title}
**URL**: ${article.url}
**Fonte**: ${article.source}
**Data**: ${article.date || 'não identificada'}

Classifique a relevância de 0 a 10 e indique se requer ação imediata da transportadora.`;

      const result = await callLLM({
        prompt,
        system: SYSTEM_PROMPT_REGULATORY,
        maxTokens: MAX_TOKENS_REGULATORY,
        modelHint: 'openai',
        analysisType: 'regulatory_update',
        entityType: null,
        entityId: null,
      });
      provider = result.provider;

      const analysis = validateAndParse<RegulatoryUpdateResult>(result.text, 'regulatory_update');

      regulatory_updates_data.push({
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
      });

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
    })
  );

  const durationMs = Date.now() - startTime;

  return {
    analysisSummary: {
      new_articles: articlesToProcess.length,
      high_relevance_count: highRelevanceCount,
    },
    durationMs,
    provider,
    notifications,
    regulatory_updates_data,
  };
}
