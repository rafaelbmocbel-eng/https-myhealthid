import { describe, it, expect, afterEach, vi } from 'vitest';
import { lerFiltroRuido, restricoesDeAudio, salvarFiltroRuido } from '@/lib/microfone';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('restricoesDeAudio', () => {
  it('filtro ligado: eco e ruído ligados (o comportamento de sempre)', () => {
    expect(restricoesDeAudio(true)).toEqual({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 });
  });

  it('filtro desligado: eco e ruído desligados, mas o ganho automático de volume e o mono continuam', () => {
    expect(restricoesDeAudio(false)).toEqual({ echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 });
  });
});

describe('lerFiltroRuido / salvarFiltroRuido', () => {
  it('sem nada guardado, o filtro vem ligado', () => {
    expect(lerFiltroRuido()).toBe(true);
  });

  it('desligar fica guardado e ligar de novo volta ao padrão', () => {
    salvarFiltroRuido(false);
    expect(lerFiltroRuido()).toBe(false);
    salvarFiltroRuido(true);
    expect(lerFiltroRuido()).toBe(true);
    expect(window.localStorage.length).toBe(0);
  });

  it('armazenamento bloqueado: lê o padrão (ligado) e salvar não derruba a tela', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(lerFiltroRuido()).toBe(true);
    expect(() => salvarFiltroRuido(false)).not.toThrow();
    expect(() => salvarFiltroRuido(true)).not.toThrow();
  });

  it('um valor guardado que não é "desligado" (lixo, versão antiga) não desliga o filtro', () => {
    window.localStorage.setItem('mhid:voz:filtro-ruido', 'talvez');
    expect(lerFiltroRuido()).toBe(true);
  });
});
