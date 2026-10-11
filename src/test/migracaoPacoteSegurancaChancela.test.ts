import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guarda o CONTRATO da migration 20261008100000 (verificação, áreas, configuração, prazo, cancelar).
// O comportamento em si foi validado num Postgres descartável; aqui ficam as regras que não podem
// regredir por descuido: nada de apagar dados, SECURITY DEFINER, permissões e a checagem de
// administrador dentro de cada RPC do super-admin.
const SQL = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261008100000_pacote_seguranca_chancela.sql'), 'utf8');

const FUNCOES = new Map<string, string>();
const DEFINICOES: { nome: string; corpo: string }[] = [];
for (const parte of SQL.split('CREATE OR REPLACE FUNCTION public.').slice(1)) {
  const nome = parte.slice(0, parte.indexOf('('));
  FUNCOES.set(nome, parte);
  DEFINICOES.push({ nome, corpo: parte });
}
const funcao = (nome: string) => {
  const corpo = FUNCOES.get(nome);
  if (!corpo) throw new Error(`função ${nome} não está na migration`);
  return corpo;
};
// definir_equipe_cientifica tem duas assinaturas: a nova (e-mail, ativo, áreas) e o atalho antigo (e-mail, valor).
const definirEquipe = (assinatura: 'nova' | 'antiga') => {
  const marca = assinatura === 'nova' ? '(p_email text, p_ativo boolean, p_areas text[]' : '(p_email text, p_valor boolean';
  const achada = DEFINICOES.find((d) => d.nome === 'definir_equipe_cientifica' && d.corpo.slice(d.nome.length).startsWith(marca));
  if (!achada) throw new Error(`definir_equipe_cientifica (${assinatura}) não está na migration`);
  return achada.corpo;
};

const RPCS_DO_CONTRATO = [
  'solicitar_verificacao',
  'verificar_profissional',
  'profissionais_admin',
  'definir_equipe_cientifica',
  'plano_cliente_config',
  'definir_config_plano_cliente',
  'cancelar_pedido_plano_cliente',
  'meu_status_plano_cliente',
  'fila_chancela',
  'chancelar_plano_cliente',
  'recusar_plano_cliente',
];
const RPCS_DO_ADMINISTRADOR = ['verificar_profissional', 'profissionais_admin', 'definir_config_plano_cliente'];
const SO_SERVIDOR = [
  'registrar_plano_cliente_chancela',
  'plano_cliente_estado_pedido',
  'plano_cliente_remetente_aviso',
  'profissional_verificado',
];
const AUXILIARES_INTERNAS = [
  'plano_cliente_cfg_bool',
  'plano_cliente_prazo_dias',
  'plano_cliente_atrasado',
  'plano_cliente_limite_pedidos_24h',
  'plano_cliente_pedidos_24h',
  'dias_uteis_entre',
  'plano_cliente_prazo_ate',
  'plano_cliente_eh_propria_conta',
  'plano_cliente_ha_outro_revisor',
  'plano_cliente_checa_conflito',
  'plano_cliente_motivo_bloqueio',
];

