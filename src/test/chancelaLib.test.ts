import { describe, expect, it } from 'vitest';
import {
  ABAS_FILA, CONFIG_PLANO_CLIENTE_PADRAO, NOTA_PUBLICA_MAX_CARACTERES, NOTA_PUBLICA_MIN_CARACTERES, areasDoPerfil,
  avisoNaoPodeChancelar, avisoSemPerfil, codigoErroChancela, contarProfissionaisAdmin, descricaoPaciente, erroRegistroAlterado,
  exigeJustificativa, existeNutricionistaNaEquipe, filtrarProfissionaisAdmin, insumosDoPlano, lerConfigPlanoCliente, lerFila, lerItemFila,
  lerMinhaVerificacao, lerProfissionaisAdmin, mensagemErroAdmin, mensagemErroChancela, motivoCurtoNaoPode, ordenarFila,
  ordenarProfissionaisAdmin, perfilHabilitaArea, podeChancelarItem, rotuloChancelado, rotuloDiasUteis, rotuloDiasUteisNaFila,
  rotuloInsumo, rotuloPerfil, situacaoRevisao, situacaoVerificacao, tituloItem, validarChancela, validarPrazoChancela,
  validarRecusa, validarRegistroProfissional,
  type ItemFilaChancela, type ProfissionalAdmin, type SituacaoRevisao,
} from '@/lib/chancela';
import { lerGovernanca } from '@/lib/governanca';

function bruto(extra: Record<string, unknown> = {}) {
  return {
    id: 'ch-1', tipo: 'treino', titulo: 'Treino A', status: 'aguardando', gerado_em: '2026-10-07T12:00:00Z',
    paciente_primeiro_nome: 'Maria', idade: 34, objetivo: 'Força',
    conteudo: { fases: [] }, revisao_seguranca: null, hash_atual: 'h1',
    ...extra,
  };
}

function item(extra: Record<string, unknown> = {}): ItemFilaChancela {
  const i = lerItemFila(bruto(extra));
  if (!i) throw new Error('item inválido no teste');
  return i;
}

const revisaoValida = (risco: 'baixo' | 'medio' | 'alto', n = 0): SituacaoRevisao => ({ estado: 'valida', risco, nFlagsAltas: n });
const SEM_REVISAO: SituacaoRevisao = { estado: 'ausente', risco: null, nFlagsAltas: 0 };

describe('lerFila', () => {
  it('lê os campos da fila e usa só o primeiro nome e a idade', () => {
    const [i] = lerFila([bruto()]);
    expect(i).toMatchObject({
      id: 'ch-1', tipo: 'treino', titulo: 'Treino A', pacientePrimeiroNome: 'Maria', idade: 34, objetivo: 'Força', hashAtual: 'h1',
    });
    expect(descricaoPaciente(i)).toBe('Maria, 34 anos');
  });

  it('descarta itens sem id ou com tipo desconhecido e tolera entrada que não é lista', () => {
    expect(lerFila([bruto({ id: '' }), bruto({ tipo: 'fisioterapia' }), null, 'x', bruto({ id: 'ok' })]).map((i) => i.id)).toEqual(['ok']);
    expect(lerFila(null)).toEqual([]);
    expect(lerFila({ id: 'x' })).toEqual([]);
  });

  it('idade ausente vira null e o título cai no nome do tipo', () => {
    const i = item({ idade: null, titulo: null });
    expect(descricaoPaciente(i)).toBe('Maria');
    expect(tituloItem(i)).toBe('Plano de treino');
    expect(tituloItem(item({ tipo: 'nutricao', titulo: null }))).toBe('Plano alimentar');
  });

  it('lê o resumo da revisão e ignora risco inválido', () => {
    expect(item({ revisao_seguranca: { risco_geral: 'alto', n_flags_altas: 2 } }).revisao).toEqual({ risco_geral: 'alto', n_flags_altas: 2, planoTruncado: false });
    expect(item({ revisao_seguranca: { risco_geral: 'baixo', n_flags_altas: 0, plano_truncado: true } }).revisao).toEqual({ risco_geral: 'baixo', n_flags_altas: 0, planoTruncado: true });
    expect(item({ revisao_seguranca: { risco_geral: 'enorme' } }).revisao).toBeNull();
  });
});

