# 🐛 Fix Report: Consolidation Feature Bugs

## Issues Identificados

### ❌ **BUG #1: Mapa da Rota Não Renderiza**
**Arquivo**: `src/components/LoadCompositionModal.tsx` (linhas 429-481)
**Status**: Rota não está exibindo o mapa visual, apenas placeholder

#### Causa Raiz
```typescript
// Linha 435 — Condição retorna false
routeData || (composition.routings && composition.routings.length > 0)
// ↓ Resultado: polylineCoords está undefined/vazio
// ↓ hasMap = false (RouteMapVisualization.tsx linha 114)
// ↓ Renderiza: "Rota não disponível. Clique para gerar."
```

#### Solução
1. **Garantir que `polylineCoords` é gerado**: Verificar se a Edge Function `generate-optimal-route` está retornando dados corretos
2. **Adicionar fallback visual**: Se não houver polylineCoords, renderizar um resumo textual da rota com `legs` (distância, duração, paradas)
3. **Melhorar UX**: Mostrar status de carregamento enquanto a rota é gerada

#### Código Corrigido
```typescript
// LoadCompositionModal.tsx (TAB ROTA - substituir linhas 429-481)

{/* Tab 2: Route */}
<TabsContent value="route" className="space-y-4">
  {generateRoute.isPending ? (
    <div className="bg-gray-50 p-8 rounded-lg text-center">
      <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
      <p className="text-sm text-gray-600">Gerando rota otimizada...</p>
    </div>
  ) : (routeData?.polyline_coords && routeData.polyline_coords.length >= 2) ? (
    // OPÇÃO 1: Mapa completo (com Leaflet)
    <RouteMapVisualization
      polylineCoords={routeData.polyline_coords}
      legs={routeData?.legs as RouteMapVisualizationProps['legs']}
      totalDistanceKm={routeData?.total_distance_km}
      totalDurationMin={routeData?.total_duration_min}
      totalTollCentavos={routeData?.total_toll_centavos}
      routeSource={routeData?.route_source}
      routings={composition.routings}
    />
  ) : (routeData?.legs && routeData.legs.length > 0) || (composition.routings && composition.routings.length > 0) ? (
    // OPÇÃO 2: Fallback — resumo textual se polyline vazio mas legs existem
    <div className="space-y-4">
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-medium text-blue-700">
            Dados de rota disponíveis (sem visualização de mapa)
          </p>
        </div>
        <p className="text-xs text-blue-600 mb-3">
          Integração com Leaflet/Mapbox disponível em produção.
        </p>
      </div>

      {/* Legs Summary */}
      {(routeData?.legs || composition.routings) && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Detalhes da Rota</h4>
          <div className="border rounded-lg divide-y">
            {(routeData?.legs || composition.routings || []).map((leg: any, idx: number) => (
              <div key={idx} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Parada {idx + 1}: {leg.from_label || `Etapa ${idx + 1}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    → {leg.to_label || 'Destino'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Number(leg.distance_km || leg.leg_distance_km).toFixed(1)}km
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(leg.duration_min || leg.leg_duration_min).toFixed(0)}min
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs font-medium text-blue-600">Distância Total</div>
              <div className="text-lg font-bold text-blue-700">
                {(routeData?.total_distance_km ||
                  (composition.routings?.reduce((s: number, r: any) => s + (r.leg_distance_km || 0), 0) || 0)).toFixed(1)}km
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
              <div className="text-xs font-medium text-purple-600">Duração Estimada</div>
              <div className="text-lg font-bold text-purple-700">
                {(routeData?.total_duration_min ||
                  (composition.routings?.reduce((s: number, r: any) => s + (r.leg_duration_min || 0), 0) || 0)).toFixed(0)}min
              </div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
              <div className="text-xs font-medium text-amber-600">Paradas</div>
              <div className="text-lg font-bold text-amber-700">
                {(routeData?.legs?.length || composition.routings?.length || 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    // OPÇÃO 3: Nenhum dado — mostrar botão para gerar rota
    <div className="bg-gray-50 p-8 rounded-lg text-center">
      <p className="text-sm text-gray-600 mb-3">
        Rota não disponível. Clique para gerar.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={generateRoute.isPending || composition.quote_ids.length < 2}
        onClick={() =>
          generateRoute.mutate(
            {
              quote_ids: composition.quote_ids,
              composition_id: compositionId,
              save_to_db: true,
            },
            {
              onSuccess: (data) => {
                if (data?.route) setRouteData(data.route);
                refetchComposition();
              },
            }
          )
        }
      >
        {generateRoute.isPending ? (
          <>
            <Loader className="w-4 h-4 animate-spin mr-2" />
            Gerando...
          </>
        ) : (
          'Gerar rota'
        )}
      </Button>
    </div>
  )}
</TabsContent>
```

---

### ❌ **BUG #2: Valores NaN na Aba Financeiro**
**Arquivo**: `src/components/LoadCompositionModal.tsx` (linhas 148-186, 484-537)
**Problema**: Valores aparecem como "R$ NaN" em vez de valores formatados

#### Causa Raiz
```typescript
// Linha 159-160: Se composition.metrics.original_total_cost for null/undefined
originalCost: composition.metrics.original_total_cost / 100  // → NaN

// Linha 490: NaN.toLocaleString() → "NaN"
R$ {metrics.originalCost.toLocaleString('pt-BR', { ... })}
```

#### Solução
Adicionar **validação e tratamento de NaN** na função `metrics` useMemo

#### Código Corrigido
```typescript
// LoadCompositionModal.tsx (substituir linhas 148-186)

