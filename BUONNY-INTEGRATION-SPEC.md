# 🛡️ BUONNY INTEGRATION SPECIFICATION - CARGO FLOW NAVIGATOR

**Status:** Sprint Planning (Credenciais aguardadas)  
**Target:** Sprint 2 (Maio 2026) + Sprint 3 (Junho 2026)  
**Owner:** Equipe de Desenvolvimento Vectra Cargo  
**Last Updated:** 2026-03-17

---

## 1. VISÃO GERAL

### Objetivo
Integrar **Buonny** (plataforma de seguros) no fluxo de cotações do Cargo Flow Navigator para:
- ✅ Validar compliance do motorista + veículo (SOAP)
- ✅ Avaliar risco automaticamente
- ✅ Sugerir coberturas de seguro
- ✅ Incluir prêmio de seguro no preço final da cotação
- ✅ Criar viagens no Integrador (API AXA) com dados de seguro

### Escopo Sprint 2 & 3

**Sprint 2 (Maio):**
- Implementar clients SOAP + REST (Buonny + API AXA)
- Refatorar `buonny-check` stub → cliente real
- Criar UI para seleção de seguros
- E2E tests

**Sprint 3 (Junho):**
- Deploy em produção
- Webhook handler (Buonny callbacks)
- Agente de risco + orquestração
- Monitoramento + dashboards

---

## 2. ARQUITETURA TÉCNICA

### 2.1 Fluxo de Integração

```
┌─────────────────────────────────────┐
│ User creates Quote (Cotação)        │
│ - Origin/Destination                │
│ - Product + Weight                  │
│ - Driver + Vehicle                  │
└──────────────┬──────────────────────┘
               │
               ↓
    ┌──────────────────────────┐
    │ [calculate-freight]      │
    │ → calculates base price  │
    └──────────┬───────────────┘
               │
               ↓
    ┌──────────────────────────────────────┐
    │ [buonny-check-worker] (NEW)          │
    │ ├─ Call SOAP: consultaProfissional   │
    │ ├─ Validate driver + vehicle risk    │
    │ └─ Get risk_score + suggested covers │
    └──────────┬───────────────────────────┘
               │
               ↓
    ┌──────────────────────────────┐
    │ [UI] Show Insurance Options   │
    │ - BASIC: RC (Min coverage)    │
    │ - STANDARD: RC + CMR          │
    │ - PLUS: Full coverage         │
    │ - CUSTOM: Select add-ons      │
    └──────────┬──────────────────┘
               │
               ↓
    ┌──────────────────────────────────┐
    │ [calculate-insurance-premium]     │
    │ ├─ Base price + Risk factors      │
    │ ├─ Coverage level multiplier      │
    │ └─ Final total price              │
    └──────────┬───────────────────────┘
               │
               ↓
    ┌──────────────────────────────────────┐
    │ Quote Ready (with Insurance)         │
    │ - Price includes premium             │
    │ - Insurance selected                 │
    │ - Compliance validated               │
    └──────────┬───────────────────────────┘
               │ User sends quote
               ↓
    ┌──────────────────────────────────────┐
    │ Quote Approved + Order Created       │
    │ (Auto or Manual)                     │
    └──────────┬───────────────────────────┘
               │
               ↓
    ┌──────────────────────────────────────────┐
    │ [buonny-create-trip] (Sprint 3)          │
    │ ├─ Call API AXA (Integrador)             │
    │ ├─ Create "Viagem" + insurance policy    │
    │ └─ Link to order_trips                   │
    └──────────────────────────────────────────┘
```

### 2.2 Componentes a Criar

```typescript
// supabase/functions/_shared/
├── buonny-soap-client.ts      // SOAP operations
├── buonny-rest-client.ts      // REST + webhooks
├── buonny-axa-client.ts       // API AXA (Integrador)
└── buonny-types.ts            // Shared types

// supabase/functions/
├── buonny-check/index.ts      // (REFACTOR: stub → real)
├── buonny-callback-handler/   // NEW: webhook receiver
└── buonny-create-trip/        // NEW: create viagem

// src/components/quotes/
├── InsuranceSelector.tsx      // NEW: coverage options
├── InsurancePremiumCalculator.tsx  // NEW
└── InsuranceSummary.tsx        // NEW

// src/hooks/
└── useInsuranceOptions.ts      // NEW: fetch + calc premiums

// tests/e2e/
└── flows/insurance-quote-flow.spec.ts  // NEW
```

