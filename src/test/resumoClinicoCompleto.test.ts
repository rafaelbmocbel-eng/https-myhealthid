import { describe, it, expect } from 'vitest';
import {
  AVISO_DO_RESUMO_COMPLETO, AVISO_DOS_SELOS_DO_CABECALHO, montarResumoCompleto, NOTA_EDITADO_PELO_PROFISSIONAL, textoParaCopiar,
} from '@/lib/resumoClinico/resumoCompleto';
import { FONTES_VAZIAS } from '@/lib/resumoClinico/tipos';
import type { FontesClinicas, SecaoDoResumo } from '@/lib/resumoClinico/tipos';

const fontes = (parcial: Partial<FontesClinicas> = {}): FontesClinicas => ({ ...FONTES_VAZIAS, ...parcial });
const porId = (secoes: SecaoDoResumo[]) => Object.fromEntries(secoes.map((s) => [s.id, s]));

const resultadoCompleto = {
  resumo_clinico: 'TEXTO DO RESUMO QUE NAO ENTRA NO COMPLETO',
  queixa_principal: 'Dor lombar crônica com irradiação para a perna direita',
  tempo_evolucao: '6 meses',
  mecanismo_lesao: 'Levantou peso na mudança',
  classificacao_severidade: 'Moderada',
  soap: {
    subjetivo: 'Dor ao sentar.\nPiora à noite.',
    objetivo: 'Lasègue positivo à direita.',
    avaliacao: 'Quadro compatível com sobrecarga lombar.',
    plano: 'PLANO QUE NAO ENTRA NO COMPLETO',
  },
  dor: { localizacao: 'Lombar', intensidade_eva: 7, tipo: 'Mista', fatores_agravantes: ['Sentar', 'Dirigir'], fatores_atenuantes: ['Deitar de lado'], padrao_temporal: 'Pior à noite' },
  funcionalidade: { limitacoes_avds: ['Calçar sapato', 'Subir escada'], limitacoes_trabalho: 'Evita carregar caixas', nivel_impacto: 'Moderado' },
  fatores_psicossociais: { catastrofizacao: 'Leve', medo_evitacao: 'Moderado', qualidade_sono: 'Ruim', estresse: 'Alto', observacoes: 'Trabalha muito' },
  red_flags: ['RED FLAG QUE NAO ENTRA'],
  hipoteses_diagnosticas: [{ diagnostico: 'HIPOTESE QUE NAO ENTRA', probabilidade: 'Alta', evidencia: 'x' }],
};

const respostasMyid = { bloco_1_queixa: 'Dor nas costas ao acordar', bloco_1_duracao: '3_12m', bloco_1_quando_data: 'faz uns 8 meses', bloco_1_quando_desc: 'Acordei com dor', bloco_1_changes: ['equipment', 'posture', 'invalido'] };
const historico = {
  doencas_cronicas: { condicoes: ['Hipertensão arterial', 'Outras'], detalhes: 'pressão controlada' },
  cirurgias: { items: [{ id: 'a', tipo: 'Ligamento do joelho', ano: 'há 2 anos', complicacoes: 'infecção' }, { id: 'b', tipo: 'Apêndice', ano: '2019', complicacoes: '' }] },
  medicamentos: { items: [{ id: 'c', nome: 'Losartana', dose: '50mg', frequencia: '1x ao dia' }, { id: 'd', nome: 'Vitamina D', dose: '', frequencia: '' }] },
  alergias: { medicamentos: 'dipirona', alimentos: 'amendoim', outros: '' },
  saude_mental: { condicoes: ['Ansiedade'], diagnostico_formal: true, detalhes: 'em terapia desde 2022' },
  historico_familiar: { condicoes: ['Diabetes'], detalhes: 'mãe e avó' },
};
const historiaAtual = { queixa: 'Dor lombar do lado direito', inicio: 'Há 3 semanas, depois da mudança', fatores: 'Piora sentada. Melhora deitada', impacto: 'Durmo mal' };
const clienteCompleto = (): Partial<FontesClinicas> => ({
  myidUltimo: { id: 'm1', status: 'concluido', respostas_brutas: respostasMyid },
  paciente: { historico_clinico: historico, historia_atual: historiaAtual },
});

