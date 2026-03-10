import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, Loader2 } from 'lucide-react';
import { useNewsItems, type NewsItem } from '@/hooks/useNewsItems';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
