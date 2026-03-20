/**
 * Component: LoadCompositionCard
 * Individual suggestion card for LoadCompositionPanel / Overlay
 * Shows consolidation opportunity with route-fit evaluation, score, savings, and action buttons
 */

import {
  LoadCompositionSuggestionWithDetails,
  type TriggerSource,
} from '@/hooks/useLoadCompositionSuggestions';
import { formatCurrencyFromCents } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  TrendingDown,
  DollarSign,
  Loader,
  Route,
  Zap,
  Clock,
  Hand,
  Globe,
  Calculator,
} from 'lucide-react';

export interface LoadCompositionCardProps {
  suggestion: LoadCompositionSuggestionWithDetails;
  onApprove?: (compositionId: string) => void;
  onView?: (compositionId: string) => void;
  onCalculateDiscounts?: (compositionId: string) => void;
  isApproving?: boolean;
  isCalculatingDiscounts?: boolean;
  compact?: boolean;
}

const statusConfig = {
  pending: { label: 'Pendente', variant: 'secondary' as const },
  approved: { label: 'Aprovado', variant: 'default' as const },
  rejected: { label: 'Rejeitado', variant: 'destructive' as const },
  executed: { label: 'Executado', variant: 'outline' as const },
};

const triggerConfig: Record<TriggerSource, { label: string; icon: typeof Zap }> = {
  batch: { label: 'Batch', icon: Clock },
  on_save: { label: 'Auto', icon: Zap },
  manual: { label: 'Manual', icon: Hand },
};

const routeModelConfig: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  webrouter_v1: {
    label: 'Rota real',
    icon: Globe,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  stored_km_v1: {
    label: 'Estimativa',
    icon: Calculator,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
};

function RouteModelBadge({ model }: { model: string | null | undefined }) {
  if (!model || model === 'mock_v1' || model === 'insufficient_data') return null;
  const config = routeModelConfig[model];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-0.5 ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LoadCompositionCard({
  suggestion,
  onApprove,
  onView,
  onCalculateDiscounts,
  isApproving = false,
  isCalculatingDiscounts = false,
  compact = false,
}: LoadCompositionCardProps) {
  const status = statusConfig[suggestion.status];
  const trigger = triggerConfig[suggestion.trigger_source ?? 'batch'];
  const TriggerIcon = trigger.icon;
  const isExecutable = suggestion.status === 'pending' && suggestion.is_feasible;
  const hasDiscounts = suggestion.discounts && suggestion.discounts.length > 0;

  if (compact) {
    return (
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm truncate">
                {suggestion.quote_ids.length} cargas
              </span>
              <Badge variant={status.variant} className="shrink-0">
                {status.label}
              </Badge>
              <Badge variant="outline" className="shrink-0 text-[10px] gap-0.5">
                <TriggerIcon className="w-3 h-3" />
                {trigger.label}
              </Badge>
              {suggestion.is_feasible ? (
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold text-green-600">
                {formatCurrencyFromCents(suggestion.estimated_savings_brl)}
              </div>
              {suggestion.delta_km_percent != null && (
                <div className="text-xs text-muted-foreground">
                  +{suggestion.delta_km_percent.toFixed(1)}% km
                </div>
              )}
            </div>
          </div>

          {/* Technical explanation */}
          {suggestion.technical_explanation && (
            <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
              {suggestion.technical_explanation}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onView?.(suggestion.id)}
            >
              Detalhes
            </Button>
            {suggestion.status === 'pending' && !hasDiscounts && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1"
                onClick={() => onCalculateDiscounts?.(suggestion.id)}
                disabled={isCalculatingDiscounts}
              >
                {isCalculatingDiscounts ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <DollarSign className="w-3 h-3" />
                )}
                Descontos
              </Button>
            )}
            {isExecutable && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => onApprove?.(suggestion.id)}
                disabled={isApproving}
              >
                {isApproving ? 'Aprovando...' : 'Aprovar'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full card
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm">
                {suggestion.quote_ids.length} cargas consolidadas
              </span>
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant="outline" className="text-[10px] gap-0.5">
                <TriggerIcon className="w-3 h-3" />
                {trigger.label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span>Criado {formatDate(suggestion.created_at)}</span>
              <RouteModelBadge model={suggestion.route_evaluation_model} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-blue-600">
              {suggestion.consolidation_score.toFixed(0)}%
            </div>
            <div className="text-[10px] text-muted-foreground">Viabilidade</div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 p-2 rounded border border-green-100">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown className="w-3 h-3 text-green-600" />
              <span className="text-[10px] font-medium text-muted-foreground">Economia</span>
            </div>
            <div className="text-sm font-bold text-green-700">
              {formatCurrencyFromCents(suggestion.estimated_savings_brl)}
            </div>
          </div>

          <div className="bg-blue-50 p-2 rounded border border-blue-100">
            <div className="flex items-center gap-1 mb-0.5">
              <Route className="w-3 h-3 text-blue-600" />
              <span className="text-[10px] font-medium text-muted-foreground">Delta km</span>
            </div>
            <div className="text-sm font-bold text-blue-700">
              {suggestion.delta_km_percent != null
                ? `+${suggestion.delta_km_percent.toFixed(1)}%`
                : `+${suggestion.distance_increase_percent.toFixed(1)}%`}
            </div>
            {suggestion.delta_km_abs != null && (
              <div className="text-[10px] text-muted-foreground">
                +{suggestion.delta_km_abs.toFixed(0)}km
              </div>
            )}
          </div>

          <div className="bg-purple-50 p-2 rounded border border-purple-100">
            <div className="flex items-center gap-1 mb-0.5">
              <MapPin className="w-3 h-3 text-purple-600" />
              <span className="text-[10px] font-medium text-muted-foreground">Rota</span>
            </div>
            <div className="text-sm font-bold text-purple-700">
              {suggestion.composed_km_total != null
                ? `${suggestion.composed_km_total.toFixed(0)}km`
                : '—'}
            </div>
            {suggestion.base_km_total != null && (
              <div className="text-[10px] text-muted-foreground">
                vs {suggestion.base_km_total.toFixed(0)}km sep.
              </div>
            )}
          </div>
        </div>

        {/* Technical explanation */}
        {suggestion.technical_explanation && (
          <div className="bg-slate-50 border border-slate-200 rounded p-2">
            <p className="text-xs text-slate-700 leading-relaxed">
              {suggestion.technical_explanation}
            </p>
          </div>
        )}

        {/* Warnings */}
        {suggestion.validation_warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-xs text-yellow-800 space-y-0.5">
                {suggestion.validation_warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feasibility + Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {suggestion.is_feasible ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Viável</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Não viável</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onView?.(suggestion.id)}
            >
              Detalhes
            </Button>
            {suggestion.status === 'pending' && !hasDiscounts && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1"
                onClick={() => onCalculateDiscounts?.(suggestion.id)}
                disabled={isCalculatingDiscounts}
              >
                {isCalculatingDiscounts ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <DollarSign className="w-3 h-3" />
                )}
                Descontos
              </Button>
            )}
            {isExecutable && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => onApprove?.(suggestion.id)}
                disabled={isApproving}
              >
                {isApproving ? 'Aprovando...' : 'Aprovar'}
              </Button>
            )}
            {hasDiscounts && suggestion.status === 'pending' && (
              <Badge className="bg-green-100 text-green-800 text-[10px] gap-0.5">
                <DollarSign className="w-3 h-3" />
                Descontos OK
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
