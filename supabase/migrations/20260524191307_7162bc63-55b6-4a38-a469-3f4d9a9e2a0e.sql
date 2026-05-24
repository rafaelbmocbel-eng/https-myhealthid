
CREATE TABLE public.whatsapp_contatos_bloqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  telefone text NOT NULL,
  nome text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terapeuta_id, telefone)
);

CREATE INDEX idx_wa_bloqueados_terapeuta ON public.whatsapp_contatos_bloqueados (terapeuta_id);
CREATE INDEX idx_wa_bloqueados_tel ON public.whatsapp_contatos_bloqueados (terapeuta_id, telefone);

ALTER TABLE public.whatsapp_contatos_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono vê seus contatos bloqueados"
ON public.whatsapp_contatos_bloqueados FOR SELECT
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Dono cria contatos bloqueados"
ON public.whatsapp_contatos_bloqueados FOR INSERT
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Dono edita contatos bloqueados"
ON public.whatsapp_contatos_bloqueados FOR UPDATE
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Dono remove contatos bloqueados"
ON public.whatsapp_contatos_bloqueados FOR DELETE
USING (auth.uid() = terapeuta_id);

CREATE TRIGGER update_wa_bloqueados_updated_at
BEFORE UPDATE ON public.whatsapp_contatos_bloqueados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
