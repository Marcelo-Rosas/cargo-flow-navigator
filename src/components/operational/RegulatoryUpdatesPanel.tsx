import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRegulatoryUpdates } from '@/hooks/useRegulatoryUpdates';
import { useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────
// Source badge config
// ─────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  ntc_noticias: {
    label: 'NTC Notícias',
    className:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  },
  ntc_artigos: {
    label: 'NTC Artigos',
    className:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  },
  antt: {
    label: 'ANTT',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
};

function getSourceConfig(source: string) {
  return (
    SOURCE_CONFIG[source] ?? {
      label: source,
      className:
        'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
    }
  );
}

// ─────────────────────────────────────────────────────
// Relevance badge
// ─────────────────────────────────────────────────────

function relevanceClassName(score: number | null): string {
  if (score === null)
    return 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400';
  if (score >= 7)
    return 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400';
  if (score >= 4)
    return 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400';
  return 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400';
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

interface RegulatoryUpdatesPanelProps {
  limit?: number;
}

export function RegulatoryUpdatesPanel({ limit = 10 }: RegulatoryUpdatesPanelProps) {
  const { data: updates, isLoading, isRefetching } = useRegulatoryUpdates(limit);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['regulatory-updates', limit] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="p-5 rounded-xl border bg-card shadow-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Newspaper className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold">Atualizações Regulatórias</h3>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Carregando atualizações...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!updates || updates.length === 0) && (
        <div className="text-center py-8">
          <Inbox className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma atualização regulatória recente</p>
        </div>
      )}

      {/* Updates list */}
      {!isLoading && updates && updates.length > 0 && (
        <div className="space-y-3">
          {updates.map((update, i) => {
            const source = getSourceConfig(update.source);

            return (
              <motion.div
                key={update.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors space-y-2"
              >
                {/* Source + Relevance + Action required */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <Badge variant="default" className={`text-[9px] ${source.className}`}>
                    {source.label}
                  </Badge>

                  {update.relevance_score !== null && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${relevanceClassName(update.relevance_score)}`}
                    >
                      Relevância: {update.relevance_score}
                    </Badge>
                  )}

                  {update.action_required && (
                    <Badge
                      variant="default"
                      className="text-[9px] bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 gap-0.5"
                    >
                      <AlertCircle className="w-2.5 h-2.5" />
                      Ação necessária
                    </Badge>
                  )}
                </div>

                {/* Title */}
                {update.url ? (
                  <a
                    href={update.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                  >
                    {update.title}
                    <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                  </a>
                ) : (
                  <p className="text-xs font-medium">{update.title}</p>
                )}

                {/* Summary (truncated) */}
                {update.summary && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {update.summary}
                  </p>
                )}

                {/* Date */}
                <p className="text-[10px] text-muted-foreground/60">
                  {new Date(update.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
