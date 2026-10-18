import { describe, expect, it } from 'vitest';
import * as frases from '../lib/angular/movimento/frases';
import {
  analisarMovimento, BIBLIOTECA, CATALOGO_ACHADOS, GATILHOS, ID_SECAO, montarLaudo, PROTOCOLOS, protocoloDo, termoProibido,
  type Achado, type Biblioteca, type IdProtocolo, type LaudoMovimento,
} from '../lib/angular/movimento';
import { AVISO_ESTIMATIVA_VIDEO } from '../lib/angular/analiseVideo/tiposUi';
import { layoutDoGrafico } from '../lib/angular/analiseVideo/graficoLayout';
import {
  achado, achadosDeTodosOsCaminhos, analiseDeTodosOsCaminhos, analiseFixa, BIBLIOTECA_FIXA, contexto, criterioAtivo, FONTE_A, FONTE_CRITERIO, PDF_SEGURO, SEM_BIBLIOTECA,
  SO_FRASES_DO_LAUDO, textos, VEREDITO, VERBO_CAUSAL,
} from './movimentoLaudoFixtures';
import { trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';

/*
 * Laudo da Etapa 3 (agente L). Duas frentes: fixtures escritas à mão no formato do contrato (cada regra do laudo isolada) e o fluxo
 * completo com o motor e a biblioteca reais. A varredura de vocabulário passa por todos os protocolos, gatilhos e situações.
 */

// ---------- estrutura ----------

describe('laudo: seções, ordem e cabeçalho', () => {
  const laudo = montarLaudo(analiseFixa('agachamento_lateral', [achado('assimetria_flexao_joelho', protocoloDo('agachamento_lateral'))]), contexto({
    criterios: [criterioAtivo()], quadrosChaveCorrigidos: 3, medidasManuaisForaDoTrecho: 2, trecho: { inicio: 1.5, fim: 12 }, paciente: 'Paciente de Teste', profissional: 'Dr. Exemplo',
  }), BIBLIOTECA_FIXA);

  it('tem as seções na ordem do laudo e o rodapé fixo', () => {
    expect(Object.keys(laudo)).toEqual(['protocolo', 'cabecalho', 'resumo', 'medidasPorRepeticao', 'achados', 'indisponiveis', 'metodo', 'limitacoes', 'graficos', 'referencias', 'rodape']);
    expect([laudo.resumo.id, laudo.medidasPorRepeticao.id, laudo.indisponiveis.id, laudo.metodo.id, laudo.limitacoes.id]).toEqual([
      ID_SECAO.resumo, ID_SECAO.medidas, ID_SECAO.indisponiveis, ID_SECAO.metodo, ID_SECAO.limitacoes,
    ]);
    expect(laudo.rodape).toBe(AVISO_ESTIMATIVA_VIDEO);
    expect(laudo.rodape).toBe('Estimativa por vídeo · não é diagnóstico');
    expect(laudo.protocolo).toBe('agachamento_lateral');
    expect(laudo.cabecalho.etiqueta).toBe('beta');
  });

  it('o cabeçalho identifica o vídeo, a data, o protocolo, o plano, a taxa efetiva, as repetições e os quadros corrigidos, nesta ordem', () => {
    const rotulos = laudo.cabecalho.linhas.map((l) => l.rotulo);
    expect(rotulos).toEqual([
      'Vídeo', 'Data da análise', 'Paciente', 'Profissional', 'Protocolo', 'Plano de câmera', 'Taxa efetiva de quadros', 'Trecho analisado', 'Repetições',
      'Quadros-chave corrigidos manualmente', 'Medidas manuais', 'Responsável pela revisão', 'Aviso', 'Aviso',
    ]);
    const v = (r: string) => laudo.cabecalho.linhas.find((l) => l.rotulo === r)?.valor;
    expect(v('Vídeo')).toContain('agachamento-teste.mp4');
    expect(v('Vídeo')).toContain('640 × 480 px');
    expect(v('Data da análise')).toBe('18/10/2026');
    expect(v('Protocolo')).toBe('Agachamento — vista lateral');
    expect(v('Plano de câmera')).toBe('vista lateral');
    expect(v('Taxa efetiva de quadros')).toBe('30 quadros por segundo');
    expect(v('Trecho analisado')).toBe('de 1,5 s a 12,0 s');
    expect(v('Repetições')).toBe('4 repetições');
    expect(v('Quadros-chave corrigidos manualmente')).toBe('3 quadros');
    expect(v('Medidas manuais')).toMatch(/2 medidas guardadas em instantes fora do trecho analisado não entraram/);
  });

  it('deixa o responsável pela revisão em branco e traz as duas frases do aviso fixo', () => {
    const resp = laudo.cabecalho.linhas.find((l) => l.rotulo === 'Responsável pela revisão');
    expect(resp?.valor).toBe('');
    const avisos = laudo.cabecalho.linhas.filter((l) => l.rotulo === 'Aviso').map((l) => l.valor);
    expect(avisos).toEqual(['Estimativa por vídeo · não é diagnóstico.', 'Hipóteses para confirmação na avaliação presencial.']);
    expect(frases.AVISO_HIPOTESES).toBe('Hipóteses para confirmação na avaliação presencial');
    const preenchido = montarLaudo(analiseFixa(), contexto({ responsavelRevisao: '  Dra. Revisora  ' }), BIBLIOTECA_FIXA);
    expect(preenchido.cabecalho.linhas.find((l) => l.rotulo === 'Responsável pela revisão')?.valor).toBe('Dra. Revisora');
  });

  it('taxa efetiva ausente ou inválida aparece como "não informada", sem inventar valor', () => {
    for (const taxa of [0, Number.NaN, -5]) {
      const l = montarLaudo(analiseFixa(), contexto({ taxaEfetivaFps: taxa }), BIBLIOTECA_FIXA);
      expect(l.cabecalho.linhas.find((x) => x.rotulo === 'Taxa efetiva de quadros')?.valor).toBe('não informada');
      expect(l.metodo.paragrafos.join(' ')).toContain('na taxa efetiva da trilha (não informada)');
    }
    const ok = montarLaudo(analiseFixa(), contexto({ taxaEfetivaFps: 29.97 }), BIBLIOTECA_FIXA);
    expect(ok.cabecalho.linhas.find((x) => x.rotulo === 'Taxa efetiva de quadros')?.valor).toBe('29,97 quadros por segundo');
  });

  it('sem trecho, sem paciente e sem medida manual fora do trecho, as linhas opcionais não aparecem', () => {
    const l = montarLaudo(analiseFixa(), contexto(), BIBLIOTECA_FIXA);
    const rotulos = l.cabecalho.linhas.map((x) => x.rotulo);
    expect(rotulos).not.toContain('Paciente');
    expect(rotulos).not.toContain('Trecho analisado');
    expect(rotulos).not.toContain('Medidas manuais');
    expect(l.cabecalho.linhas.find((x) => x.rotulo === 'Quadros-chave corrigidos manualmente')?.valor).toBe('nenhum');
  });

  it('é determinístico e não altera a análise recebida', () => {
    const analise = analiseDeTodosOsCaminhos('agachamento_lateral');
    const antes = JSON.stringify(analise);
    const a = montarLaudo(analise, contexto({ criterios: [criterioAtivo()] }), BIBLIOTECA);
    const b = montarLaudo(analise, contexto({ criterios: [criterioAtivo()] }), BIBLIOTECA);
    expect(a).toEqual(b);
    expect(JSON.stringify(analise)).toBe(antes);
  });
});

// ---------- medidas ----------

describe('laudo: medidas por repetição e por lado', () => {
  it('traz uma tabela por medida, com média, desvio-padrão, n e incerteza, e o resumo por lado com a fórmula', () => {
    const analise = analiseFixa('agachamento_lateral');
    const laudo = montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);
    const tabelas = laudo.medidasPorRepeticao.tabelas;
    const p = protocoloDo('agachamento_lateral');
    expect(tabelas[0].titulo).toBe('Repetições identificadas (tempos no vídeo)');
    expect(tabelas[1].titulo).toBe('Resumo por medida e por lado');
    expect(tabelas[1].legenda).toContain(analise.incerteza.formula);
    expect(tabelas.slice(2).map((t) => t.titulo)).toEqual(p.medidas.map((m) => `${m.nome} (${m.unidade})`));
    const joelho = tabelas.find((t) => t.titulo?.startsWith('Flexão máxima do joelho'));
    expect(joelho?.colunas).toEqual(['Repetição', 'Direito', 'Esquerdo']);
    expect(joelho?.linhas).toHaveLength(4 + 4);
    expect(joelho?.linhas.slice(4).map((l) => l[0])).toEqual(['Média', 'Desvio-padrão', 'n', 'Incerteza de um valor']);
    expect(joelho?.linhas[4]).toEqual(['Média', '20,8', '24,8']);
    expect(joelho?.linhas[6]).toEqual(['n', '4', '4']);
    expect(joelho?.linhas[7]).toEqual(['Incerteza de um valor', '± 1,2', '± 1,1']);
    expect(joelho?.legenda).toContain('Fase: Repetição inteira');
    expect(joelho?.legenda).toContain(p.medidas[0].formula);
    const tronco = tabelas.find((t) => t.titulo?.startsWith('Inclinação do tronco'));
    expect(tronco?.colunas).toEqual(['Repetição', 'Valor']);
  });

  it('mostra lacunas como "–" e marca a repetição com sinalizador na primeira coluna', () => {
    const analise = analiseFixa('agachamento_lateral');
    analise.repeticoes[1].sinalizadores = ['incompleta'];
    analise.medidas[0].valores.D = [10, null, 12, 13];
    const laudo = montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);
    const tab = laudo.medidasPorRepeticao.tabelas.find((t) => t.titulo?.startsWith('Flexão máxima do joelho'));
    expect(tab?.linhas[1]).toEqual(['2 · incompleta, sem medidas', '–', '24,5']);
    expect(laudo.medidasPorRepeticao.tabelas[0].linhas[1][5]).toBe('incompleta, sem medidas');
    expect(laudo.cabecalho.linhas.find((l) => l.rotulo === 'Repetições')?.valor).toBe('3 repetições completas, de 4 identificadas');
  });

  it('na marcha, cada passada leva o pé e a medida por lado só preenche o pé da passada', () => {
    const analise = analiseFixa('marcha_lateral');
    const laudo = montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);
    const apoio = laudo.medidasPorRepeticao.tabelas.find((t) => t.titulo?.startsWith('Tempo de apoio'));
    expect(apoio?.colunas).toEqual(['Passada', 'Pé direito', 'Pé esquerdo']);
    expect(apoio?.linhas[0]).toEqual(['1 · pé direito', '20,00', '–']);
    expect(apoio?.linhas[1]).toEqual(['2 · pé esquerdo', '–', '23,00']);
    expect(laudo.medidasPorRepeticao.tabelas[0].colunas).toContain('Pé');
    expect(laudo.cabecalho.linhas.some((l) => l.rotulo === 'Passadas')).toBe(true);
  });

  it('com a análise sem repetições, o laudo sai inteiro e diz que nada foi identificado', () => {
    const vazia = analisarMovimento('agachamento_lateral', { fps: 30, largura: 640, altura: 480, quadros: [] });
    const laudo = montarLaudo(vazia, contexto(), BIBLIOTECA);
    expect(laudo.achados).toEqual([]);
    expect(laudo.resumo.paragrafos).toContain(frases.TEXTO_NENHUMA_REPETICAO);
    expect(laudo.resumo.paragrafos).toContain(frases.TEXTO_SEM_ACHADOS);
    expect(laudo.medidasPorRepeticao.paragrafos).toContain(frases.TEXTO_NENHUMA_REPETICAO);
    expect(laudo.metodo.paragrafos.join(' ')).toContain('Incerteza angular geral não estimada');
    expect(laudo.graficos).toEqual([]);
    expect(laudo.limitacoes.itens.length).toBeGreaterThan(3);
  });
});

