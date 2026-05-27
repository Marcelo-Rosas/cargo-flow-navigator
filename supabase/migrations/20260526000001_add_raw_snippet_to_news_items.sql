-- Adiciona coluna raw_snippet à tabela news_items (caso não exista)
-- A coluna foi definida na migration original 20260410100000_create_news_items.sql
-- mas pode não ter sido aplicada em alguns ambientes.

alter table public.news_items
add column if not exists raw_snippet text;
