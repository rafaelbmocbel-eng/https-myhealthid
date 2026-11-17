import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  ATRIBUTO_DA_AVALIACAO, ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS, ATRIBUTO_DO_DESTAQUE, ATRIBUTO_DO_DIAGNOSTICO, TEMPO_DO_DESTAQUE_MS, useAbrirRegistroClinico,
} from '@/hooks/useAbrirRegistroClinico';

// O que o botão "Abrir" faz na tela, sem a página: acha o elemento do registro, rola até ele e o destaca por um tempo.
// Só mexe em atributos e na rolagem; um destino que não está na tela não faz nada.

const rolar = vi.fn();
const original = Element.prototype.scrollIntoView;
const matchMediaOriginal = window.matchMedia;

function pagina(html: string) {
  document.body.innerHTML = html;
}

beforeEach(() => {
  rolar.mockClear();
  Element.prototype.scrollIntoView = rolar;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  Element.prototype.scrollIntoView = original;
  window.matchMedia = matchMediaOriginal;
  document.body.innerHTML = '';
});

const abrir = () => renderHook(() => useAbrirRegistroClinico());
const el = (seletor: string) => document.querySelector(seletor) as HTMLElement;

describe('useAbrirRegistroClinico: diagnóstico', () => {
  it('acha a linha pelo id, rola até ela (ao centro) e a destaca', () => {
    pagina(`<div ${ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS}="true"><div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div><div id="b" ${ATRIBUTO_DO_DIAGNOSTICO}="d2"></div></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd2' }));
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar.mock.contexts[0]).toBe(el('#b'));
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(el('#b').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
    expect(el('#a').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
  });

  it('o destaque dura o tempo combinado e some', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS - 1); });
    expect(el('#a').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
    act(() => { vi.advanceTimersByTime(1); });
    expect(el('#a').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
  });

  it('a linha que não está na lista leva ao cartão, sem destacar nada', () => {
    pagina(`<div id="cartao" ${ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS}="true"><div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'sumiu' }));
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar.mock.contexts[0]).toBe(el('#cartao'));
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.querySelectorAll(`[${ATRIBUTO_DO_DESTAQUE}]`)).toHaveLength(0);
  });

  it('sem a linha e sem o cartão na tela, não faz nada e não dá erro', () => {
    pagina('<div>nada aqui</div>');
    const { result } = abrir();
    expect(() => act(() => result.current({ fonte: 'diagnostico', id: 'd1' }))).not.toThrow();
    expect(rolar).not.toHaveBeenCalled();
    expect(document.querySelectorAll(`[${ATRIBUTO_DO_DESTAQUE}]`)).toHaveLength(0);
  });

  it('id com aspas e colchetes não quebra a busca nem casa com outro elemento', () => {
    const estranho = 'a"] , [x="b';
    pagina('<div id="a" data-diagnostico-id="d1"></div><div id="b"></div>');
    el('#b').setAttribute(ATRIBUTO_DO_DIAGNOSTICO, estranho);
    const { result } = abrir();
    expect(() => act(() => result.current({ fonte: 'diagnostico', id: estranho }))).not.toThrow();
    expect(rolar.mock.contexts[0]).toBe(el('#b'));
    expect(el('#a').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
  });

  it('id parecido não casa: "d1" não abre "d10"', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d10"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    expect(rolar).not.toHaveBeenCalled();
    expect(el('#a').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
  });
});

