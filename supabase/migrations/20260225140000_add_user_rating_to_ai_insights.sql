ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS user_rating SMALLINT CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
  ADD COLUMN IF NOT EXISTS user_feedback TEXT;

COMMENT ON COLUMN public.ai_insights.user_rating IS 'User feedback: 1=not useful, 5=very useful';
COMMENT ON COLUMN public.ai_insights.user_feedback IS 'Optional free-text feedback from user';
