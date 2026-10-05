import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useInclinometro } from '@/hooks/useInclinometro';
import { detectarPose } from '@/lib/angular/detector';
import { avaliarEnquadramento, type Enquadramento } from '@/lib/angular/pose';

const DICAS = 'Fique a cerca de 2 a 3 m do paciente, com o celular na vertical e na altura do quadril, e o corpo inteiro dentro da moldura.';

// Câmera dentro do app que orienta a distância e o enquadramento. A inclinação do celular na hora da foto
// é gravada em silêncio e usada depois pela função Nível, sem nada a mais na tela.
export default function CameraNivel({ onCapturar, onFechar }: { onCapturar: (arquivo: File, inclinacao: number | null) => void; onFechar: () => void }) {
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
        if (vivo) setGuia(avaliarEnquadramento(lm));
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
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d')?.drawImage(v, 0, 0);
    cv.toBlob((b) => {
      if (!b) { toast.error('Não consegui capturar a foto.'); return; }
      onCapturar(new File([b], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }), grausRef.current);
    }, 'image/jpeg', 0.92);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-md gap-3 p-3">
        <DialogHeader><DialogTitle className="text-base">Tirar a foto</DialogTitle></DialogHeader>
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="block max-h-[62dvh] w-full object-contain" />
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
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={capturar} disabled={!pronta}><Camera className="h-4 w-4" /> Tirar foto</Button>
          <Button variant="outline" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></Button>
        </div>
        {guia && <p className="text-[11px] text-muted-foreground">{DICAS}</p>}
      </DialogContent>
    </Dialog>
  );
}
