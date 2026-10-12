import type { ModoRosto } from './rosto';

export const MAX_PERFIS = 3;
const MAX_CARACTERES_PERFIL = 30;

/**
 * Nome de perfil limpo: sem "@", sem endereço do Instagram, só letras, números, ponto e sublinhado, em
 * minúsculas (o Instagram não diferencia maiúsculas) e com no máximo 30 caracteres.
 */
export function normalizarPerfil(bruto: string): string {
  let t = (bruto ?? '').trim();
  const url = /instagram\.com\/([^/?#\s]+)/i.exec(t);
  if (url) t = url[1];
  t = t.replace(/^@+/, '');
  return t.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, MAX_CARACTERES_PERFIL);
}

/** Até três perfis, sem vazios nem repetidos. */
export function normalizarPerfis(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const item of lista) {
    const p = typeof item === 'string' ? normalizarPerfil(item) : '';
    if (!p || vistos.has(p)) continue;
    vistos.add(p);
    saida.push(p);
    if (saida.length === MAX_PERFIS) break;
  }
  return saida;
}

export type SeloModo = 'clinica' | 'marca' | 'nenhum';

export interface PreferenciasSociais {
  perfis: string[];
  seloModo: SeloModo;
  margensStories: boolean;
  modoRosto: ModoRosto;
}

export const PREFERENCIAS_PADRAO: PreferenciasSociais = { perfis: [], seloModo: 'clinica', margensStories: true, modoRosto: 'desfoque' };

const CHAVE_PREFERENCIAS = 'myid:social:preferencias';
const CHAVE_AVATAR = 'myid:social:avatar';

export function normalizarPreferencias(bruto: unknown): PreferenciasSociais {
  if (!bruto || typeof bruto !== 'object') return PREFERENCIAS_PADRAO;
  const o = bruto as Record<string, unknown>;
  const selo: SeloModo[] = ['clinica', 'marca', 'nenhum'];
  const rostos: ModoRosto[] = ['nenhum', 'desfoque', 'tarja'];
  return {
    perfis: normalizarPerfis(o.perfis),
    seloModo: selo.includes(o.seloModo as SeloModo) ? (o.seloModo as SeloModo) : PREFERENCIAS_PADRAO.seloModo,
    margensStories: typeof o.margensStories === 'boolean' ? o.margensStories : PREFERENCIAS_PADRAO.margensStories,
    modoRosto: rostos.includes(o.modoRosto as ModoRosto) ? (o.modoRosto as ModoRosto) : PREFERENCIAS_PADRAO.modoRosto,
  };
}

export function lerPreferencias(): PreferenciasSociais {
  try {
    const bruto = localStorage.getItem(CHAVE_PREFERENCIAS);
    return bruto ? normalizarPreferencias(JSON.parse(bruto)) : PREFERENCIAS_PADRAO;
  } catch {
    // Armazenamento bloqueado ou JSON inválido: segue com os padrões.
    return PREFERENCIAS_PADRAO;
  }
}

export function salvarPreferencias(p: PreferenciasSociais): void {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(normalizarPreferencias(p)));
  } catch {
    // Sem armazenamento: as escolhas valem só nesta sessão.
  }
}

const AVATAR_VALIDO = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

/** Foto do avatar da legenda (miniatura em data URL), a mesma de uma arte para a outra. */
export function lerAvatar(): string | null {
  try {
    const v = localStorage.getItem(CHAVE_AVATAR);
    return v && AVATAR_VALIDO.test(v) ? v : null;
  } catch {
    // Armazenamento bloqueado: sem avatar lembrado.
    return null;
  }
}

export function salvarAvatar(dataUrl: string | null): void {
  try {
    if (dataUrl && AVATAR_VALIDO.test(dataUrl)) localStorage.setItem(CHAVE_AVATAR, dataUrl);
    else localStorage.removeItem(CHAVE_AVATAR);
  } catch {
    // Sem armazenamento (ou cota cheia): o avatar vale só nesta sessão.
  }
}
