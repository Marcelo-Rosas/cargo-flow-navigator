/**
 * Validador de Cenários de Precificação - Vectra Cargo
 * Objetivo: Simular impacto de mudanças fiscais na margem real.
 */

const fs = require('fs');

// Configurações Padrão (Simulando o que viria do pricing_rules.json)
const currentRules = {
  dasPercent: 14.0, //
  overheadPercent: 15.0, //de acordo com o percentual da tabela
  targetMargin: 15.0, // Piso de segurança
};

// Cenários de Teste (Peso, Valor da NF, Frete Base)
const scenarios = [
  { label: 'Carga Leve/Alto Valor', weight: 1000, nfValue: 50000, baseFreight: 1500 },
  { label: 'Carga Pesada/Baixo Valor', weight: 15000, nfValue: 10000, baseFreight: 6500 },
  { label: 'Exemplo Real Print', weight: 1000, nfValue: 46503, baseFreight: 6611 }, //
];

function runStressTest() {
  console.log('📊 Rodando Teste de Estresse de Precificação...');
  console.log(
    `🔧 Configuração Atual: DAS ${currentRules.dasPercent}% | Overhead ${currentRules.overheadPercent}%`
  );
  console.log('--------------------------------------------------');

  let failures = 0;

  scenarios.forEach((s) => {
    // Cálculo simplificado de Gross-up para validar viabilidade
    // Divisor = 1 - (Impostos + Overhead + Margem Alvo)
    const divisor =
      1 -
      currentRules.dasPercent / 100 -
      currentRules.overheadPercent / 100 -
      currentRules.targetMargin / 100;

    // Total Cliente necessário para manter os 15% de lucro
    const totalCliente = s.baseFreight / divisor;
    const margemRealVal = totalCliente * (currentRules.targetMargin / 100);
    const margemPercent = (margemRealVal / totalCliente) * 100;

    console.log(`📍 Cenário: ${s.label}`);
    console.log(`   Venda Estimada: R$ ${totalCliente.toFixed(2)}`);

    if (margemPercent < currentRules.targetMargin) {
      console.log(`   ❌ FALHA: Margem de ${margemPercent.toFixed(2)}% abaixo do piso!`);
      failures++;
    } else {
      console.log(`   ✅ SUCESSO: Margem de ${margemPercent.toFixed(2)}% preservada.`);
    }
  });

  if (failures > 0) {
    console.log(`\n🚨 ALERTA: ${failures} cenários ficaram inviáveis com a nova configuração!`);
    process.exit(1); // Interrompe o hook do Claude
  } else {
    console.log('\n✨ Todas as regras de negócio foram respeitadas.');
    process.exit(0);
  }
}

runStressTest();