// ---------- achados e biblioteca ----------

describe('laudo: achados, hipóteses e itens a conferir', () => {
  const p = protocoloDo('agachamento_lateral');
  const analise = analiseFixa('agachamento_lateral', [
    achado('assimetria_flexao_joelho', p, { lado: 'D', valoresPorLado: { D: 98.2, E: 91.4 }, valor: 6.8, incerteza: 2.1 }),
    achado('inclinacao_tronco', p, { gatilho: 'variacao_entre_repeticoes', lado: null, valor: 3.1, incerteza: 0.5 }),
    achado('avanco_joelho', p, { gatilho: 'repeticao_discrepante', lado: 'D', repeticoes: [2], valor: -12.4, unidade: '% do comprimento do pé', incerteza: 2.5 }),
  ]);
  const laudo = montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);

  it('descreve cada achado com título, descrição, valor, comparação com a incerteza, repetições e gatilho', () => {
    const [a1] = laudo.achados;
    expect(a1.titulo).toBe('Diferença entre os lados na flexão máxima do joelho');
    expect(a1.situacao).toBe('sem referência');
    expect(a1.medida).toContain('Medida: Flexão máxima do joelho.');
    expect(a1.medida).toContain('Valor do achado: 6,8°.');
    expect(a1.medida).toContain('Média por lado: D 98,2° · E 91,4°.');
    expect(a1.medida).toContain('Gatilho: diferença entre os lados.');
    expect(a1.incerteza).toBe('Incerteza estimada para este valor: ± 2,1°; o valor é maior que a incerteza estimada.');
    expect(a1.repeticoes).toBe('Repetições envolvidas: 1 a 4.');
    const [, a2, a3] = laudo.achados;
    expect(a2.repeticoes).toBe('Repetições envolvidas: 1 a 4.');
    expect(a3.repeticoes).toBe('Repetição discrepante: 3.');
    expect(a3.medida).toContain('Valor do achado: −12,4 % do comprimento do pé.');
    expect(a3.titulo).toBe('Avanço do joelho em relação à ponta do pé (observação medida) (lado direito)');
  });

  it('o título do achado nomeia a medida e o lado quando o catálogo não o faz', () => {
    const t = achado('tendencia_na_serie', p, { gatilho: 'tendencia_primeira_ultima', medida: 'flexao_quadril_max', lado: 'E', valor: 5.9, repeticoes: [0, 3] });
    const l = montarLaudo(analiseFixa('agachamento_lateral', [t]), contexto(), BIBLIOTECA_FIXA);
    expect(l.achados[0].titulo).toBe('Mudança de uma medida da primeira para a última repetição: Flexão máxima do quadril (lado esquerdo)');
    expect(l.achados[0].repeticoes).toBe('Repetições comparadas: a primeira e a última com valor (1 e 4).');
    expect(l.resumo.itens[0]).toContain('Flexão máxima do quadril (lado esquerdo)');
  });

  it('medida sem par D/E (deslocamento da pelve) diz para que lado o valor aponta, em vez de "média por lado"', () => {
    const f = protocoloDo('agachamento_frontal');
    const pelve = achado('desvio_lateral_pelve', f, { lado: 'E', valoresPorLado: { E: -3.2 }, valor: 3.2, incerteza: 1.1 });
    const l = montarLaudo(analiseFixa('agachamento_frontal', [pelve]), contexto(), BIBLIOTECA_FIXA);
    expect(l.achados[0].medida).toContain('Média: 3,2 % da base de apoio, para o lado esquerdo do paciente.');
    expect(l.achados[0].medida).not.toContain('Média por lado');
    expect(l.achados[0].titulo).toBe('Deslocamento lateral da pelve em relação à base de apoio');
  });

  it('achado dentro da incerteza diz que está dentro da incerteza do vídeo; sem incerteza estimada, diz que não comparou', () => {
    const l = montarLaudo(analiseFixa('agachamento_lateral', [
      achado('inclinacao_tronco', p, { superaIncerteza: false, valor: 0.4, incerteza: 0.9 }),
      achado('inclinacao_tronco', p, { incerteza: null, superaIncerteza: false }),
    ]), contexto(), BIBLIOTECA_FIXA);
    expect(l.achados[0].incerteza).toContain('está dentro da incerteza do vídeo');
    expect(l.achados[1].incerteza).toBe('Incerteza não estimada para esta medida: sem comparação com a incerteza do vídeo.');
  });

  it('traz as hipóteses da biblioteca com a força da evidência, as fontes numeradas e a população', () => {
    const [a1] = laudo.achados;
    expect(a1.semBiblioteca).toBe(false);
    expect(a1.hipoteses).toHaveLength(3);
    expect(a1.hipoteses[0]).toMatchObject({ forca: 'estudo observacional', referencias: [1, 2] });
    expect(a1.hipoteses[0].texto).toBe('Uma limitação de mobilidade pode contribuir para a diferença medida.');
    expect(a1.hipoteses[0].ressalva).toContain('Estudo transversal; não prova causa.');
    expect(a1.hipoteses[0].ressalva).toContain('População dos estudos: [1] 20 adultos saudaveis; agachamento bipodal.');
    expect(a1.hipoteses[0].ressalva).not.toContain('[2] ');
    expect(laudo.referencias.map((r) => [r.numero, r.fonte.pmid])).toEqual([[1, '11111111'], [2, '22222222']]);
  });

  it('hipótese a confirmar não cita referência, e a força só vale com a fonte que a sustenta', () => {
    const [a1] = laudo.achados;
    expect(a1.hipoteses[1]).toMatchObject({ forca: 'a confirmar', referencias: [] });
    expect(a1.hipoteses[2]).toMatchObject({ forca: 'a confirmar', referencias: [] });
  });

  it('numera as fontes na ordem de uso e reaproveita o número da mesma fonte em outro achado', () => {
    const [a1, a2] = laudo.achados;
    expect(a1.conferir).toEqual([
      { texto: 'Medir a mobilidade nos dois lados.', referencia: 1, semReferenciaVerificada: false },
      { texto: 'Conferir o calçado.', semReferenciaVerificada: true },
    ]);
    expect(a2.hipoteses[0].referencias).toEqual([1]);
    expect(laudo.referencias).toHaveLength(2);
  });

  it('achado sem entrada na biblioteca declara que não há hipóteses curadas, sem improvisar causa', () => {
    const [, , a3] = laudo.achados;
    expect(a3.semBiblioteca).toBe(true);
    expect(a3.hipoteses).toEqual([]);
    expect(a3.conferir).toEqual([]);
    expect(frases.TEXTO_SEM_BIBLIOTECA).toContain('sem referência verificada');
    expect(frases.TEXTO_SEM_BIBLIOTECA).toContain('Não há hipóteses curadas');
    const vazia = montarLaudo(analise, contexto(), {});
    for (const a of vazia.achados) {
      expect(a.semBiblioteca).toBe(true);
      expect(a.hipoteses).toEqual([]);
    }
    expect(vazia.referencias).toEqual([]);
  });

  it('chave herdada do objeto não é tratada como entrada da biblioteca', () => {
    const herdada = Object.create({ assimetria_flexao_joelho: BIBLIOTECA_FIXA.assimetria_flexao_joelho }) as Biblioteca;
    const l = montarLaudo(analise, contexto(), herdada);
    expect(l.achados[0].semBiblioteca).toBe(true);
  });

  it('o avanço do joelho leva a nota de que o critério é debatido e nenhum limite vem definido', () => {
    const [, , a3] = laudo.achados;
    expect(a3.notaCriterio).toBe(CATALOGO_ACHADOS.avanco_joelho.notaCriterio);
    expect(a3.notaCriterio).toContain('debatido');
    expect(laudo.achados[0].notaCriterio).toBeUndefined();
    expect(a3.situacao).toBe('sem referência');
  });

  it('copia as limitações do achado sem repetir frases', () => {
    expect(laudo.achados[0].limitacoes).toEqual(p.achados.find((a) => a.chave === 'assimetria_flexao_joelho')?.limitacoes);
  });
});

