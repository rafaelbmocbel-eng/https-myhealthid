// Como chegar ao Avatar Clínico do profissional: ele fica na Visão Geral do perfil, na sub-aba "Corpo". Esta é a única
// definição disso: a página do perfil (que decide se oferece o caminho) e o painel da Visão Geral (que abre a sub-aba)
// usam as mesmas funções, para nunca existir um botão "Abrir o Avatar" que cai numa sub-aba escondida.
export const SUB_ABA_DO_AVATAR = 'corpo';

export interface SubAba {
  id: string;
  visivel: boolean;
}

// O layout do profissional pode esconder a sub-aba "Corpo". Sem ela, o Avatar não está na Visão Geral e não há para onde ir.
export function visaoGeralMostraOAvatar(subAbas: readonly SubAba[]): boolean {
  return subAbas.some((aba) => aba.visivel && aba.id === SUB_ABA_DO_AVATAR);
}

// Sub-aba com que a Visão Geral abre: a do Avatar quando alguém pediu para abri-lo e ela existe; senão, a de sempre.
export function subAbaInicialDaVisaoGeral(subAbasVisiveis: readonly SubAba[], abrirNoAvatar: boolean, padrao: string): string {
  return abrirNoAvatar && visaoGeralMostraOAvatar(subAbasVisiveis) ? SUB_ABA_DO_AVATAR : padrao;
}
