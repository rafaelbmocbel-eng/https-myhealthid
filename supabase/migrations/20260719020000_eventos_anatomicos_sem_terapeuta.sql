-- Histórico clínico do paciente sem profissional vinculado (fluxo wellness /
-- autocadastro): o envio do "Histórico Clínico Estratégico" grava achados em
-- eventos_clinicos_anatomicos para o profissional revisar e montar o Avatar.
-- Antes, terapeuta_id era NOT NULL — então um paciente SEM profissional recebia
-- erro ao enviar ("Não foi possível salvar o histórico"). Agora o histórico é
-- SEMPRE guardado; quando o paciente se conecta a um profissional, os achados
-- pendentes passam a ser dele (e entram na fila de revisão do Avatar Clínico).

alter table public.eventos_clinicos_anatomicos
  alter column terapeuta_id drop not null;

-- Ao vincular um profissional ao paciente (terapeuta_id: null → valor), herda
-- os achados que ficaram sem dono. RLS do profissional é por terapeuta_id, então
-- sem este backfill os achados guardados antes do vínculo ficariam invisíveis.
create or replace function public.herdar_eventos_anatomicos_sem_terapeuta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.terapeuta_id is not null and (old.terapeuta_id is null or old.terapeuta_id <> new.terapeuta_id) then
    update public.eventos_clinicos_anatomicos
      set terapeuta_id = new.terapeuta_id
      where paciente_id = new.id
        and terapeuta_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_herdar_eventos_anatomicos on public.pacientes;
create trigger trg_herdar_eventos_anatomicos
  after update of terapeuta_id on public.pacientes
  for each row
  execute function public.herdar_eventos_anatomicos_sem_terapeuta();