// ---------- critérios do profissional ----------

describe('laudo: critério do profissional', () => {
  const p = protocoloDo('agachamento_lateral');
  const criterio = criterioAtivo({ fonte: FONTE_CRITERIO });
  const achadoCriterio = achado('assimetria_flexao_joelho', p, {
    gatilho: 'criterio_profissional', titulo: `Critério do profissional: ${criterio.rotulo}`, situacao: 'fora_do_criterio', valor: 12, incerteza: 1.5,
    valoresPorLado: { D: 103.3, E: 91.4 }, lado: 'D', veredito: { situacao: 'fora_do_criterio', criterio },
    descricao: `${criterio.rotulo}: valor medido de 12,0°, fora do critério. Critério definido por ${criterio.definidoPor} sobre repetições.`,
  });
  const laudo = montarLaudo(analiseFixa('agachamento_lateral', [achadoCriterio]), contexto({ criterios: [criterio] }), BIBLIOTECA_FIXA);

  it('mostra o veredito e quem definiu o critério, no achado e no método', () => {
    const a = laudo.achados[0];
    expect(a.situacao).toBe('fora do critério');
    expect(a.medida).toContain('Critério: diferença entre os lados ≤ 5°, definido por Dra. Ana Souza.');
    expect(a.descricao).toContain('Dra. Ana Souza');
    const tab = laudo.metodo.tabelas.find((t) => t.titulo === 'Critérios do profissional usados');
    expect(tab?.colunas).toEqual(['Critério', 'Medida', 'Limite', 'Definido por', 'Fonte', 'Resultado']);
    expect(tab?.linhas).toEqual([['diferença entre os lados ≤ 5°', 'Flexão máxima do joelho', '≤ 5,0°', 'Dra. Ana Souza', '[3]', 'fora do critério']]);
    expect(laudo.resumo.paragrafos.join(' ')).toContain('1 critério definido pelo profissional foi usado');
  });

  it('a fonte do critério entra na lista de referências, numerada depois das hipóteses', () => {
    expect(laudo.referencias.map((r) => r.fonte.pmid)).toEqual(['11111111', '22222222', '33333333']);
  });

  it('sem critério usado, diz que os valores são observações e não imprime a regra do critério nem palavras de veredito', () => {
    const sem = montarLaudo(analiseFixa('agachamento_lateral', [achado('inclinacao_tronco', p, { gatilho: 'variacao_entre_repeticoes' })]), contexto(), BIBLIOTECA);
    expect(sem.metodo.paragrafos).toContain(frases.TEXTO_SEM_CRITERIOS);
    expect(sem.metodo.tabelas.map((t) => t.titulo)).not.toContain('Critérios do profissional usados');
    expect(sem.metodo.tabelas[0].linhas.map((l) => l[0])).not.toContain(GATILHOS.criterio_profissional.nome);
    const todas = textos(sem, new Set(['achado', 'referencias', 'grafico', 'hipoteses', 'conferir']));
    for (const t of todas) expect(t).not.toMatch(VEREDITO);
  });

  it('critério desligado não é citado; critério ativo sem responsável ou em outra medida aparece como não aplicado', () => {
    const desligado = criterioAtivo({ ativo: false });
    const semAutor = criterioAtivo({ id: 'c2', definidoPor: '   ', rotulo: 'sem autor' });
    const outraMedida = criterioAtivo({ id: 'c3', chave: 'avanco_joelho', metrica: 'flexao_joelho_max', rotulo: 'medida trocada' });
    const l = montarLaudo(analiseFixa(), contexto({ criterios: [desligado, semAutor, outraMedida] }), BIBLIOTECA_FIXA);
    expect(l.metodo.tabelas.map((t) => t.titulo)).not.toContain('Critérios do profissional usados');
    expect(l.metodo.paragrafos).toContain(frases.TEXTO_SEM_CRITERIOS);
    expect(l.metodo.itens).toEqual([
      'Critério ativo não aplicado: sem autor. Motivo: falta valor numérico ou a identificação de quem definiu o critério.',
      'Critério ativo não aplicado: medida trocada. Motivo: a medida escolhida não pertence a este protocolo ou exige outro plano de câmera.',
    ]);
    expect(JSON.stringify(l)).not.toContain('Dra. Ana Souza');
  });

  it('critério usado sem achado correspondente aparece com "sem valor medido para comparar"', () => {
    const l = montarLaudo(analiseFixa(), contexto({ criterios: [criterioAtivo()] }), BIBLIOTECA_FIXA);
    expect(l.metodo.tabelas.find((t) => t.titulo === 'Critérios do profissional usados')?.linhas[0][5]).toBe('sem valor medido para comparar');
    expect(l.metodo.tabelas.find((t) => t.titulo === 'Critérios do profissional usados')?.linhas[0][4]).toBe('sem fonte informada');
  });
});

