import { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  BarChart3,
  Activity,
  RefreshCw,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useInsuranceVolumeMetrics } from '@/hooks/useInsuranceMonitoring';
import { useInsuranceLatencyMetrics } from '@/hooks/useInsuranceMonitoring';
import { useInsuranceErrorBreakdown } from '@/hooks/useInsuranceMonitoring';
import { useInsuranceFallbackRatio } from '@/hooks/useInsuranceMonitoring';
import { useInsuranceStatusSummary } from '@/hooks/useInsuranceMonitoring';
import { cn } from '@/lib/utils';

/**
 * Insurance Monitoring Dashboard — Phase E Bloco 3
 *
 * Displays real-time metrics for Buonny insurance integration:
 * - Volume & Success Rate (time series)
 * - Latency Percentiles P50/P95/P99
 * - Error Breakdown (status distribution)
 * - Fallback Ratio with Alert Levels
 * - Current Status Summary (30-min snapshot)
 */
export function InsuranceMonitoringDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load all metrics
  const volumeQuery = useInsuranceVolumeMetrics(timeRange);
  const latencyQuery = useInsuranceLatencyMetrics(timeRange);
  const errorBreakdownQuery = useInsuranceErrorBreakdown(timeRange);
  const fallbackQuery = useInsuranceFallbackRatio('1h'); // Always 1h for freshness
  const summaryQuery = useInsuranceStatusSummary();

  // Determine loading state
  const isLoading =
    volumeQuery.isLoading ||
    latencyQuery.isLoading ||
    errorBreakdownQuery.isLoading ||
    fallbackQuery.isLoading ||
    summaryQuery.isLoading;

  const hasError =
    volumeQuery.isError ||
    latencyQuery.isError ||
    errorBreakdownQuery.isError ||
    fallbackQuery.isError ||
    summaryQuery.isError;

  // Memoize chart data transformations
  const volumeChartData = useMemo(() => {
    if (!volumeQuery.data) return [];
    return volumeQuery.data.map((item) => ({
      time: new Date(item.time_bucket).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      requests: item.requests_total,
      success: item.success_count,
      errors: item.error_count,
      timeouts: item.timeout_count,
      rateLimits: item.rate_limit_count,
      fallbacks: item.fallback_count,
      successRate: Math.round(item.success_rate * 100),
      timestamp: item.time_bucket,
    }));
  }, [volumeQuery.data]);

  const latencyChartData = useMemo(() => {
    if (!latencyQuery.data) return [];
    return latencyQuery.data.map((item) => ({
      time: new Date(item.time_bucket).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      p50: Math.round(item.p50_ms),
      p95: Math.round(item.p95_ms),
      p99: Math.round(item.p99_ms),
      timestamp: item.time_bucket,
    }));
  }, [latencyQuery.data]);

  const errorChartData = useMemo(() => {
    if (!errorBreakdownQuery.data) return [];
    return errorBreakdownQuery.data.map((item) => ({
      name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
      value: item.count,
      percentage: Math.round(item.percentage),
    }));
  }, [errorBreakdownQuery.data]);

  // Fallback alert logic
  const fallbackMetric = fallbackQuery.data;
  const fallbackAlertColor = fallbackMetric
    ? fallbackMetric.alert_level === 'red'
      ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
      : fallbackMetric.alert_level === 'yellow'
        ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
        : 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
    : 'bg-gray-50 border-gray-200';

  const fallbackAlertTextColor = fallbackMetric
    ? fallbackMetric.alert_level === 'red'
      ? 'text-red-700 dark:text-red-400'
      : fallbackMetric.alert_level === 'yellow'
        ? 'text-yellow-700 dark:text-yellow-400'
        : 'text-green-700 dark:text-green-400'
    : 'text-gray-700';

  // Summary stats
  const summary = summaryQuery.data;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      volumeQuery.refetch(),
      latencyQuery.refetch(),
      errorBreakdownQuery.refetch(),
      fallbackQuery.refetch(),
      summaryQuery.refetch(),
    ]);
    setIsRefreshing(false);
  }, [volumeQuery, latencyQuery, errorBreakdownQuery, fallbackQuery, summaryQuery]);

  const handleExport = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      timeRange,
      volume: volumeQuery.data,
      latency: latencyQuery.data,
      errors: errorBreakdownQuery.data,
      fallback: fallbackQuery.data,
      summary: summaryQuery.data,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurance-metrics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    volumeQuery.data,
    latencyQuery.data,
    errorBreakdownQuery.data,
    fallbackQuery.data,
    summaryQuery.data,
    timeRange,
  ]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header com Botão de Voltar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-muted"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Seguros</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Integração Buonny — Cotações, Latência e Fallbacks em Tempo Real
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!volumeQuery.data}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Error State */}
        {hasError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar métricas</AlertTitle>
            <AlertDescription>
              Falha ao buscar dados. Tente atualizar ou verifique a conexão com o servidor.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            {/* Uptime */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Disponibilidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(summary.uptime_percentage)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(summary.uptime_percentage) >= 99 ? '✓ Excelente' : '⚠ Degradado'}
                </p>
              </CardContent>
            </Card>

            {/* Latência Média */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Latência Média
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avg_latency_ms}ms</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avg_latency_ms < 500 ? '✓ Rápido' : '⚠ Lento'}
                </p>
              </CardContent>
            </Card>

            {/* Taxa de Erro */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Taxa de Erro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(summary.error_rate)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.error_rate < 5 ? '✓ Normal' : '⚠ Alto'}
                </p>
              </CardContent>
            </Card>

            {/* Fallback */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Taxa de Fallback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(summary.fallback_ratio * 100)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.fallback_ratio < 0.1 ? '✓ Normal' : '⚠ Alto'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Time Range Selector */}
        <div className="flex gap-2">
          <Button
            variant={timeRange === '1h' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('1h')}
          >
            1h
          </Button>
          <Button
            variant={timeRange === '24h' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('24h')}
          >
            24h
          </Button>
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7d
          </Button>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Volume & Success Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Volume de Cotações
              </CardTitle>
              <CardDescription>Requisições totais e taxa de sucesso</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Carregando...</div>
                </div>
              ) : volumeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={volumeChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke="#3b82f6"
                      name="Total"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="successRate"
                      stroke="#10b981"
                      name="Taxa Sucesso %"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Sem dados para o período</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latency Percentiles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Latência (P50, P95, P99)
              </CardTitle>
              <CardDescription>Percentis de tempo de resposta</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Carregando...</div>
                </div>
              ) : latencyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={latencyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value}ms`} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="p50"
                      fill="#93c5fd"
                      stroke="#3b82f6"
                      name="P50 (ms)"
                    />
                    <Area
                      type="monotone"
                      dataKey="p95"
                      fill="#fbbf24"
                      stroke="#f59e0b"
                      name="P95 (ms)"
                    />
                    <Area
                      type="monotone"
                      dataKey="p99"
                      fill="#fca5a5"
                      stroke="#ef4444"
                      name="P99 (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Sem dados para o período</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Distribuição de Status
              </CardTitle>
              <CardDescription>Erro, Timeout, Rate Limit, Fallback</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Carregando...</div>
                </div>
              ) : errorChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={errorChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" name="Ocorrências" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Sem dados para o período</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fallback Ratio Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Taxa de Fallback (1h)
              </CardTitle>
              <CardDescription>Monitoramento em tempo real</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Carregando...</div>
                </div>
              ) : fallbackMetric ? (
                <>
                  <Alert className={cn('border', fallbackAlertColor)}>
                    <AlertCircle className={cn('h-5 w-5', fallbackAlertTextColor)} />
                    <AlertTitle className={fallbackAlertTextColor}>
                      {fallbackMetric.alert_level === 'red'
                        ? '🔴 Crítico: Taxa de fallback acima do limite'
                        : fallbackMetric.alert_level === 'yellow'
                          ? '🟡 Alerta: Taxa de fallback elevada'
                          : '🟢 Normal: Taxa de fallback saudável'}
                    </AlertTitle>
                    <AlertDescription className={fallbackAlertTextColor}>
                      {fallbackMetric.fallback_count} de {fallbackMetric.total_requests} requisições
                      ({Math.round(fallbackMetric.fallback_ratio * 100)}%)
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded">
                      <div className="text-muted-foreground text-xs">Total</div>
                      <div className="font-semibold">{fallbackMetric.total_requests}</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="text-muted-foreground text-xs">Fallback</div>
                      <div className="font-semibold">{fallbackMetric.fallback_count}</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="text-muted-foreground text-xs">Taxa</div>
                      <div className="font-semibold">
                        {Math.round(fallbackMetric.fallback_ratio * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                    <p className="font-medium mb-1">ℹ️ Interpretação:</p>
                    <ul className="space-y-1">
                      <li>• Verde (&lt;10%): Fallback normal, API respondendo bem</li>
                      <li>• Amarelo (10-20%): Fallback moderado, monitorar API</li>
                      <li>• Vermelho (&gt;20%): Fallback crítico, verificar saúde da API</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Sem dados disponíveis</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Last Update Info */}
        <div className="text-right text-xs text-muted-foreground">
          {summary?.last_check_at && (
            <p>
              Último check:{' '}
              {new Date(summary.last_check_at).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium',
              })}
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
