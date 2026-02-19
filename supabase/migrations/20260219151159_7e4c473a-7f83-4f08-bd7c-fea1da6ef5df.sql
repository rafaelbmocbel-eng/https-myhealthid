-- Permite que usuários anônimos (via link de agenda) leiam datas e status dos agendamentos
-- para visualizar quais horários já estão ocupados. Não expõe dados do paciente.
CREATE POLICY "Agendamentos de terapeuta visíveis via link público"
  ON public.agendamentos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.links_agenda_paciente lap
      WHERE lap.terapeuta_id = agendamentos.terapeuta_id
        AND lap.status = 'ativo'
        AND lap.data_expiracao > now()
    )
  );