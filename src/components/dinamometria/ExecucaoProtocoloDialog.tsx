import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { celula } from '@/lib/dinamometria/celulaBle';
import { UF, type Unidade } from '@/lib/dinamometria/analise';
import { cn } from '@/lib/utils';

export interface Etapa { id: string; titulo: string; alvoKg?: number | null }
export interface ResultadoEtapa {
  t: number[];
  fN: number[];
  picosKg: number[];
  // Treino: segundos dentro da faixa-alvo, somando as repetições.
  segundosNoAlvo: number;
}
export interface ConfigProtocolo {
  tempoForca: number;
  repeticoes: number;
  descanso: number;
  preparo: number;
  // Treino: força-alvo em kg e tolerância (fração, ex.: 0.1 = ±10%).
  alvoKg?: number | null;
  tolerancia?: number;
}

type Fase = 'aguardando' | 'preparo' | 'forca' | 'descanso' | 'concluida';

const NOME_FASE: Record<Fase, string> = {
  aguardando: 'Posicione o paciente',
  preparo: 'Prepare-se',
  forca: 'Força!',
  descanso: 'Descanse',
  concluida: 'Concluído',
};

function bip(freq = 880, ms = 160) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
    o.onended = () => ctx.close();
  } catch { /* sem áudio no aparelho — segue só com o visual */ }
}

const lerUnidade = (): Unidade => {
  if (celula.fblock) return 'kgf';
  try { return (JSON.parse(localStorage.getItem('mh.celula.unidade') || '"kgf"') as Unidade) || 'kgf'; } catch { return 'kgf'; }
};

/**
 * Conduz o protocolo com a célula Bluetooth: para cada etapa (músculo + lado)
 * faz preparo → força → descanso pelas repetições configuradas, com contagem
 * regressiva e bipes, e grava a curva contínua da etapa (todas as repetições),
 * que a análise separa e usa a melhor.
 */
