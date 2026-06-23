# Plano — Integração SintegrAPI: Inscrição Estadual na fonte

Mata os bloqueios SEFAZ `481` (IE do tomador) e `716` (IE do remetente) automatizando a resolução de IE por CNPJ+UF, em vez de coleta manual. Também corrige o default errado `ie_indicator=1` em massa (569 clientes + 28 embarcadores).

## API (confirmado em docs.sintegrapi.com.br)

```
GET https://api.sintegrapi.com.br/consultas/v2/sintegra/{cnpj}?uf=<UF>&cache_strategy=ONLINE_PREFERENCIAL
Header: x-api-key: <apiKey>
```
- `uf` opcional (`SC`, `SP`, … ou `BR` p/ todas). `cache` (dias, default 7), `cache_strategy`, `error_fallback`.

Resposta:
```json
{
  "cnpj": "...", "razao_social": "...", "uf": "SC",
  "inscricoes_estaduais": [
    { "inscricao_estadual": "...", "uf": "SC", "ativa": true,
      "tipo_ie": "...", "situacao_pj": "Sem restrição" }
  ],
  "success": true, "error": false
}
```

**Regra de classificação:**
- Existe IE `ativa=true` na UF do cadastro → contribuinte: `ie_indicator=1` + `state_registration=<ie>`
- Nenhuma IE ativa na UF → não-contribuinte: `ie_indicator=9`, sem IE

---

## Caminho rápido (destrava o `autorizado` HOJE)

Sem construir nada: assim que houver a API key, resolver a IE do KONNEN direto e reemitir.
```
# 1. obter IE
GET /consultas/v2/sintegra/09447411000102?uf=SC   → inscricao_estadual
# 2. gravar
UPDATE shippers SET state_registration='<IE>' WHERE id='c4a8d3dd-2b6f-4b38-9103-ab8ac8090379';
# 3. re-emit VANGARD → esperado: autorizado
```

---

## Fase 0 — Setup (ação do usuário)
- Criar conta + API key em `https://sintegrapi.com.br/app/api-keys`
- `supabase secrets set SINTEGRA_API_KEY=<key> --project-ref epgedaiukjippepujuzc`
- Confirmar **preço por consulta** + limite (API é paga; backfill ~600 chamadas uma vez + cache 7d)

## Fase 1 — Helper edge `supabase/functions/_shared/ie-lookup.ts`
Espelho do `ibge-lookup.ts`:
```ts
export async function lookupIeByCnpj(cnpj: string, uf: string): Promise<{
  ie: string | null; ativa: boolean; naoContribuinte: boolean;
}>
```
- Chama a API, filtra `inscricoes_estaduais` por `uf` + `ativa===true`, retorna a 1ª IE ativa.
- Sem IE ativa na UF → `naoContribuinte=true`.
- Timeout + try/catch: **nunca travar emissão** (degrada pro estado atual).

## Fase 2 — Wire no `emit-cte` (runtime, fallback) — destrava teste E produção
Antes de montar o payload, p/ remetente (shipper) e tomador (client):
- Se `ie_indicator=1` e `state_registration` vazio → `lookupIeByCnpj(cnpj, uf)`:
  - achou IE → usa no payload **e** persiste no cadastro (backfill incremental)
  - não achou IE ativa → seta `ie_indicator=9` (não contribuinte) automaticamente
- Mantém emissão fluindo sem depender de cadastro prévio completo.

## Fase 3 — CRUD: auto-preencher IE (UX)
`ClientForm` + `ShipperForm` (espelha o padrão de `src/lib/cnpjLookup.ts`):
- No blur do CNPJ → chamar lookup (via edge) → auto-preencher `state_registration` + setar `ie_indicator` (1 se IE ativa, 9 se nenhuma).
- Badge: "IE via SintegrAPI" / "Não contribuinte". Botão "Buscar IE" manual também.
- Fecha os gaps do doc `CRUD_FORM_CHANGES.md` §1/§2.

## Fase 4 — Backfill batch
`scripts/backfill-ie-sintegra.ts` (idempotente, espelho de `scripts/backfill-cnpj-lookup.ts`):
- Para cada client/shipper com `cnpj`: consultar IE na UF do cadastro; gravar `state_registration` + `ie_indicator` (9 se sem IE ativa).
- Rate-limit + cache; log de quem virou não-contribuinte.
- Corrige o `ie_indicator=1` blanket: quem não tem IE ativa → `9`. (~600 cadastros.)

## Fase 5 — Hardening mapper
`cte-mapper.ts`: p/ remetente/tomador **não-contribuinte** (`ie_indicator=9`) enviar tratamento correto (omitir IE / indicador adequado) — fecha 716/481 nos dois lados mesmo sem IE.
+ validação fail-fast quando `ie_indicator=1 && IE vazia` (doc §6.3).

---

## Ordem de execução
**F0 (key)** → **F1 (helper)** → **F2 (emit runtime)** ← *já autoriza o teste* → **F4 (backfill)** → **F3 (CRUD UX)** → **F5 (mapper)**.

Caminho mínimo p/ o 1º `autorizado`: F0 + resolver KONNEN na mão (curl) + reemitir. Integração completa: F1–F5.

## Riscos
- **Custo**: API paga por consulta. Backfill = ~600 chamadas (uma vez). Cache 7d reduz reconsulta. Confirmar plano antes do batch.
- **Cobertura UF**: validar que SintegrAPI cobre todas as UFs dos clientes (não só SC).
- **Dado público**: CNPJ→IE é cadastro fiscal público — sem issue de privacidade.
