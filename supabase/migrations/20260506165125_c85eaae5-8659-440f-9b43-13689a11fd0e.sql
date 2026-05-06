
-- Tabela de configurações da clínica (dados fiscais, contato e credenciais Z-API por terapeuta)
CREATE TABLE IF NOT EXISTS public.config_clinica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL UNIQUE,
  -- Identidade fiscal
  razao_social TEXT,
  cnpj TEXT,
  responsavel TEXT,
  -- Contato e localização
  telefone TEXT,
  email_clinica TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  -- Credenciais Z-API por terapeuta (WhatsApp próprio)
  zapi_instance_id TEXT,
  zapi_token TEXT,
  zapi_client_token TEXT,
  zapi_ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.config_clinica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia sua config_clinica"
ON public.config_clinica
FOR ALL
TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);

CREATE TRIGGER set_config_clinica_updated_at
BEFORE UPDATE ON public.config_clinica
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
