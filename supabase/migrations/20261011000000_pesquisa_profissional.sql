-- PESQUISA AUTOMÁTICA DE PROFISSIONAIS (decisão do Rafael, 11/10/2026; docs/triagem-planos.md).
--
-- Na aba Administração, o botão "Pesquisar" de cada profissional faz uma pesquisa na internet SÓ sobre
-- informação profissional pública (registro no conselho, formação, atuação, perfil público) para ajudar o
-- administrador a verificar. A pesquisa NUNCA verifica ninguém: é só indício; verificar continua sendo um
-- clique do administrador (verificar_profissional, 20261008100000).
--
--  1. Tabela profissional_pesquisas: histórico de cada pesquisa (quem pesquisou, quando, o que a busca usou,
--     o resultado e as falhas). RLS ligado e NENHUMA policy: só o service_role (edge pesquisar-profissional)
--     escreve e só as RPCs do super-admin leem.
--  2. RPCs de leitura do super-admin: pesquisa_profissional_ultima e pesquisas_profissionais_resumo.
--  3. RPCs só do servidor (service_role): pesquisa_profissional_pode_pesquisar (confere os limites de custo E
--     RESERVA a vaga, numa transação só) e registrar_pesquisa_profissional (conclui a reserva, ou grava uma
--     linha nova, sanitizando o que entra).
-- Idempotente: pode rodar várias vezes. Não apaga tabelas, colunas, funções nem dados.

-- ── 1. Histórico das pesquisas ───────────────────────────────────────────────

-- user_id é o profissional pesquisado: se a conta dele for excluída, o histórico sobre ele sai junto (LGPD).
-- pesquisado_por é o administrador que pediu a pesquisa (fica sem FK para o registro sobreviver à conta dele).
CREATE TABLE IF NOT EXISTS public.profissional_pesquisas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pesquisado_por uuid NOT NULL,
  pesquisado_em timestamptz NOT NULL DEFAULT now(),
  nivel_indicio text NOT NULL
    CHECK (nivel_indicio IN ('compativel', 'inconclusivo', 'divergente', 'nao_encontrado', 'nao_consultavel')),
  resumo text,
  achados jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(achados) = 'array'),
  consulta_usada jsonb CHECK (consulta_usada IS NULL OR jsonb_typeof(consulta_usada) = 'object'),
  modelo text,
  erro text
);

CREATE INDEX IF NOT EXISTS profissional_pesquisas_user_idx
  ON public.profissional_pesquisas (user_id, pesquisado_em DESC);
CREATE INDEX IF NOT EXISTS profissional_pesquisas_em_idx
  ON public.profissional_pesquisas (pesquisado_em DESC);

ALTER TABLE public.profissional_pesquisas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profissional_pesquisas FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profissional_pesquisas TO service_role;

-- ── 2. Leitura pelo super-admin ──────────────────────────────────────────────

-- A pesquisa mais recente do profissional (ou null).
CREATE OR REPLACE FUNCTION public.pesquisa_profissional_ultima(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador MyHealthID' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
           'id', x.id, 'pesquisado_em', x.pesquisado_em, 'nivel_indicio', x.nivel_indicio,
           'resumo', x.resumo, 'achados', x.achados, 'consulta_usada', x.consulta_usada,
           'modelo', x.modelo, 'erro', x.erro)
    INTO v_out
    FROM public.profissional_pesquisas x
   WHERE x.user_id = p_user_id
   ORDER BY x.pesquisado_em DESC, x.id DESC
   LIMIT 1;
  RETURN v_out;
END; $$;

-- A última pesquisa de cada profissional, só o necessário para o selo da lista.
CREATE OR REPLACE FUNCTION public.pesquisas_profissionais_resumo()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador MyHealthID' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.user_id, 'pesquisado_em', u.pesquisado_em, 'nivel_indicio', u.nivel_indicio)
         ORDER BY u.pesquisado_em DESC, u.user_id), '[]'::jsonb)
    INTO v_out
    FROM (SELECT DISTINCT ON (x.user_id) x.user_id, x.pesquisado_em, x.nivel_indicio
            FROM public.profissional_pesquisas x
           ORDER BY x.user_id, x.pesquisado_em DESC, x.id DESC) u;
  RETURN v_out;
