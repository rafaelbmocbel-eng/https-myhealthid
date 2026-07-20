-- EXCLUSÃO DEFINITIVA de paciente — para os casos em que "o paciente voltava".
--
-- Duas causas conhecidas de reaparecimento:
--   1) A exclusão fazia uma cascata MANUAL com lista fixa de tabelas. Se o
--      paciente tivesse linha numa tabela nova (ex.: eventos_clinicos_anatomicos,
--      planos_ia_cliente) com FK para pacientes, o DELETE final quebrava por
--      violação de chave estrangeira e a transação inteira do RPC era desfeita —
--      o paciente continuava lá.
--   2) Paciente vindo da Vitrine: a solicitação de conexão 'aceita' permanecia,
--      e o backfill/re-aceite recriava a linha do paciente.
--
-- Correção: apaga dinamicamente TODA linha-filha que referencia pacientes(id)
-- (adapta-se a tabelas futuras, sem rollback), remove a solicitação da vitrine
-- deste cliente com este profissional (corta a fonte de recriação) e então
-- apaga o paciente.

CREATE OR REPLACE FUNCTION public.excluir_paciente_completo(p_paciente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terapeuta uuid;
  v_user_id   uuid;
  r RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT terapeuta_id, user_id INTO v_terapeuta, v_user_id
  FROM public.pacientes WHERE id = p_paciente_id;

  IF v_terapeuta IS NULL THEN
    RAISE EXCEPTION 'paciente_nao_encontrado';
  END IF;

  IF v_terapeuta <> auth.uid() THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  -- 1) Netos conhecidos (tabelas que apontam para filhas de pacientes, não para
  --    pacientes diretamente) — precisam sair antes das filhas.
  DELETE FROM public.protocolo_tratamentos
   WHERE protocolo_id IN (SELECT id FROM public.protocolos WHERE paciente_id = p_paciente_id);

  -- 2) Cascata DINÂMICA: apaga toda linha em qualquer tabela com FK de coluna
  --    única para public.pacientes(id). Cobre tabelas novas automaticamente e
  --    evita o rollback por FK que fazia o paciente "voltar".
  FOR r IN
    SELECT con.conrelid::regclass::text AS tbl, att.attname AS col
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.pacientes'::regclass
      AND array_length(con.conkey, 1) = 1
      AND con.confkey[1] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.pacientes'::regclass AND attname = 'id'
      )
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING p_paciente_id;
  END LOOP;

  -- 3) Tabelas clínicas ligadas por paciente_id que podem não ter FK formal —
  --    limpeza explícita para não deixar histórico órfão.
  DELETE FROM public.eventos_clinicos_anatomicos WHERE paciente_id = p_paciente_id;
  DELETE FROM public.planos_ia_cliente          WHERE paciente_id = p_paciente_id;

  -- 4) Corta a fonte de recriação da Vitrine: a solicitação aceita deste cliente
  --    com ESTE profissional. Sem isso, o re-aceite/backfill ressuscitava o
  --    paciente. Não mexe no login do cliente (portal_pacientes/auth), que é
  --    dele e pode estar ligado a outros profissionais.
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.solicitacoes_conexao
     WHERE paciente_user_id = v_user_id AND terapeuta_id = v_terapeuta;
  END IF;

  -- 5) Finalmente, o paciente.
  DELETE FROM public.pacientes WHERE id = p_paciente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_paciente_completo(uuid) TO authenticated;
