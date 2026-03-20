# 🗺️ Configuração Google Maps API - Cargo Flow Navigator

## 1. Acessar Google Cloud Console

1. Abra: https://console.cloud.google.com
2. Selecione o projeto existente (`gen-lang-client-0106729343`) ou crie um novo
3. Certifique-se de estar no projeto correto (seletor no topo)

---

## 2. Habilitar as APIs Necessárias

### 2.1 Geocoding API

1. Vá para **APIs & Services** → **Enabled APIs & Services**
2. Clique em **+ Enable APIs and Services**
3. Pesquise por **"Geocoding API"**
4. Clique em **Enable**

### 2.2 Maps JavaScript API

1. Repita o processo acima
2. Pesquise por **"Maps JavaScript API"**
3. Clique em **Enable**

### 2.3 Routes API (opcional, para futuro)

1. Pesquise por **"Routes API"**
2. Clique em **Enable**

**Verificação:** Vá em **APIs & Services** → **Enabled APIs & Services**. Você deve ver:
- ✅ Geocoding API
- ✅ Maps JavaScript API
- ✅ Routes API (opcional)

---

## 3. Criar a API Key

1. Vá para **APIs & Services** → **Credentials**
2. Clique em **+ Create Credentials** → **API Key**
3. Uma chave será criada (ex: `AIzaSyD...`)
4. **Copie a chave** (você precisará dela)

---

## 4. Restringir a API Key (Segurança)

### 4.1 Restringir por Domínio

1. Na página **Credentials**, clique na sua API Key
2. Vá para **Application restrictions**
3. Selecione **HTTP referrers (websites)**
4. Adicione seus domínios:
   ```
   http://localhost:5173/*
   http://localhost:3000/*
   https://seu-dominio.com/*
   https://seu-dominio.vercel.app/*
   ```

### 4.2 Restringir por API

1. Vá para **API restrictions**
2. Selecione **Restrict key**
3. Marque apenas:
   - ☑ Geocoding API
   - ☑ Maps JavaScript API

**Salve as alterações**

---

## 5. Configurar Variáveis de Ambiente

### 5.1 Arquivo `.env.example`

Adicione:

```bash
# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=AIzaSyD...
```

### 5.2 Arquivo `.env.local` (seu ambiente local)

```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSyD...
```

### 5.3 Arquivo `.env.production` (produção)

```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSyD...
```

⚠️ **IMPORTANTE:** Nunca commite a chave real no Git. Use variáveis de ambiente do seu servidor de deploy.

---

## 6. Testar a Configuração

### Teste no Frontend

```typescript
// src/lib/google-maps.ts
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
console.log('🔑 Google Maps API Key loaded:', apiKey ? '✅' : '❌');
```

Execute no console do navegador:
```javascript
console.log(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
```

Você deve ver a chave ou erro se não estiver configurada.

### Teste de Geocoding

```typescript
import { validateAndGeocodeCep } from '@/lib/google-maps';

const result = await validateAndGeocodeCep('89015-000');
console.log(result);
// Esperado: { valid: true, city_uf: "Blumenau - SC", latitude: ..., longitude: ... }
```

---

## 7. Custos e Quotas

| Serviço | Custo | Quota Mensal (Grátis) |
|---|---|---|
| **Geocoding API** | $0,005 / chamada | 1.000 chamadas/dia |
| **Maps JS API** | $7 / 1000 carregamentos | 28.000 carregamentos/mês |
| **Routes API** | $0,01 / chamada | 100 chamadas/dia |

**Para Vectra:**
- ~10 cotações/dia × 3 CEPs = 30 chamadas/dia = **R$ 4,50/mês** (muito barato!)
- Mapa carregado ~50x/dia = **R$ 10/mês** (estimado)
- **Total:** ~R$ 15/mês

✅ **Ativação gratuita** dos primeiros R$ 200/mês no Google Cloud

---

## 8. Troubleshooting

### Erro: "API Key not configured"

```
❌ Google Maps API não configurado
```

**Solução:**
1. Verifique se `VITE_GOOGLE_MAPS_API_KEY` está em `.env.local`
2. Reinicie o servidor dev (`npm run dev`)
3. Verifique no console: `console.log(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)`

### Erro: "REQUEST_DENIED"

```
{
  "status": "REQUEST_DENIED",
  "error_message": "The API key is invalid..."
}
```

**Soluções:**
1. Confirme que a chave está correta (sem espaços)
2. Verifique se **Geocoding API está habilitada** no console
3. Valide as restrições de domínio (adicione `localhost:5173`)

### Erro: "ZERO_RESULTS"

```
{
  "status": "ZERO_RESULTS",
  "error_message": "CEP não encontrado"
}
```

**Causa:** CEP inválido ou fora do Brasil
**Solução:** Validar formato (8 dígitos) antes de enviar

### Mapa em branco

**Causas comuns:**
1. API Key inválida
2. Maps JavaScript API não habilitada
3. Container sem dimensões (height)

**Solução:**
```css
.map-container {
  width: 100%;
  height: 400px; /* importante! */
}
```

---

## 9. Próximos Passos

- [ ] Criar API Key no console
- [ ] Habilitar Geocoding API + Maps JS API
- [ ] Adicionar a chave ao `.env.local`
- [ ] Criar `src/lib/google-maps.ts`
- [ ] Criar componente `RouteVisualizationMap.tsx`
- [ ] Testar com CEPs reais
- [ ] Integrar validação no formulário

---

## 📚 Referências

- [Google Cloud Console](https://console.cloud.google.com)
- [Geocoding API Docs](https://developers.google.com/maps/documentation/geocoding)
- [Maps JS API Docs](https://developers.google.com/maps/documentation/javascript)
- [API Pricing](https://mapsplatform.google.com/pricing)
