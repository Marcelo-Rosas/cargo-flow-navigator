---
name: QuoteForm Wizard Refactor
overview: Refatorar o QuoteForm (~2000 linhas) em um Wizard de 4 passos, fatiando o Zod Schema e o JSX em componentes menores e reutilizáveis.
todos:
  - id: wizard-schema-split
    content: Extrair e fatiar o Zod Schema por passo
    status: pending
  - id: wizard-step-components
    content: Criar componentes IdentificationStep, CargoStep, PricingStep, ReviewStep
    status: pending
  - id: wizard-container
    content: Criar QuoteFormWizard com stepper e navegação
    status: pending
  - id: wizard-integrate
    content: Integrar Wizard no QuoteForm e manter compatibilidade
    status: pending
isProject: false
---

# Plano: QuoteForm Wizard - Divisão em 4 Passos

## Objetivo

Converter o `QuoteForm` atual (formulário único com ~2000 linhas) em um Wizard de 4 passos com:
- Schema Zod modular (um sub-schema por passo)
- Componentes de passo reutilizáveis
- Navegação Voltar / Próximo
- Validação por passo antes de avançar
- Resumo final antes de enviar

## Divisão Proposta

```mermaid
flowchart LR
  S1[1. Identificação] --> S2[2. Carga e Logística]
  S2 --> S3[3. Composição Financeira]
  S3 --> S4[4. Revisão e Envio]
```

### Passo 1: Identificação
**Campos:** Cliente, Embarcador, Tipo de Frete, Rota e Data

| Campo | Tipo | Validação |
|-------|------|-----------|
| client_id | select | opcional |
| client_name | text | min 2 |
| client_email | email | opcional |
| shipper_id | select | opcional |
| shipper_name | text | opcional |
| shipper_email | email | opcional |
| freight_type | select | CIF \| FOB |
| origin_cep | masked | 8 dígitos |
| destination_cep | masked | 8 dígitos |
| origin | text | min 2 |
| destination | text | min 2 |

**Ações:** Botão "Calcular KM" (dispara lookup CEP + WebRouter). O km_distance será usado nos passos seguintes.

**Schema:** `identificationSchema` (z.object com os campos acima)

---

### Passo 2: Carga e Logística
**Campos:** Peso, Volume, Tipo de Carga, Modalidade, Tabela, Veículo e Prazo

| Campo | Tipo | Validação |
|-------|------|-----------|
| cargo_type | text | opcional |
| weight | number | 0..99.999.999 |
| volume | number | 0..99.999.999 |
| freight_modality | select | lotacao \| fracionado |
| price_table_id | select | obrigatório para cálculo |
| vehicle_type_id | select | obrigatório |
| payment_term_id | select | obrigatório |
| km_distance | number | min 0 (preenchido no passo 1) |

**Dependências:** `price_table_id` filtrado por `freight_modality`. `vehicle_type_id` vem de useVehicleTypes.

**Schema:** `cargoLogisticsSchema`

---

### Passo 3: Composição Financeira
**Campos:** Frete base (calculado), Adicionais, Condição Financeira

| Campo/Bloco | Descrição |
|-------------|-----------|
| toll | Pedágio (calculado ou manual) |
| cargo_value | Valor da carga |
| aluguel_maquinas | Aluguel de máquinas |
| descarga | Descarga |
| AdditionalFeesSection | Taxas condicionais, espera |
| UnloadingCostSection | Custos de descarga |
| EquipmentRentalSection | Aluguel de equipamentos |
| tde_enabled, tear_enabled | NTC |
| advance_due_date, balance_due_date | Datas (condicional ao prazo) |
| notes | Observações |

**Cálculo:** O `calculationResult` (freightCalculator) depende de dados dos passos 1 e 2. Deve ser recalculado sempre que os inputs mudarem.

**Schema:** `pricingSchema` (valores financeiros e datas)

---

### Passo 4: Revisão e Envio
**Conteúdo:** Resumo read-only dos dados + breakdown (memória + rentabilidade) + botão Confirmar

- Card com: Cliente, Rota, Carga, Veículo, Prazo
- Tabela de breakdown (receita, custos, margem)
- Tabs Memória / Rentabilidade (conteúdo atual do QuoteForm)
- Botões: Voltar, Criar Cotação / Salvar

