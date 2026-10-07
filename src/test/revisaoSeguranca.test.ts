import { describe, expect, it } from 'vitest';
import {
  LIMITE_PLANO_CHARS, extrairJson, idadeEmAnos, interpretarRevisao, montarRevisaoPersistida, planoParaPrompt,
  removerGovernanca, resumirHistoricoClinico, tabelaDoTipo,
} from '../../supabase/functions/_shared/revisao-seguranca';

describe('tabelaDoTipo', () => {
  it('mapeia treino e nutrição para tabela e coluna do conteúdo', () => {
    expect(tabelaDoTipo('treino')).toEqual({ tabela: 'planos_treino', coluna: 'estrutura' });
    expect(tabelaDoTipo('nutricao')).toEqual({ tabela: 'planos_alimentares', coluna: 'plano' });
  });
  it('recusa qualquer outro tipo (diretriz não tem plano_id)', () => {
    expect(tabelaDoTipo('clinica')).toBeNull();
    expect(tabelaDoTipo(undefined)).toBeNull();
    expect(tabelaDoTipo('planos_treino; drop table x')).toBeNull();
  });
});

describe('removerGovernanca', () => {
  it('tira só a chave _governanca, sem mutar o original', () => {
    const plano = { titulo: 'T', fases: [1], _governanca: { versao: 1 } };
    expect(removerGovernanca(plano)).toEqual({ titulo: 'T', fases: [1] });
    expect(plano._governanca).toEqual({ versao: 1 });
  });
  it('devolve como veio o que não é objeto', () => {
    expect(removerGovernanca([1, 2])).toEqual([1, 2]);
    expect(removerGovernanca(null)).toBeNull();
    expect(removerGovernanca('x')).toBe('x');
  });
});

describe('planoParaPrompt', () => {
  it('não corta plano dentro do limite', () => {
    expect(planoParaPrompt({ a: 1 })).toEqual({ json: '{"a":1}', truncado: false });
  });
  it('corta e avisa quando passa do limite', () => {
    const r = planoParaPrompt({ texto: 'x'.repeat(LIMITE_PLANO_CHARS) });
    expect(r.truncado).toBe(true);
    expect(r.json).toHaveLength(LIMITE_PLANO_CHARS);
  });
});

describe('extrairJson', () => {
  it('lê JSON puro, JSON embrulhado em texto e devolve null no resto', () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 });
    expect(extrairJson('Segue:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('sem json aqui')).toBeNull();
    expect(extrairJson('{quebrado')).toBeNull();
    expect(extrairJson(undefined)).toBeNull();
  });
});

describe('interpretarRevisao', () => {
  const flag = (severidade: string, extra: Record<string, unknown> = {}) => ({
    severidade, titulo: 'Carga alta', descricao: 'd', sugestao: 's', onde: 'Fase 2', ...extra,
  });

  it('risco_geral vira "alto" sempre que houver flag de severidade alta, mesmo que o modelo diga baixo', () => {
    const r = interpretarRevisao({ resumo: 'ok', risco_geral: 'baixo', flags: [flag('alta')] });
    expect(r?.risco_geral).toBe('alto');
  });

  it('nunca rebaixa o "alto" do modelo; sem flags altas mantém o que o modelo disse', () => {
    expect(interpretarRevisao({ risco_geral: 'alto', flags: [] })?.risco_geral).toBe('alto');
    expect(interpretarRevisao({ risco_geral: 'medio', flags: [flag('baixa')] })?.risco_geral).toBe('medio');
    expect(interpretarRevisao({ risco_geral: 'Médio', flags: [] })?.risco_geral).toBe('medio');
  });

  it('sem risco_geral do modelo, deriva das flags', () => {
    expect(interpretarRevisao({ flags: [] })?.risco_geral).toBe('baixo');
    expect(interpretarRevisao({ flags: [flag('media')] })?.risco_geral).toBe('medio');
    expect(interpretarRevisao({ flags: [flag('alta')] })?.risco_geral).toBe('alto');
  });

  it('normaliza severidade (acento, caixa, sinônimo) e na dúvida não rebaixa para baixa', () => {
    const r = interpretarRevisao({
      risco_geral: 'baixo',
      flags: [flag('Alta'), flag('MÉDIA'), flag('baixa'), flag('???'), flag('grave')],
    });
    expect(r?.flags.map((f) => f.severidade)).toEqual(['alta', 'media', 'baixa', 'media', 'alta']);
  });

  it('resposta vazia ou de outro formato não é uma revisão (null), nunca "sem pontos críticos"', () => {
    expect(interpretarRevisao({})).toBeNull();
    expect(interpretarRevisao(null)).toBeNull();
    expect(interpretarRevisao('texto')).toBeNull();
    expect(interpretarRevisao({ resumo: 'só resumo' })).toBeNull();
    expect(interpretarRevisao({ flags: 'não é lista' })).toBeNull();
  });

  it('aceita revisão positiva explícita (flags vazias)', () => {
    const r = interpretarRevisao({ risco_geral: 'baixo', flags: [] });
    expect(r).toEqual({ resumo: 'Nenhum ponto crítico encontrado.', risco_geral: 'baixo', flags: [] });
  });

  it('descarta itens que não são objeto, limita tamanho e quantidade e dá título padrão', () => {
    const muitas = Array.from({ length: 40 }, () => flag('baixa'));
    const r = interpretarRevisao({ risco_geral: 'baixo', flags: ['lixo', 3, null, ...muitas, { severidade: 'alta' }] });
    expect(r?.flags).toHaveLength(30);
    const longa = interpretarRevisao({ risco_geral: 'medio', flags: [flag('media', { descricao: 'x'.repeat(5000) })] });
    expect(longa?.flags[0].descricao.length).toBeLessThanOrEqual(1200);
    const semTitulo = interpretarRevisao({ risco_geral: 'alto', flags: [{ severidade: 'alta' }] });
    expect(semTitulo?.flags[0].titulo).toBe('Ponto de atenção');
    expect(semTitulo?.risco_geral).toBe('alto');
  });
});

