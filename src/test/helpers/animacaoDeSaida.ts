import { vi } from 'vitest';
import { act } from '@testing-library/react';

// jsdom não tem CSS nem animação: o Radix desmontaria o diálogo no mesmo instante em que ele fecha. Aqui o diálogo aberto "anima" a
// entrada e o fechando "anima" a saída, e só some quando o animationend chega, como no navegador (a saída dura 200 ms). Quem
// chama deve restaurar os mocks no fim do teste (vi.restoreAllMocks).
export function simularAnimacaoDeSaida() {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((elemento: Element, pseudo?: string | null) => {
    const real = original(elemento, pseudo);
    const papel = elemento.getAttribute('role');
    if (papel !== 'dialog' && papel !== 'alertdialog') return real;
    return new Proxy(real, {
      get(alvo, chave) {
        if (chave === 'animationName') return elemento.getAttribute('data-state') === 'closed' ? 'saida' : 'entrada';
        const valor = Reflect.get(alvo, chave, alvo);
        return typeof valor === 'function' ? valor.bind(alvo) : valor;
      },
    });
  });
}

export function terminarAAnimacaoDeSaida(elemento: Element) {
  const evento = new Event('animationend', { bubbles: true });
  Object.defineProperty(evento, 'animationName', { value: 'saida' });
  act(() => { elemento.dispatchEvent(evento); });
}
