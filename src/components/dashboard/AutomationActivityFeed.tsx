import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  FileText,
  ShieldCheck,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecentWorkflowEvents } from '@/hooks/useWorkflowEvents';

const eventTypeConfig: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  'quote.stage_changed': {
    label: 'Cotação',
    icon: FileText,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  },
  'order.created': {
    label: 'OS criada',
    icon: Truck,
    color: 'text-green-600 bg-green-50 dark:bg-green-950/30',
  },
  'order.stage_changed': {
    label: 'OS',
    icon: Truck,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  },
  'financial.status_changed': {
    label: 'Financeiro',
    icon: FileText,
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
  },
  'approval.decided': {
    label: 'Aprovação',
    icon: ShieldCheck,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  },
  'document.uploaded': {
    label: 'Documento',
    icon: FileText,
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30',
  },
};

function getEventDescription(event: {
  event_type: string;
  payload: Record<string, unknown>;
}): string {
  const p = event.payload;

  switch (event.event_type) {
    case 'quote.stage_changed':
      return `${p.quote_code || 'Cotação'}: ${p.old_stage} → ${p.new_stage}`;
    case 'order.created':
      return `OS ${p.os_number || ''} criada${p.client_name ? ` — ${p.client_name}` : ''}`;
    case 'order.stage_changed':
      return `OS ${p.os_number || ''}: ${p.old_stage} → ${p.new_stage}`;
    case 'financial.status_changed':
      return `${p.type || ''} ${p.code || ''}: ${p.old_status} → ${p.new_status}`;
    case 'approval.decided':
      return `${p.decision === 'approved' ? 'Aprovado' : 'Rejeitado'}: ${p.approval_type || ''}`;
    case 'document.uploaded':
      return `${((p.type as string) || '').toUpperCase()} enviado${p.file_name ? `: ${p.file_name}` : ''}`;
    default:
      return event.event_type;
  }
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const PAGE_SIZE = 15;

export function AutomationActivityFeed() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data: events = [], isLoading } = useRecentWorkflowEvents(limit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="p-5 rounded-xl border bg-card shadow-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h3 className="text-sm font-semibold">Atividade do Sistema</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {events.length} eventos
        </Badge>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Clock className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Carregando atividades...</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && events.length === 0 && (
        <div className="text-center py-6">
          <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade automática registrada ainda
          </p>
        </div>
      )}

      {/* Event list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {events.map((event, i) => {
            const config = eventTypeConfig[event.event_type] || {
              label: event.event_type,
              icon: Zap,
              color: 'text-gray-600 bg-gray-50',
            };
            const EventIcon = config.icon;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-2.5 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className={`shrink-0 p-1 rounded ${config.color}`}>
                  <EventIcon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-tight truncate">{getEventDescription(event)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {event.status === 'completed' ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Load more */}
      {!isLoading && events.length >= limit && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7 gap-1"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
          >
            <ChevronDown className="w-3 h-3" />
            Ver mais
          </Button>
        </div>
      )}
    </motion.div>
  );
}
