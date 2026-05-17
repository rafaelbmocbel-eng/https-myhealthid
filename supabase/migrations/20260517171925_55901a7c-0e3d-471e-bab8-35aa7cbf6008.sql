
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS no_show_processado_em timestamptz;

ALTER TABLE public.whatsapp_automacoes
  ADD COLUMN IF NOT EXISTS mensagem_no_show text DEFAULT 'Oi {nome}, notamos que você não compareceu nem avisou sobre a sessão de hoje às {horario}. Conforme combinado, sessões não canceladas com 2h de antecedência são contabilizadas. Se houve algum imprevisto, fale com a gente. 💙';

UPDATE public.whatsapp_automacoes
SET gatilhos_ativos = COALESCE(gatilhos_ativos, '{}'::jsonb) || jsonb_build_object('no_show_automatico', true)
WHERE (gatilhos_ativos->>'no_show_automatico') IS NULL;

-- Atualiza apenas mensagens que ainda estão no default antigo (sem política)
UPDATE public.whatsapp_automacoes
SET mensagem_confirmacao = 'Olá {nome}! Confirmando sua sessão amanhã ({data}) às {horario}. Responda SIM para confirmar, ou diga se prefere reagendar. ⚠️ Cancelamentos devem ser feitos com no mínimo 2h de antecedência — caso contrário a sessão será contabilizada.'
WHERE mensagem_confirmacao IS NULL
   OR mensagem_confirmacao NOT ILIKE '%2h%';

UPDATE public.whatsapp_automacoes
SET mensagem_lembrete_2h = 'Oi {nome}! Lembrete: sua sessão é hoje às {horario}. Te espero! 💙 ⚠️ Esta é sua última janela: se precisar cancelar/reagendar, faça agora — após este horário a sessão será contabilizada.'
WHERE mensagem_lembrete_2h IS NULL
   OR mensagem_lembrete_2h NOT ILIKE '%contabilizada%';
