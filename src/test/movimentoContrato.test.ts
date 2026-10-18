import { describe, expect, it } from 'vitest';
import * as movimento from '../lib/angular/movimento';
import {
  achadoDoCatalogo, achadosAvaliaveis, avaliarCriterio, BIBLIOTECA, CATALOGO_ACHADOS, CHAVES_ACHADO, criterioAplicavel, criterioValidoNoProtocolo, DESCRICAO_INCERTEZA,
  ehChaveAchado, entradaDaBiblioteca, faseDo, FORMULAS_INCERTEZA, formulaDaIncerteza, GATILHOS, indisponiveisDoProtocolo, medidaDo, novoCriterio, PROTOCOLOS, protocoloDo,
  protocolosDoGesto, ROTULO_FORCA, ROTULO_PLANO, ROTULO_SITUACAO, termoProibido,
  type AnaliseMovimento, type ChaveAchado, type ContextoLaudo, type CriterioProfissional, type IdProtocolo, type LaudoMovimento, type MarcoRepeticao, type TipoGatilho,
} from '../lib/angular/movimento';

/*
 * Contrato da Etapa 3 entre os agentes M (análise), L (laudo e PDF) e R (biblioteca de hipóteses): estes nomes, chaves e formatos
 * não podem mudar sem avisar os três. O teste não exercita a lógica de nenhum deles; só garante que o que cada um recebe existe.
 */

const CATALOGO_FIXO: ChaveAchado[] = [
  'assimetria_flexao_joelho', 'assimetria_flexao_quadril', 'assimetria_dorsiflexao', 'valgo_dinamico', 'desvio_lateral_pelve', 'inclinacao_tronco',
  'avanco_joelho', 'variacao_profundidade', 'tendencia_na_serie', 'assimetria_tempo_apoio', 'assimetria_flexao_joelho_marcha',
  'assimetria_amplitude_quadril', 'inclinacao_tronco_marcha',
];
const GATILHOS_FIXOS: TipoGatilho[] = ['assimetria_entre_lados', 'variacao_entre_repeticoes', 'tendencia_primeira_ultima', 'repeticao_discrepante', 'criterio_profissional'];
const MARCOS: MarcoRepeticao[] = ['inicio', 'fundo', 'fim'];
const IDS: IdProtocolo[] = ['agachamento_lateral', 'agachamento_frontal', 'marcha_lateral'];

/** Todas as frases do conteúdo de produto (sem as definições de ângulo do motor, que não são deste contrato). */
function textos(o: unknown, saida: string[] = []): string[] {
  if (typeof o === 'string') saida.push(o);
  else if (Array.isArray(o)) o.forEach((v) => textos(v, saida));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) if (k !== 'articulacoes') textos(v, saida);
  }
  return saida;
}

describe('API pública da Etapa 3', () => {
  it('exporta, por um único ponto de entrada, tudo o que M, L e R usam', () => {
    const funcoes = [
      'analisarMovimento', 'montarLaudo', 'gerarPdfLaudo', 'entradaDaBiblioteca', 'protocoloDo', 'protocolosDoGesto', 'achadosAvaliaveis', 'indisponiveisDoProtocolo',
      'formulaDaIncerteza', 'achadoDoCatalogo', 'ehChaveAchado', 'medidaDo', 'faseDo', 'novoCriterio', 'criterioAplicavel', 'criterioValidoNoProtocolo', 'avaliarCriterio',
      'termoProibido',
    ];
    for (const nome of funcoes) expect(typeof (movimento as Record<string, unknown>)[nome], nome).toBe('function');
    for (const nome of ['PROTOCOLOS', 'CATALOGO_ACHADOS', 'GATILHOS', 'FORMULAS_INCERTEZA', 'BIBLIOTECA', 'ROTULO_SITUACAO', 'ROTULO_FORCA', 'ROTULO_LADO', 'ROTULO_PLANO']) {
      expect((movimento as Record<string, unknown>)[nome], nome).toBeTruthy();
    }
  });
});