// ---------- indisponíveis, método, limitações ----------

describe('laudo: achados indisponíveis, método e limitações', () => {
  it('lateral: diz o que gravar de frente para avaliar o valgo e o deslocamento da pelve', () => {
    const l = montarLaudo(analiseFixa('agachamento_lateral'), contexto(), BIBLIOTECA_FIXA);
    expect(l.indisponiveis.itens).toHaveLength(2);
    expect(l.indisponiveis.itens[0]).toContain('Para avaliar valgo dinâmico do joelho: desvio medido na descida, grave de frente.');
    expect(l.indisponiveis.itens[1]).toContain('Para avaliar deslocamento lateral da pelve em relação à base de apoio, grave de frente.');
    expect(l.indisponiveis.itens[0]).toContain('Exige vista frontal; este vídeo foi analisado em vista lateral');
    expect(l.indisponiveis.paragrafos.join(' ')).toContain('Grave também em vista frontal.');
    expect(l.indisponiveis.paragrafos).toHaveLength(2);
    expect(l.resumo.paragrafos.join(' ')).toContain('2 achados não foram avaliados porque o vídeo foi gravado de lado');
  });

  it('frontal: pede a gravação de lado; marcha: nada deixou de ser avaliado', () => {
    const f = montarLaudo(analiseFixa('agachamento_frontal'), contexto(), BIBLIOTECA_FIXA);
    expect(f.indisponiveis.itens).toHaveLength(5);
    expect(f.indisponiveis.itens.every((i) => i.includes('grave de lado.'))).toBe(true);
    expect(f.indisponiveis.itens[0]).toContain('Para avaliar diferença entre os lados na flexão máxima do joelho, grave de lado.');
    const m = montarLaudo(analiseFixa('marcha_lateral'), contexto(), BIBLIOTECA_FIXA);
    expect(m.indisponiveis.itens).toEqual([]);
    expect(m.indisponiveis.paragrafos).toEqual([frases.TEXTO_SEM_INDISPONIVEIS]);
  });

  it('o método traz a segmentação, a fórmula da incerteza, o que a incerteza não é e as regras dos gatilhos do protocolo', () => {
    const analise = analiseFixa('agachamento_lateral', [achado('inclinacao_tronco', protocoloDo('agachamento_lateral'), { gatilho: 'variacao_entre_repeticoes' })]);
    const l = montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);
    const texto = l.metodo.paragrafos.join('\n');
    expect(texto).toContain(protocoloDo('agachamento_lateral').segmentacao);
    expect(texto).toContain(analise.incerteza.formula);
    expect(texto).toContain(analise.incerteza.descricao);
    expect(texto).toContain('Incerteza angular geral estimada neste vídeo: ± 1,4°');
    const regras = l.metodo.tabelas[0];
    expect(regras.titulo).toBe('Regras que disparam um achado');
    expect(regras.linhas.map((r) => r[0])).toEqual([
      GATILHOS.assimetria_entre_lados.nome, GATILHOS.variacao_entre_repeticoes.nome, GATILHOS.tendencia_primeira_ultima.nome, GATILHOS.repeticao_discrepante.nome,
    ]);
    expect(regras.linhas[0][1]).toBe(GATILHOS.assimetria_entre_lados.regra);
    expect(regras.linhas.map((r) => r[2])).toEqual(['3', '3', '3', '4']);
    expect(regras.linhas.map((r) => r[3])).toEqual(['nenhum', '1', 'nenhum', 'nenhum']);
    expect(regras.legenda).toBe(frases.TEXTO_MINIMO_REPETICOES);
  });

  it('as limitações são as do protocolo, sem repetição', () => {
    for (const p of PROTOCOLOS) {
      const l = montarLaudo(analiseFixa(p.id), contexto(), BIBLIOTECA_FIXA);
      expect(l.limitacoes.itens).toEqual([...new Set(p.limitacoes)]);
      expect(l.limitacoes.itens.join(' ')).toContain('só vale no plano filmado');
    }
  });
});

