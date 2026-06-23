-- Campos físicos/fiscais para emissão de MDF-e (modal rodoviário).
-- veiculo_tracao exige tara, tipo_rodado, tipo_carroceria, uf_licenciamento.
-- veiculos_reboque (complemento) exige os mesmos do reboque.
-- proprietário (terceiro/TAC) vem do owner vinculado (owner_id) — owners ganha
-- rntrc/uf/tipo_proprietario.

-- Veículo tração — físicos SEFAZ
alter table vehicles add column if not exists tara_kg numeric;
alter table vehicles add column if not exists tipo_rodado text;       -- 01 Truck,02 Toco,03 Cavalo,04 VAN,05 Utilitário,06 Outros
alter table vehicles add column if not exists tipo_carroceria text;   -- 00 N/A,01 Aberta,02 Fechada/Baú,03 Granelera,04 Porta Container,05 Sider
alter table vehicles add column if not exists uf_licenciamento text;

-- Reboque/complemento (quando plate_2 presente) — dados do veiculos_reboque
alter table vehicles add column if not exists reboque_tara_kg numeric;
alter table vehicles add column if not exists reboque_capacity_kg numeric;
alter table vehicles add column if not exists reboque_tipo_carroceria text;
alter table vehicles add column if not exists reboque_uf_licenciamento text;

-- Proprietário (owners) — dados fiscais para o MDF-e
alter table owners add column if not exists rntrc text;
alter table owners add column if not exists uf text;
alter table owners add column if not exists tipo_proprietario smallint; -- 0 TAC Agregado,1 TAC Independente,2 Outros
