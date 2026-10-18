import { gruposDeArticulacoes, marcadoresDeEventos, seriesDoGrupoDaAnalise } from '../analiseVideo/resultados';
import { notaMedidasForaDoTrecho } from '../analiseVideo/medidaManual';
import { AVISO_ESTIMATIVA_VIDEO } from '../analiseVideo/tiposUi';
import type { MarcadorGrafico } from '../analiseVideo/graficoLayout';
import { legendaDosAngulos } from '../video/angulos';
import { BIBLIOTECA } from './biblioteca';
import { criterioAplicavel, criterioValidoNoProtocolo } from './criterios';
import { finito, fmt } from './estatistica';
import {
  AVISOS_FIXOS, capitalizar, dataBr, ETIQUETA_BETA, fpsTexto, fraseAchadosPorGatilho, fraseCriteriosNoResumo, fraseIndisponiveisNoResumo, fraseParaAvaliar,
  fraseRepeticoesCompletas, fraseRepeticoesIdentificadas, INTRO_INDISPONIVEIS, INTRO_MEDIDAS, legendaDaMedida, LEGENDA_RESUMO_MEDIDAS, limiteDoCriterio,
  linhaResumoDoAchado, maisOuMenos, motivoCriterioNaoAplicado, numeroComCasas, ORDEM_GATILHOS, rotuloDaRepeticao, ROTULO_AVISO, ROTULO_RESPONSAVEL, ROTULO_SINALIZADOR, segundosTexto,
  TEXTO_MEDIDA_SEM_VALOR, TEXTO_MINIMO_REPETICOES, TEXTO_NENHUMA_REPETICAO, TEXTO_SEM_CRITERIOS, TEXTO_SEM_INDISPONIVEIS, textoIncertezaDoAchado, textoMedidaDoAchado,
  textoRepeticoesDoAchado, TITULO_LAUDO, tituloDoAchado, TITULOS, valorComUnidade, comPontoFinal,
} from './frases';
import { achadoDoCatalogo, achadosAvaliaveis, GATILHOS, medidaDo, faseDo, protocoloDo } from './protocolos';
import type {
  Achado, AchadoLaudo, AnaliseMovimento, Biblioteca, ChaveLado, ContextoLaudo, CriterioProfissional, EntradaBiblioteca, FonteBiblio, GraficoLaudo,
  HipoteseLaudo, ItemConferirLaudo, LaudoMovimento, MedidaPorRepeticao, Protocolo, ReferenciaLaudo, SecaoLaudo, TabelaLaudo, TipoGatilho,
} from './tipos';
import { ROTULO_FORCA, ROTULO_LADO, ROTULO_PLANO, ROTULO_SITUACAO } from './vocabulario';

/*
 * Laudo do profissional (agente L): AnaliseMovimento + ContextoLaudo + biblioteca curada → LaudoMovimento, tudo em texto pt-BR montado
 * por modelos de frase (frases.ts). Puro e determinístico: sem rede, sem modelo de linguagem, sem imagem do paciente.
 *
 * Princípios (docs/avaliacao-movimento-v3.md):
 *  - o laudo descreve medidas; só repete causas e itens a conferir que estão na biblioteca (chave sem entrada = "sem hipóteses curadas");
 *  - fator sem fonte verificada vai como "a confirmar", nunca com força de evidência que a fonte não sustenta;
 *  - veredito (dentro do critério, no limite, fora do critério) só com critério do profissional ativo, aplicável e válido no protocolo;
 *  - o aviso fixo ("Estimativa por vídeo · não é diagnóstico" e "Hipóteses para confirmação na avaliação presencial") fica no cabeçalho,
 *    em linhas de rótulo ROTULO_AVISO, e o rodapé repete o primeiro.
 *
 * Ordem do laudo: cabeçalho (com o aviso), resumo, medidas por repetição e por lado, [gráficos], achados, achados não avaliados,
 * método (incerteza, regras, critérios usados), limitações, referências e rodapé. `graficos` fica fora da sequência de seções porque
 * a tela e o PDF os desenham junto das medidas.
 */

