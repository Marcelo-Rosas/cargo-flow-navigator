/**
 * Calculo de capacidade em pallets PBR brasileiros (1,00m x 1,20m).
 *
 * Heuristica validada com tabela de referencia do mercado:
 *   40 m3 -> 13 pallets
 *   60 m3 -> 20 pallets
 *   88 m3 -> 29 pallets
 *  100 m3 -> 33 pallets
 *
 * Divisor 3,0 m3/pallet = piso util + altura media de carga real.
 * Usar floor() — pallet e unidade discreta, espaco fracionado nao conta.
 */
const M3_PER_PALLET_PBR = 3.0;

export function calculatePalletsFromVolume(capacityM3: number | null | undefined): number | null {
  if (capacityM3 == null || capacityM3 <= 0) return null;
  return Math.floor(capacityM3 / M3_PER_PALLET_PBR);
}

/**
 * Quantidade efetiva de pallets: usa o valor manual se preenchido, senao
 * o calculado a partir do volume.
 */
export function effectivePallets(
  qtdPalletsManual: number | null | undefined,
  capacityM3: number | null | undefined
): number | null {
  if (qtdPalletsManual != null && qtdPalletsManual > 0) return qtdPalletsManual;
  return calculatePalletsFromVolume(capacityM3);
}
