import { avaliarCriterio, criterioAplicavel, criterioValidoNoProtocolo } from './criterios';
import { escoreZModificado, finito, fmt, fmtUn, mad, mediana } from './estatistica';
import { achadoDoCatalogo, achadosAvaliaveis, GATILHOS } from './protocolos';
import type {
  Achado, AchadoDoProtocolo, ChaveLado, CriterioProfissional, DefAchado, DefMedidaRepeticao, Lado, MedidaPorRepeticao, Protocolo, Repeticao, ResumoMedida,
  ResumosPorMedida, TipoGatilho,
} from './tipos';
import { ROTULO_LADO, ROTULO_SITUACAO } from './vocabulario';

/*
 * Achados (agente M). Um achado só existe se um gatilho de GATILHOS (protocolos.ts) disparar; nenhum gatilho usa limite clínico.
 * Sem critério do profissional ativo, aplicável e válido, todo achado é "sem referência" (observação medida); o veredito vive
 * só nos achados do gatilho (e), que são separados dos demais.
 * Regras (as mesmas que o laudo imprime), com u = incerteza de um valor da medida (a expandida, ver FATOR_COBERTURA em incerteza.ts) e
 * dp = desvio-padrão entre repetições:
 *   (a) |média D − média E| > raiz(uD² + uE²) e > max(dpD, dpE); sem par D/E, |média| > u e > dp;
 *   (b) dp > u;  (c) |última − primeira| > raiz(2) × u;
 *   (d) |M| > 3,5 (escore z modificado) e |valor − mediana| > u, com MAD > 0.
 */

export interface EntradaAchados {
  protocolo: Protocolo;
  repeticoes: Repeticao[];
  medidas: MedidaPorRepeticao[];
  resumos: ResumosPorMedida;
  /** Referência em pixels que normaliza cada medida de deslocamento, para o equivalente em cm. */
  refsPx: Record<string, Partial<Record<ChaveLado, number | null>>>;
  criterios: CriterioProfissional[];
  escalaCmPorPixel: number | null;
}

const LIMITE_ESCORE_Z = 3.5;

const gatilhoMinimo = (g: TipoGatilho): number => GATILHOS[g].minimoRepeticoes;

const ladoDaChave = (l: ChaveLado): Lado | null => (l === 'unico' ? null : l);

function fraseLado(protocolo: Protocolo, lado: Lado | null): string {
  if (lado === null) return '';
  return protocolo.gesto === 'marcha' ? ` nas passadas do pé ${ROTULO_LADO[lado]}` : ` no lado ${ROTULO_LADO[lado]}`;
}

const nomeDaMedida = (def: DefMedidaRepeticao): string => def.nome;

class Construtor {
  readonly achados: Achado[] = [];
  private readonly medidaPorId = new Map<string, MedidaPorRepeticao>();

  constructor(private readonly e: EntradaAchados) {
    for (const m of e.medidas) this.medidaPorId.set(m.def.id, m);
  }

  private resumo(id: string, lado: ChaveLado): ResumoMedida | undefined {
    return this.e.resumos[id]?.[lado];
  }

  private posicoes(m: MedidaPorRepeticao, lados: ChaveLado[]): number[] {
    const conj = new Set<number>();
    for (const l of lados) (m.valores[l] ?? []).forEach((v, i) => { if (finito(v)) conj.add(i); });
    return [...conj].sort((a, b) => a - b);
  }

  /** Equivalente em cm de um valor normalizado (só deslocamentos e só com a escala informada). */
  private emCm(m: MedidaPorRepeticao, lados: ChaveLado[], valor: number | null): number | null | undefined {
    const escala = this.e.escalaCmPorPixel;
    if (m.def.grandeza !== 'deslocamento' || !escala || !(escala > 0) || valor === null) return undefined;
    const refs = lados.map((l) => this.e.refsPx[m.def.id]?.[l]).filter((r): r is number => finito(r) && r > 0);
    if (!refs.length) return null;
    return (valor / 100) * (refs.reduce((s, r) => s + r, 0) / refs.length) * escala;
  }

