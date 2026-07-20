-- O card "Exames presenciais" (bioimpedância, teste de pisada, dinamometria,
-- baropodometria) aparecia só para quem tinha os blocos 'antropometria'
-- (nutricionista) ou 'testes_funcionais' (educador). O FISIOTERAPEUTA — que faz
-- justamente dinamometria/baropodometria — ficava de fora. Liberamos um bloco
-- próprio 'exames_presenciais' para fisio, educador, nutricionista e médico.

update public.perfis_profissionais
set blocos_ativos = blocos_ativos || '["exames_presenciais"]'::jsonb
where id in ('fisioterapeuta', 'educador_fisico', 'nutricionista', 'medico')
  and not (blocos_ativos ? 'exames_presenciais');
