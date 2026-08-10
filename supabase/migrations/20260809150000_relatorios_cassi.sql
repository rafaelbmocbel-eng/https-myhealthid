-- Relatórios de produção CASSI SALVOS (snapshots congelados). Cada mês entregue
-- fica guardado exatamente como foi, independente de mudanças futuras nas guias.
create table if not exists public.relatorios_cassi (
  id           uuid        primary key default gen_random_uuid(),
  terapeuta_id uuid        not null default auth.uid(),
  mes          text        not null,           -- 'YYYY-MM'
  titulo       text        not null default '',
  dados        jsonb       not null,           -- snapshot (colunas, linhas, totais, cabeçalho)
  criado_em    timestamptz not null default now()
);

alter table public.relatorios_cassi enable row level security;

drop policy if exists relatorios_cassi_terapeuta_all on public.relatorios_cassi;
create policy relatorios_cassi_terapeuta_all
  on public.relatorios_cassi for all to authenticated
  using (terapeuta_id = auth.uid())
  with check (terapeuta_id = auth.uid());

create index if not exists idx_relatorios_cassi_ter_mes on public.relatorios_cassi (terapeuta_id, mes);

-- Guarda o relatório de JULHO/2026 (o que já foi entregue no mês passado).
do $$
declare v_ter uuid;
begin
  select id into v_ter from auth.users where lower(email) = 'rafaelbmocbel@gmail.com'
    order by created_at asc nulls last limit 1;
  if v_ter is null then
    select terapeuta_id into v_ter from public.pacientes
    where terapeuta_id is not null group by terapeuta_id order by count(*) desc limit 1;
  end if;
  if v_ter is null then return; end if;

  if exists (select 1 from public.relatorios_cassi where terapeuta_id = v_ter and mes = '2026-07') then
    return;
  end if;

  insert into public.relatorios_cassi (terapeuta_id, mes, titulo, dados) values (
    v_ter, '2026-07', 'Julho/2026',
    jsonb_build_object(
      'nome_clinica', 'MoviMED',
      'nome_profissional', 'Rafael Marcus Braga Mocbel',
      'cidade', 'Belém',
      'mes_label', 'JULHO',
      'data_assinatura', '05 de agosto de 2026',
      'columns', jsonb_build_array(
        jsonb_build_object('codigo','144','oficial','50000144','label','Avaliação'),
        jsonb_build_object('codigo','012','oficial','50000012','label','Código'),
        jsonb_build_object('codigo','185','oficial','31602185','label','Código')
      ),
      'rows', jsonb_build_array(
        jsonb_build_object('nome','Patrícia Natalia B. do Amaral','q', jsonb_build_array(1,10,10),'soma',1619.92),
        jsonb_build_object('nome','Izabel das Mercês Gomes','q', jsonb_build_array(1,10,10),'soma',1619.92),
        jsonb_build_object('nome','Sofia Amaral Teixeira','q', jsonb_build_array(1,10,10),'soma',1619.92),
        jsonb_build_object('nome','José Pantoja de Moraes Filho','q', jsonb_build_array(1,10,10),'soma',1619.92),
        jsonb_build_object('nome','Vladimir Bomfim Souza','q', jsonb_build_array(1,10,10),'soma',1619.92),
        jsonb_build_object('nome','Narlicelma Sobral Santos Ramos','q', jsonb_build_array(1,10,10),'soma',1619.92),
        jsonb_build_object('nome','Pedro Paulo dos Santos*','q', jsonb_build_array(1,8,10),'soma',1504.52),
        jsonb_build_object('nome','Sebastião de Almeida da Conceição','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Sebastião de Almeida da Conceição','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Maria do Socorro de Souza Silva','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Narayana Borges de Oliveira','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Leopoldina Tarcila C. Pinage','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Katia Maria de Alvarenga','q', jsonb_build_array(0,10,9),'soma',1456.57),
        jsonb_build_object('nome','Ismael Nazareno M. do Amaral','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Beatriz Silva Barros','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','Marcia Martins de Vasconcelos','q', jsonb_build_array(0,10,10),'soma',1554.30),
        jsonb_build_object('nome','André Luiz Barbosa Ferreira','q', jsonb_build_array(0,10,10),'soma',1554.30)
      ),
      'total_bruto', 26669.31,
      'imposto_pct', 15,
      'apos_imposto', 22668.91,
      'minha_pct', 45,
      'sua_parte', 10201.01
    )
  );
end $$;

notify pgrst, 'reload schema';
