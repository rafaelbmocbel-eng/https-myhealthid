
-- ============ FIX 1: config_agenda (Crítico) ============
DROP POLICY IF EXISTS "pub_config_agenda_read" ON public.config_agenda;
DROP POLICY IF EXISTS "pub_config_agenda_via_funil" ON public.config_agenda;

CREATE OR REPLACE FUNCTION public.get_config_agenda_by_funil_slug(p_slug text)
RETURNS TABLE(horario_inicio time, horario_fim time, duracao_padrao integer, dias_semana jsonb, intervalo_entre_sessoes integer, vagas_por_horario integer, terapeuta_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ca.horario_inicio, ca.horario_fim, ca.duracao_padrao, ca.dias_semana,
         ca.intervalo_entre_sessoes, ca.vagas_por_horario, ca.terapeuta_id
  FROM public.config_agenda ca
  JOIN public.funil_config fc ON fc.terapeuta_id = ca.terapeuta_id
  WHERE fc.slug = p_slug AND fc.ativo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_config_agenda_by_token(p_token text)
RETURNS TABLE(horario_inicio time, horario_fim time, duracao_padrao integer, dias_semana jsonb, intervalo_entre_sessoes integer, vagas_por_horario integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ca.horario_inicio, ca.horario_fim, ca.duracao_padrao, ca.dias_semana,
         ca.intervalo_entre_sessoes, ca.vagas_por_horario
  FROM public.config_agenda ca
  JOIN public.links_agenda_paciente lap ON lap.terapeuta_id = ca.terapeuta_id
  WHERE lap.token = p_token AND lap.status = 'ativo' AND lap.data_expiracao > now()
  LIMIT 1;
$$;

-- ============ FIX 2: evento_inscricoes anti-spam (Crítico) ============
CREATE UNIQUE INDEX IF NOT EXISTS uniq_evento_inscricao_email
  ON public.evento_inscricoes (evento_id, lower(email))
  WHERE email IS NOT NULL AND status != 'cancelado';

CREATE OR REPLACE FUNCTION public.evento_inscricoes_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.evento_inscricoes
  WHERE evento_id = NEW.evento_id
    AND created_at > now() - interval '1 minute';
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Muitas inscrições em pouco tempo. Tente novamente em alguns minutos.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evento_inscricoes_rate_limit ON public.evento_inscricoes;
CREATE TRIGGER trg_evento_inscricoes_rate_limit
  BEFORE INSERT ON public.evento_inscricoes
  FOR EACH ROW EXECUTE FUNCTION public.evento_inscricoes_rate_limit();

-- ============ FIX 3: studio_medidas patient self-read (Aviso) ============
CREATE POLICY "Pacientes leem proprias medidas"
  ON public.studio_medidas FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = studio_medidas.paciente_id
      AND p.user_id = auth.uid()
  ));

-- ============ FIX 4: Lead token expiration (Aviso) ============
ALTER TABLE public.funil_leads
  ADD COLUMN IF NOT EXISTS token_expira_em timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

DROP POLICY IF EXISTS "Anon atualiza proprio lead com token" ON public.funil_leads;
CREATE POLICY "Anon atualiza proprio lead com token"
  ON public.funil_leads FOR UPDATE
  TO anon
  USING (
    status = 'em_andamento'
    AND token_expira_em > now()
    AND session_token::text = ((current_setting('request.headers', true))::json ->> 'x-lead-token')
  )
  WITH CHECK (
    session_token::text = ((current_setting('request.headers', true))::json ->> 'x-lead-token')
  );
