
-- Add avatar_url to pacientes
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create public bucket for patient avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('paciente-avatars', 'paciente-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Avatars pacientes públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'paciente-avatars');

-- Paciente faz upload na sua própria pasta (user_id)
CREATE POLICY "Paciente upload próprio avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'paciente-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Paciente atualiza próprio avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'paciente-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Paciente remove próprio avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'paciente-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Profissional pode subir avatar em pasta com id do paciente (pacientes.id) que lhe pertence
CREATE POLICY "Profissional upload avatar paciente"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'paciente-avatars'
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.terapeuta_id = auth.uid()
  )
);

CREATE POLICY "Profissional atualiza avatar paciente"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'paciente-avatars'
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.terapeuta_id = auth.uid()
  )
);
