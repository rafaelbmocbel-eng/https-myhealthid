import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guarda o CONTRATO da migration 20261020120000 (exclusão da própria conta de cliente). O comportamento foi
// ensaiado num PostgreSQL 16 descartável com esquema sintético (cenários em testar.sh: cliente autônomo e
// vinculado, Google, senha e freio, profissional bloqueado, falha no meio, clique duplo, religação da ficha,
// concorrência e Storage). Aqui ficam as regras que não podem regredir por descuido: só age sobre auth.uid(),
// proteção de profissional antes de qualquer alteração, o registro clínico do profissional preservado e
// impossível de reivindicar por estranho, auth.users por último e a prova de exclusão sem dado pessoal.
const PASTA = resolve(process.cwd(), 'supabase/migrations');
const ARQUIVO = '20261020120000_excluir_minha_conta_cliente.sql';
const SQL = readFileSync(resolve(PASTA, ARQUIVO), 'utf8');

const CODIGO = SQL.replace(/^\s*--.*$/gm, '');

const INICIO = CODIGO.indexOf('CREATE OR REPLACE FUNCTION public.excluir_minha_conta_cliente(');
const ABRE = CODIGO.indexOf('$$', INICIO);
const FECHA = CODIGO.indexOf('$$;', ABRE + 2);
const FUNCAO = CODIGO.slice(INICIO, FECHA + 3);
const CABECALHO = CODIGO.slice(INICIO, ABRE);
const CORPO = CODIGO.slice(ABRE + 2, FECHA);

const PRIMEIRA_ALTERACAO = CORPO.indexOf('UPDATE public.pacientes');
// O último: o bloco do Storage também tem um EXCEPTION WHEN OTHERS (local, só dele).
const FIM_DO_TRABALHO = CORPO.lastIndexOf('EXCEPTION WHEN OTHERS');
const VALIDACOES = CORPO.slice(0, PRIMEIRA_ALTERACAO);
const MUTACAO = CORPO.slice(PRIMEIRA_ALTERACAO, FIM_DO_TRABALHO);
const TRATAMENTO_DE_ERRO = CORPO.slice(FIM_DO_TRABALHO);

const MENSAGENS_DA_INTERFACE = [
  'nao_autenticado',
  'confirmacao_invalida',
  'tente_novamente',
  'conta_de_profissional',
  'conta_nao_e_de_cliente',
  'premium_requer_aceite',
  'senha_obrigatoria',
  'muitas_tentativas',
  'reautenticar',
  'cadastro_precisa_correcao',
  'falha_ao_excluir',
];

const ordem = (trecho: string, ...partes: string[]) => {
  const posicoes = partes.map((parte) => {
    const i = trecho.indexOf(parte);
    expect(i, `não achei "${parte}"`).toBeGreaterThanOrEqual(0);
    return i;
  });
  expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
};

// Corpo (entre $$ e $$) de uma função de um arquivo de migration, sem comentários e com espaços normalizados.
const corpoNormalizado = (sql: string, funcao: string): string => {
  const i = sql.indexOf(`FUNCTION public.${funcao}(`);
  expect(i, `função ${funcao} não encontrada`).toBeGreaterThanOrEqual(0);
  const abre = sql.indexOf('$$', i);
  const fecha = sql.indexOf('$$;', abre + 2);
  return sql
    .slice(abre + 2, fecha)
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
};

describe('migration da exclusão de conta de cliente: arquivo e dependências', () => {
  it('encontrou a função e separa validações de alterações', () => {
    expect(INICIO).toBeGreaterThan(0);
    expect(ABRE).toBeGreaterThan(INICIO);
    expect(FECHA).toBeGreaterThan(ABRE);
    expect(PRIMEIRA_ALTERACAO).toBeGreaterThan(0);
    expect(FIM_DO_TRABALHO).toBeGreaterThan(PRIMEIRA_ALTERACAO);
  });

  it('é a migration mais nova e vem depois das que criam eh_super_admin e as colunas de verificação', () => {
    const todas = readdirSync(PASTA).filter((n) => n.endsWith('.sql')).sort();
    expect(todas[todas.length - 1]).toBe(ARQUIVO);
    expect(todas.indexOf(ARQUIVO)).toBeGreaterThan(todas.indexOf('20261008000000_plano_cliente_chancela.sql'));
    expect(todas.indexOf(ARQUIVO)).toBeGreaterThan(todas.indexOf('20261008100000_pacote_seguranca_chancela.sql'));
    const chancela = readFileSync(resolve(PASTA, '20261008000000_plano_cliente_chancela.sql'), 'utf8');
    const seguranca = readFileSync(resolve(PASTA, '20261008100000_pacote_seguranca_chancela.sql'), 'utf8');
    expect(chancela).toMatch(/FUNCTION public\.eh_super_admin\(\)/);
    expect(chancela).toMatch(/ADD COLUMN IF NOT EXISTS equipe_cientifica/);
    for (const coluna of ['registro_profissional', 'verificado', 'equipe_areas']) {
      expect(seguranca).toContain(coluna);
    }
  });

  it('é idempotente e só remove a versão antiga (2 argumentos) da própria função', () => {
    expect(CODIGO).not.toMatch(/\bDROP\s+(TABLE|COLUMN|POLICY|CONSTRAINT|INDEX|TRIGGER)\b/i);
    expect(CODIGO).not.toMatch(/\bTRUNCATE\b/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+TABLE\s+(?!IF NOT EXISTS)/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+FUNCTION\b/i);
    const drops = [...CODIGO.matchAll(/\bDROP\s+FUNCTION\b[^;]*;/gi)].map((m) => m[0]);
    expect(drops).toEqual(['DROP FUNCTION IF EXISTS public.excluir_minha_conta_cliente(text, text);']);
    const alteracoes = [...CODIGO.matchAll(/\bALTER\s+TABLE\s+[^;]*;/gi)].map((m) => m[0]);
    expect(alteracoes).toEqual([
      'ALTER TABLE public.exclusoes_conta_cliente ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.exclusoes_conta_cliente_tentativas ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS vinculo_encerrado_em timestamptz;',
    ]);
  });

  it('nenhum comando de dados fora do corpo das funções', () => {
    const fora = CODIGO.replace(/\$\$[\s\S]*?\$\$/g, () => '$$$$');
    expect(fora).not.toMatch(/\b(DELETE\s+FROM|UPDATE\s+public|INSERT\s+INTO)\b/i);
  });
});

