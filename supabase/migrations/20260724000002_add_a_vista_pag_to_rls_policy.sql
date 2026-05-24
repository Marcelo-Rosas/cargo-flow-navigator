-- v4.x: Incluir a_vista_pag na RLS policy documents_delete para perfil financeiro

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents FOR DELETE
USING (
  is_admin()
  OR (
    has_profile(ARRAY['financeiro'::user_profile])
    AND (type = ANY (ARRAY[
      'a_vista_fat'::document_type, 'saldo_fat'::document_type,
      'a_prazo_fat'::document_type, 'adiantamento'::document_type,
      'a_vista_pag'::document_type,
      'adiantamento_carreteiro'::document_type, 'saldo_carreteiro'::document_type,
      'comprovante_vpo'::document_type, 'nfe'::document_type,
      'cte'::document_type, 'pod'::document_type,
      'mdfe'::document_type, 'analise_gr'::document_type,
      'doc_rota'::document_type, 'comprovante_descarga'::document_type
    ]))
  )
  OR (
    has_profile(ARRAY['operacional'::user_profile])
    AND (uploaded_by = (SELECT auth.uid()))
  )
);
