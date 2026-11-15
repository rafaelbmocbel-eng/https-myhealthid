import type { GrupoMedida } from '@/lib/angular/medidas';

export const GRUPOS: { id: GrupoMedida; titulo: string }[] = [
  { id: 'postura', titulo: 'Postura' },
  { id: 'ferramenta', titulo: 'Ferramentas' },
  { id: 'referencia', titulo: 'Referências da foto' },
];

// Na coluna de ícones as ferramentas livres vêm primeiro: com mais de 30 medidas de postura elas ficavam
// no fim de uma coluna que rola e ninguém as via.
export const GRUPOS_DA_COLUNA: { id: GrupoMedida; titulo: string }[] = [GRUPOS[1], GRUPOS[2], GRUPOS[0]];