describe('montarRevisaoPersistida', () => {
  const revisao = interpretarRevisao({
    resumo: 'Atenção na carga',
    risco_geral: 'alto',
    flags: [
      { severidade: 'alta', titulo: 'a', descricao: 'd', sugestao: 's', onde: 'o' },
      { severidade: 'baixa', titulo: 'b', descricao: 'd', sugestao: 's', onde: 'o' },
    ],
  })!;

  it('monta o registro com contagem de flags altas, autor, data e hash', () => {
    const r = montarRevisaoPersistida({
      revisao, revisadoPor: 'user-1', hash: 'abc123', agora: new Date('2026-10-07T12:00:00Z'), planoTruncado: false,
    });
    expect(r).toEqual({
      risco_geral: 'alto', n_flags_altas: 1, flags: revisao.flags, resumo: 'Atenção na carga',
      revisado_em: '2026-10-07T12:00:00.000Z', revisado_por: 'user-1', hash: 'abc123',
    });
    expect('plano_truncado' in r).toBe(false);
  });

  it('marca revisão parcial quando o plano foi cortado', () => {
    const r = montarRevisaoPersistida({ revisao, revisadoPor: 'u', hash: 'h', agora: new Date(0), planoTruncado: true });
    expect(r.plano_truncado).toBe(true);
  });
});

describe('idadeEmAnos', () => {
  const hoje = new Date('2026-10-07T12:00:00Z');
  it('conta anos completos', () => {
    expect(idadeEmAnos('1990-10-07', hoje)).toBe(36);
    expect(idadeEmAnos('1990-10-08', hoje)).toBe(35);
    expect(idadeEmAnos('2010-01-01T00:00:00Z', hoje)).toBe(16);
  });
  it('null para data ausente, inválida ou no futuro', () => {
    expect(idadeEmAnos(null, hoje)).toBeNull();
    expect(idadeEmAnos('ontem', hoje)).toBeNull();
    expect(idadeEmAnos('2030-01-01', hoje)).toBeNull();
  });
});

describe('resumirHistoricoClinico', () => {
  it('resume só o que está preenchido', () => {
    const txt = resumirHistoricoClinico({
      doencas_cronicas: { condicoes: ['Diabetes tipo 2', 'Hipertensão arterial'], detalhes: 'em tratamento' },
      cirurgias: { items: [{ id: '1', tipo: 'Bariátrica', ano: '2019', complicacoes: '' }] },
      medicamentos: { items: [{ id: '2', nome: 'Metformina', dose: '850 mg', frequencia: '2x/dia' }] },
      alergias: { medicamentos: 'dipirona', alimentos: '', outros: '' },
      saude_mental: { condicoes: [], diagnostico_formal: false, detalhes: '' },
      historico_familiar: { condicoes: [], detalhes: '' },
    });
    expect(txt).toBe([
      'Doenças crônicas: Diabetes tipo 2; Hipertensão arterial; em tratamento',
      'Cirurgias: Bariátrica 2019',
      'Medicamentos: Metformina 850 mg 2x/dia',
      'Alergias: dipirona',
    ].join('\n'));
  });
  it('vazio para entrada sem dados ou fora do formato', () => {
    expect(resumirHistoricoClinico(null)).toBe('');
    expect(resumirHistoricoClinico('texto')).toBe('');
    expect(resumirHistoricoClinico({ doencas_cronicas: { condicoes: [], detalhes: '' } })).toBe('');
  });
});