// ---------- gráficos ----------

describe('laudo: gráficos ângulo × tempo', () => {
  it('traz um gráfico por grupo de articulação, com uma curva por lado e os pontos mais baixos como marcas', () => {
    const l = montarLaudo(analiseFixa('agachamento_lateral'), contexto(), BIBLIOTECA_FIXA);
    expect(l.graficos.map((g) => g.titulo)).toEqual([
      'Joelho: ângulo ao longo do tempo', 'Quadril: ângulo ao longo do tempo', 'Tornozelo: ângulo ao longo do tempo', 'Inclinação do tronco: ângulo ao longo do tempo',
    ]);
    const joelho = l.graficos[0].grafico;
    expect(joelho.series.map((s) => s.lado)).toEqual(['D', 'E']);
    expect(joelho.marcadores?.map((m) => m.tipo)).toEqual(['outro', 'outro', 'outro', 'outro']);
    expect(joelho.marcadores?.[0]).toMatchObject({ t: 0.5, legenda: 'ponto mais baixo da repetição' });
    expect(joelho.t0).toBe(0);
    expect(joelho.duracao).toBeCloseTo(119 / 30, 9);
    expect(l.graficos[0].legenda).toContain('Flexão do joelho');
    for (const g of l.graficos) {
      const layout = layoutDoGrafico(g.grafico.series, g.grafico.marcadores ?? [], g.grafico.bandas ?? [], { largura: 360, altura: 190, t0: g.grafico.t0, duracao: g.grafico.duracao, unidade: '°' });
      expect(layout.caminhos.length).toBeGreaterThan(0);
    }
  });

  it('na marcha, as marcas são os eventos de contato e saída do pé; repetição incompleta não gera marca', () => {
    const analise = analiseFixa('marcha_lateral', [], {
      eventos: [{ id: 'e1', lado: 'D', tipo: 'contato', i: 3, t: 0.1, sugerido: true }, { id: 'e2', lado: 'D', tipo: 'saida', i: 20, t: 0.7, sugerido: false }],
    });
    const l = montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);
    expect(l.graficos[0].grafico.marcadores?.map((m) => m.tipo)).toEqual(['contato', 'saida']);
    const agach = analiseFixa('agachamento_lateral');
    agach.repeticoes[3].sinalizadores = ['incompleta'];
    expect(montarLaudo(agach, contexto(), BIBLIOTECA_FIXA).graficos[0].grafico.marcadores).toHaveLength(3);
  });

  it('série sem valores não vira gráfico', () => {
    const analise = analiseFixa('agachamento_lateral');
    for (const id of Object.keys(analise.series)) analise.series[id] = analise.series[id].map((a) => ({ t: a.t, graus: null }));
    expect(montarLaudo(analise, contexto(), BIBLIOTECA_FIXA).graficos).toEqual([]);
  });
});

