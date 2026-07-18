-- Link público do treino do cliente: um token opaco que abre a página do treino
-- (com GIFs animando) sem login, para o cliente compartilhar com quem quiser.
-- O plano continua protegido por RLS; o acesso público é SÓ por token, via uma
-- função SECURITY DEFINER que devolve apenas o necessário (nada sensível).
alter table public.planos_ia_cliente
  add column if not exists share_token uuid unique;

-- Leitura pública do treino por token (anon). Retorna nome do paciente + o
-- conteúdo do plano (que já inclui o perfil "baseado em" para deixar claro que
-- é individual). Não expõe ids nem dados clínicos crus.
create or replace function public.get_treino_por_token(p_token uuid)
returns table (paciente_nome text, titulo text, conteudo jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as paciente_nome,
    pic.titulo,
    pic.conteudo
  from public.planos_ia_cliente pic
  join public.pacientes p on p.id = pic.paciente_id
  where pic.share_token = p_token and pic.tipo = 'treino'
  limit 1;
$$;

grant execute on function public.get_treino_por_token(uuid) to anon, authenticated;