/** Ids das seções de texto, na ordem em que o laudo as apresenta (os achados vêm entre `medidas` e `indisponiveis`). */
export const ID_SECAO = {
  resumo: 'resumo',
  medidas: 'medidas',
  indisponiveis: 'indisponiveis',
  metodo: 'metodo',
  limitacoes: 'limitacoes',
} as const;

const secao = (id: string, titulo: string, partes: Partial<Pick<SecaoLaudo, 'paragrafos' | 'itens' | 'tabelas'>> = {}): SecaoLaudo => ({
  id, titulo, paragrafos: partes.paragrafos ?? [], itens: partes.itens ?? [], tabelas: partes.tabelas ?? [],
});

const unicos = (v: readonly string[]): string[] => [...new Set(v.filter((x) => x.trim().length > 0))];

// ---------- referências numeradas ----------

/** Numera as fontes na ordem em que o laudo as cita; a mesma fonte (mesmo PMID) mantém o mesmo número. */
function registroDeReferencias() {
  const lista: ReferenciaLaudo[] = [];
  const porChave = new Map<string, number>();
  return {
    lista,
    numero(f: FonteBiblio): number {
      const chave = f.pmid.trim() || f.citacao;
      const existente = porChave.get(chave);
      if (existente !== undefined) return existente;
      const n = lista.length + 1;
      lista.push({ numero: n, fonte: f });
      porChave.set(chave, n);
      return n;
    },
  };
}
type Registro = ReturnType<typeof registroDeReferencias>;

const entradaDe = (biblioteca: Biblioteca, chave: string): EntradaBiblioteca | null =>
  Object.prototype.hasOwnProperty.call(biblioteca, chave) ? biblioteca[chave] : null;

// ---------- hipóteses e itens a conferir ----------

function hipotesesDaEntrada(entrada: EntradaBiblioteca, refs: Registro): HipoteseLaudo[] {
  return (entrada.fatores ?? []).map((f) => {
    // Sem fonte, nunca declara força de evidência: a força só vale com a fonte que a sustenta.
    const comFonte = f.forca !== 'a_confirmar' && (f.fontes ?? []).length > 0;
    const numeros = comFonte ? f.fontes.map((fonte) => refs.numero(fonte)) : [];
    const populacoes = comFonte
      ? f.fontes.flatMap((fonte, i) => (fonte.populacao && fonte.populacao.trim() ? [`[${numeros[i]}] ${fonte.populacao.trim().replace(/[.;]+$/, '')}`] : []))
      : [];
    const ressalva = populacoes.length ? `${comPontoFinal(f.ressalva)} População dos estudos: ${populacoes.join('; ')}.` : f.ressalva;
    return { texto: f.texto, forca: ROTULO_FORCA[comFonte ? f.forca : 'a_confirmar'], ressalva, referencias: numeros };
  });
}

function conferirDaEntrada(entrada: EntradaBiblioteca, refs: Registro): ItemConferirLaudo[] {
  return (entrada.conferir ?? []).map((item) => {
    if (item.fonte) return { texto: item.texto, referencia: refs.numero(item.fonte), semReferenciaVerificada: false };
    return { texto: item.texto, semReferenciaVerificada: true };
  });
}

// ---------- achados ----------

