# ⚡ Quickstart: Deploy Phases 1-3

**Time**: 5 minutos
**Status**: Ready for production
**Files changed**: 1 new, 1 modified

---

## 🚀 Deploy (Copy-Paste)

```bash
cd ~/cargo-flow-navigator

# 1. Type check
npx tsc --noEmit
# ✅ Should say nothing (silence is good)

# 2. Deploy
supabase functions deploy analyze-load-composition --no-verify-jwt
# ✅ Should say "✓ Deployed successfully"

# 3. Monitor (open new terminal, leave running)
supabase functions logs analyze-load-composition --tail
# ✅ Watch for [phase-1], [phase-2], [phase-3] logs
```

---

## ✅ Validation (3 things to check)

### 1️⃣ Logs appear within 1 minute
```
[phase-2] Enriching km_distance...
[phase-1] Combo rejected (quality=45%)...
[phase-3] Rejecting insufficient_data result...
```

### 2️⃣ No errors
```
❌ "composition-data-quality.ts not found" → File not in right place
❌ "INSUFFICIENT_DATA_MODEL is not defined" → Import missing
❌ "Type ... is not assignable" → Type definition wrong
```

### 3️⃣ DB check (within 5 minutes)
```sql
SELECT COUNT(*), route_evaluation_model
FROM load_composition_suggestions
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY route_evaluation_model;

-- ✅ Expected: 'webrouter_v1', 'stored_km_v1', maybe 'insufficient_data'
-- ❌ NOT expected: NEW entries with 'mock_v1'
```

---

## 🐛 If something breaks

### Option A: Check logs (2 min)
```bash
supabase functions logs analyze-load-composition --limit 50
# Look for ERROR or TypeError
```

### Option B: Rollback (instant)
```bash
# Deploy old version
supabase functions deploy analyze-load-composition --no-verify-jwt
# (It will revert to previous version automatically if build passes)
```

### Option C: Read troubleshooting
→ See `DEPLOYMENT_AND_TESTING.md` section "Troubleshooting"

---

## 📊 Expected Behavior

### Before (Old)
```
Quote without km → mock_v1 → suggestion created
Combo with <70% km → still analyzed → mock_v1
```

### After (New)
```
Quote without km → enrichment attempt
  ├─ If has CEP: calculate via WebRouter → enrich DB
  └─ If no CEP: skip
Combo with <70% km → rejected in phase-1 → NOT analyzed
Insufficient data → filtered out → suggestion NOT created
```

---

## 📁 Files Modified

- ✅ `supabase/functions/_shared/composition-data-quality.ts` — NEW (275 lines)
- ✅ `supabase/functions/analyze-load-composition/index.ts` — MODIFIED (8 changes)

---

## 📞 Next Steps

- [ ] Deploy (5 min)
- [ ] Monitor logs (5 min)
- [ ] DB validation (2 min)
- [ ] If all green → Done! ✅
- [ ] If issues → See troubleshooting

---

## 📚 Full Docs

- `EXECUTIVE_SUMMARY_PHASES_1_3.md` — Overview
- `VALIDATION_CHECKLIST_PHASES_1_3.md` — Detailed checklist
- `DEPLOYMENT_AND_TESTING.md` — Complete guide with curl examples
- `IMPLEMENTATION_PATCH_PHASES_1_3.md` — Exact code changes

---

**Ready?** Just run the 3 commands at the top and watch the logs. You got this! 🚀
