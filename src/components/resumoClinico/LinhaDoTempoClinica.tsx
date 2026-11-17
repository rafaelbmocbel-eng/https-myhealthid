import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hojeLocalISO } from '@/lib/dataLocal';
import { useAchadosParaRevisao, useFontesClinicas } from '@/hooks/useFontesClinicas';
import { formatarData } from '@/lib/resumoClinico/datas';
import { detalheParaExibir, rotuloDoTipoParaExibir, textoDoBotaoAbrir } from '@/lib/resumoClinico/exibicao';
import { deveMostrarFiltros, filtrarMarcos, opcoesDeFiltro } from '@/lib/resumoClinico/filtros';
import type { IdDoFiltro } from '@/lib/resumoClinico/filtros';
import { agruparPorAno, montarLinhaDoTempo, tituloParaExibir } from '@/lib/resumoClinico/marcos';
import { FONTES_VAZIAS, ROTULO_DOS_ACHADOS_DO_HISTORICO, ROTULO_REGISTRO_NO_APP } from '@/lib/resumoClinico/tipos';
import type { DestinoDoRegistro, Marco } from '@/lib/resumoClinico/tipos';
import AvisoDeFalhas from './AvisoDeFalhas';
import AvisoDosAchadosDoHistorico from './AvisoDosAchadosDoHistorico';
import ComoComecouCard from './ComoComecouCard';
import FiltroDeMarcos from './FiltroDeMarcos';
import RegistrosDeFora from './RegistrosDeFora';
import SeloDeOrigem from './SeloDeOrigem';

const MARCOS_VISIVEIS = 6;

interface PropsDoItem {
  marco: Marco;
  onAbrirRegistro?: (destino: DestinoDoRegistro) => void;
  registroAbrivel?: (destino: DestinoDoRegistro) => boolean;
}