function achadoDoLaudo(a: Achado, analise: AnaliseMovimento, protocolo: Protocolo, biblioteca: Biblioteca, refs: Registro): AchadoLaudo {
  const def = achadoDoCatalogo(a.chave);
  const nomeDaMedida = medidaDo(protocolo, a.medida)?.nome ?? a.medida;
  const numeros = a.repeticoes.map((pos) => analise.repeticoes[pos]?.numero ?? pos + 1);
  const entrada = entradaDe(biblioteca, a.chave);
  const descricao = capitalizar(a.descricao.trim() || `${a.titulo}: ${valorComUnidade(a.valor, a.unidade)}.`);
  return {
    achado: a,
    titulo: tituloDoAchado(a, nomeDaMedida, protocolo.gesto === 'marcha'),
    descricao,
    situacao: ROTULO_SITUACAO[a.situacao],
    medida: textoMedidaDoAchado(a, nomeDaMedida),
    incerteza: textoIncertezaDoAchado(a),
    repeticoes: textoRepeticoesDoAchado(a.gatilho, numeros, protocolo.rotuloRepeticao),
    hipoteses: entrada ? hipotesesDaEntrada(entrada, refs) : [],
    conferir: entrada ? conferirDaEntrada(entrada, refs) : [],
    semBiblioteca: entrada === null,
    limitacoes: unicos(a.limitacoes),
    ...(def.criterioDebatido && def.notaCriterio ? { notaCriterio: def.notaCriterio } : {}),
  };
}

// ---------- cabeçalho ----------

function cabecalhoDoLaudo(analise: AnaliseMovimento, contexto: ContextoLaudo, protocolo: Protocolo): LaudoMovimento['cabecalho'] {
  const rot = protocolo.rotuloRepeticao;
  const completas = analise.repeticoes.filter((r) => !r.sinalizadores.includes('incompleta')).length;
  const v = contexto.video;
  const detalhesVideo = [
    v.largura && v.altura ? `${v.largura} × ${v.altura} px` : '',
    finito(v.duracaoS) ? `duração ${segundosTexto(v.duracaoS)}` : '',
  ].filter(Boolean);
  const linhas: { rotulo: string; valor: string }[] = [
    { rotulo: 'Vídeo', valor: detalhesVideo.length ? `${v.nome} (${detalhesVideo.join(', ')})` : v.nome },
    { rotulo: 'Data da análise', valor: dataBr(contexto.data) },
  ];
  if (contexto.paciente?.trim()) linhas.push({ rotulo: 'Paciente', valor: contexto.paciente.trim() });
  if (contexto.profissional?.trim()) linhas.push({ rotulo: 'Profissional', valor: contexto.profissional.trim() });
  linhas.push(
    { rotulo: 'Protocolo', valor: protocolo.nome },
    { rotulo: 'Plano de câmera', valor: ROTULO_PLANO[analise.planoFilmado] },
    { rotulo: 'Taxa efetiva de quadros', valor: `${fpsTexto(contexto.taxaEfetivaFps)} quadros por segundo` },
  );
  if (contexto.trecho) linhas.push({ rotulo: 'Trecho analisado', valor: `de ${segundosTexto(contexto.trecho.inicio)} a ${segundosTexto(contexto.trecho.fim)}` });
  linhas.push(
    { rotulo: capitalizar(rot.plural), valor: fraseRepeticoesCompletas(rot.singular, rot.plural, completas, analise.repeticoes.length) },
    {
      rotulo: 'Quadros-chave corrigidos manualmente',
      valor: contexto.quadrosChaveCorrigidos > 0
        ? `${contexto.quadrosChaveCorrigidos} ${contexto.quadrosChaveCorrigidos === 1 ? 'quadro' : 'quadros'}`
        : 'nenhum',
    },
  );
  const fora = notaMedidasForaDoTrecho(contexto.medidasManuaisForaDoTrecho, 'relatório');
  if (fora) linhas.push({ rotulo: 'Medidas manuais', valor: fora });
  linhas.push({ rotulo: ROTULO_RESPONSAVEL, valor: (contexto.responsavelRevisao ?? '').trim() });
  for (const aviso of AVISOS_FIXOS) linhas.push({ rotulo: ROTULO_AVISO, valor: aviso });
  return { titulo: TITULO_LAUDO, subtitulo: `${protocolo.nome} · ${dataBr(contexto.data)}`, etiqueta: ETIQUETA_BETA, linhas };
}

