import { describe, expect, it } from 'vitest';
import { BIBLIOTECA, GATILHOS, formulaDaIncerteza, montarLaudo, protocoloDo } from '../lib/angular/movimento';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import { FONTES } from '../lib/angular/movimento/biblioteca/fontes';
import { aleatorio } from '../lib/angular/video/figuraSintetica';
import type { TrilhaPose } from '../lib/angular/video/tipos';
import { achado, analiseFixa, contexto, criterioAtivo } from './movimentoLaudoFixtures';
import { trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';

/*
 * Correções da revisão da Etapa 3 (agente corretor): cada teste reproduz um defeito achado na revisão e fixa o comportamento corrigido.
 * Os vídeos são sintéticos (curvas inventadas com ruído determinístico); as taxas têm folga em relação ao medido com 100 sementes.
 */

const SEMENTES = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const taxa = (n: number, fn: (semente: number) => boolean): number => SEMENTES(n).filter(fn).length / n;

/** Soma ruído AR(1) (desvio marginal `sigma` px, coeficiente `phi`) a cada coordenada de cada ponto: jitter correlacionado no tempo. */
function comRuidoAR(trilha: TrilhaPose, sigma: number, phi: number, semente: number): TrilhaPose {
  const rnd = aleatorio(semente);
  const g = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
  const estado: Record<string, number> = {};
  const inovacao = sigma * Math.sqrt(1 - phi * phi);
  return {
    ...trilha,
    quadros: trilha.quadros.map((q) => {
      const pontos: typeof q.pontos = {};
      for (const [nome, p] of Object.entries(q.pontos)) {
        estado[`${nome}x`] = phi * (estado[`${nome}x`] ?? g() * sigma) + inovacao * g();
        estado[`${nome}y`] = phi * (estado[`${nome}y`] ?? g() * sigma) + inovacao * g();
        pontos[nome] = { ...p, x: p.x + estado[`${nome}x`], y: p.y + estado[`${nome}y`] };
      }
      return { ...q, pontos };
    }),
  };
}

function girar(trilha: TrilhaPose, graus: number): TrilhaPose {
  const a = (graus * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const cx = trilha.largura / 2, cy = trilha.altura / 2;
  return {
    ...trilha,
    quadros: trilha.quadros.map((q) => {
      const pontos: typeof q.pontos = {};
      for (const [nome, p] of Object.entries(q.pontos)) pontos[nome] = { ...p, x: cx + c * (p.x - cx) - s * (p.y - cy), y: cy + s * (p.x - cx) + c * (p.y - cy) };
      return { ...q, pontos };
    }),
  };
}

/** Repete o quadro do fundo de cada repetição: o paciente fica parado `pausaS` segundos no ponto mais baixo. */
function comPausaNoFundo(trilha: TrilhaPose, periodo: number, repouso: number, reps: number, pausaS: number): TrilhaPose {
  const extra = Math.round(pausaS * trilha.fps);
  const fundos = new Set(Array.from({ length: reps }, (_, r) => Math.round((repouso + r * periodo + periodo / 2) * trilha.fps)));
  const quadros: TrilhaPose['quadros'] = [];
  trilha.quadros.forEach((q, i) => {
    quadros.push(q);
    if (fundos.has(i)) for (let k = 0; k < extra; k++) quadros.push({ ...q });
  });
  return { ...trilha, quadros: quadros.map((q, i) => ({ ...q, i, t: i / trilha.fps })) };
}

const completas = (a: ReturnType<typeof analisarMovimento>): number => a.repeticoes.filter((r) => !r.sinalizadores.includes('incompleta')).length;

describe('incerteza com taxa de quadros baixa (Savitzky–Golay de 3 pontos é a identidade)', () => {
  it.each([24, 25, 28])('a %i quadros/s a incerteza não zera e o vídeo simétrico e repetitivo não gera achado de diferença entre os lados', (fps) => {
    const analises = SEMENTES(10).map((semente) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ fps, ruidoPx: 1.5, semente })));
    for (const a of analises) {
      expect(a.incerteza.angularGraus as number).toBeGreaterThan(0.5);
      expect(a.medidas.find((m) => m.def.id === 'flexao_joelho_max')?.incerteza.D as number).toBeGreaterThan(0.5);
    }
    expect(analises.filter((a) => a.achados.some((x) => x.gatilho === 'assimetria_entre_lados')).length).toBe(0);
    expect(analises.filter((a) => a.achados.length > 0).length).toBeLessThanOrEqual(2);
  });
});

