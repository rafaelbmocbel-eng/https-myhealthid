import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PERFIS, PREFERENCIAS_PADRAO, lerAvatar, lerPreferencias, normalizarPerfil, normalizarPerfis, normalizarPreferencias, salvarAvatar, salvarPreferencias,
} from '@/lib/social/perfis';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('perfis', () => {
  it('tira o @, espaços e endereço do Instagram, e põe em minúsculas', () => {
    expect(normalizarPerfil('@RafaelMocbel')).toBe('rafaelmocbel');
    expect(normalizarPerfil('  @@physio.mocbel  ')).toBe('physio.mocbel');
    expect(normalizarPerfil('https://www.instagram.com/myhealthid.app/?hl=pt')).toBe('myhealthid.app');
    expect(normalizarPerfil('instagram.com/dr_fulano')).toBe('dr_fulano');
  });

  it('descarta caracteres que o Instagram não aceita e limita a 30', () => {
    expect(normalizarPerfil('meu perfil!#$')).toBe('meuperfil');
    expect(normalizarPerfil('a'.repeat(50))).toHaveLength(30);
    expect(normalizarPerfil('')).toBe('');
  });

  it('aceita até três perfis, sem vazios nem repetidos', () => {
    expect(MAX_PERFIS).toBe(3);
    expect(normalizarPerfis(['@a', '', 'A', '@b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(normalizarPerfis('nada')).toEqual([]);
    expect(normalizarPerfis([1, null, '@x'])).toEqual(['x']);
  });
});

describe('preferências lembradas', () => {
  it('grava e lê de volta as escolhas', () => {
    salvarPreferencias({ perfis: ['@rafael', 'myhealthid'], seloModo: 'marca', margensStories: false, modoRosto: 'tarja' });
    expect(lerPreferencias()).toEqual({ perfis: ['rafael', 'myhealthid'], seloModo: 'marca', margensStories: false, modoRosto: 'tarja' });
  });

  it('sem nada guardado, usa o padrão: rosto desfocado e margens de Stories ligadas', () => {
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO);
    expect(PREFERENCIAS_PADRAO.modoRosto).toBe('desfoque');
    expect(PREFERENCIAS_PADRAO.margensStories).toBe(true);
  });

  it('JSON inválido ou valores fora do esperado voltam ao padrão', () => {
    localStorage.setItem('myid:social:preferencias', '{ quebrado');
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO);
    expect(normalizarPreferencias({ perfis: 5, seloModo: 'x', margensStories: 'sim', modoRosto: 'borrão' })).toEqual(PREFERENCIAS_PADRAO);
    expect(normalizarPreferencias(null)).toEqual(PREFERENCIAS_PADRAO);
  });

  it('não quebra quando o armazenamento está bloqueado', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO);
    expect(() => salvarPreferencias(PREFERENCIAS_PADRAO)).not.toThrow();
    expect(lerAvatar()).toBeNull();
    expect(() => salvarAvatar('data:image/jpeg;base64,AAAA')).not.toThrow();
  });

  it('o avatar só aceita imagem em data URL e pode ser removido', () => {
    salvarAvatar('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(lerAvatar()).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    salvarAvatar('https://exemplo.com/x.png');
    expect(lerAvatar()).toBeNull();
    salvarAvatar('data:image/png;base64,AAAA');
    expect(lerAvatar()).not.toBeNull();
    salvarAvatar(null);
    expect(lerAvatar()).toBeNull();
    localStorage.setItem('myid:social:avatar', 'javascript:alert(1)');
    expect(lerAvatar()).toBeNull();
  });
});
