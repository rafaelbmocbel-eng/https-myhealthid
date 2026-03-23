
-- Tabela principal de eventos
CREATE TABLE public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data_evento date NOT NULL,
  horario_inicio time NOT NULL DEFAULT '09:00',
  horario_fim time NOT NULL DEFAULT '12:00',
  local text,
  vagas_max integer,
  valor numeric DEFAULT 0,
  cobrar_pagamento boolean NOT NULL DEFAULT false,
  pix_chave text,
  pix_tipo text DEFAULT 'cpf',
  pix_nome text,
  link_pagamento text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Perguntas customizáveis do evento
CREATE TABLE public.evento_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  tipo text NOT NULL DEFAULT 'text', -- text, multiple_choice, scale, boolean
  pergunta text NOT NULL,
  opcoes jsonb DEFAULT '[]'::jsonb, -- para múltipla escolha
  obrigatoria boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inscrições no evento
CREATE TABLE public.evento_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id),
  nome text NOT NULL,
  email text,
  telefone text,
  status text NOT NULL DEFAULT 'inscrito', -- inscrito, confirmado, cancelado
  pago boolean NOT NULL DEFAULT false,
  ja_era_paciente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Respostas do questionário
CREATE TABLE public.evento_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id uuid NOT NULL REFERENCES public.evento_inscricoes(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.evento_perguntas(id) ON DELETE CASCADE,
  resposta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_respostas ENABLE ROW LEVEL SECURITY;

-- Eventos: terapeuta gerencia
CREATE POLICY "Terapeutas gerenciam eventos" ON public.eventos FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- Perguntas: terapeuta gerencia via evento
CREATE POLICY "Terapeutas gerenciam perguntas" ON public.evento_perguntas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.terapeuta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.terapeuta_id = auth.uid()));

-- Perguntas: leitura pública para quem vai responder
CREATE POLICY "Público lê perguntas de eventos ativos" ON public.evento_perguntas FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.ativo = true));

-- Inscrições: terapeuta lê
CREATE POLICY "Terapeutas gerenciam inscricoes" ON public.evento_inscricoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.terapeuta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.terapeuta_id = auth.uid()));

-- Inscrições: público insere em eventos ativos
CREATE POLICY "Público inscreve em eventos ativos" ON public.evento_inscricoes FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.ativo = true));

-- Respostas: terapeuta lê
CREATE POLICY "Terapeutas leem respostas" ON public.evento_respostas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evento_inscricoes ei
    JOIN public.eventos e ON e.id = ei.evento_id
    WHERE ei.id = inscricao_id AND e.terapeuta_id = auth.uid()
  ));

-- Respostas: público insere
CREATE POLICY "Público insere respostas" ON public.evento_respostas FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evento_inscricoes ei
    JOIN public.eventos e ON e.id = ei.evento_id
    WHERE ei.id = inscricao_id AND e.ativo = true
  ));

-- Triggers updated_at
CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_evento_inscricoes_updated_at BEFORE UPDATE ON public.evento_inscricoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