describe('situacaoRevisao', () => {
  const comRevisao = (hashRevisao: string | null, hashAtual: string | null, risco = 'baixo') => item({
    hash_atual: hashAtual,
    revisao_seguranca: { risco_geral: risco, n_flags_altas: risco === 'alto' ? 1 : 0 },
    conteudo: { _governanca: { revisao_seguranca: { risco_geral: risco, flags: [], ...(hashRevisao ? { hash: hashRevisao } : {}) } } },
  });

  it('sem revisão nenhuma: ausente', () => {
    expect(situacaoRevisao(item())).toEqual({ estado: 'ausente', risco: null, nFlagsAltas: 0 });
  });

  it('hash da revisão igual ao do conteúdo atual: válida', () => {
    expect(situacaoRevisao(comRevisao('h1', 'h1', 'alto'))).toMatchObject({ estado: 'valida', risco: 'alto' });
  });

  it('hash diferente (plano editado depois) ou impossível de provar: desatualizada, nunca válida', () => {
    expect(situacaoRevisao(comRevisao('h0', 'h1')).estado).toBe('desatualizada');
    expect(situacaoRevisao(comRevisao(null, 'h1')).estado).toBe('desatualizada');
    expect(situacaoRevisao(comRevisao('h1', null)).estado).toBe('desatualizada');
  });

  it('só o resumo da fila, sem a revisão no conteúdo: desatualizada', () => {
    expect(situacaoRevisao(item({ revisao_seguranca: { risco_geral: 'baixo', n_flags_altas: 0 } })).estado).toBe('desatualizada');
  });

  it('revisão parcial (plano longo): válida para esta versão, mas marcada como parcial', () => {
    const parcial = item({
      hash_atual: 'h1',
      revisao_seguranca: { risco_geral: 'baixo', n_flags_altas: 0, plano_truncado: true },
      conteudo: { _governanca: { revisao_seguranca: { risco_geral: 'baixo', flags: [], hash: 'h1', plano_truncado: true } } },
    });
    expect(situacaoRevisao(parcial)).toEqual({ estado: 'valida', risco: 'baixo', nFlagsAltas: 0, parcial: true });
    expect(situacaoRevisao(comRevisao('h1', 'h1')).parcial).toBeUndefined();
  });

  it('revisão parcial de versão anterior continua só "desatualizada" (não ganha o aviso de parcial)', () => {
    const velha = item({
      hash_atual: 'h2',
      revisao_seguranca: { risco_geral: 'baixo', n_flags_altas: 0, plano_truncado: true },
      conteudo: { _governanca: { revisao_seguranca: { risco_geral: 'baixo', flags: [], hash: 'h1', plano_truncado: true } } },
    });
    expect(situacaoRevisao(velha)).toMatchObject({ estado: 'desatualizada' });
    expect(situacaoRevisao(velha).parcial).toBeUndefined();
  });
});

describe('validarChancela', () => {
  const base = { pode: true, revisao: revisaoValida('baixo'), justificativa: '', notaPublica: '' };

  it('revisão válida de risco baixo ou médio chancela sem justificativa', () => {
    expect(validarChancela(base)).toEqual({ ok: true });
    expect(validarChancela({ ...base, revisao: revisaoValida('medio', 0) })).toEqual({ ok: true });
  });

  it('sem o perfil exigido nunca chancela', () => {
    const r = validarChancela({ ...base, pode: false });
    expect(r).toMatchObject({ ok: false, motivo: 'sem_perfil' });
  });

  it('enquanto a revisão automática roda o botão não libera', () => {
    expect(validarChancela({ ...base, revisao: SEM_REVISAO, revisando: true })).toMatchObject({ ok: false, motivo: 'revisando' });
  });

  it('risco alto numa revisão válida exige justificativa de 15 caracteres', () => {
    const alto = { ...base, revisao: revisaoValida('alto', 1) };
    expect(validarChancela(alto)).toMatchObject({ ok: false, motivo: 'justificativa' });
    expect(validarChancela({ ...alto, justificativa: 'curta demais' })).toMatchObject({ ok: false, motivo: 'justificativa' });
    expect(validarChancela({ ...alto, justificativa: '  ' + 'a'.repeat(15) + '  ' })).toEqual({ ok: true });
  });

  it('o banco pode exigir a justificativa mesmo sem risco alto no front', () => {
    expect(exigeJustificativa(revisaoValida('baixo'), true)).toBe(true);
    expect(validarChancela({ ...base, exigidaPeloBanco: true })).toMatchObject({ ok: false, motivo: 'justificativa' });
  });

  it('sem revisão válida desta versão (IA fora do ar) só chancela com o motivo escrito, 15 caracteres ou mais', () => {
    const sem = { ...base, revisao: SEM_REVISAO };
    expect(validarChancela(sem)).toMatchObject({ ok: false, motivo: 'sem_revisao' });
    expect(validarChancela({ ...sem, justificativa: 'IA fora do ar' })).toMatchObject({ ok: false, motivo: 'sem_revisao' });
    expect(validarChancela({ ...sem, justificativa: 'A IA ficou fora do ar; li o plano inteiro.' })).toEqual({ ok: true });
  });

  it('revisão de versão anterior não vale: exige o mesmo motivo escrito, com qualquer risco', () => {
    expect(exigeJustificativa({ estado: 'desatualizada', risco: 'baixo', nFlagsAltas: 0 })).toBe(true);
    expect(exigeJustificativa({ estado: 'desatualizada', risco: 'alto', nFlagsAltas: 1 })).toBe(true);
    expect(exigeJustificativa(SEM_REVISAO)).toBe(true);
    expect(exigeJustificativa(revisaoValida('baixo'))).toBe(false);
  });

  it('revisão PARCIAL (a IA leu só o início do plano) não vale como completa: exige a justificativa', () => {
    const parcial: SituacaoRevisao = { estado: 'valida', risco: 'baixo', nFlagsAltas: 0, parcial: true };
    expect(exigeJustificativa(parcial)).toBe(true);
    expect(exigeJustificativa({ ...parcial, parcial: false })).toBe(false);
    const r = validarChancela({ ...base, revisao: parcial });
    expect(r).toMatchObject({ ok: false, motivo: 'revisao_parcial' });
    expect(r.erro).toMatch(/parcial.*só o início/);
    expect(validarChancela({ ...base, revisao: parcial, justificativa: 'curta' })).toMatchObject({ ok: false, motivo: 'revisao_parcial' });
    expect(validarChancela({ ...base, revisao: parcial, justificativa: 'Conferi o restante do plano manualmente.' })).toEqual({ ok: true });
  });

  it('recado ao cliente tem limite', () => {
    expect(validarChancela({ ...base, notaPublica: 'x'.repeat(NOTA_PUBLICA_MAX_CARACTERES + 1) })).toMatchObject({ ok: false, motivo: 'nota_publica' });
  });
});

