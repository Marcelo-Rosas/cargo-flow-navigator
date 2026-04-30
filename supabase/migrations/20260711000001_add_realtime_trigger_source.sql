-- Adds 'realtime' to the allowed values of trigger_source on load_composition_suggestions.
-- Required by matchmaker-proactive-v6-cfn which fires on realtime subscription events.
ALTER TABLE load_composition_suggestions
  DROP CONSTRAINT IF EXISTS load_composition_suggestions_trigger_source_check;

ALTER TABLE load_composition_suggestions
  ADD CONSTRAINT load_composition_suggestions_trigger_source_check
  CHECK (trigger_source IN ('batch', 'on_save', 'manual', 'realtime'));
