import { CATALOGO_ACHADOS, formulaDaIncerteza, indisponiveisDoProtocolo, novoCriterio, protocoloDo } from '../lib/angular/movimento';
import { resumir } from '../lib/angular/movimento/estatistica';
import type {
  Achado, AnaliseMovimento, Biblioteca, ChaveAchado, ContextoLaudo, CriterioProfissional, FonteBiblio, IdProtocolo, SituacaoCriterio, TipoGatilho,
} from '../lib/angular/movimento';

/*
 * Fixtures do laudo da Etapa 3 (agente L), compartilhadas pelos testes do texto e do PDF: análise escrita à mão no formato do contrato,
 * biblioteca pequena e achados de todos os gatilhos e situações. Nada aqui é dado clínico: são números inventados.
 */

export const FONTE_A: FonteBiblio = {
  pmid: '11111111', citacao: 'Autor A, Autor B. Titulo de teste. Rev Teste. 2020;1(1):1-9.', ano: 2020, periodico: 'Rev Teste', doi: '10.1000/teste.a',
  trecho: 'In this sample, the measured value was associated with the outcome.', populacao: '20 adultos saudaveis; agachamento bipodal', verificadoEm: '2026-10-18',
};
export const FONTE_B: FonteBiblio = {
  pmid: '22222222', citacao: 'Autor C. Outro titulo. Rev Teste. 2021;2(2):10-19.', ano: 2021, periodico: 'Rev Teste',
  trecho: 'A second excerpt copied from the abstract.', verificadoEm: '2026-10-18',
};
export const FONTE_CRITERIO: FonteBiblio = {
  pmid: '33333333', citacao: 'Autora D. Criterio definido em estudo. Rev Teste. 2022;3(3):20-29.', ano: 2022, periodico: 'Rev Teste', doi: 'https://doi.org/10.1000/criterio',
  trecho: 'A third excerpt.', verificadoEm: '2026-10-18',
};

export const BIBLIOTECA_FIXA: Biblioteca = {
  assimetria_flexao_joelho: {
    chave: 'assimetria_flexao_joelho', titulo: 'Diferença entre os lados',
    fatores: [
      { id: 'f1', texto: 'Uma limitação de mobilidade pode contribuir para a diferença medida.', forca: 'observacional', fontes: [FONTE_A, FONTE_B], ressalva: 'Estudo transversal; não prova causa.' },
      { id: 'f2', texto: 'O apoio dos pés pode contribuir para a diferença.', forca: 'a_confirmar', fontes: [], ressalva: 'Sem referência verificada nesta biblioteca.' },
      { id: 'f3', texto: 'Hipótese marcada com força, mas sem fonte, nunca ganha força de evidência.', forca: 'experimental', fontes: [], ressalva: 'Entrada incompleta de propósito.' },
    ],
    conferir: [
      { texto: 'Medir a mobilidade nos dois lados.', fonte: FONTE_A },
      { texto: 'Conferir o calçado.', semReferenciaVerificada: true },
    ],
  },
  inclinacao_tronco: {
    chave: 'inclinacao_tronco', titulo: 'Inclinação do tronco',
    fatores: [{ id: 'g1', texto: 'A posição do apoio pode contribuir para a inclinação medida.', forca: 'revisao_sistematica', fontes: [FONTE_A], ressalva: 'Revisão com amostras pequenas.' }],
    conferir: [{ texto: 'Observar a curvatura da coluna.', semReferenciaVerificada: true }],
  },
};

export const CONTEXTO: ContextoLaudo = {
  video: { nome: 'agachamento-teste.mp4', duracaoS: 17, largura: 640, altura: 480 }, data: '2026-10-18', taxaEfetivaFps: 30,
  quadrosChaveCorrigidos: 0, medidasManuaisForaDoTrecho: 0, responsavelRevisao: '', criterios: [],
};

export const contexto = (extra: Partial<ContextoLaudo> = {}): ContextoLaudo => ({ ...CONTEXTO, ...extra });