describe('validarRecusa', () => {
  it('exige mensagem ao cliente dentro dos limites', () => {
    expect(validarRecusa('')).toMatchObject({ ok: false });
    expect(validarRecusa('x'.repeat(NOTA_PUBLICA_MIN_CARACTERES - 1))).toMatchObject({ ok: false });
    expect(validarRecusa('x'.repeat(NOTA_PUBLICA_MAX_CARACTERES + 1))).toMatchObject({ ok: false });
    expect(validarRecusa('Procure um profissional para ajustar o plano.')).toEqual({ ok: true });
  });

  it('limita a nota interna', () => {
    expect(validarRecusa('Procure um profissional.', 'y'.repeat(1001))).toMatchObject({ ok: false });
  });
});

describe('mensagemErroChancela', () => {
  it('justificativa obrigatória do banco (mensagem antiga, sem HINT) pede a justificativa', () => {
    expect(mensagemErroChancela(new Error('Justificativa obrigatória para liberar plano de risco alto'))).toMatchObject({
      exigeJustificativa: true, codigo: 'justificativa_obrigatoria',
    });
  });

  it('função ausente avisa que a atualização do banco está pendente', () => {
    expect(mensagemErroChancela({ message: 'Could not find the function public.fila_chancela in the schema cache' }).mensagem).toMatch(/pendente/);
  });

  it('chancela negada mostra o motivo sem o prefixo técnico', () => {
    expect(mensagemErroChancela(new Error('chancela_negada: só nutricionista chancela nutrição')).mensagem).toBe('só nutricionista chancela nutrição');
  });

  it('permissão negada e erro desconhecido', () => {
    expect(mensagemErroChancela(new Error('permission denied for table x')).mensagem).toMatch(/permissão/);
    expect(mensagemErroChancela(new Error('algo estranho')).mensagem).toBe('algo estranho');
    expect(mensagemErroChancela(undefined).mensagem).toMatch(/Tente de novo/);
  });

  it.each([
    ['revisao_obrigatoria', /revisão de segurança desta versão/],
    ['justificativa_obrigatoria', /justificativa é obrigatória/],
    ['sem_permissao_area', /não tem permissão para chancelar planos desta área/],
    ['nao_verificado', /ainda não foi verificado pela equipe MyHealthID/],
    ['nutricao_desligada', /nutricional Premium está desligado/],
    ['conflito_interesse', /própria conta/],
  ])('o HINT %s vira uma mensagem clara em português', (hint, esperado) => {
    const lido = mensagemErroChancela({ message: 'texto técnico qualquer do banco', hint });
    expect(lido.codigo).toBe(hint);
    expect(lido.mensagem).toMatch(esperado);
    expect(lido.mensagem).not.toMatch(/texto técnico/);
  });

  it('só revisao_obrigatoria manda refazer a revisão e só justificativa_obrigatoria exige o texto', () => {
    expect(mensagemErroChancela({ message: 'x', hint: 'revisao_obrigatoria' })).toMatchObject({ exigeRevisao: true, exigeJustificativa: false });
    expect(mensagemErroChancela({ message: 'x', hint: 'justificativa_obrigatoria' })).toMatchObject({ exigeRevisao: false, exigeJustificativa: true });
    expect(mensagemErroChancela({ message: 'x', hint: 'nao_verificado' })).toMatchObject({ exigeRevisao: false, exigeJustificativa: false });
  });

  it('revisao_obrigatoria por revisão PARCIAL pede a justificativa (refazer a revisão não adiantaria)', () => {
    const lido = mensagemErroChancela({
      message: 'Revisão de segurança parcial: o plano é longo e a IA avaliou só o início. Confira o restante e registre uma justificativa de pelo menos 15 caracteres.',
      hint: 'revisao_obrigatoria',
    });
    expect(lido).toMatchObject({ codigo: 'revisao_obrigatoria', exigeJustificativa: true, exigeRevisao: false });
    expect(lido.mensagem).toMatch(/parcial.*avaliou só o início/);
  });

  it('o código também é achado na mensagem quando o HINT não vem', () => {
    expect(codigoErroChancela(new Error('conflito_interesse: não chancele o seu próprio plano'))).toBe('conflito_interesse');
    expect(codigoErroChancela({ message: 'x', hint: '  NAO_VERIFICADO ' })).toBe('nao_verificado');
    expect(codigoErroChancela(new Error('outro erro'))).toBeNull();
    expect(codigoErroChancela(null)).toBeNull();
  });
});

