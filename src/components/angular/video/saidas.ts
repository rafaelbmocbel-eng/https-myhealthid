import type { PainelParaExportar } from '@/lib/angular/analise';
import { contextoDesenho, ordenarCamadas, separarRotulos, type ItemDesenho } from '@/lib/angular/desenho';
import type { EstiloMarcacao } from '@/lib/angular/estilo';
import { MEDIDAS_VIDEO } from '@/lib/angular/medidasVideo';
import { itensManuais, textoDoValor, type CapturaManual } from '@/lib/angular/analiseVideo/medidaManual';
import { itensDoQuadroAnalisado } from '@/lib/angular/analiseVideo/marcacoes';
import { imagemDoQuadro, painelDoQuadro, type ItensDoQuadro } from '@/lib/angular/analiseVideo/quadroMarcado';
import type { QuadroRelatorio } from '@/lib/angular/relatorioVideo';
import type { CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import { ROTULO_NATUREZA, naturezaDasReferencias } from '@/lib/angular/analiseVideo/statusReferencia';
import { tempoDeExibicao, formatarSegundos } from '@/lib/angular/analiseVideo/tempo';
import { irParaTempoEAguardar } from '@/lib/angular/analiseVideo/videoUtil';
import type { DefinicaoAngulo } from '@/lib/angular/video/angulos';
import type { TrilhaPose } from '@/lib/angular/video/tipos';
import { semPontosDoRosto } from '@/lib/angular/video/rostoPorQuadro';
import type { Ponto } from '@/lib/angular/medidas';

/*
 * Imagens do quadro analisado para o PDF e a arte do Instagram: o quadro parado com o esqueleto, os ângulos no estilo
 * escolhido e as medidas feitas à mão naquele quadro.
 */

export interface ContextoQuadro {
  video: HTMLVideoElement;
  trilha: TrilhaPose;
  estilo: EstiloMarcacao;
  defs: DefinicaoAngulo[];
  direcao: 1 | -1;
  capturas: CapturaManual[];
  giro: number | null;
  cmPorPx: number | null;
}

/** Itens (em pixels do vídeo) do quadro `indice`: o rastreio com os ângulos e as medidas guardadas nesse quadro. */
export function itensDoQuadroIndice(c: ContextoQuadro, indice: number, comEsqueleto = true, semRosto = false): ItensDoQuadro {
  return (k) => {
    const ctx = contextoDesenho(c.trilha.largura, c.trilha.altura, c.estilo, { k });
    const quadro = semRosto && c.trilha.quadros[indice] ? semPontosDoRosto(c.trilha.quadros[indice]) : c.trilha.quadros[indice];
    const base: ItemDesenho[] = comEsqueleto ? itensDoQuadroAnalisado(quadro, ctx, { defs: c.defs, direcao: c.direcao }) : [];
    const manuais = c.capturas.filter((x) => x.quadro === indice).flatMap((x) => {
      const m = MEDIDAS_VIDEO.find((y) => y.id === x.medidaId);
      return m ? itensManuais(m, x.pontos as Ponto[], ctx, { giro: c.giro, cmPorPx: c.cmPorPx }) : [];
    });
    return separarRotulos(ordenarCamadas([...base, ...manuais]), c.trilha.largura, c.trilha.altura);
  };
}

async function noQuadro<T>(c: ContextoQuadro, indice: number, fn: () => T): Promise<T> {
  await irParaTempoEAguardar(c.video, tempoDeExibicao(c.trilha.quadros[indice].t, c.trilha.fps));
  return fn();
}

/** Índices do maior e do menor valor da curva, para o relatório mostrar os quadros dos extremos. */
export function quadrosDosExtremos(valores: (number | null)[]): number[] {
  let max = -1, min = -1;
  valores.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    if (max < 0 || v > (valores[max] as number)) max = i;
    if (min < 0 || v < (valores[min] as number)) min = i;
  });
  return [...new Set([max, min].filter((i) => i >= 0))].sort((a, b) => a - b);
}

/** Imagens para o PDF: cada quadro pedido parado, marcado, em JPEG. O vídeo volta ao quadro em que estava. */
export async function imagensParaRelatorio(c: ContextoQuadro, indices: number[], rotuloDe: (i: number) => string, voltarPara: number, larguraMax = 900): Promise<(QuadroRelatorio & { indice: number })[]> {
  const saida: (QuadroRelatorio & { indice: number })[] = [];
  try {
    for (const i of indices) {
      if (!c.trilha.quadros[i]) continue;
      const img = await noQuadro(c, i, () => imagemDoQuadro(c.video, c.trilha.largura, c.trilha.altura, itensDoQuadroIndice(c, i), larguraMax));
      if (img) saida.push({ indice: i, rotulo: rotuloDe(i), imagem: img });
    }
  } finally {
    if (c.trilha.quadros[voltarPara]) await irParaTempoEAguardar(c.video, tempoDeExibicao(c.trilha.quadros[voltarPara].t, c.trilha.fps));
  }
  return saida;
}

/** Painel da arte social do quadro atual, com as camadas separadas para o rosto ser coberto sem apagar as marcações (os pontos do rosto não são desenhados). */
export function painelDoQuadroAtual(c: ContextoQuadro, indice: number, rotulo = ''): PainelParaExportar | null {
  return painelDoQuadro(c.video, c.trilha.largura, c.trilha.altura, itensDoQuadroIndice(c, indice, true, true), { rotulo });
}

export const rotuloDoQuadro = (c: ContextoQuadro, indice: number, texto?: string): string => {
  const t = c.trilha.quadros[indice]?.t ?? 0;
  return `${formatarSegundos(t)} · quadro ${indice + 1}${texto ? ` · ${texto}` : ''}`;
};

/** Frases do resumo (cartões e medidas à mão) para copiar e para a nota do prontuário. */
export function resumoEmLinhas(cartoes: CartaoMetricaUi[], capturas: CapturaManual[]): string[] {
  const linhas = cartoes.map((c) => {
    const valores = c.valores.map((v) => (v.lado ? `${v.lado} ${v.texto}` : v.texto)).join(' · ');
    // Fora da faixa de normalidade o texto diz o que a referência é: lido sem a tela, "abaixo de ≥ 100" não pode parecer alteração.
    const natureza = naturezaDasReferencias(c.referencias);
    const tipo = natureza === 'normalidade' ? '' : ` — ${ROTULO_NATUREZA[natureza]}`;
    const ref = c.referencias.length ? ` (referência: ${c.referencias.map((r) => `${r.faixa}, ${r.rotulo ?? r.citacao}${r.pmid ? `, PMID ${r.pmid}` : ''}`).join('; ')}${tipo})` : '';
    return `• ${c.titulo}: ${valores}${ref}`;
  });
  const manuais = capturas.map((x) => `• ${formatarSegundos(x.t)} (quadro ${x.quadro + 1}) — ${x.nome}: ${textoDoValor(x.valor, x.unidade)}`);
  return [...linhas, ...manuais];
}
