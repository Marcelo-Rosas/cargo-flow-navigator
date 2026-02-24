import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  DollarSign,
  Cpu,
  AlertTriangle,
  Settings,
  TrendingUp,
  Zap,
  Database,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAiUsageStats } from '@/hooks/useAiUsageStats';
import { useAiBudgetConfig, useUpdateBudgetConfig } from '@/hooks/useAiBudgetConfig';

// ─────────────────────────────────────────────────────
// Budget Settings Dialog
// ─────────────────────────────────────────────────────

function BudgetSettingsDialog() {
  const { data: configs = [] } = useAiBudgetConfig();
  const updateConfig = useUpdateBudgetConfig();
  const [values, setValues] = useState<Record<string, string>>({});

  const getConfigValue = (key: string): string => {
    if (values[key] !== undefined) return values[key];
    const config = configs.find((c) => c.key === key);
    return config ? String(config.value) : '';
  };

  const handleSave = (key: string) => {
    const val = parseFloat(values[key] || '0');
    if (!isNaN(val) && val >= 0) {
      updateConfig.mutate({ key, value: val });
      setValues((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const configLabels: Record<string, string> = {
    daily_limit_usd: 'Limite diário (USD)',
    monthly_limit_usd: 'Limite mensal (USD)',
    alert_threshold_pct: 'Alerta em (% do budget)',
    min_quote_value_brl: 'Valor mín. cotação para AI (BRL)',
    min_financial_value_brl: 'Valor mín. doc financeiro para AI (BRL)',
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Configuração de Budget AI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {configs.map((config) => (
            <div key={config.key} className="space-y-1.5">
              <Label className="text-xs font-medium">
                {configLabels[config.key] || config.key}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={String(config.value)}
                  value={getConfigValue(config.key)}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [config.key]: e.target.value }))
                  }
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => handleSave(config.key)}
                  disabled={updateConfig.isPending || !values[config.key]}
                >
                  Salvar
                </Button>
              </div>
              {config.description && (
                <p className="text-[10px] text-muted-foreground">{config.description}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────
// Usage Gauge
// ─────────────────────────────────────────────────────

function UsageGauge({
  label,
  current,
  limit,
  icon: Icon,
}: {
  label: string;
  current: number;
  limit: number;
  icon: typeof DollarSign;
}) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span
          className={`text-xs font-mono ${
            isDanger ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-muted-foreground'
          }`}
        >
          ${current.toFixed(4)} / ${limit.toFixed(2)}
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-1.5 ${isDanger ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-amber-500' : ''}`}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Model Distribution
// ─────────────────────────────────────────────────────

function ModelDistribution({
  stats,
}: {
  stats: Array<{ model_used: string; calls: number; total_cost: number }> | null;
}) {
  if (!stats || stats.length === 0) return null;

  const modelLabels: Record<string, { name: string; color: string }> = {
    'claude-sonnet-4-20250514': { name: 'Sonnet', color: 'bg-violet-500' },
    'claude-haiku-4-5-20250514': { name: 'Haiku', color: 'bg-cyan-500' },
    cache: { name: 'Cache', color: 'bg-green-500' },
    none: { name: 'Skipped', color: 'bg-gray-400' },
  };

  const total = stats.reduce((sum, s) => sum + s.calls, 0);

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">Modelo (hoje)</span>
      <div className="flex gap-1 h-2 rounded-full overflow-hidden">
        {stats.map((s) => {
          const info = modelLabels[s.model_used] || { name: s.model_used, color: 'bg-gray-400' };
          const pct = total > 0 ? (s.calls / total) * 100 : 0;
          return (
            <div
              key={s.model_used}
              className={`${info.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${info.name}: ${s.calls} chamadas ($${s.total_cost.toFixed(4)})`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {stats.map((s) => {
          const info = modelLabels[s.model_used] || { name: s.model_used, color: 'bg-gray-400' };
          return (
            <div key={s.model_used} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${info.color}`} />
              <span className="text-[10px] text-muted-foreground">
                {info.name}: {s.calls}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main Widget
// ─────────────────────────────────────────────────────

export function AiUsageDashboard() {
  const { data: stats, isLoading } = useAiUsageStats();

  if (isLoading || !stats) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="p-5 rounded-xl border bg-card shadow-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold">Uso da AI</h3>
        </div>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Clock className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Carregando...</span>
        </div>
      </motion.div>
    );
  }

  const dailySpend = Number(stats.daily_spend) || 0;
  const monthlySpend = Number(stats.monthly_spend) || 0;
  const dailyLimit = Number(stats.daily_limit) || 2;
  const monthlyLimit = Number(stats.monthly_limit) || 30;
  const alertThreshold = Number(stats.alert_threshold) || 0.8;
  const isAlert = dailySpend / dailyLimit >= alertThreshold || monthlySpend / monthlyLimit >= alertThreshold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="p-5 rounded-xl border bg-card shadow-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold">Uso da AI</h3>
          {isAlert && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              Alerta
            </Badge>
          )}
        </div>
        <BudgetSettingsDialog />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <Zap className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
          <p className="text-lg font-bold tabular-nums">{stats.today_calls}</p>
          <p className="text-[10px] text-muted-foreground">Hoje</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <TrendingUp className="w-3.5 h-3.5 mx-auto mb-1 text-violet-500" />
          <p className="text-lg font-bold tabular-nums">{stats.month_calls}</p>
          <p className="text-[10px] text-muted-foreground">Mês</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <DollarSign className="w-3.5 h-3.5 mx-auto mb-1 text-emerald-500" />
          <p className="text-lg font-bold tabular-nums">${monthlySpend.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Custo mês</p>
        </div>
      </div>

      {/* Budget gauges */}
      <div className="space-y-3 mb-4">
        <UsageGauge label="Diário" current={dailySpend} limit={dailyLimit} icon={Cpu} />
        <UsageGauge label="Mensal" current={monthlySpend} limit={monthlyLimit} icon={Database} />
      </div>

      {/* Model distribution */}
      <ModelDistribution stats={stats.today_by_model} />

      {/* Recent errors */}
      {stats.recent_errors && stats.recent_errors.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 mb-2">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-xs font-medium text-red-600">Erros recentes</span>
          </div>
          <div className="space-y-1 max-h-[80px] overflow-y-auto">
            {stats.recent_errors.slice(0, 3).map((err, i) => (
              <p key={i} className="text-[10px] text-muted-foreground truncate">
                {err.status}: {err.analysis_type} — {err.error_message || 'sem detalhes'}
              </p>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