describe('incerteza nunca abaixo do último dígito exibido', () => {
  it('marcha sem nenhum ruído: nenhum achado e incerteza de pelo menos 0,1° ou 0,01 s em toda medida', () => {
    const a = analisarMovimento('marcha_lateral', trilhaMarcha({}));
    expect(a.achados).toEqual([]);
    for (const m of a.medidas) {
      for (const u of Object.values(m.incerteza)) expect(u as number, m.def.id).toBeGreaterThanOrEqual(m.def.unidade === 's' ? 0.01 : 0.1);
    }
  });

  it('agachamento sem ruído com 105,1° contra 105° na flexão do joelho: a diferença de 0,1° não é achado', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ flexao: (l) => (l === 'D' ? 105.1 : 105) }));
    expect(a.achados).toEqual([]);
  });
});

describe('membro que perde pontos justamente no ponto mais baixo', () => {
  const PONTOS_E = ['joelho_e', 'quadril_e', 'tornozelo_e', 'calcanhar_e', 'pe_e'];
  const comPerda = (semente: number, janelaS: number) => {
    const fundos = [0, 1, 2, 3, 4].map((r) => 1 + r * 3 + 1.5);
    return analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({
      ruidoPx: 1, semente, perdidos: (_i, t) => (fundos.some((f) => Math.abs(t - f) <= janelaS / 2) ? PONTOS_E : false),
    }));
  };

  it('com 0,4 s sem o membro E no fundo, a flexão de E fica sem valor, com sinalizador e aviso, e não vira diferença entre os lados', () => {
    for (const semente of SEMENTES(6)) {
      const a = comPerda(semente, 0.4);
      expect(a.achados.filter((x) => x.chave === 'assimetria_flexao_joelho'), `semente ${semente}`).toEqual([]);
      expect(a.resumos.flexao_joelho_max.E?.n).toBe(0);
      expect(a.resumos.flexao_joelho_max.D?.n).toBe(5);
      expect(a.repeticoes.every((r) => r.sinalizadores.includes('pontos_ausentes'))).toBe(true);
      expect(a.avisos.join(' ')).toMatch(/pontos do corpo ausentes/);
      expect(a.medidas.find((m) => m.def.id === 'flexao_joelho_max')?.avisos.join(' ')).toMatch(/em torno do instante do extremo/);
    }
  });

  it('uma perda curta (0,1 s) não tira o valor', () => {
    const a = comPerda(2, 0.1);
    expect(a.resumos.flexao_joelho_max.E?.n).toBe(5);
    expect(a.repeticoes.some((r) => r.sinalizadores.includes('pontos_ausentes'))).toBe(false);
  });
});

describe('ruído lento e correlacionado do detector (AR(1))', () => {
  it('agachamento de lado com jitter de 2 px e coeficiente 0,9: repetições idênticas dão achado em poucos vídeos', () => {
    expect(taxa(20, (s) => analisarMovimento('agachamento_lateral', comRuidoAR(trilhaAgachamentoLateral({ semente: s }), 2, 0.9, s)).achados.length > 0)).toBeLessThanOrEqual(0.3);
  });

  it('agachamento de frente com o mesmo jitter: idem, e o fator de coloração aparece só quando o ruído é lento', () => {
    expect(taxa(20, (s) => analisarMovimento('agachamento_frontal', comRuidoAR(trilhaAgachamentoFrontal({ semente: s }), 2, 0.9, s)).achados.length > 0)).toBeLessThanOrEqual(0.3);
    const branco = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1.5, semente: 3 }));
    const lento = analisarMovimento('agachamento_lateral', comRuidoAR(trilhaAgachamentoLateral({ semente: 3 }), 2, 0.9, 3));
    const u = (a: typeof branco) => a.medidas.find((m) => m.def.id === 'profundidade_quadril')?.incerteza.unico as number;
    expect(u(lento)).toBeGreaterThan(u(branco));
  });

  it('só ruído branco (1,5 px) em repetições idênticas: tendência e repetição discrepante quase nunca aparecem', () => {
    const f = (s: number) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1.5, semente: s }));
    expect(taxa(30, (s) => f(s).achados.some((x) => x.gatilho === 'tendencia_primeira_ultima' || x.gatilho === 'repeticao_discrepante'))).toBeLessThanOrEqual(0.1);
  });
});