describe('textos', () => {
  it('avisoSemPerfil nomeia a área e quem pode', () => {
    expect(avisoSemPerfil('nutricao', 'Nutricionista')).toContain('Você não tem o perfil para chancelar nutrição');
    expect(avisoSemPerfil('treino', 'Educador Físico ou Fisioterapeuta')).toContain('Você não tem o perfil para chancelar treino');
  });

  it('rotuloPerfil', () => {
    expect(rotuloPerfil('educador_fisico')).toBe('Educador Físico');
    expect(rotuloPerfil('perfil_novo')).toBe('perfil novo');
    expect(rotuloPerfil(null)).toBe('');
  });

  it('rotuloChancelado usa o registro do banco (revisor_* ou aprovacao)', () => {
    const doBanco = item({
      status: 'chancelado', revisor_nome: 'Ana Souza', revisor_perfil: 'nutricionista', revisado_em: '2026-10-08T15:00:00Z',
      conteudo: { _governanca: { aprovacao: { versao: 2 } } },
    });
    expect(rotuloChancelado(doBanco)).toBe('Chancelado por Ana Souza, Nutricionista · 08/10/2026 · v2');

    const soAprovacao = item({
      status: 'chancelado',
      conteudo: { _governanca: { aprovacao: { por_nome: 'Caio', por_perfil: 'educador_fisico', em: '2026-10-08T15:00:00Z', versao: 1 } } },
    });
    expect(rotuloChancelado(soAprovacao)).toBe('Chancelado por Caio, Educador Físico · 08/10/2026 · v1');
    expect(rotuloChancelado(item({ status: 'chancelado' }))).toBe('Chancelado');
  });

  it('rotuloChancelado marca autochancela e revisão parcial (só para a equipe)', () => {
    const marcado = item({
      status: 'chancelado', revisor_nome: 'Rafael', revisor_perfil: 'super_admin', revisado_em: '2026-10-08T15:00:00Z',
      conteudo: { _governanca: { aprovacao: { versao: 1, autochancela: true, revisao_parcial: true } } },
    });
    expect(rotuloChancelado(marcado)).toBe('Chancelado por Rafael, Administrador(a) · 08/10/2026 · v1 · autochancela · revisão de segurança parcial');
  });

  it('insumos legíveis, com fallback para ids desconhecidos', () => {
    expect(rotuloInsumo('myid')).toBe('MyID');
    expect(rotuloInsumo('historico_clinico')).toBe('Histórico clínico');
    expect(rotuloInsumo('fonte_nova')).toBe('Fonte nova');
    const gov = lerGovernanca({ _governanca: { fonte: { tipo: 'ia', insumos: ['myid', 'anamnese_nutricional'] } } });
    expect(insumosDoPlano(gov)).toEqual(['MyID', 'Anamnese nutricional']);
    expect(insumosDoPlano(null)).toEqual([]);
  });
});

