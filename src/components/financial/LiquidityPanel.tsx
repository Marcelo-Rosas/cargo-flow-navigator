import { Droplets, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLiquidityIndicators } from '@/hooks/useLiquidityIndicators';
import {
  getLiquidityStatusLabel,
  getLiquidityStatusBadgeVariant,
  getLiquidityStatusColor,
} from '@/lib/financialLiquidity';
import { formatCurrency } from '@/lib/formatters';

interface IndicatorCardProps {
  title: string;
  value: number;
  status: number;
  description: string;
}

function IndicatorCard({ title, value, status, description }: IndicatorCardProps) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Badge variant={getLiquidityStatusBadgeVariant(status)} className="text-xs">
            {getLiquidityStatusLabel(status)}
          </Badge>
        </div>
        <p className={`text-3xl font-bold tabular-nums ${getLiquidityStatusColor(status)}`}>
          {value.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function LiquiditySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function LiquidityPanel() {
  const { result, isLoading } = useLiquidityIndicators();

  if (isLoading) {
    return <LiquiditySkeleton />;
  }

  if (!result) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground opacity-40" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Erro ao carregar indicadores</p>
            <p className="text-sm text-muted-foreground">
              Não foi possível calcular os indicadores de liquidez.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const indicators = [
    {
      title: 'Liquidez Corrente',
      value: result.liquidezCorrente,
      status: result.statusCorrente,
      description:
        'Ativo circulante (parcelas a receber em até 12 meses) ÷ Passivo circulante (parcelas a pagar em até 12 meses). Ideal: ≥ 1,5.',
    },
    {
      title: 'Liquidez Seca',
      value: result.liquidezSeca,
      status: result.statusSeca,
      description:
        'Como a Vectra não trabalha com estoque, equivale à liquidez corrente. Mede a capacidade de honrar compromissos sem depender de estoque.',
    },
    {
      title: 'Liquidez Imediata',
      value: result.liquidezImediata,
      status: result.statusImediata,
      description:
        'Ativo imediato (parcelas a receber em até 30 dias) ÷ Passivo circulante. Mede a capacidade de pagar dívidas de curto prazo com recursos imediatos.',
    },
  ] as const;

  const allGood = indicators.every((i) => i.status >= 1.5);
  const hasAlert = indicators.some((i) => i.status < 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Droplets className="w-6 h-6 text-blue-500" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Indicadores de Liquidez</h2>
          <p className="text-sm text-muted-foreground">
            Saúde financeira de curto prazo baseada em parcelas pendentes
          </p>
        </div>
      </div>

      {/* Alert summary */}
      {allGood && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">Situação financeira saudável.</span> Todos os indicadores
          estão acima do nível adequado.
        </div>
      )}
      {hasAlert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium">Atenção:</span> pelo menos um indicador está abaixo de 1,0,
          indicando risco de insolvência de curto prazo.
        </div>
      )}

      {/* Indicator cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indicators.map((ind) => (
          <IndicatorCard
            key={ind.title}
            title={ind.title}
            value={ind.value}
            status={ind.status}
            description={ind.description}
          />
        ))}
      </div>

      {/* Interpretation guide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            Como interpretar
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-green-600 dark:text-green-400">≥ 1,5 — Ótima/Boa</p>
              <p className="text-muted-foreground">
                A empresa tem folga confortável para honrar compromissos de curto prazo.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-yellow-600 dark:text-yellow-400">
                1,0 a 1,5 — Adequada
              </p>
              <p className="text-muted-foreground">
                Situação aceitável, mas sem margem de segurança ampla. Monitorar.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-red-600 dark:text-red-400">&lt; 1,0 — Alerta</p>
              <p className="text-muted-foreground">
                O passivo circulante supera o ativo disponível. Risco de dificuldade para pagar
                fornecedores.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-muted-foreground">Metodologia</p>
              <p className="text-muted-foreground">
                Baseado exclusivamente em parcelas pendentes dos documentos financeiros (FAT/PAG),
                considerando o horizonte de 12 meses para corrente/sec e 30 dias para imediata.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
