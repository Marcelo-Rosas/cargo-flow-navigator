import { describe, expect, it } from 'vitest';
import {
  calculateLotacaoProfitability,
  resolveLotacaoFretePeso,
  resolveLotacaoKmOverPercent,
} from '@/lib/lotacao-freight-base';

describe('resolveLotacaoKmOverPercent', () => {
  it('escolhe faixa por km', () => {
    const rules: Record<string, number> = {
      over_lotacao_ate_800km: 60,
      over_lotacao_801_1500km: 45,
      over_lotacao_1501_2500km: 30,
      over_lotacao_acima_2500km: 20,
    };
    expect(resolveLotacaoKmOverPercent(500, (k) => rules[k])).toBe(60);
    expect(resolveLotacaoKmOverPercent(1000, (k) => rules[k])).toBe(45);
    expect(resolveLotacaoKmOverPercent(2000, (k) => rules[k])).toBe(30);
    expect(resolveLotacaoKmOverPercent(3000, (k) => rules[k])).toBe(20);
  });
});

describe('resolveLotacaoFretePeso', () => {
  it('usa piso ANTT como base de custo quando piso > tabela', () => {
    const r = resolveLotacaoFretePeso({
      freteTabela: 5000,
      pisoAntt: 10000,
      km: 600,
      overKmPercent: 60,
      overAnttPercent: 55,
    });
    expect(r.freteTabelaComOverKm).toBe(8000);
    expect(r.pisoComOverAntt).toBe(15500);
    expect(r.fretePeso).toBe(15500);
    expect(r.fretePesoReferenciaMax).toBe(15500);
    expect(r.anttCostBaseUsed).toBe(true);
    expect(r.pisoAplicado).toBe(true);
  });

  it('usa piso ANTT como base mesmo quando tabela+over é maior (COT-2026-06-0002)', () => {
    const r = resolveLotacaoFretePeso({
      freteTabela: 20000,
      pisoAntt: 17304.92,
      km: 2761,
      overKmPercent: 34,
      overAnttPercent: 0,
    });
    expect(r.freteTabelaComOverKm).toBe(26800);
    expect(r.pisoComOverAntt).toBe(17304.92);
    expect(r.fretePeso).toBe(17304.92);
    expect(r.fretePesoReferenciaMax).toBe(26800);
    expect(r.anttCostBaseUsed).toBe(true);
  });

  it('sem piso ANTT, usa tabela+over km', () => {
    const r = resolveLotacaoFretePeso({
      freteTabela: 20000,
      pisoAntt: 0,
      km: 200,
      overKmPercent: 60,
      overAnttPercent: 55,
    });
    expect(r.fretePeso).toBe(32000);
    expect(r.anttCostBaseUsed).toBe(false);
    expect(r.pisoAplicado).toBe(false);
  });
});

describe('calculateLotacaoProfitability', () => {
  it('lucro alvo = % sobre custos diretos; margem bruta = contribuição DRE', () => {
    const p = calculateLotacaoProfitability({
      receitaLiquida: 10000,
      overhead: 1000,
      fretePeso: 7000,
      pisoAntt: 7000,
      custoServicos: 500,
      custosDescarga: 200,
      custosDiretos: 7700,
      totalCliente: 13000,
      profitMarginPercent: 15,
    });
    expect(p.margemBruta).toBe(1300);
    expect(p.resultadoLiquido).toBe(1155);
    expect(p.margemPercent).toBeCloseTo(15, 1);
  });

  it('contribuição negativa ainda pode ter lucro alvo positivo se CD*PM > 0', () => {
    const p = calculateLotacaoProfitability({
      receitaLiquida: 10000,
      overhead: 1000,
      fretePeso: 12000,
      custoServicos: 500,
      custosDescarga: 0,
      custosDiretos: 12500,
      totalCliente: 13000,
      profitMarginPercent: 10,
    });
    expect(p.margemBruta).toBe(-3500);
    expect(p.resultadoLiquido).toBe(1250);
    expect(p.margemPercent).toBeCloseTo(10, 1);
  });
});
