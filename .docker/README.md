# Pasta `.docker` — legado

O stack **Evolution API** (WhatsApp via Evolution + Postgres local) foi **removido** em 2026-05-27.

## WhatsApp / Meta no Cargo Flow Navigator

Mensagens saem **somente** pela Edge Function **`notification-hub`** → **OpenClaw** (integração Meta). Não há Evolution API neste projeto.

- Não subir `evolution-api` nem expor `localhost:8080` para WhatsApp.
- Configuração de produção: secrets no Supabase / OpenClaw, não em `.docker/`.

## Backend local

Use o Postgres e as Edge Functions do **Supabase CLI**:

```bash
supabase start
```

Variáveis locais: `supabase/.env.local` e `supabase/functions/.env.local.functions.txt`.