describe('seções do profissional', () => {
  it('monta as seções na ordem combinada, com título fixo e os textos como estão', () => {
    const secoes = montarResumoCompleto(resultadoCompleto, fontes());
    expect(secoes.map((s) => [s.id, s.titulo, s.origem])).toEqual([
      ['queixa_e_historia', 'Queixa e história', 'profissional'],
      ['dor', 'Dor', 'profissional'],
      ['funcionalidade', 'Funcionalidade', 'profissional'],
      ['psicossociais', 'Aspectos psicossociais', 'profissional'],
      ['exame_e_avaliacao', 'Exame e avaliação do profissional', 'profissional'],
    ]);
    const s = porId(secoes);
    expect(s.queixa_e_historia.linhas).toEqual([
      'Queixa principal: Dor lombar crônica com irradiação para a perna direita',
      'Tempo de evolução: 6 meses',
      'Mecanismo da lesão: Levantou peso na mudança',
      'Relato (subjetivo): Dor ao sentar.',
      'Piora à noite.',
    ]);
    expect(s.dor.linhas).toEqual([
      'Localização: Lombar', 'Intensidade (EVA): 7/10', 'Tipo: Mista', 'Padrão ao longo do tempo: Pior à noite', 'Agrava: Sentar, Dirigir', 'Alivia: Deitar de lado',
    ]);
    expect(s.funcionalidade.linhas).toEqual([
      'Limitações nas atividades do dia a dia: Calçar sapato, Subir escada', 'Limitações no trabalho: Evita carregar caixas', 'Nível de impacto: Moderado',
    ]);
    expect(s.psicossociais.linhas).toEqual([
      'Catastrofização: Leve', 'Medo e evitação: Moderado', 'Qualidade do sono: Ruim', 'Estresse: Alto', 'Observações: Trabalha muito',
    ]);
    expect(s.exame_e_avaliacao.linhas).toEqual(['Exame (objetivo): Lasègue positivo à direita.', 'Avaliação: Quadro compatível com sobrecarga lombar.']);
  });

  it('não inclui o texto do Resumo, o plano, os red flags nem as hipóteses diagnósticas', () => {
    const tudo = JSON.stringify(montarResumoCompleto(resultadoCompleto, fontes()));
    for (const proibido of ['QUE NAO ENTRA', 'Moderada', 'Hipóteses', 'hipótese', 'Red flag']) expect(tudo).not.toContain(proibido);
  });

  it('só aparecem as seções que têm conteúdo', () => {
    expect(montarResumoCompleto({ queixa_principal: 'Dor no ombro' }, fontes()).map((s) => s.id)).toEqual(['queixa_e_historia']);
    expect(montarResumoCompleto({ dor: { localizacao: 'Joelho' } }, fontes()).map((s) => s.id)).toEqual(['dor']);
    expect(montarResumoCompleto({ soap: { avaliacao: 'Só avaliação' } }, fontes()).map((s) => s.id)).toEqual(['exame_e_avaliacao']);
    expect(montarResumoCompleto({ queixa_principal: '  ', dor: {}, funcionalidade: {}, fatores_psicossociais: { observacoes: '' }, soap: { subjetivo: '', objetivo: '' } }, fontes())).toEqual([]);
  });

  it('EVA zero aparece como 0/10; EVA como texto numérico também; sem EVA não inventa', () => {
    expect(porId(montarResumoCompleto({ dor: { intensidade_eva: 0 } }, fontes())).dor.linhas).toEqual(['Intensidade (EVA): 0/10']);
    expect(porId(montarResumoCompleto({ dor: { intensidade_eva: '8' } }, fontes())).dor.linhas).toEqual(['Intensidade (EVA): 8/10']);
    expect(montarResumoCompleto({ dor: { intensidade_eva: null, localizacao: '' } }, fontes())).toEqual([]);
  });

  it('o alívio aceita fatores_aliviantes ou fatores_atenuantes, e os psicossociais aceitam o apelido psicossocial', () => {
    expect(porId(montarResumoCompleto({ dor: { fatores_aliviantes: ['Calor'] } }, fontes())).dor.linhas).toEqual(['Alivia: Calor']);
    expect(porId(montarResumoCompleto({ psicossocial: { estresse: 'Baixo' } }, fontes())).psicossociais.linhas).toEqual(['Estresse: Baixo']);
  });

  it('campo solto que a IA acrescentou entra com o nome do campo, sem acento inventado; objeto aninhado e lixo ficam de fora', () => {
    const s = porId(montarResumoCompleto({ funcionalidade: { nivel_impacto: 'Leve', limitacoes_sono: 'Acorda à noite', aninhado: { a: 1 }, vazio: '', nulo: null } }, fontes()));
    expect(s.funcionalidade.linhas).toEqual(['Nível de impacto: Leve', 'Limitacoes sono: Acorda à noite']);
  });

  it('funcionalidade e psicossociais que vêm como texto passam como texto', () => {
    const s = porId(montarResumoCompleto({ funcionalidade: 'Anda com dificuldade', fatores_psicossociais: 'Muito estresse' }, fontes()));
    expect(s.funcionalidade.linhas).toEqual(['Anda com dificuldade']);
    expect(s.psicossociais.linhas).toEqual(['Muito estresse']);
  });

  it.each([[null], [undefined], ['texto'], [42], [[]], [[{ queixa_principal: 'x' }]], [{ soap: 'texto solto' }], [{ dor: 'x', funcionalidade: 5, soap: [] }]])('resultado %j não derruba', (resultado) => {
    expect(() => montarResumoCompleto(resultado, fontes())).not.toThrow();
  });
});

