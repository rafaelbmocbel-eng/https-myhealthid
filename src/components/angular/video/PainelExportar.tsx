import type { ReactNode } from 'react';
import { ClipboardCheck, Copy, FileDown, FolderOpen, Instagram, Loader2, Save, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

const base = 'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

function Acao({ icone, titulo, detalhe, onClick, desabilitado, ocupado, primario, testid }: { icone: ReactNode; titulo: string; detalhe?: string; onClick: () => void; desabilitado?: boolean; ocupado?: boolean; primario?: boolean; testid?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado || ocupado} data-testid={testid}
      className={cn(base, 'flex-col gap-0.5 py-2', primario ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/92' : 'border-border/60 bg-card hover:bg-muted/50')}>
      <span className="flex items-center gap-2">{ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icone}{titulo}</span>
      {detalhe && <span className={cn('text-[11px] font-normal', primario ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{detalhe}</span>}
    </button>
  );
}

interface Props {
  temAnalise: boolean;
  gerandoPdf: boolean;
  registrando: boolean;
  temPaciente: boolean;
  correcoes: { quadros: number; pontos: number };
  /** O módulo de exportação de vídeo está neste build. */
  videoDisponivel?: boolean;
  preparandoVideo?: boolean;
  aoBaixarVideo: () => void;
  aoQuadroInstagram: () => void;
  aoPdf: () => void;
  aoSalvar: () => void;
  aoAbrir: (arquivo: File) => void;
  aoRegistrar: () => void;
  aoCopiar: () => void;
}

// Saídas da análise: vídeo analisado, quadro e vídeo no formato do Instagram, PDF, arquivo para retomar e nota do prontuário.
export default function PainelExportar({ temAnalise, gerandoPdf, registrando, temPaciente, correcoes, videoDisponivel = true, preparandoVideo = false, aoBaixarVideo, aoQuadroInstagram, aoPdf, aoSalvar, aoAbrir, aoRegistrar, aoCopiar }: Props) {
  return (
    <div className="space-y-3">
      <Acao primario testid="baixar-video" icone={<Video className="h-4 w-4" />} titulo="Baixar vídeo analisado" detalhe={videoDisponivel ? 'Com ângulos, gráfico e métricas; pode sair no formato do Instagram' : 'Indisponível nesta versão do app'} onClick={aoBaixarVideo} desabilitado={!temAnalise || !videoDisponivel} ocupado={preparandoVideo} />
      <div className="grid grid-cols-2 gap-2">
        <Acao testid="baixar-quadro" icone={<Instagram className="h-4 w-4" />} titulo="Quadro" detalhe="para o Instagram" onClick={aoQuadroInstagram} desabilitado={!temAnalise} />
        <Acao testid="gerar-pdf" icone={<FileDown className="h-4 w-4" />} titulo="PDF" detalhe="métricas e gráficos" onClick={aoPdf} ocupado={gerandoPdf} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Acao testid="salvar-analise" icone={<Save className="h-4 w-4" />} titulo="Salvar análise" detalhe="arquivo .json" onClick={aoSalvar} desabilitado={!temAnalise} />
        <label className={cn(base, 'cursor-pointer flex-col gap-0.5 border-border/60 bg-card py-2 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring')}>
          <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" aria-hidden /> Abrir análise</span>
          <span className="text-[11px] font-normal text-muted-foreground">retomar de um .json</span>
          <input type="file" accept="application/json,.json" className="sr-only" data-testid="abrir-analise"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) aoAbrir(f); }} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Acao testid="registrar-prontuario" icone={<ClipboardCheck className="h-4 w-4" />} titulo="Registrar" detalhe="no prontuário" onClick={aoRegistrar} desabilitado={!temPaciente || !temAnalise} ocupado={registrando} />
        <Acao testid="copiar-resumo" icone={<Copy className="h-4 w-4" />} titulo="Copiar resumo" onClick={aoCopiar} desabilitado={!temAnalise} />
      </div>
      {!temPaciente && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo da página para registrar no prontuário.</p>}
      <p className="rounded-xl bg-muted/40 p-2.5 text-[11px] leading-snug text-muted-foreground">
        {correcoes.pontos > 0
          ? `Você corrigiu ${correcoes.pontos} ${correcoes.pontos === 1 ? 'ponto' : 'pontos'} em ${correcoes.quadros} ${correcoes.quadros === 1 ? 'quadro' : 'quadros'}: tudo que sai daqui (vídeo, PDF, quadro) já usa as correções. `
          : 'Tudo que sai daqui usa os pontos como estão agora; se corrigir algum, as saídas seguintes já vêm corrigidas. '}
        O vídeo original fica só neste aparelho e a análise salva guarda apenas os pontos.
      </p>
    </div>
  );
}