export function achado(chave: ChaveAchado, p: ReturnType<typeof protocoloDo>, extra: Partial<Achado> = {}): Achado {
  const ap = p.achados.find((a) => a.chave === chave);
  const medida = ap?.medidas[0] ?? 'flexao_joelho_max';
  const def = p.medidas.find((m) => m.id === medida);
  return {
    id: `${chave}:${medida}:x`, chave, titulo: CATALOGO_ACHADOS[chave].titulo, descricao: 'Medida descrita de forma neutra, maior que a incerteza estimada.', medida, lado: null,
    repeticoes: [0, 1, 2, 3], valor: 7.3, unidade: def?.unidade ?? '°', incerteza: 2.1, superaIncerteza: true, gatilho: 'assimetria_entre_lados', situacao: 'sem_referencia',
    planoCamera: p.planoFilmado, limitacoes: ap?.limitacoes ?? [], ...extra,
  };
}

/** Análise escrita à mão: 4 repetições e valores inventados, no formato exato do contrato. */
export function analiseFixa(id: IdProtocolo = 'agachamento_lateral', achados: Achado[] = [], extra: Partial<AnaliseMovimento> = {}): AnaliseMovimento {
  const p = protocoloDo(id);
  const marcha = p.gesto === 'marcha';
  const repeticoes = Array.from({ length: 4 }, (_, k) => ({
    numero: k + 1, lado: marcha ? (k % 2 === 0 ? ('D' as const) : ('E' as const)) : null, inicioI: k * 30, fundoI: k * 30 + 15, fimI: k * 30 + 30,
    inicioT: k, fundoT: k + 0.5, fimT: k + 1, duracao: 1, sinalizadores: [],
  }));
  const medidas = p.medidas.map((def, j) => {
    const base = 20 + j * 3;
    const serie = (desloc: number) => repeticoes.map((_, k) => base + desloc + k * 0.5);
    if (def.porLado && marcha) {
      return { def, valores: { D: repeticoes.map((r, k) => (r.lado === 'D' ? base + k : null)), E: repeticoes.map((r, k) => (r.lado === 'E' ? base + 2 + k : null)) }, incerteza: { D: 1.2, E: 1.1 }, avisos: [] };
    }
    if (def.porLado) return { def, valores: { D: serie(0), E: serie(4) }, incerteza: { D: 1.2, E: 1.1 }, avisos: [] };
    return { def, valores: { unico: serie(0) }, incerteza: { unico: 0.8 }, avisos: [] };
  });
  const resumos = Object.fromEntries(medidas.map((m) => [m.def.id, Object.fromEntries(Object.entries(m.valores).map(([l, v]) => [l, resumir(v)]))]));
  const series: AnaliseMovimento['series'] = {};
  for (const def of p.articulacoes) series[def.id] = Array.from({ length: 120 }, (_, i) => ({ t: i / 30, graus: 30 + 20 * Math.sin(i / 10) }));
  return {
    protocolo: id, planoFilmado: p.planoFilmado, direcao: 1, repeticoes, medidas, resumos, achados,
    indisponiveis: indisponiveisDoProtocolo(p), pontosPerdidos: { entradas: [], porPonto: [] },
    incerteza: { angularGraus: 1.4, quadroS: 1 / 30, nAmostras: 480, formula: formulaDaIncerteza(p), descricao: 'Estimada do próprio vídeo; não é intervalo de confiança.' },
    series, eventos: [], avisos: [], ...extra,
  };
}

export const criterioAtivo = (extra: Partial<CriterioProfissional> = {}): CriterioProfissional => ({
  ...novoCriterio({
    id: 'c1', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 5, unidade: '°', rotulo: 'diferença entre os lados ≤ 5°',
    definidoPor: 'Dra. Ana Souza',
  }),
  ativo: true, ...extra,
});

