
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  atalho TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  categoria TEXT DEFAULT 'geral',
  uso_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (terapeuta_id, atalho)
);
CREATE INDEX idx_wa_templates_terapeuta ON public.whatsapp_templates (terapeuta_id);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta vê seus templates" ON public.whatsapp_templates FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeuta cria templates" ON public.whatsapp_templates FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeuta atualiza templates" ON public.whatsapp_templates FOR UPDATE USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeuta apaga templates" ON public.whatsapp_templates FOR DELETE USING (auth.uid() = terapeuta_id);

CREATE TRIGGER trg_wa_templates_updated BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_notas_conversa ON public.whatsapp_notas (conversa_id, created_at DESC);
ALTER TABLE public.whatsapp_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta vê suas notas" ON public.whatsapp_notas FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeuta cria notas" ON public.whatsapp_notas FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeuta apaga notas" ON public.whatsapp_notas FOR DELETE USING (auth.uid() = terapeuta_id);

-- Seed templates padrão para terapeutas existentes
INSERT INTO public.whatsapp_templates (terapeuta_id, atalho, titulo, conteudo, categoria)
SELECT user_id, '/oi', 'Saudação', 'Olá! 👋 Como posso te ajudar hoje?', 'saudacao' FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.whatsapp_templates (terapeuta_id, atalho, titulo, conteudo, categoria)
SELECT user_id, '/agenda', 'Enviar agenda', 'Você pode escolher seu horário pelo link da agenda. Posso te enviar agora?', 'agendamento' FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.whatsapp_templates (terapeuta_id, atalho, titulo, conteudo, categoria)
SELECT user_id, '/valores', 'Valores', 'Posso te enviar uma proposta personalizada com os pacotes disponíveis. Qual seu objetivo principal?', 'comercial' FROM public.profiles
ON CONFLICT DO NOTHING;
