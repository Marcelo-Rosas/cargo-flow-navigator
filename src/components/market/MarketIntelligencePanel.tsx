import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Zap, RefreshCw, Fuel } from 'lucide-react';
import { useMarketInsights, getAlertStyles } from '@/hooks/useMarketInsights';
import { usePetrobrasDiesel } from '@/hooks/usePetrobrasDiesel';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

export function MarketIntelligencePanel() {
  const { data: insights, isLoading, isError, error } = useMarketInsights();
  const {
    data: petrobras,
    isLoading: petrobrasLoading,
    refresh: refreshPetrobras,
  } = usePetrobrasDiesel('BR');
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Card Diesel Petrobras — renderiza independente do market-insights
  const dieselPetrobrasCard = (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-600" />
            Diesel Petrobras
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await refreshPetrobras();
              } finally {
                setRefreshing(false);
              }
            }}
            title="Atualizar preço da Petrobras"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Badge variant="outline" className="text-[10px] w-fit text-blue-600 border-blue-300">
          Atualização diária
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {petrobrasLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : petrobras ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Preço Médio Brasil</p>
              <p className="text-2xl font-semibold text-primary">
                R$ {petrobras.preco_medio.toFixed(2).replace('.', ',')}/L
              </p>
            </div>
            {petrobras.variacao_pct != null && (
              <div>
                <p className="text-xs text-muted-foreground">Variação vs anterior</p>
                <p
                  className={`text-lg font-medium ${petrobras.variacao_pct >= 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {petrobras.variacao_pct >= 0 ? '+' : ''}
                  {petrobras.variacao_pct.toFixed(2)}%
                </p>
              </div>
            )}
            {petrobras.periodo_coleta && (
              <p className="text-[10px] text-muted-foreground">
                Coleta: {petrobras.periodo_coleta}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sem dados. Clique em atualizar.</p>
        )}
      </CardContent>
    </Card>
  );

  if (isError || !insights) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Erro ao Carregar Dados NTC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : 'Falha ao buscar dados de inteligência de mercado'}
            </p>
          </CardContent>
        </Card>
        {dieselPetrobrasCard}
      </div>
    );
  }

  const alertStyles = getAlertStyles(insights.alerta_nivel);
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatPrice = (value: number) => `R$ ${value.toFixed(2)}/L`;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {insights.aviso_importante && (
        <div className={`rounded-lg border-2 p-4 ${alertStyles.bg} ${alertStyles.border}`}>
          <p className={`text-sm font-medium ${alertStyles.badgeText}`}>
            ⚠️ {insights.aviso_importante}
          </p>
        </div>
      )}

      {/* Main Card: Reajuste Sugerido */}
      <Card className={`border-2 ${alertStyles.border} ${alertStyles.bg}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`w-6 h-6 ${alertStyles.icon}`} />
              <div>
                <CardTitle>Sugestão de Reajuste</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Indicador de pressão nos custos
                </p>
              </div>
            </div>
            <Badge className={`${alertStyles.badgeBg} ${alertStyles.badgeText} text-lg px-4 py-2`}>
              {alertStyles.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {formatPercent(insights.reajuste_sugerido_pct)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Período de referência: {insights.periodo_referencia}
          </p>
        </CardContent>
      </Card>

      {/* Índices INCT */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Índices INCT
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">INCTF (Fracionada)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Mensal</p>
                <p className="text-2xl font-semibold text-primary">
                  {insights.indices.inctf_mensal >= 0 ? '+' : ''}
                  {formatPercent(insights.indices.inctf_mensal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">12 Meses</p>
                <p className="text-lg font-medium">
                  {insights.indices.inctf_12meses >= 0 ? '+' : ''}
                  {formatPercent(insights.indices.inctf_12meses)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">INCTL (Lotação)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Mensal</p>
                <p className="text-2xl font-semibold text-primary">
                  {insights.indices.inctl_mensal >= 0 ? '+' : ''}
                  {formatPercent(insights.indices.inctl_mensal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">12 Meses</p>
                <p className="text-lg font-medium">
                  {insights.indices.inctl_12meses >= 0 ? '+' : ''}
                  {formatPercent(insights.indices.inctl_12meses)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Combustíveis */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Combustíveis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diesel S-10</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Preço Atual</p>
                <p className="text-2xl font-semibold text-primary">
                  {formatPrice(insights.combustivel.diesel_s10_preco)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variação 12M</p>
                <p
                  className={`text-lg font-medium ${insights.combustivel.diesel_s10_12meses >= 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {insights.combustivel.diesel_s10_12meses >= 0 ? '+' : ''}
                  {formatPercent(insights.combustivel.diesel_s10_12meses)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diesel Comum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Preço Atual</p>
                <p className="text-2xl font-semibold text-primary">
                  {formatPrice(insights.combustivel.diesel_comum_preco)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variação 12M</p>
                <p
                  className={`text-lg font-medium ${insights.combustivel.diesel_comum_12meses >= 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {insights.combustivel.diesel_comum_12meses >= 0 ? '+' : ''}
                  {formatPercent(insights.combustivel.diesel_comum_12meses)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Diesel Petrobras (real-time) */}
          {dieselPetrobrasCard}
        </div>
      </div>

      {/* Metadados */}
      <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
        <p>📅 Gerado em: {insights.gerado_em}</p>
        <p>🔄 Próxima atualização: Segunda-feira às 08:00 AM</p>
      </div>
    </div>
  );
}
