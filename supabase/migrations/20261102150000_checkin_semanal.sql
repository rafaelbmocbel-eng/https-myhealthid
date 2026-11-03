-- Check-in semanal de bem-estar (autorrelato do cliente): 5 itens de 1 a 5 (quanto MAIOR, melhor: fadiga, sono, dor muscular,
-- estresse, humor), cor da urina (1 a 8) e recuperação do treino (0 a 10, opcional). O cliente responde pelo portal ou pelo
-- WhatsApp; cada resposta é uma linha por semana (segunda a domingo, horário de Brasília), então dá para ver a evolução.
--
-- Escrita SÓ por função: ninguém grava direto nas tabelas, e o profissional nunca vem do cliente (sai de pacientes). A nota
-- viva e os alertas vão para o prontuário (notas_prontuario) e para as notificações do profissional.
-- A nota oficial do MyID NÃO muda com o check-in: ele mostra a tendência entre uma avaliação completa e a seguinte.

-- ───────────── Tabelas ─────────────

create table if not exists public.checkins_semanais (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  semana date not null check (extract(isodow from semana) = 1),
  origem text not null default 'portal' check (origem in ('portal', 'whatsapp')),
  fadiga smallint not null check (fadiga between 1 and 5),
  sono smallint not null check (sono between 1 and 5),
  dor_muscular smallint not null check (dor_muscular between 1 and 5),
  estresse smallint not null check (estresse between 1 and 5),
  humor smallint not null check (humor between 1 and 5),
  urina smallint check (urina between 1 and 8),
  psr smallint check (psr between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paciente_id, semana)
);

-- Pedido enviado pelo WhatsApp: guarda a semana a que a resposta pertence e até quando ela vale.
create table if not exists public.checkin_pedidos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  semana date not null check (extract(isodow from semana) = 1),
  canal text not null default 'whatsapp',
  enviado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '48 hours'),
  respondido_em timestamptz,
  unique (paciente_id, semana)
);

