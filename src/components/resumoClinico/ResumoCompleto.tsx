import { useMemo, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFontesClinicas } from '@/hooks/useFontesClinicas';
import {
  AVISO_DO_RESUMO_COMPLETO, AVISO_DOS_SELOS_DO_CABECALHO, montarResumoCompleto, NOTA_EDITADO_PELO_PROFISSIONAL, textoParaCopiar,
} from '@/lib/resumoClinico/resumoCompleto';
import { FONTES_VAZIAS } from '@/lib/resumoClinico/tipos';
import AvisoDeFalhas from './AvisoDeFalhas';
import SeloDeOrigem from './SeloDeOrigem';

type SituacaoDaCopia = 'copiado' | 'falhou' | null;

interface Props {
  pacienteId: string;
  resultado: unknown;
  // Edições à mão que a tela da avaliação guarda (_secoes.editadas), já com o que foi salvo nesta sessão.
  editadas?: unknown;
}

// Visão completa: SOMENTE LEITURA. Não passa por sincronizarProntuario nem grava nada.
export default function ResumoCompleto({ pacienteId, resultado, editadas }: Props) {
  const { data, isLoading, isError } = useFontesClinicas(pacienteId);
  const [copia, setCopia] = useState<SituacaoDaCopia>(null);

  const secoes = useMemo(() => montarResumoCompleto(resultado, data?.fontes ?? FONTES_VAZIAS, editadas), [resultado, data, editadas]);
  const falhas = data?.falhas ?? (isError ? ['o que o cliente relatou'] : []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoParaCopiar(secoes));
      setCopia('copiado');
    } catch {
      // Sem permissão ou sem navigator.clipboard (página sem https): o aviso pede para copiar à mão.
      setCopia('falhou');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-xs leading-snug text-muted-foreground">
          <span>{AVISO_DO_RESUMO_COMPLETO}</span> <span>{AVISO_DOS_SELOS_DO_CABECALHO}</span>
        </p>
        <Button type="button" size="sm" variant="outline" className="min-h-11 gap-1.5 px-3" onClick={copiar} disabled={secoes.length === 0}>
          {copia === 'copiado' ? <Check className="icon-xs" aria-hidden="true" /> : <Copy className="icon-xs" aria-hidden="true" />}
          Copiar
        </Button>
      </div>
      {copia === 'copiado' && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">Copiado.</p>}
      {copia === 'falhou' && <p role="status" className="text-xs text-destructive">Não consegui copiar. Selecione o texto e copie à mão.</p>}

      <AvisoDeFalhas falhas={falhas} />

      {secoes.map((s) => (
        <section key={s.id} aria-label={s.titulo} data-origem={s.origem} className="space-y-1.5 rounded-lg border border-border/30 bg-background/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.titulo}</h4>
            {s.origem === 'cliente' && <SeloDeOrigem origem="cliente" />}
            {s.editada && (
              <span className="inline-flex max-w-full items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-xs font-medium leading-tight text-sky-800 dark:text-sky-300">
                {NOTA_EDITADO_PELO_PROFISSIONAL}
              </span>
            )}
          </div>
          {s.linhas.map((linha, i) => (
            <p key={`${s.id}-${i}`} className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">{linha}</p>
          ))}
        </section>
      ))}

      {isLoading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="icon-xs animate-spin" aria-hidden="true" /> Buscando o que o cliente relatou…
        </p>
      )}
      {!isLoading && secoes.length === 0 && falhas.length === 0 && (
        <p className="text-sm text-muted-foreground">Ainda não há conteúdo para montar o resumo completo.</p>
      )}
    </div>
  );
}
