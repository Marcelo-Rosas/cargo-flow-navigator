# Route Metrics Methodology (Refactored)

## Problema Original

A exibição de pedágio (toll) e mapa seguia um padrão **monolítico** em `RouteMapVisualization.tsx`:
- Lógica de cálculo inline (useMemo + manual aggregation)
- Renderização de componentes inline
- Falta de padronização de formato (centavos)
- Difícil de testar e reutilizar

## Solução: Seguindo `TollRoutesSection` Metodologia

### 1. **Hook Customizado** (`useRouteMetrics.ts`)
Encapsula a lógica de cálculo de métricas, **assim como `useTollRoutes`, `useVehicleTypes`**:

```typescript
// ✅ Standardized format: toll sempre em CENTAVOS (integer)
export interface RouteMetrics {
  totalDistanceKm: number;
  totalDurationMin: number;
  totalTollCentavos: number;  // ✅ Integer (centavos)
  stopCount: number;
  hasValidCoordinates: boolean;
  warnings: string[];           // ✅ Data validation
}

// ✅ Reutilizável em qualquer componente
const metrics = useRouteMetrics({
  legs,
  totalDistanceKm,
  totalDurationMin,
  totalTollCentavos,
  polylineCoords,
});
```

**Benefícios:**
- Lógica centralizada
- Fácil de testar
- Reutilizável
- Validação embutida

### 2. **Componente Sub (RouteStats.tsx)**
Exibe estatísticas **assim como `TollRouteForm` é sub-componente de `TollRoutesSection`**:

```typescript
// ✅ Props bem definidas
export interface RouteStatsProps {
  metrics: RouteMetrics;
  className?: string;
}

// ✅ Uso simples
<RouteStats metrics={metrics} />
```

**Benefícios:**
- Separação de responsabilidades
- Fácil de reutilizar em outros lugares
- Mudanças de UI não afetam lógica

### 3. **Componente Principal Refatorado**
`RouteMapVisualization` agora segue o padrão:

```typescript
export function RouteMapVisualization(props: RouteMapVisualizationProps) {
  // ✅ Use standardized hook
  const metrics = useRouteMetrics({
    legs,
    totalDistanceKm,
    totalDurationMin,
    totalTollCentavos,
    polylineCoords,
  });

  // ✅ Use sub-component
  return (
    <div>
      <MapContainer>/* ... */</MapContainer>
      <RouteStats metrics={metrics} />
    </div>
  );
}
```

## Padrão Aplicado

```
TollRoutesSection (Main)
├── useTollRoutes() [hook]
├── useVehicleTypes() [hook]
└── TollRouteForm (Sub-component)

RouteMapVisualization (Main) ✅ REFACTORED
├── useRouteMetrics() [hook]
└── RouteStats (Sub-component)
```

## Standardização de Dados

### ✅ Toll sempre em centavos (integer)
```typescript
// ❌ Antes (inconsistente)
toll: 15.50  // decimal, unsafe

// ✅ Depois (standardized)
totalTollCentavos: 1550  // integer, safe
```

### ✅ Formatação centralizada
```typescript
// Formatter
formatCurrencyFromCents(1550) // "R$ 15,50"

// Componente
<RouteStats metrics={metrics} /> // usa formatador interno
```

## Validação e Warnings

```typescript
// useRouteMetrics retorna warnings
const metrics = useRouteMetrics({...});

if (metrics.warnings.length > 0) {
  // Exibir alerts no <RouteStats>
  warnings.map(w => <Alert key={w}>{w}</Alert>)
}
```

**Exemplos:**
- "Coordenadas de rota não disponíveis para visualizar mapa"
- "Pedágio em formato inválido (não é inteiro)"
- "N trechos sem pedágio calculado"

## Próximos Passos

1. **Aplicar em outros componentes:**
   - `LoadCompositionModal` → `useLoadMetrics` hook
   - Qualquer visualização de rota → reutilizar `RouteStats`

2. **Testes unitários:**
   ```typescript
   describe('useRouteMetrics', () => {
     it('should return toll in centavos', () => {
       const metrics = useRouteMetrics({ totalTollCentavos: 1550 });
       expect(metrics.totalTollCentavos).toBe(1550);
       expect(Number.isInteger(metrics.totalTollCentavos)).toBe(true);
     });
   });
   ```

3. **Documentação:**
   - Always use centavos for toll internally
   - Format only at display time
   - Use `useRouteMetrics` for any route data calculation

## Checklist para Futuros Componentes

- [ ] Existe lógica que pode virar hook customizado?
- [ ] Existe componente "form" que pode virar sub-componente?
- [ ] Dados estão padronizados (centavos, formatação)?
- [ ] Há validação e warnings?
- [ ] É reutilizável?

---

**Aplicado em:** RouteMapVisualization v3 (Mar 2026)  
**Padrão base:** TollRoutesSection methodology  
**Status:** ✅ Ready for production