END; $$;

-- ── 3. Só o servidor: limites de custo, reserva e gravação ───────────────────

-- Limites da pesquisa (cada uma é uma chamada de IA com busca na internet): no máximo 1 por profissional
-- a cada 10 minutos e 60 no total nas últimas 24 horas. Contam TODAS as linhas, inclusive as falhas (a
-- falha também gastou uma chamada). O limite diário vale primeiro: com ele estourado, "aguarde 10 minutos"
-- seria enganoso. Valores operacionais provisórios; mudar exige nova migration.
--
-- Conferir e gravar NÃO podem ser passos separados (a pesquisa leva quase um minuto): vários cliques ao mesmo
-- tempo passariam juntos pelo limite. Por isso esta função serializa as reservas com um lock e grava, na hora,
-- uma linha provisória (nivel 'nao_consultavel', erro 'em_andamento') que já conta nos limites. A edge conclui
-- essa linha em registrar_pesquisa_profissional (p_id); se a edge cair no meio, a linha fica como falha
-- registrada e continua contando.
CREATE OR REPLACE FUNCTION public.pesquisa_profissional_pode_pesquisar(p_user_id uuid, p_pesquisado_por uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_intervalo CONSTANT interval := interval '10 minutes';
  c_dia CONSTANT interval := interval '24 hours';
  c_max_dia CONSTANT integer := 60;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_pesquisado_por IS NULL THEN
    RAISE EXCEPTION 'Informe o profissional a pesquisar e quem pesquisa.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('pesquisa_profissional'));
  IF (SELECT count(*) FROM public.profissional_pesquisas WHERE pesquisado_em > now() - c_dia) >= c_max_dia THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'limite_diario');
  END IF;
  IF EXISTS (SELECT 1 FROM public.profissional_pesquisas
              WHERE user_id = p_user_id AND pesquisado_em > now() - c_intervalo) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'limite_profissional');
  END IF;
  INSERT INTO public.profissional_pesquisas (user_id, pesquisado_por, nivel_indicio, resumo, erro)
  VALUES (p_user_id, p_pesquisado_por, 'nao_consultavel',
          'Não consegui consultar automaticamente. A pesquisa não terminou (pode ainda estar em andamento ou a conexão caiu). Use o atalho para a consulta oficial ou tente de novo em alguns minutos.',
          'em_andamento')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