// ---------- modelos de frase ----------

describe('modelos de frase', () => {
  it('formata datas, taxas, listas de repetições e endereços de fontes', () => {
    expect(frases.dataBr('2026-10-18')).toBe('18/10/2026');
    expect(frases.dataBr('18 de outubro')).toBe('18 de outubro');
    expect(frases.fpsTexto(30)).toBe('30');
    expect(frases.fpsTexto(29.97)).toBe('29,97');
    expect(frases.fpsTexto(30.5)).toBe('30,5');
    expect(frases.listaDeNumeros([1, 2, 3, 4, 5])).toBe('1 a 5');
    expect(frases.listaDeNumeros([1, 2])).toBe('1 e 2');
    expect(frases.listaDeNumeros([2, 4, 6])).toBe('2, 4 e 6');
    expect(frases.listaDeNumeros([1, 2, 3, 5, 6])).toBe('1 a 3, 5 e 6');
    expect(frases.listaDeNumeros([3])).toBe('3');
    expect(frases.listaDeNumeros([])).toBe('');
    expect(frases.urlPubMed('22100617')).toBe('https://pubmed.ncbi.nlm.nih.gov/22100617/');
    expect(frases.urlPubMed('PMC123')).toBeNull();
    expect(frases.urlDoi('10.1123/jsr.21.2.144')).toBe('https://doi.org/10.1123/jsr.21.2.144');
    expect(frases.urlDoi('https://doi.org/10.1000/x')).toBe('https://doi.org/10.1000/x');
    expect(frases.urlDoi(undefined)).toBeNull();
    expect(frases.identificadoresDaFonte(FONTE_A).map((i) => i.rotulo)).toEqual(['PMID 11111111', 'DOI 10.1000/teste.a']);
    expect(frases.valorComSinal(3.2, '°')).toBe('+3,2°');
    expect(frases.valorComSinal(-3.2, '°')).toBe('−3,2°');
    expect(frases.valorComUnidade(0.123, 's')).toBe('0,12 s');
  });

  it('o aviso fixo e os rótulos são os do contrato', () => {
    expect(frases.AVISOS_FIXOS).toEqual(['Estimativa por vídeo · não é diagnóstico.', 'Hipóteses para confirmação na avaliação presencial.']);
    expect(frases.ROTULO_AVISO).toBe('Aviso');
  });
});