describe('ordenarFila', () => {
  const a = item({ id: 'a', gerado_em: '2026-10-01T00:00:00Z', revisado_em: '2026-10-05T00:00:00Z' });
  const b = item({ id: 'b', gerado_em: '2026-10-03T00:00:00Z', revisado_em: '2026-10-04T00:00:00Z' });
  const c = item({ id: 'c', gerado_em: '2026-10-02T00:00:00Z', revisado_em: null });

  it('pendentes: o mais antigo primeiro', () => {
    expect(ordenarFila([b, c, a], 'aguardando').map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('histórico: o mais recente primeiro', () => {
    expect(ordenarFila([a, b, c], 'chancelado').map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('pendentes: os atrasados vêm primeiro, cada grupo do mais antigo ao mais novo', () => {
    const atrasadoNovo = item({ id: 'x', gerado_em: '2026-10-05T00:00:00Z', atrasado: true });
    const atrasadoVelho = item({ id: 'y', gerado_em: '2026-10-04T00:00:00Z', atrasado: true });
    expect(ordenarFila([b, c, a, atrasadoNovo, atrasadoVelho], 'aguardando').map((i) => i.id)).toEqual(['y', 'x', 'a', 'c', 'b']);
  });

  it('o histórico ignora o atraso', () => {
    const atrasado = item({ id: 'z', gerado_em: '2026-09-01T00:00:00Z', revisado_em: '2026-09-02T00:00:00Z', atrasado: true });
    expect(ordenarFila([atrasado, a], 'chancelado').map((i) => i.id)).toEqual(['a', 'z']);
  });

  it('não muda a lista original', () => {
    const original = [b, a];
    ordenarFila(original, 'aguardando');
    expect(original.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('fila: prazo, atraso e permissão por item', () => {
  it('lê dias úteis na fila, atrasado, pode_chancelar e o motivo', () => {
    const i = item({ dias_uteis_na_fila: 3, atrasado: true, pode_chancelar: false, motivo_nao_pode: 'Área de nutrição não liberada para você.' });
    expect(i).toMatchObject({
      diasUteisNaFila: 3, atrasado: true, podeChancelar: false, motivoNaoPode: 'Área de nutrição não liberada para você.',
    });
  });

  it('banco antigo (sem os campos novos): sem atraso e sem veredito de permissão', () => {
    expect(item()).toMatchObject({ diasUteisNaFila: null, atrasado: false, podeChancelar: null, motivoNaoPode: null });
  });

  it('atrasado só vale com true de verdade', () => {
    expect(item({ atrasado: 'true' }).atrasado).toBe(false);
    expect(item({ atrasado: 1 }).atrasado).toBe(false);
  });

  it('rotuloDiasUteisNaFila', () => {
    expect(rotuloDiasUteisNaFila(0)).toBe('chegou hoje');
    expect(rotuloDiasUteisNaFila(1)).toBe('1 dia útil na fila');
    expect(rotuloDiasUteisNaFila(4)).toBe('4 dias úteis na fila');
    expect(rotuloDiasUteisNaFila(null)).toBeNull();
    expect(rotuloDiasUteisNaFila(-1)).toBeNull();
    expect(rotuloDiasUteis(1)).toBe('1 dia útil');
    expect(rotuloDiasUteis(2)).toBe('2 dias úteis');
  });

  it('o veredito do banco manda; sem ele vale o perfil gravado', () => {
    expect(podeChancelarItem(item({ pode_chancelar: false }), true)).toBe(false);
    expect(podeChancelarItem(item({ pode_chancelar: true }), false)).toBe(true);
    expect(podeChancelarItem(item(), true)).toBe(true);
    expect(podeChancelarItem(item(), false)).toBe(false);
  });

  it('o motivo do banco aparece no aviso; sem ele, o aviso padrão por perfil', () => {
    const comMotivo = item({ pode_chancelar: false, motivo_nao_pode: 'Seu perfil ainda não foi verificado.' });
    expect(avisoNaoPodeChancelar(comMotivo, 'Nutricionista')).toBe('Você não pode chancelar este plano: Seu perfil ainda não foi verificado.');
    expect(motivoCurtoNaoPode(comMotivo)).toBe('Seu perfil ainda não foi verificado.');
    const semMotivo = item({ tipo: 'nutricao', pode_chancelar: false });
    expect(avisoNaoPodeChancelar(semMotivo, 'Nutricionista')).toContain('Você não tem o perfil para chancelar nutrição');
    expect(motivoCurtoNaoPode(semMotivo)).toContain('nutrição');
  });

  it('as abas cobrem todos os status que a fila aceita', () => {
    expect(ABAS_FILA.map((a) => a.id)).toEqual(['aguardando', 'chancelado', 'recusado', 'cancelado', 'substituido']);
  });

  it('rotuloChancelado marca autochancela e chancela sem revisão', () => {
    const base = {
      status: 'chancelado', revisor_nome: 'Rafael', revisor_perfil: 'super_admin', revisado_em: '2026-10-08T15:00:00Z',
    };
    const auto = item({ ...base, conteudo: { _governanca: { aprovacao: { versao: 1, autochancela: true } } } });
    expect(rotuloChancelado(auto)).toBe('Chancelado por Rafael, Administrador(a) · 08/10/2026 · v1 · autochancela');
    const semRev = item({ ...base, conteudo: { _governanca: { aprovacao: { versao: 2, sem_revisao: true, motivo_sem_revisao: 'IA fora do ar' } } } });
    expect(rotuloChancelado(semRev)).toBe('Chancelado por Rafael, Administrador(a) · 08/10/2026 · v2 · sem revisão de segurança');
  });
});

function profissional(extra: Record<string, unknown> = {}) {
  return {
    user_id: 'u-1', nome: 'Ana', sobrenome: 'Souza', email: 'ana@exemplo.com', perfil_profissional: 'nutricionista',
    registro_profissional: 'CRN 12345', verificado: false, verificado_em: null, equipe_cientifica: false,
    equipe_areas: [], created_at: '2026-09-01T00:00:00Z',
    ...extra,
  };
}

function admin(extra: Record<string, unknown> = {}): ProfissionalAdmin {
  const [p] = lerProfissionaisAdmin([profissional(extra)]);
  return p;
}

describe('administração: leitura e filtros', () => {
  it('lê o profissional e junta nome e sobrenome', () => {
    expect(admin()).toEqual({
      userId: 'u-1', nome: 'Ana Souza', email: 'ana@exemplo.com', perfil: 'nutricionista', registro: 'CRN 12345',
      verificado: false, verificadoEm: null, equipeCientifica: false, equipeAreas: [], criadoEm: '2026-09-01T00:00:00Z',
    });
  });

  it('só valores exatos viram verificado e equipe; áreas desconhecidas somem', () => {
    const p = admin({ verificado: 'true', equipe_cientifica: 1, equipe_areas: ['treino', 'fisioterapia', 'nutricao', 7] });
    expect(p.verificado).toBe(false);
    expect(p.equipeCientifica).toBe(false);
    expect(p.equipeAreas).toEqual(['treino', 'nutricao']);
  });

  it('descarta linhas sem user_id e tolera resposta que não é lista', () => {
    expect(lerProfissionaisAdmin([profissional({ user_id: '' }), null, 'x', profissional({ user_id: 'ok' })]).map((p) => p.userId)).toEqual(['ok']);
    expect(lerProfissionaisAdmin(null)).toEqual([]);
    expect(lerProfissionaisAdmin({ user_id: 'x' })).toEqual([]);
  });

  it('sem nome usa o e-mail', () => {
    expect(admin({ nome: null, sobrenome: null }).nome).toBe('ana@exemplo.com');
    expect(admin({ nome: null, sobrenome: null, email: null }).nome).toBe('Sem nome');
  });

  it('quem aguarda decisão (registro informado, sem verificação) vem primeiro; depois os verificados', () => {
    const lista = lerProfissionaisAdmin([
      profissional({ user_id: 'v', nome: 'Zeca', verificado: true }),
      profissional({ user_id: 'n', nome: 'Bia', registro_profissional: null }),
      profissional({ user_id: 'p2', nome: 'Caio' }),
      profissional({ user_id: 'p1', nome: 'Abel' }),
    ]);
    expect(ordenarProfissionaisAdmin(lista).map((p) => p.userId)).toEqual(['p1', 'p2', 'v', 'n']);
  });

  it('filtros e contagem', () => {
    const lista = lerProfissionaisAdmin([
      profissional({ user_id: 'p' }),
      profissional({ user_id: 'v', verificado: true }),
      profissional({ user_id: 'e', verificado: true, equipe_cientifica: true, equipe_areas: ['nutricao'] }),
      profissional({ user_id: 's', registro_profissional: null }),
    ]);
    expect(contarProfissionaisAdmin(lista)).toEqual({ todos: 4, pendentes: 1, verificados: 2, equipe: 1 });
    expect(filtrarProfissionaisAdmin(lista, 'pendentes').map((p) => p.userId)).toEqual(['p']);
    expect(filtrarProfissionaisAdmin(lista, 'verificados').map((p) => p.userId).sort()).toEqual(['e', 'v']);
    expect(filtrarProfissionaisAdmin(lista, 'equipe').map((p) => p.userId)).toEqual(['e']);
    expect(filtrarProfissionaisAdmin(lista, 'todos')).toHaveLength(4);
  });

  it('a busca ignora acento e maiúsculas e olha nome, e-mail, registro e perfil', () => {
    const lista = lerProfissionaisAdmin([
      profissional({ user_id: 'a', nome: 'João', sobrenome: 'Álvares', email: 'joao@x.com', registro_profissional: 'CREF 999', perfil_profissional: 'educador_fisico' }),
      profissional({ user_id: 'b', nome: 'Maria', email: 'maria@x.com' }),
    ]);
    expect(filtrarProfissionaisAdmin(lista, 'todos', 'alvares').map((p) => p.userId)).toEqual(['a']);
    expect(filtrarProfissionaisAdmin(lista, 'todos', 'MARIA@X').map((p) => p.userId)).toEqual(['b']);
    expect(filtrarProfissionaisAdmin(lista, 'todos', 'cref 999').map((p) => p.userId)).toEqual(['a']);
    expect(filtrarProfissionaisAdmin(lista, 'todos', 'educador').map((p) => p.userId)).toEqual(['a']);
    expect(filtrarProfissionaisAdmin(lista, 'todos', 'nada disso')).toEqual([]);
  });

  it('perfil x área: treino = Educador Físico ou Fisioterapeuta; nutrição = Nutricionista', () => {
    expect(perfilHabilitaArea('treino', 'educador_fisico')).toBe(true);
    expect(perfilHabilitaArea('treino', 'fisioterapeuta')).toBe(true);
    expect(perfilHabilitaArea('treino', 'nutricionista')).toBe(false);
    expect(perfilHabilitaArea('nutricao', 'nutricionista')).toBe(true);
    expect(perfilHabilitaArea('nutricao', 'medico')).toBe(false);
    expect(perfilHabilitaArea('treino', null)).toBe(false);
    expect(areasDoPerfil('fisioterapeuta')).toEqual(['treino']);
    expect(areasDoPerfil('nutricionista')).toEqual(['nutricao']);
    expect(areasDoPerfil('medico')).toEqual([]);
  });

  it('só conta nutricionista que chancela de verdade: equipe, verificado, área marcada e perfil certo', () => {
    const ok = { perfil_profissional: 'nutricionista', verificado: true, equipe_cientifica: true, equipe_areas: ['nutricao'] };
    expect(existeNutricionistaNaEquipe(lerProfissionaisAdmin([profissional(ok)]))).toBe(true);
    expect(existeNutricionistaNaEquipe(lerProfissionaisAdmin([profissional({ ...ok, verificado: false })]))).toBe(false);
    expect(existeNutricionistaNaEquipe(lerProfissionaisAdmin([profissional({ ...ok, equipe_areas: ['treino'] })]))).toBe(false);
    expect(existeNutricionistaNaEquipe(lerProfissionaisAdmin([profissional({ ...ok, perfil_profissional: 'fisioterapeuta' })]))).toBe(false);
    expect(existeNutricionistaNaEquipe([])).toBe(false);
  });

  it('mensagemErroAdmin', () => {
    expect(mensagemErroAdmin(new Error('Apenas o administrador MyHealthID'))).toMatch(/Apenas o administrador MyHealthID pode/);
    expect(mensagemErroAdmin({ message: 'Could not find the function public.profissionais_admin in the schema cache' })).toMatch(/pendente/);
    expect(mensagemErroAdmin(new Error('permission denied'))).toMatch(/permissão/);
    expect(mensagemErroAdmin(new Error('o alvo precisa estar verificado'))).toBe('o alvo precisa estar verificado');
    expect(mensagemErroAdmin(undefined)).toMatch(/Tente de novo/);
  });
});

describe('registro no conselho e verificação do próprio profissional', () => {
  it('registro: 3 a 40 caracteres, aparado e com espaços únicos', () => {
    expect(validarRegistroProfissional('')).toMatchObject({ ok: false });
    expect(validarRegistroProfissional('  ab  ')).toMatchObject({ ok: false });
    expect(validarRegistroProfissional('x'.repeat(41))).toMatchObject({ ok: false });
    expect(validarRegistroProfissional('  CREFITO-3   123456-F ')).toEqual({ ok: true, valor: 'CREFITO-3 123456-F' });
    expect(validarRegistroProfissional('x'.repeat(40))).toMatchObject({ ok: true });
    expect(validarRegistroProfissional('abc')).toMatchObject({ ok: true });
  });

  it('situação: verificado, aguardando (registro informado) ou sem registro', () => {
    expect(situacaoVerificacao(lerMinhaVerificacao({ registro_profissional: 'CRN 1', verificado: true, verificado_em: '2026-10-08T10:00:00Z' }))).toBe('verificado');
    expect(situacaoVerificacao(lerMinhaVerificacao({ registro_profissional: 'CRN 1', verificado: false }))).toBe('aguardando');
    expect(situacaoVerificacao(lerMinhaVerificacao({ registro_profissional: null, verificado: false }))).toBe('sem_registro');
    expect(situacaoVerificacao(lerMinhaVerificacao(null))).toBe('sem_registro');
    expect(situacaoVerificacao(lerMinhaVerificacao({ registro_profissional: 'CRN 1', verificado: 'true' }))).toBe('aguardando');
  });

  it('o CREFITO que o profissional já tem no perfil vem só como sugestão (não conta como registro enviado)', () => {
    const lido = lerMinhaVerificacao({ registro_profissional: null, verificado: false, crefito: '  CREFITO-3 12345-F ' });
    expect(lido.registroDoPerfil).toBe('CREFITO-3 12345-F');
    expect(lido.registro).toBeNull();
    expect(situacaoVerificacao(lido)).toBe('sem_registro');
    expect(lerMinhaVerificacao({ crefito: '   ' }).registroDoPerfil).toBeNull();
    expect(lerMinhaVerificacao(null).registroDoPerfil).toBeNull();
  });

  it('registro_alterado (o registro mudou depois da conferência) é reconhecido pelo HINT ou pelo texto', () => {
    expect(erroRegistroAlterado({ message: 'x', hint: 'registro_alterado' })).toBe(true);
    expect(erroRegistroAlterado(new Error('O registro profissional mudou desde que você abriu o cartão: recarregue a lista'))).toBe(true);
    expect(erroRegistroAlterado(new Error('Apenas o administrador MyHealthID'))).toBe(false);
    expect(erroRegistroAlterado(null)).toBe(false);
    expect(mensagemErroAdmin({ message: 'x', hint: 'registro_alterado' })).toMatch(/registro do profissional mudou.*lista foi atualizada/);
  });
});

describe('configuração do plano do cliente', () => {
  it('lê os dois valores', () => {
    expect(lerConfigPlanoCliente({ nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 5 })).toEqual({
      nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 5,
    });
  });

  it('padrão seguro: nutrição desligada e prazo de 2 dias úteis', () => {
    expect(CONFIG_PLANO_CLIENTE_PADRAO).toEqual({ nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 });
    expect(lerConfigPlanoCliente(null)).toEqual(CONFIG_PLANO_CLIENTE_PADRAO);
    expect(lerConfigPlanoCliente({})).toEqual(CONFIG_PLANO_CLIENTE_PADRAO);
  });

  it('só true de verdade liga a nutrição; prazo inválido cai no padrão', () => {
    expect(lerConfigPlanoCliente({ nutricao_premium_ativa: 'true' }).nutricao_premium_ativa).toBe(false);
    expect(lerConfigPlanoCliente({ nutricao_premium_ativa: 1 }).nutricao_premium_ativa).toBe(false);
    expect(lerConfigPlanoCliente({ prazo_chancela_dias_uteis: 0 }).prazo_chancela_dias_uteis).toBe(2);
    expect(lerConfigPlanoCliente({ prazo_chancela_dias_uteis: 11 }).prazo_chancela_dias_uteis).toBe(2);
    expect(lerConfigPlanoCliente({ prazo_chancela_dias_uteis: 2.5 }).prazo_chancela_dias_uteis).toBe(2);
    expect(lerConfigPlanoCliente({ prazo_chancela_dias_uteis: '4' }).prazo_chancela_dias_uteis).toBe(4);
  });

  it('prazo: inteiro de 1 a 10', () => {
    expect(validarPrazoChancela('3')).toEqual({ ok: true, valor: 3 });
    expect(validarPrazoChancela(10)).toEqual({ ok: true, valor: 10 });
    expect(validarPrazoChancela(1)).toEqual({ ok: true, valor: 1 });
    for (const ruim of ['', '  ', '0', '11', '2,5', 'abc', -1, 2.5, Number.NaN]) {
      expect(validarPrazoChancela(ruim)).toMatchObject({ ok: false });
    }
  });
});
