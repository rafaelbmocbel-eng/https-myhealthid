-- A página pública do treino agora tem aba de Nutrição — a leitura por token
-- passa a devolver também o plano nutricional do mesmo paciente. Recria a
-- função com a coluna extra (mudança de assinatura exige DROP).
drop function if exists public.get_treino_por_token(uuid);

create or replace function public.get_treino_por_token(p_token uuid)
returns table (paciente_nome text, titulo text, conteudo jsonb, nutricao jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as paciente_nome,
    pic.titulo,
    pic.conteudo,
    (select n.conteudo from public.planos_ia_cliente n
       where n.paciente_id = pic.paciente_id and n.tipo = 'nutricao' limit 1) as nutricao
  from public.planos_ia_cliente pic
  join public.pacientes p on p.id = pic.paciente_id
  where pic.share_token = p_token and pic.tipo = 'treino'
  limit 1;
$$;

grant execute on function public.get_treino_por_token(uuid) to anon, authenticated;
