import { describe, expect, it } from 'vitest';
import {
  ANTT_FLOOR_DEFAULT_FLAGS,
  calculateAnttPisoBrl,
  inferAnttFlagsFromStoredMeta,
  resolveAnttOperationTable,
} from '@/lib/antt-floor-calc';

describe('resolveAnttOperationTable', () => {
  it('defaults Vectra: composição veicular sem alto desempenho → A (calculadora ANTT)', () => {
    expect(resolveAnttOperationTable(ANTT_FLOOR_DEFAULT_FLAGS)).toBe('A');
  });

  it('apenas unidade de tração → B', () => {
    expect(
      resolveAnttOperationTable({
        composicaoVeicular: false,
        altoDesempenho: false,
        retornoVazio: false,
      })
    ).toBe('B');
  });

  it('composição + alto desempenho → C', () => {
    expect(
      resolveAnttOperationTable({
        composicaoVeicular: true,
        altoDesempenho: true,
        retornoVazio: false,
      })
    ).toBe('C');
  });
});

describe('calculateAnttPisoBrl', () => {
  it('ida = km×CCD+CC', () => {
    const r = calculateAnttPisoBrl({ kmDistance: 1000, ccd: 5, cc: 600, retornoVazio: false });
    expect(r.ida).toBe(5600);
    expect(r.total).toBe(5600);
  });

  it('retorno vazio soma km×CCD', () => {
    const r = calculateAnttPisoBrl({ kmDistance: 1000, ccd: 5, cc: 600, retornoVazio: true });
    expect(r.retornoVazio).toBe(5000);
    expect(r.total).toBe(10600);
  });
});

describe('inferAnttFlagsFromStoredMeta', () => {
  it('infere flags a partir da tabela salva', () => {
    expect(inferAnttFlagsFromStoredMeta({ operationTable: 'A', retornoVazio: 0 })).toMatchObject({
      composicaoVeicular: true,
      altoDesempenho: false,
    });
  });
});
