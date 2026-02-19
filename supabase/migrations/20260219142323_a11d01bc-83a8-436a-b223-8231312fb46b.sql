-- Permitir acesso público anônimo a links_avaliacao ativos para que pacientes possam abrir o questionário
CREATE POLICY "Links de avaliação ativos acessíveis publicamente"
  ON public.links_avaliacao
  FOR SELECT
  USING (
    (status)::text = 'ativo'
    AND data_expiracao > now()
  );