  adicionar(
    ap: AchadoDoProtocolo, cat: DefAchado, m: MedidaPorRepeticao, lados: ChaveLado[],
    p: {
      gatilho: TipoGatilho; lado: Lado | null; repeticoes: number[]; valor: number; incerteza: number | null; descricao: string;
      valoresPorLado?: Partial<Record<Lado, number | null>>; titulo?: string; criterio?: CriterioProfissional;
      situacao?: Achado['situacao']; extraId?: string;
    },
  ): void {
    const id = [ap.chave, m.def.id, p.gatilho + (p.extraId ? `#${p.extraId}` : ''), p.lado ?? '-', p.repeticoes.join('-')].join(':');
    const cm = this.emCm(m, lados, p.valor);
    const situacao = p.situacao ?? 'sem_referencia';
    const achado: Achado = {
      id, chave: ap.chave, titulo: p.titulo ?? cat.titulo, descricao: p.descricao, medida: m.def.id, lado: p.lado, repeticoes: p.repeticoes,
      valor: p.valor, unidade: m.def.unidade, ...(p.valoresPorLado ? { valoresPorLado: p.valoresPorLado } : {}), incerteza: p.incerteza,
      superaIncerteza: p.incerteza !== null && Math.abs(p.valor) > p.incerteza, gatilho: p.gatilho, situacao,
      ...(p.criterio && situacao !== 'sem_referencia' ? { veredito: { situacao, criterio: p.criterio } } : {}),
      planoCamera: ap.planoExigido, ...(cm !== undefined ? { equivalenteCm: cm } : {}), limitacoes: [...ap.limitacoes],
    };
    this.achados.push(achado);
  }

  // ---------- (a) diferença entre os lados ----------

  assimetria(ap: AchadoDoProtocolo, cat: DefAchado, m: MedidaPorRepeticao): void {
    const def = m.def;
    const minimo = gatilhoMinimo('assimetria_entre_lados');
    const un = def.unidade;
    if (def.porLado) {
      const rD = this.resumo(def.id, 'D'), rE = this.resumo(def.id, 'E');
      const uD = m.incerteza.D ?? null, uE = m.incerteza.E ?? null;
      if (!rD || !rE || rD.n < minimo || rE.n < minimo || rD.media === null || rE.media === null || rD.dp === null || rE.dp === null) return;
      if (uD === null || uE === null) return;
      const dif = Math.abs(rD.media - rE.media), uDif = Math.hypot(uD, uE), dpMax = Math.max(rD.dp, rE.dp);
      if (!(dif > uDif && dif > dpMax)) return;
      const maior: Lado = rD.media >= rE.media ? 'D' : 'E';
      const gait = this.e.protocolo.gesto === 'marcha';
      const onde = (l: Lado) => (gait ? `nas passadas do pé ${ROTULO_LADO[l]}` : `no lado ${ROTULO_LADO[l]}`);
      this.adicionar(ap, cat, m, ['D', 'E'], {
        gatilho: 'assimetria_entre_lados', lado: maior, repeticoes: this.posicoes(m, ['D', 'E']), valor: dif, incerteza: uDif,
        valoresPorLado: { D: rD.media, E: rE.media },
        descricao:
          `${nomeDaMedida(def)}: média de ${fmtUn(rD.media, un)} ${onde('D')} e de ${fmtUn(rE.media, un)} ${onde('E')}; diferença de ${fmtUn(dif, un)}, ` +
          `maior que a incerteza estimada da diferença (${fmtUn(uDif, un)}) e que o desvio-padrão entre ${this.e.protocolo.rotuloRepeticao.plural} ` +
          `(${fmtUn(rD.dp, un)} e ${fmtUn(rE.dp, un)}).`,
      });
      return;
    }
    const r = this.resumo(def.id, 'unico');
    const u = m.incerteza.unico ?? null;
    if (!r || r.n < minimo || r.media === null || r.dp === null || u === null) return;
    const modulo = Math.abs(r.media);
    if (!(modulo > u && modulo > r.dp)) return;
    const lado: Lado = r.media >= 0 ? 'D' : 'E';
    this.adicionar(ap, cat, m, ['unico'], {
      gatilho: 'assimetria_entre_lados', lado, repeticoes: this.posicoes(m, ['unico']), valor: modulo, incerteza: u,
      valoresPorLado: { [lado]: r.media },
      descricao:
        `${nomeDaMedida(def)}: média de ${fmtUn(modulo, un)} para o lado ${ROTULO_LADO[lado]} do paciente, maior que a incerteza estimada de um valor (${fmtUn(u, un)}) ` +
        `e que o desvio-padrão entre ${this.e.protocolo.rotuloRepeticao.plural} (${fmtUn(r.dp, un)}).`,
    });
  }

  // ---------- (b) variação entre repetições ----------

