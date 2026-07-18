-- O avatar do CLIENTE deve ser idêntico ao do profissional: mesma figura
-- (tamanho), mesma posição/escala dos órgãos. Essa calibração vive em
-- avatar_calibracao, mas a RLS só deixava o próprio profissional ler — então o
-- cliente caía no default (figura grande, órgãos fora do lugar). Esta policy
-- deixa o paciente LER (somente leitura) a calibração do profissional dele.
grant select on public.avatar_calibracao to authenticated;

drop policy if exists "paciente le calibracao do seu profissional" on public.avatar_calibracao;
create policy "paciente le calibracao do seu profissional"
  on public.avatar_calibracao
  for select
  to authenticated
  using (
    terapeuta_id in (
      select terapeuta_id from public.pacientes
      where user_id = auth.uid() and terapeuta_id is not null
    )
  );