describe('catálogo de achados', () => {
  it('tem exatamente as 13 chaves combinadas e cada definição repete a própria chave', () => {
    expect([...CHAVES_ACHADO].sort()).toEqual([...CATALOGO_FIXO].sort());
    for (const chave of CATALOGO_FIXO) {
      expect(achadoDoCatalogo(chave).chave).toBe(chave);
      expect(ehChaveAchado(chave)).toBe(true);
    }
    expect(ehChaveAchado('toString')).toBe(false);
    expect(ehChaveAchado('inventado')).toBe(false);
  });

  it('usa só gatilhos conhecidos e aceita critério do profissional em todos', () => {
    for (const def of Object.values(CATALOGO_ACHADOS)) {
      expect(def.gatilhos.length, def.chave).toBeGreaterThan(0);
      for (const g of def.gatilhos) expect(GATILHOS_FIXOS, `${def.chave}:${g}`).toContain(g);
      expect(def.gatilhos, def.chave).toContain('criterio_profissional');
      expect(def.titulo.length, def.chave).toBeGreaterThan(0);
    }
  });

  it('só o avanço do joelho é critério debatido (desligado por padrão, com a nota)', () => {
    const debatidos = Object.values(CATALOGO_ACHADOS).filter((d) => d.criterioDebatido).map((d) => d.chave);
    expect(debatidos).toEqual(['avanco_joelho']);
    expect(CATALOGO_ACHADOS.avanco_joelho.notaCriterio).toMatch(/desligado/);
  });

  it('define os cinco gatilhos, cada um com regra escrita e mínimo de repetições', () => {
    expect(Object.keys(GATILHOS).sort()).toEqual([...GATILHOS_FIXOS].sort());
    for (const [tipo, g] of Object.entries(GATILHOS)) {
      expect(g.tipo).toBe(tipo);
      expect(g.regra.length, tipo).toBeGreaterThan(20);
      expect(g.minimoRepeticoes, tipo).toBeGreaterThanOrEqual(1);
    }
    expect(GATILHOS.criterio_profissional.regra).toMatch(/desligado/);
  });
});

