-- Adicionar categoria 'risco' ao enum pricing_rule_category (transação separada - PostgreSQL não permite usar novo valor na mesma transação)
DO $$ BEGIN
  ALTER TYPE pricing_rule_category ADD VALUE 'risco';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