function ItemDoMarco({ marco, onAbrirRegistro, registroAbrivel }: PropsDoItem) {
  const registro = marco.natureza === 'registro';
  const destino = marco.destino;
  const nomeDoBotao = textoDoBotaoAbrir(marco);
  const abrivel = !!destino && (registroAbrivel?.(destino) ?? true);
  const linhaDaData = [formatarData(marco.data), rotuloDoTipoParaExibir(marco), registro ? ROTULO_REGISTRO_NO_APP : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li data-natureza={marco.natureza} data-precisao={marco.data.precisao} className="relative">
      {/* Cheio = fato clínico com data; vazado = registro no app (quando algo foi feito no app). */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-primary',
          registro ? 'bg-background' : 'bg-primary',
        )}
      />
      <div className="min-w-0 space-y-0.5">
        <p className="break-words text-sm font-medium leading-snug text-foreground">
          <span className="sr-only">{registro ? 'Registro no app: ' : 'Fato clínico: '}</span>
          {tituloParaExibir(marco)}
        </p>
        <p className="text-xs text-muted-foreground">{linhaDaData}</p>
        {marco.detalhe && <p className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground/75">{marco.detalhe}</p>}
        <SeloDeOrigem origem={marco.origem} />
        {onAbrirRegistro && destino && nomeDoBotao && abrivel && (
          <button
            type="button"
            aria-label={nomeDoBotao}
            onClick={() => onAbrirRegistro(destino)}
            className="mt-1 inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-background px-3 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Abrir
            <ArrowRight className="icon-xs shrink-0" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

interface Props {
  pacienteId: string;
  // Leva o profissional ao Avatar do mesmo paciente (o dono da aba é quem sabe trocar de aba). Sem ela, o aviso dos achados
  // aparece sem o botão.
  onAbrirAvatar?: () => void;
  // Leva ao registro de origem de um marco (a avaliação ou o diagnóstico); a página é quem sabe rolar até ele. Sem ela, nenhum
  // marco ganha o botão "Abrir": nunca um botão que não leva a lugar nenhum.
  onAbrirRegistro?: (destino: DestinoDoRegistro) => void;
  // Diz se aquele destino tem onde abrir nesta tela (a lente pode esconder o cartão de CID; uma avaliação antiga não está na
  // aba). Sem ela, todo marco com destino ganha o botão.
  registroAbrivel?: (destino: DestinoDoRegistro) => boolean;
}

// Só LEITURA e calculada na hora: não grava nada e não entra no prontuário. O filtro e o "Ver todos" só mudam o que aparece.
export default function LinhaDoTempoClinica({ pacienteId, onAbrirAvatar, onAbrirRegistro, registroAbrivel }: Props) {
  const { data, isLoading, isError } = useFontesClinicas(pacienteId);
  // Leitura à parte: a linha do tempo não espera pela contagem dos achados nem cai se ela falhar.
  const achados = useAchadosParaRevisao(pacienteId);
  const [verTodos, setVerTodos] = useState(false);
  const [semDataAberta, setSemDataAberta] = useState(false);
  const [filtro, setFiltro] = useState<IdDoFiltro>('tudo');
  const hoje = hojeLocalISO();

  const linha = useMemo(() => montarLinhaDoTempo(data?.fontes ?? FONTES_VAZIAS, hoje), [data, hoje]);
  const falhasDasFontes = data?.falhas ?? (isError ? ['os dados do paciente'] : []);
  const falhas = achados.isError ? [...falhasDasFontes, ROTULO_DOS_ACHADOS_DO_HISTORICO] : falhasDasFontes;
  const corteDosAchados = achados.isError ? undefined : achados.data?.corte;
  const cortes = data?.cortes ?? [];

  const opcoes = useMemo(() => opcoesDeFiltro(linha.marcos), [linha.marcos]);
  const mostrarFiltros = deveMostrarFiltros(linha.marcos.length, opcoes, MARCOS_VISIVEIS);
  // Se os dados mudam e o filtro escolhido deixa de existir (ou os chips somem), volta para "Tudo": nunca uma lista vazia
  // sem chip para sair dela.
  const filtroAtivo: IdDoFiltro = mostrarFiltros && opcoes.some((o) => o.id === filtro) ? filtro : 'tudo';
  // Também esquece o filtro guardado: sem isto, quando a categoria voltasse numa nova leitura o filtro antigo reapareceria
  // ativo sem ninguém ter tocado nele.
  useEffect(() => {
    if (filtro !== filtroAtivo) setFiltro(filtroAtivo);
  }, [filtro, filtroAtivo]);
  const doFiltro = useMemo(() => filtrarMarcos(linha.marcos, filtroAtivo), [linha.marcos, filtroAtivo]);

  // Mais recente primeiro: é a ordem do restante do app (prontuário e linha do tempo da aba Evolução).
  const visiveis = verTodos ? doFiltro : doFiltro.slice(0, MARCOS_VISIVEIS);
  const grupos = agruparPorAno(visiveis);
  const semMarcos = linha.marcos.length === 0 && linha.semData.length === 0;

  return (
    <section aria-labelledby="titulo-linha-do-tempo-clinica" className="space-y-3 rounded-2xl border border-border/50 bg-card px-3 py-3 shadow-xs sm:px-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600" aria-hidden="true">
          <History className="icon-sm" />
        </span>
        <div className="min-w-0">
          <h3 id="titulo-linha-do-tempo-clinica" className="text-sm font-medium leading-tight text-foreground">Linha do tempo clínica</h3>
          <p className="text-sm leading-snug text-muted-foreground">
            Marcos do histórico do paciente, do mais recente para o mais antigo. Montada na hora; não vai para o prontuário.
          </p>
        </div>
      </div>

      <AvisoDeFalhas falhas={falhas} />

      <AvisoDosAchadosDoHistorico
        total={achados.isError ? undefined : achados.data?.total}
        contagemIncompleta={corteDosAchados !== undefined}
        onAbrirAvatar={onAbrirAvatar}
      />

      {linha.comoComecou && <ComoComecouCard dados={linha.comoComecou} />}

      {(cortes.length > 0 || corteDosAchados) && (
        <div data-aviso="cortes" className="space-y-1">
          {cortes.map((corte) => (
            <p key={corte.fonte} className="break-words text-sm text-muted-foreground">{corte.texto}</p>
          ))}
          {corteDosAchados && <p className="break-words text-sm text-muted-foreground">{corteDosAchados.texto}</p>}
        </div>
      )}
      <RegistrosDeFora registros={linha.registrosIgnorados} />

      {isLoading && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="icon-xs animate-spin" aria-hidden="true" /> Montando a linha do tempo…
        </p>
      )}

      {!isLoading && semMarcos && !linha.comoComecou && falhas.length === 0 && (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-3 text-sm leading-snug text-muted-foreground">
          Ainda não há marcos para mostrar. Eles aparecem aqui quando o cliente responde o MyID, o histórico clínico e a história
          atual, ou quando você registra uma avaliação presencial, um diagnóstico, um exame, um teste ou um fato da história de vida.
        </p>
      )}
      {!isLoading && semMarcos && linha.comoComecou && (
        <p className="text-sm leading-snug text-muted-foreground">Ainda não há marcos com data para mostrar.</p>
      )}

      {mostrarFiltros && (
        <FiltroDeMarcos opcoes={opcoes} ativo={filtroAtivo} onEscolher={setFiltro} controla="linha-do-tempo-marcos" />
      )}

      <div id="linha-do-tempo-marcos" className="space-y-3">
        {grupos.map((g) => (
          <div key={g.ano} className="space-y-2">
            <h4 className="text-sm font-semibold tabular-nums text-foreground/80">{g.ano}</h4>
            <ol className="ml-1.5 space-y-3 border-l-2 border-border/60 pl-4">
              {g.marcos.map((m) => (
                <ItemDoMarco key={m.id} marco={m} onAbrirRegistro={onAbrirRegistro} registroAbrivel={registroAbrivel} />
              ))}
            </ol>
          </div>
        ))}
      </div>

      {doFiltro.length > MARCOS_VISIVEIS && (
        <button
          type="button"
          aria-expanded={verTodos}
          aria-controls="linha-do-tempo-marcos"
          onClick={() => setVerTodos((v) => !v)}
          className="min-h-11 rounded-md px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {verTodos ? 'Ver menos' : `Ver todos (${doFiltro.length})`}
        </button>
      )}

      {filtroAtivo !== 'tudo' && linha.semData.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {linha.semData.length} {linha.semData.length === 1 ? 'item sem data aparece' : 'itens sem data aparecem'} em Tudo.
        </p>
      )}

      {filtroAtivo === 'tudo' && linha.semData.length > 0 && (
        <div className="border-t border-border/40 pt-1">
          <button
            type="button"
            aria-expanded={semDataAberta}
            aria-controls="linha-do-tempo-sem-data"
            onClick={() => setSemDataAberta((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-sm font-medium text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <p className="break-words text-sm font-medium leading-snug text-foreground">{tituloParaExibir(item)}</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground/75">{detalheParaExibir(item)}</p>
                <SeloDeOrigem origem={item.origem} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
