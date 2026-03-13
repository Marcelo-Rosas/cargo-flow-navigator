# Resend Webhook – Configuração via CLI

## 1. Definir o secret no Supabase

```bash
# Substitua whsec_xxx pelo seu Signing Secret do Resend (Webhooks → seu webhook → Signing secret)
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXX
```

## 2. Fazer deploy da função

```bash
supabase functions deploy resend-webhook --no-verify-jwt
```

## 3. URL do endpoint (para configurar no Resend)

```
https://epgedaiukjippepujuzc.supabase.co/functions/v1/resend-webhook
```

## 4. Configurar no Resend

**Dashboard:** [Resend Webhooks](https://resend.com/webhooks) → Add Webhook

- **Endpoint URL:** `https://epgedaiukjippepujuzc.supabase.co/functions/v1/resend-webhook`
- **Eventos sugeridos:** `email.sent`, `email.delivered`, `email.bounced`, `email.opened`, `email.clicked`

**Ou via API (exemplo cURL):**

```bash
curl -X POST "https://api.resend.com/webhooks" \
  -H "Authorization: Bearer re_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://epgedaiukjippepujuzc.supabase.co/functions/v1/resend-webhook",
    "events": ["email.sent", "email.delivered", "email.bounced", "email.opened", "email.clicked"],
    "description": "Vectra Cargo – eventos de email"
  }'
```

## Comandos em sequência

```bash
cd c:\Users\marce\cargo-flow-navigator

# 1. Set secret (substitua whsec_xxx pelo valor real)
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXX

# 2. Deploy
supabase functions deploy resend-webhook --no-verify-jwt
```
