import { TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

interface ConditionalFee {
  id: string;
  name: string;
  code: string;
}

interface QuoteModalCostCompositionTabProps {
  breakdown: StoredPricingBreakdown | null;
  isSimplesNacional: boolean;
  pisoAnttTotal: number;
  custosDescarga: number;
  conditionalFeesData?: ConditionalFee[] | null;
  margemBruta: number;
  overhead: number;
  resultadoLiquido: number;
  margemPercent: number;
  isBelowTarget: boolean;
  /** Margem alvo % usada no cálculo (ex.: pricing_rules_config.profit_margin_percent) */
  targetMarginPercent?: number;
  canManage: boolean;
  axesCount: number | null;
  kmDistance: number | null;
  anttRateCcd?: number | null;
  anttRateCc?: number | null;
  hasAnttCalc: boolean;
  onSaveAntt?: () => Promise<void>;
}

export function QuoteModalCostCompositionTab({
  breakdown,
  isSimplesNacional,
  pisoAnttTotal,
  custosDescarga,
  conditionalFeesData,
  margemBruta,
  overhead,
  resultadoLiquido,
  margemPercent,
  isBelowTarget,
  targetMarginPercent = 15,
  canManage,
  axesCount,
  kmDistance,
  anttRateCcd,
  anttRateCc,
  hasAnttCalc,
  onSaveAntt,
}: QuoteModalCostCompositionTabProps) {
  if (!breakdown?.totals) {
    return <p className="text-sm text-muted-foreground">Nenhuma memória de cálculo disponível.</p>;
  }

  const hasFees =
    Object.keys(breakdown.conditionalFeesBreakdown ?? {}).filter(
      (k) => (breakdown.conditionalFeesBreakdown as Record<string, number>)[k] > 0
    ).length > 0 || (breakdown.components?.waitingTimeCost ?? 0) > 0;

  const totalCliente = breakdown.totals.totalCliente ?? breakdown.totals.receitaBruta ?? 0;
  const receitaLiquida =
    (breakdown.profitability as { receitaLiquida?: number } | undefined)?.receitaLiquida ??
    totalCliente - (breakdown.totals.das ?? 0) - (breakdown.totals.icms ?? 0);
  const regimeFiscal = (
    breakdown.profitability as {
      regimeFiscal?: 'simples_nacional' | 'excesso_sublimite' | 'normal';
    }
  )?.regimeFiscal;
  const custoEfetivoMotorista = breakdown.components?.baseCost ?? 0;
  const pedagio = breakdown.components?.toll ?? 0;
  const grisValue = breakdown.components?.gris ?? 0;
  const tsoValue = breakdown.components?.tso ?? 0;
  const rctrcValue = breakdown.components?.rctrc ?? 0;
  const tdeValue = breakdown.components?.tde ?? 0;
  const tearValue = breakdown.components?.tear ?? 0;
  const dispatchFeeValue = breakdown.components?.dispatchFee ?? 0;
  const aluguelMaquinasValue = breakdown.components?.aluguelMaquinas ?? 0;

  const composicaoRows: { label: string; value: number }[] = [];
  if (breakdown.components) {
    if ((breakdown.components.baseFreight ?? 0) > 0)
      composicaoRows.push({ label: 'Frete Base', value: breakdown.components.baseFreight ?? 0 });
    if ((breakdown.components.toll ?? 0) > 0)
      composicaoRows.push({ label: 'Pedágio', value: breakdown.components.toll ?? 0 });
    if ((breakdown.components.aluguelMaquinas ?? 0) > 0)
      composicaoRows.push({
        label: 'Aluguel de Máquinas',
        value: breakdown.components.aluguelMaquinas ?? 0,
      });
    if ((breakdown.components.rctrc ?? 0) > 0)
      composicaoRows.push({
        label: `RCTR-C (${breakdown.rates?.costValuePercent?.toFixed(2) ?? 0}%)`,
        value: breakdown.components.rctrc ?? 0,
      });
    if ((breakdown.components.gris ?? 0) > 0)
      composicaoRows.push({
        label: `GRIS (${breakdown.rates?.grisPercent?.toFixed(2) ?? 0}%)`,
        value: breakdown.components.gris ?? 0,
      });
    if ((breakdown.components.tso ?? 0) > 0)
      composicaoRows.push({
        label: `TSO (${breakdown.rates?.tsoPercent?.toFixed(2) ?? 0}%)`,
        value: breakdown.components.tso ?? 0,
      });
    if ((breakdown.components.tde ?? 0) > 0)
      composicaoRows.push({ label: 'TDE (NTC)', value: breakdown.components.tde ?? 0 });
    if ((breakdown.components.tear ?? 0) > 0)
      composicaoRows.push({ label: 'TEAR (NTC)', value: breakdown.components.tear ?? 0 });
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="memoria" className="w-full">
        <TabsList
          className={cn('grid w-full', hasFees ? 'grid-cols-4' : 'grid-cols-3', 'overflow-x-auto')}
        >
          <TabsTrigger value="memoria">Memória</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          {hasFees && <TabsTrigger value="taxas">Taxas</TabsTrigger>}
        </TabsList>

        <TabsContent value="memoria" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="text-right font-semibold">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {composicaoRows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell className="text-muted-foreground">{r.label}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(r.value)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Receita Bruta</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(breakdown.totals.receitaBruta || 0)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    Provisionamento DAS ({breakdown.rates?.dasPercent?.toFixed(2) ?? 0}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(breakdown.totals.das || 0)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">
                    ICMS (
                    {isSimplesNacional ? '0' : (breakdown.rates?.icmsPercent?.toFixed(2) ?? 0)}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(isSimplesNacional ? 0 : breakdown.totals.icms || 0)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-primary/5">
                  <TableCell className="font-semibold text-primary">Total Cliente</TableCell>
                  <TableCell className="text-right font-bold text-primary tabular-nums">
                    {formatCurrency(totalCliente)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="mt-4 space-y-4">
          {regimeFiscal && (
            <Alert
              className={cn(
                'mb-4',
                regimeFiscal === 'excesso_sublimite'
                  ? 'bg-warning/10 border-warning/20'
                  : 'bg-primary/10 border-primary/20'
              )}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Regime Fiscal Aplicado</AlertTitle>
              <AlertDescription>
                {regimeFiscal === 'simples_nacional' &&
                  'Simples Nacional: ICMS incluído na DAS (não soma ao divisor Gross-up).'}
                {regimeFiscal === 'excesso_sublimite' &&
                  'Excesso de Sublimite: ICMS calculado separadamente (Cálculo por Dentro).'}
                {regimeFiscal === 'normal' && 'Regime Normal: ICMS sempre separado.'}
              </AlertDescription>
            </Alert>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="text-right font-semibold">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-primary/5">
                  <TableCell className="font-semibold text-primary">
                    (+) Faturamento Bruto (Total Cliente)
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-primary">
                    {formatCurrency(totalCliente)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/10">
                  <TableCell className="font-semibold">(-) Impostos</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8 text-muted-foreground">
                    • DAS {regimeFiscal === 'excesso_sublimite' ? 'Federal ' : ''}(
                    {breakdown.rates?.dasPercent?.toFixed(2) ?? 0}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    -{formatCurrency(breakdown.totals.das ?? 0)}
                  </TableCell>
                </TableRow>
                {regimeFiscal !== 'simples_nacional' && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • ICMS Estadual ({breakdown.rates?.icmsPercent?.toFixed(2) ?? 0}%)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(breakdown.totals.icms ?? 0)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t bg-muted/30">
                  <TableCell className="font-semibold">(=) Receita Líquida</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(receitaLiquida)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">
                    (-) Overhead ({breakdown.rates?.overheadPercent?.toFixed(2) ?? 0}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    -{formatCurrency(overhead)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/10">
                  <TableCell className="font-semibold">(-) Custo Repasse (Motorista)</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8 text-muted-foreground">
                    • Custo Motorista (Frete Base)
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    -{formatCurrency(custoEfetivoMotorista)}
                  </TableCell>
                </TableRow>
                {pedagio > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• Pedágio</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(pedagio)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-muted/10">
                  <TableCell className="font-semibold">
                    (-) Custos Variáveis de Risco (s/ NF)
                  </TableCell>
                  <TableCell />
                </TableRow>
                {grisValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • GRIS ({breakdown.rates?.grisPercent?.toFixed(2) ?? 0}%)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(grisValue)}
                    </TableCell>
                  </TableRow>
                )}
                {tsoValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • TSO ({breakdown.rates?.tsoPercent?.toFixed(2) ?? 0}%)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(tsoValue)}
                    </TableCell>
                  </TableRow>
                )}
                {rctrcValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • RCTR-C ({breakdown.rates?.costValuePercent?.toFixed(2) ?? 0}%)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(rctrcValue)}
                    </TableCell>
                  </TableRow>
                )}
                {tdeValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• TDE (NTC)</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(tdeValue)}
                    </TableCell>
                  </TableRow>
                )}
                {tearValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">• TEAR (NTC)</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(tearValue)}
                    </TableCell>
                  </TableRow>
                )}
                {dispatchFeeValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • Taxa de Despacho (NTC)
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(dispatchFeeValue)}
                    </TableCell>
                  </TableRow>
                )}
                {aluguelMaquinasValue > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      • Aluguel de Máquinas
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      -{formatCurrency(aluguelMaquinasValue)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow
                  className={cn(
                    'border-t-2',
                    resultadoLiquido >= 0
                      ? 'bg-green-500/10 dark:bg-green-500/5'
                      : 'bg-destructive/10'
                  )}
                >
                  <TableCell className="text-lg font-bold">(=) Resultado Líquido</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={resultadoLiquido >= 0 ? 'default' : 'destructive'}
                      className="text-base px-3 py-1"
                    >
                      {formatCurrency(resultadoLiquido)}
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">
                    Resultado Líquido (Mínimo Viável: {targetMarginPercent}%)
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={isBelowTarget ? 'destructive' : 'default'}>
                      {margemPercent.toFixed(2)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {/* Nota de Auditoria Financeira */}
          <div className="mt-6 p-4 rounded-md bg-muted/50 border border-muted-foreground/10">
            <p className="text-[11px] leading-relaxed text-muted-foreground italic">
              <strong>Nota de Auditoria:</strong> O Resultado Líquido exibido foi calculado através
              do modelo{' '}
              <span className="font-semibold text-foreground">Gross-up (Asset-Light)</span>,
              utilizando os parâmetros das Regras de Precificação vigentes no momento da criação
              desta cotação:{' '}
              <span className="font-medium text-foreground">
                Overhead {breakdown.rates?.overheadPercent?.toFixed(2) ?? '—'}%
              </span>
              ,{' '}
              <span className="font-medium text-foreground">
                Margem Alvo {targetMarginPercent?.toFixed(2) ?? '—'}%
              </span>
              . Os custos de risco (GRIS, TSO e RCTR-C) são calculados sobre o{' '}
              <span className="font-medium text-foreground">Valor da Nota Fiscal (Valor NF)</span>{' '}
              conforme tabelas NTC. O &quot;Custo Motorista&quot; corresponde ao{' '}
              <span className="font-medium text-foreground">Frete Base</span> da Memória de Cálculo.
              Para conferência, utilize a calculadora na tela de{' '}
              <span className="underline">Regras de Precificação</span>.
            </p>
          </div>
          {breakdown.meta?.ltlMinWeightApplied && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Trava de 1 Tonelada Aplicada:</strong> Peso real informado foi{' '}
                {breakdown.meta.originalWeightKg} kg, mas o cálculo de custo usou o mínimo de 1.000
                kg para viabilidade operacional do fracionado.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="custos" className="mt-4 space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Custo</TableHead>
                  <TableHead className="text-right font-semibold">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Piso ANTT (carreteiro)</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(pisoAnttTotal)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Carga e Descarga</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(custosDescarga)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {hasAnttCalc && canManage && onSaveAntt && (
            <div className="p-3 rounded-lg bg-muted/30 border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Piso ANTT • Tabela A • Carga Geral
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {axesCount ?? '-'} eixos • {Number(kmDistance ?? 0).toLocaleString('pt-BR')} km
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Memória: ({Number(kmDistance ?? 0).toLocaleString('pt-BR')} ×{' '}
                {Number(anttRateCcd ?? 0).toFixed(4)}) + {Number(anttRateCc ?? 0).toFixed(2)}
              </p>
              <Button variant="outline" size="sm" onClick={onSaveAntt}>
                Salvar no breakdown
              </Button>
            </div>
          )}
          {!hasAnttCalc && (
            <p className="text-xs text-muted-foreground">
              Cadastre CCD/CC em ANTT Floor Rates e selecione veículo + KM.
            </p>
          )}
        </TabsContent>

        {hasFees && (
          <TabsContent value="taxas" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Taxa</TableHead>
                    <TableHead className="text-right font-semibold">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.conditionalFeesBreakdown &&
                    Object.entries(breakdown.conditionalFeesBreakdown).map(([feeId, value]) => {
                      const fee = conditionalFeesData?.find((f) => f.id === feeId);
                      if (!value) return null;
                      return (
                        <TableRow key={feeId}>
                          <TableCell className="text-muted-foreground flex items-center gap-1">
                            {fee ? fee.name : 'Taxa adicional'}
                            {fee && (
                              <Badge variant="outline" className="text-[10px] py-0">
                                {fee.code}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(value as number)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {(breakdown.components?.waitingTimeCost ?? 0) > 0 && (
                    <TableRow>
                      <TableCell className="text-muted-foreground">Estadia / Hora Parada</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(breakdown.components!.waitingTimeCost)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {breakdown.profitability && (
        <div
          className={
            isBelowTarget
              ? 'rounded-lg p-4 border bg-destructive/5 border-destructive/20'
              : 'rounded-lg p-4 border bg-success/5 border-success/20'
          }
        >
          <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <TrendingUp className="w-3.5 h-3.5" />
            Rentabilidade
          </h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margem Bruta</span>
              <span className="font-medium tabular-nums">{formatCurrency(margemBruta)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Overhead</span>
              <span className="font-medium tabular-nums">{formatCurrency(overhead)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold">Resultado Líquido</span>
              <Badge
                variant={resultadoLiquido >= 0 ? 'default' : 'destructive'}
                className={resultadoLiquido >= 0 ? 'bg-success text-success-foreground' : ''}
              >
                {formatCurrency(resultadoLiquido)}
              </Badge>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold">Margem %</span>
              <Badge
                variant={isBelowTarget ? 'destructive' : 'default'}
                className={!isBelowTarget ? 'bg-success text-success-foreground' : ''}
              >
                {margemPercent.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
