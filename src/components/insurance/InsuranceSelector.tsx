import { memo, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { InsuranceOption } from '@/hooks/useInsuranceOptions';

interface InsuranceSelectorProps {
  options: InsuranceOption[];
  selectedCoverage?: string;
  onSelectCoverage: (coverage: string) => void;
  loading?: boolean;
  error?: string;
}

/**
 * Memoized insurance option selector component
 * Phase D Optimization: Wrapped with React.memo to prevent unnecessary re-renders
 * when parent re-renders but props (options, selectedCoverage, etc.) remain unchanged
 *
 * Memoization benefit: Avoids re-rendering 3 large TabsContent sections when
 * form state changes but insurance options haven't changed
 */
function InsuranceSelectorComponent({
  options,
  selectedCoverage,
  onSelectCoverage,
  loading = false,
  error,
}: InsuranceSelectorProps) {
  // Memoize rendered tabs - prevents recalculating style/layout on every render
  const tabsList = useMemo(
    () =>
      options.map((option) => {
        const isSelected = selectedCoverage === option.coverage_type;
        const isStandard = option.coverage_type === 'STANDARD';

        return (
          <TabsTrigger
            key={option.coverage_type}
            value={option.coverage_type}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-muted bg-muted/50 hover:border-primary/50'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">{option.coverage_type}</span>
              {isStandard && <Badge className="text-[10px]">⭐ Recomendado</Badge>}
            </div>
            <span className="text-sm font-medium text-primary">
              {formatCurrency(option.estimated_premium)}
            </span>
          </TabsTrigger>
        );
      }),
    [options, selectedCoverage]
  );

  // Memoize content tabs - prevents recalculating features/restrictions layout
  const contentTabs = useMemo(
    () =>
      options.map((option) => (
        <TabsContent key={option.coverage_type} value={option.coverage_type} className="mt-6">
          <div className="space-y-4">
            {/* Features */}
            <div>
              <h4 className="font-medium text-sm mb-3 text-foreground">Incluso na cobertura:</h4>
              <ul className="space-y-2">
                {option.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Restrictions */}
            {option.restrictions && option.restrictions.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3 text-foreground">Limitações:</h4>
                <ul className="space-y-2">
                  {option.restrictions.map((restriction, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
                    >
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{restriction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Price Summary */}
            <div className="bg-muted p-3 rounded-lg mt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Prêmio Estimado:</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(option.estimated_premium)}/viagem
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Estimativa sujeita a confirmação pela Buonny
              </p>
            </div>
          </div>
        </TabsContent>
      )),
    [options]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Carregando opções...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (options.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Nenhuma opção de seguro disponível para esta rota.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Tabs value={selectedCoverage || ''} onValueChange={onSelectCoverage} className="w-full">
      <TabsList className="grid w-full grid-cols-3 gap-2 h-auto bg-transparent p-0">
        {tabsList}
      </TabsList>
      {contentTabs}
    </Tabs>
  );
}

/**
 * Exported memoized component
 * Only re-renders when one of the props actually changes (shallow comparison)
 */
export const InsuranceSelector = memo(InsuranceSelectorComponent);