---

## 3. DETALHAMENTO: EDGE FUNCTIONS

### 3.1 SOAP Client - `buonny-soap-client.ts`

**Responsabilidade:** Comunicação com serviços SOAP da Buonny

```typescript
// Estrutura
export class BuonnySoapClient {
  private wsdlUrl: string;
  private auth: { token: string; cnpj: string };

  // OPERAÇÃO 1: Consulta Profissional
  async consultaProfissional(payload: ConsultaProfissionalRequest): Promise<ConsultaProfissionalResponse> {
    // SOAP call via tstportal.buonny.com.br
    // Input: driver_cpf, vehicle_plate, cargo_type, value_km, risk_level
    // Output: { status, risk_score, coverage_recommendation }
  }

  // OPERAÇÃO 2: Consulta Veículo por Entrega
  async consultaVeiculoPorEntrega(payload: ConsultaVeiculoRequest): Promise<ConsultaVeiculoResponse> {
    // Valida se veículo pode fazer entrega (restrições)
    // Input: vehicle_plate, cargo_type, route
    // Output: { approved, restrictions[] }
  }

  // OPERAÇÃO 3: Informações de Viagem
  async informacoesViagem(payload: InformacoesViagemRequest): Promise<InformacoesViagemResponse> {
    // Busca dados de viagem/apólice
    // Input: order_id ou trip_id
    // Output: { policy_number, coverage[], expiry_date }
  }

  // OPERAÇÃO 4: Status da Entrega
  async statusEntrega(payload: StatusEntregaRequest): Promise<StatusEntregaResponse> {
    // Monitora entrega em tempo real
    // Input: trip_id, checkpoint
    // Output: { current_status, timestamp, location }
  }
}
```

**Configuração:**
```typescript
const client = new BuonnySoapClient({
  wsdlUrl: process.env.BUONNY_WSDL_URL, // tstportal.buonny.com.br
  token: process.env.BUONNY_TOKEN,
  cnpj: process.env.BUONNY_CNPJ,
  timeout: 10000,
  retries: 3,
  circuitBreaker: true, // Falha rápida se Buonny down
});
```

---

### 3.2 REST Client - `buonny-rest-client.ts`

**Responsabilidade:** Chamadas REST + Webhooks

```typescript
export class BuonnyRestClient {
  // AUTH: 2-step (login → Bearer token)
  async authenticateCallback(): Promise<{ token: string; expiresIn: number }> {
    // POST /api/v3/auth/login (tstapi.buonny.com.br)
    // Returns temporary Bearer token (15min)
  }

  // GET: Buscar retorno de fichas com filtros
  async getRetornoFicha(filters: RetornoFichaFilters): Promise<RetornoFicha[]> {
    // GET /api/v3/retorno-ficha?status=FINALIZADO&limit=100
  }

  // WEBHOOK: Registrar endpoint para callbacks
  async registerWebhookEndpoint(endpoint: string): Promise<{ registered: true }> {
    // PUT /api/v3/webhook/config
    // Endpoint: https://nossa-api/functions/v1/buonny-callback-handler
  }
}
```

---

### 3.3 API AXA Client - `buonny-axa-client.ts`

**Responsabilidade:** Integração com API do Integrador (Nstech)

