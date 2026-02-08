

# Plano: Edge Function lookup-cep com Mascara de CEP

## Objetivo

Criar uma Edge Function centralizada para busca de enderecos via CEP, acompanhada de um componente reutilizavel `MaskedInput` para aplicar mascara visual (00000-000) e validacao Zod.

---

## 1. Arquitetura da Solucao

```text
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ MaskedInput (componente reutilizavel)                   │ │
│ │ ├── mask="cep" -> formata como 00000-000               │ │
│ │ ├── mask="cnpj" -> formata como 00.000.000/0000-00     │ │
│ │ ├── mask="phone" -> formata como (00) 00000-0000       │ │
│ │ └── onValueChange -> retorna valor sem mascara         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ useCepLookup (hook)                                     │ │
│ │ └── Chama Edge Function e retorna dados normalizados   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │ supabase.functions.invoke
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: lookup-cep                                   │
│                                                             │
│ 1. Validar CEP (8 digitos)                                  │
│ 2. Tentar ViaCEP (5s timeout)                               │
│ 3. Fallback BrasilAPI (5s timeout)                          │
│ 4. Retornar dados normalizados + campo "formatted"          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/components/ui/masked-input.tsx` | Criar | Componente reutilizavel com mascaras |
| `src/hooks/useCepLookup.ts` | Criar | Hook para consumir Edge Function |
| `supabase/functions/lookup-cep/index.ts` | Criar | Edge Function principal |
| `supabase/config.toml` | Modificar | Adicionar `verify_jwt = false` |

---

## 3. Componente MaskedInput

### Interface

```typescript
interface MaskedInputProps extends Omit<InputProps, 'onChange'> {
  mask: 'cep' | 'cnpj' | 'cpf' | 'phone';
  onValueChange?: (rawValue: string, maskedValue: string) => void;
}
```

### Logica de Mascaras

| Mask | Formato | Regex de limpeza | Max digits |
|------|---------|------------------|------------|
| cep | 00000-000 | /\D/g | 8 |
| cnpj | 00.000.000/0000-00 | /\D/g | 14 |
| cpf | 000.000.000-00 | /\D/g | 11 |
| phone | (00) 00000-0000 | /\D/g | 11 |

### Exemplo de Uso

```tsx
<MaskedInput
  mask="cep"
  placeholder="00000-000"
  value={field.value}
  onValueChange={(raw) => field.onChange(raw)}
  onBlur={() => handleCepLookup(field.value)}
/>
```

---

## 4. Validacao Zod com Mascara

### Schema CEP

```typescript
// Aceita com ou sem mascara, valida 8 digitos
const cepSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length === 8, {
    message: 'CEP deve ter 8 digitos',
  });
```

### Uso no QuoteForm

```typescript
const quoteSchema = z.object({
  // ... outros campos
  origin_cep: z.string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 8, 'CEP invalido'),
  destination_cep: z.string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 8, 'CEP invalido'),
});
```

---

## 5. Edge Function lookup-cep

### Endpoint

```text
POST /functions/v1/lookup-cep
Content-Type: application/json

{ "cep": "01310100" }   // aceita com ou sem mascara
```

### Response (sucesso)

```json
{
  "success": true,
  "data": {
    "cep": "01310-100",
    "logradouro": "Avenida Paulista",
    "complemento": "",
    "bairro": "Bela Vista",
    "localidade": "Sao Paulo",
    "uf": "SP",
    "ibge": "3550308",
    "formatted": "Sao Paulo - SP"
  }
}
```

### Response (erro)

```json
{
  "success": false,
  "error": "CEP invalido. Informe 8 digitos."
}
```

### Fluxo Interno

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Receber CEP do body                                      │
│    └─ Limpar mascara: "01310-100" -> "01310100"             │
├─────────────────────────────────────────────────────────────┤
│ 2. Validar formato                                          │
│    └─ Se != 8 digitos -> 400 "CEP invalido"                 │
├─────────────────────────────────────────────────────────────┤
│ 3. Tentar ViaCEP                                            │
│    └─ GET https://viacep.com.br/ws/{cep}/json/              │
│    └─ Timeout: 5 segundos                                   │
│    └─ Se {erro: true} -> ir para fallback                   │
├─────────────────────────────────────────────────────────────┤
│ 4. Fallback BrasilAPI                                       │
│    └─ GET https://brasilapi.com.br/api/cep/v1/{cep}         │
│    └─ Timeout: 5 segundos                                   │
├─────────────────────────────────────────────────────────────┤
│ 5. Retornar dados normalizados                              │
│    └─ Incluir campo "formatted": "Cidade - UF"              │
│    └─ Se ambos falharem -> 404 "CEP nao encontrado"         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Hook useCepLookup

```typescript
interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  formatted: string;
}

interface UseCepLookupReturn {
  lookup: (cep: string) => Promise<CepData | null>;
  isLoading: boolean;
  error: string | null;
}

export function useCepLookup(): UseCepLookupReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (cep: string): Promise<CepData | null> => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) {
      setError('CEP deve ter 8 digitos');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('lookup-cep', {
        body: { cep: clean },
      });

      if (fnError) throw fnError;
      if (!data.success) {
        setError(data.error);
        return null;
      }

      return data.data;
    } catch {
      setError('Erro ao buscar CEP');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading, error };
}
```

---

## 7. Integracao no QuoteForm (opcional)

Apos criar os componentes, a integracao no formulario de cotacoes seria:

```tsx
// Adicionar campos de CEP ao schema
origin_cep: z.string().optional(),
destination_cep: z.string().optional(),

// No formulario
const { lookup, isLoading: cepLoading } = useCepLookup();

const handleOriginCepBlur = async () => {
  const cep = form.getValues('origin_cep');
  if (!cep || cep.replace(/\D/g, '').length !== 8) return;
  
  const data = await lookup(cep);
  if (data) {
    form.setValue('origin', data.formatted);
  }
};

// Campo com mascara
<FormField
  control={form.control}
  name="origin_cep"
  render={({ field }) => (
    <FormItem>
      <FormLabel>CEP Origem</FormLabel>
      <FormControl>
        <MaskedInput
          mask="cep"
          placeholder="00000-000"
          value={field.value || ''}
          onValueChange={(raw) => field.onChange(raw)}
          onBlur={handleOriginCepBlur}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 8. Configuracao config.toml

```toml
[functions.lookup-cep]
verify_jwt = false
```

---

## 9. Beneficios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Mascara visual | Nenhuma | 00000-000 |
| Validacao | Manual | Zod automatico |
| Fallback | Nenhum | BrasilAPI |
| Reuso | Copiar codigo | Componente + Hook |
| Logs | Frontend only | Servidor (debugging) |
| CORS | Browser-dependent | Controlado |

---

## 10. Ordem de Implementacao

1. Criar `src/components/ui/masked-input.tsx`
2. Criar `supabase/functions/lookup-cep/index.ts`
3. Atualizar `supabase/config.toml`
4. Criar `src/hooks/useCepLookup.ts`
5. Testar Edge Function via curl
6. (Opcional) Integrar no QuoteForm e outros formularios

