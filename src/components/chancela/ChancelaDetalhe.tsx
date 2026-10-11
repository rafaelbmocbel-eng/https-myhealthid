import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Pencil, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PlanoTreinoEditor from '@/components/educador/PlanoTreinoEditor';
import PlanoDietaEditor from '@/components/nutricao/PlanoDietaEditor';
import RevisorSeguranca from '@/components/planos/RevisorSeguranca';
import { formatarDataBR } from '@/lib/governanca';
import {
  AVISO_STATUS_FILA, ROTULO_TIPO, descricaoPaciente, avisoNaoPodeChancelar, rotuloChancelado, rotuloDiasUteisNaFila,
  situacaoRevisao, tituloItem, type ItemFilaChancela, type StatusFila,
} from '@/lib/chancela';
import { salvarEdicaoChancela } from '@/lib/chancelaApi';
import InsumosTriagemCard from './InsumosTriagemCard';
import PlanoLeitura from './PlanoLeitura';
import ChancelarDialog from './ChancelarDialog';
import RecusarDialog from './RecusarDialog';

interface Props {
  item: ItemFilaChancela;
  status: StatusFila;
  /** Resultado de usePodeChancelar(item.tipo).pode */
  pode: boolean;
  /** usePodeChancelar(item.tipo).labelExigido */
  labelExigido: string;
  onVoltar: () => void;
  /** Atualiza a fila (depois de editar ou de rodar a revisão). */
  onAtualizar: () => void;
  /** Chancelou ou recusou: o item sai da fila. */
  onConcluido: () => void;
}

function BadgeRisco({ risco }: { risco: 'baixo' | 'medio' | 'alto' | null }) {
  if (!risco) return null;
  const variante = risco === 'alto' ? 'danger' : risco === 'medio' ? 'warning' : 'success';
  return <Badge variant={variante} size="md">risco {risco}</Badge>;
}

