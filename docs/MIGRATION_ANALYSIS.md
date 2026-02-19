# Análise da Migration 20260218221038 (db pull)

## O que foi feito

O comando `supabase db pull` foi executado e gerou a migration `20260218221038_remote_schema.sql`, que captura as diferenças entre o schema local (após migrations até `20260218120000`) e o banco remoto atual.

A migration já está em sincronia: `supabase migration list` mostra que ela existe tanto localmente quanto no remoto.

---

## Resumo das mudanças na 20260218221038

### ✅ Pode migrar (seguro)

| Mudança | Impacto |
|---------|---------|
| `clients.user_id` (NOT NULL DEFAULT auth.uid()) | Nova coluna com default; tabela passa a ter rastreio por usuário |
| `documents.fat_id` | Coluna nullable, sem impacto imediato |
| `document_type` enum | Adiciona valores: `antt_motorista`, `mdfe`, `adiantamento` |
| `profiles.perfil` (user_profile) | Novo enum `admin`, `operacional`, `financeiro`; `profiles` passa a ter `perfil` em vez de só `user_id` |
| `shippers.cnpj` → varchar(18) | Ajuste de tipo |
| `user_id` em várias tabelas (conditional_fees, icms_rates, payment_terms, price_table_rows, price_tables, pricing_parameters, tac_rates, toll_routes, vehicle_types, waiting_time_rules) | Colunas opcionais com `DEFAULT auth.uid()` |
| Novos índices (idx_clients_user_id, idx_documents_fat_id, etc.) | Melhoria de performance |
| Funções: `copy_quote_adiantamento_to_fat`, `current_user_profile`, `enforce_company_domain`, `handle_new_user_profile`, `is_admin`, `set_user_profile` | Novas funções de apoio; `is_admin` passa a usar `perfil` em vez de `user_roles` |
| `drop extension pg_net` | Remove extensão não usada |

### ⚠️ Atenção – RLS

- **orders, quotes, documents, occurrences, payment_terms, price_tables, price_table_rows, pricing_parameters, conditional_fees, icms_rates, toll_routes, tac_rates, vehicle_types, waiting_time_rules, profiles**: policies com **"Full access"** (`using (true) with check (true)`) – acesso compartilhado para usuários autenticados.
- **clients**: policies **por `user_id`** – cada usuário vê apenas seus próprios clientes. Impacta se o app depende de clientes compartilhados.
- **shippers**: policies com `has_role` / `has_any_role` (modelo baseado em `app_role`) – compatível com o modelo atual do app.

### ❌ Não migrar (não aplicar o diff antigo)

O diff anterior de `supabase db diff` sugeria **drops** de:

- tabela `owners`
- colunas de `quotes`: `shipper_id`, `shipper_name`, `shipper_email`, `origin_cep`, `destination_cep`, `freight_type`, `quote_code`
- colunas de `orders`: `carreteiro_antt`, `carreteiro_real`, `owner_name`, `owner_phone`

Esses DROPs **não devem ser aplicados**: o app usa essas estruturas e o banco remoto está correto.

---

## Status atual

| Item | Status |
|------|--------|
| Migration `20260218221038` | Criada pelo `db pull` e aplicada local + remoto |
| owners, shipper_id, quote_code, carreteiro | Preservados nas migrations e no remoto |
| Histórico de migrations | Alinhado local/remoto até `20260220160000` |

---

## Diff atual (`supabase db diff`)

O `supabase db diff` ainda mostra DROPs para estruturas usadas pelo app:
- `owners`, colunas de carreteiro, shipper, quote_code, user_id, perfil, etc.

**Não aplique esse diff** – ele removeria estruturas em uso no banco remoto e quebraria o app. A diferença entre shadow DB e remoto indica que o histórico de migrations e o schema remoto não estão totalmente alinhados (possivelmente por mudanças manuais ou ordem diferente de aplicação).

---

## Próximos passos sugeridos

1. **Manter** a migration `20260218221038_remote_schema.sql` – ela documenta o estado do remoto naquele momento.
2. **Não aplicar** o output atual do `supabase db diff` – os DROPs são destrutivos.
3. **Validar fluxos com `clients`** – se o app precisa de clientes compartilhados, ajuste as policies de RLS.
4. Para novas mudanças, usar sempre migrations incrementais: `supabase migration new descricao` e aplicar com `supabase db push`.
