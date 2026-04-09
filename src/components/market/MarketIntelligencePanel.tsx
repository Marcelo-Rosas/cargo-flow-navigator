import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Zap, RefreshCw, Fuel } from 'lucide-react';
import { useMarketInsights, getAlertStyles } from '@/hooks/useMarketInsights';
import { usePetrobrasDiesel } from '@/hooks/usePetrobrasDiesel';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

const UF_OPTIONS = [
  { value: 'BR', label: 'Brasil (Média)' },
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'PR', label: 'Paraná' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'TO', label: 'Tocantins' },
];

export function MarketIntelligencePanel() {
  const { data: insights, isLoading, isError, error } = useMarketInsights();
  const {
    data: petrobras,
    isLoading: petrobrasLoading,
    refresh: refreshPetrobras,
  } = usePetrobrasDiesel('BR');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUf, setSelectedUf] = useState('BR');
  const {
    data: petrobrasUf,
    isLoading: petrobrasUfLoading,
    refresh: refreshPetrobrasUf,
  } = usePetrobrasDiesel(selectedUf);

  // Usa dados do UF selecionado (fallback para BR)
  const activePetrobras = selectedUf === 'BR' ? petrobras : petrobrasUf;
  const activePetrobrasLoading = selectedUf === 'BR' ? petrobrasLoading : petrobrasUfLoading;
  const activeRefresh = selectedUf === 'BR' ? refreshPetrobras : refreshPetrobrasUf;

  const ufLabel = UF_OPTIONS.find((o) => o.value === selectedUf)?.label ?? selectedUf;

  // Card Diesel Petrobras — renderiza independente do market-insights
  const dieselPetrobrasCard = (
    <Card>
      <CardContent className="pt-5 pb-4">
        {/* Top row: label + trend + refresh */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm text-muted-foreground">Diesel Petrobras</p>
          <div className="flex items-center gap-2">
            {!activePetrobrasLoading && activePetrobras?.variacao_pct != null && (
              <span
                className={`text-sm font-medium tabular-nums whitespace-nowrap ${activePetrobras.variacao_pct >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}
              >
                {activePetrobras.variacao_pct >= 0 ? '+' : ''}
                {activePetrobras.variacao_pct.toFixed(2).replace('.', ',')}%
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await activeRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
              title="Atualizar preço da Petrobras"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {/* Big value */}
        {activePetrobrasLoading ? (
          <Skeleton className="h-8 w-28" />
        ) : activePetrobras ? (
          <>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              R${' '}
              {activePetrobras.preco_medio.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              /L
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">{ufLabel}</p>
              <Select value={selectedUf} onValueChange={setSelectedUf}>
                <SelectTrigger className="h-6 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {UF_OPTIONS.map((uf) => (
                    <SelectItem key={uf.value} value={uf.value} className="text-xs">
                      {uf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activePetrobras.periodo_coleta && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Coleta: {activePetrobras.periodo_coleta}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sem dados. Clique em atualizar.</p>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        {dieselPetrobrasCard}
      </div>
    );
  }

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

  if (!insights.indices || !insights.combustivel) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Dados Incompletos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Índices NTC indisponíveis no momento. Tente recarregar a página.
            </p>
          </CardContent>
        </Card>
        {dieselPetrobrasCard}
      </div>
    );
  }

  const alertStyles = getAlertStyles(insights.alerta_nivel);

  const fmtPct = (v: number) => {
    const pct = (v * 100).toFixed(2).replace('.', ',');
    return `${v >= 0 ? '+' : ''}${pct}%`;
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {insights.aviso_importante && (
        <div className={`rounded-lg border-2 p-4 ${alertStyles.bg} ${alertStyles.border}`}>
          <p className={`text-sm font-medium ${alertStyles.badgeText}`}>
            {insights.aviso_importante}
          </p>
        </div>
      )}

      {/* Main Card: Reajuste Sugerido */}
      <Card className={`border-2 ${alertStyles.border} ${alertStyles.bg}`}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${alertStyles.icon}`} />
              <p className="text-sm text-muted-foreground">Sugestão de Reajuste</p>
            </div>
            <Badge className={`${alertStyles.badgeBg} ${alertStyles.badgeText} text-sm px-3 py-1`}>
              {alertStyles.label}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {fmtPct(insights.reajuste_sugerido_pct)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Período: {insights.periodo_referencia}
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
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm text-muted-foreground">INCTF (Fracionada)</p>
                <span
                  className={`text-sm font-medium tabular-nums ${insights.indices.inctf_12meses > 0.05 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}
                >
                  {fmtPct(insights.indices.inctf_12meses)}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {fmtPct(insights.indices.inctf_mensal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Variação mensal</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm text-muted-foreground">INCTL (Lotação)</p>
                <span
                  className={`text-sm font-medium tabular-nums ${insights.indices.inctl_12meses > 0.05 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}
                >
                  {fmtPct(insights.indices.inctl_12meses)}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {fmtPct(insights.indices.inctl_mensal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Variação mensal</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Combustíveis */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4" />
          Combustíveis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm text-muted-foreground">Diesel S-10</p>
                <span
                  className={`text-sm font-medium tabular-nums ${insights.combustivel.diesel_s10_12meses >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}
                >
                  {fmtPct(insights.combustivel.diesel_s10_12meses)}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                R${' '}
                {insights.combustivel.diesel_s10_preco.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                /L
              </p>
              <p className="text-xs text-muted-foreground mt-1">Preço médio nacional</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm text-muted-foreground">Diesel Comum</p>
                <span
                  className={`text-sm font-medium tabular-nums ${insights.combustivel.diesel_comum_12meses >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}
                >
                  {fmtPct(insights.combustivel.diesel_comum_12meses)}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                R${' '}
                {insights.combustivel.diesel_comum_preco.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                /L
              </p>
              <p className="text-xs text-muted-foreground mt-1">Preço médio nacional</p>
            </CardContent>
          </Card>

          {/* Diesel Petrobras (real-time) */}
          {dieselPetrobrasCard}
        </div>
      </div>

      {/* Metadados */}
      <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
        <p>Gerado em: {insights.gerado_em}</p>
        <p>Próxima atualização: Segunda-feira às 08:00 AM</p>
      </div>
    </div>
  );
}