  variacao(ap: AchadoDoProtocolo, cat: DefAchado, m: MedidaPorRepeticao): void {
    const minimo = gatilhoMinimo('variacao_entre_repeticoes');
    const lados: ChaveLado[] = m.def.porLado ? ['D', 'E'] : ['unico'];
    for (const l of lados) {
      const r = this.resumo(m.def.id, l);
      const u = m.incerteza[l] ?? null;
      if (!r || r.n < minimo || r.dp === null || u === null || !(r.dp > u)) continue;
      const lado = ladoDaChave(l);
      this.adicionar(ap, cat, m, [l], {
        gatilho: 'variacao_entre_repeticoes', lado, repeticoes: this.posicoes(m, [l]), valor: r.dp, incerteza: u,
        descricao:
          `${nomeDaMedida(m.def)}${fraseLado(this.e.protocolo, lado)}: desvio-padrão de ${fmtUn(r.dp, m.def.unidade)} entre ${r.n} ${this.e.protocolo.rotuloRepeticao.plural} ` +
          `(de ${fmtUn(r.min, m.def.unidade)} a ${fmtUn(r.max, m.def.unidade)}), maior que a incerteza estimada de um valor (${fmtUn(u, m.def.unidade)}).`,
      });
    }
  }

  // ---------- (c) tendência da primeira para a última ----------

  tendencia(ap: AchadoDoProtocolo, cat: DefAchado, m: MedidaPorRepeticao): void {
    const minimo = gatilhoMinimo('tendencia_primeira_ultima');
    const lados: ChaveLado[] = m.def.porLado ? ['D', 'E'] : ['unico'];
    for (const l of lados) {
      const r = this.resumo(m.def.id, l);
      const u = m.incerteza[l] ?? null;
      if (!r || r.n < minimo || r.tendencia === null || r.iPrimeira === null || r.iUltima === null || u === null) continue;
      const uDif = Math.SQRT2 * u;
      if (!(Math.abs(r.tendencia) > uDif)) continue;
      const lado = ladoDaChave(l);
      const un = m.def.unidade;
      const verbo = r.tendencia > 0 ? 'aumentou' : 'diminuiu';
      const rot = this.e.protocolo.rotuloRepeticao;
      this.adicionar(ap, cat, m, [l], {
        gatilho: 'tendencia_primeira_ultima', lado, repeticoes: [r.iPrimeira, r.iUltima], valor: r.tendencia, incerteza: uDif,
        descricao:
          `${nomeDaMedida(m.def)}${fraseLado(this.e.protocolo, lado)}: da primeira (${fmtUn(r.primeira, un)}) para a última ${rot.singular} (${fmtUn(r.ultima, un)}) ` +
          `a medida ${verbo} ${fmtUn(Math.abs(r.tendencia), un)}, mais que a incerteza estimada da diferença (${fmtUn(uDif, un)}).`,
      });
    }
  }

  // ---------- (d) repetição discrepante ----------