describe('gatilhos (c) e (d): fator de múltiplas comparações e mínimo de repetições', () => {
  it('as regras escritas dizem o dobro, e a repetição discrepante exige 5 repetições', () => {
    expect(GATILHOS.tendencia_primeira_ultima.regra).toMatch(/2 × raiz\(2\) × u/);
    expect(GATILHOS.repeticao_discrepante.regra).toMatch(/2 × u/);
    expect(GATILHOS.repeticao_discrepante.minimoRepeticoes).toBe(5);
  });

  it('uma repetição 25° mais rasa entre cinco é apontada como discrepante; com quatro repetições a regra não é avaliada', () => {
    const rasa = (_l: 'D' | 'E', r: number) => (r === 2 ? 80 : 105);
    const cinco = SEMENTES(10).map((semente) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1.5, semente, flexao: rasa })));
    expect(cinco.filter((a) => a.achados.some((x) => x.gatilho === 'repeticao_discrepante' && x.medida === 'profundidade_quadril' && x.repeticoes[0] === 2)).length).toBeGreaterThanOrEqual(9);
    const quatro = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1.5, semente: 2, reps: 4, flexao: rasa }));
    expect(quatro.achados.filter((x) => x.gatilho === 'repeticao_discrepante')).toEqual([]);
  });
});

describe('deslocamento lateral da pelve em relação ao valor em pé', () => {
  it('pelve já deslocada 3 cm para um lado em pé e no fundo: a postura inicial não vira achado', () => {
    for (const semente of SEMENTES(6)) {
      const base = trilhaAgachamentoFrontal({ ruidoPx: 1, semente });
      const deslocamento = 0.03 * (480 / 2.2);
      const NOMES = ['quadril_d', 'quadril_e', 'ombro_d', 'ombro_e', 'joelho_d', 'joelho_e', 'nariz', 'orelha_d', 'orelha_e'];
      const trilha: TrilhaPose = {
        ...base,
        quadros: base.quadros.map((q) => ({ ...q, pontos: Object.fromEntries(Object.entries(q.pontos).map(([n, p]) => [n, NOMES.includes(n) ? { ...p, x: p.x + deslocamento } : p])) })),
      };
      const a = analisarMovimento('agachamento_frontal', trilha);
      expect(a.achados.filter((x) => x.chave === 'desvio_lateral_pelve'), `semente ${semente}`).toEqual([]);
      expect(Math.abs(a.resumos.desvio_lateral_pelve_fundo.unico?.media as number)).toBeLessThan(2);
    }
  });

  it('câmera sem inclinação: nenhum achado; com 1° de inclinação o desvio cai para uma fração do que era e quase nunca passa a achado', () => {
    expect(taxa(10, (s) => analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ ruidoPx: 1, semente: s })).achados.some((x) => x.chave === 'desvio_lateral_pelve'))).toBe(0);
    const inclinada = SEMENTES(10).map((s) => analisarMovimento('agachamento_frontal', girar(trilhaAgachamentoFrontal({ ruidoPx: 1, semente: s }), 1)));
    const medias = inclinada.map((a) => Math.abs(a.resumos.desvio_lateral_pelve_fundo.unico?.media as number));
    expect(Math.max(...medias)).toBeLessThan(3.5);
    expect(inclinada.filter((a) => a.achados.some((x) => x.chave === 'desvio_lateral_pelve')).length).toBeLessThanOrEqual(4);
  });
});

describe('segmentação de repetições lentas, com pausa e rasas', () => {
  it('repetições de 6 s (antes a janela de ±1,2 s descartava todas) são achadas', () => {
    const a = analisarMovimento('agachamento_lateral', comRuidoAR(trilhaAgachamentoLateral({ periodo: 6, semente: 3 }), 1, 0, 3));
    expect(completas(a)).toBe(5);
  });

  it.each([1, 2, 3])('pausa de %i s no ponto mais baixo não esconde nem duplica as repetições', (pausa) => {
    const base = trilhaAgachamentoLateral({ periodo: 3, reps: 5, semente: 4 });
    const a = analisarMovimento('agachamento_lateral', comRuidoAR(comPausaNoFundo(base, 3, 1, 5, pausa), 1, 0, 4));
    expect(a.repeticoes).toHaveLength(5);
    expect(completas(a)).toBe(5);
  });

  it('uma repetição rasa (35° contra 80° a 110°) fora dos 40% da amplitude não é contada, mas o aviso diz que ela existe', () => {
    const flexao = [110, 105, 95, 80, 35];
    const a = analisarMovimento('agachamento_lateral', comRuidoAR(trilhaAgachamentoLateral({ reps: 5, semente: 2, flexao: (_l, r) => flexao[r] }), 1, 0, 2));
    expect(completas(a)).toBe(4);
    expect(a.avisos.join(' ')).toMatch(/possível repetição rasa não foi contada/);
  });

  it('uma repetição de 45° (acima de 40% da amplitude) entra na lista, sem aviso de rasa', () => {
    const flexao = [110, 105, 95, 80, 45];
    const a = analisarMovimento('agachamento_lateral', comRuidoAR(trilhaAgachamentoLateral({ reps: 5, semente: 2, flexao: (_l, r) => flexao[r] }), 1, 0, 2));
    expect(completas(a)).toBe(5);
    expect(a.avisos.join(' ')).not.toMatch(/rasa/);
  });
});

