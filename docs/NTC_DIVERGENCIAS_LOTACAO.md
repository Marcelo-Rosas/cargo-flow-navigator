# Divergências Lotação — NTC mar/2026 vs Engine

Catálogo de divergências conhecidas entre o referencial NTC março/2026 e a engine de precificação da Vectra Cargo.
Atualizado em 2026-05-01. Não reabrir sem dado novo que altere o impacto estimado.

---

| # | Divergência | Status | Gatilho para puxar |
|---|---|---|---|
| 1 | **TAC parity client/server** — Edge calcula TAC ≥5% diesel de acordo com regra; client-side apenas declara `tacAdjustment` sem recalcular (`freightCalculator.ts:~411`). Diferença visível apenas se o usuário editar manualmente o TAC no form. | Adiado | Quando recálculo client-side mostrar Δ > R$ 50 em relação ao edge em qualquer cotação ativa |
| 2 | **Truck vs Carreta 3 Eixos NTC** — Tabela "Referencial Dez 2025" tem 1 coluna `cost_per_ton`. NTC mar/2026 tem 2 colunas (Truck e Carreta 3-Eixos) com spread de até 18% em distâncias longas. Bi-Truck (axes=3) representa 14% das cotações ativas, média 664 km. Impacto contido. | Adiado | Quando Vectra decidir migrar para NTC mar/2026 oficial em vez do "Referencial Dez 2025" |
| 3 | **Carreta 5/6 Eixos sem referência NTC pública** — 26% das cotações ativas usam axes=5 ou 6. NTC mar/2026 não publica tabela para esses veículos. Engine usa a mesma `cost_per_ton` genérica da tabela atual. | Adiado | Quando Vectra publicar política interna de `cost_per_ton` por eixo para veículos acima de 3 eixos |
| 4 | **Cubagem 300 kg/m³ aplicada antes do split de modalidade** — Lotação não tem trava de 1.000 kg como o fracionado. Se peso cubado > peso real em lotação, o cliente é cobrado por peso cubado sem aviso explícito. | Auditar | Se cotação de lotação for cobrada por peso cubado > peso real e gerar reclamação de cliente |
| 5 | **Ceil rounding em lotação** — Engine arredonda `cost_per_ton × tonBillable` para cima (ceil). NTC não especifica arredondamento. Impacto máximo: R$ 0,99/cotação. | Documentado | Não puxar — decisão local da Vectra para evitar subcobrança de centavos |

---

## Itens resolvidos (não reabrir)

| # | Item | Resolução | Data |
|---|---|---|---|
| A | **Ad Valorem Lotação global vs por tabela** — engine usava 0,03% global (Berkley RCTR-C+RC-DC) para todas as tabelas. Cliente cobrado pelo custo de apólice em vez da taxa comercial NTC (0,30%+0,15-0,30%). | Coluna `price_tables.ad_valorem_lotacao_percent` adicionada. Por tabela com fallback para global. Migration `20260501000000_price_tables_ad_valorem_lotacao.sql`. | 2026-05-01 |
| B | **`cost_value_percent` (RCTR-C) zerado pela regra global** — `pricing_rules_config.cost_value_percent=0` sobrescrevia a faixa da tabela (0,3–1,2%), zerando RCTR-C de todas as cotações lotação desde 2026-04-16. | Invertida a precedência em `calculate-freight` e `freightCalculator.ts`: tabela > rule para lotação. | 2026-05-01 |
| B.2 | **Reversão controlada da preced. de RCTR-C para lotação** — operação queria poder ajustar RCTR-C via Central de Regras (a tabela "Referencial Dez 2025" tem `cost_value_percent` 0,3–1,2% por km e gera valores absolutos altos para NF alta). | Preced. lotação volta a ser **Central > tabela**, mas Central=0 é tratado como "não configurado" (cai na tabela). Setar Central > 0 = override global em todas as lotações. Setar Central = 0 = preserva valores NTC da tabela. Aplicado em `calculate-freight` e `freightCalculator.ts`. | 2026-05-11 |
| C | **Dead data em `price_table_rows` para lotação** — colunas `gris_percent`, `tso_percent`, `ad_valorem_percent` populadas no import mas zerradas pela engine para lotação. Editores acreditavam estar mudando algo. | Documentado; UI `ActiveTableCard` exibe Ad Valorem da tabela. Futuro: ocultar colunas mortas na tela de rows quando `modality='lotacao'`. | 2026-05-01 |
| D | **Banner ANTT — Piso MP 1.343/2026** — cotação com `valorNegociado < pisoAntt` não gerava alerta nem bloqueava PDF. | Implementado em `AnttFloorBanner.tsx` e `usePdfDownload.ts`. Branch `feat/antt-floor-compliance`. | anterior |