  discrepante(ap: AchadoDoProtocolo, cat: DefAchado, m: MedidaPorRepeticao): void {
    const minimo = gatilhoMinimo('repeticao_discrepante');
    const lados: ChaveLado[] = m.def.porLado ? ['D', 'E'] : ['unico'];
    for (const l of lados) {
      const u = m.incerteza[l] ?? null;
      const itens = (m.valores[l] ?? []).map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => finito(x.v));
      if (itens.length < minimo || u === null) continue;
      const valores = itens.map((x) => x.v);
      const med = mediana(valores) as number;
      const madValor = mad(valores);
      const un = m.def.unidade;
      for (const it of itens) {
        const z = escoreZModificado(it.v, med, madValor);
        if (z === null || !(Math.abs(z) > LIMITE_ESCORE_Z) || !(Math.abs(it.v - med) > u)) continue;
        const lado = ladoDaChave(l);
        const desvio = it.v - med;
        const rot = this.e.protocolo.rotuloRepeticao.singular;
        this.adicionar(ap, cat, m, [l], {
          gatilho: 'repeticao_discrepante', lado, repeticoes: [it.i], valor: desvio, incerteza: u,
          descricao:
            `${nomeDaMedida(m.def)}${fraseLado(this.e.protocolo, lado)}: a ${rot} ${this.e.repeticoes[it.i]?.numero ?? it.i + 1} mediu ${fmtUn(it.v, un)}, ` +
            `${fmtUn(Math.abs(desvio), un)} ${desvio > 0 ? 'acima' : 'abaixo'} da mediana das repetições (${fmtUn(med, un)}); ` +
            `critério estatístico de valor atípico (escore z modificado de ${fmt(z, 1)}), não limite clínico.`,
        });
      }
    }
  }

  // ---------- (e) critério do profissional ----------

  criterio(ap: AchadoDoProtocolo, cat: DefAchado, c: CriterioProfissional): void {
    const m = this.medidaPorId.get(c.metrica);
    if (!m) return;
    const def = m.def;
    const un = def.unidade;
    const rotuloRep = this.e.protocolo.rotuloRepeticao.plural;
    const titulo = `Critério do profissional: ${c.rotulo}`;
    const lados: ChaveLado[] = def.porLado ? (c.lado ? [c.lado] : ['D', 'E']) : ['unico'];

    const emitir = (valor: number | null, incerteza: number | null, ladosUsados: ChaveLado[], lado: Lado | null, repeticoes: number[], valoresPorLado?: Partial<Record<Lado, number | null>>) => {
      if (valor === null) return;
      const situacao = avaliarCriterio(valor, incerteza, c);
      if (situacao === 'sem_referencia') return;
      const dentroDaIncerteza = incerteza !== null && !(Math.abs(valor) > incerteza);
      this.adicionar(ap, cat, m, ladosUsados, {
        gatilho: 'criterio_profissional', lado, repeticoes, valor, incerteza, titulo, criterio: c, situacao, extraId: c.id,
        ...(valoresPorLado ? { valoresPorLado } : {}),
        descricao:
          `${c.rotulo}: valor medido de ${fmtUn(valor, un)}${incerteza !== null ? ` (incerteza estimada de ${fmtUn(incerteza, un)})` : ''}, ${ROTULO_SITUACAO[situacao]}` +
          `${dentroDaIncerteza ? '; o valor não supera a incerteza estimada do vídeo' : ''}. Critério definido por ${c.definidoPor} sobre ${rotuloRep}.`,
      });
    };

    switch (cat.grandeza) {
      case 'diferenca_entre_lados': {
        if (!def.porLado) return;
        const rD = this.resumo(def.id, 'D'), rE = this.resumo(def.id, 'E');
        const uD = m.incerteza.D ?? null, uE = m.incerteza.E ?? null;
        if (!rD || !rE || rD.media === null || rE.media === null || rD.n < 1 || rE.n < 1) return;
        const maior: Lado = rD.media >= rE.media ? 'D' : 'E';
        emitir(Math.abs(rD.media - rE.media), uD !== null && uE !== null ? Math.hypot(uD, uE) : null, ['D', 'E'], maior, this.posicoes(m, ['D', 'E']), { D: rD.media, E: rE.media });
        return;
      }
      case 'tendencia':
        for (const l of lados) {
          const r = this.resumo(def.id, l);
          const u = m.incerteza[l] ?? null;
          if (!r || r.tendencia === null || r.iPrimeira === null || r.iUltima === null) continue;
          emitir(r.tendencia, u !== null ? Math.SQRT2 * u : null, [l], ladoDaChave(l), [r.iPrimeira, r.iUltima]);
        }
        return;
      default:
        for (const l of lados) {
          const r = this.resumo(def.id, l);
          const u = m.incerteza[l] ?? null;
          if (!r || r.n < 1) continue;
          let valor: number | null;
          if (cat.grandeza === 'desvio_padrao') valor = r.dp;
          else if (cat.grandeza === 'modulo_da_media') valor = r.media === null ? null : Math.abs(r.media);
          else valor = r.media;
          emitir(valor, u, [l], ladoDaChave(l), this.posicoes(m, [l]));
        }
    }
  }
}

/** Todos os achados avaliáveis do protocolo (plano certo), na ordem do protocolo e dos gatilhos. */
export function detectarAchados(e: EntradaAchados): Achado[] {
  const b = new Construtor(e);
  const ativos = e.criterios.filter((c) => criterioAplicavel(c) && criterioValidoNoProtocolo(c, e.protocolo));
  for (const ap of achadosAvaliaveis(e.protocolo)) {
    const cat = achadoDoCatalogo(ap.chave);
    const medidas = ap.medidas.map((id) => e.medidas.find((m) => m.def.id === id)).filter((m): m is MedidaPorRepeticao => !!m);
    for (const m of medidas) {
      if (cat.gatilhos.includes('assimetria_entre_lados')) b.assimetria(ap, cat, m);
      if (cat.gatilhos.includes('variacao_entre_repeticoes')) b.variacao(ap, cat, m);
      if (cat.gatilhos.includes('tendencia_primeira_ultima')) b.tendencia(ap, cat, m);
      if (cat.gatilhos.includes('repeticao_discrepante')) b.discrepante(ap, cat, m);
    }
    for (const c of ativos.filter((x) => x.chave === ap.chave)) b.criterio(ap, cat, c);
  }
  return b.achados;
}
