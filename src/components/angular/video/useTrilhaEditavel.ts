import { useCallback, useMemo, useState } from 'react';
import { corrigirPonto, pontosCorrigidosNoQuadro, quadrosCorrigidos, removerCorrecao, resumoCorrecoes } from '@/lib/angular/video/correcao';
import { criarHistorico, desfazer, podeDesfazer, podeRefazer, refazer, registrar, type Historico } from '@/lib/angular/video/historico';
import { faixasInterpoladas } from '@/lib/angular/analiseVideo/tempo';
import type { TrilhaPose } from '@/lib/angular/video/tipos';

// A trilha de pontos com histórico para desfazer e refazer. Cada correção é um passo; a trilha original nunca é alterada.
export function useTrilhaEditavel() {
  const [historico, setHistorico] = useState<Historico<TrilhaPose> | null>(null);
  const trilha = historico?.presente ?? null;

  const iniciar = useCallback((t: TrilhaPose | null) => setHistorico(t ? criarHistorico(t) : null), []);

  const corrigir = useCallback((indice: number, nome: string, ponto: { x: number; y: number }) => {
    setHistorico((h) => (h ? registrar(h, corrigirPonto(h.presente, indice, nome, ponto)) : h));
  }, []);

  /** Desfaz as correções de todos os pontos do quadro de uma vez (um passo só no histórico). */
  const removerCorrecoesDoQuadro = useCallback((indice: number) => {
    setHistorico((h) => {
      if (!h) return h;
      let t = h.presente;
      for (const nome of pontosCorrigidosNoQuadro(t, indice)) t = removerCorrecao(t, indice, nome);
      return registrar(h, t);
    });
  }, []);

  const desfazerUltima = useCallback(() => setHistorico((h) => (h ? desfazer(h) : h)), []);
  const refazerUltima = useCallback(() => setHistorico((h) => (h ? refazer(h) : h)), []);

  const corrigidos = useMemo(() => (trilha ? quadrosCorrigidos(trilha) : []), [trilha]);
  const faixas = useMemo(() => (trilha ? faixasInterpoladas(trilha.quadros) : []), [trilha]);
  const resumo = useMemo(() => (trilha ? resumoCorrecoes(trilha) : { quadros: 0, pontos: 0, pontosAjustados: 0 }), [trilha]);

  return {
    trilha, iniciar, corrigir, removerCorrecoesDoQuadro, desfazerUltima, refazerUltima, corrigidos, faixas, resumo,
    podeDesfazer: historico ? podeDesfazer(historico) : false,
    podeRefazer: historico ? podeRefazer(historico) : false,
  };
}

export type TrilhaEditavel = ReturnType<typeof useTrilhaEditavel>;
