import { AVISOS_FIXOS, ROTULO_AVISO, TITULOS } from '@/lib/angular/movimento/frases';
import type { LaudoMovimento } from '@/lib/angular/movimento/tipos';

/*
 * Resumo do laudo em texto simples, para copiar para o prontuário ou uma mensagem. Só reaproveita o que o laudo já montou (nenhuma
 * frase nova de achado), e leva junto os avisos fixos e as limitações, porque quem lê a cópia não vê a tela.
 */
export function resumoDoLaudoEmTexto(laudo: LaudoMovimento): string {
  const c = laudo.cabecalho;
  const linhas: string[] = [`${c.titulo} (${c.etiqueta})`, c.subtitulo, ''];

  for (const l of c.linhas) {
    if (l.rotulo === ROTULO_AVISO || l.valor.trim() === '') continue;
    linhas.push(`${l.rotulo}: ${l.valor}`);
  }

  linhas.push('', laudo.resumo.titulo, ...laudo.resumo.paragrafos);
  if (laudo.resumo.itens.length) linhas.push('', `${TITULOS.achados}:`, ...laudo.resumo.itens.map((i) => `- ${i}`));

  if (laudo.pontosPerdidos?.itens.length) linhas.push('', `${laudo.pontosPerdidos.titulo}:`, ...laudo.pontosPerdidos.itens.map((i) => `- ${i}`));

  if (laudo.indisponiveis.itens.length) linhas.push('', `${laudo.indisponiveis.titulo}:`, ...laudo.indisponiveis.itens.map((i) => `- ${i}`));

  const criterios = laudo.metodo.tabelas.find((t) => t.titulo === TITULOS.criterios);
  if (criterios && criterios.linhas.length) {
    linhas.push('', `${TITULOS.criterios}:`);
    for (const [rotulo, medida, limite, definidoPor, , resultado] of criterios.linhas) {
      linhas.push(`- ${rotulo} (${medida}, ${limite}), definido por ${definidoPor}: ${resultado}`);
    }
  }

  if (laudo.limitacoes.itens.length) linhas.push('', `${laudo.limitacoes.titulo}:`, ...laudo.limitacoes.itens.map((i) => `- ${i}`));

  const avisos = AVISOS_FIXOS.some((a) => a.includes(laudo.rodape)) ? [...AVISOS_FIXOS] : [...AVISOS_FIXOS, laudo.rodape];
  linhas.push('', ...avisos);
  return linhas.join('\n');
}
