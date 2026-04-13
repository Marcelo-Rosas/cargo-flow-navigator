-- VEC-46: Drop indexes that are redundant (subsumed by a wider index on the same table).
-- All dropped indexes are non-unique and their columns form a prefix of a broader
-- index that PostgreSQL can use for the same queries.
--
-- Kept: unique constraint indexes, FK support indexes (VEC-53), standalone indexes
--       with non-zero scan potential.

-- route_metrics_config_route_idx ON (origin_uf, destination_uf)
-- → subsumed by: route_metrics_config_unique ON (origin_uf, destination_uf, vehicle_type_id)
DROP INDEX IF EXISTS route_metrics_config_route_idx;

-- idx_logistics_traffic_rules_city_state ON (city, state)
-- → subsumed by: logistics_traffic_rules_city_state_organ_name_key UNIQUE ON (city, state, organ_name)
DROP INDEX IF EXISTS idx_logistics_traffic_rules_city_state;

-- idx_risk_evaluations_entity ON (entity_type, entity_id)
-- → subsumed by: idx_risk_evaluations_entity_status ON (entity_type, entity_id, status)
DROP INDEX IF EXISTS idx_risk_evaluations_entity;

-- idx_profiles_id ON (id)
-- → subsumed by: profiles primary key index on id
DROP INDEX IF EXISTS idx_profiles_id;
