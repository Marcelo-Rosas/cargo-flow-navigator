---
name: convert-form-to-wizard
description: Converts long complex forms (e.g. Nova Cotação) into multi-step wizards to improve usability. Use only when explicitly invoked (/convert-form-to-wizard) on a form file such as QuoteForm.tsx.
disable-model-invocation: true
---

# Converter Formulário para Wizard Multi-Passo

## Quando Usar

- **Apenas quando invocada explicitamente** (`/convert-form-to-wizard`) em arquivo de formulário React (ex: `QuoteForm.tsx`)

## Instruções

1. **Analise o formulário atual:** Identifique seções lógicas (ex: Dados do Cliente, Detalhes da Carga, Precificação).

2. **Gerencie o estado do passo:** `const [step, setStep] = useState(1);`

3. **Divida o JSX:** Separe em componentes ou blocos condicionais, um por passo.

4. **Adicione botões de navegação:** "Próximo" e "Anterior" para navegar entre passos.

5. **Validação por passo:** Com `react-hook-form`, use `trigger()` para validar apenas os campos do passo atual antes de avançar.

6. **Indicador de progresso:** Implemente componente visual (ex: `StepsIndicator`) com todos os passos e destaque do passo atual.

7. **Estrutura de exemplo:**

```tsx
const [step, setStep] = useState(1);

return (
  <Dialog>
    <DialogContent>
      <StepsIndicator currentStep={step} totalSteps={3} />

      {step === 1 && <Step1Fields />}
      {step === 2 && <Step2Fields />}
      {step === 3 && <Step3Fields />}

      <DialogFooter>
        {step > 1 && <Button onClick={() => setStep((s) => s - 1)}>Anterior</Button>}
        {step < 3 && <Button onClick={handleNext}>Próximo</Button>}
        {step === 3 && <Button type="submit">Salvar Cotação</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```
