-- LENTES das demais profissões: cada uma ganha uma DIRETRIZ DE TRATAMENTO
-- (baseada na avaliação presencial), como a do fisioterapeuta. Habilita o
-- bloco 'diretriz_tratamento' para médico, psicólogo, terapeuta ocupacional e
-- cadastra o novo perfil DENTISTA.

-- 1) Catálogo do DENTISTA.
INSERT INTO public.perfis_profissionais (id, nome_exibicao, descricao, blocos_ativos, prompt_sistema, template_evolucao)
VALUES
('dentista','Dentista','Anamnese odontológica, exame intraoral, plano de tratamento por fases.',
 '["voz","diretriz_tratamento"]'::jsonb,
 'Você é assistente clínico para um(a) DENTISTA (Cirurgião-Dentista). Estruture a avaliação como consulta odontológica: queixa principal, história odontológica, hábitos (higiene, bruxismo, tabagismo), exame extra e intraoral, condição periodontal, cárie/lesões, oclusão/ATM, hipóteses e plano de tratamento por fases (urgência/adequação do meio bucal → reabilitação → manutenção/preventivo). Cite diretrizes quando aplicável. NÃO prescreva medicação sistêmica fora do escopo odontológico e sinalize encaminhamentos médicos quando necessário.',
 'Evolução Odontológica')
ON CONFLICT (id) DO UPDATE
  SET nome_exibicao = EXCLUDED.nome_exibicao,
      descricao = EXCLUDED.descricao,
      blocos_ativos = EXCLUDED.blocos_ativos,
      prompt_sistema = EXCLUDED.prompt_sistema,
      template_evolucao = EXCLUDED.template_evolucao,
      updated_at = now();

-- 2) Habilita a Diretriz de Tratamento nas lentes que ainda não têm bloco de
--    diretriz próprio (fisio usa protocolo/voz; educador e nutri já têm cards).
UPDATE public.perfis_profissionais
SET blocos_ativos = blocos_ativos || '["diretriz_tratamento"]'::jsonb, updated_at = now()
WHERE id IN ('medico','psicologo','terapeuta_ocupacional')
  AND NOT (blocos_ativos ? 'diretriz_tratamento');

-- 3) Chancela por profissão nas diretrizes: mapeia as novas áreas para o
--    perfil habilitado (substitui a função do gate).
CREATE OR REPLACE FUNCTION public.chk_chancela_diretrizes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_perfil public.perfil_profissional; v_libera boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_libera := NEW.enviada_portal IS TRUE;
  ELSE
    v_libera := NEW.enviada_portal IS TRUE AND OLD.enviada_portal IS DISTINCT FROM TRUE;
  END IF;
  IF v_libera THEN
    v_perfil := (CASE NEW.area
      WHEN 'nutricao' THEN 'nutricionista'
      WHEN 'educacao_fisica' THEN 'educador_fisico'
      WHEN 'medicina' THEN 'medico'
      WHEN 'psicologia' THEN 'psicologo'
      WHEN 'terapia_ocupacional' THEN 'terapeuta_ocupacional'
      WHEN 'odontologia' THEN 'dentista'
      ELSE 'fisioterapeuta'
    END)::public.perfil_profissional;
    IF NOT public.pode_chancelar(v_perfil) THEN
      RAISE EXCEPTION 'chancela_negada: apenas % (ou clínica com um ativo) pode enviar esta diretriz ao portal', v_perfil;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