/** Achados de todos os gatilhos e de todas as situações, para exercitar todos os caminhos de texto. */
export function achadosDeTodosOsCaminhos(id: IdProtocolo): Achado[] {
  const p = protocoloDo(id);
  const lista: Achado[] = [];
  for (const ap of p.achados.filter((a) => a.planoExigido === p.planoFilmado)) {
    for (const g of CATALOGO_ACHADOS[ap.chave].gatilhos) {
      const base = { gatilho: g as TipoGatilho };
      if (g === 'criterio_profissional') {
        for (const situacao of ['dentro_do_criterio', 'no_limite', 'fora_do_criterio'] as SituacaoCriterio[]) {
          const c = { ...criterioAtivo({ chave: ap.chave, metrica: ap.medidas[0] }), id: `c-${ap.chave}-${situacao}` };
          lista.push(achado(ap.chave, p, {
            ...base, situacao, titulo: `Critério do profissional: ${c.rotulo}`, id: `${ap.chave}:${situacao}`, superaIncerteza: situacao !== 'no_limite',
            veredito: { situacao: situacao as Exclude<SituacaoCriterio, 'sem_referencia'>, criterio: c }, valoresPorLado: { D: 98.2, E: 91.4 }, equivalenteCm: 1.4,
          }));
        }
      } else if (g === 'tendencia_primeira_ultima') {
        lista.push(achado(ap.chave, p, { ...base, valor: -3.2, repeticoes: [0, 3], lado: 'E', id: `${ap.chave}:t:-`, equivalenteCm: null }));
        lista.push(achado(ap.chave, p, { ...base, valor: 3.2, repeticoes: [0, 3], lado: 'D', id: `${ap.chave}:t:+` }));
      } else if (g === 'repeticao_discrepante') {
        lista.push(achado(ap.chave, p, { ...base, valor: -9.9, repeticoes: [2], lado: 'D' }));
      } else if (g === 'assimetria_entre_lados') {
        lista.push(achado(ap.chave, p, { ...base, lado: 'D', valoresPorLado: { D: 98.2, E: 91.4 } }));
        lista.push(achado(ap.chave, p, { ...base, lado: 'E', valoresPorLado: { E: 12.5 }, incerteza: null, superaIncerteza: false, id: `${ap.chave}:u` }));
      } else {
        lista.push(achado(ap.chave, p, { ...base, lado: 'D', repeticoes: [1] }));
      }
    }
  }
  return lista;
}

export const analiseDeTodosOsCaminhos = (id: IdProtocolo): AnaliseMovimento => analiseFixa(id, achadosDeTodosOsCaminhos(id), {
  avisos: ['Foram identificadas 2 repetições completas: com menos de 3, a variação não é calculada.'],
});


// ---------- varredura de texto ----------

/** Todas as frases de um objeto, sem as chaves ignoradas. */
export function textos(o: unknown, ignorar: ReadonlySet<string> = new Set(), saida: string[] = []): string[] {
  if (typeof o === 'string') saida.push(o);
  else if (Array.isArray(o)) o.forEach((v) => textos(v, ignorar, saida));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) if (!ignorar.has(k)) textos(v, ignorar, saida);
  }
  return saida;
}

/** `achado` repete o dado bruto da análise; `referencias` traz citação e trecho de terceiros (em inglês), que não são frases do laudo. */
export const SO_FRASES_DO_LAUDO = new Set(['achado', 'referencias', 'grafico']);
/** Texto da biblioteca (hipóteses, ressalvas e itens a conferir) tem o próprio teste de vocabulário e fala em causa para negá-la. */
export const SEM_BIBLIOTECA = new Set([...SO_FRASES_DO_LAUDO, 'hipoteses', 'conferir']);

export const PDF_SEGURO = new RegExp('^[\\x20-\\x7E\\u00A0-\\u00FF≥≤−–—·→“”‘’]*$');
export const VERBO_CAUSAL =
  /\b(causa|causam|causou|causando|provoca|provocam|provocou|diagnostica|diagnosticam|determina|determinam|origina|originam|gera|geram|induz|induzem|resulta|resultam|resultou|leva a|levam a|levou a|responsável por|devido a)\b/i;
export const VEREDITO = /(dentro do critério|fora do critério|no limite)/i;

