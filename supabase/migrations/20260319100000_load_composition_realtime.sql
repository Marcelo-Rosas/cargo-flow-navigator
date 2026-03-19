-- Enable realtime for load_composition_suggestions
-- Required for useLoadCompositionSuggestionsRealtime (postgres_changes channel)
ALTER PUBLICATION supabase_realtime ADD TABLE public.load_composition_suggestions;
