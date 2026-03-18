# Phase D - Refactoring & Optimizations

**Status:** Documentado (pronto para implementação)  
**Estimativa:** 3-4 horas de desenvolvimento  
**Impacto:** Redução de código duplicado, melhor performance, type safety

---

## 🎯 Objetivos

1. **Reduzir duplicação** de lógica HTTP (SOAP, REST, AXA)
2. **Melhorar performance** com memoization e lazy loading
3. **Aumentar type safety** com branded types
4. **Simplificar manutenção** com logging estruturado
5. **Preparar para escala** com padrões reutilizáveis

---

## 📋 Optimizações Propostas

### 1️⃣ **BaseHttpClient** (Priority: HIGH)

**Problema:** 3 clients duplicam lógica de requisições
- `buonny-soap-client.ts` - SOAP requests
- `buonny-rest-client.ts` - REST with signing
- `axa-client.ts` - REST com headers customizados

**Solução:** Classe abstrata `BaseHttpClient`

```typescript
// src/lib/clients/BaseHttpClient.ts
export abstract class BaseHttpClient {
  protected abstract baseUrl: string;
  protected abstract headers(): Record<string, string>;
  protected abstract timeout: number;

  async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    // Shared logic:
    // - Timeout handling
    // - Error handling
    // - Retry logic
    // - Logging
  }

  protected async handleError(error: unknown): Promise<never> {
    // Centralized error mapping
    // Convert HTTP → Custom errors
  }
}

export class BuonnyRestClient extends BaseHttpClient {
  protected baseUrl = 'https://api.buonny.com.br'
  protected headers() {
    return { 'Authorization': `Bearer ${token}` }
  }
}

export class AXAClient extends BaseHttpClient {
  protected baseUrl = 'https://api.axa-seguros.com'
  protected headers() {
    return { 'X-API-Key': apiKey }
  }
}
```

**Benefícios:**
- Reduz ~150 linhas de código duplicado
- Centraliza tratamento de erros
- Timeout compartilhado
- Logging consistente

---

### 2️⃣ **Lazy Load Environment Variables** (Priority: MEDIUM)

**Problema:** Se `VITE_BUONNY_ENABLED=false`, ainda carrega credenciais

**Solução:** Lazy load com graceful degradation

```typescript
// src/lib/clients/config.ts
export const getBuonnyConfig = () => {
  const enabled = import.meta.env.VITE_BUONNY_ENABLED === 'true'
  
  if (!enabled) {
    return {
      enabled: false,
      apiKey: undefined,
      apiSecret: undefined,
    }
  }

  const apiKey = import.meta.env.VITE_BUONNY_API_KEY
  if (!apiKey) {
    console.warn('Buonny enabled but API key missing')
    return { enabled: false }
  }

  return {
    enabled: true,
    apiKey,
    apiSecret: import.meta.env.VITE_BUONNY_API_SECRET,
  }
}

// Em hooks/clients:
const config = getBuonnyConfig()
if (!config.enabled) {
  return DEFAULT_COVERAGE_OPTIONS // fallback silencioso
}
```

**Benefícios:**
- Nenhum erro se credenciais faltam
- Fallback automático para mock data
- Mais fácil ambiente de desenvolvimento

---

### 3️⃣ **Retry Logic com Exponential Backoff** (Priority: HIGH)

**Problema:** Sem retry, falha de rede causa erro imediato

**Solução:** Retry automático com backoff

```typescript
// src/lib/clients/retry.ts
export interface RetryOptions {
  maxRetries?: number      // default: 3
  initialDelay?: number    // default: 100ms
  maxDelay?: number        // default: 10s
  backoffMultiplier?: number // default: 2
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options

  let lastError: Error
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (attempt < maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * backoffMultiplier, maxDelay)
      }
    }
  }

  throw lastError!
}

// Uso:
const options = await withRetry(
  () => buonnyClient.getOptions(...),
  { maxRetries: 3, initialDelay: 100 }
)
```

