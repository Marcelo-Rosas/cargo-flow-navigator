import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Newspaper,
  ExternalLink,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { useNewsItems, type NewsItem } from '@/hooks/useNewsItems';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Tipos ────────────────────────────────────────────────────────────────
interface PendingArticle {
  id: string;
  titulo: string;
  url: string;
  data_pub: string | null;
  categoria: string | null;
  motivo_relevancia: string | null;
  periodo_referencia: string | null;
  tipo_indice: string | null;
  resumo_inferido: string | null;
  created_at: string;
}

// ── NewsCard ─────────────────────────────────────────────────────────────
function NewsCard({ item, delay }: { item: NewsItem; delay?: number }) {
  const score = item.relevance_score ?? 0;
  const scoreVariant = score >= 8 ? 'default' : score >= 5 ? 'secondary' : 'outline';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-foreground line-clamp-2">{item.title}</h3>
            <Badge variant={scoreVariant} className="shrink-0">
              {score}/10
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.source_name ?? item.source_type}</span>
            <span>•</span>
            <span>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{item.summary}</p>
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver original
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────
function NewsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="h-5 bg-muted rounded w-4/5 animate-pulse" />
            <div className="h-3 bg-muted rounded w-1/3 mt-2 animate-pulse" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-4 bg-muted rounded w-full animate-pulse mb-2" />
            <div className="h-4 bg-muted rounded w-full animate-pulse mb-2" />
            <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Painel de artigos pendentes NTC ──────────────────────────────────────
function PendingArticlesPanel() {
  const [open, setOpen] = useState(false);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['ntc-articles-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ntc_articles_seen' as 'documents')
        .select('*')
        .eq('precisa_insercao_manual', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data as unknown as PendingArticle[]) ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const promote = useMutation({
    mutationFn: async (article: PendingArticle) => {
      // Insere em news_items
      const { error: insertError } = await supabase.from('news_items').insert({
        title: article.titulo,
        summary:
          article.resumo_inferido ??
          `Artigo detectado automaticamente pelo monitor NTC. Período: ${article.periodo_referencia ?? 'não identificado'}.`,
        source_name: 'Portal NTC & Logística',
        source_url: article.url,
        source_type: 'agent',
        relevance_score: 8.5,
        ...(article.tipo_indice && { raw_snippet: article.tipo_indice }),
      });
      if (insertError) throw insertError;

      // Marca como inserido (ntc_articles_seen não está no schema gerado; tabela existe no DB)
      await supabase
        .from('ntc_articles_seen' as 'documents')
        .update({ precisa_insercao_manual: false, inserido_em: new Date().toISOString() } as Record<
          string,
          unknown
        >)
        .eq('id', article.id);
    },
    onSuccess: (_, article) => {
      setPromoted((prev) => new Set(prev).add(article.id));
      qc.invalidateQueries({ queryKey: ['news-items'] });
      qc.invalidateQueries({ queryKey: ['ntc-articles-pending'] });
    },
  });

  const nonPromoted = pending.filter((p) => !promoted.has(p.id));
  if (nonPromoted.length === 0 && !isLoading) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header clicável */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-800">
            Artigos NTC detectados — aguardando revisão
          </span>
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-amber-600" />
          ) : (
            <Badge className="bg-amber-200 text-amber-800 border-amber-300 text-[10px]">
              {nonPromoted.length}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-amber-600" />
        ) : (
          <ChevronDown size={16} className="text-amber-600" />
        )}
      </button>

      {/* Lista expandível */}
      {open && (
        <div className="divide-y divide-amber-100">
          {nonPromoted.map((article) => (
            <div key={article.id} className="px-5 py-3 flex items-start gap-3 bg-white/60">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{article.titulo}</p>
                <div className="flex items-center gap-2 mt-1">
                  {article.periodo_referencia && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                      {article.periodo_referencia}
                    </span>
                  )}
                  {article.tipo_indice && (
                    <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                      {article.tipo_indice}
                    </span>
                  )}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <ExternalLink size={10} /> Ver artigo
                  </a>
                </div>
                {article.resumo_inferido && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {article.resumo_inferido}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 h-8 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                disabled={promote.isPending}
                onClick={() => promote.mutate(article)}
              >
                {promote.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : promoted.has(article.id) ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-600" /> Promovido
                  </>
                ) : (
                  <>
                    <Plus size={12} /> Promover
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NewsTab principal ─────────────────────────────────────────────────────
export function NewsTab() {
  const { data: items, isLoading, isError, error } = useNewsItems(50);

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
        <p className="text-sm text-destructive">
          Não foi possível carregar as notícias. {(error as Error)?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          Notícias que impactam a precificação
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Resumos de notícias de portais de referência em frete e logística, com destaque para impacto
        em custos e regulamentação.
      </p>

      {/* Painel de artigos NTC pendentes */}
      <PendingArticlesPanel />

      {/* Lista de notícias */}
      {isLoading ? (
        <NewsSkeleton />
      ) : !items || items.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <Newspaper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma notícia recente.</p>
          <p className="text-xs text-muted-foreground mt-1">
            O agente de notícias é executado 2x ao dia. Volte mais tarde.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {items.map((item, i) => (
            <NewsCard key={item.id} item={item} delay={i * 0.05} />
          ))}
        </div>
      )}
    </div>
  );
}
