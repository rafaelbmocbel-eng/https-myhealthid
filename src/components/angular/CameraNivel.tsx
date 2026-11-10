import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, SkipForward, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useInclinometro } from '@/hooks/useInclinometro';
import { detectarPose } from '@/lib/angular/detector';
import { LADO_MAX_FOTO, landmarksParaGuia } from '@/lib/angular/fotoSessao';
import { avaliarEnquadramento, type Enquadramento } from '@/lib/angular/pose';

const DICAS = 'Fique a cerca de 2 a 3 m do paciente, com o celular na vertical e na altura do quadril, e o corpo inteiro dentro da moldura.';

interface Props {
  /** Foto tirada. A câmera continua aberta: quem usa decide se fecha (uma foto só) ou segue para a próxima posição. */
  onCapturar: (arquivo: File, inclinacao: number | null) => void;
  onFechar: () => void;
  /** Sequência da sessão: "Foto 2 de 4", o nome da posição e o que pedir ao paciente. Sem isso, é uma foto avulsa. */
  progresso?: string;
  posicao?: string;
  instrucao?: string;
  /** Confirmação da última foto guardada ("Frente guardada"). */
  ultima?: string;
  /** Pula a posição atual sem fotografar. */
  onPular?: () => void;
}

// Câmera dentro do app que orienta a distância e o enquadramento. A inclinação do celular na hora da foto
// é gravada em silêncio e usada depois pela função Nível, sem nada a mais na tela. Na sessão, depois de cada foto
// a mesma câmera segue para a próxima posição, sem reabrir.
export default function CameraNivel({ onCapturar, onFechar, progresso, posicao, instrucao, ultima, onPular }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState('');
  const [guia, setGuia] = useState<Enquadramento | null>(null);
  const { graus, ativar } = useInclinometro();
  const grausRef = useRef<number | null>(null);
  grausRef.current = graus;

  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let vivo = true;
    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!vivo) { fluxo.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = fluxo; await videoRef.current.play(); }
        setPronta(true);
      } catch {
        // Permissão da câmera negada ou navegador sem câmera: o profissional usa o seletor de arquivo.
        setErro('Não consegui abrir a câmera. Libere o acesso à câmera ou escolha a foto pela galeria.');
      }
    })();
    void ativar();
    return () => { vivo = false; fluxo?.getTracks().forEach((t) => t.stop()); };
  }, [ativar]);

  // Confere o enquadramento umas duas vezes por segundo; sem o modelo (offline), fica só a moldura.
  useEffect(() => {
    if (!pronta) return;
    let vivo = true;
    let ocupado = false;
    const id = window.setInterval(async () => {
      const v = videoRef.current;
      if (ocupado || !v || !v.videoWidth) return;
      ocupado = true;
      try {
        const lm = await detectarPose(v);
        if (vivo) setGuia(avaliarEnquadramento(landmarksParaGuia(lm)));
      } catch {
        // Modelo indisponível (sem internet): segue só com a moldura e as dicas.
        if (vivo) setGuia(null);
      } finally {
        ocupado = false;
      }
    }, 600);
    return () => { vivo = false; window.clearInterval(id); };
  }, [pronta]);

  const capturar = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    // A foto já nasce reduzida (no máximo LADO_MAX_FOTO no maior lado): quatro fotos de uma sessão precisam caber na memória do celular.
    const k = Math.min(1, LADO_MAX_FOTO / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
    cv.getContext('2d')?.drawImage(v, 0, 0, cv.width, cv.height);
    cv.toBlob((b) => {
      if (!b) { toast.error('Não consegui capturar a foto.'); return; }
      onCapturar(new File([b], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }), grausRef.current);
    }, 'image/jpeg', 0.92);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-md gap-3 p-3" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base">{posicao ? `${progresso ?? 'Tirar a foto'}: ${posicao}` : 'Tirar a foto'}</DialogTitle>
        </DialogHeader>
        {instrucao && <p className="text-sm font-medium" data-testid="instrucao-camera">{instrucao}</p>}
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className={cn("block w-full object-contain", instrucao ? "max-h-[48dvh]" : "max-h-[62dvh]")} />
          {pronta && (
            <svg viewBox="0 0 100 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <rect x="22" y="6" width="56" height="148" rx="6" fill="none" stroke={guia?.ok ? '#22c55e' : '#fff'} strokeOpacity={guia?.ok ? 0.9 : 0.6} strokeWidth="0.8" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
              <line x1="50" x2="50" y1="6" y2="154" stroke="#fff" strokeOpacity="0.25" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {erro && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">{erro}</p>}
        </div>
        <div className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-sm', guia?.ok ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border/60')} role="status">
          {guia?.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="font-medium">{guia ? guia.mensagem : DICAS}</span>
        </div>
        {ultima && <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {ultima}</p>}
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={capturar} disabled={!pronta}><Camera className="h-4 w-4" /> Tirar foto</Button>
          {onPular && <Button variant="outline" className="gap-1.5" onClick={onPular}><SkipForward className="h-4 w-4" /> Pular</Button>}
          <Button variant="outline" onClick={onFechar} aria-label={progresso ? 'Terminar as fotos' : 'Fechar'}><X className="h-4 w-4" /></Button>
        </div>
        {guia && <p className="text-[11px] text-muted-foreground">{DICAS}</p>}
      </DialogContent>
    </Dialog>
  );
}
