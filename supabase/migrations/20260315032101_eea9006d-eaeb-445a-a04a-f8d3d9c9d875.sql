-- Bucket para imagens de exercícios
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

-- Qualquer um pode ler imagens de exercícios (público)
CREATE POLICY "Public read exercise images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-images');

-- Terapeutas podem fazer upload
CREATE POLICY "Terapeutas upload exercise images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-images');

-- Terapeutas podem deletar
CREATE POLICY "Terapeutas delete exercise images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exercise-images');

-- Terapeutas podem atualizar
CREATE POLICY "Terapeutas update exercise images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exercise-images');