// ---------- vocabulário em todos os caminhos de texto ----------

describe('laudo: vocabulário em todos os caminhos de texto', () => {
  const todosOsProtocolos = PROTOCOLOS.map((p) => p.id);
  const criterioDe = (id: IdProtocolo) => {
    const ap = protocoloDo(id).achados.find((a) => a.planoExigido === protocoloDo(id).planoFilmado && a.medidas.length);
    return criterioAtivo({ chave: ap?.chave, metrica: ap?.medidas[0], fonte: FONTE_CRITERIO });
  };

  it('nenhuma frase gerada tem termo de julgamento, verbo causal ou caractere que o PDF não imprime (fixtures de todos os gatilhos e situações)', () => {
    for (const id of todosOsProtocolos) {
      for (const biblioteca of [BIBLIOTECA_FIXA, {}]) {
        const laudo = montarLaudo(analiseDeTodosOsCaminhos(id), contexto({ criterios: [criterioDe(id)], paciente: 'Maria', profissional: 'Dr. João' }), biblioteca);
        expect(laudo.achados.length).toBeGreaterThan(5);
        for (const t of textos(laudo, SO_FRASES_DO_LAUDO)) {
          expect(termoProibido(t), t).toBeNull();
          expect(PDF_SEGURO.test(t), t).toBe(true);
        }
        for (const t of textos(laudo, SEM_BIBLIOTECA)) expect(VERBO_CAUSAL.test(t), t).toBe(false);
      }
    }
  });

  it('o mesmo vale com a biblioteca real e com a análise do motor real', () => {
    const casos: [IdProtocolo, ReturnType<typeof trilhaAgachamentoLateral>][] = [
      ['agachamento_lateral', trilhaAgachamentoLateral({ reps: 5, ruidoPx: 0.6, flexao: (l, r) => (l === 'D' ? 100 : 86) + r * 2, dorsiflexao: (l) => (l === 'D' ? 24 : 14) })],
      ['agachamento_frontal', trilhaAgachamentoFrontal({ reps: 5, ruidoPx: 0.6, medial: (l, r) => (l === 'D' ? 0.05 + r * 0.01 : 0.01), pelve: () => 0.04 })],
      ['marcha_lateral', trilhaMarcha({ duracao: 14, ruidoPx: 0.6, apoio: { D: 0.64, E: 0.56 } })],
    ];
    for (const [id, trilha] of casos) {
      const criterio = criterioDe(id);
      const analise = analisarMovimento(id, trilha, { criterios: [criterio] });
      const laudo = montarLaudo(analise, contexto({ criterios: [criterio] }), BIBLIOTECA);
      expect(laudo.medidasPorRepeticao.tabelas.length).toBeGreaterThan(3);
      for (const t of textos(laudo, SO_FRASES_DO_LAUDO)) {
        expect(termoProibido(t), t).toBeNull();
        expect(PDF_SEGURO.test(t), t).toBe(true);
      }
      for (const t of textos(laudo, SEM_BIBLIOTECA)) expect(VERBO_CAUSAL.test(t), t).toBe(false);
    }
  });

  it('as constantes e modelos exportados por frases.ts passam pela mesma varredura', () => {
    const constantes = textos(Object.fromEntries(Object.entries(frases).filter(([, v]) => typeof v !== 'function')));
    expect(constantes.length).toBeGreaterThan(30);
    for (const t of constantes) {
      expect(termoProibido(t), t).toBeNull();
      expect(PDF_SEGURO.test(t), t).toBe(true);
      expect(VERBO_CAUSAL.test(t), t).toBe(false);
    }
  });

  it('o veredito só aparece quando há critério usado', () => {
    for (const id of todosOsProtocolos) {
      const semCriterio = montarLaudo(analiseFixa(id, achadosDeTodosOsCaminhos(id).filter((a) => a.gatilho !== 'criterio_profissional')), contexto(), BIBLIOTECA);
      for (const t of textos(semCriterio, SEM_BIBLIOTECA)) expect(t, t).not.toMatch(VEREDITO);
      expect(semCriterio.achados.every((a) => a.situacao === 'sem referência')).toBe(true);
    }
  });
});

