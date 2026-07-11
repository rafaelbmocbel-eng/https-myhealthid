-- Fase 2 da biblioteca: o exercício prescrito no treino carrega o GIF animado
-- escolhido da Biblioteca de Treinos, para o app do paciente exibir a animação.
ALTER TABLE public.studio_treino_exercicios
  ADD COLUMN IF NOT EXISTS gif_url text;
