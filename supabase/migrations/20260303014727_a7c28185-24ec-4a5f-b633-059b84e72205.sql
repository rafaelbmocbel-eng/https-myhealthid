
-- Create the update_updated_at function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Controle de Atendimentos / Sessões do paciente
CREATE TABLE public.controle_sessoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    terapeuta_id UUID NOT NULL,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    data_sessao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    numero_sessao INTEGER NOT NULL DEFAULT 1,
    tipo_atendimento TEXT DEFAULT 'retorno',
    status TEXT NOT NULL DEFAULT 'realizada',
    duracao_minutos INTEGER DEFAULT 45,
    observacoes TEXT,
    valor_cobrado NUMERIC(10,2),
    forma_pagamento TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.controle_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem suas sessões" ON public.controle_sessoes
    FOR SELECT TO authenticated USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas criam sessões" ON public.controle_sessoes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas atualizam suas sessões" ON public.controle_sessoes
    FOR UPDATE TO authenticated USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam suas sessões" ON public.controle_sessoes
    FOR DELETE TO authenticated USING (auth.uid() = terapeuta_id);

CREATE INDEX idx_controle_sessoes_paciente ON public.controle_sessoes(paciente_id);
CREATE INDEX idx_controle_sessoes_terapeuta ON public.controle_sessoes(terapeuta_id);

CREATE TRIGGER update_controle_sessoes_updated_at
    BEFORE UPDATE ON public.controle_sessoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
