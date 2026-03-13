# Correção: Botão Adicionar Parada (Round 1 / Nova Cotação)

**Data:** 2025-03-07  
**Status:** Implementação concluída | Validado localmente | Aguardando deploy

---

## 1. Resumo

Correção da regressão em que o botão "Adicionar parada" aparecia indevidamente no round 1 (IdentificationStep). A regra correta: **só exibir quando houver 2+ clientes/destinatários**.

---

## 2. O que foi implementado

| Item | Status |
|------|--------|
| Botão `[+] Adicionar parada` condicional | ✅ `showParadas = clientCount > 1` |
| Seção "Destinatários adicionais" | ✅ Botão `[+] Adicionar cliente` |
| Limpeza de `route_stops` ao voltar para 1 cliente | ✅ |
| Hidratação ao editar cotação com paradas | ✅ |
| Compatibilidade cotações legadas | ✅ |

**Arquivos alterados (feature):**
- `src/components/forms/QuoteForm.tsx`
- `src/components/forms/quote-form/steps/IdentificationStep.tsx`

---

## 3. Validação local

### E2E (4 cenários)

- **Spec:** `tests/e2e/quote-paradas-gating.spec.ts`
- **Status vs build local:** 4/4 passing
- **Status vs produção:** falha (correção ainda não deployada)

| Cenário | Resultado local |
|---------|-----------------|
| 1 cliente => não exibe botão Adicionar parada | ✅ |
| 2 clientes => exibe botão Adicionar parada | ✅ |
| 3+ clientes => continua exibindo | ✅ |
| Remover cliente extra => botão desaparece | ✅ |

### Por que produção falha

- A produção está rodando **build antigo**, sem a correção.
- **Teste 1:** botão aparece com 1 cliente (comportamento antigo / regressão).
- **Testes 2–4:** UI de "Destinatários adicionais" e "Adicionar cliente" podem não existir ou exigir scroll.
- **Causa:** ambiente de produção ainda não recebeu deploy desta correção.
- **Não é** regressão do código local — o build local está correto e validado.

### Risco de falso negativo

- **`npm run test:e2e`** usa `baseURL` = produção por padrão.
- Após merge sem deploy, os testes continuarão falhando contra produção.
- **Solução:** validar em staging/preview após deploy; rodar `test:e2e:paradas` contra preview se houver URL de preview.

---

## 4. Como reproduzir a validação local

```bash
# Terminal 1: build e servir na porta 4173
npm run build
npm run preview:static

# Terminal 2: rodar E2E contra build local
npm run test:e2e:paradas
```

Alternativa (toda a suíte E2E contra local):

```bash
# Terminal 1
npm run build && npm run preview:static

# Terminal 2
npm run test:e2e:local
```

**PowerShell (Windows):**

```powershell
$env:PW_BASE_URL = 'http://localhost:4173'; npx playwright test tests/e2e/quote-paradas-gating.spec.ts --project=chromium-mocks
```

---

## 5. Próximos passos operacionais

1. **Merge/PR** do código (feature + spec + docs).
2. **Deploy** em staging ou preview (Vercel/CF preview, etc.).
3. Rodar E2E contra a URL de preview:
   `PW_BASE_URL=<url-preview> npm run test:e2e:paradas`
4. **Deploy em produção**.
5. Rerun E2E contra produção para confirmar (ou manter apenas validação manual em produção).

---

## 6. Scripts e config

| Script | Uso |
|--------|-----|
| `preview:static` | Serve build na porta 4173 (para E2E local) |
| `test:e2e:local` | E2E contra `http://localhost:4173` |
| `test:e2e:paradas` | E2E dos specs de paradas contra local |

`playwright.config.ts`: `baseURL` = `PW_BASE_URL` (env) ou produção.

---

## 7. Riscos e fora de escopo

- **Riscos:** Cotações antigas preservadas; ao voltar para 1 cliente, paradas são limpas (comportamento esperado).
- **Fora de escopo:** persistência de `additional_recipients`, testes unitários para wizard.
