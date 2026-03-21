import { describe, it, expect } from 'vitest';
import { computePresumedFromBreakdown } from '../dre.presumed';

describe('computePresumedFromBreakdown', () => {
  const fullBreakdown = {
    totals: {
      totalCliente: 10000,
      das: 1400,
      icms: 600,
    },
    profitability: {
      overhead: 800,
      custoMotorista: 3000,
      custosDescarga: 200,
      custosDiretos: 4500,
      resultadoLiquido: 2400,
      receitaLiquida: 8000,
    },
    components: {
      toll: 500,
      waitingTimeCost: 100,
      conditionalFeesTotal: 300,
      aluguelMaquinas: 150,
    },
    riskCosts: { total: 50 },
  };

  it('calcula happy path com breakdown completo', () => {
    const result = computePresumedFromBreakdown(fullBreakdown, 10000);
    expect(result.values.get('faturamento_bruto')).toBe(10000);
    expect(result.values.get('das')).toBe(1400);
    expect(result.values.get('icms')).toBe(600);
    expect(result.values.get('impostos')).toBe(2000);
    expect(result.values.get('receita_liquida')).toBe(8000);
    expect(result.values.get('overhead')).toBe(800);
    expect(result.values.get('custo_motorista')).toBe(3000);
    expect(result.values.get('pedagio')).toBe(500);
    expect(result.values.get('carga_descarga')).toBe(200);
    expect(result.values.get('espera')).toBe(100);
    expect(result.values.get('taxas_condicionais')).toBe(300);
  });

  it('usa quoteValue como fallback quando totalCliente ausente', () => {
    const result = computePresumedFromBreakdown({}, 5000);
    expect(result.values.get('faturamento_bruto')).toBe(5000);
  });

  it('trata breakdown null', () => {
    const result = computePresumedFromBreakdown(null, 7000);
    expect(result.values.get('faturamento_bruto')).toBe(7000);
    expect(result.values.get('das')).toBe(0);
    expect(result.values.get('icms')).toBe(0);
    expect(result.values.get('receita_liquida')).toBe(7000);
    expect(result.values.get('custos_diretos')).toBe(0);
    expect(result.values.get('overhead')).toBe(0);
  });

  it('suporta chaves snake_case no breakdown', () => {
    const snakeBreakdown = {
      totals: { total_cliente: 8000, das: 500, icms: 300 },
      profitability: {
        overhead: 400,
        custo_motorista: 2000,
        custos_descarga: 150,
        resultado_liquido: 3250,
      },
      components: {
        toll: 200,
        waiting_time_cost: 50,
        conditional_fees_total: 100,
        aluguel_maquinas: 80,
      },
    };
    const result = computePresumedFromBreakdown(snakeBreakdown, 8000);
    expect(result.values.get('faturamento_bruto')).toBe(8000);
    expect(result.values.get('custo_motorista')).toBe(2000);
    expect(result.values.get('carga_descarga')).toBe(150);
    expect(result.values.get('espera')).toBe(50);
    expect(result.values.get('taxas_condicionais')).toBe(100);
  });

  it('fallback custoMotorista → custosCarreteiro', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: { custosCarreteiro: 1500, overhead: 0 },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    expect(result.values.get('custo_motorista')).toBe(1500);
  });

  it('custoMotorista = 0 quando ambos nulos', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: { overhead: 0 },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    expect(result.values.get('custo_motorista')).toBe(0);
  });

  it('agrega riskCosts.total + custoServicos em outros_custos', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: { overhead: 0, custoServicos: 100 },
      components: { aluguelMaquinas: 200 },
      riskCosts: { total: 50 },
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    // outros = riskTotal(50) + custoServicos(100) + aluguelMaquinas(200) = 350
    expect(result.values.get('outros_custos')).toBe(350);
  });

  it('calcula custos_diretos como soma das sublinhas', () => {
    const result = computePresumedFromBreakdown(fullBreakdown, 10000);
    const motorista = result.values.get('custo_motorista')!;
    const pedagio = result.values.get('pedagio')!;
    const descarga = result.values.get('carga_descarga')!;
    const espera = result.values.get('espera')!;
    const taxas = result.values.get('taxas_condicionais')!;
    const outros = result.values.get('outros_custos')!;
    expect(result.values.get('custos_diretos')).toBe(
      motorista + pedagio + descarga + espera + taxas + outros
    );
  });

  it('calcula resultado_liquido = receita - overhead - custos_diretos', () => {
    const result = computePresumedFromBreakdown(fullBreakdown, 10000);
    const receita = result.values.get('receita_liquida')!;
    const overhead = result.values.get('overhead')!;
    const custos = result.values.get('custos_diretos')!;
    expect(result.values.get('resultado_liquido')).toBe(
      Math.round((receita - overhead - custos) * 100) / 100
    );
  });

  it('faturamento = 0 → margem = 0 sem divisão por zero', () => {
    const breakdown = {
      totals: { totalCliente: 0, das: 0, icms: 0 },
      profitability: { overhead: 0, resultadoLiquido: 0 },
    };
    const result = computePresumedFromBreakdown(breakdown, 0);
    expect(result.values.get('margem_liquida')).toBe(0);
  });

  it('hasFormulaWarning = true quando resultado diverge do JSON', () => {
    const breakdown = {
      totals: { totalCliente: 10000, das: 0, icms: 0 },
      profitability: {
        overhead: 0,
        custoMotorista: 3000,
        resultadoLiquido: 9999, // diverge do recomputado (10000 - 0 - 3000 = 7000)
      },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 10000);
    expect(result.hasFormulaWarning).toBe(true);
    expect(result.formulaWarningMessage).toContain('Divergência');
  });

  it('hasFormulaWarning = false quando resultado converge', () => {
    const breakdown = {
      totals: { totalCliente: 10000, das: 1000, icms: 0 },
      profitability: {
        overhead: 500,
        custoMotorista: 3000,
        resultadoLiquido: 5500, // 10000 - 1000 - 500 - 3000 = 5500
      },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 10000);
    expect(result.hasFormulaWarning).toBe(false);
    expect(result.formulaWarningMessage).toBeUndefined();
  });

  it('num helper retorna 0 para path não-objeto (string no meio)', () => {
    const breakdown = {
      totals: { totalCliente: 'not-a-nested-object' },
      profitability: {},
      components: {},
    };
    // totalCliente é string, não objeto, então num(breakdown, 'totals', 'totalCliente') = NaN → 0
    // Mas numFallback tenta como number primeiro: Number('not-a-nested-object') = NaN → fallback
    const result = computePresumedFromBreakdown(breakdown, 3000);
    expect(result.values.get('faturamento_bruto')).toBe(3000); // fallback para quoteValue
  });

  it('num helper retorna 0 para valor não-finito (NaN, Infinity)', () => {
    const breakdown = {
      totals: { totalCliente: Infinity, das: NaN, icms: undefined },
      profitability: {},
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    expect(result.values.get('faturamento_bruto')).toBe(5000); // Infinity → 0, fallback quoteValue
    expect(result.values.get('das')).toBe(0);
    expect(result.values.get('icms')).toBe(0);
  });

  it('numFallback testa camelCase primeiro, depois snake_case', () => {
    // Ambos presentes: camelCase tem prioridade
    const breakdown = {
      totals: { totalCliente: 8000, total_cliente: 5000 },
      profitability: {},
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 9000);
    expect(result.values.get('faturamento_bruto')).toBe(8000);
  });

  it('totalCliente = 0 faz fallback para quoteValue via ||', () => {
    const breakdown = {
      totals: { totalCliente: 0, das: 100, icms: 50 },
      profitability: { resultadoLiquido: 0 },
    };
    const result = computePresumedFromBreakdown(breakdown, 8000);
    // totalCliente=0 é falsy → || quoteValue=8000
    expect(result.values.get('faturamento_bruto')).toBe(8000);
  });

  it('custoMotorista = 0 faz fallback para custosCarreteiro via ||', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: { custoMotorista: 0, custosCarreteiro: 1200, overhead: 0, resultadoLiquido: 3800 },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    expect(result.values.get('custo_motorista')).toBe(1200);
  });

  it('exercita todos os paths de ?? com dados parciais (somente snake_case)', () => {
    const breakdown = {
      totals: { total_cliente: 6000, das: 300, icms: 100 },
      profitability: {
        overhead: 200,
        custos_carreteiro: 1500,
        custos_descarga: 80,
        custo_servicos: 50,
        resultado_liquido: 3770,
      },
      components: {
        toll: 250,
        waiting_time_cost: 30,
        conditional_fees_total: 60,
        aluguel_maquinas: 40,
      },
    };
    const result = computePresumedFromBreakdown(breakdown, 6000);
    expect(result.values.get('faturamento_bruto')).toBe(6000);
    expect(result.values.get('custo_motorista')).toBe(1500);
    expect(result.values.get('carga_descarga')).toBe(80);
    expect(result.values.get('espera')).toBe(30);
    expect(result.values.get('taxas_condicionais')).toBe(60);
  });

  it('exercita ?? 0 fallback quando nem camel nem snake existem', () => {
    // breakdown com totals mas sem nenhum dos campos esperados
    const breakdown = {
      totals: { irrelevantField: 999 },
      profitability: { irrelevantField: 888 },
      components: { irrelevantField: 777 },
    };
    const result = computePresumedFromBreakdown(breakdown, 4000);
    expect(result.values.get('faturamento_bruto')).toBe(4000);
    expect(result.values.get('das')).toBe(0);
    expect(result.values.get('icms')).toBe(0);
    expect(result.values.get('overhead')).toBe(0);
    expect(result.values.get('custo_motorista')).toBe(0);
    expect(result.values.get('pedagio')).toBe(0);
    expect(result.values.get('carga_descarga')).toBe(0);
    expect(result.values.get('espera')).toBe(0);
    expect(result.values.get('taxas_condicionais')).toBe(0);
  });

  it('formulaWarningMessage contém valores formatados em pt-BR', () => {
    const breakdown = {
      totals: { totalCliente: 10000, das: 0, icms: 0 },
      profitability: { overhead: 0, resultadoLiquido: 5000 },
    };
    const result = computePresumedFromBreakdown(breakdown, 10000);
    expect(result.hasFormulaWarning).toBe(true);
    expect(result.formulaWarningMessage).toMatch(/R\$/);
    expect(result.formulaWarningMessage).toMatch(/5\.000/);
  });

  it('das como string numérica exercita branch typeof !== number', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: '700', icms: '0' },
      profitability: { overhead: '200', resultadoLiquido: '4100' },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown as any, 5000);
    expect(result.values.get('das')).toBe(700);
  });

  it('custoMotorista presente E custosCarreteiro presente: camel tem prioridade', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: {
        custoMotorista: 2000,
        custosCarreteiro: 1500, // ignorado pois custoMotorista != 0
        overhead: 0,
        resultadoLiquido: 3000,
      },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    expect(result.values.get('custo_motorista')).toBe(2000);
  });

  it('campo deep path com valor intermediário null', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: null, // null no meio do path
      components: null,
    };
    const result = computePresumedFromBreakdown(breakdown as any, 5000);
    expect(result.values.get('overhead')).toBe(0);
    expect(result.values.get('custo_motorista')).toBe(0);
    expect(result.values.get('pedagio')).toBe(0);
  });

  it('riskCosts null → riskTotal = 0', () => {
    const breakdown = {
      totals: { totalCliente: 5000, das: 0, icms: 0 },
      profitability: { overhead: 0, resultadoLiquido: 5000 },
      riskCosts: null,
    };
    const result = computePresumedFromBreakdown(breakdown, 5000);
    expect(result.values.get('outros_custos')).toBe(0);
  });

  it('valores numéricos como string são convertidos', () => {
    const breakdown = {
      totals: { totalCliente: '7500', das: '500', icms: '200' },
      profitability: { overhead: '300', custoMotorista: '1000', resultadoLiquido: '5500' },
      components: { toll: '100' },
    };
    const result = computePresumedFromBreakdown(breakdown as any, 7500);
    expect(result.values.get('faturamento_bruto')).toBe(7500);
    expect(result.values.get('das')).toBe(500);
    expect(result.values.get('pedagio')).toBe(100);
  });

  it('calcula margem como percentual sobre faturamento', () => {
    const breakdown = {
      totals: { totalCliente: 10000, das: 0, icms: 0 },
      profitability: { overhead: 0, resultadoLiquido: 4000 },
      components: {},
    };
    const result = computePresumedFromBreakdown(breakdown, 10000);
    const resultado = result.values.get('resultado_liquido')!;
    expect(result.values.get('margem_liquida')).toBe(
      Math.round((resultado / 10000) * 100 * 100) / 100
    );
  });
});
