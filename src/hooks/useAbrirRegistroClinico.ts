import { useCallback, useEffect, useRef } from 'react';
import type { DestinoDoRegistro } from '@/lib/resumoClinico/tipos';

// Quanto tempo o registro de origem fica destacado depois que o profissional toca em "Abrir" na linha do tempo.
export const TEMPO_DO_DESTAQUE_MS = 3000;

// Marcas que os próprios cartões põem nos elementos que o botão "Abrir" sabe achar. O destaque também é só um atributo (os
// cartões o pintam por CSS), então abrir um registro não muda estado nem dado de nenhum cartão.
export const ATRIBUTO_DA_AVALIACAO = 'data-avaliacao-id';
export const ATRIBUTO_DO_DIAGNOSTICO = 'data-diagnostico-id';
export const ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS = 'data-cartao-diagnosticos';
export const ATRIBUTO_DO_DESTAQUE = 'data-destacado';

interface Alvo {
  rolarPara: HTMLElement;
  destacar: HTMLElement | null;
  alinhar: ScrollLogicalPosition;
}

// Compara o texto do atributo em vez de montar um seletor: o id vem do banco e não deve passar por um seletor de CSS.
function elementoComAtributo(atributo: string, valor: string): HTMLElement | null {
  const candidatos = Array.from(document.querySelectorAll<HTMLElement>(`[${atributo}]`));
  return candidatos.find((el) => el.getAttribute(atributo) === valor) ?? null;
}

function acharOAlvo(destino: DestinoDoRegistro): Alvo | null {
  if (destino.fonte === 'avaliacao_voz') {
    const cartao = elementoComAtributo(ATRIBUTO_DA_AVALIACAO, destino.id);
    return cartao ? { rolarPara: cartao, destacar: cartao, alinhar: 'start' } : null;
  }
  const linha = elementoComAtributo(ATRIBUTO_DO_DIAGNOSTICO, destino.id);
  if (linha) return { rolarPara: linha, destacar: linha, alinhar: 'center' };
  // A linha pode não estar na lista ainda (o cartão acabou de recarregar): leva ao cartão, sem destacar o que não achou.
  const cartao = document.querySelector<HTMLElement>(`[${ATRIBUTO_DO_CARTAO_DE_DIAGNOSTICOS}]`);
  return cartao ? { rolarPara: cartao, destacar: null, alinhar: 'start' } : null;
}

// Quem usa teclado ou leitor de tela precisa ouvir/ver que o "Abrir" levou a algum lugar: o foco vai para o registro, sem uma
// segunda rolagem (a suave já está em andamento). O tabindex -1 deixa o bloco focável por código sem entrar na ordem do Tab.
function levarOFoco(elemento: HTMLElement) {
  if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex', '-1');
  elemento.focus({ preventScroll: true });
}

function movimentoReduzido(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Devolve a função que abre o registro de origem de um marco da linha do tempo clínica: rola até o cartão (sem animação
 * para quem pediu menos movimento) e destaca por alguns segundos o que o marco aponta. Só mexe na tela: não grava nada,
 * não troca de rota e não abre janela. Um destino que não está na tela não faz nada.
 */
export function useAbrirRegistroClinico(): (destino: DestinoDoRegistro) => void {
  const destacado = useRef<{ elemento: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null);

  const apagarODestaque = useCallback(() => {
    const atual = destacado.current;
    if (!atual) return;
    clearTimeout(atual.timer);
    atual.elemento.removeAttribute(ATRIBUTO_DO_DESTAQUE);
    destacado.current = null;
  }, []);

  // Sair da tela com o destaque aceso não deixa temporizador solto.
  useEffect(() => apagarODestaque, [apagarODestaque]);

  return useCallback((destino: DestinoDoRegistro) => {
    const alvo = acharOAlvo(destino);
    if (!alvo) return;
    apagarODestaque();
    alvo.rolarPara.scrollIntoView({ behavior: movimentoReduzido() ? 'auto' : 'smooth', block: alvo.alinhar });
    levarOFoco(alvo.rolarPara);
    if (!alvo.destacar) return;
    const elemento = alvo.destacar;
    elemento.setAttribute(ATRIBUTO_DO_DESTAQUE, 'true');
    destacado.current = { elemento, timer: setTimeout(apagarODestaque, TEMPO_DO_DESTAQUE_MS) };
  }, [apagarODestaque]);
}