describe('parte "Relatado pelo cliente (não revisado)"', () => {
  it('seções do cliente: MyID, histórico clínico e história atual, todas com origem cliente, depois das do profissional', () => {
    const secoes = montarResumoCompleto(resultadoCompleto, fontes(clienteCompleto()));
    expect(secoes.map((s) => [s.titulo, s.origem]).slice(-3)).toEqual([['MyID', 'cliente'], ['Histórico clínico', 'cliente'], ['História atual', 'cliente']]);
    expect(secoes.filter((s) => s.origem === 'profissional')).toHaveLength(5);
  });

  it('MyID: queixa como escrita, faixa com o rótulo humano, texto escrito, o que fazia e as mudanças (sem códigos desconhecidos)', () => {
    expect(porId(montarResumoCompleto(null, fontes(clienteCompleto()))).cliente_myid.linhas).toEqual([
      'Queixa que o cliente escreveu: Dor nas costas ao acordar',
      'Quando começou (faixa escolhida): Entre 3 meses e 1 ano',
      'Quando começou (texto escrito): faz uns 8 meses',
      'O que estava fazendo quando notou: Acordei com dor',
      'Mudanças nas últimas 4 semanas: Novo equipamento, Mudança de postura / contexto',
    ]);
  });

  it('histórico clínico: doenças, cirurgias com o ano digitado (mesmo "há 2 anos"), medicamentos com dose e frequência, alergias, saúde mental, família', () => {
    expect(porId(montarResumoCompleto(null, fontes(clienteCompleto()))).cliente_historico.linhas).toEqual([
      'Doenças crônicas: Hipertensão arterial, Outras',
      'Detalhes sobre as doenças crônicas: pressão controlada',
      'Cirurgia ou internação: Ligamento do joelho (há 2 anos) — complicações: infecção',
      'Cirurgia ou internação: Apêndice (2019)',
      'Medicamento: Losartana, 50mg, 1x ao dia',
      'Medicamento: Vitamina D',
      'Alergias a medicamentos: dipirona',
      'Alergias a alimentos: amendoim',
      'Saúde mental: Ansiedade',
      'O cliente marcou que tem diagnóstico formal de saúde mental',
      'Detalhes sobre a saúde mental: em terapia desde 2022',
      'Histórico familiar: Diabetes',
      'Detalhes sobre o histórico familiar: mãe e avó',
    ]);
  });

  it('diagnóstico formal só aparece junto de uma condição de saúde mental', () => {
    const h = { saude_mental: { condicoes: [], diagnostico_formal: true, detalhes: '' } };
    expect(montarResumoCompleto(null, fontes({ paciente: { historico_clinico: h, historia_atual: null } }))).toEqual([]);
  });

  it('história atual: as quatro respostas, cada uma como o cliente escreveu, e só as que existem', () => {
    expect(porId(montarResumoCompleto(null, fontes(clienteCompleto()))).cliente_historia_atual.linhas).toEqual([
      'Queixa principal: Dor lombar do lado direito',
      'Há quanto tempo começou: Há 3 semanas, depois da mudança',
      'O que melhora e o que piora: Piora sentada. Melhora deitada',
      'Como afeta a rotina: Durmo mal',
    ]);
    const so = porId(montarResumoCompleto(null, fontes({ paciente: { historico_clinico: null, historia_atual: { impacto: 'Só isto' } } })));
    expect(so.cliente_historia_atual.linhas).toEqual(['Como afeta a rotina: Só isto']);
  });

  it('MyID que não está concluído não aparece; sem cliente nenhum, não há seção de cliente', () => {
    const r = montarResumoCompleto(null, fontes({ myidUltimo: { id: 'm', status: 'pendente', respostas_brutas: respostasMyid } }));
    expect(r).toEqual([]);
    expect(montarResumoCompleto(resultadoCompleto, fontes()).some((s) => s.origem === 'cliente')).toBe(false);
  });

  it('o cliente aparece mesmo sem avaliação do profissional', () => {
    expect(montarResumoCompleto(null, fontes(clienteCompleto())).map((s) => s.id)).toEqual(['cliente_myid', 'cliente_historico', 'cliente_historia_atual']);
  });

  it('lixo no jsonb do cliente não derruba e não gera seção', () => {
    for (const ruim of [null, 'lixo', 42, [], { doencas_cronicas: 5, cirurgias: 'x', medicamentos: { items: [null, 3, 'a'] }, alergias: [], saude_mental: 'x', historico_familiar: null }]) {
      expect(() => montarResumoCompleto(null, fontes({ paciente: { historico_clinico: ruim, historia_atual: ruim } }))).not.toThrow();
      expect(montarResumoCompleto(null, fontes({ paciente: { historico_clinico: ruim, historia_atual: ruim } }))).toEqual([]);
    }
  });
});