**Backoff pattern:**
```
Tentativa 1: 100ms
Tentativa 2: 200ms
Tentativa 3: 400ms
Tentativa 4: 800ms
```

**Benefícios:**
- Recuperação automática de falhas transitórias
- Não sobrecarrega servidor (backoff)
- Aplicável a qualquer promise

---

### 4️⃣ **Memoization do Hook useInsuranceOptions** (Priority: MEDIUM)

**Problema:** Query key muda a cada render, invalida cache

**Solução:** Estabilizar query key com useMemo

```typescript
// src/hooks/useInsuranceOptions.ts
export function useInsuranceOptions(params: UseInsuranceOptionsParams) {
  // Estabilizar query key
  const queryKey = useMemo(
    () => [
      'insurance-options',
      params.origin_uf,
      params.destination_uf,
      params.weight,
      params.product_type,
    ],
    [params.origin_uf, params.destination_uf, params.weight, params.product_type]
  )

  const { data, isLoading, error } = useQuery({
    queryKey,  // Agora estável
    queryFn: async () => {
      // ...
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Memoizar seleção também
  const [selectedOption, setSelectedOption] = useState<InsuranceOption | null>(null)
  
  const memoizedSelectedOption = useMemo(
    () => selectedOption,
    [selectedOption?.coverage_type, selectedOption?.estimated_premium]
  )

  return {
    data: data ?? [],
    isLoading,
    error,
    selectedOption: memoizedSelectedOption,
    setSelectedOption,
  }
}
```

**Benefícios:**
- Cache não invalida desnecessariamente
- Menos requisições à API
- Melhor UX (dados persistem)

---

### 5️⃣ **React.memo para Componentes Caros** (Priority: MEDIUM)

**Problema:** InsuranceSelector re-renderiza mesmo sem mudanças

**Solução:** Memoizar com comparação customizada

```typescript
// src/components/insurance/InsuranceSelector.tsx
interface InsuranceSelectorProps {
  options: InsuranceOption[]
  selectedCoverage?: string
  onSelectCoverage: (coverage: string) => void
  loading?: boolean
  error?: string
}

// Função comparação customizada
const arePropsEqual = (
  prev: InsuranceSelectorProps,
  next: InsuranceSelectorProps
) => {
  return (
    prev.selectedCoverage === next.selectedCoverage &&
    prev.loading === next.loading &&
    prev.error === next.error &&
    prev.options.length === next.options.length &&
    prev.options.every((opt, idx) => 
      JSON.stringify(opt) === JSON.stringify(next.options[idx])
    )
  )
}

export const InsuranceSelector = React.memo(
  function InsuranceSelector(props: InsuranceSelectorProps) {
    // Component JSX
  },
  arePropsEqual
)
```

**Benefícios:**
- Evita re-renderizações desnecessárias
- Melhor performance em listas grandes
- Controle fino sobre comparação

---

### 6️⃣ **Code Splitting com Lazy Loading** (Priority: MEDIUM)

**Problema:** Insurance components carregam no bundle principal

**Solução:** Lazy load com Suspense boundary

```typescript
// src/components/forms/quote-form/QuoteFormWizard.tsx
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load o passo de seguro
const InsuranceStep = lazy(
  () => import('./steps/InsuranceStep').then(m => ({ default: m.InsuranceStep }))
)

// Skeleton fallback
const InsuranceStepSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
)

// No render:
{step === 3 && (
  <Suspense fallback={<InsuranceStepSkeleton />}>
    <InsuranceStep form={form} />
  </Suspense>
)}
```

**Benefícios:**
- Reduz bundle principal
- Carregamento on-demand (passo 3)
- Melhor time-to-interactive

---

### 7️⃣ **Strict TypeScript Config** (Priority: HIGH)

**Problema:** TypeScript config permite `any` implícito

**Solução:** Ativar flags strict

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**Benefícios:**
- Erros em tempo de compilação
- Melhor autocomplete
- Código mais seguro

