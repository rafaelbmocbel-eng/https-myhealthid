-- Evolução visível (onda 2): o paciente pode LER os próprios dados físicos
-- (antropometria, testes funcionais e sinais vitais) para ver os gráficos de
-- evolução no portal. Somente SELECT — escrita continua exclusiva do terapeuta.
-- (body_composition já tinha política própria do paciente.)
DROP POLICY IF EXISTS "Paciente le propria antropometria" ON public.antropometria;
CREATE POLICY "Paciente le propria antropometria" ON public.antropometria
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Paciente le proprios testes" ON public.testes_funcionais_paciente;
CREATE POLICY "Paciente le proprios testes" ON public.testes_funcionais_paciente
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Paciente le proprios sinais vitais" ON public.sinais_vitais;
CREATE POLICY "Paciente le proprios sinais vitais" ON public.sinais_vitais
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));