describe('texto para copiar', () => {
  it('traz os títulos, as linhas, o aviso no fim, e marca cada trecho do cliente como não revisado', () => {
    const secoes = montarResumoCompleto(resultadoCompleto, fontes(clienteCompleto()));
    const texto = textoParaCopiar(secoes);
    expect(texto).toContain('Queixa e história\nQueixa principal: Dor lombar crônica com irradiação para a perna direita');
    expect(texto).toContain('MyID (relatado pelo cliente, não revisado)\nQueixa que o cliente escreveu: Dor nas costas ao acordar');
    expect(texto).toContain('Histórico clínico (relatado pelo cliente, não revisado)\n');
    expect(texto).toContain('História atual (relatado pelo cliente, não revisado)\n');
    expect(texto.endsWith(AVISO_DO_RESUMO_COMPLETO)).toBe(true);
    expect(texto).not.toMatch(/Dor \(relatado/); // seção do profissional não leva o aviso do cliente
    expect(AVISO_DO_RESUMO_COMPLETO).toBe('Montado pelo app a partir das respostas; não vai para o prontuário.');
  });

  it('sem seções, o texto é só o aviso', () => {
    expect(textoParaCopiar([])).toBe(AVISO_DO_RESUMO_COMPLETO);
  });
});

describe('edições do profissional (_secoes.editadas): o Completo mostra o que a tela mostra', () => {
  const comEdicoes = (editadas: unknown, extra: Record<string, unknown> = {}) => ({ ...resultadoCompleto, ...extra, _secoes: { editadas } });
  const editado = (secoes: SecaoDoResumo[], id: string) => porId(secoes)[id];

  it('dor editada: mostra o texto editado (EVA 4), não o dos campos (EVA 7), com a marca de editado', () => {
    const secoes = montarResumoCompleto(comEdicoes({ dor: 'Localização: Lombar\nEVA: 4/10' }), fontes());
    expect(editado(secoes, 'dor')).toEqual({ id: 'dor', titulo: 'Dor', linhas: ['Localização: Lombar', 'EVA: 4/10'], origem: 'profissional', editada: true });
    expect(JSON.stringify(secoes)).not.toContain('7/10');
  });

  it('funcionalidade e psicossocial editados também valem (a chave da tela para os psicossociais é "psicossocial")', () => {
    const secoes = montarResumoCompleto(comEdicoes({ funcionalidade: 'Volta a correr sem dor', psicossocial: 'Sono melhorou' }), fontes());
    expect(editado(secoes, 'funcionalidade')).toMatchObject({ linhas: ['Volta a correr sem dor'], editada: true });
    expect(editado(secoes, 'psicossociais')).toMatchObject({ linhas: ['Sono melhorou'], editada: true });
    expect(JSON.stringify(secoes)).not.toContain('Calçar sapato');
    expect(JSON.stringify(secoes)).not.toContain('Catastrofização');
  });

  it('só a seção editada muda: as outras seguem montadas pelos campos, sem a marca', () => {
    const secoes = montarResumoCompleto(comEdicoes({ dor: 'EVA: 4/10' }), fontes());
    expect(editado(secoes, 'dor').editada).toBe(true);
    for (const id of ['queixa_e_historia', 'funcionalidade', 'psicossociais', 'exame_e_avaliacao']) expect(editado(secoes, id).editada, id).toBeUndefined();
    expect(editado(secoes, 'funcionalidade').linhas[0]).toBe('Limitações nas atividades do dia a dia: Calçar sapato, Subir escada');
    expect(secoes.map((s) => s.id)).toEqual(['queixa_e_historia', 'dor', 'funcionalidade', 'psicossociais', 'exame_e_avaliacao']);
  });

  it('sem edição (ou com edições de outras seções, como o resumo e o plano), tudo vem dos campos, como antes', () => {
    const semEdicao = montarResumoCompleto(resultadoCompleto, fontes());
    for (const editadas of [undefined, null, {}, 'texto', 7, [], { resumo_clinico: 'resumo editado', diretriz: 'plano editado', red_flags: 'x', hipoteses: 'y' }]) {
      expect(montarResumoCompleto(comEdicoes(editadas), fontes()), JSON.stringify(editadas)).toEqual(semEdicao);
    }
    expect(semEdicao.every((s) => s.editada === undefined)).toBe(true);
  });

  it('edição vazia: a seção some (o profissional a apagou) e o dado antigo dos campos NÃO volta nem é copiado', () => {
    for (const vazio of ['', '   ', '\n \n']) {
      const secoes = montarResumoCompleto(comEdicoes({ dor: vazio }), fontes());
      expect(secoes.map((s) => s.id), JSON.stringify(vazio)).toEqual(['queixa_e_historia', 'funcionalidade', 'psicossociais', 'exame_e_avaliacao']);
      expect(textoParaCopiar(secoes)).not.toContain('Intensidade (EVA)');
      expect(textoParaCopiar(secoes)).not.toContain('7/10');
    }
  });

  it('edição que não é texto (null, número, objeto) conta como "não editado", como o ?? da tela', () => {
    const semEdicao = montarResumoCompleto(resultadoCompleto, fontes());
    for (const ruim of [null, 5, true, { texto: 'x' }, ['EVA: 4/10']]) {
      expect(montarResumoCompleto(comEdicoes({ dor: ruim }), fontes()), JSON.stringify(ruim)).toEqual(semEdicao);
    }
  });

  it('seção editada que os campos não teriam (dor sem dados) aparece com o texto editado', () => {
    const secoes = montarResumoCompleto({ queixa_principal: 'Dor no ombro', _secoes: { editadas: { dor: 'Dor no ombro direito, EVA 3' } } }, fontes());
    expect(secoes.map((s) => s.id)).toEqual(['queixa_e_historia', 'dor']);
    expect(editado(secoes, 'dor').linhas).toEqual(['Dor no ombro direito, EVA 3']);
  });

  it('o texto editado passa como está: parágrafos viram linhas, espaços das pontas saem, linhas vazias somem', () => {
    const secoes = montarResumoCompleto(comEdicoes({ dor: '  Linha 1  \n\n   \nLinha 2 com   espaços internos  ' }), fontes());
    expect(editado(secoes, 'dor').linhas).toEqual(['Linha 1', 'Linha 2 com   espaços internos']);
  });

  it('o 3º argumento (edições desta sessão, ainda não relidas do banco) vale mais do que as do resultado', () => {
    const resultado = comEdicoes({ dor: 'EVA: 9/10 (edição antiga)' });
    const secoes = montarResumoCompleto(resultado, fontes(), { dor: 'EVA: 4/10' });
    expect(editado(secoes, 'dor').linhas).toEqual(['EVA: 4/10']);
    expect(JSON.stringify(secoes)).not.toContain('edição antiga');
    expect(editado(montarResumoCompleto(resultado, fontes(), undefined), 'dor').linhas).toEqual(['EVA: 9/10 (edição antiga)']);
  });

  it('Copiar leva o texto editado, marcado como editado pelo profissional, e não o dado antigo', () => {
    const secoes = montarResumoCompleto(comEdicoes({ dor: 'Localização: Lombar\nEVA: 4/10' }), fontes(clienteCompleto()));
    const texto = textoParaCopiar(secoes);
    expect(texto).toContain('Dor (editado pelo profissional)\nLocalização: Lombar\nEVA: 4/10');
    expect(texto).not.toContain('7/10');
    expect(texto).not.toContain('Intensidade (EVA)');
    expect(texto).toContain('Funcionalidade\nLimitações nas atividades do dia a dia');
    expect(texto).not.toContain('Funcionalidade (editado');
  });

  it('seção do cliente nunca recebe a marca de editado, mesmo que o resultado traga edições', () => {
    const secoes = montarResumoCompleto(comEdicoes({ dor: 'x' }), fontes(clienteCompleto()));
    expect(secoes.filter((s) => s.origem === 'cliente').every((s) => s.editada === undefined)).toBe(true);
  });

  it('a nota e os avisos fixos têm o texto combinado', () => {
    expect(NOTA_EDITADO_PELO_PROFISSIONAL).toBe('Editado pelo profissional');
    expect(AVISO_DOS_SELOS_DO_CABECALHO).toBe('Os selos Prontuário e Sincronizado do cabeçalho valem só para o Resumo.');
  });

  it('o aviso dos selos é só da tela: o texto copiado não o leva', () => {
    expect(textoParaCopiar(montarResumoCompleto(resultadoCompleto, fontes()))).not.toContain('selos');
  });
});
