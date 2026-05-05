-- =============================================================================
-- Bucket privado para comprovantes ANTT (certidoes de regularidade RNTRC)
-- =============================================================================
-- Quando consultaRntrc retornar comprovante_url, a edge function baixa o
-- PDF e salva aqui. Garante prova auditavel mesmo se o link do portal expirar.
-- Path: {order_id}/{rntrc}-{epoch_ms}.pdf
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'antt-comprovantes',
  'antt-comprovantes',
  false,
  5242880,
  ARRAY['application/pdf', 'text/html', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "antt_comprovantes_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'antt-comprovantes'
    AND public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "antt_comprovantes_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'antt-comprovantes'
    AND public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "antt_comprovantes_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'antt-comprovantes'
    AND public.is_admin()
  );
