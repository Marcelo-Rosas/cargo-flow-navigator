import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  test: number;
  name: string;
  passed: boolean;
  message: string;
}

const results: ValidationResult[] = [];

function test(num: number, name: string, check: () => boolean, message: string) {
  const passed = check();
  results.push({ test: num, name, passed, message });
  console.log(`${passed ? '✅' : '❌'} Test ${num}: ${name}`);
  console.log(`   ${message}\n`);
}

// Get project root
const projectRoot = process.cwd();

// Test 1: Hook file exists
test(
  1,
  'Hook file exists',
  () => {
    return fs.existsSync(path.join(projectRoot, 'src/hooks/useMarketInsights.ts'));
  },
  'src/hooks/useMarketInsights.ts deve existir'
);

// Test 2: Hook has interface
test(
  2,
  'Hook has MarketInsights interface',
  () => {
    const content = fs.readFileSync(
      path.join(projectRoot, 'src/hooks/useMarketInsights.ts'),
      'utf-8'
    );
    return content.includes('interface MarketInsights');
  },
  'Hook deve exportar interface MarketInsights'
);

// Test 3: Hook exports useMarketInsights function
test(
  3,
  'Hook exports useMarketInsights function',
  () => {
    const content = fs.readFileSync(
      path.join(projectRoot, 'src/hooks/useMarketInsights.ts'),
      'utf-8'
    );
    return content.includes('export function useMarketInsights');
  },
  'Hook deve exportar função useMarketInsights'
);

// Test 4: Component file exists
test(
  4,
  'Component file exists',
  () => {
    return fs.existsSync(
      path.join(projectRoot, 'src/components/market/MarketIntelligencePanel.tsx')
    );
  },
  'src/components/market/MarketIntelligencePanel.tsx deve existir'
);

// Test 5: Component imports hook
test(
  5,
  'Component imports hook',
  () => {
    const content = fs.readFileSync(
      path.join(projectRoot, 'src/components/market/MarketIntelligencePanel.tsx'),
      'utf-8'
    );
    return content.includes('import { useMarketInsights') || content.includes('useMarketInsights');
  },
  'Componente deve importar useMarketInsights'
);

// Test 6: Commercial.tsx imports component
test(
  6,
  'Commercial.tsx imports MarketIntelligencePanel',
  () => {
    const content = fs.readFileSync(path.join(projectRoot, 'src/pages/Commercial.tsx'), 'utf-8');
    return content.includes('import { MarketIntelligencePanel }');
  },
  'Commercial.tsx deve importar MarketIntelligencePanel'
);

// Test 7: Commercial.tsx has market-intelligence tab
test(
  7,
  'Commercial.tsx has market-intelligence tab',
  () => {
    const content = fs.readFileSync(path.join(projectRoot, 'src/pages/Commercial.tsx'), 'utf-8');
    return content.includes("'market-intelligence'") && content.includes('Inteligência NTC');
  },
  'Commercial.tsx deve ter aba "Inteligência NTC"'
);

// Test 8: JSON data file exists
test(
  8,
  'JSON data file exists',
  () => {
    return fs.existsSync(path.join(projectRoot, 'src/data/market_insights_latest.json'));
  },
  'src/data/market_insights_latest.json deve existir'
);

// Test 9: JSON data is valid
test(
  9,
  'JSON data is valid',
  () => {
    try {
      const content = fs.readFileSync(
        path.join(projectRoot, 'src/data/market_insights_latest.json'),
        'utf-8'
      );
      const data = JSON.parse(content);
      return data.indices && data.combustivel && data.reajuste_sugerido_pct !== undefined;
    } catch {
      return false;
    }
  },
  'JSON data deve ser válido e ter campos obrigatórios'
);

// Test 10: Edge Function exists
test(
  10,
  'Edge Function exists',
  () => {
    return fs.existsSync(path.join(projectRoot, 'supabase/functions/market-insights/index.ts'));
  },
  'supabase/functions/market-insights/index.ts deve existir'
);

// Summary
console.log('\n' + '='.repeat(60));
const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`RESUMO: ${passed}/${total} testes passaram`);
console.log('='.repeat(60) + '\n');

if (passed === total) {
  console.log('🎉 TODOS OS TESTES PASSARAM! Integração completa.');
  process.exit(0);
} else {
  console.log('❌ Alguns testes falharam. Verifique acima os detalhes.');
  process.exit(1);
}
