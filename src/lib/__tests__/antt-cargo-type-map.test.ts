import { describe, expect, it } from 'vitest';
import {
  resolveAnttCargoTypeForPiso,
  resolveAnttCargoTypeFromLabel,
} from '@/lib/antt-cargo-type-map';

describe('resolveAnttCargoTypeFromLabel', () => {
  it('defaults empty to carga_geral', () => {
    expect(resolveAnttCargoTypeFromLabel('')).toBe('carga_geral');
    expect(resolveAnttCargoTypeFromLabel(null)).toBe('carga_geral');
  });

  it('keeps explicit ANTT keys', () => {
    expect(resolveAnttCargoTypeFromLabel('granel_solido')).toBe('granel_solido');
    expect(resolveAnttCargoTypeFromLabel('perigosa_carga_geral')).toBe('perigosa_carga_geral');
  });

  it('maps fitness / equipamentos to carga_geral', () => {
    expect(resolveAnttCargoTypeFromLabel('EQUIPAMENTOS')).toBe('carga_geral');
    expect(resolveAnttCargoTypeFromLabel('Máquinas academia fitness')).toBe('carga_geral');
    expect(resolveAnttCargoTypeFromLabel('Eletrônicos paletizados')).toBe('carga_geral');
  });

  it('does not map vehicle body (graneleiro) to granel_solido', () => {
    expect(resolveAnttCargoTypeFromLabel('Graneleiro')).toBe('carga_geral');
    expect(resolveAnttCargoTypeFromLabel('Transporte em grade baixa')).toBe('carga_geral');
  });

  it('maps grain cargo to granel_solido', () => {
    expect(resolveAnttCargoTypeFromLabel('Soja em granel')).toBe('granel_solido');
    expect(resolveAnttCargoTypeFromLabel('Granel sólido - milho')).toBe('granel_solido');
  });

  it('maps liquid bulk', () => {
    expect(resolveAnttCargoTypeFromLabel('Óleo diesel granel líquido')).toBe('granel_liquido');
  });

  it('maps refrigerated', () => {
    expect(resolveAnttCargoTypeFromLabel('Carga refrigerada')).toBe('frigorificada');
  });

  it('maps perigosa variants', () => {
    expect(resolveAnttCargoTypeFromLabel('Perigosa carga geral ONU')).toBe('perigosa_carga_geral');
    expect(resolveAnttCargoTypeFromLabel('Perigosa granel sólido')).toBe('perigosa_granel_solido');
  });
});

describe('resolveAnttCargoTypeForPiso', () => {
  it('prefers explicit override', () => {
    expect(
      resolveAnttCargoTypeForPiso({
        anttCargoType: 'frigorificada',
        cargoTypeLabel: 'Soja',
      })
    ).toBe('frigorificada');
  });

  it('uses stored meta before label', () => {
    expect(
      resolveAnttCargoTypeForPiso({
        storedAnttCargoType: 'conteinerizada',
        cargoTypeLabel: 'Geral',
      })
    ).toBe('conteinerizada');
  });
});