describe('protocolos', () => {
  it('existem os três, na ordem esperada, e protocoloDo os encontra', () => {
    expect(PROTOCOLOS.map((p) => p.id)).toEqual(IDS);
    for (const id of IDS) expect(protocoloDo(id).id).toBe(id);
    expect(() => protocoloDo('inventado' as IdProtocolo)).toThrow();
  });

  it('protocolosDoGesto agrupa por gesto do motor', () => {
    expect(protocolosDoGesto('agachamento').map((p) => p.id)).toEqual(['agachamento_lateral', 'agachamento_frontal']);
    expect(protocolosDoGesto('marcha').map((p) => p.id)).toEqual(['marcha_lateral']);
    expect(protocolosDoGesto('corrida')).toEqual([]);
  });

  it.each(IDS)('%s: todo achado pertence ao catálogo, sem repetição', (id) => {
    const p = protocoloDo(id);
    const chaves = p.achados.map((a) => a.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const a of p.achados) {
      expect(CATALOGO_FIXO, `${id}:${a.chave}`).toContain(a.chave);
      expect(['lateral', 'frontal']).toContain(a.planoExigido);
    }
  });

  it.each(IDS)('%s: fases, medidas e achados se referenciam sem furos', (id) => {
    const p = protocoloDo(id);
    const idsFase = p.fases.map((f) => f.id);
    expect(new Set(idsFase).size).toBe(idsFase.length);
    for (const f of p.fases) {
      expect(MARCOS).toContain(f.de);
      expect(MARCOS).toContain(f.ate);
      expect(MARCOS.indexOf(f.de), f.id).toBeLessThanOrEqual(MARCOS.indexOf(f.ate));
    }
    const idsMedida = p.medidas.map((m) => m.id);
    expect(new Set(idsMedida).size).toBe(idsMedida.length);
    for (const m of p.medidas) {
      const fase = faseDo(p, m.fase);
      expect(fase, `${m.id} → fase ${m.fase}`).toBeDefined();
      if (m.extracao === 'valor_no_marco') expect(fase?.de, m.id).toBe(fase?.ate);
      if (m.extracao === 'duracao') expect(m.grandeza, m.id).toBe('tempo');
      expect(m.formula.length, m.id).toBeGreaterThan(10);
      expect(medidaDo(p, m.id)).toBe(m);
    }
    for (const a of achadosAvaliaveis(p)) {
      expect(a.planoExigido).toBe(p.planoFilmado);
      expect(a.medidas.length, a.chave).toBeGreaterThan(0);
      for (const idM of a.medidas) {
        const m = medidaDo(p, idM);
        expect(m, `${a.chave} → medida ${idM}`).toBeDefined();
        expect(m?.planoCamera, `${a.chave} → ${idM}`).toBe(a.planoExigido);
      }
    }
    expect(p.articulacoes.length).toBeGreaterThan(0);
    expect(p.limitacoes.length).toBeGreaterThan(3);
    expect(p.segmentacao.length).toBeGreaterThan(20);
    expect(p.gravacao[p.planoFilmado]?.length).toBeGreaterThan(0);
    expect(p.fpsSugerido).toBeGreaterThan(0);
  });

  it('cada chave do catálogo é produzida por pelo menos um protocolo no plano certo', () => {
    for (const chave of CATALOGO_FIXO) {
      const produz = PROTOCOLOS.some((p) => achadosAvaliaveis(p).some((a) => a.chave === chave));
      expect(produz, chave).toBe(true);
    }
  });

  it('achados de outro plano de câmera viram indisponíveis, com o que gravar', () => {
    const lateral = indisponiveisDoProtocolo(protocoloDo('agachamento_lateral'));
    expect(lateral.map((i) => i.chave).sort()).toEqual(['desvio_lateral_pelve', 'valgo_dinamico']);
    const frontal = indisponiveisDoProtocolo(protocoloDo('agachamento_frontal'));
    expect(frontal.map((i) => i.chave).sort()).toEqual(
      ['assimetria_dorsiflexao', 'assimetria_flexao_joelho', 'assimetria_flexao_quadril', 'avanco_joelho', 'inclinacao_tronco'],
    );
    expect(indisponiveisDoProtocolo(protocoloDo('marcha_lateral'))).toEqual([]);
    for (const i of [...lateral, ...frontal]) {
      expect(i.planoExigido).not.toBe(i.planoFilmado);
      expect(i.motivo).toContain(ROTULO_PLANO[i.planoExigido]);
      expect(i.comoObter).toContain(ROTULO_PLANO[i.planoExigido]);
      expect(i.comoObter.length).toBeGreaterThan(40);
    }
  });

  it('a fórmula da incerteza cita só as grandezas que o protocolo usa', () => {
    expect(formulaDaIncerteza(protocoloDo('agachamento_lateral'))).toContain(FORMULAS_INCERTEZA.angulo);
    expect(formulaDaIncerteza(protocoloDo('agachamento_lateral'))).toContain(FORMULAS_INCERTEZA.tempo);
    expect(formulaDaIncerteza(protocoloDo('marcha_lateral'))).not.toContain(FORMULAS_INCERTEZA.deslocamento);
    expect(DESCRICAO_INCERTEZA).toMatch(/erro sistemático/);
  });

  it('as limitações do protocolo trazem as ressalvas do 2D, do erro de um quadro e da curvatura lombar', () => {
    for (const p of PROTOCOLOS) {
      const todas = p.limitacoes.join(' ');
      expect(todas, p.id).toMatch(/duas dimensões/);
      expect(todas, p.id).toMatch(/um quadro/);
      expect(todas, p.id).toMatch(/curvatura da coluna \(inclusive a lombar\)/);
    }
  });
});