```typescript
export class BuonnyAxaClient {
  private baseUrl: string;
  private auth: { token: string };

  // CREATE: Criar viagem/SM (Serviço de Movimentação)
  async createTrip(payload: CreateTripRequest): Promise<CreateTripResponse> {
    // POST /api/trips
    // Input: {
    //   cdcliente: "123",      // cliente ID (Buonny)
    //   cdtransp: "456",       // transportador ID
    //   cdcidorigem: "3600",   // IBGE city code
    //   cdciddestino: "3549",
    //   produto: "CARGA_GERAL",
    //   valor_carga: 10000,
    //   data_coleta: "2026-04-20",
    //   policy_number: "AXA-123456",  // apólice seguro
    //   coverage_level: "PLUS",
    // }
    // Output: { trip_id, sm_number, status }
  }

  // GET: Status da viagem
  async getTripStatus(tripId: string): Promise<TripStatusResponse> {
    // GET /api/trips/{tripId}
  }

  // UPDATE: Atualizar status entrega
  async updateDeliveryStatus(tripId: string, status: DeliveryStatus): Promise<void> {
    // PATCH /api/trips/{tripId}/status
  }
}
```

---

### 3.4 Edge Function: `buonny-check/index.ts` (REFACTOR)

**Antes (Stub):**
```typescript
serve(async (req: Request) => {
  // Hardcoded response
  return { status: 'aprovado', score: 85 };
});
```

**Depois (Real):**
```typescript
serve(async (req: Request) => {
  const { driver_cpf, vehicle_plate, cargo_type, value_km, order_id } = await req.json();
  const supabase = createClient(...);

  try {
    const client = new BuonnySoapClient();

    // 1. Chamar SOAP Buonny
    const checkResult = await client.consultaProfissional({
      driver_cpf,
      vehicle_plate,
      cargo_type,
      value_km,
      risk_level: 'standard',
    });

    // 2. Map response
    const status = mapBuonnyStatus(checkResult.status);
    const riskScore = calculateRiskScore(checkResult);

    // 3. Persist result
    await supabase
      .from('risk_evidence')
      .insert({
        order_id,
        provider: 'buonny',
        status,
        risk_score: riskScore,
        raw_response: checkResult,
      });

    // 4. Return
    return new Response(
      JSON.stringify({
        success: true,
        status,
        risk_score: riskScore,
        coverage_recommendation: checkResult.coverage_suggestion,
      })
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        fallback_status: 'pending_manual_review',
      }),
      { status: 500 }
    );
  }
});
```

---

### 3.5 Edge Function: `buonny-callback-handler/index.ts` (NEW)

**Responsabilidade:** Receber webhooks da Buonny (atualizações de status)

```typescript
serve(async (req: Request) => {
  // 1. Validate webhook (Bearer token / signature)
  const authHeader = req.headers.get('authorization');
  if (!isValidWebhookSignature(authHeader)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Parse payload
  const event = await req.json();
  // {
  //   event_type: "policy_issued" | "claim_approved" | "trip_completed",
  //   trip_id: "xyz",
  //   policy_number: "AXA-123456",
  //   status: "FINALIZADO",
  //   timestamp: "2026-05-15T14:30:00Z",
  // }

  // 3. Publish to Event Bus (workflow_events)
  const supabase = createClient(...);
  await supabase
    .from('workflow_events')
    .insert({
      event_type: 'buonny_webhook',
      trip_id: event.trip_id,
      payload: event,
      created_at: new Date().toISOString(),
    });

  // 4. Trigger orchestrator (se necessário)
  if (event.event_type === 'policy_issued') {
    await supabase.functions.invoke('workflow-orchestrator', {
      body: { event_type: 'buonny_policy_issued', trip_id: event.trip_id }
    });
  }

  return new Response(
    JSON.stringify({ success: true, event_id: event.trip_id }),
    { status: 200 }
  );
});
```

---

### 3.6 Edge Function: `buonny-create-trip/index.ts` (NEW)

**Responsabilidade:** Criar viagem no Integrador quando ordem é criada

