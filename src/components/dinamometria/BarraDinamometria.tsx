import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bluetooth, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { celula, type StatusCelula } from '@/lib/dinamometria/celulaBle';
import BateriaCelula from './BateriaCelula';
import { cn } from '@/lib/utils';

// Barra fixa no topo das telas da dinamometria (cara de programa): voltar,
// título, cliente, status da célula e, abaixo, as abas da tela.
export default function BarraDinamometria({ titulo, cliente, voltar, children }: {
  titulo: string;
  cliente?: string | null;
  /** Rota de volta; sem ela, volta para a tela anterior. */
  voltar?: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusCelula>(celula.status);
  useEffect(() => celula.onStatus(setStatus), []);
  const reconectando = !status.conectado && (status as { reconectando?: boolean }).reconectando;

  const voltarPagina = () => {
    if (voltar) navigate(voltar);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/aplicacoes');
  };

  return (
    // Fica logo abaixo do cabeçalho fixo do app (h-14 no celular, h-16 no computador).
    <div className="sticky top-14 md:top-16 z-[15] pt-2 pb-2.5 mb-4 bg-background/90 backdrop-blur-md border-b border-border/60">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={voltarPagina} aria-label="Voltar"
          className="h-10 w-10 shrink-0 rounded-full border border-border/70 bg-card flex items-center justify-center hover:bg-muted active:scale-95 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">Dinamometria</p>
          <p className="text-base font-bold leading-tight truncate">{titulo}</p>
          {cliente && <p className="text-xs text-muted-foreground truncate">{cliente}</p>}
        </div>
        {status.conectado ? (
          <div className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/30 pl-2 pr-2.5 py-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline text-xs font-semibold text-emerald-800 dark:text-emerald-300">{status.nome}</span>
            <BateriaCelula pct={celula.bateriaPct} volts={celula.bateriaVolts} />
          </div>
        ) : (
          <button type="button"
            onClick={() => celula.conectar().catch((e: any) => { if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Não consegui conectar.'); })}
            className={cn('shrink-0 rounded-full border px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold transition',
              reconectando ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'border-border bg-card hover:bg-muted')}>
            <Bluetooth className="h-3.5 w-3.5" /> {reconectando ? 'Religando…' : 'Célula'}
          </button>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
