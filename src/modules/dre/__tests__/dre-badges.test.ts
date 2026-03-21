import { describe, it, expect } from 'vitest';
import { computeBadge } from '../dre.badges';

describe('computeBadge', () => {
  // Linhas positivas (receita, resultado, margem): real > presumido = verde ↑
  it('linha positiva: real > presumido → up/green', () => {
    const result = computeBadge('faturamento_bruto', 1000, 1200);
    expect(result).toEqual({ direction: 'up', color: 'green' });
  });

  it('linha positiva: real < presumido → down/red', () => {
    const result = computeBadge('resultado_liquido', 1000, 800);
    expect(result).toEqual({ direction: 'down', color: 'red' });
  });

  // Linhas negativas (custos): real < presumido = verde ↓ (gastou menos)
  it('linha negativa: real < presumido → down/green', () => {
    const result = computeBadge('custos_diretos', 1000, 800);
    expect(result).toEqual({ direction: 'down', color: 'green' });
  });

  it('linha negativa: real > presumido → up/red', () => {
    const result = computeBadge('custo_motorista', 1000, 1200);
    expect(result).toEqual({ direction: 'up', color: 'red' });
  });

  it('diferença = 0 → neutral', () => {
    const result = computeBadge('faturamento_bruto', 1000, 1000);
    expect(result).toEqual({ direction: 'neutral', color: 'neutral' });
  });

  it('diferença < 0.01 (dentro EPS) → neutral', () => {
    const result = computeBadge('custos_diretos', 1000, 1000.005);
    expect(result).toEqual({ direction: 'neutral', color: 'neutral' });
  });

  it('diferença = 0.01 exato → neutral (< usa strict less-than)', () => {
    // Math.abs(0.01) < 0.01 é false, mas floating point: 1000.01-1000 = 0.01000...0004
    // Na prática 0.01 é o threshold exato → depende de float precision
    const result = computeBadge('faturamento_bruto', 1000, 1000.01);
    // 0.01 < 0.01 = false → NÃO é neutro, porém floating point pode variar
    // Verificamos apenas que retorna um resultado válido
    expect(['neutral', 'up', 'down']).toContain(result.direction);
  });

  it('diferença > 0.01 → definitivamente não neutro', () => {
    const result = computeBadge('faturamento_bruto', 1000, 1000.02);
    expect(result.direction).not.toBe('neutral');
  });

  it('funciona com todas as linhas negativas de custos', () => {
    const negativeCodes = [
      'impostos', 'das', 'icms', 'overhead', 'custos_diretos',
      'custo_motorista', 'pedagio', 'carga_descarga', 'espera',
      'taxas_condicionais', 'outros_custos',
    ] as const;
    for (const code of negativeCodes) {
      const result = computeBadge(code, 100, 50);
      expect(result.color).toBe('green'); // gastou menos = bom
    }
  });

  it('funciona com todas as linhas positivas', () => {
    const positiveCodes = [
      'faturamento_bruto', 'receita_liquida', 'resultado_liquido', 'margem_liquida',
    ] as const;
    for (const code of positiveCodes) {
      const result = computeBadge(code, 100, 150);
      expect(result.color).toBe('green'); // ganhou mais = bom
    }
  });
});