**Sem schema adicional** – apenas validação do formulário completo antes do submit.

---

## Estrutura de Arquivos Proposta

```
src/components/forms/
  QuoteForm.tsx              # Modal + Form provider + Wizard container (enxuto)
  quote-form/
    schema/
      index.ts               # quoteSchema (merge dos sub-schemas)
      identification.ts      # identificationSchema
      cargoLogistics.ts      # cargoLogisticsSchema
      pricing.ts             # pricingSchema
    steps/
      IdentificationStep.tsx
      CargoLogisticsStep.tsx
      PricingStep.tsx
      ReviewStep.tsx
    QuoteFormWizard.tsx      # Stepper + step state + Voltar/Próximo
```

## Fluxo de Dados

1. **Form context único** – `useForm<QuoteFormData>` no `QuoteForm` (ou `QuoteFormWizard`), com `quoteSchema` completo.
2. **Step state** – `useState(0)` para o índice do passo atual.
3. **Validação por passo** – Antes de avançar, `form.trigger()` nos campos do passo atual. Só avança se válido.
4. **Resumo** – O passo 4 lê `form.getValues()` e `calculationResult` para exibir o resumo.

## Componente Wizard (Stepper)

```tsx
// QuoteFormWizard.tsx - esqueleto
const STEPS = [
  { id: 'identification', label: 'Identificação' },
  { id: 'cargo', label: 'Carga e Logística' },
  { id: 'pricing', label: 'Composição Financeira' },
  { id: 'review', label: 'Revisão' },
];

export function QuoteFormWizard({ form, onSubmit, ... }) {
  const [step, setStep] = useState(0);
  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  const handleNext = async () => {
    const fields = stepFields[step]; // array de field names
    const valid = await form.trigger(fields);
    if (valid) setStep((s) => s + 1);
  };

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={step} />
      {step === 0 && <IdentificationStep form={form} />}
      {step === 1 && <CargoLogisticsStep form={form} />}
      {step === 2 && <PricingStep form={form} />}
      {step === 3 && <ReviewStep form={form} calculationResult={...} />}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={...} disabled={!canPrev}>Voltar</Button>
        {canNext ? (
          <Button onClick={handleNext}>Próximo</Button>
        ) : (
          <Button onClick={form.handleSubmit(onSubmit)}>Criar Cotação</Button>
        )}
      </div>
    </div>
  );
}
```

## Mapeamento de Campos por Passo (para trigger)

| Passo | Campos para validação |
|-------|------------------------|
| 0 | client_id, client_name, client_email, shipper_id, shipper_name, shipper_email, freight_type, origin_cep, destination_cep, origin, destination |
| 1 | cargo_type, weight, volume, freight_modality, price_table_id, vehicle_type_id, payment_term_id, km_distance |
| 2 | toll, cargo_value, aluguel_maquinas, descarga, advance_due_date, balance_due_date, notes |
| 3 | (submit completo - form.handleSubmit já valida tudo) |

## Considerações

1. **Estado extra (additionalFeesSelection, unloadingCostItems, equipmentRentalItems)** – Manter no `QuoteForm` e passar via props ou Context para os steps que precisam.
2. **CEP lookup e Calcular KM** – Permanecem no `IdentificationStep`. O `km_distance` é setado no form e usado no passo 2 e 3.
3. **Condição Financeira (datas)** – Depende de `payment_term_id` e `calculationResult.totals`. Pode ficar no passo 3 (Composição) ou no passo 2. Sugestão: manter no passo 3, pois depende do valor total.
4. **Edit mode** – O Wizard deve funcionar igual para criar e editar. Ao editar, carregar os defaults do `quote` e permitir navegar entre passos livremente.
5. **Alerts (OUT_OF_RANGE, MISSING_DATA, MARGEM)** – Exibir no passo onde fazem sentido (passo 2 ou 3) ou no topo do Wizard.

## Próximos Passos

1. Criar `identificationSchema` extraindo do `quoteSchema` atual
2. Criar `IdentificationStep.tsx` com o JSX do bloco "Dados do Cliente" + "Rota e Carga" (até Calcular KM)
3. Criar `QuoteFormWizard` com stepper e lógica de passo
4. Migrar os demais blocos para `CargoLogisticsStep`, `PricingStep`, `ReviewStep`
5. Testar fluxo completo (criar e editar cotação)