// ---------- critérios do profissional ----------

interface CriteriosDoLaudo {
  usados: CriterioProfissional[];
  ativosNaoAplicados: { criterio: CriterioProfissional; aplicavel: boolean }[];
}

function separarCriterios(criterios: readonly CriterioProfissional[], protocolo: Protocolo): CriteriosDoLaudo {
  const usados: CriterioProfissional[] = [];
  const ativosNaoAplicados: CriteriosDoLaudo['ativosNaoAplicados'] = [];
  for (const c of criterios) {
    const aplicavel = criterioAplicavel(c);
    if (aplicavel && criterioValidoNoProtocolo(c, protocolo)) usados.push(c);
    else if (c.ativo) ativosNaoAplicados.push({ criterio: c, aplicavel });
  }
  return { usados, ativosNaoAplicados };
}

// ---------- medidas ----------

const CHAVES_LADO: ChaveLado[] = ['D', 'E'];

const lados = (m: MedidaPorRepeticao): ChaveLado[] => (m.def.porLado ? CHAVES_LADO : ['unico']);

function rotuloDoLado(l: ChaveLado, marcha: boolean): string {
  if (l === 'unico') return 'Sem lado';
  return marcha ? `Pé ${ROTULO_LADO[l]}` : capitalizar(ROTULO_LADO[l]);
}

function tabelaDeRepeticoes(analise: AnaliseMovimento, protocolo: Protocolo): TabelaLaudo | null {
  if (!analise.repeticoes.length) return null;
  const marcha = protocolo.gesto === 'marcha';
  const nome = capitalizar(protocolo.rotuloRepeticao.singular);
  const colunas = [nome, ...(marcha ? ['Pé'] : []), 'Início (s)', marcha ? 'Saída do pé (s)' : 'Ponto mais baixo (s)', 'Fim (s)', 'Duração (s)', 'Observação'];
  const linhas = analise.repeticoes.map((r) => [
    String(r.numero),
    ...(marcha ? [r.lado ? ROTULO_LADO[r.lado] : '–'] : []),
    fmt(r.inicioT, 2), fmt(r.fundoT, 2), fmt(r.fimT, 2), fmt(r.duracao, 2),
    r.sinalizadores.length ? r.sinalizadores.map((s) => ROTULO_SINALIZADOR[s]).join('; ') : '–',
  ]);
  return {
    titulo: `${capitalizar(protocolo.rotuloRepeticao.plural)} identificadas (tempos no vídeo)`,
    colunas, linhas,
    legenda: `Segmentação: ${comPontoFinal(protocolo.segmentacao)} Confira os marcos de cada ${protocolo.rotuloRepeticao.singular} no vídeo antes de ler as medidas.`,
  };
}

function tabelaResumoDasMedidas(analise: AnaliseMovimento, marcha: boolean): TabelaLaudo {
  const linhas: string[][] = [];
  for (const m of analise.medidas) {
    for (const l of lados(m)) {
      const r = analise.resumos[m.def.id]?.[l];
      const u = m.incerteza[l] ?? null;
      linhas.push([
        `${m.def.nome} (${m.def.unidade})`,
        rotuloDoLado(l, marcha),
        r ? String(r.n) : '0',
        numeroComCasas(r?.media ?? null, m.def.unidade),
        numeroComCasas(r?.dp ?? null, m.def.unidade),
        finito(u) ? `± ${numeroComCasas(u, m.def.unidade)}` : '–',
      ]);
    }
  }
  return {
    titulo: 'Resumo por medida e por lado',
    colunas: ['Medida', 'Lado', 'n', 'Média', 'Desvio-padrão', 'Incerteza de um valor'],
    linhas,
    legenda: `${LEGENDA_RESUMO_MEDIDAS} ${analise.incerteza.formula}`.trim(),
  };
}

