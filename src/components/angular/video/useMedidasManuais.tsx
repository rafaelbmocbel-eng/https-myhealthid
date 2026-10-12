import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { parseNum } from '@/components/dosagem/comuns';
import { ItensSvg } from '@/components/angular/MarcacaoSvg';
import { ordenarCamadas, separarRotulos } from '@/lib/angular/desenho';
import { cmPorPixel, rotacaoDoNivel, type Medida, type Ponto } from '@/lib/angular/medidas';
import { MEDIDAS_VIDEO } from '@/lib/angular/medidasVideo';
import { itensManuais, resultadoManual, sugerirDaTrilha, textoDoValor, type CapturaManual } from '@/lib/angular/analiseVideo/medidaManual';
import type { QuadroPose } from '@/lib/angular/video/tipos';
import type { CamadaApi } from './PlayerQuadros';

const TOQUE_PONTO_PX = 26;

export const MEDIDAS_DO_PAINEL = MEDIDAS_VIDEO;

interface Opcoes {
  quadro: number;
  t: number;
  largura: number;
  altura: number;
  /** Pose do quadro atual (para sugerir os pontos); null sem rastreio. */
  quadroPose: QuadroPose | undefined;
  tocando: boolean;
}

// Medidas feitas à mão no quadro (ponto a ponto): ferramenta ativa, pontos em andamento, referências de nível e escala
// e as medidas guardadas. Entrega a camada que o player desenha e os gestos que o player usa para marcar.
export function useMedidasManuais({ quadro, t, largura, altura, quadroPose, tocando }: Opcoes) {
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [pontos, setPontos] = useState<Record<string, Ponto[]>>({});
  const [refs, setRefs] = useState<Record<string, Ponto[]>>({});
  const [capturas, setCapturas] = useState<CapturaManual[]>([]);
  const [nivelTipo, setNivelTipo] = useState<'horizontal' | 'vertical'>('horizontal');
  const [escalaCm, setEscalaCm] = useState('');

  const medida: Medida | null = ativaId ? MEDIDAS_VIDEO.find((m) => m.id === ativaId) ?? null : null;
  const ehRef = !!medida?.auxiliar;
  const ptsAtiva = medida ? ((ehRef ? refs[medida.id] : pontos[medida.id]) ?? []) : [];
  const proximo = medida && ptsAtiva.length < medida.pontos.length ? medida.pontos[ptsAtiva.length] : null;

  // Pontos em andamento ficam para trás ao trocar de quadro; as referências de nível e escala continuam.
  useEffect(() => { setPontos({}); }, [quadro]);

  const giro = useMemo(() => {
    const p = refs.nivel;
    return p && p.length >= 2 ? rotacaoDoNivel(p[0], p[1], nivelTipo) : null;
  }, [refs.nivel, nivelTipo]);
  const cmPorPx = useMemo(() => {
    const p = refs.escala, cm = parseNum(escalaCm);
    return p && p.length >= 2 && cm ? cmPorPixel(p[0], p[1], cm) : null;
  }, [refs.escala, escalaCm]);

  const definirPontos = useCallback((m: Medida, fn: (p: Ponto[]) => Ponto[]) => {
    if (m.auxiliar) setRefs((s) => ({ ...s, [m.id]: fn(s[m.id] ?? []) }));
    else setPontos((s) => ({ ...s, [m.id]: fn(s[m.id] ?? []) }));
  }, []);

  const resultado = medida && !ehRef ? resultadoManual(medida, pontos[medida.id] ?? [], giro, cmPorPx) : null;

  const marcar = useCallback((p: Ponto) => { if (medida) definirPontos(medida, (a) => (a.length < medida.pontos.length ? [...a, p] : a)); }, [medida, definirPontos]);
  const arrastar = useCallback((id: string, indice: number, p: Ponto) => {
    const m = MEDIDAS_VIDEO.find((x) => x.id === id);
    if (m) definirPontos(m, (a) => a.map((q, i) => (i === indice ? p : q)));
  }, [definirPontos]);

  const desfazerPonto = () => { if (medida) definirPontos(medida, (a) => a.slice(0, -1)); };
  const limpar = () => { if (medida) definirPontos(medida, () => []); };
  const sugerir = (): 'ok' | 'sem_pose' | 'sem_pontos' => {
    if (!medida || ehRef) return 'sem_pontos';
    if (!quadroPose) return 'sem_pose';
    const sug = sugerirDaTrilha(medida.id, quadroPose);
    if (!sug) return 'sem_pontos';
    setPontos((s) => ({ ...s, [medida.id]: sug }));
    return 'ok';
  };

  const guardar = (): CapturaManual | null => {
    if (!medida || ehRef || !resultado) return null;
    const c: CapturaManual = {
      uid: crypto.randomUUID(), medidaId: medida.id, nome: medida.nome, t: Math.round(t * 1000) / 1000, quadro,
      pontos: pontos[medida.id]!, valor: resultado.valor, unidade: resultado.unidade, texto: resultado.texto,
    };
    setCapturas((l) => [...l, c].sort((a, b) => a.t - b.t));
    setPontos((s) => ({ ...s, [medida.id]: [] }));
    return c;
  };
  const remover = (uid: string) => setCapturas((l) => l.filter((c) => c.uid !== uid));

  const daqui = capturas.filter((c) => c.quadro === quadro);

  /** Camada do player: referências, medidas guardadas neste quadro e a medida em andamento, com alças para arrastar. */
  const camada = (api: CamadaApi): ReactNode => {
    const grupos: { m: Medida; p: Ponto[]; esmaecida: boolean }[] = [];
    for (const [id, p] of Object.entries(refs)) { const m = MEDIDAS_VIDEO.find((x) => x.id === id); if (m && p.length) grupos.push({ m, p, esmaecida: m.id !== ativaId }); }
    if (!tocando) {
      for (const c of daqui) { const m = MEDIDAS_VIDEO.find((x) => x.id === c.medidaId); if (m) grupos.push({ m, p: c.pontos, esmaecida: true }); }
      for (const [id, p] of Object.entries(pontos)) { const m = MEDIDAS_VIDEO.find((x) => x.id === id); if (m && p.length) grupos.push({ m, p, esmaecida: false }); }
    }
    if (!grupos.length) return null;
    const itens = separarRotulos(ordenarCamadas(grupos.flatMap(({ m, p }) => itensManuais(m, p, api.contexto, { giro, cmPorPx }))), largura, altura);
    const raioToque = api.css(TOQUE_PONTO_PX);
    return (
      <g data-testid="camada-manual">
        <ItensSvg itens={itens} />
        {!api.naLupa && !tocando && grupos.filter((g) => !g.esmaecida || g.m.id === ativaId).map(({ m, p }) => p.map((q, i) => (
          <circle key={`${m.id}-${i}`} cx={q.x} cy={q.y} r={raioToque} fill="transparent" style={{ cursor: 'move' }} onPointerDown={(e) => api.pressionar(e, m.id, i)} data-testid={`ponto-manual-${m.id}-${i}`} />
        )))}
      </g>
    );
  };

  const gestos = {
    podeMarcar: !!medida && !!proximo && !tocando,
    aoMarcar: marcar,
    bloqueiaDeslize: !!medida && !ehRef && ptsAtiva.length > 0,
  };

  return {
    ativaId, setAtivaId, medida, ehRef, ptsAtiva, proximo, pontos, refs, capturas, resultado, giro, cmPorPx, nivelTipo, setNivelTipo, escalaCm, setEscalaCm,
    marcar, arrastar, desfazerPonto, limpar, sugerir, guardar, remover, camada, gestos, daqui,
    restaurar: (c: CapturaManual[], rf?: Record<string, Ponto[]>, escala?: string, nivel?: 'horizontal' | 'vertical') => {
      setCapturas(c);
      if (rf) setRefs(rf);
      if (escala !== undefined) setEscalaCm(escala);
      if (nivel) setNivelTipo(nivel);
    },
    textoDoValor,
  };
}

export type MedidasManuais = ReturnType<typeof useMedidasManuais>;
