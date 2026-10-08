import { describe, expect, it } from 'vitest';
import {
  NOTA_PUBLICA_MAX_CARACTERES, NOTA_PUBLICA_MIN_CARACTERES, avisoSemPerfil, descricaoPaciente, exigeJustificativa,
  insumosDoPlano, lerFila, lerItemFila, mensagemErroChancela, ordenarFila, rotuloChancelado, rotuloInsumo,
  rotuloPerfil, situacaoRevisao, tituloItem, validarChancela, validarRecusa,
  type ItemFilaChancela, type SituacaoRevisao,
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
    expect(item({ revisao_seguranca: { risco_geral: 'alto', n_flags_altas: 2 } }).revisao).toEqual({ risco_geral: 'alto', n_flags_altas: 2 });
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
});

describe('validarChancela', () => {
  const base = { pode: true, revisao: revisaoValida('baixo'), justificativa: '', cienteSemRevisao: false, notaPublica: '' };

  it('revisão válida de risco baixo chancela sem justificativa', () => {
    expect(validarChancela(base)).toEqual({ ok: true });
  });

  it('sem o perfil exigido nunca chancela', () => {
    const r = validarChancela({ ...base, pode: false });
    expect(r).toMatchObject({ ok: false, motivo: 'sem_perfil' });
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

  it('sem revisão válida desta versão exige a ciência do revisor', () => {
    expect(validarChancela({ ...base, revisao: SEM_REVISAO })).toMatchObject({ ok: false, motivo: 'ciencia' });
    expect(validarChancela({ ...base, revisao: { ...SEM_REVISAO, estado: 'desatualizada' } })).toMatchObject({ ok: false, motivo: 'ciencia' });
    expect(validarChancela({ ...base, revisao: SEM_REVISAO, cienteSemRevisao: true })).toEqual({ ok: true });
  });

  it('revisão desatualizada com risco alto continua exigindo justificativa (editar não apaga o alerta)', () => {
    const antiga = { estado: 'desatualizada' as const, risco: 'alto' as const, nFlagsAltas: 1 };
    expect(exigeJustificativa(antiga)).toBe(true);
    const r = validarChancela({ ...base, revisao: antiga, cienteSemRevisao: true });
    expect(r).toMatchObject({ ok: false, motivo: 'justificativa' });
    expect(r.erro).toMatch(/foi alterado depois dela/);
    expect(validarChancela({ ...base, revisao: antiga, cienteSemRevisao: true, justificativa: 'Ajustei a carga e conferi o plano.' })).toEqual({ ok: true });
  });

  it('revisão desatualizada de risco baixo ou plano sem revisão não exigem justificativa', () => {
    expect(exigeJustificativa({ estado: 'desatualizada', risco: 'baixo', nFlagsAltas: 0 })).toBe(false);
    expect(exigeJustificativa(SEM_REVISAO)).toBe(false);
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
  it('justificativa obrigatória do banco pede a justificativa', () => {
    expect(mensagemErroChancela(new Error('Justificativa obrigatória para liberar plano de risco alto'))).toMatchObject({ exigeJustificativa: true });
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

  it('não muda a lista original', () => {
    const original = [b, a];
    ordenarFila(original, 'aguardando');
    expect(original.map((i) => i.id)).toEqual(['b', 'a']);
  });
});
