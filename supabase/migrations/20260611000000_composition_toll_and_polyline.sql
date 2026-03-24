-- Composição de carga: persistir pedágio e polyline do WebRouter
-- Resolve: toll R$0,00 ao reabrir modal + mapa sem traçado

-- Routings: toll por leg
ALTER TABLE load_composition_routings
  ADD COLUMN IF NOT EXISTS toll_centavos integer DEFAULT 0;

-- Suggestions: totais da rota consolidada + polyline + mapa
ALTER TABLE load_composition_suggestions
  ADD COLUMN IF NOT EXISTS total_toll_centavos integer,
  ADD COLUMN IF NOT EXISTS total_toll_tag_centavos integer,
  ADD COLUMN IF NOT EXISTS encoded_polyline text,
  ADD COLUMN IF NOT EXISTS url_mapa_view text,
  ADD COLUMN IF NOT EXISTS webrouter_id_rota integer;

COMMENT ON COLUMN load_composition_routings.toll_centavos IS 'Pedágio proporcional do leg (centavos)';
COMMENT ON COLUMN load_composition_suggestions.total_toll_centavos IS 'Pedágio total da rota consolidada (centavos)';
COMMENT ON COLUMN load_composition_suggestions.encoded_polyline IS 'Polyline codificada WebRouter (path.polyline)';
COMMENT ON COLUMN load_composition_suggestions.url_mapa_view IS 'URL visualização mapa WebRouter';
COMMENT ON COLUMN load_composition_suggestions.webrouter_id_rota IS 'ID da rota salva no WebRouter';