describe('texto do método e das limitações descreve o que o motor faz', () => {
  it('agachamento: a duração da repetição declara 2 quadros e a incerteza impressa é de 2 quadros', () => {
    const p = protocoloDo('agachamento_lateral');
    const a = analisarMovimento(p, trilhaAgachamentoLateral({ ruidoPx: 1, semente: 2 }));
    expect(formulaDaIncerteza(p)).toMatch(/n = 2/);
    expect(p.limitacoes.join(' ')).toMatch(/dois quadros/);
    expect(a.medidas.find((m) => m.def.id === 'duracao_repeticao')?.incerteza.unico as number).toBeCloseTo(2 * a.incerteza.quadroS, 6);
  });

  it('marcha: eventos com 1 quadro, e a limitação diz que não há trecho em pé para medir a oscilação lenta', () => {
    const p = protocoloDo('marcha_lateral');
    const a = analisarMovimento(p, trilhaMarcha({ ruidoPx: 1, semente: 2 }));
    expect(formulaDaIncerteza(p)).toMatch(/n = 1/);
    expect(formulaDaIncerteza(p)).not.toMatch(/n = 2/);
    expect(a.medidas.find((m) => m.def.id === 'tempo_apoio')?.incerteza.D as number).toBeCloseTo(a.incerteza.quadroS, 6);
    expect(p.achados.find((x) => x.chave === 'inclinacao_tronco_marcha')?.limitacoes.join(' ')).toMatch(/não há trecho em pé/);
  });

  it('a segmentação impressa descreve a proeminência de 40%, a histerese e o centro do ponto mais baixo', () => {
    for (const id of ['agachamento_lateral', 'agachamento_frontal'] as const) {
      const s = protocoloDo(id).segmentacao;
      expect(s, id).toMatch(/40% da amplitude/);
      expect(s, id).toMatch(/0,8 s/);
      expect(s, id).toMatch(/histerese/);
      expect(s, id).toMatch(/centro da região contínua/);
    }
  });

  it('a fórmula de ângulos fala do fator de coloração e do piso medido em pé', () => {
    const f = formulaDaIncerteza(protocoloDo('agachamento_lateral'));
    expect(f).toMatch(/c ≥ 1/);
    expect(f).toMatch(/nunca fica abaixo de 2 ×/);
  });
});