function tabelaDaMedida(m: MedidaPorRepeticao, analise: AnaliseMovimento, protocolo: Protocolo): TabelaLaudo {
  const marcha = protocolo.gesto === 'marcha';
  const def = m.def;
  const ls = lados(m);
  const celula = (v: number | null | undefined) => (finito(v) ? numeroComCasas(v, def.unidade) : TEXTO_MEDIDA_SEM_VALOR);
  const linhas = analise.repeticoes.map((r, i) => [
    rotuloDaRepeticao(r.numero, r.lado && marcha ? ROTULO_LADO[r.lado] : null, r.sinalizadores),
    ...ls.map((l) => celula(m.valores[l]?.[i])),
  ]);
  const resumo = (l: ChaveLado) => analise.resumos[def.id]?.[l];
  linhas.push(
    ['Média', ...ls.map((l) => celula(resumo(l)?.media))],
    ['Desvio-padrão', ...ls.map((l) => celula(resumo(l)?.dp))],
    ['n', ...ls.map((l) => String(resumo(l)?.n ?? 0))],
    ['Incerteza de um valor', ...ls.map((l) => (finito(m.incerteza[l]) ? `± ${numeroComCasas(m.incerteza[l], def.unidade)}` : TEXTO_MEDIDA_SEM_VALOR))],
  );
  const fase = faseDo(protocolo, def.fase);
  return {
    titulo: `${def.nome} (${def.unidade})`,
    colunas: [capitalizar(protocolo.rotuloRepeticao.singular), ...ls.map((l) => (l === 'unico' ? 'Valor' : rotuloDoLado(l, marcha)))],
    linhas,
    legenda: legendaDaMedida(fase ? `${fase.nome} (${fase.descricao.replace(/\.$/, '')})` : def.fase, def.extracao, def.formula, m.avisos),
  };
}

function secaoDeMedidas(analise: AnaliseMovimento, protocolo: Protocolo): SecaoLaudo {
  const marcha = protocolo.gesto === 'marcha';
  const tabelas: TabelaLaudo[] = [];
  const reps = tabelaDeRepeticoes(analise, protocolo);
  if (reps) tabelas.push(reps);
  tabelas.push(tabelaResumoDasMedidas(analise, marcha));
  if (analise.repeticoes.length) for (const m of analise.medidas) tabelas.push(tabelaDaMedida(m, analise, protocolo));
  return secao(ID_SECAO.medidas, TITULOS.medidas, {
    paragrafos: analise.repeticoes.length ? [INTRO_MEDIDAS] : [INTRO_MEDIDAS, TEXTO_NENHUMA_REPETICAO],
    tabelas,
  });
}

// ---------- gráficos ----------

function marcosDasRepeticoes(analise: AnaliseMovimento): MarcadorGrafico[] {
  return analise.repeticoes
    .filter((r) => !r.sinalizadores.includes('incompleta'))
    .map((r) => ({ id: `rep-${r.numero}`, t: r.fundoT, tipo: 'outro' as const, rotulo: `Rep. ${r.numero}`, legenda: 'ponto mais baixo da repetição' }));
}

function graficosDoLaudo(analise: AnaliseMovimento, protocolo: Protocolo): GraficoLaudo[] {
  const marcadores = protocolo.gesto === 'marcha' ? marcadoresDeEventos(analise.eventos) : marcosDasRepeticoes(analise);
  return gruposDeArticulacoes(protocolo.articulacoes).flatMap((g) => {
    const series = seriesDoGrupoDaAnalise(g, analise.series);
    const tempos = series.flatMap((s) => s.pontos.map((p) => p.t));
    const comValor = series.some((s) => s.pontos.filter((p) => p.v !== null).length >= 2);
    if (!comValor || tempos.length < 2) return [];
    const t0 = Math.min(...tempos), t1 = Math.max(...tempos);
    if (!(t1 > t0)) return [];
    const legenda = legendaDosAngulos(g.defs);
    return [{
      titulo: `${g.nome}: ângulo ao longo do tempo`,
      ...(legenda ? { legenda } : {}),
      grafico: { series, marcadores, t0, duracao: t1 - t0, unidade: '°' },
    }];
  });
}

