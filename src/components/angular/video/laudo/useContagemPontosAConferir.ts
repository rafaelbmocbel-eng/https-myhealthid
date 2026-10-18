import { useDeferredValue, useEffect, useState } from 'react';
import type { EventoPasso, Protocolo } from '@/lib/angular/movimento/tipos';
import type { TrilhaPose } from '@/lib/angular/video/tipos';

export const fraseContagemPontos = (n: number): string => `${n} ${n === 1 ? 'ponto a conferir' : 'pontos a conferir'}`;

interface Entrada {
  protocolo: Protocolo | null;
  /** Trilha atual, com as correções do profissional; null enquanto o corpo não foi rastreado. */
  trilha: TrilhaPose | null;
  eventos: EventoPasso[] | null;
  direcao: 1 | -1;
}

/**
 * Quantos pontos o profissional ainda precisa conferir (o número do rótulo da aba Laudo). O motor de movimento é carregado sob demanda,
 * como a aba: a tela principal não o traz no pacote, e o número aparece assim que o cálculo termina e some quando os pontos são corrigidos.
 */
export function useContagemPontosAConferir({ protocolo, trilha, eventos, direcao }: Entrada): number {
  const trilhaAdiada = useDeferredValue(trilha);
  const [contagem, setContagem] = useState(0);

  useEffect(() => {
    if (!protocolo || !trilhaAdiada) {
      setContagem(0);
      return undefined;
    }
    let vigente = true;
    void Promise.all([import('@/lib/angular/movimento/analisarMovimento'), import('@/lib/angular/movimento/pontosPerdidos')])
      .then(([{ analisarMovimento }, { contarItensACorrigir }]) => {
        if (!vigente) return;
        setContagem(contarItensACorrigir(analisarMovimento(protocolo, trilhaAdiada, { ...(eventos ? { eventos } : {}), direcao }).pontosPerdidos));
      })
      .catch(() => {
        // Sem o motor carregado o rótulo fica sem número; ao abrir a aba o laudo calcula e mostra a lista de qualquer forma.
        if (vigente) setContagem(0);
      });
    return () => { vigente = false; };
  }, [protocolo, trilhaAdiada, eventos, direcao]);

  return contagem;
}