describe('migration da exclusão de conta de cliente: tabela de prova', () => {
  const tabela = CODIGO.slice(
    CODIGO.indexOf('CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente ('),
    CODIGO.indexOf(');', CODIGO.indexOf('CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente (')),
  );

  it('tem só as colunas do contrato e nenhuma que identifique a pessoa', () => {
    const colunas = [...tabela.matchAll(/^\s{2}([a-z_]+)\s+[a-z]+/gm)].map((m) => m[1]);
    expect(colunas).toEqual(['id', 'excluido_em', 'tipo', 'pacientes_desvinculados', 'observacao']);
    expect(tabela).toContain('id uuid PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(tabela).toContain('excluido_em timestamptz NOT NULL DEFAULT now()');
    expect(tabela).not.toMatch(/mail|nome|user_id|usuario|cpf|telefone|REFERENCES/i);
  });

  it('RLS ligada, nenhuma policy e nenhum acesso para anon e authenticated', () => {
    expect(CODIGO).toMatch(/ALTER TABLE public\.exclusoes_conta_cliente ENABLE ROW LEVEL SECURITY/);
    expect(CODIGO).not.toMatch(/CREATE POLICY/i);
    expect(CODIGO).toMatch(/REVOKE ALL ON public\.exclusoes_conta_cliente FROM PUBLIC, anon, authenticated/);
    expect(CODIGO).toMatch(/GRANT ALL ON public\.exclusoes_conta_cliente TO service_role/);
    expect(CODIGO).not.toMatch(/GRANT\s+[A-Z, ]+\s+ON\s+(TABLE\s+)?public\.exclusoes_conta_cliente(_tentativas)?\s+TO\s+[^;]*(authenticated|anon|public)/i);
  });

  it('o INSERT grava só tipo, contagem e observação (nunca e-mail, nome ou id do usuário)', () => {
    const insercoes = [...CORPO.matchAll(/INSERT INTO public\.exclusoes_conta_cliente \(tipo[\s\S]*?;/g)].map((m) => m[0]);
    expect(insercoes).toHaveLength(1);
    expect(insercoes[0]).toMatch(/\(tipo, pacientes_desvinculados, observacao\)/);
    expect(insercoes[0]).toContain("VALUES ('cliente', v_desvinculados, nullif(array_to_string(v_obs, ','), ''))");
    expect(insercoes[0]).not.toContain('v_uid');
    const fichas = [...CORPO.matchAll(/array_append\(v_obs, '([a-z_]+)'\)/g)].map((m) => m[1]).sort();
    expect(fichas).toEqual(['cadastro_sem_profissional', 'perfil_falso', 'premium_ativo']);
  });
});

describe('migration da exclusão de conta de cliente: freio de senha sem prender conexão', () => {
  const tentativas = CODIGO.slice(
    CODIGO.indexOf('CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente_tentativas'),
    CODIGO.indexOf(');', CODIGO.indexOf('CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente_tentativas')),
  );

  it('a tabela de tentativas não tem chave estrangeira (some junto com o usuário pela função) e fica fechada', () => {
    const colunas = [...tentativas.matchAll(/^\s{2}([a-z_]+)\s+[a-z]+/gm)].map((m) => m[1]);
    expect(colunas).toEqual(['user_id', 'falhas', 'ultima_falha_em', 'bloqueado_ate']);
    expect(tentativas).toContain('user_id uuid PRIMARY KEY');
    expect(tentativas).not.toMatch(/REFERENCES/i);
    expect(CODIGO).toMatch(/ALTER TABLE public\.exclusoes_conta_cliente_tentativas ENABLE ROW LEVEL SECURITY/);
    expect(CODIGO).toMatch(/REVOKE ALL ON public\.exclusoes_conta_cliente_tentativas FROM PUBLIC, anon, authenticated/);
    expect(CODIGO).toMatch(/GRANT ALL ON public\.exclusoes_conta_cliente_tentativas TO service_role/);
  });

  it('nunca dorme nem espera na fila: trava que falha na hora e nenhum pg_sleep', () => {
    expect(CODIGO).not.toMatch(/pg_sleep/i);
    expect(CODIGO).not.toMatch(/pg_advisory_xact_lock\(/);
    expect(VALIDACOES).toMatch(
      /IF NOT pg_catalog\.pg_try_advisory_xact_lock\(pg_catalog\.hashtextextended\('excluir_minha_conta_cliente:' \|\| v_uid::text, 0\)\) THEN\s+RAISE EXCEPTION 'tente_novamente'/,
    );
  });

  it('senha errada devolve ok:false em vez de levantar erro (um erro desfaria a contagem)', () => {
    expect(VALIDACOES).not.toMatch(/RAISE EXCEPTION 'senha_incorreta'/);
    expect(VALIDACOES).toContain(
      "RETURN jsonb_build_object('ok', false, 'erro', 'senha_incorreta', 'tentativas_restantes', greatest(0, 5 - v_falhas));",
    );
  });

  it('5 falhas bloqueiam por 15 minutos, a contagem recomeça depois de 15 minutos sem falhar, e o bloqueio vem antes da conferência', () => {
    expect(VALIDACOES).toContain("CASE WHEN v_falhas >= 5 THEN now() + interval '15 minutes' END");
    expect(VALIDACOES).toContain("v_ultima_falha < now() - interval '15 minutes'");
    expect(VALIDACOES).toMatch(/IF v_bloqueado_ate IS NOT NULL AND v_bloqueado_ate > now\(\) THEN\s+RAISE EXCEPTION 'muitas_tentativas'/);
    ordem(VALIDACOES, "RAISE EXCEPTION 'muitas_tentativas'", '.crypt($1, $2)', "'senha_incorreta'");
  });

  it('a única gravação antes das alterações é a contagem das tentativas erradas', () => {
    const gravacoes = [...VALIDACOES.matchAll(/\b(DELETE\s+FROM|UPDATE\s+public|INSERT\s+INTO)\s+(public\.[a-z_]+)/g)].map((m) => m[2]);
    expect(gravacoes).toEqual(['public.exclusoes_conta_cliente_tentativas']);
  });
});

describe('migration da exclusão de conta de cliente: ficha sem dono não pode ser reivindicada por estranho', () => {
  it('ao desvincular, o link antigo morre e o vínculo fica marcado como encerrado', () => {
    const atualizacao = MUTACAO.slice(0, MUTACAO.indexOf(';') + 1);
    expect(atualizacao).toMatch(/SET user_id = NULL,\s+portal_token = NULL,\s+vinculo_encerrado_em = now\(\),/);
    expect(atualizacao).toMatch(/WHERE user_id = v_uid\s+AND terapeuta_id IS NOT NULL;$/);
  });

  it('a coluna nasce com IF NOT EXISTS e sem valor padrão (ficha normal nunca é "encerrada")', () => {
    expect(CODIGO).toMatch(/ADD COLUMN IF NOT EXISTS vinculo_encerrado_em timestamptz;/);
  });

  it('as três funções que religam ficha sem dono ignoram a ficha de vínculo encerrado, e o resto é idêntico à última versão', () => {
    const email = readFileSync(resolve(PASTA, '20260316140436_c4d8d63e-59b3-46a2-9572-09317f0381e5.sql'), 'utf8');
    const token = readFileSync(resolve(PASTA, '20260704140000_add_link_patient_user_by_token.sql'), 'utf8');
    const portal = readFileSync(resolve(PASTA, '20260719130000_pacientes_autocadastro_sem_duplicata.sql'), 'utf8');

    expect(corpoNormalizado(SQL, 'link_patient_user_by_email')).toBe(
      corpoNormalizado(email, 'link_patient_user_by_email').replace(
        'AND (user_id IS NULL OR user_id = auth.uid()) RETURNING id INTO v_patient_id;',
        'AND (user_id IS NULL OR user_id = auth.uid()) AND vinculo_encerrado_em IS NULL RETURNING id INTO v_patient_id;',
      ),
    );
    expect(corpoNormalizado(SQL, 'link_patient_user_by_token')).toBe(
      corpoNormalizado(token, 'link_patient_user_by_token').replace(
        'AND (user_id IS NULL OR user_id = auth.uid()) RETURNING id INTO v_paciente_id;',
        'AND (user_id IS NULL OR user_id = auth.uid()) AND vinculo_encerrado_em IS NULL RETURNING id INTO v_paciente_id;',
      ),
    );
    expect(corpoNormalizado(SQL, 'criar_paciente_do_portal')).toBe(
      corpoNormalizado(portal, 'criar_paciente_do_portal').replace(
        'WHERE p.user_id IS NULL AND lower(btrim(p.email))',
        'WHERE p.user_id IS NULL AND p.vinculo_encerrado_em IS NULL AND lower(btrim(p.email))',
      ),
    );
  });

  it('as funções reescritas mantêm SECURITY DEFINER e search_path fixo', () => {
    for (const funcao of ['link_patient_user_by_email', 'link_patient_user_by_token', 'criar_paciente_do_portal']) {
      const i = CODIGO.indexOf(`CREATE OR REPLACE FUNCTION public.${funcao}(`);
      const cabecalho = CODIGO.slice(i, CODIGO.indexOf('$$', i));
      expect(cabecalho, funcao).toMatch(/SECURITY DEFINER/);
      expect(cabecalho, funcao).toMatch(/SET search_path = public/);
    }
  });

  it('rede de segurança: nenhum UPDATE religa ficha encerrada, a não ser que o mesmo UPDATE reabra o vínculo', () => {
    const i = CODIGO.indexOf('FUNCTION public.pacientes_protege_vinculo_encerrado()');
    const corpo = corpoNormalizado(CODIGO, 'pacientes_protege_vinculo_encerrado').replace('()', '');
    expect(i).toBeGreaterThan(0);
    expect(corpo).toContain(
      'IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL AND OLD.vinculo_encerrado_em IS NOT NULL AND NEW.vinculo_encerrado_em IS NOT DISTINCT FROM OLD.vinculo_encerrado_em THEN RAISE EXCEPTION \'vinculo_encerrado\' USING ERRCODE = \'42501\'; END IF;',
    );
    expect(CODIGO).toMatch(
      /CREATE OR REPLACE TRIGGER trg_pacientes_protege_vinculo_encerrado\s+BEFORE UPDATE OF user_id ON public\.pacientes\s+FOR EACH ROW\s+WHEN \(OLD\.user_id IS NULL AND NEW\.user_id IS NOT NULL\)/,
    );
  });

  it('só um link NOVO do profissional reabre o vínculo (token vazio ou igual ao anterior não reabre)', () => {
    const corpo = corpoNormalizado(CODIGO, 'pacientes_reabre_vinculo_ao_convidar');
    expect(corpo).toContain(
      "IF OLD.vinculo_encerrado_em IS NOT NULL AND OLD.user_id IS NULL AND NEW.portal_token IS NOT NULL AND btrim(NEW.portal_token) <> '' AND NEW.portal_token IS DISTINCT FROM OLD.portal_token THEN NEW.vinculo_encerrado_em := NULL;",
    );
    expect(CODIGO).toMatch(
      /CREATE OR REPLACE TRIGGER trg_pacientes_reabre_vinculo_ao_convidar\s+BEFORE UPDATE OF portal_token ON public\.pacientes\s+FOR EACH ROW\s+WHEN \(OLD\.vinculo_encerrado_em IS NOT NULL\)/,
    );
  });

  it('as funções de gatilho não são chamáveis por anon nem authenticated', () => {
    expect(CODIGO).toMatch(/REVOKE ALL ON FUNCTION public\.pacientes_protege_vinculo_encerrado\(\) FROM PUBLIC, anon, authenticated;/);
    expect(CODIGO).toMatch(/REVOKE ALL ON FUNCTION public\.pacientes_reabre_vinculo_ao_convidar\(\) FROM PUBLIC, anon, authenticated;/);
  });
});

describe('migration da exclusão de conta de cliente: função', () => {
  it('assinatura: confirmação, senha e aceite do premium (não existe parâmetro com o id de alguém)', () => {
    expect(CABECALHO).toMatch(
      /excluir_minha_conta_cliente\(\s*p_confirmacao text,\s*p_senha text DEFAULT NULL,\s*p_aceita_perder_premium boolean DEFAULT false\s*\)\s+RETURNS jsonb/,
    );
    const parametros = CABECALHO.slice(CABECALHO.indexOf('(') + 1, CABECALHO.indexOf(')'));
    expect(parametros.split(',').map((p) => p.trim().split(' ')[0])).toEqual(['p_confirmacao', 'p_senha', 'p_aceita_perder_premium']);
    expect(parametros).not.toMatch(/uuid|user|id\b/i);
  });

  it('SECURITY DEFINER com search_path fixo', () => {
    expect(CABECALHO).toMatch(/LANGUAGE plpgsql/);
    expect(CABECALHO).toMatch(/SECURITY DEFINER/);
    expect(CABECALHO).toMatch(/SET search_path = public, pg_temp/);
    expect(CABECALHO).not.toMatch(/\bSTABLE\b|\bIMMUTABLE\b/);
  });

  it('sem PUBLIC e sem anon; só authenticated executa', () => {
    expect(CODIGO).toMatch(/REVOKE ALL ON FUNCTION public\.excluir_minha_conta_cliente\(text, text, boolean\) FROM public, anon;/i);
    const concessoes = [...CODIGO.matchAll(/GRANT EXECUTE ON FUNCTION public\.excluir_minha_conta_cliente\(text, text, boolean\) TO ([a-z_, ]+);/gi)];
    expect(concessoes).toHaveLength(1);
    expect(concessoes[0][1]).toBe('authenticated');
  });

  it('o único usuário alvo é auth.uid(), lido uma vez e nunca reatribuído', () => {
    expect(CORPO.match(/auth\.uid\(\)/g)).toHaveLength(1);
    expect(CORPO).toMatch(/v_uid uuid := auth\.uid\(\);/);
    expect(CORPO).not.toMatch(/\bv_uid\s*:=/);
    expect(CORPO).not.toMatch(/\bINTO\s+v_uid\b/);
    expect(CORPO).not.toMatch(/p_(confirmacao|senha|aceita_perder_premium)[^;]*\bv_uid\b/);
  });

  it('todas as mensagens que a interface mapeia existem, exatamente como combinado', () => {
    for (const mensagem of MENSAGENS_DA_INTERFACE.filter((m) => m !== 'falha_ao_excluir' && m !== 'cadastro_precisa_correcao')) {
      expect(VALIDACOES).toContain(`RAISE EXCEPTION '${mensagem}'`);
    }
    expect(TRATAMENTO_DE_ERRO).toContain("RAISE EXCEPTION 'cadastro_precisa_correcao'");
    expect(TRATAMENTO_DE_ERRO).toContain("RAISE EXCEPTION 'falha_ao_excluir'");
    const levantadas = new Set([...CORPO.matchAll(/RAISE EXCEPTION '([a-z_]+)'/g)].map((m) => m[1]));
    const internas = [...levantadas].filter((m) => !MENSAGENS_DA_INTERFACE.includes(m)).sort();
    expect(internas).toEqual(['cadastro_alterado_durante_exclusao', 'dependencia_nao_resolvida', 'usuario_nao_removido']);
    for (const interna of internas) {
      expect(MUTACAO).toContain(`RAISE EXCEPTION '${interna}'`);
    }
  });

  it('ordem: login, confirmação, trava, usuário, profissional, cliente, premium, reautenticação, e só então qualquer alteração', () => {
    ordem(
      CORPO,
      "RAISE EXCEPTION 'nao_autenticado'",
      "RAISE EXCEPTION 'confirmacao_invalida'",
      'pg_try_advisory_xact_lock',
      'FROM auth.users u',
      "RAISE EXCEPTION 'conta_de_profissional'",
      "RAISE EXCEPTION 'conta_nao_e_de_cliente'",
      "RAISE EXCEPTION 'premium_requer_aceite'",
      "RAISE EXCEPTION 'senha_obrigatoria'",
      "RAISE EXCEPTION 'muitas_tentativas'",
      "'senha_incorreta'",
      "RAISE EXCEPTION 'reautenticar'",
      'UPDATE public.pacientes',
    );
    expect(VALIDACOES.replace(/INSERT INTO public\.exclusoes_conta_cliente_tentativas/, '')).not.toMatch(
      /\b(DELETE\s+FROM|UPDATE\s+public|INSERT\s+INTO)\b/i,
    );
  });

  it('a confirmação é EXCLUIR sem diferença de caixa ou espaços', () => {
    expect(VALIDACOES).toContain("upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR'");
    expect(VALIDACOES).toMatch(/IF NOT FOUND THEN\s+RAISE EXCEPTION 'nao_autenticado'/);
  });

  it('plano premium ativo só segue com aceite explícito (NULL conta como não aceito)', () => {
    expect(VALIDACOES).toContain("pa.user_id = v_uid AND pa.tipo_conta = 'wellness_premium'");
    expect(VALIDACOES).toMatch(/FROM public\.wellness_assinaturas w\s+JOIN public\.pacientes pa ON pa\.id = w\.paciente_id\s+WHERE pa\.user_id = v_uid AND w\.status = 'ativa'/);
    expect(VALIDACOES).toMatch(/IF v_premium AND NOT coalesce\(p_aceita_perder_premium, false\) THEN\s+RAISE EXCEPTION 'premium_requer_aceite'/);
  });
});

describe('migration da exclusão de conta de cliente: proteção de profissional', () => {
  const protecao = VALIDACOES.slice(VALIDACOES.indexOf('IF public.eh_super_admin()'), VALIDACOES.indexOf("RAISE EXCEPTION 'conta_de_profissional'"));

  it('bloqueia super-admin, cadastro como profissional, pacientes, clínica e configuração da clínica', () => {
    expect(protecao).toContain('public.eh_super_admin()');
    expect(protecao).toMatch(/v_meta ->> 'account_type', ''\) = 'professional'/);
    expect(protecao).toMatch(/FROM public\.pacientes pa WHERE pa\.terapeuta_id = v_uid/);
    expect(protecao).toMatch(/FROM public\.clinica_membros cm WHERE cm\.user_id = v_uid/);
    expect(protecao).toMatch(/FROM public\.clinicas cl WHERE cl\.dono_user_id = v_uid/);
    expect(protecao).toMatch(/FROM public\.config_clinica cc WHERE cc\.terapeuta_id = v_uid/);
    expect(protecao).toMatch(/FROM public\.profissional_verificacao_log vl WHERE vl\.user_id = v_uid/);
  });

  it('assinatura conta, mas o trial automático de todo cadastro novo NÃO conta', () => {
    expect(protecao).toMatch(/FROM public\.assinaturas a WHERE a\.user_id = v_uid AND a\.origem IS DISTINCT FROM 'trial_signup'/);
    expect(protecao.match(/public\.assinaturas/g)).toHaveLength(1);
    const trigger = readFileSync(resolve(PASTA, '20260520022035_7ab67f2d-48c8-45d5-9039-7a829eb1ee67.sql'), 'utf8');
    expect(trigger).toMatch(/'trial', 'trial_signup'/);
    expect(trigger).toMatch(/AFTER INSERT ON auth\.users/);
  });

  it('perfil só bloqueia quando tem sinal de profissional de verdade (o perfil falso de cliente não)', () => {
    const perfil = protecao.slice(protecao.indexOf('FROM public.profiles pr'));
    for (const sinal of [
      'pr.perfil_profissional_confirmado',
      'pr.verificado',
      'pr.equipe_cientifica',
      'cardinality(pr.equipe_areas) > 0',
      "btrim(coalesce(pr.crefito, '')) <> ''",
      "btrim(coalesce(pr.registro_profissional, '')) <> ''",
      "btrim(coalesce(pr.especialidade, '')) <> ''",
      "btrim(coalesce(pr.bio, '')) <> ''",
    ]) {
      expect(perfil).toContain(sinal);
    }
    expect(perfil).toMatch(/WHERE pr\.user_id = v_uid\s+AND \(/);
  });

  it('qualquer outra tabela de public com chave estrangeira para auth.users e linha do usuário também bloqueia (varredura do catálogo)', () => {
    const varredura = VALIDACOES.slice(VALIDACOES.indexOf("con.confrelid = 'auth.users'::regclass") - 400);
    expect(varredura).toContain("con.contype = 'f'");
    expect(varredura).toContain("con.confrelid = 'auth.users'::regclass");
    expect(varredura).toContain("cr.relnamespace = 'public'::regnamespace");
    // Só as tabelas de cliente ficam de fora; tabela nova de profissional entra na proteção sozinha.
    expect(varredura).toContain("cr.relname NOT IN ('portal_pacientes', 'pacientes', 'assinaturas', 'uso_ia_mensal')");
    expect(varredura).toMatch(/EXECUTE format\('SELECT EXISTS \(SELECT 1 FROM %s WHERE %I = \$1\)', v_alvo\.tbl, v_alvo\.col\) INTO v_tem USING v_uid;\s+IF v_tem THEN\s+RAISE EXCEPTION 'conta_de_profissional'/);
    // A varredura vem antes de qualquer decisão sobre ser cliente: na dúvida, bloqueia.
    ordem(VALIDACOES, "con.confrelid = 'auth.users'::regclass", "RAISE EXCEPTION 'conta_nao_e_de_cliente'");
  });

  it('o profiles falso de cliente é apagado depois da proteção', () => {
    ordem(CORPO, "RAISE EXCEPTION 'conta_de_profissional'", 'DELETE FROM public.profiles WHERE user_id = v_uid');
  });

  it('é cliente quem tem is_patient, portal_pacientes ou pacientes com o seu user_id', () => {
    const cliente = VALIDACOES.slice(VALIDACOES.indexOf('IF NOT ('), VALIDACOES.indexOf("RAISE EXCEPTION 'conta_nao_e_de_cliente'"));
    expect(cliente).toContain("v_meta ->> 'is_patient'");
    expect(cliente).toContain("= 'true'");
    expect(cliente).toMatch(/FROM public\.portal_pacientes pp WHERE pp\.user_id = v_uid/);
    expect(cliente).toMatch(/FROM public\.pacientes pc WHERE pc\.user_id = v_uid/);
  });
});

describe('migration da exclusão de conta de cliente: reautenticação', () => {
  it('quem tem senha confirma a senha com o pgcrypto', () => {
    expect(VALIDACOES).toMatch(/IF coalesce\(v_hash, ''\) <> '' THEN/);
    expect(VALIDACOES).toMatch(/IF coalesce\(p_senha, ''\) = '' THEN\s+RAISE EXCEPTION 'senha_obrigatoria'/);
    expect(VALIDACOES).toMatch(/FROM pg_catalog\.pg_extension e[\s\S]*e\.extname = 'pgcrypto'/);
    expect(VALIDACOES).toContain("EXECUTE format('SELECT %I.crypt($1, $2)', v_esquema_crypto) INTO v_calculado USING p_senha, v_hash");
    expect(VALIDACOES).toMatch(/IF v_calculado IS DISTINCT FROM v_hash THEN/);
  });

  it('quem entrou só pelo Google precisa de login com até 10 minutos', () => {
    expect(VALIDACOES).toMatch(/ELSIF v_ultimo_login IS NULL OR v_ultimo_login < now\(\) - interval '10 minutes' THEN\s+RAISE EXCEPTION 'reautenticar'/);
    expect(VALIDACOES).toContain('u.encrypted_password');
    expect(VALIDACOES).toContain('u.last_sign_in_at');
  });
});

describe('migration da exclusão de conta de cliente: o que é apagado', () => {
  it('as fichas do cliente são travadas ANTES de decidir o que fazer com cada uma (vinculação concorrente espera)', () => {
    expect(CORPO).toMatch(/PERFORM 1 FROM public\.pacientes pa WHERE pa\.user_id = v_uid ORDER BY pa\.id FOR UPDATE;/);
    // A trava vem antes de qualquer UPDATE/DELETE e antes de escolher os autocadastros.
    ordem(CORPO, 'FOR UPDATE;', 'UPDATE public.pacientes', 'SELECT coalesce(array_agg(pa.id)');
    expect(CORPO.indexOf('FOR UPDATE;')).toBeLessThan(CORPO.indexOf('DELETE FROM public.solicitacoes_conexao'));
  });

  it('o registro clínico do profissional permanece: só perde o vínculo de login (e a foto do próprio cliente)', () => {
    const atualizacoes = [...MUTACAO.matchAll(/UPDATE public\.[a-z_]+[\s\S]*?;/g)].map((m) => m[0]);
    expect(atualizacoes).toHaveLength(1);
    expect(atualizacoes[0]).toMatch(/UPDATE public\.pacientes\s+SET user_id = NULL,/);
    expect(atualizacoes[0]).toMatch(/WHERE user_id = v_uid\s+AND terapeuta_id IS NOT NULL;/);
    expect(atualizacoes[0]).toContain("avatar_url = CASE WHEN avatar_url LIKE '%/paciente-avatars/' || v_uid::text || '/%' THEN NULL ELSE avatar_url END");
    expect(MUTACAO.slice(0, MUTACAO.indexOf(';') + 1)).toBe(atualizacoes[0]);
  });

  it('o único DELETE em pacientes é o do autocadastro SEM profissional, do próprio usuário, e confere a contagem', () => {
    const exclusoes = [...MUTACAO.matchAll(/DELETE FROM public\.pacientes[\s\S]*?;/g)].map((m) => m[0]);
    expect(exclusoes).toHaveLength(1);
    expect(exclusoes[0]).toMatch(/WHERE id = ANY \(v_autonomos\)\s+AND user_id = v_uid\s+AND terapeuta_id IS NULL;/);
    expect(MUTACAO).toMatch(/SELECT coalesce\(array_agg\(pa\.id\), ARRAY\[\]::uuid\[\]\)[\s\S]*?WHERE pa\.user_id = v_uid\s+AND pa\.terapeuta_id IS NULL;/);
    // Se a ficha mudou de dono no meio do caminho, tudo é desfeito em vez de perder o histórico.
    expect(MUTACAO).toMatch(
      /AND terapeuta_id IS NULL;\s+GET DIAGNOSTICS v_linhas = ROW_COUNT;\s+IF v_linhas <> cardinality\(v_autonomos\) THEN\s+RAISE EXCEPTION 'cadastro_alterado_durante_exclusao'/,
    );
  });

  it('todo DELETE é filtrado pelo usuário ou pelos cadastros dele, nunca em massa', () => {
    const exclusoes = [...MUTACAO.matchAll(/DELETE FROM [\s\S]*?;/g)].map((m) => m[0]);
    expect(exclusoes.length).toBeGreaterThanOrEqual(7);
    for (const exclusao of exclusoes) {
      expect(exclusao).toMatch(/\bv_uid\b|\bv_autonomos\b/);
      expect(exclusao).toMatch(/\bWHERE\b|USING v_autonomos/);
    }
    expect(MUTACAO).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('limpa o que não tem chave estrangeira para o usuário', () => {
    for (const apagado of [
      'DELETE FROM public.solicitacoes_conexao WHERE paciente_user_id = v_uid',
      'DELETE FROM public.layout_config_usuario WHERE user_id = v_uid',
      'DELETE FROM public.exclusoes_conta_cliente_tentativas WHERE user_id = v_uid',
      'DELETE FROM public.profiles WHERE user_id = v_uid',
      'DELETE FROM public.portal_pacientes WHERE user_id = v_uid',
    ]) {
      expect(MUTACAO).toContain(apagado);
    }
  });

  it('nunca mexe em tabelas do profissional', () => {
    const tocadas = [...MUTACAO.matchAll(/(?:DELETE FROM|UPDATE|INSERT INTO) (?:public|auth)\.([a-z_]+)/g)].map((m) => m[1]);
    expect([...new Set(tocadas)].sort()).toEqual([
      'exclusoes_conta_cliente',
      'exclusoes_conta_cliente_tentativas',
      'layout_config_usuario',
      'pacientes',
      'portal_pacientes',
      'profiles',
      'protocolo_tratamentos',
      'solicitacoes_conexao',
      'users',
    ]);
  });

  it('a limpeza dinâmica só apaga dos cadastros do autocadastro e só em tabelas do mesmo dono de pacientes', () => {
    expect(MUTACAO).toContain("EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', v_alvo.tbl, v_alvo.col) USING v_autonomos;");
    expect(MUTACAO.match(/EXECUTE format\(/g)).toHaveLength(1);
    expect(MUTACAO).toMatch(/c\.relowner = v_dono/);
    expect(MUTACAO).toMatch(/cr\.relowner = v_dono/);
    expect(MUTACAO).toMatch(/SELECT c\.relowner INTO v_dono FROM pg_catalog\.pg_class c WHERE c\.oid = 'public\.pacientes'::regclass/);
    expect(MUTACAO).toContain("a.attname = 'paciente_id'");
    expect(MUTACAO).toMatch(/EXCEPTION WHEN foreign_key_violation THEN\s+v_pendente := true/);
    expect(MUTACAO).toMatch(/IF v_pendente THEN\s+RAISE EXCEPTION 'dependencia_nao_resolvida'/);
  });

  it('o dono do arquivo no Storage é solto antes de apagar o usuário (chave estrangeira storage.objects.owner), sem apagar o arquivo', () => {
    const i = MUTACAO.indexOf("to_regclass('storage.objects')");
    expect(i).toBeGreaterThan(0);
    const bloco = MUTACAO.slice(i, MUTACAO.indexOf('END IF;', i) + 7);
    expect(bloco).toContain("EXECUTE 'UPDATE storage.objects SET owner = NULL WHERE owner = $1' USING v_uid;");
    expect(bloco).toMatch(/EXCEPTION WHEN OTHERS THEN\s+NULL;/);
    expect(bloco).not.toMatch(/DELETE/i);
    ordem(MUTACAO, "to_regclass('storage.objects')", 'DELETE FROM auth.users');
  });

  it('auth.users é o ÚLTIMO a ser apagado, uma vez, filtrado pelo usuário', () => {
    const apagadosEmAuth = MUTACAO.match(/DELETE FROM auth\.users[^;]*;/g) ?? [];
    expect(apagadosEmAuth).toEqual(['DELETE FROM auth.users WHERE id = v_uid;']);
    const posicaoAuth = MUTACAO.indexOf('DELETE FROM auth.users');
    const demais = [...MUTACAO.matchAll(/\b(DELETE FROM|UPDATE public|UPDATE storage|INSERT INTO|EXECUTE format)\b/g)].map((m) => m.index ?? -1);
    expect(demais.length).toBeGreaterThan(8);
    expect(Math.max(...demais.filter((i) => i !== posicaoAuth))).toBeLessThan(posicaoAuth);
    expect(MUTACAO.slice(posicaoAuth)).toMatch(/GET DIAGNOSTICS v_linhas = ROW_COUNT;\s+IF v_linhas <> 1 THEN\s+RAISE EXCEPTION 'usuario_nao_removido';\s+END IF;\s*$/);
  });

  it('a prova de exclusão é gravada antes de apagar o usuário', () => {
    ordem(MUTACAO, 'INSERT INTO public.exclusoes_conta_cliente (tipo', 'DELETE FROM auth.users');
  });
});

describe('migration da exclusão de conta de cliente: tudo ou nada', () => {
  it('uma única transação: sem COMMIT, ROLLBACK, SAVEPOINT nem autonomous transaction', () => {
    expect(FUNCAO).not.toMatch(/\b(COMMIT|ROLLBACK|SAVEPOINT|dblink)\b/i);
  });

  it('qualquer falha desfaz tudo e devolve falha_ao_excluir sem vazar o usuário nem a mensagem interna', () => {
    expect(TRATAMENTO_DE_ERRO).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(TRATAMENTO_DE_ERRO).toContain("RAISE WARNING 'excluir_minha_conta_cliente: % (%)', SQLERRM, SQLSTATE;");
    expect(TRATAMENTO_DE_ERRO).toContain("RAISE EXCEPTION 'falha_ao_excluir' USING DETAIL = SQLSTATE;");
    expect(TRATAMENTO_DE_ERRO).not.toContain('v_uid');
    expect(TRATAMENTO_DE_ERRO).not.toMatch(/DELETE|UPDATE|INSERT/);
  });

  it('CPF legado inválido na ficha (22023) tem erro próprio, para a interface orientar a correção', () => {
    expect(TRATAMENTO_DE_ERRO).toMatch(
      /IF SQLSTATE = '22023' AND SQLERRM ILIKE 'CPF%' THEN\s+RAISE EXCEPTION 'cadastro_precisa_correcao' USING DETAIL = SQLSTATE;\s+END IF;/,
    );
    ordem(TRATAMENTO_DE_ERRO, "'cadastro_precisa_correcao'", "'falha_ao_excluir'");
  });

  it('só devolve sucesso depois de tudo, com o contrato ok + pacientes_desvinculados', () => {
    expect(CORPO.trimEnd()).toMatch(/RETURN jsonb_build_object\('ok', true, 'pacientes_desvinculados', v_desvinculados\);\s+END;$/);
    expect(CORPO.lastIndexOf('RETURN')).toBeGreaterThan(FIM_DO_TRABALHO);
    // Dois retornos: a senha errada (ok:false, para a contagem sobreviver) e o sucesso.
    expect(CORPO.match(/\bRETURN\b/g)).toHaveLength(2);
  });
});
