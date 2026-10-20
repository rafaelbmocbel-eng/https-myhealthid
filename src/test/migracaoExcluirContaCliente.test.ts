import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guarda o CONTRATO da migration 20261020120000 (exclusão da própria conta de cliente). O comportamento foi
// ensaiado num PostgreSQL 16 descartável com esquema sintético (cenários em testar.sh: cliente autônomo e
// vinculado, Google, senha, profissional bloqueado, falha no meio, clique duplo). Aqui ficam as regras que não
// podem regredir por descuido: só age sobre auth.uid(), proteção de profissional antes de qualquer alteração,
// o registro clínico do profissional preservado, auth.users por último e a prova de exclusão sem dado pessoal.
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
const FIM_DO_TRABALHO = CORPO.indexOf('EXCEPTION WHEN OTHERS');
const VALIDACOES = CORPO.slice(0, PRIMEIRA_ALTERACAO);
const MUTACAO = CORPO.slice(PRIMEIRA_ALTERACAO, FIM_DO_TRABALHO);
const TRATAMENTO_DE_ERRO = CORPO.slice(FIM_DO_TRABALHO);

const MENSAGENS_DA_INTERFACE = [
  'nao_autenticado',
  'confirmacao_invalida',
  'conta_de_profissional',
  'conta_nao_e_de_cliente',
  'senha_obrigatoria',
  'senha_incorreta',
  'reautenticar',
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

  it('é idempotente e não remove nada de esquema', () => {
    expect(CODIGO).not.toMatch(/\bDROP\s+(TABLE|COLUMN|FUNCTION|POLICY|CONSTRAINT|INDEX|TRIGGER)\b/i);
    expect(CODIGO).not.toMatch(/\bTRUNCATE\b/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+TABLE\s+(?!IF NOT EXISTS)/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+FUNCTION\b/i);
    expect(CODIGO).not.toMatch(/\bALTER\s+TABLE\s+(?!public\.exclusoes_conta_cliente)/i);
  });

  it('nenhum comando de dados fora do corpo da função', () => {
    const fora = CODIGO.slice(0, ABRE) + CODIGO.slice(FECHA + 3);
    expect(fora).not.toMatch(/\b(DELETE\s+FROM|UPDATE\s+public|INSERT\s+INTO)\b/i);
  });
});

describe('migration da exclusão de conta de cliente: tabela de prova', () => {
  const tabela = CODIGO.slice(
    CODIGO.indexOf('CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente'),
    CODIGO.indexOf(');', CODIGO.indexOf('CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente')),
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
    expect(CODIGO).not.toMatch(/GRANT\s+[A-Z, ]+\s+ON\s+(TABLE\s+)?public\.exclusoes_conta_cliente\s+TO\s+[^;]*(authenticated|anon|public)/i);
  });

  it('o INSERT grava só tipo, contagem e observação (nunca e-mail, nome ou id do usuário)', () => {
    const insercoes = [...CORPO.matchAll(/INSERT INTO public\.exclusoes_conta_cliente[\s\S]*?;/g)].map((m) => m[0]);
    expect(insercoes).toHaveLength(1);
    expect(insercoes[0]).toMatch(/\(tipo, pacientes_desvinculados, observacao\)/);
    expect(insercoes[0]).toContain("VALUES ('cliente', v_desvinculados, nullif(array_to_string(v_obs, ','), ''))");
    expect(insercoes[0]).not.toContain('v_uid');
    const fichas = [...CORPO.matchAll(/array_append\(v_obs, '([a-z_]+)'\)/g)].map((m) => m[1]).sort();
    expect(fichas).toEqual(['cadastro_sem_profissional', 'perfil_falso', 'premium_ativo']);
  });
});