const metrics = useMemo(() => {
  if (!composition) {
    return {
      originalCost: 0,
      composedCost: 0,
      savings: 0,
      savingsPercent: 0,
      originalKm: 0,
      composedKm: 0,
      efficiency: 0,
      co2Reduction: 0,
    };
  }

  // If metrics table is populated, use it
  if (composition.metrics?.original_total_cost != null && composition.metrics?.original_total_cost > 0) {
    const originalCost = Number(composition.metrics.original_total_cost) / 100;
    const composedCost = Number(composition.metrics.composed_total_cost ?? 0) / 100;
    const savings = Number(composition.metrics.savings_brl ?? 0) / 100;
    const savingsPercent = Number(composition.metrics.savings_percent ?? 0);
    const originalKm = Number(composition.metrics.original_km_total ?? 0);
    const composedKm = Number(composition.metrics.composed_km_total ?? 0);
    const efficiency = Number(composition.metrics.km_efficiency_percent ?? 0);
    const co2Reduction = Number(composition.metrics.co2_reduction_kg ?? 0);

    // Validate: ensure no NaN values
    return {
      originalCost: isNaN(originalCost) ? 0 : originalCost,
      composedCost: isNaN(composedCost) ? 0 : composedCost,
      savings: isNaN(savings) ? 0 : savings,
      savingsPercent: isNaN(savingsPercent) ? 0 : savingsPercent,
      originalKm: isNaN(originalKm) ? 0 : originalKm,
      composedKm: isNaN(composedKm) ? 0 : composedKm,
      efficiency: isNaN(efficiency) ? 0 : efficiency,
      co2Reduction: isNaN(co2Reduction) ? 0 : co2Reduction,
    };
  }

  // Fallback: derive from suggestion v2 columns
  const savingsBrl = (Number(composition.estimated_savings_brl ?? 0)) / 100;
  const baseKm = Number(composition.base_km_total ?? 0) || 0;
  const composedKm = Number(composition.composed_km_total ?? 0) || 0;
  const kmEfficiency = baseKm > 0 ? ((baseKm - composedKm) / baseKm) * 100 : 0;

  return {
    originalCost: 0, // not available without metrics table
    composedCost: 0,
    savings: isNaN(savingsBrl) ? 0 : savingsBrl,
    savingsPercent: isNaN(kmEfficiency) ? 0 : kmEfficiency,
    originalKm: isNaN(baseKm) ? 0 : baseKm,
    composedKm: isNaN(composedKm) ? 0 : composedKm,
    efficiency: isNaN(kmEfficiency) ? 0 : kmEfficiency,
    co2Reduction: 0,
  };
}, [composition]);
```

#### Também adicionar verificação na renderização (linhas 490, 496, 505)
```typescript
// Financial Tab — substituir secção valores

{metrics.originalCost > 0 || metrics.composedCost > 0 ? (
  <div className="grid grid-cols-2 gap-4">
    {metrics.originalCost > 0 && (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="text-xs font-medium text-gray-600 mb-1">Custo Original</div>
        <div className="text-2xl font-bold text-gray-900">
          R$ {!isNaN(metrics.originalCost)
            ? metrics.originalCost.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            : '0,00'}
        </div>
      </div>
    )}
    {metrics.composedCost > 0 && (
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div className="text-xs font-medium text-blue-600 mb-1">Custo Consolidado</div>
        <div className="text-2xl font-bold text-blue-700">
          R$ {!isNaN(metrics.composedCost)
            ? metrics.composedCost.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            : '0,00'}
        </div>
      </div>
    )}
  </div>
) : null}

{/* Economia — sempre renderizar se > 0 */}
{metrics.savings > 0 && (
  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
    <div className="text-xs font-medium text-green-600 mb-1">Economia Estimada</div>
    <div className="text-2xl font-bold text-green-700">
      R$ {!isNaN(metrics.savings)
        ? metrics.savings.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        : '0,00'}
      {metrics.efficiency > 0 && (
        <span className="text-base font-normal ml-2">
          ({metrics.efficiency.toFixed(1)}% de km)
        </span>
      )}
    </div>
  </div>
)}

{/* Quilometragem — apenas se houver dados */}
{(metrics.originalKm > 0 || metrics.composedKm > 0) && (
  <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-3">
    <h4 className="font-medium text-sm text-purple-900">Eficiência de Quilometragem</h4>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span className="text-purple-700">Soma individual:</span>
        <p className="font-semibold">
          {!isNaN(metrics.originalKm) ? metrics.originalKm.toFixed(1) : '0.0'}km
        </p>
      </div>
      <div>
        <span className="text-purple-700">Rota consolidada:</span>
        <p className="font-semibold">
          {!isNaN(metrics.composedKm) ? metrics.composedKm.toFixed(1) : '0.0'}km
        </p>
      </div>
    </div>
  </div>
)}
```

---

## 📋 Resumo das Mudanças

| Bug | Arquivo | Linhas | Fix |
|-----|---------|--------|-----|
| Mapa não renderiza | LoadCompositionModal.tsx | 429-481 | Adicionar fallback com resumo textual de legs |
| NaN em Financeiro | LoadCompositionModal.tsx | 148-186, 484-537 | Validar valores com `isNaN()` + coalesce a 0 |

---

## ✅ Próximos Passos

1. **Aplicar fixes no arquivo `LoadCompositionModal.tsx`**
2. **Testar no navegador** — Clicar em "Consolidação" e validar:
   - ✓ Mapa renderiza OU fallback textual aparece
   - ✓ Aba Financeiro mostra valores (não NaN)
3. **Verificar geração de rota** — Se `polyline_coords` continuar vazio:
   - Debugar Edge Function `generate-optimal-route`
   - Validar retorno de dados da API WebRouter

