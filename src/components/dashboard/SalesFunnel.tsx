import { motion } from 'framer-motion';
import { useSalesFunnel } from '@/hooks/useAdvancedDashboardStats';
import { Loader2 } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function SalesFunnel() {
  const { data: funnelData, isLoading } = useSalesFunnel();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Vendas</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border shadow-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-6">Funil de Vendas</h3>
      <div className="space-y-4">
        {funnelData?.map((stage, index) => {
          const pct = Math.max(0, Math.min(100, stage.percentage ?? 0));
          return (
            <motion.div
              key={stage.stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{stage.count} cotações</span>
                  <span className="text-sm font-medium text-primary">
                    {formatCurrency(stage.value)}
                  </span>
                </div>
              </div>
              <div className="h-8 bg-muted rounded-lg overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-lg flex items-center justify-end pr-3"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  {pct > 20 && (
                    <span className="text-xs font-medium text-primary-foreground">{pct}%</span>
                  )}
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
