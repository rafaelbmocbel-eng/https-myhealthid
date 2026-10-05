-- Aparelhos de eletrotermofototerapia do profissional (laser, ultrassom, ondas
-- de choque). Cada linha é UM emissor/ponteira/transdutor, com as especificações
-- reais usadas na calculadora de dosagem (potência, área do feixe, ERA etc.).
-- Já aplicada no projeto com esta versão; o arquivo existe para manter o histórico.
CREATE TABLE IF NOT EXISTS public.equipamentos_fisio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL CHECK (tipo IN ('laser', 'ultrassom', 'ondas_choque')),
  nome text NOT NULL,
  fabricante text,
  modelo text,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_calibracao date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS equipamentos_fisio_terapeuta_idx ON public.equipamentos_fisio (terapeuta_id, tipo);
ALTER TABLE public.equipamentos_fisio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terapeuta gerencia seus equipamentos" ON public.equipamentos_fisio
  FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);
CREATE TRIGGER equipamentos_fisio_updated_at
  BEFORE UPDATE ON public.equipamentos_fisio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
