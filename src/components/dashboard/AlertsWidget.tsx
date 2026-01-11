import { motion } from 'framer-motion';
import { AlertTriangle, FileWarning, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  time: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AlertsWidgetProps {
  alerts?: Alert[];
}

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'Documento Vencido',
    description: 'CT-e da OS-2024-0002 pendente há 48h',
    time: 'Agora',
    action: {
      label: 'Resolver',
      onClick: () => {},
    },
  },
  {
    id: '2',
    type: 'warning',
    title: 'Atraso na Entrega',
    description: 'OS-2024-0003 ultrapassou ETA previsto',
    time: 'Há 2h',
    action: {
      label: 'Ver OS',
      onClick: () => {},
    },
  },
  {
    id: '3',
    type: 'info',
    title: 'Comprovante Pendente',
    description: '3 entregas aguardando upload de canhoto',
    time: 'Hoje',
    action: {
      label: 'Verificar',
      onClick: () => {},
    },
  },
];

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

export function AlertsWidget({ alerts = mockAlerts }: AlertsWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4, ease: [0.22, 0.9, 0.32, 1] }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Alertas Críticos</h3>
        <span className="text-sm text-muted-foreground">{alerts.length} pendentes</span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const style = alertStyles[alert.type];
          const Icon = style.icon;

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 * index }}
              className={cn(
                "p-4 rounded-lg border flex items-start gap-3",
                style.bg
              )}
            >
              <div className={cn("mt-0.5", style.iconColor)}>
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{alert.time}</span>
                  {alert.action && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={alert.action.onClick}
                    >
                      {alert.action.label}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