```typescript
serve(async (req: Request) => {
  const { order_id, insurance_coverage } = await req.json();
  const supabase = createClient(...);

  try {
    // 1. Fetch order + quote data
    const { data: order } = await supabase
      .from('order_trips')
      .select(`
        *,
        quotes (
          id, price, cost, origin_city, destination_city,
          product_type, weight, volume
        )
      `)
      .eq('id', order_id)
      .single();

    // 2. Map to Integrador format
    const tripPayload = {
      cdcliente: mapClientToIntegradorCode(order.client_id),
      cdtransp: mapTransporterToIntegradorCode(order.company_id),
      cdcidorigem: mapCityToIntegradorCode(order.quotes.origin_city),
      cdciddestino: mapCityToIntegradorCode(order.quotes.destination_city),
      produto: mapProductType(order.quotes.product_type),
      valor_carga: order.quotes.price / 100, // centavos → reais
      peso: order.quotes.weight,
      volume: order.quotes.volume,
      data_coleta: order.pickup_date,
      policy_number: insurance_coverage.policy_number,
      coverage_level: insurance_coverage.level, // BASIC | STANDARD | PLUS
    };

    // 3. Call API AXA
    const axaClient = new BuonnyAxaClient();
    const result = await axaClient.createTrip(tripPayload);

    // 4. Update order with Integrador data
    await supabase
      .from('order_trips')
      .update({
        integrador_trip_id: result.trip_id,
        integrador_sm_number: result.sm_number,
        insurance_policy_number: insurance_coverage.policy_number,
      })
      .eq('id', order_id);

    return new Response(
      JSON.stringify({
        success: true,
        trip_id: result.trip_id,
        sm_number: result.sm_number,
      })
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        order_id,
      }),
      { status: 500 }
    );
  }
});
```

---

## 4. UI COMPONENTS

### 4.1 `InsuranceSelector.tsx`

```typescript
interface InsuranceSelectorProps {
  quoteId: string;
  driverRiskScore: number; // 0-100
  recommendedCoverage: 'BASIC' | 'STANDARD' | 'PLUS';
  onSelect: (coverage: InsuranceCoverage) => void;
}

export function InsuranceSelector({
  driverRiskScore,
  recommendedCoverage,
  onSelect,
}: InsuranceSelectorProps) {
  const options = [
    {
      level: 'BASIC',
      name: 'Básico (RC)',
      features: ['Responsabilidade Civil'],
      premium: 150, // R$
      recommended: recommendedCoverage === 'BASIC',
      badge: 'Mínimo legal',
    },
    {
      level: 'STANDARD',
      name: 'Padrão (RC + CMR)',
      features: ['Responsabilidade Civil', 'Cobertura CMR'],
      premium: 350,
      recommended: recommendedCoverage === 'STANDARD',
      badge: 'Recomendado',
    },
    {
      level: 'PLUS',
      name: 'Completo (Cobertura Total)',
      features: [
        'Responsabilidade Civil',
        'CMR Expandida',
        'Roubo + Furto',
        'Boné Risco',
      ],
      premium: 600,
      recommended: driverRiskScore > 70,
      badge: 'Risco elevado',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {options.map((opt) => (
        <Card
          key={opt.level}
          className={opt.recommended ? 'border-2 border-green-500' : ''}
          onClick={() => onSelect(opt)}
        >
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3>{opt.name}</h3>
              {opt.recommended && (
                <Badge className="bg-green-500">✓ {opt.badge}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {opt.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="text-xl font-bold mt-4 text-blue-600">
              +R$ {opt.premium.toFixed(2)}/viagem
            </p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant={opt.recommended ? 'default' : 'outline'}
            >
              Selecionar
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
```

### 4.2 `InsuranceSummary.tsx`

```typescript
interface InsuranceSummaryProps {
  basePrice: number; // cotação base
  insurance: InsuranceCoverage;
}

export function InsuranceSummary({ basePrice, insurance }: InsuranceSummaryProps) {
  const total = basePrice + insurance.premium * 100; // centavos

  return (
    <div className="border rounded-lg p-4 bg-slate-50">
      <h3 className="font-bold mb-3">Resumo da Cotação</h3>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span>Valor Frete (base)</span>
          <span>R$ {(basePrice / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-blue-600">
          <span>Seguro {insurance.level}</span>
          <span>+R$ {insurance.premium.toFixed(2)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Valor Total</span>
          <span className="text-green-600">R$ {(total / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
        <p className="font-semibold text-blue-900">📋 Cobertura Incluída:</p>
        <ul className="mt-1 space-y-1">
          {insurance.features.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## 5. TIPOS & INTERFACES

```typescript
// src/types/insurance.ts

export type InsuranceLevel = 'BASIC' | 'STANDARD' | 'PLUS';