// ---------- fluxo completo ----------

describe('laudo: fluxo completo com o motor e a biblioteca reais', () => {
  it('agachamento de lado com diferença entre os lados: o achado leva hipóteses com fonte e itens a conferir da biblioteca', () => {
    const trilha = trilhaAgachamentoLateral({ reps: 5, ruidoPx: 0.5, flexao: (l, r) => (l === 'D' ? 104 : 88) + r * 0.4 });
    const criterio = criterioAtivo();
    const analise = analisarMovimento('agachamento_lateral', trilha, { criterios: [criterio] });
    const laudo: LaudoMovimento = montarLaudo(analise, contexto({ criterios: [criterio] }), BIBLIOTECA);
    const a = laudo.achados.find((x) => x.achado.chave === 'assimetria_flexao_joelho' && x.achado.gatilho === 'assimetria_entre_lados');
    expect(a).toBeDefined();
    expect(a?.hipoteses.length).toBeGreaterThan(0);
    expect(a?.conferir.length).toBeGreaterThan(0);
    for (const h of a?.hipoteses ?? []) {
      if (h.forca === 'a confirmar') expect(h.referencias).toEqual([]);
      else expect(h.referencias.length).toBeGreaterThan(0);
    }
    const veredito = laudo.achados.find((x) => x.achado.gatilho === 'criterio_profissional');
    expect(veredito?.situacao).toBe('fora do critério');
    expect(laudo.referencias.length).toBeGreaterThan(0);
    for (const r of laudo.referencias) expect(r.fonte.pmid).toMatch(/^\d+$/);
    expect(laudo.graficos.length).toBe(4);
  });

  it('marcha: laudo com passadas por pé, achados da biblioteca e nenhum indisponível', () => {
    const analise = analisarMovimento('marcha_lateral', trilhaMarcha({ duracao: 16, ruidoPx: 0.5, apoio: { D: 0.66, E: 0.54 } }));
    const laudo = montarLaudo(analise, contexto(), BIBLIOTECA);
    expect(laudo.indisponiveis.itens).toEqual([]);
    expect(laudo.cabecalho.linhas.find((l) => l.rotulo === 'Passadas')?.valor).toMatch(/passadas/);
    expect(laudo.graficos[0].grafico.marcadores?.some((m) => m.tipo === 'contato')).toBe(true);
    const apoio = laudo.achados.find((x) => x.achado.chave === 'assimetria_tempo_apoio');
    expect(apoio?.titulo).toBe('Diferença entre os lados no tempo de apoio');
  });
});
