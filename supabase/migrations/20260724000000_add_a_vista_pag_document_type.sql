-- v4.x: Adicionar tipo a_vista_pag para comprovantes de pagamento à vista na aba Carreteiro (PAG)

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'a_vista_pag';
