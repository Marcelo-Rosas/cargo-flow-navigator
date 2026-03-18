/**
 * Component: LoadCompositionCard
 * Individual suggestion card for display in LoadCompositionPanel
 * Shows consolidation opportunity with score, savings, and action buttons
 */

import React from 'react';
import { LoadCompositionSuggestionWithDetails } from '@/hooks/useLoadCompositionSuggestions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, MapPin, TrendingDown, DollarSign, Loader } from 'lucide-react';

export interface LoadCompositionCardProps {
  suggestion: LoadCompositionSuggestionWithDetails;
  onApprove?: (compositionId: string) => void;
  onView?: (compositionId: string) => void;
  onCalculateDiscounts?: (compositionId: string) => void;
  isApproving?: boolean;
  isCalculatingDiscounts?: boolean;
}

const statusConfig = {
  pending: { label: 'Pendente', variant: 'secondary' as const, color: 'text-yellow-600' },
  approved: { label: 'Aprovado', variant: 'default' as const, color: 'text-green-600' },
  rejected: { label: 'Rejeitado', variant: 'destructive' as const, color: 'text-red-600' },
  executed: { label: 'Executado', variant: 'outline' as const, color: 'text-blue-600' },
};

export function LoadCompositionCard({
  suggestion,
  onApprove,
  onView,
  onCalculateDiscounts,
  isApproving = false,
  isCalculatingDiscounts = false,
}: LoadCompositionCardProps) {
  const savingsBRL = suggestion.estimated_savings_brl / 100; // Convert from centavos to BRL
  const status = statusConfig[suggestion.status];
  const isExecutable = suggestion.status === 'pending' && suggestion.is_feasible;
  const hasDiscounts = suggestion.discounts && suggestion.discounts.length > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base">
                {suggestion.quote_ids.length} cargas consolidadas
              </CardTitle>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <CardDescription className="text-xs text-gray-500">
              ID: {suggestion.id.slice(0, 8)}... • Criado {formatDate(suggestion.created_at)}
            </CardDescription>
          </div>

          {/* Score Badge */}
          <div className="text-right">
            <div className="text-sm font-semibold text-blue-600">
              {suggestion.consolidation_score.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">Viabilidade</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Savings */}
          <div className="bg-green-50 p-3 rounded border border-green-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-gray-600">Economia</span>
            </div>
            <div className="text-base font-bold text-green-700">
              R$ {savingsBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Distance Impact */}
          <div className="bg-blue-50 p-3 rounded border border-blue-100">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-600">Distância +</span>
            </div>
            <div className="text-base font-bold text-blue-700">
              {suggestion.distance_increase_percent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Validation Warnings */}
        {suggestion.validation_warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs">
                {suggestion.validation_warnings.map((warning, idx) => (
                  <div key={idx} className="text-yellow-800 mb-1">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feasibility Status */}
        <div className="flex items-center gap-2">
          {suggestion.is_feasible ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">Consolidação viável</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">Não viável no momento</span>
            </>
          )}
        </div>

        {/* Approval Status */}
        {suggestion.status === 'approved' && suggestion.approved_by && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <div className="text-xs text-blue-700">
              Aprovado em {formatDate(suggestion.approved_at || suggestion.created_at)}
            </div>
          </div>
        )}

        {suggestion.status === 'executed' && suggestion.created_order_id && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2">
            <div className="text-xs text-green-700">
              Ordem criada: {suggestion.created_order_id.slice(0, 8)}...
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onView?.(suggestion.id)}>
            Detalhes
          </Button>

          {/* Discount Calculation Button */}
          {suggestion.status === 'pending' && !hasDiscounts && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onCalculateDiscounts?.(suggestion.id)}
              disabled={isCalculatingDiscounts}
              className="gap-1"
            >
              {isCalculatingDiscounts ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <DollarSign className="w-3 h-3" />
                  Descontos
                </>
              )}
            </Button>
          )}

          {/* Approval Button */}
          {isExecutable && (
            <Button size="sm" onClick={() => onApprove?.(suggestion.id)} disabled={isApproving}>
              {isApproving ? 'Aprovando...' : 'Aprovar'}
            </Button>
          )}

          {/* View Discounts Badge (if already calculated) */}
          {hasDiscounts && suggestion.status === 'pending' && (
            <Badge className="bg-green-100 text-green-800 flex items-center justify-center gap-1 py-1">
              <DollarSign className="w-3 h-3" />
              Descontos OK
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format date to PT-BR locale
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