// ---------- seções de texto ----------

function secaoDeResumo(analise: AnaliseMovimento, protocolo: Protocolo, criterios: CriteriosDoLaudo, achados: AchadoLaudo[]): SecaoLaudo {
  const completas = analise.repeticoes.filter((r) => !r.sinalizadores.includes('incompleta')).length;
  const contagem: Partial<Record<TipoGatilho, number>> = {};
  for (const a of analise.achados) contagem[a.gatilho] = (contagem[a.gatilho] ?? 0) + 1;
  const paragrafos = [
    `Protocolo: ${protocolo.nome}.`,
    fraseRepeticoesIdentificadas(protocolo.rotuloRepeticao, completas, analise.repeticoes.length),
    fraseAchadosPorGatilho(contagem),
    fraseCriteriosNoResumo(criterios.usados.length),
    fraseIndisponiveisNoResumo(analise.indisponiveis.length, analise.planoFilmado),
    ...analise.avisos.map((aviso) => `Aviso da análise: ${comPontoFinal(aviso)}`),
  ].filter((p) => p.length > 0);
  return secao(ID_SECAO.resumo, TITULOS.resumo, { paragrafos, itens: achados.map((a) => linhaResumoDoAchado(a.titulo, a.achado, a.situacao)) });
}

function secaoDeIndisponiveis(analise: AnaliseMovimento): SecaoLaudo {
  if (!analise.indisponiveis.length) return secao(ID_SECAO.indisponiveis, TITULOS.indisponiveis, { paragrafos: [TEXTO_SEM_INDISPONIVEIS] });
  return secao(ID_SECAO.indisponiveis, TITULOS.indisponiveis, {
    paragrafos: [INTRO_INDISPONIVEIS, ...unicos(analise.indisponiveis.map((i) => i.comoObter))],
    itens: analise.indisponiveis.map((i) => `${fraseParaAvaliar(i.titulo, i.planoExigido)} ${i.motivo}`),
  });
}

function tabelaDeGatilhos(analise: AnaliseMovimento, protocolo: Protocolo, haCriterios: boolean): TabelaLaudo {
  const doProtocolo = new Set(achadosAvaliaveis(protocolo).flatMap((ap) => achadoDoCatalogo(ap.chave).gatilhos));
  const gatilhos = ORDEM_GATILHOS.filter((g) => (g === 'criterio_profissional' ? haCriterios : doProtocolo.has(g)));
  return {
    titulo: TITULOS.gatilhos,
    colunas: ['Regra', 'Como é avaliada', 'Mínimo de repetições', 'Achados descritos'],
    linhas: gatilhos.map((g) => {
      const n = analise.achados.filter((a) => a.gatilho === g).length;
      return [GATILHOS[g].nome, GATILHOS[g].regra, String(GATILHOS[g].minimoRepeticoes), n ? String(n) : 'nenhum'];
    }),
    legenda: TEXTO_MINIMO_REPETICOES,
  };
}

function tabelaDeCriterios(analise: AnaliseMovimento, protocolo: Protocolo, usados: CriterioProfissional[], refs: Registro): TabelaLaudo {
  return {
    titulo: TITULOS.criterios,
    colunas: ['Critério', 'Medida', 'Limite', 'Definido por', 'Fonte', 'Resultado'],
    linhas: usados.map((c) => {
      const resultados = analise.achados
        .filter((a) => a.gatilho === 'criterio_profissional' && a.veredito?.criterio.id === c.id)
        .map((a) => `${a.lado ? `${a.lado} ` : ''}${ROTULO_SITUACAO[a.situacao]}`);
      return [
        c.rotulo,
        medidaDo(protocolo, c.metrica)?.nome ?? c.metrica,
        limiteDoCriterio(c),
        c.definidoPor.trim(),
        c.fonte ? `[${refs.numero(c.fonte)}]` : 'sem fonte informada',
        resultados.length ? resultados.join('; ') : 'sem valor medido para comparar',
      ];
    }),
    legenda: 'O limite é do profissional que o definiu e vale só para a medida indicada; a regra de comparação está na tabela acima.',
  };
}