create table if not exists public.checkin_preferencias (
  paciente_id uuid primary key references public.pacientes(id) on delete cascade,
  whatsapp_ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- Uma única nota viva por cliente no prontuário.
create unique index if not exists uniq_nota_checkin_semanal
  on public.notas_prontuario (paciente_id) where tipo = 'checkin_semanal';

-- ───────────── RLS: só leitura para quem é dono; escrita só pelas funções ─────────────

alter table public.checkins_semanais enable row level security;
alter table public.checkin_pedidos enable row level security;
alter table public.checkin_preferencias enable row level security;

drop policy if exists "Paciente le os proprios check-ins" on public.checkins_semanais;
create policy "Paciente le os proprios check-ins" on public.checkins_semanais
  for select to authenticated
  using (exists (select 1 from public.pacientes p where p.id = checkins_semanais.paciente_id and p.user_id = auth.uid()));

drop policy if exists "Terapeuta le os check-ins dos seus pacientes" on public.checkins_semanais;
create policy "Terapeuta le os check-ins dos seus pacientes" on public.checkins_semanais
  for select to authenticated
  using (exists (select 1 from public.pacientes p where p.id = checkins_semanais.paciente_id and p.terapeuta_id = auth.uid()));

drop policy if exists "Paciente le a propria preferencia de check-in" on public.checkin_preferencias;
create policy "Paciente le a propria preferencia de check-in" on public.checkin_preferencias
  for select to authenticated
  using (exists (select 1 from public.pacientes p where p.id = checkin_preferencias.paciente_id and p.user_id = auth.uid()));

drop policy if exists "Terapeuta le a preferencia de check-in dos seus pacientes" on public.checkin_preferencias;
create policy "Terapeuta le a preferencia de check-in dos seus pacientes" on public.checkin_preferencias
  for select to authenticated
  using (exists (select 1 from public.pacientes p where p.id = checkin_preferencias.paciente_id and p.terapeuta_id = auth.uid()));

revoke all on public.checkins_semanais from anon, authenticated;
revoke all on public.checkin_pedidos from anon, authenticated;
revoke all on public.checkin_preferencias from anon, authenticated;
grant select on public.checkins_semanais to authenticated;
grant select on public.checkin_preferencias to authenticated;

-- ───────────── Prontuário: as notas do check-in só nascem pelas funções do servidor ─────────────
-- Políticas RESTRITIVAS (somam-se às que já existem, qualquer que seja o nome delas): nenhum usuário logado cria nem edita nota
-- com tipo 'checkin_%' (a política de INSERT existente só exige auth.uid() = terapeuta_id, então qualquer pessoa conseguiria
-- plantar uma nota de alerta falsa), e só o profissional dono lê a nota de alerta: o cliente vê a própria evolução, não o alerta.
drop policy if exists "checkin_notas_so_servidor_insere" on public.notas_prontuario;
create policy "checkin_notas_so_servidor_insere" on public.notas_prontuario
  as restrictive for insert to authenticated with check (tipo not like 'checkin\_%');

drop policy if exists "checkin_notas_so_servidor_edita" on public.notas_prontuario;
create policy "checkin_notas_so_servidor_edita" on public.notas_prontuario
  as restrictive for update to authenticated using (tipo not like 'checkin\_%') with check (tipo not like 'checkin\_%');

drop policy if exists "checkin_alerta_so_o_profissional_le" on public.notas_prontuario;
create policy "checkin_alerta_so_o_profissional_le" on public.notas_prontuario
  as restrictive for select to authenticated using (tipo <> 'checkin_alerta' or terapeuta_id = auth.uid());

-- ───────────── Funções ─────────────

create or replace function public.checkin_semana_atual()
returns date
language sql
stable
set search_path = public
as $$ select date_trunc('week', now() at time zone 'America/Sao_Paulo')::date $$;

-- Itens em alerta: as duas últimas respostas (de semanas seguidas) estão, as duas, pelo menos 1 ponto abaixo da média das
-- primeiras 4 respostas do próprio cliente. Exige 6 respostas. Mesma regra de calcularAlertas em
-- supabase/functions/_shared/checkin-semanal.ts (os dois lados usam os mesmos casos de teste).
create or replace function public.checkin_alertas(p_paciente uuid)
returns text[]
language sql
stable
set search_path = public
as $$
  with ord as (
    select c.*, row_number() over (order by c.semana) as rn, count(*) over () as n
    from public.checkins_semanais c
    where c.paciente_id = p_paciente
  ),
  base as (
    select avg(fadiga) f, avg(sono) s, avg(dor_muscular) d, avg(estresse) e, avg(humor) h
    from ord where rn <= 4
  ),
  ult as (select * from ord where rn = n),
  pen as (select * from ord where rn = n - 1)
  select coalesce((
    select array_remove(array[
      case when ult.fadiga <= base.f - 1 and pen.fadiga <= base.f - 1 then 'fadiga' end,
      case when ult.sono <= base.s - 1 and pen.sono <= base.s - 1 then 'sono' end,
      case when ult.dor_muscular <= base.d - 1 and pen.dor_muscular <= base.d - 1 then 'dor_muscular' end,
      case when ult.estresse <= base.e - 1 and pen.estresse <= base.e - 1 then 'estresse' end,
      case when ult.humor <= base.h - 1 and pen.humor <= base.h - 1 then 'humor' end
    ], null)
    from ult, pen, base
    where ult.n >= 6 and ult.semana - pen.semana = 7
  ), '{}'::text[])
$$;

-- Núcleo da gravação (uso interno: Edge Functions com a service role e a função do portal abaixo).
create or replace function public.checkin_gravar(
  p_paciente uuid,
  p_semana date,
  p_origem text,
  p_fadiga int,
  p_sono int,
  p_dor_muscular int,
  p_estresse int,
  p_humor int,
  p_urina int default null,
  p_psr int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terapeuta uuid;
  v_nome text;
  v_ult public.checkins_semanais%rowtype;
  v_ant public.checkins_semanais%rowtype;
  v_total int;
  v_alertas text[];
  v_ja text[];
  v_novos text[];
  v_indice int;
  v_texto_valores text;
  v_texto_variacao text;
  v_desc text;
  v_serie jsonb;
  v_nota_ok boolean := false;
  v_alerta_ok boolean := false;
begin
  select terapeuta_id, nome into v_terapeuta, v_nome from public.pacientes where id = p_paciente;
  if not found then raise exception 'paciente_nao_encontrado'; end if;
  if p_semana is null or extract(isodow from p_semana) <> 1 then raise exception 'semana_invalida'; end if;
  if p_origem is null or p_origem not in ('portal', 'whatsapp') then raise exception 'origem_invalida'; end if;
  if p_fadiga not between 1 and 5 or p_sono not between 1 and 5 or p_dor_muscular not between 1 and 5
     or p_estresse not between 1 and 5 or p_humor not between 1 and 5
     or (p_urina is not null and p_urina not between 1 and 8)
     or (p_psr is not null and p_psr not between 0 and 10) then
    raise exception 'checkin_valor_invalido';
  end if;

  insert into public.checkins_semanais (paciente_id, semana, origem, fadiga, sono, dor_muscular, estresse, humor, urina, psr)
  values (p_paciente, p_semana, p_origem, p_fadiga, p_sono, p_dor_muscular, p_estresse, p_humor, p_urina, p_psr)
  on conflict (paciente_id, semana) do update set
    origem = excluded.origem, fadiga = excluded.fadiga, sono = excluded.sono, dor_muscular = excluded.dor_muscular,
    estresse = excluded.estresse, humor = excluded.humor, urina = excluded.urina, psr = excluded.psr, updated_at = now();

  update public.checkin_pedidos set respondido_em = now()
  where paciente_id = p_paciente and semana = p_semana and respondido_em is null;

  select * into v_ult from public.checkins_semanais where paciente_id = p_paciente and semana = p_semana;
  select * into v_ant from public.checkins_semanais where paciente_id = p_paciente and semana < p_semana order by semana desc limit 1;
  select count(*) into v_total from public.checkins_semanais where paciente_id = p_paciente;
  v_alertas := public.checkin_alertas(p_paciente);
  v_indice := v_ult.fadiga + v_ult.sono + v_ult.dor_muscular + v_ult.estresse + v_ult.humor;

  -- Alerta que a correção da própria semana desfez: some a nota e a notificação ainda não lida (senão o dedupe de 21 dias
  -- esconderia um alerta verdadeiro depois).
  delete from public.notas_prontuario n
  where n.paciente_id = p_paciente and n.tipo = 'checkin_alerta' and n.terapeuta_id is not distinct from v_terapeuta
    and n.dados_extras ->> 'semana' = v_ult.semana::text
    and jsonb_typeof(n.dados_extras -> 'itens') = 'array'
    and not (n.dados_extras -> 'itens' ?| v_alertas);
  delete from public.notificacoes nt
  where nt.tipo = 'checkin_alerta' and not nt.lida and nt.terapeuta_id is not distinct from v_terapeuta
    and nt.metadata ->> 'paciente_id' = p_paciente::text and nt.metadata ->> 'semana' = v_ult.semana::text
    and jsonb_typeof(nt.metadata -> 'itens') = 'array'
    and not (nt.metadata -> 'itens' ?| v_alertas);

  if v_terapeuta is not null then
    -- A nota viva e o alerta ficam em blocos separados: falha de um não leva o outro nem a resposta do cliente.
    begin
      v_texto_valores := format('Fadiga %s · Sono %s · Dor muscular %s · Estresse %s · Humor %s', v_ult.fadiga, v_ult.sono, v_ult.dor_muscular, v_ult.estresse, v_ult.humor)
        || case when v_ult.urina is not null then format(' · Urina %s', v_ult.urina) else '' end
        || case when v_ult.psr is not null then format(' · Recuperação %s', v_ult.psr) else '' end
        || format(' · Índice de bem-estar %s/25', v_indice);
      if v_ant.id is not null then
        v_texto_variacao := format(
          E'\nVariação em relação à resposta anterior (semana de %s): fadiga %s, sono %s, dor muscular %s, estresse %s, humor %s.',
          to_char(v_ant.semana, 'DD/MM'),
          to_char(v_ult.fadiga - v_ant.fadiga, 'FMS9'), to_char(v_ult.sono - v_ant.sono, 'FMS9'),
          to_char(v_ult.dor_muscular - v_ant.dor_muscular, 'FMS9'), to_char(v_ult.estresse - v_ant.estresse, 'FMS9'),
          to_char(v_ult.humor - v_ant.humor, 'FMS9'));
      else
        v_texto_variacao := '';
      end if;
      v_desc := 'Autorrelato do cliente (registro automático, não é uma evolução escrita pelo profissional).'
        || format(E'\nÚltima resposta: semana de %s, pelo %s.', to_char(v_ult.semana, 'DD/MM'), case v_ult.origem when 'whatsapp' then 'WhatsApp' else 'portal' end)
        || E'\n' || v_texto_valores
        || v_texto_variacao
        || format(E'\nRespostas registradas: %s.', v_total);

      select coalesce(jsonb_agg(to_jsonb(s) order by s.semana), '[]'::jsonb) into v_serie
      from (
        select semana, fadiga, sono, dor_muscular, estresse, humor, urina, psr
        from public.checkins_semanais where paciente_id = p_paciente order by semana desc limit 12
      ) s;

      insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao, dados_extras)
      values (p_paciente, v_terapeuta, 'checkin_semanal', 'Check-in semanal (autorrelato do cliente)', v_desc,
        jsonb_build_object('origem', 'checkin_semanal', 'respostas', v_total, 'serie', v_serie, 'ultima_semana', v_ult.semana))
      on conflict (paciente_id) where tipo = 'checkin_semanal' do update set
        terapeuta_id = excluded.terapeuta_id, titulo = excluded.titulo, descricao = excluded.descricao,
        dados_extras = excluded.dados_extras, created_at = now();
      v_nota_ok := true;
    exception when others then
      raise warning 'checkin_gravar: nota viva não gravada (%): %', sqlstate, sqlerrm;
    end;

    begin
      -- Só conta o que a própria função gravou para o profissional DESTE cliente (outros usuários conseguem inserir notas
      -- com o mesmo tipo e formato livre; o dedupe não pode depender delas).
      select coalesce(array_agg(distinct i), '{}'::text[]) into v_ja
      from public.notas_prontuario n,
           jsonb_array_elements_text(case when jsonb_typeof(n.dados_extras -> 'itens') = 'array' then n.dados_extras -> 'itens' else '[]'::jsonb end) i
      where n.paciente_id = p_paciente and n.tipo = 'checkin_alerta' and n.terapeuta_id = v_terapeuta
        and n.created_at > now() - interval '21 days';
      v_novos := array(select a from unnest(v_alertas) a where a <> all (v_ja));

      if cardinality(v_novos) > 0 then
        insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao, dados_extras)
        values (p_paciente, v_terapeuta, 'checkin_alerta', 'Check-in semanal: atenção',
          format('Autorrelato do cliente (registro automático). Nas duas últimas semanas seguidas, ficaram 1 ponto ou mais abaixo da média das 4 primeiras respostas: %s.',
                 replace(array_to_string(v_novos, ', '), '_', ' ')),
          jsonb_build_object('origem', 'checkin_semanal', 'itens', to_jsonb(v_novos), 'semana', v_ult.semana));
        insert into public.notificacoes (terapeuta_id, tipo, titulo, descricao, rota, metadata)
        values (v_terapeuta, 'checkin_alerta', format('Check-in: atenção com %s', coalesce(v_nome, 'cliente')),
          format('Queda em %s por 2 semanas seguidas, em relação à própria média do cliente.', replace(array_to_string(v_novos, ', '), '_', ' ')),
          '/pacientes/' || p_paciente::text,
          jsonb_build_object('paciente_id', p_paciente, 'itens', to_jsonb(v_novos), 'semana', v_ult.semana));
      end if;
      v_alerta_ok := true;
    exception when others then
      raise warning 'checkin_gravar: alerta/notificação não gravados (%): %', sqlstate, sqlerrm;
    end;
  end if;

  return jsonb_build_object('semana', p_semana, 'indice', v_indice, 'respostas', v_total, 'alertas', to_jsonb(v_alertas),
                            'nota_ok', v_nota_ok, 'alerta_ok', v_alerta_ok);
