import { describe, it, expect } from 'vitest';
import { computeDreRealFromPresumido } from '../dre.calculations';

// Testar helpers internos indiretamente via a função exportada
// round2 e num são usados internamente em dre.calculations.ts linhas 4-17

describe('computeDreRealFromPresumido', () => {
  const baseParams = {
    receitaBrutaPresumida: 10000,
    dasPresumido: 1400,
    icmsPresumido: 0,
    receitaLiquidaPresumida: 8600,
    custoMotoristaPresumido: 3000,
    pedagioPresumido: 500,
    aluguelMaquinasPresumido: 200,
    descargaPresumida: 100,
    maoDeObraPresumida: 0,
    custosDiretosPresumidos: 3800,
    overheadPresumido: 1290,
    resultadoPresumido: 3510,
    margemPresumidaPercent: 35.1,
    // Real costs
    custoMotoristaReal: 3200,
    pedagioReal: 550,
    aluguelMaquinasReal: 200,
    descargaReal: 150,
    maoDeObraReal: 0,
  };

  it('computes custosDiretosReais as sum of real cost items', () => {
    const result = computeDreRealFromPresumido(baseParams);
    // 3200 + 550 + 200 + 150 + 0 = 4100
    expect(result.custosDiretosReais).toBe(4100);
  });

  it('computes resultadoReal = receitaLiquida - custosDiretosReais - overhead', () => {
    const result = computeDreRealFromPresumido(baseParams);
    // 8600 - 4100 - 1290 = 3210
    expect(result.resultadoReal).toBe(3210);
  });

  it('computes margemRealPercent = resultadoReal / receitaBruta * 100', () => {
    const result = computeDreRealFromPresumido(baseParams);
    // 3210 / 10000 * 100 = 32.1
    expect(result.margemRealPercent).toBe(32.1);
  });

  it('computes deltaResultado = resultadoReal - resultadoPresumido', () => {
    const result = computeDreRealFromPresumido(baseParams);
    // 3210 - 3510 = -300
    expect(result.deltaResultado).toBe(-300);
  });

  it('computes deltaPercent relative to |presumido|', () => {
    const result = computeDreRealFromPresumido(baseParams);
    // -300 / |3510| * 100 = -8.55
    expect(result.deltaPercent).toBe(-8.55);
  });

  it('returns 0 margin when receitaBruta is 0', () => {
    const result = computeDreRealFromPresumido({
      ...baseParams,
      receitaBrutaPresumida: 0,
    });
    expect(result.margemRealPercent).toBe(0);
  });

  it('returns 0 deltaPercent when resultadoPresumido is 0', () => {
    const result = computeDreRealFromPresumido({
      ...baseParams,
      resultadoPresumido: 0,
    });
    expect(result.deltaPercent).toBe(0);
  });

  it('handles real costs lower than presumed (positive delta)', () => {
    const result = computeDreRealFromPresumido({
      ...baseParams,
      custoMotoristaReal: 2500,
      pedagioReal: 400,
      descargaReal: 50,
    });
    // custosDiretosReais = 2500 + 400 + 200 + 50 + 0 = 3150
    expect(result.custosDiretosReais).toBe(3150);
    // resultado = 8600 - 3150 - 1290 = 4160
    expect(result.resultadoReal).toBe(4160);
    // delta = 4160 - 3510 = 650
    expect(result.deltaResultado).toBe(650);
    expect(result.deltaPercent).toBeGreaterThan(0);
  });
});
