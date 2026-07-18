-- SEGURANÇA CRÍTICA: myid_avaliacoes tinha policies PÚBLICAS "USING (true)"
-- (SELECT) e "USING (status != 'concluido')" (UPDATE), sem cláusula TO — ou
-- seja, qualquer requisitante (inclusive anon) podia LER todas as avaliações
-- MyID (PHI) e ADULTERAR as não concluídas. O fluxo anônimo de responder por
-- token NÃO depende delas (usa RPCs SECURITY DEFINER get_myid_em_andamento /
-- salvar_fase_myid). Removemos e substituímos por acesso restrito ao dono.

drop policy if exists "Acesso público select via token" on public.myid_avaliacoes;
drop policy if exists "Acesso público insert/update via token" on public.myid_avaliacoes;

-- Paciente atualiza as SUAS avaliações (status em_andamento, rascunho).
drop policy if exists "paciente atualiza seu myid" on public.myid_avaliacoes;
create policy "paciente atualiza seu myid"
  on public.myid_avaliacoes for update to authenticated
  using (paciente_id in (select id from public.pacientes where user_id = auth.uid()))
  with check (paciente_id in (select id from public.pacientes where user_id = auth.uid()));

-- Terapeuta LÊ o MyID dos SEUS pacientes pelo VÍNCULO ATUAL do paciente — mesmo
-- que a avaliação tenha sido feita antes do vínculo (terapeuta_id nulo na linha).
-- Corrige o "profissional não vê o MyID do cliente vinculado".
drop policy if exists "terapeuta le myid dos seus pacientes" on public.myid_avaliacoes;
create policy "terapeuta le myid dos seus pacientes"
  on public.myid_avaliacoes for select to authenticated
  using (paciente_id in (select id from public.pacientes where terapeuta_id = auth.uid()));

-- (O SELECT do próprio paciente já existe: policy de 20260717030000_paciente_le_myid.sql.)
