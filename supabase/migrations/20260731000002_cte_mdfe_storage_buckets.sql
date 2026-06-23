-- =====================================================
-- Storage buckets for CT-e / MDF-e XML + DACTE/DAMDFE PDFs (F1.3)
-- 4 private buckets, role-gated select/insert, admin-only delete.
-- Paths:
--   cte-documents/{ambiente}/{ref}.xml
--   mdfe-documents/{ambiente}/{ref}.xml
--   dacte-pdfs/{ambiente}/{ref}.pdf
--   damdfe-pdfs/{ambiente}/{ref}.pdf
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cte-documents',   'cte-documents',   false, 5242880, ARRAY['application/xml','text/xml']),
  ('mdfe-documents',  'mdfe-documents',  false, 5242880, ARRAY['application/xml','text/xml']),
  ('dacte-pdfs',      'dacte-pdfs',      false, 10485760, ARRAY['application/pdf']),
  ('damdfe-pdfs',     'damdfe-pdfs',     false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- cte-documents (XML)
-- =====================================================
CREATE POLICY "cte_documents_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cte-documents'
    AND public.has_profile(ARRAY['admin','financeiro','operacional','comercial']::public.user_profile[]));

CREATE POLICY "cte_documents_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cte-documents'
    AND public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "cte_documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cte-documents' AND public.is_admin());

-- =====================================================
-- mdfe-documents (XML)
-- =====================================================
CREATE POLICY "mdfe_documents_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mdfe-documents'
    AND public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

CREATE POLICY "mdfe_documents_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mdfe-documents'
    AND public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "mdfe_documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mdfe-documents' AND public.is_admin());

-- =====================================================
-- dacte-pdfs (PDF DACTE)
-- =====================================================
CREATE POLICY "dacte_pdfs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dacte-pdfs'
    AND public.has_profile(ARRAY['admin','financeiro','operacional','comercial']::public.user_profile[]));

CREATE POLICY "dacte_pdfs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dacte-pdfs'
    AND public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "dacte_pdfs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dacte-pdfs' AND public.is_admin());

-- =====================================================
-- damdfe-pdfs (PDF DAMDFE)
-- =====================================================
CREATE POLICY "damdfe_pdfs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'damdfe-pdfs'
    AND public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

CREATE POLICY "damdfe_pdfs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'damdfe-pdfs'
    AND public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "damdfe_pdfs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'damdfe-pdfs' AND public.is_admin());