describe('migration do pacote de segurança da chancela', () => {
  it('não apaga tabelas, colunas nem dados', () => {
    expect(SQL).not.toMatch(/DROP\s+TABLE/i);
    expect(SQL).not.toMatch(/DROP\s+COLUMN/i);
    expect(SQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(SQL).not.toMatch(/DROP\s+SCHEMA/i);
  });

  it('o único DROP é a regra de status substituída (constraint); nenhuma função é apagada', () => {
    const drops = SQL.split('\n').filter((l) => /\bDROP\b/i.test(l) && !l.trim().startsWith('--')).map((l) => l.trim());
    expect(drops).toEqual(['ALTER TABLE public.plano_cliente_chancela DROP CONSTRAINT plano_cliente_chancela_status_check;']);
    expect(SQL).not.toMatch(/DROP\s+FUNCTION/i);
    // a regra nova entra antes da antiga sair
    expect(SQL.indexOf('plano_cliente_chancela_status_v2')).toBeLessThan(SQL.indexOf('DROP CONSTRAINT plano_cliente_chancela_status_check'));
  });

  it('é idempotente: colunas e tabelas com IF NOT EXISTS, linhas padrão sem sobrescrever', () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS registro_profissional text/);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS verificado boolean NOT NULL DEFAULT false/);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS verificado_em timestamptz/);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS verificado_por uuid/);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS equipe_areas text\[\] NOT NULL DEFAULT '\{\}'/);
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.plano_cliente_config/);
    expect(SQL).toMatch(/ON CONFLICT \(chave\) DO NOTHING/);
    expect(SQL).toMatch(/\('nutricao_premium_ativa', 'false'::jsonb\)/);
    expect(SQL).toMatch(/\('prazo_chancela_dias_uteis', '2'::jsonb\)/);
  });

  it('toda função é SECURITY DEFINER com search_path fixo (exceto as puras de data e os gatilhos de guarda)', () => {
    const semDefiner = [...FUNCOES.entries()].filter(([, corpo]) => !/SECURITY DEFINER/.test(corpo.split('$$')[0])).map(([nome]) => nome);
    expect(semDefiner.sort()).toEqual(['dias_uteis_entre', 'gov_publico', 'plano_cliente_chancela_guarda', 'plano_cliente_prazo_ate'].sort());
    for (const [nome, corpo] of FUNCOES) {
      expect(corpo.split('$$')[0], nome).toMatch(/SET search_path = public/);
    }
  });

  it('as RPCs do contrato existem, saem de public/anon e entram para authenticated', () => {
    for (const nome of RPCS_DO_CONTRATO) {
      funcao(nome);
      expect(SQL, nome).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${nome}\\([^)]*\\) FROM public, anon`));
      expect(SQL, nome).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${nome}\\([^)]*\\) TO authenticated`));
    }
  });

  it('as RPCs do administrador conferem eh_super_admin() DENTRO e usam a mensagem combinada', () => {
    for (const nome of RPCS_DO_ADMINISTRADOR) {
      const corpo = funcao(nome);
      expect(corpo, nome).toMatch(/IF NOT public\.eh_super_admin\(\) THEN\s+RAISE EXCEPTION 'Apenas o administrador MyHealthID'/);
    }
    // definir_equipe_cientifica também aceita o servidor (sem sessão), como antes
    expect(definirEquipe('nova')).toMatch(/auth\.uid\(\) IS NOT NULL AND NOT public\.eh_super_admin\(\)/);
    expect(definirEquipe('nova')).toMatch(/RAISE EXCEPTION 'Apenas o administrador MyHealthID'/);
  });

  it('a assinatura antiga de definir_equipe_cientifica vira atalho: delega à nova, sem ampliar permissão', () => {
    const antiga = definirEquipe('antiga');
    expect(antiga).toMatch(/RETURNS boolean/);
    expect(antiga).toMatch(/SECURITY DEFINER SET search_path = public/);
    expect(antiga).toMatch(/PERFORM public\.definir_equipe_cientifica\(p_email, coalesce\(p_valor, true\), v_areas\)/);
    expect(antiga).toMatch(/plano_cliente_perfil_ok\(a\.area, p\.perfil_profissional::text\)/);
    expect(antiga).not.toMatch(/UPDATE public\.profiles/);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.definir_equipe_cientifica\(text, boolean\) FROM public, anon;/);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.definir_equipe_cientifica\(text, boolean\) TO authenticated, service_role;/);
  });

  it('as funções só do servidor e as auxiliares não são executáveis por authenticated', () => {
    for (const nome of [...SO_SERVIDOR, ...AUXILIARES_INTERNAS]) {
      funcao(nome);
      expect(SQL, nome).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${nome}\\([^)]*\\) FROM public, anon, authenticated`));
      expect(SQL, nome).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${nome}\\([^)]*\\) TO[^;]*authenticated`));
    }
    for (const nome of SO_SERVIDOR) {
      expect(SQL, nome).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${nome}\\([^)]*\\) TO service_role`));
    }
  });

  it('a verificação e as áreas só mudam por super-admin ou servidor (gatilho do perfil)', () => {
    const gatilho = funcao('profiles_protege_verificacao');
    expect(gatilho).toMatch(/IF auth\.uid\(\) IS NULL OR public\.eh_super_admin\(\) THEN RETURN NEW; END IF;/);
    for (const campo of ['verificado', 'verificado_em', 'verificado_por', 'equipe_areas']) {
      expect(gatilho, campo).toMatch(new RegExp(`NEW\\.${campo} := OLD\\.${campo};`));
    }
    expect(SQL).toMatch(/CREATE OR REPLACE TRIGGER trg_profiles_protege_verificacao\s+BEFORE INSERT OR UPDATE ON public\.profiles/);
    // trocar registro ou profissão derruba a verificação e a vaga na equipe
    expect(gatilho).toMatch(/OLD\.verificado AND \(v_novo IS DISTINCT FROM v_antigo/);
    // a comparação é pelo registro aparado: só espaços diferentes não revogam
    expect(gatilho).toMatch(/v_antigo := nullif\(left\(btrim\(coalesce\(OLD\.registro_profissional/);
    expect(gatilho).toMatch(/NEW\.perfil_profissional IS DISTINCT FROM OLD\.perfil_profissional/);
    expect(gatilho).toMatch(/NEW\.equipe_cientifica := false;/);
  });

  it('solicitar_verificacao grava só o registro (3 a 40 caracteres) e não verifica', () => {
    const corpo = funcao('solicitar_verificacao');
    expect(corpo).toMatch(/length\(v\) < 3 OR length\(v\) > 40/);
    expect(corpo).toMatch(/UPDATE public\.profiles SET registro_profissional = v WHERE user_id = auth\.uid\(\)/);
    expect(corpo).not.toMatch(/verificado\s*=/);
  });

  it('chancelar exige verificação, área, perfil, nutrição ligada, conflito e revisão, com as dicas combinadas', () => {
    const motivo = funcao('plano_cliente_motivo_bloqueio');
    for (const dica of ['sem_permissao_area', 'nutricao_desligada', 'nao_verificado', 'conflito_interesse']) {
      expect(motivo, dica).toContain(`'${dica}'`);
    }
    expect(motivo).toMatch(/nutricao_premium_ativa/);
    expect(motivo).toMatch(/p_tipo = ANY \(coalesce\(v_prof\.equipe_areas/);
    expect(motivo).toMatch(/plano_cliente_perfil_ok\(p_tipo, v_prof\.perfil_profissional::text\)/);
    const chancelar = funcao('chancelar_plano_cliente');
    expect(chancelar).toMatch(/plano_cliente_motivo_bloqueio\(r\.tipo, r\.paciente_id\)/);
    expect(chancelar).toMatch(/HINT = 'revisao_obrigatoria'/);
    expect(chancelar).toMatch(/HINT = 'justificativa_obrigatoria'/);
    expect(chancelar).toMatch(/'sem_revisao', true, 'motivo_sem_revisao', v_just/);
    expect(chancelar).toMatch(/'autochancela', true/);
    // a exceção do super-admin: só enquanto não houver outro revisor verificado
    expect(motivo).toMatch(/AND NOT \(v_super AND NOT public\.plano_cliente_ha_outro_revisor\(\)\)/);
    expect(funcao('plano_cliente_ha_outro_revisor')).toMatch(/equipe_cientifica AND verificado/);
  });

  it('o selo público do cliente mostra a autochancela e continua sem justificativa nem revisão', () => {
    const publico = funcao('gov_publico');
    expect(publico).toMatch(/'autochancela', p_conteudo -> '_governanca' -> 'aprovacao' -> 'autochancela'/);
    expect(publico).not.toMatch(/justificativa|revisao_seguranca|sem_revisao|triagem/);
  });

  it('prazo em dias úteis do calendário de Brasília e status novo', () => {
    expect(funcao('dias_uteis_entre')).toMatch(/isodow FROM d\) < 6/);
    expect(funcao('dias_uteis_entre')).toMatch(/America\/Sao_Paulo/);
    expect(SQL).toMatch(/CHECK \(status IN \('aguardando', 'chancelado', 'recusado', 'substituido', 'cancelado'\)\)/);
    expect(funcao('fila_chancela')).toMatch(/'aguardando', 'chancelado', 'recusado', 'cancelado', 'substituido'/);
    for (const campo of ['dias_uteis_na_fila', 'atrasado', 'pode_chancelar', 'motivo_nao_pode']) {
      expect(funcao('fila_chancela'), campo).toContain(`'${campo}'`);
    }
    for (const campo of ['prazo_previsto', 'atrasado', 'pode_regenerar']) {
      expect(funcao('meu_status_plano_cliente'), campo).toContain(`'${campo}'`);
    }
    expect(funcao('registrar_plano_cliente_chancela')).toMatch(/NOT public\.plano_cliente_atrasado\(v_antigo\.gerado_em\)/);
  });

  it('as funções de data não são executáveis por usuário logado e têm limite (sem varredura de milhões de dias)', () => {
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.dias_uteis_entre\(timestamptz, timestamptz\) FROM public, anon, authenticated;/);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.plano_cliente_prazo_ate\(timestamptz, integer\) FROM public, anon, authenticated;/);
    expect(SQL).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.(dias_uteis_entre|plano_cliente_prazo_ate)[^;]*authenticated/);
    expect(funcao('dias_uteis_entre')).toMatch(/LEAST\(/);
    expect(funcao('dias_uteis_entre')).toMatch(/\+ 3650\)/);
    expect(funcao('plano_cliente_prazo_ate')).toMatch(/p_dias < 1 OR p_dias > 10 THEN NULL/);
  });

  it('quem estava na equipe sem verificação perde a vaga na migração (e fica no log), sem verificar ninguém', () => {
    const reconcilia = SQL.slice(SQL.indexOf('WITH revogados AS'), SQL.indexOf('WITH revogados AS') + 700);
    expect(reconcilia).toMatch(/UPDATE public\.profiles SET equipe_cientifica = false, equipe_areas = '\{\}'\s+WHERE equipe_cientifica AND NOT verificado/);
    expect(reconcilia).toMatch(/INSERT INTO public\.profissional_verificacao_log/);
    // roda depois de o administrador ser verificado e antes de ele receber a equipe e as áreas
    expect(SQL.indexOf('WITH revogados AS')).toBeGreaterThan(SQL.indexOf("'Conta do administrador verificada pela migração.'"));
    expect(SQL.indexOf('WITH revogados AS')).toBeLessThan(SQL.indexOf("SET equipe_cientifica = true, equipe_areas = ARRAY['treino', 'nutricao']"));
    // nenhum UPDATE de migração marca alguém como verificado, a não ser a conta do administrador
    const verificam = [...SQL.matchAll(/^UPDATE public\.profiles SET verificado = true[^;]*;/gm)].map((m) => m[0]);
    expect(verificam).toHaveLength(1);
    expect(verificam[0]).toMatch(/lower\(email\) = 'rafaelbmocbel@gmail\.com'/);
  });

  it('o aviso ao cliente sai SEMPRE pela conta da marca, nunca pelo profissional do cadastro do cliente', () => {
    const remetente = funcao('plano_cliente_remetente_aviso');
    expect(remetente).toMatch(/lower\(u\.email\) = 'rafaelbmocbel@gmail\.com'/);
    expect(remetente).not.toMatch(/terapeuta_id/);
    expect(remetente).toMatch(/EXISTS \(SELECT 1 FROM public\.pacientes p WHERE p\.id = p_paciente_id\)/);
  });

  it('uma única reserva/envio de aviso por plano decidido (índice único parcial em agente_disparos)', () => {
    expect(SQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS agente_disparos_aviso_plano_unico\s+ON public\.agente_disparos \(gatilho, ref_id\)\s+WHERE gatilho IN \('plano_chancelado', 'plano_recusado'\) AND status IN \('reservado', 'enviado'\)/);
  });

  it('revisão parcial (plano_truncado) vai para a fila e não vale como revisão completa ao chancelar', () => {
    expect(funcao('fila_chancela')).toMatch(/'plano_truncado', coalesce\(c\.conteudo #> '\{_governanca,revisao_seguranca,plano_truncado\}', 'false'::jsonb\)/);
    const chancelar = funcao('chancelar_plano_cliente');
    expect(chancelar).toMatch(/v_rev ->> 'plano_truncado' = 'true'/);
    expect(chancelar).toMatch(/'revisao_parcial', true/);
    expect(chancelar.slice(chancelar.indexOf("v_rev ->> 'plano_truncado'"))).toMatch(/HINT = 'revisao_obrigatoria'/);
    // o selo público nunca expõe a revisão parcial
    expect(funcao('gov_publico')).not.toMatch(/revisao_parcial|plano_truncado/);
  });

  it('nutrição desligada: o plano da equipe já chancelado também deixa de chegar ao cliente (o do profissional não)', () => {
    const liberado = funcao('meu_plano_liberado');
    const idxProfissional = liberado.indexOf("IF v_out IS NOT NULL THEN RETURN v_out; END IF;");
    const idxPortao = liberado.indexOf("IF p_tipo = 'nutricao' AND NOT public.plano_cliente_cfg_bool('nutricao_premium_ativa', false) THEN RETURN NULL; END IF;");
    expect(idxProfissional).toBeGreaterThan(-1);
    expect(idxPortao).toBeGreaterThan(idxProfissional);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.meu_plano_liberado\(text\) TO authenticated;/);
  });

  it('teto de pedidos por tipo em 24h: no banco (corrida) e para as edges decidirem antes da IA', () => {
    expect(funcao('plano_cliente_limite_pedidos_24h')).toMatch(/SELECT 3;/);
    expect(funcao('plano_cliente_pedidos_24h')).toMatch(/gerado_em > now\(\) - interval '24 hours'/);
    expect(funcao('plano_cliente_pedidos_24h')).not.toMatch(/status\s*(=|<>|IN)/);
    const registrar = funcao('registrar_plano_cliente_chancela');
    expect(registrar).toMatch(/plano_cliente_pedidos_24h\(p_paciente_id, p_tipo\) >= public\.plano_cliente_limite_pedidos_24h\(\)/);
    expect(registrar).toMatch(/HINT = 'limite_pedidos'/);
    // o pedido no prazo continua tendo precedência (409) sobre o teto
    expect(registrar.indexOf("HINT = 'plano_em_revisao'")).toBeLessThan(registrar.indexOf("HINT = 'limite_pedidos'"));
    const estado = funcao('plano_cliente_estado_pedido');
    expect(estado).toMatch(/RETURN 'limite'/);
    expect(estado.indexOf("RETURN 'no_prazo'")).toBeLessThan(estado.indexOf("RETURN 'limite'"));
  });

  it('verificar_profissional confere o registro que o administrador viu (p_registro_visto) e trava a linha', () => {
    const corpo = funcao('verificar_profissional');
    expect(corpo).toMatch(/p_registro_visto text DEFAULT NULL/);
    expect(corpo).toMatch(/HINT = 'registro_alterado'/);
    expect(corpo).toMatch(/FROM public\.profiles WHERE user_id = p_user_id FOR UPDATE/);
    expect(corpo).toMatch(/IF NOT public\.eh_super_admin\(\) THEN\s+RAISE EXCEPTION 'Apenas o administrador MyHealthID'/);
  });
});
