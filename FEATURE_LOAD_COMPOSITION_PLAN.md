# 📦 Feature: Composição Inteligente de Cargas (Load Composition Engine)

**Objetivo:** Análise automática de cotações pendentes para identificar oportunidades de consolidação de cargas, gerando sugestões de composição com planos de roterização otimizados.

---

## 1. Visão Geral do Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│ FOLLOW-UP DE CARREGAMENTO (Kanban Comercial)                    │
│ [COT-2026-03-0020] NITROGYM TAMBORE (03/04/2026)                │
│ [COT-2026-03-0009] GVP ACADEMIA (23/04/2026)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Load Composition Engine      │
        │  (Edge Function)              │
        │                               │
        │ 1. Busca todas cotações do    │
        │    mesmo embarcador          │
        │ 2. Filtra por data próxima   │
        │    (Δ 7-14 dias)             │
        │ 3. Calcula consolidação      │
        │ 4. Valida viabilidade        │
        │ 5. Traça rotas otimizadas    │
        └──────────────────┬───────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Sugestão │  │ Análise  │  │ Plano de │
        │ Compose  │  │ de Custo │  │ Rota     │
        │ (modal)  │  │ (savings)│  │ (mapa)   │
        └──────────┘  └──────────┘  └──────────┘
            │
            ▼
        ┌──────────────────────────┐
        │ Usuário aprova/rejeita   │
        │ composição               │
        └──────────┬───────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
    ✅ CRIAR OS COMBINADA   ❌ MANTER COTAÇÕES
       + Notificar             SEPARADAS
         Embarcador via
         WhatsApp
```

---

## 2. Schema de Dados

### 2.1 Tabela: `load_composition_suggestions`
```sql
CREATE TABLE load_composition_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referência
  shipper_id UUID NOT NULL REFERENCES shippers(id) ON DELETE CASCADE,

  -- Cotações envolvidas (array de quote_ids)
  quote_ids UUID[] NOT NULL,  -- [COT-0020, COT-0009]

  -- Análise
  consolidation_score FLOAT NOT NULL, -- 0-100 (viabilidade)
  estimated_savings_brl INTEGER, -- economia em centavos
  distance_increase_percent FLOAT, -- quanto % piora a distância

  -- Validação
  is_feasible BOOLEAN DEFAULT true,
  validation_warnings TEXT[], -- ["Horários colidem", "Pesos excedem", ...]

  -- Status
  status TEXT DEFAULT 'pending', -- pending | approved | rejected | executed

  -- Auditoria
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_load_comp_shipper ON load_composition_suggestions(shipper_id);
CREATE INDEX idx_load_comp_status ON load_composition_suggestions(status);
```

### 2.2 Tabela: `load_composition_routings`
```sql
CREATE TABLE load_composition_routings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  composition_id UUID NOT NULL REFERENCES load_composition_suggestions(id),

  -- Rota
  route_sequence INTEGER, -- 1=primeiro parar, 2=segundo, ...
  quote_id UUID NOT NULL REFERENCES quotes(id),

  -- Geometria
  leg_distance_km FLOAT,
  leg_duration_min INTEGER,
  leg_polyline TEXT, -- encoded polyline para map

  -- Horários
  pickup_window_start TIME,
  pickup_window_end TIME,
  estimated_arrival TIME,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lc_routing_comp ON load_composition_routings(composition_id);
```

### 2.3 Tabela: `load_composition_metrics`
```sql
CREATE TABLE load_composition_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  composition_id UUID NOT NULL REFERENCES load_composition_suggestions(id),

  -- Econômico
  original_total_cost INTEGER, -- soma dos fretes separados
  composed_total_cost INTEGER, -- frete da carga consolidada
  savings_brl INTEGER, -- original - composed
  savings_percent FLOAT,

  -- Operacional
  original_km_total FLOAT,
  composed_km_total FLOAT,
  km_efficiency FLOAT, -- (original - composed) / original * 100

  -- Ambiental (opcional)
  co2_reduction_kg FLOAT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Algoritmo de Matching e Composição

