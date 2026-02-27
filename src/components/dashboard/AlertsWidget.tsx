import { motion } from 'framer-motion';
import { AlertTriangle, FileWarning, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useActiveAlerts, type ActiveAlert } from '@/hooks/useActiveAlerts';

const alertStyles = {
  critical: {
    bg: 'bg-destructive/10 border-destructive/30',
    icon: AlertTriangle,
    iconColor: 'text-destructive',
  },
  warning: {
    bg: 'bg-warning/10 border-warning/30',
    icon: Clock,
    iconColor: 'text-warning',
  },
  info: {
    bg: 'bg-primary/10 border-primary/30',
    icon: FileWarning,
    iconColor: 'text-primary',
  },
};

function extractOs(text: string) {
  const m = text.match(/OS-\d{4}-\d{4}/i);
  return m ? m[0].toUpperCase() : null;
}

function AlertItem({ alert, index }: { alert: ActiveAlert; index: number }) {
  const navigate = useNavigate();
  const style = alertStyles[alert.type];
  const Icon = style.icon;

  const handleAction = () => {
    if (alert.action?.label === 'Verificar') return navigate('/documentos');
    if (alert.action?.label === 'Ver OS') {
      const os = extractOs(`${alert.title} ${alert.description}`);
      return os ? navigate(`/operacional?q=${encodeURIComponent(os)}`) : navigate('/operacional');
    }
    if (alert.action?.label === 'Resolver') {
      const os = extractOs(`${alert.title} ${alert.description}`);
      return os ? navigate(`/documentos?q=${encodeURIComponent(os)}`) : navigate('/documentos');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.1 * index }}
      className={cn('p-4 rounded-lg border flex items-start gap-3', style.bg)}
    >
      <div className={cn('mt-0.5', style.iconColor)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{alert.title}</p>
        <p className="text-sm text-muted-foreground">{alert.description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{alert.time}</span>
          {alert.action && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAction}>
              {alert.action.label}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function AlertsWidget() {
  const { data: alerts = [], isLoading } = useActiveAlerts();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4, ease: [0.22, 0.9, 0.32, 1] }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Alertas Críticos</h3>
        {!isLoading && (
          <span className="text-sm text-muted-foreground">{alerts.length} pendentes</span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Verificando alertas...</span>
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <span className="text-sm">Nenhum alerta crítico no momento</span>
        </div>
      )}

      {!isLoading && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <AlertItem key={alert.id} alert={alert} index={index} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
