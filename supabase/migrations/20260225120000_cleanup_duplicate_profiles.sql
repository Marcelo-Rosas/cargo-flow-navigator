-- Remove orphan duplicate profile for marcelo.rosas@vectracargo.com.br
-- The real profile is 7d1b824d (admin, user_id = aa587185)
-- The orphan is aa587185 (operacional, user_id = NULL) — created by old trigger
DELETE FROM public.profiles
WHERE id = 'aa587185-fb40-4276-8439-3ee153aa5a1c'
  AND user_id IS NULL;
