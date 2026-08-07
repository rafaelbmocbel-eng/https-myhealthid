-- CONECTA Controle CASSI <-> Pacientes: todo paciente que TEM guia CASSI passa a
-- estar marcado como CASSI e ativo. Assim ele aparece tanto no Painel/Planilha do
-- Controle quanto no filtro CASSI da aba Pacientes (mesma pessoa, as duas telas).
-- Idempotente: só toca quem estiver desconectado.
update public.pacientes p set
  plano_saude = 'CASSI',
  ativo = true,
  updated_at = now()
where exists (select 1 from public.guias_cassi g where g.paciente_id = p.id)
  and (
    p.plano_saude is null
    or lower(p.plano_saude) not like '%cassi%'
    or p.ativo is distinct from true
  );

notify pgrst, 'reload schema';
