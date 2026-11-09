import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PROTOCOLO_SESSAO, type ResultadoEtapa, type TipoEtapa } from '@/lib/emg/sessao';
import { cn } from '@/lib/utils';
import { MAX_TENTATIVAS_CVM, type ControladorEmg, type EstadoEtapa } from './controlador';
import { uvPt, numeroPt } from './desenho';

const INTERVALO_MS = 200;

function segundosRestantes(e: EstadoEtapa): number | null {
  if (e.fase === 'parada' || e.alvoS === null) return null;
  return Math.max(0, Math.ceil(e.alvoS - e.decorridoS - 1e-9));
}

function percentual(e: EstadoEtapa): number {
  if (e.fase === 'parada' || e.alvoS === null || e.alvoS <= 0) return 0;
  return Math.min(100, Math.round(((e.decorridoS / e.alvoS) * 100) / 5) * 5);
}

// O relógio da tela só renderiza quando algo que aparece mudou (segundo inteiro, degrau da barra).
function mesmaExibicao(a: EstadoEtapa, b: EstadoEtapa): boolean {
  return (
    a.fase === b.fase &&
    a.tipo === b.tipo &&
    a.numero === b.numero &&
    segundosRestantes(a) === segundosRestantes(b) &&
    percentual(a) === percentual(b) &&
    (a.alvoS === null ? Math.floor(a.decorridoS) === Math.floor(b.decorridoS) : true) &&
    (a.descansoRestanteS === null) === (b.descansoRestanteS === null) &&
    Math.ceil(a.descansoRestanteS ?? 0) === Math.ceil(b.descansoRestanteS ?? 0)
  );
}

function minutosSegundos(totalS: number): string {
  const s = Math.floor(totalS);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const TEXTO_DA_FASE: Record<'preparo' | 'gravando', Record<TipoEtapa, string>> = {
  preparo: {
    repouso: 'Prepare-se: relaxe o músculo. A gravação começa em',
    cvm: 'Prepare-se: você vai contrair o mais forte que conseguir. Começa em',
    tarefa: 'Prepare-se para a tarefa. Começa em',
  },
  gravando: {
    repouso: 'Gravando o repouso: fique relaxado e imóvel.',
    cvm: 'Contraia o máximo que conseguir e mantenha!',
    tarefa: 'Gravando a tarefa. Toque em Parar ao terminar.',
  },
};

interface BlocoProps {
  indice: number;
  titulo: string;
  descricao: string;
  feito: boolean;
  children: ReactNode;
}

function Bloco({ indice, titulo, descricao, feito, children }: BlocoProps) {
  return (
    <section className="space-y-2.5 py-3 last:pb-0" aria-label={titulo}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            feito ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-muted text-muted-foreground',
          )}
        >
          {feito ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : indice}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="space-y-2 pl-0 sm:pl-8">{children}</div>
    </section>
  );
}

interface Props {
  controlador: ControladorEmg;
  etapas: readonly ResultadoEtapa[];
  /** O módulo está lendo o sinal e o sinal está chegando: só assim dá para gravar. */
  pronto: boolean;
  aviso: string | null;
  onIniciar: (tipo: TipoEtapa) => void;
  onRefazer: (tipo: TipoEtapa) => void;
  onParar: () => void;
  onCancelar: () => void;
}

