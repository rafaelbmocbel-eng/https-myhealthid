-- Create funil_config table
CREATE TABLE IF NOT EXISTS public.funil_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terapeuta_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    mensagem_boas_vindas TEXT DEFAULT 'Olá! Bem-vindo ao meu consultório online. Como posso te ajudar hoje?',
    mensagem_diferenciais TEXT DEFAULT 'Conheça nossos diferenciais:',
    mensagem_servicos TEXT DEFAULT 'Estes são os serviços que oferecemos:',
    mensagem_agendamento TEXT DEFAULT 'Ótima escolha! Para agendarmos, vou precisar de alguns dados rápidos.',
    mensagem_pagamento TEXT DEFAULT 'Como você prefere realizar o pagamento?',
    mensagem_confirmacao TEXT DEFAULT 'Tudo pronto! Recebemos seu interesse e entraremos em contato em breve para confirmar seu horário. ✅',
    diferenciais JSONB DEFAULT '[]'::jsonb,
    servicos JSONB DEFAULT '[]'::jsonb,
    pix_tipo TEXT DEFAULT 'cpf',
    pix_chave TEXT,
    pix_nome TEXT,
    link_cartao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create funil_leads table
CREATE TABLE IF NOT EXISTS public.funil_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terapeuta_id UUID NOT NULL, -- Referenced semi-manually in public contexts
    funil_config_id UUID REFERENCES public.funil_config(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    servico_escolhido TEXT,
    valor_servico DECIMAL(10,2),
    etapa_atual TEXT DEFAULT 'inicio',
    status TEXT DEFAULT 'novo',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.funil_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funil_leads ENABLE ROW LEVEL SECURITY;

-- Policies for funil_config
CREATE POLICY "Therapists can manage their own funnel config" 
ON public.funil_config FOR ALL 
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Public can view active funnel configs" 
ON public.funil_config FOR SELECT 
USING (ativo = true);

-- Policies for funil_leads
CREATE POLICY "Therapists can view their own leads" 
ON public.funil_leads FOR SELECT 
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Public can insert leads" 
ON public.funil_leads FOR INSERT 
WITH CHECK (true);

-- Functions to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_funil_config_updated_at
BEFORE UPDATE ON public.funil_config
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
