# 🛠️ Exemplo de Implementação: Validação CEP + Mapa

## 1. Usar o Hook `useCepValidator` em um Formulário

### Exemplo: Input de CEP com Validação em Tempo Real

```typescript
// src/components/CepInputField.tsx

import { useCepValidator } from '@/hooks/useCepValidator';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

export function CepInputField() {
  const { cep, handleCepChange, isValidating, error, isValid, city_uf } =
    useCepValidator();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">CEP de Origem</label>

      <input
        type="text"
        placeholder="00000-000"
        value={cep}
        onChange={(e) => handleCepChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
          error
            ? 'border-red-300 bg-red-50 focus:ring-red-200'
            : isValid
              ? 'border-green-300 bg-green-50 focus:ring-green-200'
              : 'border-gray-300 focus:ring-blue-200'
        } focus:outline-none focus:ring-2`}
      />

      {/* Validação feedback */}
      {isValidating && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader className="w-4 h-4 animate-spin" />
          Validando...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {isValid && city_uf && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {city_uf}
        </div>
      )}
    </div>
  );
}
```

---

## 2. Integrar Mapa no Detalhe da Composição

### Exemplo: Modal com Aba de Rota

```typescript
// src/pages/LoadCompositionDetail.tsx

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RouteVisualizationMap } from '@/components/RouteVisualizationMap';
import { LoadCompositionCard } from '@/components/LoadCompositionCard';

export function LoadCompositionDetail() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  // Mock data - substitua pela lógica real
  const suggestion = {
    id: '123',
    quote_ids: ['q1', 'q2'],
    consolidation_score: 85,
    estimated_savings_brl: 50000, // em centavos
    delta_km_percent: 12,
    delta_km_abs: 45,
    composed_km_total: 520,
    base_km_total: 475,
    technical_explanation: 'Rota viável com economia significativa',
    is_feasible: true,
    status: 'pending' as const,
  };

  const quotes = [
    {
      id: 'q1',
      origin: 'Navegantes - SC',
      destination: 'São Paulo - SP',
      client_name: 'Cliente A',
      origin_cep: '89015-000',
      destination_cep: '01310-100',
    },
    {
      id: 'q2',
      origin: 'Itajaí - SC',
      destination: 'São Paulo - SP',
      client_name: 'Cliente B',
      origin_cep: '88304-000',
      destination_cep: '01310-100',
    },
  ];

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded">
        Ver Detalhes
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Composição</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Resumo</TabsTrigger>
              <TabsTrigger value="quotes">Cotações</TabsTrigger>
              <TabsTrigger value="map">🗺️ Rota</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <LoadCompositionCard suggestion={suggestion} />
            </TabsContent>

            <TabsContent value="quotes" className="space-y-3">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {quote.client_name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {quote.origin} → {quote.destination}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      CEP: {quote.origin_cep}
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="map" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-900">
                  📍 <strong>Visualização da rota consolidada</strong>
                </p>
                <p className="text-xs text-blue-800 mt-1">
                  Clique nos marcadores para ver detalhes das paradas
                </p>
              </div>

              <RouteVisualizationMap
                suggestion={suggestion}
                quotes={quotes}
                height="500px"
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## 3. Usar em ManualQuoteSelector

### Exemplo: Adicionar CEP com Validação

```typescript
// src/components/load-composition/ManualQuoteSelector.tsx

import { useState } from 'react';
import { useCepValidator } from '@/hooks/useCepValidator';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader, Plus } from 'lucide-react';

export function CepQuoteAdder() {
  const { cep, handleCepChange, isValidating, error, isValid, city_uf, validate } =
    useCepValidator();
  const [addedCeps, setAddedCeps] = useState<string[]>([]);

  const handleAddCep = async () => {
    const result = await validate(cep);
    if (result?.valid) {
      setAddedCeps([...addedCeps, cep]);
      handleCepChange(''); // Clear input
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <h3 className="font-semibold text-sm">Adicionar CEPs</h3>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="00000-000"
          value={cep}
          onChange={(e) => handleCepChange(e.target.value)}
          className={`flex-1 px-3 py-2 border rounded text-sm ${
            error
              ? 'border-red-300 bg-red-50'
              : isValid
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300'
          }`}
        />
        <Button
          onClick={handleAddCep}
          disabled={!isValid || isValidating}
          size="sm"
          className="gap-1"
        >
          {isValidating ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Adicionar
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}

      {isValid && city_uf && (
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
          <CheckCircle className="w-3 h-3 shrink-0" />
          {city_uf}
        </div>
      )}

      {/* Lista de CEPs adicionados */}
      {addedCeps.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-600 mb-2">CEPs adicionados:</p>
          <div className="space-y-1">
            {addedCeps.map((addedCep) => (
              <div
                key={addedCep}
                className="flex items-center justify-between bg-gray-50 p-2 rounded text-xs"
              >
                <span className="text-gray-700">{addedCep}</span>
                <button
                  onClick={() =>
                    setAddedCeps(addedCeps.filter((c) => c !== addedCep))
                  }
                  className="text-red-600 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. Arquivo `.env.example` Atualizado

```bash
# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=AIzaSyD...

# Outros configs
VITE_SUPABASE_URL=https://epgedaiukjippepujuzc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

---

## 5. Checklist de Integração

- [ ] Criar `src/lib/google-maps.ts`
- [ ] Criar `src/components/RouteVisualizationMap.tsx`
- [ ] Criar `src/hooks/useCepValidator.ts`
- [ ] Adicionar `VITE_GOOGLE_MAPS_API_KEY` ao `.env.local`
- [ ] Adicionar exemplo em `.env.example`
- [ ] Integrar `useCepValidator` em formulários de CEP
- [ ] Integrar `RouteVisualizationMap` em diálogo de detalhes
- [ ] Testar com CEPs reais (ex: 89015-000 para Navegantes)
- [ ] Testar validação com CEP inválido
- [ ] Verificar mapa carrega corretamente

---

## 6. Testar no Console

```typescript
// No console do navegador:

import { validateAndGeocodeCep } from '@/lib/google-maps';

// Teste 1: CEP válido (Navegantes-SC)
const result1 = await validateAndGeocodeCep('89015-000');
console.log(result1);
// Esperado: { valid: true, city_uf: "Navegantes - SC", latitude: ..., longitude: ... }

// Teste 2: CEP inválido
const result2 = await validateAndGeocodeCep('00000-000');
console.log(result2);
// Esperado: { valid: false, error: "CEP não encontrado" }
```

---

## 7. Troubleshooting

| Problema | Solução |
|---|---|
| "API Key not configured" | Adicione `VITE_GOOGLE_MAPS_API_KEY` ao `.env.local` e reinicie dev |
| "REQUEST_DENIED" | Verifique se Geocoding API está habilitada no console |
| Mapa em branco | Confirme Maps JavaScript API está habilitada |
| CEP não encontra | Valide CEP com formato XXXXX-XXX |

---

## Próximas Features

- [ ] Caching de CEPs validados (localStorage)
- [ ] Auto-preenchimento de address usando Google Places API
- [ ] Rota otimizada usando Google Routes API
- [ ] Export de rota em PDF com mapa
- [ ] Integração com tracking em tempo real
