export function calculateLiquidityIndicators(
  ativoCirculante: number,
  passivoCirculante: number,
  ativoImediato: number
) {
  const passivo = passivoCirculante > 0 ? passivoCirculante : null;
  return {
    // TMS não tem estoques: seca = corrente
    liquidezCorrente: passivo ? ativoCirculante / passivo : 0,
    liquidezSeca: passivo ? ativoCirculante / passivo : 0,
    liquidezImediata: passivo ? ativoImediato / passivo : 0,
  };
}

export function getLiquidityStatusLabel(ratio: number): string {
  if (ratio >= 2) return 'Ótima';
  if (ratio >= 1.5) return 'Boa';
  if (ratio >= 1) return 'Adequada';
  return 'Alerta';
}

export function getLiquidityStatusBadgeVariant(
  ratio: number
): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (ratio >= 1.5) return 'default';
  if (ratio >= 1) return 'secondary';
  return 'destructive';
}

export function getLiquidityStatusColor(ratio: number): string {
  if (ratio >= 1.5) return 'text-green-600 dark:text-green-400';
  if (ratio >= 1) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}