describe('laudo: títulos, critérios e hipóteses', () => {
  const p = protocoloDo('agachamento_lateral');

  it('a repetição discrepante nomeia a repetição no título e no resumo, e não repete o título do achado de variação', () => {
    const variacao = achado('variacao_profundidade', p, { gatilho: 'variacao_entre_repeticoes', lado: null, medida: 'profundidade_quadril', repeticoes: [0, 1, 2, 3] });
    const discrepante = achado('variacao_profundidade', p, { gatilho: 'repeticao_discrepante', lado: null, medida: 'profundidade_quadril', repeticoes: [3], id: 'x:d' });
    const l = montarLaudo(analiseFixa('agachamento_lateral', [variacao, discrepante]), contexto(), BIBLIOTECA);
    expect(l.achados[0].titulo).not.toBe(l.achados[1].titulo);
    expect(l.achados[1].titulo).toMatch(/\(repetição 4\)$/);
    expect(l.resumo.itens[1]).toContain('(repetição 4)');
    expect(l.resumo.itens[0]).not.toContain('(repetição');
  });

  it('critério sobre a diferença entre os lados não escreve um lado ao lado do veredito; critério por lado escreve o lado por extenso', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1, semente: 2, flexao: (l) => (l === 'D' ? 108 : 92) }));
    const diferenca = criterioAtivo({ id: 'dif', valor: 5 });
    const porLado = criterioAtivo({ id: 'lado', chave: 'avanco_joelho', metrica: 'avanco_joelho_fundo', operador: '<=', valor: 50, unidade: '% do comprimento do pé', rotulo: 'avanço ≤ 50%' });
    const comCriterios = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1, semente: 2, flexao: (l) => (l === 'D' ? 108 : 92) }), { criterios: [diferenca, porLado] });
    expect(a.achados.some((x) => x.gatilho === 'criterio_profissional')).toBe(false);
    const l = montarLaudo(comCriterios, contexto({ criterios: [diferenca, porLado] }), BIBLIOTECA);
    const tabela = l.metodo.tabelas.find((t) => t.titulo === 'Critérios do profissional usados');
    const resultado = (id: string) => tabela?.linhas.find((linha) => linha[0] === (id === 'dif' ? diferenca.rotulo : porLado.rotulo))?.[5] ?? '';
    expect(resultado('dif')).toBe('fora do critério');
    expect(resultado('lado')).toMatch(/^lado (direito|esquerdo): .+/);
    expect(resultado('lado')).not.toMatch(/(^|; )[DE] /);
  });

  it('achado de variação na inclinação do tronco avisa que as fontes não estudaram a variação; o de critério do profissional não', () => {
    const variacao = achado('inclinacao_tronco', p, { gatilho: 'variacao_entre_repeticoes', lado: null, medida: 'inclinacao_tronco_fundo' });
    const criterio = achado('inclinacao_tronco', p, { gatilho: 'criterio_profissional', lado: null, medida: 'inclinacao_tronco_fundo', id: 'x:c' });
    const l = montarLaudo(analiseFixa('agachamento_lateral', [variacao, criterio]), contexto(), BIBLIOTECA);
    for (const h of l.achados[0].hipoteses) {
      if (h.referencias.length) expect(h.ressalva).toContain('Nenhuma das fontes citadas estudou a variação do valor entre repetições');
      else expect(h.ressalva).not.toContain('Nenhuma das fontes citadas');
    }
    for (const h of l.achados[1].hipoteses) expect(h.ressalva).not.toContain('Nenhuma das fontes citadas');
  });

  it('valgo com diferença entre os lados diz que as fontes comparam em geral grupos; a diferença entre os lados da flexão do joelho não leva essa nota', () => {
    const f = protocoloDo('agachamento_frontal');
    const valgo = achado('valgo_dinamico', f, { gatilho: 'assimetria_entre_lados', lado: 'D', valoresPorLado: { D: 8, E: 4 } });
    const lv = montarLaudo(analiseFixa('agachamento_frontal', [valgo]), contexto(), BIBLIOTECA);
    expect(lv.achados[0].hipoteses.some((h) => h.ressalva.includes('comparam, em geral, grupos de pessoas'))).toBe(true);
    const joelho = achado('assimetria_flexao_joelho', p, { lado: 'D', valoresPorLado: { D: 98, E: 91 } });
    const lj = montarLaudo(analiseFixa('agachamento_lateral', [joelho]), contexto(), BIBLIOTECA);
    expect(lj.achados[0].hipoteses.some((h) => h.ressalva.includes('Nenhuma das fontes citadas') || h.ressalva.includes('comparam, em geral'))).toBe(false);
  });
});

describe('fontes: citações e autores', () => {
  it('quando o ano do PubMed é o da publicação eletrônica, a citação escreve Epub em vez de juntá-lo ao volume impresso', () => {
    for (const [id, ano] of [['macrum2011', 2011], ['lima2017', 2017], ['gomes2020', 2020], ['generoso2025', 2025]] as const) {
      const f = FONTES[id];
      expect(f.ano, id).toBe(ano);
      expect(f.citacao, id).toContain(`Epub ${ano}`);
      expect(f.citacao, id).not.toContain(`${ano};`);
    }
  });

  it('os autores seguem o registro do PubMed, sem a sigla do grau no sobrenome nem partículas perdidas', () => {
    expect(FONTES.cashman2026.citacao).toContain('Cashman G, White C, Stephens R');
    expect(FONTES.strong2023.citacao).toContain('Markström JL, Schelin L, Häger CK');
    expect(FONTES.vermeulen2023.citacao).toContain('Vermeulen S, De Bleecker C, De Blaiser C');
  });

  it('a biblioteca não atribui à fonte o que o resumo não diz (mecanismo da perspectiva, mesmo lado, revisões sobre coativação, alongamento "misto")', () => {
    const textos = Object.values(BIBLIOTECA).flatMap((e) => e.fatores.flatMap((f) => [f.texto, f.ressalva])).join('\n');
    expect(textos).not.toMatch(/perspectiva da câmera/);
    expect(textos).not.toMatch(/dorsiflexão do mesmo lado/);
    expect(textos).not.toMatch(/sem confirmação nas revisões/);
    expect(textos).not.toMatch(/alongamento dos flexores mude a cinemática é mista/);
    expect(textos).not.toMatch(/Pessoas com osteoartrite de joelho caminharam com mais flexão do tronco, e/);
    expect(textos).not.toMatch(/coativação/);
    expect(textos).toMatch(/70 pessoas com dor patelofemoral e 70 assintomáticas/);
  });
});