### 3.1 Critérios de Consolidação

```typescript
interface ConsolidationCriteria {
  // Temporal
  maxDaysBetweenPickups: 14; // janela de até 14 dias
  minViableConsolidation: 2; // mínimo 2 cotações

  // Geográfico
  maxDeviationPercent: 15; // 15% max deviation na rota

  // Operacional
  minWeightKg: 100; // mínimo de peso por parada
  maxWeightTruck: 30000; // max de um caminhão

  // Econômico
  minSavingsPercent: 5; // economizar no mínimo 5%
  minSavingsBrl: 50000, // R$ 500,00
}
```

### 3.2 Score de Viabilidade

```
ConsolidationScore (0-100) =
  (40) * DateProximity +
  (30) * CostSavings +
  (20) * RouteEfficiency +
  (10) * WeightUtilization

Onde:
- DateProximity: 100 se Δ < 3 dias, 50 se < 7 dias, 20 se < 14 dias
- CostSavings: (atual_savings / original_cost) * 100, capped at 100
- RouteEfficiency: (1 - extra_km / original_km) * 100
- WeightUtilization: (total_weight / truck_capacity) * 100
```

### 3.3 Algoritmo TSP (Traveling Salesman Problem)

Para cada combinação de cotações:
1. **Calcular matriz de distâncias** entre pontos (origem → coletores → destino)
2. **Usar heurística de vizinho mais próximo** para rota inicial
3. **Aplicar 2-opt swaps** para otimização local
4. **Validar** restrições de janela de tempo (pickup windows)
5. **Comparar** com rotas originais separadas

```python
# Pseudocódigo
def calculate_optimal_route(quotes: List[Quote]) -> Route:
    locations = [warehouse_origin] + [q.pickup_address for q in quotes] + [warehouse_dest]
    distance_matrix = calculate_distances(locations)  # via Google Maps API

    # Nearest neighbor heuristic
    route = nearest_neighbor_tsp(distance_matrix)

    # 2-opt improvement
    for _ in range(MAX_ITERATIONS):
        improved_route = two_opt_swap(route, distance_matrix)
        if improved_route.distance < route.distance:
            route = improved_route
        else:
            break

    return route
```

---

## 4. Estrutura de Componentes (Frontend)

### 4.1 Tela: Load Composition Suggestions Panel
**Localização:** `/src/pages/Commercial.tsx` → seção "Oportunidades de Composição"

```typescript
// src/components/commercial/LoadCompositionPanel.tsx
interface LoadCompositionPanelProps {
  selectedShipper?: UUID;
  dateRange?: [Date, Date];
}

export function LoadCompositionPanel({ selectedShipper, dateRange }: Props) {
  const { data: suggestions, isLoading } = useLoadCompositionSuggestions({
    shipper_id: selectedShipper,
    date_from: dateRange?.[0],
    date_to: dateRange?.[1],
  });

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          Oportunidades de Composição
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions?.map(sugg => (
          <LoadCompositionCard key={sugg.id} suggestion={sugg} />
        ))}
      </CardContent>
    </Card>
  );
}
```

### 4.2 Card: Sugestão Individual
```typescript
// src/components/commercial/LoadCompositionCard.tsx
export function LoadCompositionCard({ suggestion }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm">
            {suggestion.quote_ids.length} cotações • {suggestion.shipper_name}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Economia: <Badge variant="success">R$ {formatBrl(suggestion.savings)}</Badge>
            {" "}• Score: <Badge>{suggestion.score.toFixed(0)}/100</Badge>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDetails(true)}
        >
          Ver Detalhes
        </Button>
      </div>

      {showDetails && (
        <LoadCompositionModal suggestion={suggestion} />
      )}
    </div>
  );
}
```

