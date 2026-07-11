-- Biblioteca de Exercícios: catálogo reutilizável do profissional. Cadastra o
-- exercício UMA vez (nome, grupo, orientações, GIF animado, padrões) e reaproveita
-- ao montar treinos. GIF é imagem (leve) → hospedado no nosso storage.

CREATE TABLE IF NOT EXISTS public.exercicios_biblioteca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  grupo_muscular text,
  orientacoes text,
  gif_url text,
  equipamento text,
  series_padrao integer DEFAULT 3,
  repeticoes_padrao integer DEFAULT 12,
  descanso_padrao_segundos integer DEFAULT 45,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercicios_biblioteca_terapeuta
  ON public.exercicios_biblioteca (terapeuta_id);

ALTER TABLE public.exercicios_biblioteca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta ve sua biblioteca" ON public.exercicios_biblioteca;
CREATE POLICY "Terapeuta ve sua biblioteca" ON public.exercicios_biblioteca
  FOR SELECT USING (terapeuta_id = auth.uid());

DROP POLICY IF EXISTS "Terapeuta insere na sua biblioteca" ON public.exercicios_biblioteca;
CREATE POLICY "Terapeuta insere na sua biblioteca" ON public.exercicios_biblioteca
  FOR INSERT WITH CHECK (terapeuta_id = auth.uid());

DROP POLICY IF EXISTS "Terapeuta edita sua biblioteca" ON public.exercicios_biblioteca;
CREATE POLICY "Terapeuta edita sua biblioteca" ON public.exercicios_biblioteca
  FOR UPDATE USING (terapeuta_id = auth.uid());

DROP POLICY IF EXISTS "Terapeuta deleta sua biblioteca" ON public.exercicios_biblioteca;
CREATE POLICY "Terapeuta deleta sua biblioteca" ON public.exercicios_biblioteca
  FOR DELETE USING (terapeuta_id = auth.uid());

-- Bucket público dos GIFs (leitura pública p/ o app do paciente exibir; upload
-- só autenticado).
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-gifs', 'exercise-gifs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read exercise gifs" ON storage.objects;
CREATE POLICY "Public read exercise gifs" ON storage.objects
  FOR SELECT USING (bucket_id = 'exercise-gifs');

DROP POLICY IF EXISTS "Auth upload exercise gifs" ON storage.objects;
CREATE POLICY "Auth upload exercise gifs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exercise-gifs');

DROP POLICY IF EXISTS "Auth update exercise gifs" ON storage.objects;
CREATE POLICY "Auth update exercise gifs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'exercise-gifs');

DROP POLICY IF EXISTS "Auth delete exercise gifs" ON storage.objects;
CREATE POLICY "Auth delete exercise gifs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'exercise-gifs');
