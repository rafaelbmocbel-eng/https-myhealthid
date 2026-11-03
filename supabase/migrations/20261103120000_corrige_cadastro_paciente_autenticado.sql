-- Cadastro completado pelo próprio cliente logado no portal (CompletarCadastroPortal).
--
-- A versão original (20260525014333) gravava em colunas que não existem no banco real: termos_consentimento.aceito_em (a coluna
-- é data_aceite, e versao/texto_termo são obrigatórias) e notificacoes.mensagem/paciente_id (as colunas são descricao e rota).
-- Como o plpgsql só descobre coluna inexistente na hora de rodar, a função existia mas falhava SEMPRE, e o erro desfazia
-- também a atualização do cadastro: o cliente via "Não foi possível salvar".
--
-- Agora: grava o cadastro; registra o termo LGPD e avisa o profissional só na primeira conclusão (editar depois não repete);
-- e termo/aviso nunca derrubam o salvamento do cadastro. Cliente sem profissional (conta wellness) salva normalmente, só não
-- há termo nem aviso a registrar, porque as duas tabelas exigem o profissional. Só cliente logado executa.
--
-- Mesmo problema de fundo no gatilho que espelha o cliente em whatsapp_conversas (20260517165659): pacientes.terapeuta_id
-- aceita nulo (cliente wellness, sem profissional) mas whatsapp_conversas.terapeuta_id é obrigatório. Todo cliente sem
-- profissional que informava telefone fazia o INSERT/UPDATE falhar com "null value in column terapeuta_id". Sem profissional
-- não há conversa a espelhar, então o gatilho passa a sair cedo.
create or replace function public.sync_paciente_whatsapp_conversa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if new.terapeuta_id is null then return new; end if;
  v_phone := regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g');
  if v_phone = '' or length(v_phone) < 8 then return new; end if;
  if new.ativo is not true then return new; end if;

  insert into public.whatsapp_conversas (
    terapeuta_id, paciente_id, telefone, nome_contato, pipeline_stage
  ) values (
    new.terapeuta_id, new.id, v_phone,
    trim(coalesce(new.nome,'') || ' ' || coalesce(new.sobrenome,'')),
    'fechado'::crm_pipeline_stage
  )
  on conflict (terapeuta_id, telefone) do update
    set paciente_id = excluded.paciente_id,
        nome_contato = coalesce(whatsapp_conversas.nome_contato, excluded.nome_contato);
  return new;
end;
$$;

create or replace function public.salvar_cadastro_paciente_autenticado(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_paciente_id uuid;
  v_terapeuta_id uuid;
  v_status_anterior text;
  v_lgpd_anterior timestamptz;
  v_lgpd boolean := coalesce((p_data->>'lgpd_aceite')::boolean, false);
begin
  if v_uid is null then
    raise exception 'nao_autenticado';
  end if;
  if not v_lgpd then
    raise exception 'lgpd_obrigatorio';
  end if;

  select id, terapeuta_id, cadastro_status, lgpd_aceite_em
    into v_paciente_id, v_terapeuta_id, v_status_anterior, v_lgpd_anterior
  from public.pacientes
  where user_id = v_uid
  limit 1;

  if v_paciente_id is null then
    raise exception 'paciente_nao_vinculado';
  end if;

  update public.pacientes set
    nome = coalesce(nullif(p_data->>'nome',''), nome),
    sobrenome = coalesce(nullif(p_data->>'sobrenome',''), sobrenome),
    telefone = coalesce(nullif(p_data->>'telefone',''), telefone),
    cpf = coalesce(nullif(p_data->>'cpf',''), cpf),
    data_nascimento = coalesce(nullif(p_data->>'data_nascimento','')::date, data_nascimento),
    genero = coalesce(nullif(p_data->>'genero',''), genero),
    cep = coalesce(nullif(p_data->>'cep',''), cep),
    endereco = coalesce(nullif(p_data->>'endereco',''), endereco),
    endereco_numero = coalesce(nullif(p_data->>'endereco_numero',''), endereco_numero),
    endereco_complemento = coalesce(nullif(p_data->>'endereco_complemento',''), endereco_complemento),
    bairro = coalesce(nullif(p_data->>'bairro',''), bairro),
    cidade = coalesce(nullif(p_data->>'cidade',''), cidade),
    uf = coalesce(nullif(p_data->>'uf',''), uf),
    queixa_principal = coalesce(nullif(p_data->>'queixa_principal',''), queixa_principal),
    alergias = coalesce(nullif(p_data->>'alergias',''), alergias),
    medicamentos_uso = coalesce(nullif(p_data->>'medicamentos_uso',''), medicamentos_uso),
    condicoes_preexistentes = coalesce(nullif(p_data->>'condicoes_preexistentes',''), condicoes_preexistentes),
    contato_emergencia_nome = coalesce(nullif(p_data->>'contato_emergencia_nome',''), contato_emergencia_nome),
    contato_emergencia_telefone = coalesce(nullif(p_data->>'contato_emergencia_telefone',''), contato_emergencia_telefone),
    contato_emergencia_parentesco = coalesce(nullif(p_data->>'contato_emergencia_parentesco',''), contato_emergencia_parentesco),
    lgpd_aceite_em = coalesce(lgpd_aceite_em, now()),
    lgpd_versao = coalesce(lgpd_versao, '1.0'),
    cadastro_status = 'completo',
    updated_at = now()
  where id = v_paciente_id;

  if v_terapeuta_id is not null and v_lgpd_anterior is null then
    begin
      insert into public.termos_consentimento (paciente_id, terapeuta_id, tipo, versao, texto_termo, aceito, data_aceite)
      values (
        v_paciente_id, v_terapeuta_id, 'lgpd', '1.0',
        'Autorizo o tratamento dos meus dados pessoais e de saúde para fins clínicos e administrativos, conforme a LGPD.',
        true, now());
    exception when others then
      raise warning 'salvar_cadastro_paciente_autenticado: termo LGPD nao registrado (%)', sqlerrm;
    end;
  end if;

  if v_terapeuta_id is not null and v_status_anterior is distinct from 'completo' then
    begin
      insert into public.notificacoes (terapeuta_id, tipo, titulo, descricao, rota, metadata)
      values (
        v_terapeuta_id,
        'paciente_completou_cadastro',
        '✅ Paciente completou o cadastro',
        'O paciente terminou de preencher os dados completos.',
        '/pacientes/' || v_paciente_id,
        jsonb_build_object('paciente_id', v_paciente_id, 'source', 'portal_autenticado'));
    exception when others then
      raise warning 'salvar_cadastro_paciente_autenticado: aviso ao profissional nao registrado (%)', sqlerrm;
    end;
  end if;

  return jsonb_build_object('ok', true, 'paciente_id', v_paciente_id);
end;
$$;

revoke execute on function public.salvar_cadastro_paciente_autenticado(jsonb) from public, anon;
grant execute on function public.salvar_cadastro_paciente_autenticado(jsonb) to authenticated;