function secaoDeMetodo(analise: AnaliseMovimento, contexto: ContextoLaudo, protocolo: Protocolo, criterios: CriteriosDoLaudo, refs: Registro): SecaoLaudo {
  const inc = analise.incerteza;
  const angular = inc.angularGraus !== null && finito(inc.angularGraus)
    ? `Incerteza angular geral estimada neste vídeo: ${maisOuMenos(inc.angularGraus, '°')}, a mediana entre as séries angulares do protocolo (${inc.nAmostras} amostras). Um quadro equivale a ${fmt(inc.quadroS, 3)} s.`
    : `Incerteza angular geral não estimada neste vídeo (amostras insuficientes). Um quadro equivale a ${fmt(inc.quadroS, 3)} s.`;
  const paragrafos = [
    `Identificação das repetições: ${comPontoFinal(protocolo.segmentacao)}`,
    `As medidas são lidas na série suavizada de cada articulação, na taxa efetiva de ${fpsTexto(contexto.taxaEfetivaFps)} quadros por segundo. Os pontos do corpo vêm de um modelo de pose que roda no dispositivo, e o profissional pode corrigir os pontos quadro a quadro.`,
    `Incerteza estimada do vídeo: ${inc.formula}`,
    `O que a incerteza estimada é e o que não é: ${inc.descricao}`,
    angular,
  ];
  const itens: string[] = [];
  const tabelas: TabelaLaudo[] = [tabelaDeGatilhos(analise, protocolo, criterios.usados.length > 0)];
  if (criterios.usados.length) {
    tabelas.push(tabelaDeCriterios(analise, protocolo, criterios.usados, refs));
  } else {
    paragrafos.push(TEXTO_SEM_CRITERIOS);
  }
  for (const { criterio, aplicavel } of criterios.ativosNaoAplicados) {
    itens.push(`Critério ativo não aplicado: ${criterio.rotulo}. Motivo: ${motivoCriterioNaoAplicado(aplicavel)}.`);
  }
  return secao(ID_SECAO.metodo, TITULOS.metodo, { paragrafos, itens, tabelas });
}

// ---------- montagem ----------

export function montarLaudo(analise: AnaliseMovimento, contexto: ContextoLaudo, biblioteca: Biblioteca = BIBLIOTECA): LaudoMovimento {
  const protocolo = protocoloDo(analise.protocolo);
  const refs = registroDeReferencias();
  const criterios = separarCriterios(contexto.criterios ?? [], protocolo);
  const achados = analise.achados.map((a) => achadoDoLaudo(a, analise, protocolo, biblioteca, refs));
  // O método vem depois dos achados para numerar as fontes dos critérios depois das hipóteses.
  const metodo = secaoDeMetodo(analise, contexto, protocolo, criterios, refs);
  return {
    protocolo: analise.protocolo,
    cabecalho: cabecalhoDoLaudo(analise, contexto, protocolo),
    resumo: secaoDeResumo(analise, protocolo, criterios, achados),
    medidasPorRepeticao: secaoDeMedidas(analise, protocolo),
    achados,
    indisponiveis: secaoDeIndisponiveis(analise),
    metodo,
    limitacoes: secao(ID_SECAO.limitacoes, TITULOS.limitacoes, { itens: unicos(protocolo.limitacoes) }),
    graficos: graficosDoLaudo(analise, protocolo),
    referencias: refs.lista,
    rodape: AVISO_ESTIMATIVA_VIDEO,
  };
}
