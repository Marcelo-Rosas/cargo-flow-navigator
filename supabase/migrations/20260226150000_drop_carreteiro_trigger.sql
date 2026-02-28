-- Remove the trigger that enforces carreteiro_real before documentação.
-- The value is now managed via the CarreteiroTab in OrderDetailModal,
-- not required at stage transition time.
drop trigger if exists trg_enforce_carreteiro_real_before_documentacao on public.orders;
drop function if exists public.enforce_carreteiro_real_before_documentacao();