describe('useAbrirRegistroClinico: avaliação', () => {
  it('acha o cartão da avaliação pelo id, rola até o topo dele e o destaca', () => {
    pagina(`<div id="x" ${ATRIBUTO_DA_AVALIACAO}="av-1"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'avaliacao_voz', id: 'av-1' }));
    expect(rolar.mock.contexts[0]).toBe(el('#x'));
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(el('#x').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
  });

  it('avaliação que não está na tela não faz nada (nem leva ao cartão de CID)', () => {
    pagina(`<div ${ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS}="true"></div><div id="x" ${ATRIBUTO_DA_AVALIACAO}="av-1"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'avaliacao_voz', id: 'av-antiga' }));
    expect(rolar).not.toHaveBeenCalled();
    expect(document.querySelectorAll(`[${ATRIBUTO_DO_DESTAQUE}]`)).toHaveLength(0);
  });

  it('o id do diagnóstico não abre uma avaliação com o mesmo texto (cada fonte procura na própria marca)', () => {
    pagina(`<div id="x" ${ATRIBUTO_DA_AVALIACAO}="igual"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'igual' }));
    expect(rolar).not.toHaveBeenCalled();
    expect(el('#x').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
  });
});

describe('useAbrirRegistroClinico: foco do teclado e do leitor de tela', () => {
  it('o foco vai para o registro aberto, sem rolar de novo e sem entrar na ordem do Tab', () => {
    pagina(`<button id="abrir">Abrir</button><div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1">M54.5</div>`);
    const focar = vi.spyOn(HTMLElement.prototype, 'focus');
    el('#abrir').focus();
    focar.mockClear();
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    expect(document.activeElement).toBe(el('#a'));
    expect(focar).toHaveBeenCalledTimes(1);
    expect(focar).toHaveBeenCalledWith({ preventScroll: true });
    expect(el('#a').getAttribute('tabindex')).toBe('-1');
    focar.mockRestore();
  });

  it('a avaliação e o cartão de CID (quando a linha não está na lista) também recebem o foco', () => {
    pagina(`<div id="x" ${ATRIBUTO_DA_AVALIACAO}="av-1"></div><div id="c" ${ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS}="true"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'avaliacao_voz', id: 'av-1' }));
    expect(document.activeElement).toBe(el('#x'));
    act(() => result.current({ fonte: 'diagnostico', id: 'sumiu' }));
    expect(document.activeElement).toBe(el('#c'));
  });

  it('respeita um tabindex que o elemento já tenha e, sem alvo na tela, o foco não muda', () => {
    pagina('<button id="abrir">Abrir</button><div id="a" tabindex="0" data-diagnostico-id="d1"></div>');
    el('#abrir').focus();
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'nao-existe' }));
    expect(document.activeElement).toBe(el('#abrir'));
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    expect(el('#a').getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(el('#a'));
  });
});

describe('useAbrirRegistroClinico: movimento reduzido, destaque único e limpeza', () => {
  const reduzido = (ligado: boolean) => {
    window.matchMedia = ((consulta: string) => ({
      matches: ligado && consulta.includes('prefers-reduced-motion: reduce'), media: consulta, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  };

  it('com prefers-reduced-motion a rolagem é direta (auto); sem ele, suave', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div>`);
    const { result } = abrir();
    reduzido(false);
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    expect(rolar).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
    reduzido(true);
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    expect(rolar).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'center' });
    // O destaque continua (é só uma marca estática): quem pediu menos movimento também vê onde está o registro.
    expect(el('#a').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
  });

  it('sem matchMedia no navegador, rola suave e não quebra', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div>`);
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    const { result } = abrir();
    expect(() => act(() => result.current({ fonte: 'diagnostico', id: 'd1' }))).not.toThrow();
    expect(rolar).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('só um registro fica destacado: abrir outro apaga o destaque do anterior na hora', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div><div id="b" ${ATRIBUTO_DA_AVALIACAO}="av-1"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    act(() => result.current({ fonte: 'avaliacao_voz', id: 'av-1' }));
    expect(el('#a').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
    expect(el('#b').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
  });

  it('abrir outro registro reinicia a contagem: o temporizador do primeiro não apaga o segundo antes da hora', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div><div id="b" ${ATRIBUTO_DO_DIAGNOSTICO}="d2"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS - 100); });
    act(() => result.current({ fonte: 'diagnostico', id: 'd2' }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(el('#b').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS); });
    expect(el('#b').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
  });

  it('um destino que não está na tela não apaga o destaque que já estava aceso', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div>`);
    const { result } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    act(() => result.current({ fonte: 'avaliacao_voz', id: 'nao-existe' }));
    expect(el('#a').getAttribute(ATRIBUTO_DO_DESTAQUE)).toBe('true');
  });

  it('sair da tela (desmontar) apaga o destaque e o temporizador', () => {
    pagina(`<div id="a" ${ATRIBUTO_DO_DIAGNOSTICO}="d1"></div>`);
    const { result, unmount } = abrir();
    act(() => result.current({ fonte: 'diagnostico', id: 'd1' }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(el('#a').hasAttribute(ATRIBUTO_DO_DESTAQUE)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a função devolvida é a mesma entre renderizações (não refaz o botão da linha do tempo à toa)', () => {
    const { result, rerender } = abrir();
    const primeira = result.current;
    rerender();
    expect(result.current).toBe(primeira);
  });

  it('as marcas são as que os cartões escrevem no próprio código', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ler = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8');
    expect(ler('components/medicina/DiagnosticosCID10Card.tsx')).toContain(`${ATRIBUTO_DO_DIAGNOSTICO}={d.id}`);
    expect(ler('components/medicina/DiagnosticosCID10Card.tsx')).toContain(`${ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS}="true"`);
    expect(ler('components/voice/AvaliacaoVozAtual.tsx')).toContain(`${ATRIBUTO_DA_AVALIACAO}={latest.id}`);
    expect(ler('components/medicina/DiagnosticosCID10Card.tsx')).toContain(`data-[${ATRIBUTO_DO_DESTAQUE.replace('data-', '')}=true]:`);
    expect(ler('components/voice/AvaliacaoVozAtual.tsx')).toContain(`data-[${ATRIBUTO_DO_DESTAQUE.replace('data-', '')}=true]:`);
  });
});
