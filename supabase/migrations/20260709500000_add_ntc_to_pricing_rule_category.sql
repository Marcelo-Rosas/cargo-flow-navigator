-- Adiciona categoria 'ntc' ao enum pricing_rule_category.
-- Deve rodar em transação separada antes de vec126 que usa esse valor.
-- (PostgreSQL não permite usar um valor de enum recém-adicionado na mesma transação.)
ALTER TYPE pricing_rule_category ADD VALUE IF NOT EXISTS 'ntc';
