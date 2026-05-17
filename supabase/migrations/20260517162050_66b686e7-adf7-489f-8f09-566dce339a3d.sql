
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "WA media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "WA media owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "WA media owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);
