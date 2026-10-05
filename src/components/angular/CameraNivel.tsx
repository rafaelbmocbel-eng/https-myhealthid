import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useInclinometro } from '@/hooks/useInclinometro';

// Câmera dentro do app com o nível do celular na tela: o profissional enquadra com a linha do horizonte
// verde e a foto sai com a inclinação do aparelho registrada, para corrigir o giro sem marcar nada na imagem.
export default function CameraNivel({ onCapturar, onFechar }: { onCapturar: (arquivo: File, inclinacao: number | null) => void; onFechar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState('');
  const { estado, graus, ativar } = useInclinometro();

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

  const capturar = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d')?.drawImage(v, 0, 0);
    cv.toBlob((b) => {
      if (!b) { toast.error('Não consegui capturar a foto.'); return; }
      onCapturar(new File([b], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }), graus);
    }, 'image/jpeg', 0.92);
  };

  const nivelado = graus !== null && Math.abs(graus) < 0.5;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-md gap-3 p-3">
        <DialogHeader><DialogTitle className="text-base">Foto com nível</DialogTitle></DialogHeader>
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="block max-h-[65dvh] w-full object-contain" />
          {pronta && (
            <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <line x1={-90} x2={90} y1={0} y2={0} stroke="#fff" strokeOpacity={0.5} strokeDasharray="4 4" />
              <g transform={`rotate(${-(graus ?? 0)})`}>
                <line x1={-90} x2={90} y1={0} y2={0} stroke={nivelado ? '#22c55e' : '#facc15'} strokeWidth={1.4} />
              </g>
            </svg>
          )}
          {erro && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">{erro}</p>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm font-semibold tabular-nums', nivelado && 'text-emerald-600')}>
            {graus === null ? (estado === 'ativo' ? 'Segure o celular em pé' : 'Sensor desligado') : `${graus.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°${nivelado ? ' · nivelado' : ''}`}
          </p>
          {estado !== 'ativo' && <Button size="sm" variant="outline" onClick={() => void ativar()}>Ativar sensor</Button>}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={capturar} disabled={!pronta}><Camera className="h-4 w-4" /> Tirar foto</Button>
          <Button variant="outline" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-[11px] text-muted-foreground">A linha amarela é o horizonte do aparelho: fica verde quando o celular está reto. Se tirar a foto torta, o app guarda a inclinação e corrige os ângulos (confira com a grade).</p>
      </DialogContent>
    </Dialog>
  );
}
