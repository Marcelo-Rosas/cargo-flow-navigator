import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callLLM } from '../_shared/aiClient.ts';
import {
  SYSTEM_PROMPT_NEWS_SUMMARY,
  MAX_TOKENS_NEWS_SUMMARY,
} from '../_shared/prompts/system_news_summary.ts';
import { validateAndParse } from '../_shared/prompts/schemas.ts';
import type { RegulatoryUpdateResult } from '../_shared/prompts/schemas.ts';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface ParsedArticle {
  title: string;
  url: string;
  date: string | null;
  source: string;
}

// 3 portais de referência em frete/logística
const SOURCE_URLS: { url: string; name: string }[] = [
  { url: 'https://www.portalntc.org.br/noticias/', name: 'Portal NTC' },
  { url: 'https://www.portalntc.org.br/categoria/artigos-tecnicos/', name: 'Portal NTC - Artigos' },
  { url: 'https://www.cargonews.com.br/', name: 'Cargo News' },
];

// ─────────────────────────────────────────────────────
// Web fetch & parse
// ─────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VectraCargo-NewsAgent/1.0' },
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

function parseArticles(html: string, sourceUrl: string, sourceName: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkPattern = /<h[23][^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const articlePattern = /<article[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  const patterns = [linkPattern, articlePattern];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1];
      const title = match[2].trim();
      if (!url || !title || title.length < 5) continue;
      if (url.startsWith('/')) {
        try {
          const base = new URL(sourceUrl);
          url = base.origin + url;
        } catch {
          continue;
        }
      }
      if (!url.startsWith('http')) continue;
      const key = `${url}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      articles.push({ title, url, date: null, source: sourceName });
    }
  }

  const datePattern =
    /(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s+)?(\d{4})/gi;
  const dateMatches = [...html.matchAll(datePattern)];
  for (let i = 0; i < Math.min(articles.length, dateMatches.length); i++) {
    articles[i].date = dateMatches[i][0];
  }

  return articles;
}

async function fetchAndFilterArticles(
  sb: ReturnType<typeof createClient>
): Promise<ParsedArticle[]> {
  const htmlResults = await Promise.all(SOURCE_URLS.map((s) => fetchHtml(s.url)));
  const allArticles: ParsedArticle[] = [];
  for (let i = 0; i < SOURCE_URLS.length; i++) {
    if (htmlResults[i]) {
      allArticles.push(...parseArticles(htmlResults[i], SOURCE_URLS[i].url, SOURCE_URLS[i].name));
    }
  }
  if (allArticles.length === 0) return [];

  const urls = allArticles.map((a) => a.url);
  const { data: existing } = await sb
    .from('news_items')
    .select('source_url')
    .in('source_url', urls);
  const processedSet = new Set((existing || []).map((r: { source_url: string }) => r.source_url));
  return allArticles.filter((a) => !processedSet.has(a.url)).slice(0, 15);
}

// ─────────────────────────────────────────────────────
// LLM summarization
// ─────────────────────────────────────────────────────

async function summarizeArticle(article: ParsedArticle): Promise<{
  summary: string;
  relevance_score: number;
  raw_snippet: string;
}> {
  const prompt = `Avalie a relevância desta notícia para precificação de frete rodoviário:

**Título**: ${article.title}
**URL**: ${article.url}
**Fonte**: ${article.source}
**Data**: ${article.date || 'não identificada'}

Classifique a relevância de 0 a 10 para impacto na precificação e resuma em 2-3 frases.`;

  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_NEWS_SUMMARY,
    maxTokens: MAX_TOKENS_NEWS_SUMMARY,
    modelHint: 'openai',
    analysisType: 'regulatory_update',
  });

  const analysis = validateAndParse<RegulatoryUpdateResult>(result.text, 'regulatory_update');
  const score = Math.min(10, Math.max(1, analysis.relevance_score ?? 5));
  const summary = (analysis.summary || article.title).substring(0, 1000);
  const raw_snippet = `${article.title}\n${article.source}`;

  return {
    summary,
    relevance_score: score,
    raw_snippet,
  };
}

// ─────────────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Supabase env not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);
    const articles = await fetchAndFilterArticles(sb);

    if (articles.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'No new articles to process' }),
        { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    const rows: Array<{
      title: string;
      summary: string;
      source_type: string;
      source_name: string;
      source_url: string;
      relevance_score: number;
      raw_snippet: string;
    }> = [];

    for (const article of articles) {
      try {
        const { summary, relevance_score, raw_snippet } = await summarizeArticle(article);
        rows.push({
          title: article.title.substring(0, 500),
          summary,
          source_type: 'web',
          source_name: article.source,
          source_url: article.url,
          relevance_score,
          raw_snippet,
        });
      } catch (e) {
        console.warn('Skip article:', article.title, e);
      }
    }

    if (rows.length > 0) {
      const { error } = await sb.from('news_items').insert(rows);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: rows.length,
        total_fetched: articles.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('news-agent error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
