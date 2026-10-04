-- Regra do app: nome de cliente sempre em MAIÚSCULO e sem acento.
-- Aplicada no banco (gatilho) para valer em qualquer entrada: cadastro, portal,
-- WhatsApp, importação. Cobre o cadastro do cliente, as cópias do nome nas
-- avaliações, o portal e o funil de leads. Nomes de profissionais não mudam.

create or replace function public.normaliza_nome_cliente(t text)
returns text
language sql
immutable
as $$
  select case when t is null then null else
    btrim(regexp_replace(upper(translate(t,
      'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑýÿÝ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY')), '\s+', ' ', 'g'))
  end
$$;

create or replace function public.trg_nome_cliente_pacientes()
returns trigger language plpgsql as $$
begin
  new.nome := coalesce(public.normaliza_nome_cliente(new.nome), new.nome);
  new.sobrenome := coalesce(public.normaliza_nome_cliente(new.sobrenome), new.sobrenome);
  return new;
end $$;

create or replace function public.trg_nome_cliente_paciente_nome()
returns trigger language plpgsql as $$
begin
  new.paciente_nome := coalesce(public.normaliza_nome_cliente(new.paciente_nome), new.paciente_nome);
  return new;
end $$;

create or replace function public.trg_nome_cliente_nome()
returns trigger language plpgsql as $$
begin
  new.nome := coalesce(public.normaliza_nome_cliente(new.nome), new.nome);
  return new;
end $$;

drop trigger if exists nome_cliente_padrao on public.pacientes;
create trigger nome_cliente_padrao before insert or update of nome, sobrenome on public.pacientes
  for each row execute function public.trg_nome_cliente_pacientes();

drop trigger if exists nome_cliente_padrao on public.avaliacoes_voz;
create trigger nome_cliente_padrao before insert or update of paciente_nome on public.avaliacoes_voz
  for each row execute function public.trg_nome_cliente_paciente_nome();

drop trigger if exists nome_cliente_padrao on public.avaliacoes_identidade;
create trigger nome_cliente_padrao before insert or update of paciente_nome on public.avaliacoes_identidade
  for each row execute function public.trg_nome_cliente_paciente_nome();

drop trigger if exists nome_cliente_padrao on public.avaliacoes_cob_zero;
create trigger nome_cliente_padrao before insert or update of paciente_nome on public.avaliacoes_cob_zero
  for each row execute function public.trg_nome_cliente_paciente_nome();

drop trigger if exists nome_cliente_padrao on public.portal_pacientes;
create trigger nome_cliente_padrao before insert or update of nome on public.portal_pacientes
  for each row execute function public.trg_nome_cliente_nome();

drop trigger if exists nome_cliente_padrao on public.funil_leads;
create trigger nome_cliente_padrao before insert or update of nome on public.funil_leads
  for each row execute function public.trg_nome_cliente_nome();

-- Cadastros existentes (só as linhas fora do padrão). Os outros gatilhos ficam
-- desligados nesta carga: senão cada cliente com telefone criaria uma conversa
-- no Zap e a validação de cadastro poderia barrar a atualização.
set session_replication_role = replica;
update public.pacientes
  set nome = public.normaliza_nome_cliente(nome), sobrenome = public.normaliza_nome_cliente(sobrenome)
  where nome is distinct from public.normaliza_nome_cliente(nome)
     or sobrenome is distinct from public.normaliza_nome_cliente(sobrenome);
update public.avaliacoes_voz set paciente_nome = public.normaliza_nome_cliente(paciente_nome)
  where paciente_nome is distinct from public.normaliza_nome_cliente(paciente_nome);
update public.avaliacoes_identidade set paciente_nome = public.normaliza_nome_cliente(paciente_nome)
  where paciente_nome is distinct from public.normaliza_nome_cliente(paciente_nome);
update public.avaliacoes_cob_zero set paciente_nome = public.normaliza_nome_cliente(paciente_nome)
  where paciente_nome is distinct from public.normaliza_nome_cliente(paciente_nome);
update public.portal_pacientes set nome = public.normaliza_nome_cliente(nome)
  where nome is distinct from public.normaliza_nome_cliente(nome);
update public.funil_leads set nome = public.normaliza_nome_cliente(nome)
  where nome is distinct from public.normaliza_nome_cliente(nome);
-- Conversas do Zap ligadas a um cliente: mesmo nome do cadastro.
update public.whatsapp_conversas c
  set nome_contato = trim(p.nome || ' ' || coalesce(p.sobrenome, ''))
  from public.pacientes p
  where c.paciente_id = p.id
    and c.nome_contato is distinct from trim(p.nome || ' ' || coalesce(p.sobrenome, ''));
set session_replication_role = origin;