describe('vocabulário e texto seguro para PDF', () => {
  it('nenhum texto do contrato julga o corpo ou o desempenho', () => {
    const conteudo = textos([CATALOGO_ACHADOS, GATILHOS, PROTOCOLOS, FORMULAS_INCERTEZA, DESCRICAO_INCERTEZA, ROTULO_SITUACAO, ROTULO_FORCA, ROTULO_PLANO]);
    expect(conteudo.length).toBeGreaterThan(100);
    for (const s of conteudo) expect(termoProibido(s), s).toBeNull();
  });

  it('o detector de vocabulário pega o que deve e deixa passar "normalizada"', () => {
    for (const s of ['resultado perfeito', 'agachamento errado', 'valor anormal', 'falha técnica', 'movimento bom']) expect(termoProibido(s), s).not.toBeNull();
    expect(termoProibido('série normalizada pela coxa')).toBeNull();
  });

  it('só usa caracteres que o gerador de PDF imprime (Latin-1 e os que ele converte)', () => {
    const permitido = new RegExp('^[\\x20-\\x7E\\u00A0-\\u00FF≥≤−–—·→“”‘’]*$');
    const conteudo = textos([CATALOGO_ACHADOS, GATILHOS, PROTOCOLOS, FORMULAS_INCERTEZA, DESCRICAO_INCERTEZA, ROTULO_SITUACAO, ROTULO_FORCA, ROTULO_PLANO]);
    for (const s of conteudo) expect(permitido.test(s), s).toBe(true);
  });

  it('usa o vocabulário combinado para a situação do critério', () => {
    expect(ROTULO_SITUACAO).toEqual({ dentro_do_criterio: 'dentro do critério', no_limite: 'no limite', fora_do_criterio: 'fora do critério', sem_referencia: 'sem referência' });
  });
});

describe('critério do profissional', () => {
  const base = {
    id: 'c1', chave: 'assimetria_flexao_joelho' as const, metrica: 'flexao_joelho_max', operador: '<=' as const, valor: 5, unidade: '°',
    rotulo: 'diferença entre os lados ≤ 5°', definidoPor: 'Profissional de teste',
  };

  it('nasce sempre desligado e só se aplica ligado, com limite numérico e responsável', () => {
    const c = novoCriterio(base);
    expect(c.ativo).toBe(false);
    expect(criterioAplicavel(c)).toBe(false);
    expect(criterioAplicavel({ ...c, ativo: true })).toBe(true);
    expect(criterioAplicavel({ ...c, ativo: true, definidoPor: '  ' })).toBe(false);
    expect(criterioAplicavel({ ...c, ativo: true, valor: Number.NaN })).toBe(false);
  });

  it('só vale para uma medida que o achado realmente usa no protocolo', () => {
    const c = novoCriterio(base);
    expect(criterioValidoNoProtocolo(c, 'agachamento_lateral')).toBe(true);
    expect(criterioValidoNoProtocolo(c, protocoloDo('agachamento_lateral'))).toBe(true);
    expect(criterioValidoNoProtocolo({ ...c, metrica: 'valgo_joelho_max' }, 'agachamento_lateral')).toBe(false);
    expect(criterioValidoNoProtocolo(c, 'agachamento_frontal')).toBe(false);
    expect(criterioValidoNoProtocolo({ ...c, chave: 'valgo_dinamico', metrica: 'valgo_joelho_max' }, 'agachamento_frontal')).toBe(true);
    expect(criterioValidoNoProtocolo({ ...c, chave: 'valgo_dinamico', metrica: 'valgo_joelho_max' }, 'agachamento_lateral')).toBe(false);
  });

  it('o veredito leva a incerteza em conta: dentro, no limite, fora ou sem referência', () => {
    const lim = { operador: '<=' as const, valor: 12 };
    expect(avaliarCriterio(10, 1, lim)).toBe('dentro_do_criterio');
    expect(avaliarCriterio(12, 1, lim)).toBe('no_limite');
    expect(avaliarCriterio(14, 1, lim)).toBe('fora_do_criterio');
    expect(avaliarCriterio(null, 1, lim)).toBe('sem_referencia');
    expect(avaliarCriterio(10, null, { operador: '>=', valor: 12 })).toBe('fora_do_criterio');
    expect(avaliarCriterio(13, null, { operador: '>=', valor: 12 })).toBe('dentro_do_criterio');
  });
});

