---
name: Fatia 3 FinancialDetailModal
overview: Desmembrar o FinancialDetailModal em subcomponentes puros/apresentacionais, reduzindo o arquivo de ~400 para menos de 150 linhas e separando claramente a lógica de negócio da apresentação.
todos: []
isProject: false
---

# Fatia 3: Desmembramento do FinancialDetailModal

## Diagnóstico

O [FinancialDetailModal.tsx](src/components/modals/FinancialDetailModal.tsx) tem ~360 linhas, misturando:

- Estado e mutações (selectedTripId, linkOrderToTargetTripMutation)
- Hooks (useTrips)
- Transformações de dados (breakdown, amount, hasCargo)
- ~250 linhas de JSX repetitivo (cards com `bg-muted/30 border border-border`)

## Estratégia

Extrair blocos de JSX para componentes puros (apresentacionais) em [src/components/financial/modal-sections/](src/components/financial/modal-sections/), passando dados via props. O modal principal permanece como orquestrador: calcula/deriva os dados e compõe as seções.

---

## Componentes a criar (ordem sugerida)

### 1. FinancialClientHeader.tsx (~20 linhas)

**Props:** `{ name: string; shipperName?: string | null }`

**JSX extraído:** linhas 115-129 (bloco Cliente + Embarcador com Building2).

---

### 2. FinancialRouteInfo.tsx (~35 linhas)

**Props:** `{ origin?: string | null; destination?: string | null; originCep?: string | null; destinationCep?: string | null }`

**JSX extraído:** linhas 132-162 (grid 2 colunas Origem/Destino). Renderiza null se não houver origin e destination.

---

### 3. FinancialCargoDetails.tsx (~50 linhas)

**Props:** `{ cargoType?: string | null; weight?: number | null; volume?: number | null }`

**JSX extraído:** linhas 164-204 (Dados da Carga com Package, Scale, Box). Inclui a lógica de formatação de peso (kg vs t). Renderiza null se nenhum dado existir.

---

### 4. FinancialPricingDetails.tsx (~65 linhas)

**Props:** `{ vehicleTypeName?: string | null; vehicleTypeCode?: string | null; paymentTermName?: string | null; kmDistance?: number | null; tollValue?: number }`

**JSX extraído:** linhas 206-265 (Detalhes de Precificação: Veículo, Prazo, Distância, Pedágio). Usa `formatCurrency` para tollValue. Renderiza null se nenhum dado existir.

---

### 5. FinancialCostBreakdown.tsx (~80 linhas)

**Props:** Interface com breakdownComponents, breakdownTotals, breakdownProfitability (tipos extraídos do modal atual). Usa `formatCurrency` internamente.

**JSX extraído:** linhas 269-334 (Custos detalhados: Pedágio, Carreteiro, Descarga, DAS, GRIS, TSO). Renderiza null se não houver breakdown.

---

### 6. FinancialValuesBlock.tsx (~55 linhas)

**Props:** `{ amount: number; breakdownTotals?: {...}; breakdownProfitability?: { margemPercent?: number }; carreteiroAntt?: number | null; carreteiroReal?: number | null }`

**JSX extraído:** linhas 336-396 (Valor do Documento, Receita Bruta, DAS, Margem, Carreteiro ANTT/Real). Consolida o bloco principal de valores e o PAG-specific em um único componente que decide o que exibir.

---

### 7. FinancialTripLink.tsx (~55 linhas)

**Props:** `{ linkableTrips: Array<{ id: string; trip_number?: string | null; driver?: { name?: string } | null }>; selectedTripId: string; onSelectedChange: (id: string) => void; onLink: () => void; isPending: boolean; currentTripNumber?: string | null }`

**JSX extraído:** linhas 398-340 (Select + Botão Vincular). Componente controlado: o pai passa selectedTripId e onSelectedChange; a mutação (onLink) é callback.

---

### 8. FinancialDueDate.tsx (~15 linhas)

**Props:** `{ dueDate: string }`

**JSX extraído:** linhas 350-355 (Próximo vencimento com formatDate month long). Opcional; bloco pequeno, pode ficar inline no primeiro ciclo.

---

## Estrutura final do modal (após migração)

```tsx
// FinancialDetailModal.tsx (~120-140 linhas)
// - early return if !doc
// - derivar: orderId, canLinkToTrip, linkableTrips, amount, name, dueDate, hasCargo, hasPricing, tollValue, breakdown*
// - handleLinkToTrip
return (
  <Dialog>
    <DialogHeader>...</DialogHeader>
    <div className="space-y-5 pt-2">
      <FinancialClientHeader name={name} shipperName={doc.shipper_name} />
      <FinancialRouteInfo origin={...} destination={...} ... />
      <FinancialCargoDetails cargoType={...} weight={...} volume={...} />
      <FinancialPricingDetails vehicleTypeName={...} ... tollValue={tollValue} />
      <Separator />
      <FinancialCostBreakdown ... />
      <Separator />
      <FinancialValuesBlock amount={amount} ... />
      {canLinkToTrip && <FinancialTripLink ... />}
      {doc.type === 'FAT' && ... && <QuotePaymentProofList ... />}
      {dueDate && <FinancialDueDate dueDate={dueDate} />}
      <FinancialAiAnalysis ... />
    </div>
  </Dialog>
);
```

---

## Ordem de execução (fatias menores)


| Fase | Componentes                                    | Risco       |
| ---- | ---------------------------------------------- | ----------- |
| 1    | FinancialClientHeader, FinancialRouteInfo      | Muito baixo |
| 2    | FinancialCargoDetails, FinancialPricingDetails | Baixo       |
| 3    | FinancialCostBreakdown, FinancialValuesBlock   | Baixo       |
| 4    | FinancialTripLink, FinancialDueDate            | Baixo       |


Executar uma fase por vez, validando build e visualmente após cada uma.

---

## Regras

- Subcomponentes não usam hooks (exceto se futuramente necessário para algo local).
- `formatCurrency` e `formatDate` vêm de `@/lib/formatters` nos subcomponentes que precisam.
- Tipos das props: interfaces locais em cada arquivo ou em `modal-sections/types.ts` se houver muita repetição.
- Nenhuma mudança de lógica de negócio; apenas extração de JSX.

---

## Validação

- `npm run build` e `npm run lint` sem erros nos arquivos alterados.
- Comportamento visual idêntico ao anterior (mesmo layout, mesmas condições de exibição).