---

### 8️⃣ **Branded Types para IDs** (Priority: HIGH)

**Problema:** Confunde `quote_id` com `trip_id`

```typescript
// Antes (confuso):
async function updateQuote(quoteId: string) { ... }
async function createTrip(quoteId: string) { ... }
// Ambos são string, fácil confundir!

// Depois (claro):
type QuoteId = string & { readonly __brand: 'QuoteId' }
type TripId = string & { readonly __brand: 'TripId' }

const createQuoteId = (id: string): QuoteId => id as QuoteId

async function updateQuote(quoteId: QuoteId) { ... }
async function createTrip(quoteId: QuoteId) { ... }
// Erro em tempo de compilação se trocar!
```

**Benefícios:**
- Type safety sem overhead runtime
- Documentação automática
- IDE autocomplete correto

---

### 9️⃣ **Structured Logging JSON** (Priority: MEDIUM)

**Problema:** console.log disperso, difícil de parsear

**Solução:** Logger estruturado

```typescript
// src/lib/logger.ts
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  context: string      // módulo/função
  message: string
  data?: Record<string, unknown>
  duration?: number    // ms
}

export class Logger {
  log(context: string, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      context,
      message,
      data: typeof data === 'object' ? data : { value: data },
    }
    console.log(JSON.stringify(entry))
  }

  error(context: string, message: string, error: Error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      context,
      message,
      error: error.message,
      stack: error.stack,
    }))
  }
}

// Uso:
const logger = new Logger()
logger.log('InsuranceStep', 'Options loaded', { count: options.length })
logger.error('InsuranceStep', 'API call failed', error)
```

**Benefícios:**
- Logs estruturados para parsing
- Fácil enviar para serviço de logging
- Contexto incluído automaticamente

---

### 🔟 **Custom Error Types** (Priority: HIGH)

**Problema:** Tratamento de erro genérico

**Solução:** Tipos de erro customizados

```typescript
// src/lib/errors.ts
export class BuonnyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'BuonnyError'
  }
}

export class AuthenticationError extends BuonnyError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401)
  }
}

export class TimeoutError extends BuonnyError {
  constructor(message: string) {
    super(message, 'TIMEOUT', 504)
  }
}

export class ValidationError extends BuonnyError {
  constructor(message: string, public fields: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400)
  }
}

// Uso:
try {
  const options = await getInsuranceOptions(...)
} catch (error) {
  if (error instanceof AuthenticationError) {
    showAlert('Credenciais Buonny inválidas')
  } else if (error instanceof TimeoutError) {
    showAlert('Timeout - tente novamente')
  } else if (error instanceof ValidationError) {
    showErrors(error.fields)
  }
}
```

**Benefícios:**
- Tratamento granular de erros
- Type-safe error handling
- Melhor mensagens ao usuário

---

### 1️⃣1️⃣ **Utility Functions & Constants** (Priority: MEDIUM)

**Problema:** Valores magic espalhados pelo código

**Solução:** Constants centralizadas

```typescript
// src/lib/insurance-utils.ts
export const INSURANCE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000,      // 5 min
  GC_TIME: 10 * 60 * 1000,        // 10 min
  CACHE_SIZE: 100,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
} as const

export const COVERAGE_LEVELS = {
  BASIC: { name: 'Básica', multiplier: 0.5 },
  STANDARD: { name: 'Padrão', multiplier: 1.0 },
  PLUS: { name: 'Premium', multiplier: 1.5 },
} as const

export function calculatePremium(
  baseValue: number,
  coverage: keyof typeof COVERAGE_LEVELS
): number {
  return baseValue * COVERAGE_LEVELS[coverage].multiplier
}
```

**Benefícios:**
- Valores centralizados
- Fácil manutenção
- Type-safe constants

---

### 1️⃣2️⃣ **JSDoc Documentation** (Priority: LOW)

**Problema:** Funções sem documentação

**Solução:** JSDoc completo

