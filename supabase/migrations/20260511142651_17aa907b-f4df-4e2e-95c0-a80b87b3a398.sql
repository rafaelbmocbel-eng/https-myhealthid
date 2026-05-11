-- Bucket temporário para áudios de avaliação por voz
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-temp', 'audio-temp', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: usuários autenticados podem fazer upload de seus próprios áudios
CREATE POLICY "Users can upload their own audio temp files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'audio-temp' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: usuários autenticados podem ler seus próprios áudios
CREATE POLICY "Users can read their own audio temp files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'audio-temp'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: usuários autenticados podem deletar seus próprios áudios
CREATE POLICY "Users can delete their own audio temp files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'audio-temp'
  AND auth.uid()::text = (storage.foldername(name))[1]
);