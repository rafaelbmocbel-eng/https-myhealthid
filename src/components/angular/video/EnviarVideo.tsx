import { FolderOpen, Film } from 'lucide-react';
import { DURACAO_SUGERIDA_S } from '@/lib/angular/analiseVideo/tempo';

interface Props {
  aoEscolherVideo: (arquivo: File) => void;
  aoAbrirAnalise: (arquivo: File) => void;
  dica?: string;
  ocupado?: boolean;
}

// Primeiro passo: gravar ou escolher o vídeo (ou abrir uma análise salva). O vídeo fica só neste aparelho.
export default function EnviarVideo({ aoEscolherVideo, aoAbrirAnalise, dica, ocupado }: Props) {
  return (
    <div className="space-y-3">
      <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center transition-colors hover:bg-muted/30 focus-within:ring-2 focus-within:ring-ring">
        <Film className="h-9 w-9 text-muted-foreground" aria-hidden />
        <span className="text-base font-semibold">{ocupado ? 'Abrindo o vídeo…' : 'Gravar ou escolher o vídeo'}</span>
        <span className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {dica ?? 'Câmera parada, o corpo inteiro no quadro, boa luz e roupa justa.'} Vídeos curtos (5 a {DURACAO_SUGERIDA_S} s) funcionam melhor. Para medir o movimento com precisão, grave em câmera lenta. O vídeo fica só neste aparelho.
        </span>
        <input type="file" accept="video/*" className="sr-only" disabled={ocupado} data-testid="entrada-video"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) aoEscolherVideo(f); }} />
      </label>
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border/60 bg-card px-3 text-sm font-medium hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring">
        <FolderOpen className="h-4 w-4" aria-hidden /> Abrir uma análise salva (.json)
        <input type="file" accept="application/json,.json" className="sr-only" data-testid="entrada-analise"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) aoAbrirAnalise(f); }} />
      </label>
    </div>
  );
}
