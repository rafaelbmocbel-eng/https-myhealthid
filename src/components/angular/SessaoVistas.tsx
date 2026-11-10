import { ArrowLeft, ArrowRight, Camera, Check, ClipboardList, SkipForward, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { nomeDoResultado, type OlharPara } from '@/lib/angular/medidas';
import { ROTULO_VISTA_SESSAO, type VistaSessao } from '@/lib/angular/tiposSessao';
import type { EstadoDaAba, SugestaoGuardada, VisaoDaSessao } from '@/hooks/useSessaoPostural';

const ROTULO_ESTADO: Record<EstadoDaAba, string> = { sem_foto: 'sem foto', marcando: 'marcando', salva: 'salva ✓', pulada: 'pulada' };

export interface AbaDaSessao {
  posicao: VistaSessao;
  /** Endereço da foto da posição, para a miniatura. */
  miniatura: string | null;
  estado: EstadoDaAba;
}

/**
 * Cabeçalho da sessão: as quatro posições como abas (miniatura e estado de cada uma) e quantas já têm medidas.
 * Trocar de aba só muda a posição que está na tela; nada se perde nas outras.
 */
export function SessaoVistas({ abas, atual, visao, feitas, total, aoIr, aoAbrirResumo }: {
  abas: AbaDaSessao[];
  atual: VistaSessao;
  visao: VisaoDaSessao;
  feitas: number;
  total: number;
  aoIr: (p: VistaSessao) => void;
  aoAbrirResumo: () => void;
}) {
  return (
    <section aria-label="Sessão de avaliação" className="space-y-2 rounded-2xl border border-border/60 bg-card p-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-sm font-semibold">Posições da avaliação</p>
        <p className="text-xs tabular-nums text-muted-foreground" data-testid="progresso-sessao">{feitas} de {total} posições</p>
      </div>
      <div role="tablist" aria-label="Posição da avaliação" className="grid grid-cols-4 gap-1">
        {abas.map((a) => {
          const selecionada = visao === 'posicao' && atual === a.posicao;
          return (
            <button key={a.posicao} type="button" role="tab" aria-selected={selecionada} onClick={() => aoIr(a.posicao)} data-estado={a.estado}
              className={cn('flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-1.5 text-center transition-colors',
                selecionada ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60')}>
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                {a.miniatura ? <img src={a.miniatura} alt="" className="h-full w-full object-cover" /> : a.estado === 'pulada' ? <SkipForward className="h-4 w-4" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
                {a.estado === 'salva' && (
                  <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl-md bg-emerald-600 text-white" aria-hidden><Check className="h-3 w-3" /></span>
                )}
              </span>
              <span className="text-[11px] font-semibold leading-tight">{ROTULO_VISTA_SESSAO[a.posicao]}</span>
              <span className={cn('text-[10px] leading-none', a.estado === 'salva' ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{ROTULO_ESTADO[a.estado]}</span>
            </button>
          );
        })}
      </div>
      <Button type="button" size="sm" variant={visao === 'resumo' ? 'default' : 'outline'} className="h-10 w-full gap-1.5" aria-pressed={visao === 'resumo'} onClick={aoAbrirResumo}>
        <ClipboardList className="h-4 w-4" /> Resumo da sessão
      </Button>
    </section>
  );
}

const TROCA_DE_LADOS = /trocado direito e esquerdo/i;

/**
 * O que a marcação automática achou: avisos (lado do perfil, direito e esquerdo trocados), medidas que ficaram sem sugestão
 * e o botão "Inverter D/E". Mostrar isso evita o profissional achar que o modelo marcou tudo certo quando não marcou.
 */
export function AvisosDaMarcacao({ sugestao, inverterDE, temPontosDoModelo, aoInverter, ocupado }: {
  sugestao: SugestaoGuardada | null;
  inverterDE: boolean;
  temPontosDoModelo: boolean;
  aoInverter: () => void;
  ocupado: boolean;
}) {
  if (!sugestao) return null;
  const { avisos, descartados, marcadas } = sugestao;
  const mostrarInverter = temPontosDoModelo && (inverterDE || avisos.some((a) => TROCA_DE_LADOS.test(a)));
  return (
    <div className="space-y-1.5 rounded-xl border border-border/60 bg-card p-2.5 text-xs" role="status" data-testid="avisos-marcacao">
      <p className="text-muted-foreground">
        {marcadas > 0
          ? <>Marquei <strong className="text-foreground">{marcadas} medida(s)</strong> com o modelo de pose. Confira cada ponto e arraste o que estiver fora do lugar: o modelo marca o centro da articulação, não o ponto ósseo.</>
          : 'O modelo não marcou nenhuma medida nesta foto. Marque os pontos à mão.'}
      </p>
      {avisos.map((a) => (
        <p key={a} className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> <span>{a}</span>
        </p>
      ))}
      {descartados.length > 0 && (
        <div>
          <p className="font-medium text-foreground">Não marquei:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {descartados.map((d) => <li key={d.medidaId}>{nomeDoResultado(d.medidaId) ?? d.medidaId}: {d.motivo}</li>)}
          </ul>
        </div>
      )}
      {mostrarInverter && (
        <Button type="button" size="sm" variant="outline" className="h-10 w-full gap-1.5" onClick={aoInverter} disabled={ocupado}>
          {inverterDE ? 'Desfazer a inversão D/E' : 'Inverter D/E'}
        </Button>
      )}
    </div>
  );
}

/**
 * Para que lado da imagem o paciente olha na foto de perfil. Vale para todas as medidas de perfil da posição (joelho, braço,
 * cotovelo, fio de prumo): é ele que diz o que está "à frente" e o que está "atrás".
 */
export function SentidoDoOlhar({ valor, aoMudar }: { valor: OlharPara; aoMudar: (sentido: OlharPara) => void }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-border/60 bg-card p-2.5 text-xs" data-testid="sentido-do-olhar">
      <p className="font-medium">O paciente olha para a</p>
      <div className="grid grid-cols-2 gap-1.5">
        {([['esquerda', ArrowLeft], ['direita', ArrowRight]] as const).map(([sentido, Seta]) => (
          <button key={sentido} type="button" aria-pressed={valor === sentido} onClick={() => aoMudar(sentido)}
            className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 font-medium', valor === sentido ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
            <Seta className="h-4 w-4 shrink-0" aria-hidden /> {sentido === 'esquerda' ? 'Esquerda da imagem' : 'Direita da imagem'}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground">Vale para todas as medidas de perfil desta posição. Se estiver ao contrário, o que está à frente e o que está atrás saem trocados.</p>
    </div>
  );
}