export default function ChancelaDetalhe({ item, status, pode, labelExigido, onVoltar, onAtualizar, onConcluido }: Props) {
  const [editando, setEditando] = useState(false);
  const [chancelando, setChancelando] = useState(false);
  const [recusando, setRecusando] = useState(false);

  const aguardando = status === 'aguardando';
  const revisao = situacaoRevisao(item);
  const geradoEm = formatarDataBR(item.geradoEm);
  const titulo = tituloItem(item);
  const diasNaFila = aguardando ? rotuloDiasUteisNaFila(item.diasUteisNaFila) : null;
  const avisoDoStatus = AVISO_STATUS_FILA[status] ?? null;

  const salvarEdicao = async (conteudo: Record<string, unknown>, novoTitulo: string) => {
    await salvarEdicaoChancela(item.id, novoTitulo, conteudo);
    toast.success('Edição salva. Rode a revisão de segurança de novo antes de chancelar.');
    onAtualizar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden -ml-2 gap-1" onClick={onVoltar} aria-label="Voltar para a fila">
          <ArrowLeft className="h-4 w-4" /> Fila
        </Button>
      </div>

      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="info" size="md">{ROTULO_TIPO[item.tipo]}</Badge>
          {status === 'chancelado' && <Badge variant="success" size="md">Chancelado</Badge>}
          {status === 'recusado' && <Badge variant="danger" size="md">Recusado</Badge>}
          {status === 'cancelado' && <Badge variant="neutral" size="md">Cancelado pelo cliente</Badge>}
          {status === 'substituido' && <Badge variant="neutral" size="md">Substituído</Badge>}
          {aguardando && <Badge variant="warning" size="md">Aguardando chancela</Badge>}
          {aguardando && item.atrasado && <Badge variant="danger" size="md">ATRASADO</Badge>}
          {diasNaFila && <Badge variant={item.atrasado ? 'danger' : 'neutral'} size="md">{diasNaFila}</Badge>}
        </div>
        <h2 className="text-lg font-bold leading-tight">{titulo}</h2>
        <p className="text-sm text-muted-foreground">
          {descricaoPaciente(item)}
          {item.objetivo ? ` · Objetivo: ${item.objetivo}` : ''}
          {geradoEm ? ` · gerado em ${geradoEm}` : ''}
        </p>
      </header>

      {avisoDoStatus && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          <p>{avisoDoStatus}</p>
        </div>
      )}

      {status === 'chancelado' && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-semibold">{rotuloChancelado(item)}</p>
            {item.notaPublica && <p className="text-muted-foreground">Recado ao cliente: {item.notaPublica}</p>}
          </div>
        </div>
      )}

      {status === 'recusado' && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
          <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-semibold">
              Recusado{item.revisorNome ? ` por ${item.revisorNome}` : ''}{item.revisadoEm ? ` em ${formatarDataBR(item.revisadoEm)}` : ''}
            </p>
            {item.notaPublica && <p>Mensagem ao cliente: {item.notaPublica}</p>}
            {item.notaInterna && <p className="text-muted-foreground">Nota interna: {item.notaInterna}</p>}
          </div>
        </div>
      )}

      {aguardando && !pode && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
          <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
          <p>{avisoNaoPodeChancelar(item, labelExigido)}</p>
        </div>
      )}

      <InsumosTriagemCard conteudo={item.conteudo} />

      {aguardando && (
        <section aria-label="Revisão de segurança" className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Revisão de segurança</span>
            {revisao.estado === 'valida' && (
              <>
                <Badge variant={revisao.parcial ? 'warning' : 'success'} size="md">{revisao.parcial ? 'desta versão, parcial' : 'desta versão'}</Badge>
                <BadgeRisco risco={revisao.risco} />
                {revisao.nFlagsAltas > 0 && <Badge variant="danger" size="md">{revisao.nFlagsAltas} alerta(s) alto(s)</Badge>}
              </>
            )}
            {revisao.estado === 'desatualizada' && (
              <>
                <Badge variant="warning" size="md">de versão anterior</Badge>
                <BadgeRisco risco={revisao.risco} />
              </>
            )}
            {revisao.estado === 'ausente' && <Badge variant="neutral" size="md">ainda não revisado</Badge>}
          </div>
          {revisao.estado === 'valida' && revisao.parcial && (
            <p className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              O plano é longo e a IA avaliou só o início. Confira o restante; para chancelar, registre a justificativa.
            </p>
          )}
          {revisao.estado === 'desatualizada' && (
            <p className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              O plano mudou depois da última revisão. Revise de novo antes de chancelar.
            </p>
          )}
          <RevisorSeguranca
            key={`${item.id}-${item.hashAtual ?? 'sem-hash'}`}
            tabela="plano_cliente_chancela"
            planoId={item.id}
            tipo={item.tipo}
            onResultado={onAtualizar}
          />
        </section>
      )}

      <PlanoLeitura tipo={item.tipo} conteudo={item.conteudo} />

      {aguardando && (
        <div className="sticky bottom-0 -mx-1 flex flex-wrap gap-2 border-t border-border/60 bg-background/95 px-1 py-3 backdrop-blur">
          <Button variant="outline" className="gap-1.5" disabled={!pode} onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" /> Editar plano
          </Button>
          <Button variant="outline" className="gap-1.5 text-red-700 hover:text-red-700" onClick={() => setRecusando(true)}>
            <XCircle className="h-4 w-4" /> Recusar
          </Button>
          <Button className="gap-1.5 sm:ml-auto" disabled={!pode} onClick={() => setChancelando(true)}>
            <ShieldCheck className="h-4 w-4" /> Chancelar
          </Button>
        </div>
      )}

      {editando && item.tipo === 'treino' && (
        <PlanoTreinoEditor
          plano={{ id: item.id, titulo, estrutura: item.conteudo }}
          onClose={() => setEditando(false)}
          onSalvar={salvarEdicao}
          tituloDialogo="Editar treino antes de chancelar"
          rotuloSalvar="Salvar edição"
        />
      )}
      {editando && item.tipo === 'nutricao' && (
        <PlanoDietaEditor
          plano={{ id: item.id, titulo, plano: item.conteudo }}
          onClose={() => setEditando(false)}
          onSalvar={salvarEdicao}
          tituloDialogo="Editar plano alimentar antes de chancelar"
          rotuloSalvar="Salvar edição"
        />
      )}

      <ChancelarDialog
        open={chancelando}
        onOpenChange={setChancelando}
        item={item}
        pode={pode}
        onRevisado={onAtualizar}
        onChancelado={onConcluido}
      />
      <RecusarDialog open={recusando} onOpenChange={setRecusando} item={item} onRecusado={onConcluido} />
    </div>
  );
}
