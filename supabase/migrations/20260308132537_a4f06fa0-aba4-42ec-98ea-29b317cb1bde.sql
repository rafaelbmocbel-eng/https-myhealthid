
-- Configuração do funil/chatbot do terapeuta
CREATE TABLE public.funil_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  slug TEXT UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  -- Boas-vindas
  mensagem_boas_vindas TEXT NOT NULL DEFAULT 'Olá! 👋 Seja bem-vindo(a)! Como posso te ajudar hoje?',
  
  -- Diferenciais (array de textos)
  diferenciais JSONB NOT NULL DEFAULT '["Atendimento personalizado", "Método exclusivo baseado em evidências", "Acompanhamento contínuo"]'::jsonb,
  
  -- Serviços e valores
  servicos JSONB NOT NULL DEFAULT '[{"nome": "Avaliação Inicial", "descricao": "Avaliação completa com relatório", "valor": 250, "parcelas_max": 3}, {"nome": "Sessão de Retorno", "descricao": "Acompanhamento e evolução", "valor": 150, "parcelas_max": 1}]'::jsonb,
  
  -- Pagamento
  pix_chave TEXT,
  pix_tipo TEXT DEFAULT 'cpf',
  pix_nome TEXT,
  link_cartao TEXT,
  
  -- Mensagens customizáveis
  mensagem_diferenciais TEXT DEFAULT 'Conheça nossos diferenciais:',
  mensagem_servicos TEXT DEFAULT 'Confira nossos serviços disponíveis:',
  mensagem_agendamento TEXT DEFAULT 'Ótima escolha! Vamos agendar sua sessão? 📅',
  mensagem_pagamento TEXT DEFAULT 'Para confirmar, escolha a forma de pagamento:',
  mensagem_confirmacao TEXT DEFAULT 'Tudo certo! ✅ Seu agendamento foi confirmado. Enviaremos um lembrete antes da sessão.',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Leads capturados pelo funil
CREATE TABLE public.funil_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  funil_config_id UUID REFERENCES public.funil_config(id) ON DELETE CASCADE,
  
  -- Dados do lead
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  
  -- Progresso no funil
  etapa_atual TEXT NOT NULL DEFAULT 'boas_vindas',
  servico_escolhido TEXT,
  valor_servico NUMERIC,
  forma_pagamento TEXT,
  agendamento_id UUID REFERENCES public.agendamentos(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'em_andamento',
  dados_conversa JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.funil_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funil_leads ENABLE ROW LEVEL SECURITY;

-- Terapeuta gerencia seu funil config
CREATE POLICY "Terapeutas gerenciam seu funil" ON public.funil_config FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- Público lê config ativa por slug
CREATE POLICY "Público lê funil ativo" ON public.funil_config FOR SELECT TO anon
  USING (ativo = true AND slug IS NOT NULL);

-- Terapeuta gerencia leads
CREATE POLICY "Terapeutas gerenciam leads" ON public.funil_leads FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- Público insere leads (via funil)
CREATE POLICY "Público insere leads" ON public.funil_leads FOR INSERT TO anon
  WITH CHECK (true);

-- Público atualiza seus leads (via funil)
CREATE POLICY "Público atualiza leads em andamento" ON public.funil_leads FOR UPDATE TO anon
  USING (status = 'em_andamento');

-- Indexes
CREATE INDEX idx_funil_config_slug ON public.funil_config(slug);
CREATE INDEX idx_funil_config_terapeuta ON public.funil_config(terapeuta_id);
CREATE INDEX idx_funil_leads_terapeuta ON public.funil_leads(terapeuta_id, created_at DESC);
CREATE INDEX idx_funil_leads_status ON public.funil_leads(status);
