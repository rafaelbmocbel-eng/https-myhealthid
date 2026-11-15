import { useMemo, useState } from 'react';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hojeLocalISO } from '@/lib/dataLocal';
import { useFontesClinicas } from '@/hooks/useFontesClinicas';
import { formatarData } from '@/lib/resumoClinico/datas';
import { agruparPorAno, montarLinhaDoTempo } from '@/lib/resumoClinico/marcos';
import { FONTES_VAZIAS, ROTULO_REGISTRO_NO_APP } from '@/lib/resumoClinico/tipos';
import type { Marco } from '@/lib/resumoClinico/tipos';
import AvisoDeFalhas from './AvisoDeFalhas';
import SeloDeOrigem from './SeloDeOrigem';

const MARCOS_VISIVEIS = 6;

function ItemDoMarco({ marco }: { marco: Marco }) {
  const registro = marco.natureza === 'registro';
  return (
    <li data-natureza={marco.natureza} data-precisao={marco.data.precisao} className="relative">
      {/* Cheio = fato clínico com data; vazado = registro no app (quando algo foi feito no app). */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-primary',
          registro ? 'bg-background' : 'bg-primary',
        )}
      />
      <div className="min-w-0 space-y-0.5">
        <p className="break-words text-[13px] font-medium leading-snug text-foreground">
          <span className="sr-only">{registro ? 'Registro no app: ' : 'Fato clínico: '}</span>
          {marco.titulo}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatarData(marco.data)} · {marco.rotuloTipo}
          {registro && ` · ${ROTULO_REGISTRO_NO_APP}`}
        </p>
        {marco.detalhe && <p className="whitespace-pre-wrap break-words text-[12px] leading-snug text-foreground/75">{marco.detalhe}</p>}
        <SeloDeOrigem origem={marco.origem} />
      </div>
    </li>
  );
}

// Só LEITURA e calculada na hora: não grava nada e não entra no prontuário.
export default function LinhaDoTempoClinica({ pacienteId }: { pacienteId: string }) {
  const { data, isLoading, isError } = useFontesClinicas(pacienteId);
  const [verTodos, setVerTodos] = useState(false);
  const [semDataAberta, setSemDataAberta] = useState(false);
  const hoje = hojeLocalISO();

  const linha = useMemo(() => montarLinhaDoTempo(data?.fontes ?? FONTES_VAZIAS, hoje), [data, hoje]);
  const falhas = data?.falhas ?? (isError ? ['os dados do paciente'] : []);

  // Mais recente primeiro: é a ordem do restante do app (prontuário e linha do tempo da aba Evolução).
  const visiveis = verTodos ? linha.marcos : linha.marcos.slice(0, MARCOS_VISIVEIS);
  const grupos = agruparPorAno(visiveis);
  const vazia = linha.marcos.length === 0 && linha.semData.length === 0;

  return (
    <section aria-labelledby="titulo-linha-do-tempo-clinica" className="space-y-3 rounded-2xl border border-border/50 bg-card px-3 py-3 shadow-xs sm:px-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600" aria-hidden="true">
          <History className="icon-sm" />
        </span>
        <div className="min-w-0">
          <h3 id="titulo-linha-do-tempo-clinica" className="text-[13px] font-medium leading-tight text-foreground">Linha do tempo clínica</h3>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Marcos do histórico do paciente, do mais recente para o mais antigo. Montada na hora; não vai para o prontuário.
          </p>
        </div>
      </div>

      <AvisoDeFalhas falhas={falhas} />
      {linha.ignorados > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {linha.ignorados} {linha.ignorados === 1 ? 'registro ficou' : 'registros ficaram'} de fora porque a data não é válida.
        </p>
      )}

      {isLoading && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="icon-xs animate-spin" aria-hidden="true" /> Montando a linha do tempo…
        </p>
      )}

      {!isLoading && vazia && falhas.length === 0 && (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-3 text-[12px] leading-snug text-muted-foreground">
          Ainda não há marcos para mostrar. Eles aparecem aqui quando o cliente responde o MyID, o histórico clínico e a história
          atual, ou quando você registra uma avaliação presencial, um diagnóstico, um exame, um teste ou um fato da história de vida.
        </p>
      )}

      <div id="linha-do-tempo-marcos" className="space-y-3">
        {grupos.map((g) => (
          <div key={g.ano} className="space-y-2">
            <h4 className="text-[12px] font-semibold tabular-nums text-foreground/80">{g.ano}</h4>
            <ol className="ml-1.5 space-y-3 border-l-2 border-border/60 pl-4">
              {g.marcos.map((m) => <ItemDoMarco key={m.id} marco={m} />)}
            </ol>
          </div>
        ))}
      </div>

      {linha.marcos.length > MARCOS_VISIVEIS && (
        <button
          type="button"
          aria-expanded={verTodos}
          aria-controls="linha-do-tempo-marcos"
          onClick={() => setVerTodos((v) => !v)}
          className="min-h-11 rounded-md px-2 text-[12px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {verTodos ? 'Ver menos' : `Ver todos (${linha.marcos.length})`}
        </button>
      )}

      {linha.semData.length > 0 && (
        <div className="border-t border-border/40 pt-1">
          <button
            type="button"
            aria-expanded={semDataAberta}
            aria-controls="linha-do-tempo-sem-data"
            onClick={() => setSemDataAberta((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-[12px] font-medium text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Sem data</span>
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              <span className="tabular-nums">{linha.semData.length}</span>
              <ChevronDown className={cn('icon-xs transition-transform', semDataAberta && 'rotate-180')} aria-hidden="true" />
            </span>
          </button>
          {/* Sempre montada (só escondida) para o aria-controls do botão apontar para um id que existe. */}
          <ul id="linha-do-tempo-sem-data" hidden={!semDataAberta} className="mt-1 space-y-3">
            {linha.semData.map((item) => (
              <li key={item.id} className="min-w-0 space-y-0.5 border-l-2 border-dashed border-border/60 pl-3">
                <p className="break-words text-[13px] font-medium leading-snug text-foreground">{item.titulo}</p>
                <p className="whitespace-pre-wrap break-words text-[12px] leading-snug text-foreground/75">{item.detalhe}</p>
                <SeloDeOrigem origem={item.origem} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
