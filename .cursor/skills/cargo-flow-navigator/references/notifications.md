# Notificações / WhatsApp / OpenClaw / Email

## Regra

WhatsApp **sempre via OpenClaw webhook**. Nunca chamar Evolution API diretamente.

## Entrypoints

- Edge Function: `supabase/functions/notification-hub/index.ts`
- Se `OPENCLAW_WEBHOOK_URL` não configurado → status `pending_whatsapp`
- Email: `send-quote-email` Edge Function
