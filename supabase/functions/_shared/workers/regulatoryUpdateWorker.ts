import { callLLM } from '../aiClient.ts';
import { SYSTEM_PROMPT_REGULATORY, MAX_TOKENS_REGULATORY } from '../prompts/system_regulatory.ts';
import { validateAndParse, type RegulatoryUpdateResult } from '../prompts/schemas.ts';

interface WorkerContext {
  model: string;
  sb: any;
}

const SOURCE_URLS = [
  'https://www.portalntc.org.br/noticias/',
  'https://www.portalntc.org.br/categoria/artigos-tecnicos/',
];

interface ParsedArticle {
  title: string;
  url: string;
  date: string | null;
  source: string;
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

function parseArticles(html: string, sourceUrl: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkPattern = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!url || !title) continue;

    articles.push({ title, url, date: null, source: sourceUrl });
  }

  const datePattern =
    /(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s+)?(\d{4})/gi;
  const dateMatches = [...html.matchAll(datePattern)];
  for (let i = 0; i < Math.min(articles.length, dateMatches.length); i++) {
    articles[i].date = dateMatches[i][0];
  }

  return articles;
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VectraCargo-RegulatoryBot/1.0' },
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

export async function executeRegulatoryUpdateWorker(ctx: WorkerContext) {
  const startTime = Date.now();
  let provider = '';

  const htmlResults = await Promise.all(SOURCE_URLS.map(fetchHtml));

  const allArticles: ParsedArticle[] = [];
  for (let i = 0; i < SOURCE_URLS.length; i++) {
    if (htmlResults[i]) {
      allArticles.push(...parseArticles(htmlResults[i], SOURCE_URLS[i]));
    }
  }

  if (allArticles.length === 0) {
    return {
      analysis: { new_articles: 0, high_relevance_count: 0 },
      durationMs: Date.now() - startTime,
      provider: 'none',
    };
  }

  const urls = allArticles.map((a) => a.url);
  const { data: existingUrls } = await ctx.sb
    .from('regulatory_updates')
    .select('source_url')
    .in('source_url', urls);

  const processedSet = new Set((existingUrls || []).map((r: any) => r.source_url));
  const newArticles = allArticles.filter((a) => !processedSet.has(a.url)).slice(0, 10);

  if (newArticles.length === 0) {
    return {
      analysis: { new_articles: 0, high_relevance_count: 0 },
      durationMs: Date.now() - startTime,
      provider: 'none',
    };
  }

  let highRelevanceCount = 0;

  for (const article of newArticles) {
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
      analysisType: 'regulatory_update',
      entityType: null,
      entityId: null,
    });
    provider = result.provider;

    const analysis = validateAndParse<RegulatoryUpdateResult>(result.text, 'regulatory_update');

    await ctx.sb.from('regulatory_updates').insert({
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
      await ctx.sb.from('notification_queue').insert({
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
  }

  const durationMs = Date.now() - startTime;

  return {
    analysis: { new_articles: newArticles.length, high_relevance_count: highRelevanceCount },
    durationMs,
    provider,
  };
}
