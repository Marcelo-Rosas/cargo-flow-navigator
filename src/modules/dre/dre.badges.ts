/**
 * Lógica de badges para DRE: verde (favorável), vermelho (desfavorável), neutro.
 * Semântica invertida para linhas positivas vs negativas.
 */

import type { DreLineCode } from './dre-lines.types';
import { isPositiveLine } from './dre-lines';
import type { BadgeDirection, BadgeColor } from './dre-lines.types';

export function computeBadge(
  lineCode: DreLineCode,
  presumedValue: number,
  realValue: number
): { direction: BadgeDirection; color: BadgeColor } {
  const diff = realValue - presumedValue;
  const positive = isPositiveLine(lineCode);

  if (Math.abs(diff) < 0.01) {
    return { direction: 'neutral', color: 'neutral' };
  }

  if (positive) {
    // Linhas positivas: real > presumido = verde ↑, real < presumido = vermelho ↓
    if (diff > 0) return { direction: 'up', color: 'green' };
    return { direction: 'down', color: 'red' };
  } else {
    // Linhas negativas (custos): real < presumido = verde ↓, real > presumido = vermelho ↑
    if (diff < 0) return { direction: 'down', color: 'green' };
    return { direction: 'up', color: 'red' };
  }
}
