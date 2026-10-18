import { useCallback, useEffect, useState, type RefObject } from 'react';
import { indiceMaisProximo, intervaloEntreQuadrosMs, limitar, tempoDeExibicao } from '@/lib/angular/analiseVideo/tempo';

interface Opcoes {
  videoRef: RefObject<HTMLVideoElement>;
  /** Instante de cada quadro da trilha, em segundos do vídeo. */
  tempos: readonly number[];
  fps: number;
  /** A análise está aberta (o vídeo está na tela). */
  ativo: boolean;
}

// Tempo do vídeo por quadros da trilha: ir ao quadro, passo a passo, tocar em câmera lenta e acompanhar o quadro tocado.
export function useReproducao({ videoRef, tempos, fps, ativo }: Opcoes) {
  const [quadro, setQuadro] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidadeEstado] = useState(0.25);
  const n = tempos.length;
  const ultimo = Math.max(0, n - 1);
  // Aparelhos que não aceitam a câmera lenta pedida (iPhone) tocam quadro a quadro, pelos tempos da trilha, com o vídeo buscado a cada passo.
  const [emPassos, setEmPassos] = useState(false);

  const pausar = useCallback(() => {
    videoRef.current?.pause();
    setTocando(false);
  }, [videoRef]);

  const irPara = useCallback((i: number) => {
    pausar();
    setQuadro(limitar(Math.round(i), 0, ultimo));
  }, [pausar, ultimo]);

  const passo = useCallback((d: number) => { irPara(quadro + d); }, [irPara, quadro]);

  // O vídeo para no quadro pedido (e no quadro 0 quando uma trilha nova chega). No modo em passos o vídeo também acompanha cada quadro.
  useEffect(() => {
    if (!ativo || (tocando && !emPassos) || !n) return;
    const v = videoRef.current;
    if (!v) return;
    const alvo = tempoDeExibicao(tempos[limitar(quadro, 0, ultimo)], fps);
    if (Math.abs(v.currentTime - alvo) > 1e-4) v.currentTime = alvo;
  }, [quadro, tocando, emPassos, ativo, n, tempos, fps, ultimo, videoRef]);

  useEffect(() => { setQuadro((q) => limitar(q, 0, ultimo)); }, [ultimo]);

  const setVelocidade = useCallback((v: number) => {
    setVelocidadeEstado(v);
    const el = videoRef.current;
    if (el) el.playbackRate = v;
  }, [videoRef]);

  const alternar = useCallback(() => {
    const v = videoRef.current;
    if (!v || !n) return;
    if (tocando) { pausar(); return; }
    const inicio = quadro >= ultimo ? 0 : quadro;
    setQuadro(inicio);
    v.currentTime = tempoDeExibicao(tempos[inicio], fps);
    v.playbackRate = velocidade;
    // Alguns navegadores (iPhone) não toleram câmera lenta extrema: se a taxa não foi aceita, toca quadro a quadro pelos tempos da trilha.
    const taxaAceita = Math.abs(v.playbackRate - velocidade) <= 0.01;
    setEmPassos(!taxaAceita);
    setTocando(true);
    if (taxaAceita) {
      // Se o navegador recusar tocar (política de reprodução), troca para o modo em passos em vez de deixar o contador andar sobre imagem parada.
      void Promise.resolve(v.play()).catch(() => { setEmPassos(true); });
    }
  }, [videoRef, n, tocando, pausar, quadro, ultimo, tempos, fps, velocidade]);

  // Acompanha o vídeo tocando (ou avança os quadros por tempo, no modo em passos).
  useEffect(() => {
    if (!tocando) return;
    const v = videoRef.current;
    if (!v || !n) return;
    let id = 0;
    const fim = () => { v.pause(); setTocando(false); setQuadro(ultimo); };
    if (emPassos) {
      v.pause();
      const timer = window.setInterval(() => { setQuadro((q) => Math.min(q + 1, ultimo)); }, intervaloEntreQuadrosMs(fps, velocidade));
      return () => window.clearInterval(timer);
    }
    const tick = () => {
      if (v.ended || v.currentTime >= tempos[ultimo] + 0.5 / Math.max(1, fps)) { fim(); return; }
      setQuadro(indiceMaisProximo(tempos, v.currentTime));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [tocando, emPassos, videoRef, n, tempos, ultimo, fps, velocidade]);

  // No modo em passos, o último quadro encerra a reprodução.
  useEffect(() => { if (tocando && emPassos && quadro >= ultimo) setTocando(false); }, [tocando, emPassos, quadro, ultimo]);

  // Sair da tela com o vídeo tocando não deixa som nem consumo de bateria.
  useEffect(() => () => { videoRef.current?.pause(); }, [videoRef]);

  return { quadro, setQuadro, tocando, velocidade, setVelocidade, irPara, passo, alternar, pausar };
}
