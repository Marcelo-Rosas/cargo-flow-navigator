# Load Composition v2 — Deploy Checklist

## Pre-deploy

- [ ] Migration `20260605000000_load_composition_v2_columns.sql` applied
  - Adds: `trigger_source`, `anchor_quote_id`, `technical_explanation`, `delta_km_*`, `base_km_total`, `composed_km_total`, `route_evaluation_model`
  - Adds: dedup index `idx_lcs_dedup_quote_ids`
  - Updates: `load_composition_summary` view

- [ ] Env vars configured in Supabase Edge Functions:
  - `SUPABASE_URL` (automatic)
  - `SUPABASE_SERVICE_ROLE_KEY` (automatic)
  - `WEBROUTER_API_KEY` (required for real route evaluation; fallback works without it)

- [ ] Frontend build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)

## Deploy order

1. **Migration first** — `supabase db push` or apply via dashboard
2. **Edge Function** — `supabase functions deploy analyze-load-composition`
3. **Frontend** — push to trigger Cloudflare Pages build

## Verification

After deploy, test each flow:

### Batch
1. Open commercial Kanban
2. Click "Ver oportunidades" for a shipper with 2+ quotes in stages `precificacao`/`enviado`/`negociacao`
3. Click "Gerar sugestões"
4. Verify suggestions appear in the list; each card shows a **Batch** badge (source: `trigger_source: batch` persisted on `load_composition_suggestions`)
5. Optional: in Supabase Table Editor or SQL, `select trigger_source from load_composition_suggestions where shipper_id = '…' order by created_at desc limit 5` — expect `batch` for rows created via this button

### On-save
1. Create/edit a quote for a shipper that already has other eligible quotes
2. Save the quote
3. Check composition panel — new suggestion with `trigger_source: on_save` should appear
4. Verify toast or query invalidation refreshed the list

### Manual
1. (Not yet in UI — API only) POST to `analyze-load-composition` with `trigger_source: manual` and `quote_ids: [...]`

## Rollback

If issues occur:

```sql
-- Revert v2 columns (safe — data loss on new columns only)
DROP INDEX IF EXISTS idx_lcs_dedup_quote_ids;
DROP INDEX IF EXISTS idx_lcs_anchor_quote;
ALTER TABLE load_composition_suggestions
  DROP COLUMN IF EXISTS trigger_source,
  DROP COLUMN IF EXISTS anchor_quote_id,
  DROP COLUMN IF EXISTS technical_explanation,
  DROP COLUMN IF EXISTS delta_km_abs,
  DROP COLUMN IF EXISTS delta_km_percent,
  DROP COLUMN IF EXISTS base_km_total,
  DROP COLUMN IF EXISTS composed_km_total,
  DROP COLUMN IF EXISTS route_evaluation_model;
```

Then redeploy the previous Edge Function version from git.

## Health check

The Edge Function performs a schema probe on startup. If migrations are missing, it returns HTTP 503 with `env_error: true` and a human-readable message indicating which migration to apply.