export default function ProtocoloGuiado({ controlador, etapas, pronto, aviso, onIniciar, onRefazer, onParar, onCancelar }: Props) {
  const [estado, setEstado] = useState<EstadoEtapa>(() => controlador.estado());

  useEffect(() => {
    const ler = (): void => {
      const novo = controlador.estado();
      setEstado((anterior) => (mesmaExibicao(anterior, novo) ? anterior : novo));
    };
    ler();
    const id = setInterval(ler, INTERVALO_MS);
    const parar = controlador.ouvir((ev) => {
      if (ev.tipo === 'fase' || ev.tipo === 'etapas-mudaram') ler();
    });
    return () => {
      clearInterval(id);
      parar();
    };
  }, [controlador]);

  const repousos = etapas.filter((e) => e.tipo === 'repouso');
  const cvms = etapas.filter((e) => e.tipo === 'cvm');
  const tarefas = etapas.filter((e) => e.tipo === 'tarefa');
  const repousoFeito = repousos.length > 0;
  const cvmFeita = cvms.length >= PROTOCOLO_SESSAO.cvmTentativas;
  const tarefaFeita = tarefas.length > 0;
  const proximo: TipoEtapa | null = !repousoFeito ? 'repouso' : !cvmFeita ? 'cvm' : !tarefaFeita ? 'tarefa' : null;

  const emAndamento = estado.fase !== 'parada';
  const ativa = (tipo: TipoEtapa): boolean => emAndamento && estado.tipo === tipo;
  const variante = (tipo: TipoEtapa): 'default' | 'outline' => (proximo === tipo ? 'default' : 'outline');
  const podeIniciar = pronto && !emAndamento;
  const restante = segundosRestantes(estado);

  const anuncio = estado.fase !== 'parada' && estado.tipo ? TEXTO_DA_FASE[estado.fase][estado.tipo] : '';

  const painelAtivo = (tipo: TipoEtapa): ReactNode => {
    if (!ativa(tipo) || estado.fase === 'parada' || estado.tipo === null) return null;
    const preparo = estado.fase === 'preparo';
    const tarefaLivre = tipo === 'tarefa' && !preparo;
    return (
      <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="etapa-ativa">
        <p className="text-sm font-medium leading-snug">
          {TEXTO_DA_FASE[estado.fase][estado.tipo]}
          {estado.tipo === 'cvm' && estado.numero > 0 && ` (tentativa ${estado.numero})`}
        </p>
        <p className="font-mono text-4xl font-bold tabular-nums leading-none" data-testid="contagem">
          {tarefaLivre ? minutosSegundos(estado.decorridoS) : (restante ?? 0)}
          {!tarefaLivre && <span className="ml-1 text-base font-medium text-muted-foreground">s</span>}
        </p>
        {!tarefaLivre && <Progress value={percentual(estado)} className="h-2" aria-label="Andamento da etapa" />}
        <div className="flex gap-2 pt-1">
          {tarefaLivre ? (
            <Button type="button" className="h-11 flex-1 gap-1.5" onClick={onParar}>
              <Square className="icon-sm" /> Parar tarefa
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancelar}>
              Cancelar etapa
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="divide-y divide-border/60 p-3 sm:p-4" aria-label="Protocolo guiado">
      <p className="sr-only" role="status" data-testid="anuncio-etapa">
        {anuncio}
      </p>

      <div className="space-y-1 pb-3">
        <h2 className="text-base font-semibold">Protocolo guiado</h2>
        <p className="text-xs text-muted-foreground">
          Repouso, contração máxima (CVM) e tarefa livre. A CVM é a referência para comparar o paciente com ele mesmo, em % da CVM.
        </p>
        {!pronto && !emAndamento && (
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300" data-testid="protocolo-sem-sinal">
            Conecte o módulo (ou use o modo demonstração) para gravar as etapas.
          </p>
        )}
        {aviso && (
          <p role="alert" className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" data-testid="aviso-etapa">
            {aviso}
          </p>
        )}
      </div>

      <Bloco indice={1} titulo="Repouso" descricao={`${PROTOCOLO_SESSAO.repousoS} s com o músculo relaxado e imóvel.`} feito={repousoFeito}>
        {painelAtivo('repouso')}
        {!ativa('repouso') && repousoFeito && (
          <p className="text-sm" data-testid="repouso-feito">
            Gravado: {numeroPt(repousos[repousos.length - 1].duracaoS, 1)} s · RMS {uvPt(repousos[repousos.length - 1].rmsUv)} µV
          </p>
        )}
        {!ativa('repouso') && (
          <Button
            type="button"
            variant={repousoFeito ? 'outline' : variante('repouso')}
            className="h-11 w-full gap-1.5 sm:w-auto"
            disabled={!podeIniciar}
            onClick={() => (repousoFeito ? onRefazer('repouso') : onIniciar('repouso'))}
          >
            {repousoFeito && <RotateCcw className="icon-sm" />}
            {repousoFeito ? 'Refazer repouso' : 'Iniciar repouso'}
          </Button>
        )}
      </Bloco>

      <Bloco
        indice={2}
        titulo="Contração máxima (CVM)"
        descricao={`${PROTOCOLO_SESSAO.cvmTentativas} tentativas de ${PROTOCOLO_SESSAO.cvmDuracaoS} s. Contraia o mais forte que conseguir, sem mexer o eletrodo, e interrompa se houver dor.`}
        feito={cvmFeita}
      >
        {painelAtivo('cvm')}
        {cvms.length > 0 && (
          <ul className="space-y-0.5 text-sm" data-testid="lista-cvm">
            {cvms.map((e) => (
              <li key={e.numero} className="flex justify-between gap-2">
                <span>Tentativa {e.numero}</span>
                <span className="font-mono tabular-nums">{e.picoRms1sUv > 0 ? `${uvPt(e.picoRms1sUv)} µV` : 'curta demais'}</span>
              </li>
            ))}
          </ul>
        )}
        {!emAndamento && estado.descansoRestanteS !== null && (
          <p className="text-xs text-muted-foreground" data-testid="descanso-cvm">
            Descanso sugerido: {Math.ceil(estado.descansoRestanteS)} s antes da próxima tentativa.
          </p>
        )}
        {!emAndamento && estado.descansoRestanteS === null && cvms.length > 0 && !cvmFeita && (
          <p className="text-xs text-muted-foreground">Pronto para a próxima tentativa.</p>
        )}
        {!ativa('cvm') && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {cvms.length < MAX_TENTATIVAS_CVM && (
              <Button
                type="button"
                variant={variante('cvm')}
                className="h-11 gap-1.5"
                disabled={!podeIniciar}
                onClick={() => onIniciar('cvm')}
              >
                {cvmFeita ? 'Mais uma tentativa' : `Iniciar tentativa ${cvms.length + 1}`}
              </Button>
            )}
            {cvms.length > 0 && (
              <Button type="button" variant="outline" className="h-11 gap-1.5" disabled={!podeIniciar} onClick={() => onRefazer('cvm')}>
                <RotateCcw className="icon-sm" /> Refazer a última
              </Button>
            )}
          </div>
        )}
        {cvmFeita && <p className="text-xs text-muted-foreground">A CVM é a maior das tentativas.</p>}
      </Bloco>

      <Bloco indice={3} titulo="Tarefa livre" descricao="Faça o movimento ou a contração que quer avaliar e toque em Parar." feito={tarefaFeita}>
        {painelAtivo('tarefa')}
        {!ativa('tarefa') && tarefaFeita && (
          <p className="text-sm" data-testid="tarefa-feita">
            Gravada: {numeroPt(tarefas.reduce((soma, e) => soma + e.duracaoS, 0), 1)} s
          </p>
        )}
        {!ativa('tarefa') && (
          <Button
            type="button"
            variant={tarefaFeita ? 'outline' : variante('tarefa')}
            className="h-11 w-full gap-1.5 sm:w-auto"
            disabled={!podeIniciar}
            onClick={() => (tarefaFeita ? onRefazer('tarefa') : onIniciar('tarefa'))}
          >
            {tarefaFeita && <RotateCcw className="icon-sm" />}
            {tarefaFeita ? 'Refazer tarefa' : 'Iniciar tarefa'}
          </Button>
        )}
      </Bloco>

    </Card>
  );
}
