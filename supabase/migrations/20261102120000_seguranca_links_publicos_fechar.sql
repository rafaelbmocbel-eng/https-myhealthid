-- Segurança (A): links de avaliação/agenda e respostas deixam de ser legíveis/alteráveis por quem não está logado.
--
-- Antes: qualquer visitante, só com a chave pública do site, listava os links ativos (com os tokens), lia as respostas dos
-- pacientes (links_avaliacao / respostas_avaliacao_paciente) e podia reescrever links de agenda ativos. Outro terapeuta
-- logado também lia o que era de outros. As páginas públicas NÃO dependem dessas políticas: a avaliação usa as Edge
-- Functions validar-token-avaliacao e salvar-bloco-avaliacao (service role) e a agenda usa RPCs SECURITY DEFINER por token.
--
-- Única dependência real: a política de INSERT público de agendamentos perguntava "existe link ativo?" com uma subconsulta
-- em links_agenda_paciente, que rodava sob o RLS do visitante (por isso a leitura pública precisava existir). Passa a usar
-- uma função SECURITY DEFINER com a MESMA regra, e só depois as políticas públicas são removidas.

-- 1) Mesma regra da política antiga, agora fora do RLS do visitante
create or replace function public.link_agenda_ativo_para(p_terapeuta uuid, p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.links_agenda_paciente lap
    where lap.terapeuta_id = p_terapeuta
      and lap.paciente_id = p_paciente
      and lap.status::text = 'ativo'
      and lap.data_expiracao > now()
  );
$$;
revoke all on function public.link_agenda_ativo_para(uuid, uuid) from public;
grant execute on function public.link_agenda_ativo_para(uuid, uuid) to anon, authenticated, service_role;

-- 2) A política de agendamento público passa a usar a função (regra idêntica)
drop policy if exists pub_agendamentos_insert_via_token on public.agendamentos;
create policy pub_agendamentos_insert_via_token on public.agendamentos
  for insert to public
  with check (public.link_agenda_ativo_para(terapeuta_id, paciente_id) and status = 'pendente');

-- 3) Remove as políticas públicas que expunham links, tokens e respostas
drop policy if exists "Leitura pública via link válido" on public.respostas_avaliacao_paciente;
drop policy if exists "Inserção pública via link válido" on public.respostas_avaliacao_paciente;
drop policy if exists pub_links_avaliacao_read on public.links_avaliacao;
drop policy if exists pub_links_agenda_read on public.links_agenda_paciente;
drop policy if exists pub_links_agenda_update_access on public.links_agenda_paciente;
