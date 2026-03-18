import { useQuery } from '@tanstack/react-query';

export interface MarketInsights {
  gerado_em: string;
  periodo_referencia: string;
  indices: {
    inctf_mensal: number;
    inctf_12meses: number;
    inctl_mensal: number;
    inctl_12meses: number;
  };
  combustivel: {
    diesel_s10_preco: number;
    diesel_s10_12meses: number;
    diesel_comum_preco: number;
    diesel_comum_12meses: number;
  };
  reajuste_sugerido_pct: number;
  alerta_nivel: 'estavel' | 'atencao' | 'urgente';
  alerta_cor: 'green' | 'yellow' | 'red';
  aviso_importante?: string;
}

export function getAlertStyles(nivel: string) {
  switch (nivel) {
    case 'estavel':
      return {
        bg: 'bg-green-50 dark:bg-green-950',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600',
        label: '🟢 Estável',
        badgeBg: 'bg-green-100 dark:bg-green-900',
        badgeText: 'text-green-800 dark:text-green-200',
      };
    case 'atencao':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-950',
        border: 'border-yellow-200 dark:border-yellow-800',
        icon: 'text-yellow-600',
        label: '🟡 Atenção',
        badgeBg: 'bg-yellow-100 dark:bg-yellow-900',
        badgeText: 'text-yellow-800 dark:text-yellow-200',
      };
    case 'urgente':
      return {
        bg: 'bg-red-50 dark:bg-red-950',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600',
        label: '🔴 Urgente',
        badgeBg: 'bg-red-100 dark:bg-red-900',
        badgeText: 'text-red-800 dark:text-red-200',
      };
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-950',
        border: 'border-gray-200 dark:border-gray-800',
        icon: 'text-gray-600',
        label: '⚪ Desconhecido',
        badgeBg: 'bg-gray-100 dark:bg-gray-900',
        badgeText: 'text-gray-800 dark:text-gray-200',
      };
  }
}

export function useMarketInsights() {
  return useQuery<MarketInsights>({
    queryKey: ['market-insights', 'latest'],
    queryFn: async () => {
      const response = await fetch('/api/market-insights/latest', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao buscar dados de inteligência de mercado');
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours (was cacheTime)
    retry: 2,
    refetchInterval: 1000 * 60 * 60, // Refetch every hour
  });
}