export default function ExecucaoProtocoloDialog({ open, onOpenChange, etapas, config, modo, onEtapa, onFim }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  etapas: Etapa[];
  config: ConfigProtocolo;
  modo: 'teste' | 'treino';
  onEtapa: (id: string, r: ResultadoEtapa) => void;
  onFim?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [fase, setFase] = useState<Fase>('aguardando');
  const [rep, setRep] = useState(1);
  const [restante, setRestante] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [atual, setAtual] = useState(0);
  const [picos, setPicos] = useState<number[]>([]);
  const [noAlvo, setNoAlvo] = useState(0);

  const faseRef = useRef<Fase>('aguardando');
  const fimFaseRef = useRef(0);
  const restantePausaRef = useRef(0);
  const repRef = useRef(1);
  const gravRef = useRef<{ t: number[]; v: number[] } | null>(null);
  const picoRepRef = useRef(0);
  const picosRef = useRef<number[]>([]);
  const noAlvoRef = useRef(0);
  const ultimaAmostraRef = useRef(0);
  const unidadeRef = useRef<Unidade>('kgf');
  const etapa = etapas[idx];

  const alvo = etapa?.alvoKg ?? config.alvoKg ?? null;
  const tol = config.tolerancia ?? 0.1;

  // Reinicia ao abrir.
  useEffect(() => {
    if (!open) return;
    setIdx(0); irPara('aguardando'); setRep(1); repRef.current = 1;
    setPicos([]); picosRef.current = []; setNoAlvo(0); noAlvoRef.current = 0;
    setPausado(false);
    unidadeRef.current = lerUnidade();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Leituras da célula.
  useEffect(() => {
    if (!open) return;
    return celula.onLeitura(({ valor, tMs }) => {
      const kg = valor * UF[unidadeRef.current] / UF.kgf;
      setAtual(kg);
      if (gravRef.current) { gravRef.current.t.push(tMs); gravRef.current.v.push(kg); }
      if (faseRef.current === 'forca') {
        const a = Math.abs(kg);
        if (a > picoRepRef.current) picoRepRef.current = a;
        if (alvo) {
          const dt = ultimaAmostraRef.current ? Math.min(0.1, (tMs - ultimaAmostraRef.current) / 1000) : 0;
          if (Math.abs(a - alvo) <= alvo * tol) { noAlvoRef.current += dt; }
        }
      }
      ultimaAmostraRef.current = tMs;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alvo, tol]);

  const irPara = (f: Fase, segundos = 0) => {
    faseRef.current = f;
    setFase(f);
    fimFaseRef.current = performance.now() + segundos * 1000;
    setRestante(segundos);
  };

  const concluirEtapa = () => {
    const g = gravRef.current;
    gravRef.current = null;
    if (etapa && g && g.v.length >= 20) {
      const dur = (g.t[g.t.length - 1] - g.t[0]) / 1000;
      const hz = celula.fblock ? 250 : (dur > 0 ? (g.v.length - 1) / dur : 50);
      const maxV = Math.max(...g.v), minV = Math.min(...g.v);
      const sinal = Math.abs(minV) > Math.abs(maxV) ? -1 : 1;
      onEtapa(etapa.id, {
        t: g.v.map((_, i) => i / hz),
        fN: g.v.map((v) => sinal * v * UF.kgf),
        picosKg: [...picosRef.current],
        segundosNoAlvo: Math.round(noAlvoRef.current * 10) / 10,
      });
    }
    irPara('concluida');
    bip(660, 300);
  };

  // Relógio das fases.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      if (pausado) return;
      const f = faseRef.current;
      if (f === 'aguardando' || f === 'concluida') return;
      const r = Math.max(0, (fimFaseRef.current - performance.now()) / 1000);
      setRestante(r);
      if (f === 'forca') setNoAlvo(noAlvoRef.current);
      if (r > 0) {
        if (f === 'preparo' && Math.ceil(r) !== Math.ceil(r + 0.1)) bip(520, 80);
        return;
      }
      if (f === 'preparo') { picoRepRef.current = 0; irPara('forca', config.tempoForca); bip(880, 250); return; }
      if (f === 'forca') {
        picosRef.current = [...picosRef.current, picoRepRef.current];
        setPicos(picosRef.current);
        bip(440, 250);
        if (repRef.current >= config.repeticoes) {
          // 1 s de relaxamento no fim da curva, para a análise achar o fim da contração.
          faseRef.current = 'descanso';
          setTimeout(concluirEtapa, 1000);
          setFase('descanso');
          fimFaseRef.current = performance.now() + 1000;
          return;
        }
        irPara('descanso', config.descanso);
        return;
      }
      if (f === 'descanso' && repRef.current < config.repeticoes && gravRef.current) {
        repRef.current += 1; setRep(repRef.current);
        irPara('preparo', config.preparo);
      }
    }, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pausado, config, idx]);

  const iniciarEtapa = () => {
    gravRef.current = { t: [], v: [] };
    picosRef.current = []; setPicos([]);
    noAlvoRef.current = 0; setNoAlvo(0);
    repRef.current = 1; setRep(1);
    irPara('preparo', config.preparo);
  };

  const pausar = () => {
    if (pausado) { fimFaseRef.current = performance.now() + restantePausaRef.current * 1000; setPausado(false); return; }
    restantePausaRef.current = Math.max(0, (fimFaseRef.current - performance.now()) / 1000);
    setPausado(true);
  };

  const repetirEtapa = () => { gravRef.current = null; irPara('aguardando'); setPicos([]); picosRef.current = []; };
  const proxima = () => {
    gravRef.current = null;
    if (idx + 1 >= etapas.length) { onOpenChange(false); onFim?.(); return; }
    setIdx(idx + 1); irPara('aguardando'); setPicos([]); picosRef.current = []; setNoAlvo(0); noAlvoRef.current = 0;
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const absAtual = Math.abs(atual) < 0.05 ? 0 : Math.abs(atual);
  const escala = Math.max(alvo ? alvo * 1.5 : 0, ...picos, absAtual, 10);
  const pct = Math.min(100, (absAtual / escala) * 100);
  const noAlvoAgora = alvo ? Math.abs(absAtual - alvo) <= alvo * tol : false;
  const corFase = fase === 'forca' ? 'bg-emerald-600 text-white' : fase === 'preparo' ? 'bg-amber-500 text-white' : fase === 'descanso' ? 'bg-sky-600 text-white' : 'bg-muted text-foreground';
  const ultimo = idx + 1 >= etapas.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { gravRef.current = null; faseRef.current = 'aguardando'; } onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{modo === 'teste' ? 'Teste de força' : 'Treino'} · {idx + 1}/{etapas.length}</DialogTitle>
          <DialogDescription className="text-base font-semibold text-foreground">{etapa?.titulo}</DialogDescription>
        </DialogHeader>

        <div className={cn('rounded-xl p-4 text-center transition-colors', corFase)}>
          <p className="text-sm font-semibold uppercase tracking-wider opacity-90">
            {NOME_FASE[fase]}{(fase === 'preparo' || fase === 'forca' || fase === 'descanso') && ` · repetição ${rep}/${config.repeticoes}`}
          </p>
          {(fase === 'preparo' || fase === 'forca' || fase === 'descanso') && (
            <p className="text-6xl font-bold tabular-nums leading-tight">{Math.ceil(restante)}</p>
          )}
          {pausado && <p className="text-sm font-semibold">Pausado</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between">
            <p className="text-4xl font-bold tabular-nums">{fmt(absAtual)}<span className="text-base text-muted-foreground ml-1">kgf</span></p>
            {alvo ? <p className={cn('text-sm font-semibold', noAlvoAgora ? 'text-emerald-600' : 'text-muted-foreground')}>alvo {fmt(alvo)} kgf</p> : null}
          </div>
          <div className="relative h-5 rounded-full bg-muted overflow-hidden">
            {alvo ? (
              <div
                className="absolute inset-y-0 bg-emerald-500/25 border-x border-emerald-600"
                style={{ left: `${((alvo * (1 - tol)) / escala) * 100}%`, width: `${((alvo * 2 * tol) / escala) * 100}%` }}
              />
            ) : null}
            <div className={cn('absolute inset-y-0 left-0 transition-[width] duration-75', noAlvoAgora ? 'bg-emerald-600' : 'bg-primary')} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs tabular-nums">
            {picos.map((p, i) => <span key={i} className="rounded-md bg-muted px-2 py-0.5">rep {i + 1}: <b>{fmt(p)}</b> kgf</span>)}
            {alvo && modo === 'treino' && <span className="rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2 py-0.5">no alvo: <b>{fmt(noAlvo)}</b> s</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {fase === 'aguardando' && (
            <Button className="flex-1 h-11 gap-2" onClick={iniciarEtapa} disabled={!celula.status.conectado}>
              <Play className="h-4 w-4" /> Iniciar {config.repeticoes > 1 ? `${config.repeticoes} repetições` : 'repetição'}
            </Button>
          )}
          {(fase === 'preparo' || fase === 'forca' || fase === 'descanso') && (
            <>
              <Button variant="outline" className="flex-1 gap-1.5" onClick={pausar}>
                {pausado ? <><Play className="h-4 w-4" /> Continuar</> : <><Pause className="h-4 w-4" /> Pausar</>}
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={repetirEtapa}><RotateCcw className="h-4 w-4" /> Recomeçar</Button>
            </>
          )}
          {fase === 'concluida' && (
            <>
              <Button variant="outline" className="gap-1.5" onClick={repetirEtapa}><RotateCcw className="h-4 w-4" /> Refazer</Button>
              <Button className="flex-1 h-11 gap-2" onClick={proxima}>
                {ultimo ? <><Square className="h-4 w-4" /> Finalizar</> : <><SkipForward className="h-4 w-4" /> Próximo: {etapas[idx + 1]?.titulo}</>}
              </Button>
            </>
          )}
          {fase === 'aguardando' && !ultimo && (
            <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={proxima}><SkipForward className="h-4 w-4" /> Pular</Button>
          )}
        </div>
        {!celula.status.conectado && <p className="text-xs text-red-600">Célula desconectada. Feche e conecte de novo.</p>}
        <p className="text-[11px] text-muted-foreground">
          {config.repeticoes}× {config.tempoForca}s de força · {config.descanso}s de descanso · {config.preparo}s de preparo
        </p>
      </DialogContent>
    </Dialog>
  );
}
