-- PREVENÇÃO DE DUPLICATA na raiz do autocadastro.
--
-- Problema: quando um cliente que JÁ foi pré-cadastrado por um profissional
-- (linha em `pacientes` com user_id NULL) faz o próprio autocadastro pelo
-- portal, o trigger antigo criava uma SEGUNDA linha (user_id preenchido),
-- porque só checava `WHERE NOT EXISTS ... user_id = NEW.user_id`. O
-- profissional ficava com um paciente "fantasma" e o cliente logado numa
-- linha órfã (sem terapeuta, sem histórico do profissional).
--
-- Correção: antes de inserir, o trigger tenta VINCULAR a uma linha já
-- existente do profissional com o mesmo e-mail e user_id ainda nulo. Se
-- vincular, o INSERT é pulado (a linha passa a existir com esse user_id).

CREATE OR REPLACE FUNCTION public.criar_paciente_do_portal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existente uuid;
BEGIN
  -- 1) Já existe linha para este user_id? Nada a fazer.
  IF EXISTS (SELECT 1 FROM public.pacientes p WHERE p.user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  -- 2) Existe uma linha do profissional (user_id NULL) com o mesmo e-mail?
  --    Vincula essa linha ao cliente logado em vez de criar uma segunda.
  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT p.id INTO v_existente
    FROM public.pacientes p
    WHERE p.user_id IS NULL
      AND lower(btrim(p.email)) = lower(btrim(NEW.email))
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_existente IS NOT NULL THEN
      UPDATE public.pacientes
      SET user_id = NEW.user_id,
          nome = COALESCE(NULLIF(nome, ''), NULLIF(NEW.nome, ''), 'Cliente'),
          cadastro_status = 'completo',
          ativo = true
      WHERE id = v_existente;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) Sem linha existente: cria a linha de autocadastro (wellness).
  INSERT INTO public.pacientes (user_id, terapeuta_id, nome, sobrenome, email, ativo, cadastro_status, tipo_conta)
  VALUES (NEW.user_id, NULL, COALESCE(NULLIF(NEW.nome, ''), 'Cliente'), '', NEW.email, true, 'completo', 'wellness_free');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Backfill: vincula autocadastros que já viraram duplicata. Para cada linha
-- de autocadastro (user_id preenchido, sem terapeuta) que tenha uma linha
-- "irmã" do profissional com o mesmo e-mail e user_id nulo, transfere o
-- user_id para a linha do profissional e remove a linha órfã do autocadastro.
DO $$
DECLARE
  r RECORD;
  v_prof uuid;
BEGIN
  FOR r IN
    SELECT id, user_id, email
    FROM public.pacientes
    WHERE user_id IS NOT NULL
      AND terapeuta_id IS NULL
      AND email IS NOT NULL AND btrim(email) <> ''
  LOOP
    SELECT p.id INTO v_prof
    FROM public.pacientes p
    WHERE p.user_id IS NULL
      AND p.terapeuta_id IS NOT NULL
      AND lower(btrim(p.email)) = lower(btrim(r.email))
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_prof IS NOT NULL THEN
      -- Move os dados clínicos vinculados ao paciente órfão para a linha do profissional.
      UPDATE public.myid_avaliacoes SET paciente_id = v_prof WHERE paciente_id = r.id;
      UPDATE public.planos_ia_cliente SET paciente_id = v_prof WHERE paciente_id = r.id;
      -- Vincula a linha do profissional ao cliente logado e apaga a órfã.
      UPDATE public.pacientes SET user_id = r.user_id, cadastro_status = 'completo', ativo = true WHERE id = v_prof;
      DELETE FROM public.pacientes WHERE id = r.id;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Backfill é best-effort; não bloqueia a migração se alguma tabela referida não existir.
  NULL;
END;
$$;
