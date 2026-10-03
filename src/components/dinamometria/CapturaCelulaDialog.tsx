import { useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothOff, Circle, Loader2, Square, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bluetoothDisponivel, celula, type CampoValor, type StatusCelula } from '@/lib/dinamometria/celulaBle';
import { UF, type Unidade } from '@/lib/dinamometria/analise';

const CHAVE_UNIDADE = 'mh.celula.unidade';
const CHAVE_CAMPO = 'mh.celula.campo';

function lerPref<T>(k: string, padrao: T): T {
  try { const v = localStorage.getItem(k); return v != null ? (JSON.parse(v) as T) : padrao; } catch { return padrao; }
}
function gravarPref(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* armazenamento indisponível — só não lembra a preferência */ }
}

export interface CapturaCelula { t: number[]; fN: number[]; nome: string }

// Captura uma contração pela célula Bluetooth e devolve a curva força × tempo
// (t em s, força em N) — o mesmo formato que vem da planilha.
export default function CapturaCelulaDialog({ open, onOpenChange, titulo, onConcluir }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  onConcluir: (c: CapturaCelula) => void;
}) {
  const [status, setStatus] = useState<StatusCelula>(celula.status);
  const [conectando, setConectando] = useState(false);
  const [unidade, setUnidade] = useState<Unidade>(() => lerPref<Unidade>(CHAVE_UNIDADE, 'kgf'));
  const [campo, setCampo] = useState<CampoValor>(() => lerPref<CampoValor>(CHAVE_CAMPO, 'auto'));
  const [atual, setAtual] = useState<number | null>(null);
  const [pico, setPico] = useState(0);
  const [gravando, setGravando] = useState(false);
  const [nAmostras, setNAmostras] = useState(0);
  const [linhas, setLinhas] = useState<string[]>(celula.ultimasLinhas);
  const [verDados, setVerDados] = useState(false);
  const [comando, setComando] = useState('');

  const taraRef = useRef(0);
  const ultimoBrutoRef = useRef(0);
  const gravRef = useRef<{ t: number[]; v: number[] } | null>(null);
  const historicoRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { celula.campo = campo; gravarPref(CHAVE_CAMPO, campo); }, [campo]);
  useEffect(() => { gravarPref(CHAVE_UNIDADE, unidade); }, [unidade]);

  useEffect(() => {
    if (!open) return;
    const offS = celula.onStatus(setStatus);
    const offL = celula.onLinha(() => setLinhas([...celula.ultimasLinhas]));
    const offV = celula.onLeitura(({ valor, tMs }) => {
      ultimoBrutoRef.current = valor;
      const v = valor - taraRef.current;
      setAtual(v);
      historicoRef.current = [...historicoRef.current.slice(-299), v];
      if (gravRef.current) {
        gravRef.current.t.push(tMs);
        gravRef.current.v.push(v);
        setNAmostras(gravRef.current.v.length);
        setPico((p) => Math.max(p, v));
      }
      desenhar();
    });
    setStatus(celula.status);
    return () => { offS(); offL(); offV(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const desenhar = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const w = cv.width, h = cv.height, dados = historicoRef.current;
    ctx.clearRect(0, 0, w, h);
    if (dados.length < 2) return;
    const max = Math.max(1, ...dados), min = Math.min(0, ...dados);
    ctx.strokeStyle = getComputedStyle(cv).color || '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dados.forEach((v, i) => {
      const x = (i / (dados.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const conectar = async (qualquer = false) => {
    setConectando(true);
    try {
      await celula.conectar(qualquer);
      toast.success('Célula conectada');
    } catch (e: any) {
      // Fechar a janela de escolha do Bluetooth não é erro.
      if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Não consegui conectar à célula.');
    } finally {
      setConectando(false);
    }
  };

  const zerar = () => { taraRef.current = ultimoBrutoRef.current; setAtual(0); historicoRef.current = []; };

  const iniciar = () => {
    gravRef.current = { t: [], v: [] };
    setNAmostras(0);
    setPico(0);
    setGravando(true);
  };

  const parar = () => {
    const g = gravRef.current;
    gravRef.current = null;
    setGravando(false);
    if (!g || g.v.length < 20) { toast.error('Poucas leituras. Grave a contração inteira (alguns segundos).'); return; }
    // A célula pode mandar várias leituras no mesmo pacote (mesmo horário de
    // chegada): usa a taxa média da gravação para um tempo uniforme.
    const dur = (g.t[g.t.length - 1] - g.t[0]) / 1000;
    const hz = dur > 0 ? (g.v.length - 1) / dur : 50;
    const t = g.v.map((_, i) => i / hz);
    const fN = g.v.map((v) => v * UF[unidade]);
    onConcluir({ t, fN, nome: status.conectado ? status.nome : 'Célula' });
    onOpenChange(false);
  };

  const enviarComando = async () => {
    if (!comando.trim()) return;
    try { await celula.enviar(comando.trim()); toast.success('Comando enviado'); } catch (e: any) { toast.error(e?.message || 'Falha ao enviar'); }
  };

  const fmt = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && gravando) parar(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bluetooth className="h-4 w-4 text-primary" /> Célula de carga</DialogTitle>
          <DialogDescription>{titulo}</DialogDescription>
        </DialogHeader>

        {!bluetoothDisponivel() ? (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-900/15 p-3 text-sm space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><BluetoothOff className="h-4 w-4" /> Bluetooth indisponível aqui</p>
            <p className="text-xs text-muted-foreground">
              Abra o My Health ID no <b>Chrome</b> (Android ou computador). No iPhone e dentro do app instalado o navegador não libera Bluetooth.
            </p>
          </div>
        ) : !status.conectado ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ligue a célula e toque em conectar. Ela aparece como <b>$FBLOCK-…</b>.</p>
            <Button className="w-full gap-2" onClick={() => conectar(false)} disabled={conectando}>
              {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />} Conectar célula
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => conectar(true)} disabled={conectando}>
              Não aparece? Procurar todos os aparelhos
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {status.nome}
              </span>
              <button className="text-muted-foreground underline" onClick={() => celula.desconectar()} disabled={gravando}>Desconectar</button>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Agora</p>
                  <p className="text-4xl font-bold tabular-nums leading-none">{fmt(atual)}<span className="text-base font-medium text-muted-foreground ml-1">{unidade}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pico</p>
                  <p className="text-2xl font-semibold tabular-nums leading-none">{fmt(gravando || nAmostras ? pico : null)}</p>
                </div>
              </div>
              <canvas ref={canvasRef} width={360} height={80} className="mt-2 w-full h-20 text-primary" />
              {gravando && <p className="text-[11px] text-muted-foreground tabular-nums">{nAmostras} leituras</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">A célula mede em</Label>
                <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)} disabled={gravando}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kgf">kgf (kg)</SelectItem>
                    <SelectItem value="N">N (newton)</SelectItem>
                    <SelectItem value="lbf">lbf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full gap-1.5" onClick={zerar} disabled={gravando}>
                  <Target className="h-4 w-4" /> Zerar (tara)
                </Button>
              </div>
            </div>

            {!gravando ? (
              <Button className="w-full h-11 gap-2 bg-red-600 hover:bg-red-700 text-white" onClick={iniciar}>
                <Circle className="h-4 w-4 fill-current" /> Gravar contração
              </Button>
            ) : (
              <Button className="w-full h-11 gap-2" onClick={parar}>
                <Square className="h-4 w-4 fill-current" /> Parar e usar esta curva
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              Grave a contração inteira: comece relaxado, faça força máxima por alguns segundos e relaxe antes de parar.
            </p>

            <button className="text-[11px] text-muted-foreground underline" onClick={() => setVerDados((v) => !v)}>
              {verDados ? 'Ocultar' : 'Ver'} dados recebidos
            </button>
            {verDados && (
              <div className="space-y-2">
                <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-[10px] leading-tight">{linhas.slice(-15).join('\n') || '(nada recebido ainda)'}</pre>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] shrink-0">Número usado</Label>
                  <Select value={String(campo)} onValueChange={(v) => setCampo(v === 'auto' ? 'auto' : Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático (último da linha)</SelectItem>
                      <SelectItem value="0">1º número</SelectItem>
                      <SelectItem value="1">2º número</SelectItem>
                      <SelectItem value="2">3º número</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input value={comando} onChange={(e) => setComando(e.target.value)} placeholder="Enviar comando (opcional)" className="h-8 text-xs" />
                  <Button size="sm" variant="outline" onClick={enviarComando}>Enviar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
