import type { Marco, TipoDoMarco } from './tipos';

// Filtro da linha do tempo por tipo de marco. Só agrupa o que já existe: não decide o que é "importante".

export type IdDoFiltro = 'tudo' | 'cirurgias_e_diagnosticos' | 'eventos_de_vida' | 'exames_e_testes' | 'avaliacoes' | 'myid';
type IdDeCategoria = Exclude<IdDoFiltro, 'tudo'>;

export const ROTULO_DO_FILTRO: Record<IdDoFiltro, string> = {
  tudo: 'Tudo',
  cirurgias_e_diagnosticos: 'Cirurgias e diagnósticos',
  eventos_de_vida: 'Eventos de vida',
  exames_e_testes: 'Exames e testes',
  avaliacoes: 'Avaliações',
  myid: 'MyID',
};

// Ordem dos chips (depois de "Tudo").
export const CATEGORIAS: readonly IdDeCategoria[] = ['cirurgias_e_diagnosticos', 'eventos_de_vida', 'exames_e_testes', 'avaliacoes', 'myid'];

// Todo tipo de marco tem que aparecer aqui: o Record faz o compilador reclamar de tipo novo sem decisão. `null` = sem
// categoria: o marco aparece em "Tudo" e em mais nenhum filtro, mas nunca some da lista.
export const CATEGORIA_DO_TIPO: Record<TipoDoMarco, IdDeCategoria | null> = {
  cirurgia: 'cirurgias_e_diagnosticos',
  diagnostico: 'cirurgias_e_diagnosticos',
  exame: 'exames_e_testes',
  teste: 'exames_e_testes',
  escala: 'exames_e_testes',
  avaliacao: 'avaliacoes',
  myid: 'myid',
  evento_de_vida: 'eventos_de_vida',
  historico: null,
};

export function categoriaDoMarco(marco: Pick<Marco, 'tipo'>): IdDeCategoria | null {
  // Tipo fora da tabela (ou um nome como "constructor") não tem categoria: cai só em "Tudo".
  return Object.prototype.hasOwnProperty.call(CATEGORIA_DO_TIPO, marco.tipo) ? CATEGORIA_DO_TIPO[marco.tipo] : null;
}

export interface OpcaoDeFiltro {
  id: IdDoFiltro;
  rotulo: string;
  total: number;
}

/** "Tudo" e, em seguida, só as categorias que têm marco, cada uma com a contagem. */
export function opcoesDeFiltro(marcos: readonly Marco[]): OpcaoDeFiltro[] {
  const total = new Map<IdDeCategoria, number>();
  for (const marco of marcos) {
    const categoria = categoriaDoMarco(marco);
    if (categoria) total.set(categoria, (total.get(categoria) ?? 0) + 1);
  }
  return [
    { id: 'tudo', rotulo: ROTULO_DO_FILTRO.tudo, total: marcos.length },
    ...CATEGORIAS.filter((c) => total.has(c)).map((c) => ({ id: c, rotulo: ROTULO_DO_FILTRO[c], total: total.get(c) ?? 0 })),
  ];
}

/** Os chips só ajudam quando há mais marcos do que cabem no corte inicial e mais de uma categoria para escolher. */
export function deveMostrarFiltros(totalDeMarcos: number, opcoes: readonly OpcaoDeFiltro[], marcosVisiveis: number): boolean {
  const categoriasComMarcos = opcoes.filter((o) => o.id !== 'tudo').length;
  return totalDeMarcos > marcosVisiveis && categoriasComMarcos > 1;
}

export function filtrarMarcos(marcos: readonly Marco[], filtro: IdDoFiltro): Marco[] {
  if (filtro === 'tudo') return [...marcos];
  return marcos.filter((marco) => categoriaDoMarco(marco) === filtro);
}
