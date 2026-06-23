-- Contato da empresa (emitente) editável via rota /empresa (company_settings).
-- Usado nos documentos (espelho CT-e Vectra hoje; emitente do DACTE no futuro)
-- em vez de valores hardcoded no código/env. O usuário preenche em /empresa.
alter table company_settings add column if not exists phone text not null default '';
alter table company_settings add column if not exists email text not null default '';