describe('biblioteca de hipóteses (agente R)', () => {
  it('não devolve entrada para chave ausente nem para nomes herdados do objeto', () => {
    expect(entradaDaBiblioteca('inventado')).toBeNull();
    expect(entradaDaBiblioteca('constructor')).toBeNull();
  });

  it('toda entrada preenchida respeita as regras de fonte, ressalva e vocabulário', () => {
    for (const [chave, e] of Object.entries(BIBLIOTECA)) {
      expect(ehChaveAchado(chave), chave).toBe(true);
      expect(e.chave, chave).toBe(chave);
      expect(entradaDaBiblioteca(chave)).toBe(e);
      for (const f of e.fatores) {
        expect(f.ressalva.trim().length, `${chave}:${f.id}`).toBeGreaterThan(0);
        if (f.forca !== 'a_confirmar') expect(f.fontes.length, `${chave}:${f.id}`).toBeGreaterThan(0);
        for (const fonte of f.fontes) {
          expect(fonte.pmid, `${chave}:${f.id}`).toMatch(/^\d+$/);
          expect(fonte.trecho.trim().length, `${chave}:${f.id}`).toBeGreaterThan(0);
        }
      }
      for (const c of e.conferir) expect(!!c.fonte || c.semReferenciaVerificada === true, `${chave}: ${c.texto}`).toBe(true);
      const proprios = textos([e.titulo, e.fatores.map((f) => [f.texto, f.ressalva]), e.conferir.map((c) => c.texto)]);
      for (const s of proprios) expect(termoProibido(s), s).toBeNull();
    }
  });
});

describe('formatos dos tipos', () => {
  it('aceitam os formatos documentados (verificação de compilação)', () => {
    const criterio: CriterioProfissional = novoCriterio({
      id: 'c1', chave: 'inclinacao_tronco', metrica: 'inclinacao_tronco_fundo', operador: '<', valor: 30, unidade: '°', rotulo: 'média < 30°', definidoPor: 'Profissional de teste',
    });
    const analise: AnaliseMovimento = {
      protocolo: 'agachamento_lateral', planoFilmado: 'lateral', direcao: 1,
      repeticoes: [{ numero: 1, lado: null, inicioI: 0, fundoI: 5, fimI: 10, inicioT: 0, fundoT: 0.5, fimT: 1, duracao: 1, sinalizadores: [] }],
      medidas: [{ def: protocoloDo('agachamento_lateral').medidas[0], valores: { D: [90], E: [88] }, incerteza: { D: 1, E: 1 }, avisos: [] }],
      resumos: { flexao_joelho_max: { D: { n: 1, media: 90, dp: null, mediana: 90, min: 90, max: 90, primeira: 90, ultima: 90, iPrimeira: 0, iUltima: 0, tendencia: null } } },
      achados: [{
        id: 'a1', chave: 'assimetria_flexao_joelho', titulo: 'x', descricao: 'x', medida: 'flexao_joelho_max', lado: 'D', repeticoes: [0], valor: 2, unidade: '°',
        valoresPorLado: { D: 90, E: 88 }, incerteza: 1, superaIncerteza: true, gatilho: 'assimetria_entre_lados', situacao: 'sem_referencia', planoCamera: 'lateral', limitacoes: [],
      }],
      indisponiveis: [], incerteza: { angularGraus: 1, quadroS: 0.066, nAmostras: 100, formula: 'x', descricao: 'x' }, series: {}, eventos: [], avisos: [],
    };
    const contexto: ContextoLaudo = {
      video: { nome: 'agachamento.mp4' }, data: '2026-10-18', taxaEfetivaFps: 15, quadrosChaveCorrigidos: 0, medidasManuaisForaDoTrecho: 0, responsavelRevisao: '', criterios: [criterio],
    };
    const laudo: LaudoMovimento = {
      protocolo: 'agachamento_lateral', cabecalho: { titulo: 'x', subtitulo: 'x', etiqueta: 'beta', linhas: [] },
      resumo: { id: 'resumo', titulo: 'x', paragrafos: [], itens: [], tabelas: [] }, medidasPorRepeticao: { id: 'medidas', titulo: 'x', paragrafos: [], itens: [], tabelas: [] },
      achados: [], indisponiveis: { id: 'indisponiveis', titulo: 'x', paragrafos: [], itens: [], tabelas: [] }, metodo: { id: 'metodo', titulo: 'x', paragrafos: [], itens: [], tabelas: [] },
      limitacoes: { id: 'limitacoes', titulo: 'x', paragrafos: [], itens: [], tabelas: [] }, graficos: [], referencias: [], rodape: 'Estimativa por vídeo · não é diagnóstico',
    };
    expect(analise.achados[0].chave).toBe('assimetria_flexao_joelho');
    expect(contexto.criterios[0].ativo).toBe(false);
    expect(laudo.rodape).toContain('não é diagnóstico');
  });
});