describe('migration da exclusão de conta de cliente: função', () => {
  it('assinatura: só confirmação e senha (não existe parâmetro com o id de alguém)', () => {
    expect(CABECALHO).toMatch(/excluir_minha_conta_cliente\(p_confirmacao text, p_senha text DEFAULT NULL\)\s+RETURNS jsonb/);
    const parametros = CABECALHO.slice(CABECALHO.indexOf('(') + 1, CABECALHO.indexOf(')'));
    expect(parametros.split(',').map((p) => p.trim().split(' ')[0])).toEqual(['p_confirmacao', 'p_senha']);
    expect(parametros).not.toMatch(/uuid|user|id\b/i);
  });

  it('SECURITY DEFINER com search_path fixo', () => {
    expect(CABECALHO).toMatch(/LANGUAGE plpgsql/);
    expect(CABECALHO).toMatch(/SECURITY DEFINER/);
    expect(CABECALHO).toMatch(/SET search_path = public, pg_temp/);
    expect(CABECALHO).not.toMatch(/\bSTABLE\b|\bIMMUTABLE\b/);
  });

  it('sem PUBLIC e sem anon; só authenticated executa', () => {
    expect(CODIGO).toMatch(/REVOKE ALL ON FUNCTION public\.excluir_minha_conta_cliente\(text, text\) FROM public, anon;/i);
    const concessoes = [...CODIGO.matchAll(/GRANT EXECUTE ON FUNCTION public\.excluir_minha_conta_cliente\(text, text\) TO ([a-z_, ]+);/gi)];
    expect(concessoes).toHaveLength(1);
    expect(concessoes[0][1]).toBe('authenticated');
  });

  it('o único usuário alvo é auth.uid(), lido uma vez e nunca reatribuído', () => {
    expect(CORPO.match(/auth\.uid\(\)/g)).toHaveLength(1);
    expect(CORPO).toMatch(/v_uid uuid := auth\.uid\(\);/);
    expect(CORPO).not.toMatch(/\bv_uid\s*:=/);
    expect(CORPO).not.toMatch(/\bINTO\s+v_uid\b/);
    expect(CORPO).not.toMatch(/p_(confirmacao|senha)[^;]*\bv_uid\b/);
  });

  it('todas as mensagens que a interface mapeia existem, exatamente como combinado', () => {
    for (const mensagem of MENSAGENS_DA_INTERFACE) {
      expect(CORPO).toContain(`RAISE EXCEPTION '${mensagem}'`);
    }
    const levantadas = new Set([...CORPO.matchAll(/RAISE EXCEPTION '([a-z_]+)'/g)].map((m) => m[1]));
    const internas = [...levantadas].filter((m) => !MENSAGENS_DA_INTERFACE.includes(m)).sort();
    expect(internas).toEqual(['dependencia_nao_resolvida', 'usuario_nao_removido']);
    for (const interna of internas) {
      expect(MUTACAO).toContain(`RAISE EXCEPTION '${interna}'`);
    }
  });

  it('ordem: login, confirmação, trava, usuário, profissional, cliente, reautenticação, e só então qualquer alteração', () => {
    ordem(
      CORPO,
      "RAISE EXCEPTION 'nao_autenticado'",
      "RAISE EXCEPTION 'confirmacao_invalida'",
      'pg_advisory_xact_lock',
      'FROM auth.users u',
      "RAISE EXCEPTION 'conta_de_profissional'",
      "RAISE EXCEPTION 'conta_nao_e_de_cliente'",
      "RAISE EXCEPTION 'senha_obrigatoria'",
      "RAISE EXCEPTION 'senha_incorreta'",
      "RAISE EXCEPTION 'reautenticar'",
      'UPDATE public.pacientes',
    );
    expect(VALIDACOES).not.toMatch(/\b(DELETE\s+FROM|UPDATE\s+public|INSERT\s+INTO)\b/i);
  });

  it('a confirmação é EXCLUIR sem diferença de caixa ou espaços', () => {
    expect(VALIDACOES).toContain("upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR'");
  });

  it('trava por usuário: clique duplo não roda duas vezes', () => {
    expect(VALIDACOES).toMatch(/pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('excluir_minha_conta_cliente:' \|\| v_uid::text, 0\)\)/);
    expect(VALIDACOES).toMatch(/IF NOT FOUND THEN\s+RAISE EXCEPTION 'nao_autenticado'/);
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
  it('quem tem senha confirma a senha com o pgcrypto, e a senha errada espera 1 segundo', () => {
    expect(VALIDACOES).toMatch(/IF coalesce\(v_hash, ''\) <> '' THEN/);
    expect(VALIDACOES).toMatch(/IF coalesce\(p_senha, ''\) = '' THEN\s+RAISE EXCEPTION 'senha_obrigatoria'/);
    expect(VALIDACOES).toMatch(/FROM pg_catalog\.pg_extension e[\s\S]*e\.extname = 'pgcrypto'/);
    expect(VALIDACOES).toContain("EXECUTE format('SELECT %I.crypt($1, $2)', v_esquema_crypto) INTO v_calculado USING p_senha, v_hash");
    expect(VALIDACOES).toMatch(/IF v_calculado IS DISTINCT FROM v_hash THEN\s+PERFORM pg_catalog\.pg_sleep\(1\);\s+RAISE EXCEPTION 'senha_incorreta'/);
  });

  it('quem entrou só pelo Google precisa de login com até 10 minutos', () => {
    expect(VALIDACOES).toMatch(/ELSIF v_ultimo_login IS NULL OR v_ultimo_login < now\(\) - interval '10 minutes' THEN\s+RAISE EXCEPTION 'reautenticar'/);
    expect(VALIDACOES).toContain('u.encrypted_password');
    expect(VALIDACOES).toContain('u.last_sign_in_at');
  });
});

describe('migration da exclusão de conta de cliente: o que é apagado', () => {
  it('o registro clínico do profissional permanece: só perde o vínculo de login', () => {
    const atualizacoes = [...MUTACAO.matchAll(/UPDATE public\.[a-z_]+[\s\S]*?;/g)].map((m) => m[0]);
    expect(atualizacoes).toHaveLength(1);
    expect(atualizacoes[0]).toMatch(/UPDATE public\.pacientes\s+SET user_id = NULL\s+WHERE user_id = v_uid\s+AND terapeuta_id IS NOT NULL;/);
    expect(MUTACAO.slice(0, MUTACAO.indexOf(';') + 1)).toBe(atualizacoes[0]);
  });

  it('o único DELETE em pacientes é o do autocadastro SEM profissional, do próprio usuário', () => {
    const exclusoes = [...MUTACAO.matchAll(/DELETE FROM public\.pacientes[\s\S]*?;/g)].map((m) => m[0]);
    expect(exclusoes).toHaveLength(1);
    expect(exclusoes[0]).toMatch(/WHERE id = ANY \(v_autonomos\)\s+AND user_id = v_uid\s+AND terapeuta_id IS NULL;/);
    expect(MUTACAO).toMatch(/SELECT coalesce\(array_agg\(pa\.id\), ARRAY\[\]::uuid\[\]\)[\s\S]*?WHERE pa\.user_id = v_uid\s+AND pa\.terapeuta_id IS NULL;/);
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
    expect(MUTACAO.match(/EXECUTE/g)).toHaveLength(1);
    expect(MUTACAO).toMatch(/c\.relowner = v_dono/);
    expect(MUTACAO).toMatch(/cr\.relowner = v_dono/);
    expect(MUTACAO).toMatch(/SELECT c\.relowner INTO v_dono FROM pg_catalog\.pg_class c WHERE c\.oid = 'public\.pacientes'::regclass/);
    expect(MUTACAO).toContain("a.attname = 'paciente_id'");
    expect(MUTACAO).toMatch(/EXCEPTION WHEN foreign_key_violation THEN\s+v_pendente := true/);
    expect(MUTACAO).toMatch(/IF v_pendente THEN\s+RAISE EXCEPTION 'dependencia_nao_resolvida'/);
  });

  it('auth.users é o ÚLTIMO a ser apagado, uma vez, filtrado pelo usuário', () => {
    const apagadosEmAuth = MUTACAO.match(/DELETE FROM auth\.users[^;]*;/g) ?? [];
    expect(apagadosEmAuth).toEqual(['DELETE FROM auth.users WHERE id = v_uid;']);
    const posicaoAuth = MUTACAO.indexOf('DELETE FROM auth.users');
    const demais = [...MUTACAO.matchAll(/\b(DELETE FROM|UPDATE public|INSERT INTO|EXECUTE format)\b/g)].map((m) => m.index ?? -1);
    expect(demais.length).toBeGreaterThan(8);
    expect(Math.max(...demais.filter((i) => i !== posicaoAuth))).toBeLessThan(posicaoAuth);
    expect(MUTACAO.slice(posicaoAuth)).toMatch(/GET DIAGNOSTICS v_linhas = ROW_COUNT;\s+IF v_linhas <> 1 THEN\s+RAISE EXCEPTION 'usuario_nao_removido';\s+END IF;\s*$/);
  });

  it('a prova de exclusão é gravada antes de apagar o usuário', () => {
    ordem(MUTACAO, 'INSERT INTO public.exclusoes_conta_cliente', 'DELETE FROM auth.users');
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

  it('só devolve sucesso depois de tudo, com o contrato ok + pacientes_desvinculados', () => {
    expect(CORPO.trimEnd()).toMatch(/RETURN jsonb_build_object\('ok', true, 'pacientes_desvinculados', v_desvinculados\);\s+END;$/);
    expect(CORPO.lastIndexOf('RETURN')).toBeGreaterThan(FIM_DO_TRABALHO);
    expect(CORPO.match(/\bRETURN\b/g)).toHaveLength(1);
  });
});
