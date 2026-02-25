-- Backfill user_id for existing profiles where NULL
-- Skips rows where the id already exists as user_id in another profile
UPDATE public.profiles p
SET user_id = p.id
WHERE p.user_id IS NULL
  AND p.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.user_id = p.id AND p2.id <> p.id
  );
