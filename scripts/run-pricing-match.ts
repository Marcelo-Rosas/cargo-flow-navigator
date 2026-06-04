import { calculateAnttPisoBrl } from '../src/lib/antt-floor-calc';
import { fetchMarketBenchmark } from './fetchers/ckan-benchmark';
import { calculateGrossUpHibrido } from '../src/lib/freightCalculator';

/**
 * Script de Simulação de Match de Precificação (CIOT vs Mercado)
 *
 * Agora incluindo o impacto do Risco (Seguro + GRIS) extraído da Apólice real Berkley.
 * O seguro Ad Valorem (0,03%) e o GRIS (0,15%) entram como "Repasse de Risco",
 * não sofrendo incidência de margem, mas compondo o Teto Final.
 */
async function runPricingMatch() {
  const kmDistance = 2500; // SP -> CE
  const cargaTipo = 'carga_geral';
  const valorCarga = 500_000.0; // R$ 500 mil reais

  // 1. CUSTO DO TERCEIRO (Piso ANTT / CIOT)
  const mockCCD = 5.8; // R$/km
  const mockCC = 250.0; // R$
  const pisoAntt = calculateAnttPisoBrl({
    kmDistance,
    ccd: mockCCD,
    cc: mockCC,
    retornoVazio: false,
  });
  const custosDiretos = pisoAntt.total;

  // 2. CUSTO DE RISCO (Apólice Berkley 1005400015107 e 1005500008136 + GRIS Buonny)
  const adValoremBerkley = 0.03 / 100; // 0,015% RCTR-C + 0,015% RCF-DC
  const grisBuonnyEstimado = 0.15 / 100; // Estimativa de mercado para escolta/monitoramento
  const custoSeguro = valorCarga * adValoremBerkley;
  const custoGris = valorCarga * grisBuonnyEstimado;
  const repasseRiscoTotal = custoSeguro + custoGris;

  // 3. MERCADO BASE (CKAN - Frete Líquido sem impostos e sem risco)
  const marketBenchmark = await fetchMarketBenchmark(cargaTipo);
  const mediaMercadoLiquido =
    ((marketBenchmark.km_20t_max + marketBenchmark.km_20t_min) / 2) * kmDistance;

  // 4. GROSS-UP FISCAL (Impostos + Margem + Risco)
  const overheadPercent = 15;
  const profitMarginPercent = 15;

  // >> Simples Nacional
  const seuSimples = calculateGrossUpHibrido(
    custosDiretos,
    overheadPercent,
    14,
    profitMarginPercent,
    0,
    true,
    false,
    false,
    0,
    0,
    0,
    0,
    repasseRiscoTotal
  );
  const mercadoSimples = calculateGrossUpHibrido(
    mediaMercadoLiquido,
    0,
    14,
    0,
    0,
    true,
    false,
    false,
    0,
    0,
    0,
    0,
    repasseRiscoTotal
  );

  // >> Lucro Presumido
  const seuLP = calculateGrossUpHibrido(
    custosDiretos,
    overheadPercent,
    0,
    profitMarginPercent,
    12,
    false,
    false,
    true,
    0.65,
    3.0,
    1.2,
    1.08,
    repasseRiscoTotal
  );
  const mercadoLP = calculateGrossUpHibrido(
    mediaMercadoLiquido,
    0,
    0,
    0,
    12,
    false,
    false,
    true,
    0.65,
    3.0,
    1.2,
    1.08,
    repasseRiscoTotal
  );

  function checkHealth(seuPrecoBruto: number, mercadoBruto: number) {
    if (seuPrecoBruto < custosDiretos)
      return `🔴 RISCO LEGAL: Autuação CIOT. Preço abaixo do Piso Motorista.`;
    if (seuPrecoBruto > mercadoBruto) {
      const difference = (seuPrecoBruto / mercadoBruto - 1) * 100;
      return `🟡 RISCO COMERCIAL: Fora do mercado (+${difference.toFixed(1)}%). Chance de perder carga.`;
    }
    return `🟢 MATCH PERFEITO: Margem de ${profitMarginPercent}% preservada e competitivo!`;
  }

  console.log('\n========================================================================');
  console.log('   MATCH DE PRECIFICAÇÃO: IMPACTO FISCAL E RISCO (SEGURO/GRIS)');
  console.log('========================================================================');
  console.log(`Rota Simulada:        ${kmDistance} km`);
  console.log(`Valor da Carga:       R$ ${valorCarga.toFixed(2)}`);
  console.log(`Custos Diretos:       R$ ${custosDiretos.toFixed(2)} (Piso ANTT/CIOT)`);
  console.log(
    `Custo Risco (Berkley):R$ ${repasseRiscoTotal.toFixed(2)} (Seguro 0,03% + GRIS 0,15%)`
  );
  console.log(`Mercado Base (CKAN):  R$ ${mediaMercadoLiquido.toFixed(2)} (Líquido)`);
  console.log('------------------------------------------------------------------------');

  console.log('>> CENÁRIO A: SIMPLES NACIONAL (Impostos = 14%)');
  console.log(
    `[MERCADO BRUTO TETO]  R$ ${mercadoSimples.totalCliente.toFixed(2)} (Custo Competitivo Real)`
  );
  console.log(`[SEU PREÇO BRUTO]     R$ ${seuSimples.totalCliente.toFixed(2)}`);
  console.log(
    `Status:               ${checkHealth(seuSimples.totalCliente, mercadoSimples.totalCliente)}`
  );

  console.log('------------------------------------------------------------------------');
  console.log('>> CENÁRIO B: LUCRO PRESUMIDO (Impostos = 17.93%)');
  console.log(
    `[MERCADO BRUTO TETO]  R$ ${mercadoLP.totalCliente.toFixed(2)} (Custo Competitivo Real)`
  );
  console.log(`[SEU PREÇO BRUTO]     R$ ${seuLP.totalCliente.toFixed(2)}`);
  console.log(`Status:               ${checkHealth(seuLP.totalCliente, mercadoLP.totalCliente)}`);
  console.log('========================================================================\n');
}

runPricingMatch().catch(console.error);
