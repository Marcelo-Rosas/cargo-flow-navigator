# Edge Functions / Supabase / RLS

## Paths

- Edge Functions: `supabase/functions/`
- Client: `src/integrations/supabase/client.ts`
- Tipos: `src/integrations/supabase/types.generated.ts`
- Helper invoke: `src/lib/` — `supabase-invoke` ou similar para chamar Edge Functions

## Principais Edge Functions

- `calculate-freight` — cálculo servidor
- `notification-hub` — WhatsApp (OpenClaw), notificações
- `calculate-distance-webrouter` — roteirização
- `price-row` — busca linha de tabela de preço
- `ensure-financial-document`, `process-payment-proof`, `process-quote-payment-proof`
- `workflow-orchestrator`, `ai-manager`, `ai-orchestrator-agent`
- `invite-user`, `lookup-cep`, `download-document`, `send-quote-email`, `reconcile-trip`

## RLS

Supabase com RLS habilitado. Incluir `user_id` em inserts onde aplicável.