### 4.3 Modal: Composição Detalhada
```typescript
// src/components/commercial/LoadCompositionModal.tsx
export function LoadCompositionModal({ suggestion, onClose }: Props) {
  const [approved, setApproved] = useState(false);
  const approveMutation = useApproveComposition();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análise de Composição de Cargas</DialogTitle>
        </DialogHeader>

        {/* Abas */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="route">Rota Otimizada</TabsTrigger>
            <TabsTrigger value="financial">Análise Financeira</TabsTrigger>
            <TabsTrigger value="warnings">Validações</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MetricCard title="Score de Viabilidade" value={suggestion.score} unit="/100" />
              <MetricCard title="Economia" value={suggestion.savings_brl} unit="R$" />
              <MetricCard title="Cotações" value={suggestion.quote_ids.length} unit="und" />
              <MetricCard title="Distância Extra" value={suggestion.distance_increase} unit="%" />
            </div>

            {/* Cotações envolvidas */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Cotações Selecionadas</h4>
              <div className="space-y-2">
                {suggestion.quotes.map(q => (
                  <QuoteRow key={q.id} quote={q} />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Route (Mapa com Polyline) */}
          <TabsContent value="route">
            <RouteMapVisualization composition={suggestion} />
          </TabsContent>

          {/* Tab 3: Financial */}
          <TabsContent value="financial">
            <FinancialComparison suggestion={suggestion} />
          </TabsContent>

          {/* Tab 4: Validations */}
          <TabsContent value="warnings">
            <ValidationWarnings warnings={suggestion.validation_warnings} />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Rejeitar</Button>
          <Button
            onClick={() => approveMutation.mutate(suggestion.id)}
            loading={approveMutation.isPending}
          >
            Aprovar & Criar OS Consolidada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.4 Componente: Visualização de Rota
```typescript
// src/components/commercial/RouteMapVisualization.tsx
export function RouteMapVisualization({ composition }: Props) {
  return (
    <div className="space-y-4">
      {/* Mapa */}
      <div className="h-96 bg-gray-100 rounded-lg border flex items-center justify-center">
        <MapContainer
          routings={composition.routings}
          center={[...]}
          zoom={11}
        >
          {/* Renderizar polylines para cada leg */}
          {composition.routings.map((leg, idx) => (
            <Polyline
              key={idx}
              positions={decodePolyline(leg.polyline)}
              color={['#3b82f6', '#10b981', '#f59e0b'][idx]}
              weight={4}
            />
          ))}
        </MapContainer>
      </div>

      {/* Timeline de paradas */}
      <div className="space-y-2">
        {composition.routings.map((leg, idx) => (
          <RouteLegCard key={leg.id} leg={leg} order={idx + 1} />
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Edge Functions

### 5.1 `analyze-load-composition`
**Triggers:** Quando usuário entra em "Follow-up de Carregamento" ou aciona manualmente

```typescript
// supabase/functions/analyze-load-composition/index.ts
export async function analyzeLoadComposition(req: Request) {
  const { shipper_id, date_range_days = 14 } = await req.json();

  // 1. Buscar todas cotações pendentes do embarcador
  const quotes = await getShipperPendingQuotes(shipper_id, date_range_days);

  if (quotes.length < 2) {
    return { suggestions: [] };
  }

  // 2. Gerar todas combinações viáveis
  const combinations = generateCombinations(quotes);

  // 3. Para cada combinação, analisar
  const suggestions: CompositionSuggestion[] = [];

  for (const combo of combinations) {
    // Validar precedência
    if (!isValidCombo(combo)) continue;

    // Calcular rota otimizada
    const route = await calculateOptimalRoute(combo);

    // Calcular metrics
    const metrics = calculateMetrics(combo, route);

    // Score
    const score = calculateScore(metrics);

    if (score >= MIN_VIABLE_SCORE && metrics.savings_brl >= MIN_SAVINGS_BRL) {
      suggestions.push({
        quote_ids: combo.map(q => q.id),
        consolidation_score: score,
        estimated_savings_brl: metrics.savings_brl,
        distance_increase_percent: metrics.distance_increase,
        routings: route.legs,
      });
    }
  }

  // 4. Salvar sugestões no DB
  await saveSuggestions(suggestions);

  return { suggestions };
}
```

### 5.2 `generate-optimal-route`
**Chamada interna** para calcular melhor rota via Google Maps API

```typescript
// supabase/functions/generate-optimal-route/index.ts
async function generateOptimalRoute(quotes: Quote[]): Promise<Route> {
  const locations = [
    WAREHOUSE_ORIGIN,
    ...quotes.map(q => q.pickup_address),
    WAREHOUSE_DESTINATION,
  ];

  // Chamar Google Maps Distance Matrix API
  const distanceMatrix = await googleMaps.distanceMatrix({
    origins: locations,
    destinations: locations,
    mode: 'driving',
    units: 'metric',
  });

  // Aplicar algoritmo TSP
  const route = solveTSP(distanceMatrix, {
    startNode: 0,
    endNode: locations.length - 1,
  });

  // Decodificar polylines para cada leg
  const legs = [];
  for (let i = 0; i < route.path.length - 1; i++) {
    const leg = await googleMaps.directions({
      origin: locations[route.path[i]],
      destination: locations[route.path[i + 1]],
    });

    legs.push({
      polyline: leg.routes[0].overview_polyline.points,
      distance_km: leg.routes[0].legs[0].distance.value / 1000,
      duration_min: leg.routes[0].legs[0].duration.value / 60,
    });
  }

  return { path: route.path, legs, total_distance: route.distance };
}
```

### 5.3 `approve-composition`
**POST** para criar OS consolidada quando aprovado

```typescript
async function approveComposition(req: Request) {
  const { composition_id, user_id } = await req.json();

  const comp = await getComposition(composition_id);

  // 1. Criar OS consolidada
  const consolidatedOrder = await createOrder({
    quote_ids: comp.quote_ids,
    origin: WAREHOUSE_ORIGIN,
    destination: WAREHOUSE_DESTINATION,
    pickup_schedule: comp.routings.map(r => ({
      quote_id: r.quote_id,
      pickup_window: r.pickup_window,
    })),
    estimated_km: comp.routings.reduce((sum, r) => sum + r.distance_km, 0),
    status: 'pending_driver_assignment',
  });

  // 2. Atualizar status das sugestões
  await updateCompositionStatus(composition_id, 'executed', user_id);

  // 3. Notificar embarcador via WhatsApp
  await notifyShipper(comp.shipper_id, {
    type: 'composition_approved',
    message: `Sua composição de ${comp.quote_ids.length} cargas foi aprovada. Economia: R$ ${comp.savings}`,
    order_id: consolidatedOrder.id,
  });

  // 4. Atualizar cotações → linked_order
  for (const qid of comp.quote_ids) {
    await updateQuote(qid, { linked_order_id: consolidatedOrder.id });
  }

  return { success: true, order_id: consolidatedOrder.id };
}
```

---

## 6. Hooks React (Frontend)

### 6.1 `useLoadCompositionSuggestions`
```typescript
// src/hooks/useLoadCompositionSuggestions.ts
export function useLoadCompositionSuggestions(params: {
  shipper_id?: UUID;
  date_from?: Date;
  date_to?: Date;
  status?: 'pending' | 'approved' | 'rejected';
}) {
  return useQuery<LoadCompositionSuggestion[]>({
    queryKey: ['load-composition-suggestions', params],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('load_composition_suggestions')
        .select(`
          *,
          quotes:quote_ids(*),
          routings:load_composition_routings(*)
        `)
        .eq('shipper_id', params.shipper_id)
        .gte('created_at', params.date_from?.toISOString())
        .lte('created_at', params.date_to?.toISOString());

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### 6.2 `useApproveComposition`
```typescript
export function useApproveComposition() {
  return useMutation({
    mutationFn: async (compositionId: UUID) => {
      return await invokeEdgeFunction('approve-composition', {
        composition_id: compositionId,
        user_id: useAuth().user?.id,
      });
    },
    onSuccess: () => {
      // Refresh suggestions
      queryClient.invalidateQueries({ queryKey: ['load-composition-suggestions'] });
      // Refresh quotes
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      // Toast
      toast.success('Composição aprovada! Ordem de serviço criada.');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}
```

---

## 7. Integração com Sistema Existente

### 7.1 Fluxo na Tela Commercial (Kanban)
```
┌─ KANBAN COMERCIAL ─────────────────────────────┐
│ [Negociação] [Pendência Doc] [Aprovações] ... │
├───────────────────────────────────────────────┤
│ ┌─ NOVAS OPORTUNIDADES (ALERT) ────────────┐ │
│ │ 💡 3 sugestões de composição              │ │
│ │ [Expand] ▼                                │ │
│ │                                           │ │
│ │ • NITROGYM + GVP                          │ │
│ │   Economiza R$ 2.500 | Score: 87/100     │ │
│ │   [Ver Detalhes] [Aprovar]                │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ [COT-0020] NITROGYM...  [Negociação]         │
│ [COT-0009] GVP...       [Negociação]         │
└───────────────────────────────────────────────┘
```

### 7.2 Adicionar Coluna no Kanban
```typescript
// src/pages/Commercial.tsx
<KanbanBoard>
  {/* ... colunas existentes ... */}

  {/* Nova coluna: Oportunidades */}
  <KanbanColumn header="Oportunidades de Composição">
    <LoadCompositionPanel
      selectedShipper={selectedShipper}
      dateRange={dateRange}
    />
  </KanbanColumn>
</KanbanBoard>
```

### 7.3 Notificação a Embarcador
```typescript
// via notification-hub Edge Function
{
  "type": "composition_suggested",
  "shipper_id": "...",
  "message": "Identificamos oportunidade de composição de suas 2 cargas para SP (03-04 abr). Economia de R$ 2.500. Confira em seu painel.",
  "cta_url": "/comercial?highlight=composition_123",
  "channels": ["whatsapp", "email"]
}
```

---

## 8. Requisitos Técnicos

### 8.1 Dependências Externas
- **Google Maps API** (Distance Matrix + Directions) → Env var `GOOGLE_MAPS_KEY`
- **Supabase PostGREST** (consultas)
- **OpenClaw** (notificação WhatsApp via `notification-hub`)

### 8.2 Configurações
```env
# .env
GOOGLE_MAPS_KEY=AIza...
LOAD_COMPOSITION_MIN_SAVINGS_BRL=50000      # R$ 500
LOAD_COMPOSITION_MIN_SCORE=60               # 0-100
LOAD_COMPOSITION_DATE_WINDOW_DAYS=14        # dias
LOAD_COMPOSITION_ROUTE_DEVIATION_MAX=15     # % extra km permitido
```

---

## 9. Fluxo de Implementação (Phase)

### Phase 1: Schema & Backend (Week 1-2)
- [ ] Criar tabelas `load_composition_suggestions`, `routings`, `metrics`
- [ ] Implementar Edge Function `analyze-load-composition`
- [ ] Implementar algoritmo TSP básico (nearest-neighbor + 2-opt)
- [ ] Criar `approve-composition` Edge Function
- [ ] Testes de E2E para algoritmo

### Phase 2: Frontend UI (Week 2-3)
- [ ] `LoadCompositionPanel` (card list)
- [ ] `LoadCompositionCard` (individual)
- [ ] `LoadCompositionModal` (abas: overview, route, financial, warnings)
- [ ] `RouteMapVisualization` (Leaflet/Mapbox)
- [ ] Integrar em `Commercial.tsx` Kanban

### Phase 3: Hooks & Integration (Week 3)
- [ ] `useLoadCompositionSuggestions`
- [ ] `useApproveComposition`
- [ ] Integração com `useQuotes` para refresh automático
- [ ] Notificações via `notification-hub`

### Phase 4: Testing & Optimization (Week 4)
- [ ] Testes unitários: algoritmo TSP
- [ ] Testes E2E: fluxo completo (análise → aprovação → OS criada)
- [ ] Otimização: cache de sugestões, lazy-loading mapa
- [ ] Performance: índices DB, query optimization

---

## 10. Exemplo de Dado Real

### Input
```json
{
  "shipper_id": "shipper_123",
  "quotes": [
    {
      "id": "COT-0020",
      "origin": "São Bernardo do Campo, SP",
      "destination": "Barueri, SP",
      "pickup_address": "Rua A, 100",
      "destination_address": "Av. Principal, 500",
      "weight_kg": 500,
      "pickup_date": "2026-04-03",
      "pickup_window": ["09:00", "11:00"],
      "estimated_cost": 120000  // R$ 1.200
    },
    {
      "id": "COT-0009",
      "origin": "São Bernardo do Campo, SP",
      "destination": "Itapevi, SP",
      "pickup_address": "Rua B, 200",
      "destination_address": "Av. Secundária, 600",
      "weight_kg": 400,
      "pickup_date": "2026-04-23",  // 20 dias depois
      "pickup_window": ["14:00", "16:00"],
      "estimated_cost": 95000  // R$ 950
    }
  ]
}
```

### Output
```json
{
  "suggestion": {
    "id": "comp_xyz",
    "score": 78,
    "savings_brl": 225000,  // R$ 2.250
    "distance_increase_percent": 8,
    "routings": [
      {
        "order": 1,
        "quote_id": "COT-0020",
        "pickup_address": "Rua A, 100",
        "pickup_window": ["09:00", "11:00"],
        "leg_distance_km": 15.2,
        "leg_duration_min": 28,
        "polyline": "encoded_polyline_...",
        "estimated_arrival": "11:28"
      },
      {
        "order": 2,
        "quote_id": "COT-0009",
        "pickup_address": "Rua B, 200",
        "pickup_window": ["14:00", "16:00"],
        "leg_distance_km": 12.8,
        "leg_duration_min": 24,
        "polyline": "encoded_polyline_...",
        "estimated_arrival": "14:52"  // dentro da janela
      }
    ],
    "metrics": {
      "original_cost_total": 215000,  // 1.200 + 950
      "composed_cost": 192500,        // frete único consolidado
      "savings_brl": 22500,
      "savings_percent": 10.5,
      "original_km": 75,
      "composed_km": 81,
      "efficiency": -8  // pior em km mas compensa no custo
    },
    "validation_warnings": []
  }
}
```

---

## 11. Casos de Teste

### TC1: Básico (Happy Path)
```gherkin
Given dois cotações do mesmo embarcador com datas próximas
When sistema analisa composição
Then retorna sugestão com score > 60 e economia > R$ 500
And usuário clica "Aprovar"
Then cria OS consolidada com 2 paradas
And ambas cotações são linked à OS
And embarcador notificado via WhatsApp
```

### TC2: Validação (Janelas de Tempo)
```gherkin
Given cotações com pickup windows que colidem
When calcular rota
Then exibe warning "Horários de coleta colidem"
And score reduzido
```

### TC3: Rejeição
```gherkin
Given sugestão com economia < R$ 500
When usuário vê sugestão
Then botão "Rejeitar" disponível
When clica
Then sugestão marcada como "rejected"
And não insiste em sugerir próximas vezes
```

---

## 12. Benefícios Esperados

| Métrica | Baseline | Target | Impacto |
|---------|----------|--------|--------|
| **Custo Médio/Frete** | R$ 1.100 | R$ 1.050 | -4.5% |
| **Taxa de Consolidação** | 0% | 15-20% | Receita +3-5% |
| **Eficiência de Rota** | 85% | 92% | -8% km/frete |
| **Satisfação Embarcador** | 6.8/10 | 8.0/10 | Melhor TCO |
| **Tempo Decisão** | 2h manual | 5min auto | +1200% |

---

## 13. Próximos Passos

1. **Semana 1:** Validar requisitos com time operacional (motoristas, embarcadores)
2. **Semana 2:** Estimar custo de API Google Maps (volume de chamadas)
3. **Semana 3:** Design de UX/UI com stakeholders
4. **Semana 4:** Início de implementação da Phase 1

---

**Status:** 📋 Plano Conceitual
**Autor:** Claude
**Data:** 18/03/2026
**Próxima Review:** Após aprovação do conceito
