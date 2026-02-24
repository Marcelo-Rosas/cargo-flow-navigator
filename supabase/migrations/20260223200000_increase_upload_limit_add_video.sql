-- Increase file size limit to 500MB and add video MIME types to documents bucket
UPDATE storage.buckets
SET
  file_size_limit = 524288000,  -- 500MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/xml', 'text/xml',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
  ]
WHERE id = 'documents';