end;
$$;

-- Portal: o cliente responde por aqui. Sem parâmetro de paciente nem de profissional: tudo vem de auth.uid().
-- Se há um pedido do WhatsApp em aberto de uma semana anterior (domingo à noite, resposta na segunda), a resposta
-- conta para a semana do pedido; e quem já respondeu a semana anterior desde a virada corrige essa resposta.
create or replace function public.registrar_checkin_semanal(
  p_fadiga int,
  p_sono int,
  p_dor_muscular int,
  p_estresse int,
  p_humor int,
  p_urina int default null,
  p_psr int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_semana date;
  v_pedido date;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select id into v_paciente from public.pacientes where user_id = auth.uid() limit 1;
  if v_paciente is null then raise exception 'paciente_nao_vinculado'; end if;

  v_semana := public.checkin_semana_atual();
  select semana into v_pedido from public.checkin_pedidos
  where paciente_id = v_paciente and respondido_em is null and expira_em > now() and semana < v_semana
  order by semana desc limit 1;
  if v_pedido is not null then
    v_semana := v_pedido;
  else
    -- Quem já respondeu a semana anterior depois da virada (segunda de manhã, pelo pedido de domingo) corrige essa resposta: uma
    -- resposta por semana de calendário, em vez de criar uma segunda linha poucas horas depois.
    select semana into v_pedido from public.checkins_semanais
    where paciente_id = v_paciente and semana < v_semana
      and updated_at >= (v_semana::timestamp at time zone 'America/Sao_Paulo')
    order by semana desc limit 1;
    if v_pedido is not null then v_semana := v_pedido; end if;
  end if;

  return public.checkin_gravar(v_paciente, v_semana, 'portal', p_fadiga, p_sono, p_dor_muscular, p_estresse, p_humor, p_urina, p_psr);
end;
$$;

create or replace function public.definir_checkin_whatsapp(p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if p_ativo is null then raise exception 'valor_invalido'; end if;
  select id into v_paciente from public.pacientes where user_id = auth.uid() limit 1;
  if v_paciente is null then raise exception 'paciente_nao_vinculado'; end if;
  insert into public.checkin_preferencias (paciente_id, whatsapp_ativo, atualizado_em)
  values (v_paciente, p_ativo, now())
  on conflict (paciente_id) do update set whatsapp_ativo = excluded.whatsapp_ativo, atualizado_em = now();
  return p_ativo;
end;
$$;

-- ───────────── Privilégios das funções ─────────────

revoke all on function public.checkin_semana_atual() from public, anon;
revoke all on function public.checkin_alertas(uuid) from public, anon, authenticated;
revoke all on function public.checkin_gravar(uuid, date, text, int, int, int, int, int, int, int) from public, anon, authenticated;
revoke all on function public.registrar_checkin_semanal(int, int, int, int, int, int, int) from public, anon;
revoke all on function public.definir_checkin_whatsapp(boolean) from public, anon;

grant execute on function public.checkin_semana_atual() to authenticated, service_role;
grant execute on function public.checkin_alertas(uuid) to service_role;
grant execute on function public.checkin_gravar(uuid, date, text, int, int, int, int, int, int, int) to service_role;
grant execute on function public.registrar_checkin_semanal(int, int, int, int, int, int, int) to authenticated, service_role;
grant execute on function public.definir_checkin_whatsapp(boolean) to authenticated, service_role;
