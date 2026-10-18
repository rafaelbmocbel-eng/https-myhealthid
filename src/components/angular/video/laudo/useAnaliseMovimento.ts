import { useDeferredValue, useMemo } from 'react';
import { analisarMovimento } from '@/lib/angular/movimento/analisarMovimento';
import { montarLaudo } from '@/lib/angular/movimento/laudo';
import type { AnaliseMovimento, ContextoLaudo, CriterioProfissional, EventoPasso, LaudoMovimento, Protocolo } from '@/lib/angular/movimento/tipos';
import type { TrilhaPose } from '@/lib/angular/video/tipos';

export interface EntradaAnaliseMovimento {
  protocolo: Protocolo;
  /** Trilha atual, já com as correções do profissional. */
  trilha: TrilhaPose;
  criterios: CriterioProfissional[];
  escalaCmPorPixel: number | null;
  /** Marcha: eventos conferidos pelo profissional; null deixa o motor detectar. */
  eventos: EventoPasso[] | null;
  direcao: 1 | -1;
  /** Dados que a análise não tem (vídeo, data, correções). Precisa vir memoizado: a identidade dele dispara o recálculo do laudo. */
  contexto: Omit<ContextoLaudo, 'criterios'>;
}

export interface ResultadoAnaliseMovimento {
  analise: AnaliseMovimento;
  laudo: LaudoMovimento;
  /** A trilha ou os critérios mudaram e o cálculo ainda não alcançou: os números na tela são os da versão anterior. */
  atualizando: boolean;
}

/**
 * Análise do movimento e laudo, puros e no dispositivo (nenhuma rede, nenhum modelo de linguagem). Recalcula quando a trilha, o
 * protocolo ou os critérios mudam. O valor adiado mantém a tela responsiva enquanto o profissional arrasta um ponto: o cálculo
 * espera o gesto terminar.
 */
export function useAnaliseMovimento(e: EntradaAnaliseMovimento): ResultadoAnaliseMovimento {
  const trilha = useDeferredValue(e.trilha);
  const criterios = useDeferredValue(e.criterios);
  const { protocolo, escalaCmPorPixel, eventos, direcao, contexto } = e;

  const analise = useMemo(
    () => analisarMovimento(protocolo, trilha, { criterios, escalaCmPorPixel, ...(eventos ? { eventos } : {}), direcao }),
    [protocolo, trilha, criterios, escalaCmPorPixel, eventos, direcao],
  );
  const laudo = useMemo(() => montarLaudo(analise, { ...contexto, criterios }), [analise, contexto, criterios]);

  return { analise, laudo, atualizando: trilha !== e.trilha || criterios !== e.criterios };
}