export interface InsuranceCoverage {
  level: InsuranceLevel;
  features: string[];
  premium: number; // R$ decimal
  policy_number?: string;
  expiry_date?: string;
}

export interface BuonnyCheckResponse {
  status: 'aprovado' | 'em_analise' | 'reprovado' | 'expirado' | 'erro';
  risk_score: number; // 0-100
  coverage_recommendation: InsuranceLevel;
  restrictions?: string[];
  message?: string;
}

export interface CreateTripRequest {
  cdcliente: string;
  cdtransp: string;
  cdcidorigem: string;
  cdciddestino: string;
  produto: string;
  valor_carga: number;
  peso: number;
  volume: number;
  data_coleta: string;
  policy_number: string;
  coverage_level: InsuranceLevel;
}

export interface CreateTripResponse {
  trip_id: string;
  sm_number: string;
  status: 'pending' | 'confirmed';
}
```

---

## 6. HOOKS REACT

```typescript
// src/hooks/useInsuranceOptions.ts

export function useInsuranceOptions(quoteId: string) {
  const [options, setOptions] = useState<InsuranceCoverage[]>([]);
  const [loading, setLoading] = useState(false);
  const [recommendedLevel, setRecommendedLevel] = useState<InsuranceLevel>('STANDARD');

  useEffect(() => {
    const fetchOptions = async () => {
      setLoading(true);
      try {
        // 1. Call buonny-check
        const checkResult = await invokeEdgeFunction('buonny-check', {
          quote_id: quoteId,
        });

        // 2. Calculate premiums
        const premiums = calculateInsurancePremiums(checkResult.risk_score);

        setOptions([
          { level: 'BASIC', premium: premiums.basic, features: [...] },
          { level: 'STANDARD', premium: premiums.standard, features: [...] },
          { level: 'PLUS', premium: premiums.plus, features: [...] },
        ]);

        setRecommendedLevel(checkResult.coverage_recommendation);
      } catch (error) {
        toast.error('Erro ao carregar opções de seguro');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [quoteId]);

  return { options, loading, recommendedLevel };
}
```

---

## 7. BANCO DE DADOS - MUDANÇAS

```sql
-- Adicionar coluna à tabela quotes
ALTER TABLE quotes ADD COLUMN insurance_coverage VARCHAR(50) DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN insurance_premium INTEGER DEFAULT 0; -- centavos

-- Adicionar coluna à tabela order_trips
ALTER TABLE order_trips ADD COLUMN insurance_policy_number VARCHAR(100) DEFAULT NULL;
ALTER TABLE order_trips ADD COLUMN integrador_trip_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE order_trips ADD COLUMN integrador_sm_number VARCHAR(100) DEFAULT NULL;

-- Tabela para tracking de apólices
CREATE TABLE insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  order_id UUID REFERENCES order_trips(id),
  policy_number VARCHAR(100) NOT NULL UNIQUE,
  coverage_level VARCHAR(20) NOT NULL, -- BASIC | STANDARD | PLUS
  premium_amount INTEGER NOT NULL, -- centavos
  issued_at TIMESTAMP DEFAULT NOW(),
  expiry_at TIMESTAMP,
  status VARCHAR(20), -- active | claimed | expired
  buonny_response JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
);

-- Index para performance
CREATE INDEX idx_insurance_policies_quote_id ON insurance_policies(quote_id);
CREATE INDEX idx_insurance_policies_policy_number ON insurance_policies(policy_number);
```

---

## 8. TESTES E2E

```typescript
// tests/e2e/flows/insurance-quote-flow.spec.ts

describe('Quote with Insurance Flow', () => {
  it('Should display insurance options after Buonny validation', async () => {
    // 1. Create quote
    await page.goto('/quotes/new');
    await fillQuoteForm({
      origin: 'São Paulo',
      destination: 'Rio de Janeiro',
      weight: 5000,
      product: 'ELETRÔNICOS',
      driver_cpf: '123.456.789-00',
      vehicle_plate: 'ABC-1234',
    });

    // 2. Submit for insurance check
    await page.click('[data-testid="check-insurance-btn"]');
    await page.waitForLoadingToFinish();

    // 3. Assert insurance options visible
    expect(await page.locator('[data-testid="insurance-basic"]')).toBeVisible();
    expect(await page.locator('[data-testid="insurance-standard"]')).toBeVisible();
    expect(await page.locator('[data-testid="insurance-plus"]')).toBeVisible();
  });

  it('Should select insurance and update price', async () => {
    // ... setup quote ...

    const basePrice = await page.locator('[data-testid="base-price"]').textContent();
    
    // Select STANDARD insurance
    await page.click('[data-testid="insurance-standard"] button');
    await page.waitForTimeout(1000);

    const totalPrice = await page.locator('[data-testid="total-price"]').textContent();
    
    // Assert price increased
    expect(parseInt(totalPrice) > parseInt(basePrice)).toBe(true);
  });

  it('Should create trip in Integrador after order creation', async () => {
    // ... create and send quote ...

    // Wait for auto-approval
    await page.waitForLoadingToFinish();

    // Check if trip was created in Integrador
    const tripId = await page.locator('[data-testid="trip-integrador-id"]').textContent();
    expect(tripId).toBeTruthy();
  });
});
```

---

## 9. ROLLOUT PLAN

### Sprint 2 (Maio)

**Semana 1-2: Clients + Refactor**
- [ ] Implementar `buonny-soap-client.ts` + testes
- [ ] Implementar `buonny-rest-client.ts` + testes
- [ ] Refatorar `buonny-check/index.ts` (stub → real)
- [ ] Feature flag: `BUONNY_USE_STUB` para dev local

**Semana 3-4: UI + Tests**
- [ ] Criar `InsuranceSelector.tsx` + `InsuranceSummary.tsx`
- [ ] Implementar `useInsuranceOptions.ts` hook
- [ ] E2E tests (insurance selection flow)
- [ ] Deploy em staging

### Sprint 3 (Junho)

**Semana 1: Webhook + Integrador**
- [ ] Implementar `buonny-callback-handler/index.ts`
- [ ] Implementar `buonny-create-trip/index.ts`
- [ ] Integrar com `workflow-orchestrator`

**Semana 2-3: Production**
- [ ] Deploy em produção
- [ ] Monitor Buonny API health
- [ ] Dashboard de seguros (admin)
- [ ] Playbook de troubleshooting

**Semana 4: Otimizações**
- [ ] Cache de risk scores
- [ ] A/B test: BASIC vs STANDARD (default)
- [ ] Otimizar UI responsivo
- [ ] Performance tuning

---

## 10. BLOCKERS & DEPENDÊNCIAS

### CRÍTICO - Aguardando Buonny (2026-03-09)

- [ ] Token + CNPJ de homologação
- [ ] Tabelas de códigos (`carga_tipo`, `status_pesquisa`)
- [ ] Endpoint público API AXA
- [ ] Credenciais API AXA (Integrador)
- [ ] Códigos internos Integrador (`cdcliente`, `cdtransp`, etc)

### Status: ⏳ AWAITING RESPONSE

**Última comunicação:** E-mail com 13 seções de perguntas enviado em 2026-03-09  
**Contato:** TI Buonny  
**Escalação:** Se nenhuma resposta até 2026-04-05, contatar Account Manager

---

## 11. REFERÊNCIA RÁPIDA

| Item | Protocolo | Endpoint (Homolog) |
|------|-----------|------------------|
| Consulta Profissional | SOAP | tstportal.buonny.com.br |
| Callback REST | REST | tstapi.buonny.com.br |
| Webhook | JSON POST | (será fornecido) |
| API AXA | REST | 10.19.0.45:8580 (interno) |

---

## 12. DOCUMENTAÇÃO RELACIONADA

- `docs/buonny-integration/CONTEXT.md` — Status atual + bloqueadores
- `docs/buonny-integration/perguntas-implantacao-buonny.md` — Perguntas enviadas
- `supabase/functions/buonny-check/index.ts` — Stub atual
- `Insight Skills/` — 4 docs de arquitetura multi-agente

---

**Próximo Review:** 2026-04-15 ou após resposta da Buonny