```typescript
/**
 * Busca opções de seguro disponíveis para uma rota.
 *
 * @param params - Parâmetros da busca
 * @param params.origin_uf - UF de origem (ex: 'SP')
 * @param params.destination_uf - UF de destino (ex: 'RJ')
 * @param params.weight - Peso da carga em KG
 * @param params.product_type - Tipo de produto (default: 'general')
 *
 * @returns Promise com opções de seguro ou mock data
 *
 * @throws {BuonnyError} Se API falhar após retries
 *
 * @example
 * ```typescript
 * const options = await getInsuranceOptions({
 *   origin_uf: 'SP',
 *   destination_uf: 'RJ',
 *   weight: 1000,
 * })
 * ```
 */
export async function getInsuranceOptions(
  params: UseInsuranceOptionsParams
): Promise<InsuranceOption[]> {
  // ...
}
```

**Benefícios:**
- IDE mostra documentação
- Melhor developer experience
- Documentação automática

---

## 📊 Impacto Esperado

| Otimização | Código -% | Performance | Type Safety |
|---|---|---|---|
| BaseHttpClient | 25% | ↑ 10% | ↑ 30% |
| Lazy Loading | 15% | ↑ 20% | - |
| Memoization | - | ↑ 15% | - |
| React.memo | - | ↑ 10% | - |
| Retry Logic | +2% | ↑ 5% (confiabilidade) | - |
| Branded Types | - | - | ↑ 40% |
| Error Types | - | - | ↑ 25% |
| **Total** | **67%** | **↑ 60%** | **↑ 95%** |

---

## ⏱️ Estimativa de Esforço

| Tarefa | Horas | Dificuldade |
|---|---|---|
| 1. BaseHttpClient | 1.0 | ⭐⭐⭐ |
| 2. Lazy Load Env | 0.5 | ⭐ |
| 3. Retry Logic | 1.0 | ⭐⭐ |
| 4. Memoization | 0.5 | ⭐⭐ |
| 5. React.memo | 0.5 | ⭐ |
| 6. Code Splitting | 0.5 | ⭐⭐ |
| 7. Strict TypeScript | 0.3 | ⭐⭐⭐ |
| 8. Branded Types | 0.3 | ⭐⭐ |
| 9. Structured Logging | 0.3 | ⭐ |
| 10. Custom Errors | 0.3 | ⭐ |
| 11. Utils/Constants | 0.2 | ⭐ |
| 12. JSDoc | 0.3 | ⭐ |
| **Testes** | 0.5 | ⭐⭐ |
| **Total** | **6.2h** | - |

---

## ✅ Checklist de Implementação

- [ ] 1. Criar BaseHttpClient abstrato
- [ ] 2. Refatorar BuonnyRestClient com herança
- [ ] 3. Refatorar AXAClient com herança
- [ ] 4. Implementar lazy load de env vars
- [ ] 5. Criar utility `withRetry` e aplicar em todos os clients
- [ ] 6. Adicionar useMemo em useInsuranceOptions
- [ ] 7. Envolver componentes com React.memo
- [ ] 8. Lazy load InsuranceStep com Suspense
- [ ] 9. Ativar strict: true em tsconfig.json
- [ ] 10. Criar branded types (QuoteId, TripId, etc)
- [ ] 11. Criar Logger estruturado
- [ ] 12. Criar custom error classes
- [ ] 13. Centralizar constants
- [ ] 14. Adicionar JSDoc em funções críticas
- [ ] 15. Rodar testes e lint
- [ ] 16. Validar performance (lighthouse)

---

## 🚀 Próximas Fases

Após Phase D completo:

- **Phase E (Operacional):** Monitoring, alertas, runbook
- **Testes E2E:** Quando credenciais Buonny chegarem
- **Deploy:** Preparação para produção

---

**Status:** Documentado e pronto para implementação  
**Bloqueadores:** Nenhum  
**Dependências:** Nenhuma (Phase D é independente)