-- Grava o resultado e devolve o id. Com p_id, conclui a reserva feita por pesquisa_profissional_pode_pesquisar
-- (só se ainda estiver em andamento e for do mesmo profissional e do mesmo administrador); sem p_id, grava uma
-- linha nova. Defesa em profundidade (a edge já valida): nível conhecido, achados só com os campos e categorias
-- do escopo profissional, https e tamanhos limitados (URL maior que 2000 caracteres é recusada, nunca cortada),
-- e consulta_usada só com as chaves permitidas (nunca e-mail nem telefone).
CREATE OR REPLACE FUNCTION public.registrar_pesquisa_profissional(
  p_user_id uuid, p_pesquisado_por uuid, p_nivel_indicio text, p_resumo text DEFAULT NULL,
  p_achados jsonb DEFAULT '[]'::jsonb, p_consulta_usada jsonb DEFAULT NULL,
  p_modelo text DEFAULT NULL, p_erro text DEFAULT NULL, p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_achados jsonb; v_consulta jsonb; v_resumo text; v_modelo text; v_erro text;
BEGIN
  IF p_user_id IS NULL OR p_pesquisado_por IS NULL THEN
    RAISE EXCEPTION 'Informe o profissional pesquisado e quem pesquisou.' USING ERRCODE = 'P0001';
  END IF;
  IF p_nivel_indicio IS NULL
     OR p_nivel_indicio NOT IN ('compativel', 'inconclusivo', 'divergente', 'nao_encontrado', 'nao_consultavel') THEN
    RAISE EXCEPTION 'Nível de indício inválido: %', p_nivel_indicio USING ERRCODE = 'P0001';
  END IF;

  IF p_achados IS NULL OR jsonb_typeof(p_achados) IS DISTINCT FROM 'array' THEN
    v_achados := '[]'::jsonb;
  ELSE
    SELECT coalesce(jsonb_agg(q.item ORDER BY q.ord), '[]'::jsonb) INTO v_achados
      FROM (
        SELECT t.ord,
               jsonb_build_object(
                 'categoria', t.a ->> 'categoria',
                 'texto', left(coalesce(t.a ->> 'texto', ''), 600),
                 'trecho', left(t.a ->> 'trecho', 800),
                 'fonte_url', t.a ->> 'fonte_url',
                 'fonte_titulo', left(coalesce(t.a ->> 'fonte_titulo', ''), 300)) AS item
          FROM jsonb_array_elements(p_achados) WITH ORDINALITY AS t(a, ord)
         WHERE jsonb_typeof(t.a) = 'object'
           AND (t.a ->> 'categoria') IN ('registro_conselho', 'situacao_registro', 'formacao', 'atuacao_profissional', 'perfil_publico')
           AND length(btrim(coalesce(t.a ->> 'trecho', ''))) > 0
           AND (t.a ->> 'fonte_url') ~* '^https://[^[:space:]]+$'
           AND length(t.a ->> 'fonte_url') <= 2000
         ORDER BY t.ord
         LIMIT 20
      ) q;
  END IF;

  IF p_consulta_usada IS NULL OR jsonb_typeof(p_consulta_usada) IS DISTINCT FROM 'object' THEN
    v_consulta := NULL;
  ELSE
    SELECT coalesce(jsonb_object_agg(k.key, left(k.value, 120)), '{}'::jsonb) INTO v_consulta
      FROM jsonb_each_text(p_consulta_usada) AS k(key, value)
     WHERE k.key IN ('nome', 'registro', 'profissao', 'conselho_esperado', 'cidade', 'uf')
       AND k.value IS NOT NULL AND position('@' IN k.value) = 0;
  END IF;

  v_resumo := left(nullif(btrim(coalesce(p_resumo, '')), ''), 1000);
  v_modelo := left(nullif(btrim(coalesce(p_modelo, '')), ''), 80);
  v_erro := left(nullif(btrim(coalesce(p_erro, '')), ''), 500);

  IF p_id IS NULL THEN
    INSERT INTO public.profissional_pesquisas
      (user_id, pesquisado_por, nivel_indicio, resumo, achados, consulta_usada, modelo, erro)
    VALUES (p_user_id, p_pesquisado_por, p_nivel_indicio, v_resumo, v_achados, v_consulta, v_modelo, v_erro)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.profissional_pesquisas
       SET nivel_indicio = p_nivel_indicio, resumo = v_resumo, achados = v_achados,
           consulta_usada = v_consulta, modelo = v_modelo, erro = v_erro
     WHERE id = p_id AND user_id = p_user_id AND pesquisado_por = p_pesquisado_por AND erro = 'em_andamento'
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Reserva de pesquisa não encontrada ou já concluída.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN v_id;
END; $$;

-- ── 4. Permissões ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.pesquisa_profissional_ultima(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.pesquisas_profissionais_resumo() FROM public, anon;
REVOKE ALL ON FUNCTION public.pesquisa_profissional_pode_pesquisar(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_pesquisa_profissional(uuid, uuid, text, text, jsonb, jsonb, text, text, uuid)
  FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pesquisa_profissional_ultima(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pesquisas_profissionais_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pesquisa_profissional_pode_pesquisar(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_pesquisa_profissional(uuid, uuid, text, text, jsonb, jsonb, text, text, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
