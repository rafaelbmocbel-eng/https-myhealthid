import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, Clock, Dumbbell, Loader2, Lock, RefreshCw, Salad, Settings2, ShieldCheck } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdministracaoChancela from '@/components/chancela/AdministracaoChancela';
import ChancelaDetalhe from '@/components/chancela/ChancelaDetalhe';
import { useEquipeCientifica } from '@/hooks/useEquipeCientifica';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { usePlanoClienteConfig } from '@/hooks/usePlanoClienteConfig';
import { CHAVE_PENDENTES_CHANCELA, useChancelaPendentes } from '@/hooks/useChancelaPendentes';
import { usePodeChancelarPlanoCliente } from '@/hooks/usePodeChancelar';
import { formatarDataBR } from '@/lib/governanca';
import {
  ABAS_FILA, CHAVE_FILA_CHANCELA, ROTULO_TIPO, descricaoPaciente, motivoCurtoNaoPode, ordenarFila, podeChancelarItem,
  rotuloChancelado, rotuloDiasUteis, rotuloDiasUteisNaFila, situacaoRevisao, tituloItem,
  type ItemFilaChancela, type StatusFila,
} from '@/lib/chancela';
import { buscarFilaChancela } from '@/lib/chancelaApi';
import { cn } from '@/lib/utils';

interface ItemDaFilaProps {
  item: ItemFilaChancela;
  status: StatusFila;
  ativo: boolean;
  pode: boolean;
  onAbrir: () => void;
}

function ItemDaFila({ item, status, ativo, pode, onAbrir }: ItemDaFilaProps) {
  const revisao = situacaoRevisao(item);
  const Icone = item.tipo === 'treino' ? Dumbbell : Salad;
  const geradoEm = formatarDataBR(item.geradoEm);
  const aguardando = status === 'aguardando';
  const diasNaFila = aguardando ? rotuloDiasUteisNaFila(item.diasUteisNaFila) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        aria-current={ativo ? 'true' : undefined}
        className={cn(
          'w-full text-left rounded-xl border bg-card p-3 space-y-1.5 transition hover:border-primary/50 hover:shadow-sm',
          ativo ? 'border-primary ring-1 ring-primary/30' : 'border-border/60',
          aguardando && item.atrasado && !ativo && 'border-red-300 dark:border-red-900',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icone className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{tituloItem(item)}</p>
            <p className="text-xs text-muted-foreground truncate">{descricaoPaciente(item)}</p>
          </div>
          <Badge variant="info" size="sm">{ROTULO_TIPO[item.tipo]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {aguardando && item.atrasado && <Badge variant="danger" size="sm">ATRASADO</Badge>}
          {geradoEm && <span>gerado em {geradoEm}</span>}
          {diasNaFila && (
            <span className={cn('inline-flex items-center gap-1', item.atrasado && 'font-semibold text-red-700 dark:text-red-300')}>
              <Clock className="h-3 w-3" aria-hidden /> {diasNaFila}
            </span>
          )}
          {status === 'aguardando' && revisao.estado === 'valida' && (
            <Badge variant={revisao.risco === 'alto' ? 'danger' : revisao.risco === 'medio' ? 'warning' : 'success'} size="sm">
              revisado · risco {revisao.risco}
            </Badge>
          )}
          {status === 'aguardando' && revisao.estado === 'desatualizada' && <Badge variant="warning" size="sm">revisão desatualizada</Badge>}
          {status === 'aguardando' && revisao.estado === 'ausente' && <Badge variant="neutral" size="sm">sem revisão</Badge>}
          {status === 'chancelado' && <span className="truncate">{rotuloChancelado(item)}</span>}
        </div>
        {aguardando && !pode && (
          <p className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
            <Lock className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
            <span>Não pode chancelar: {motivoCurtoNaoPode(item)}</span>
          </p>
        )}
      </button>
    </li>
  );
}

type AbaId = StatusFila | 'administracao';

const TITULO_VAZIO: Record<StatusFila, string> = {
  aguardando: 'Nada aguardando chancela',
  chancelado: 'Nenhum plano chancelado ainda',
  recusado: 'Nenhum plano recusado',
  cancelado: 'Nenhum pedido cancelado',
  substituido: 'Nenhum plano substituído',
};

export default function ChancelaEquipe() {
  const { ehEquipe, loading } = useEquipeCientifica();
  const ehSuperAdmin = useIsSuperAdmin();
  const { config } = usePlanoClienteConfig();
  const treino = usePodeChancelarPlanoCliente('treino');
  const nutricao = usePodeChancelarPlanoCliente('nutricao');
  const pendentes = useChancelaPendentes();
  const qc = useQueryClient();
  const [aba, setAba] = useState<AbaId>('aguardando');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const emAdministracao = aba === 'administracao' && ehSuperAdmin;
  const abaFila: StatusFila = aba === 'administracao' ? 'aguardando' : aba;

  const fila = useQuery({
    queryKey: [CHAVE_FILA_CHANCELA, abaFila],
    enabled: ehEquipe && !emAdministracao,
    staleTime: 15_000,
    queryFn: () => buscarFilaChancela(abaFila),
  });

  const itens = useMemo(() => ordenarFila(fila.data ?? [], abaFila), [fila.data, abaFila]);
  const selecionado = itens.find((i) => i.id === selecionadoId) ?? null;
  const atrasados = abaFila === 'aguardando' ? itens.filter((i) => i.atrasado).length : 0;

  useEffect(() => {
    if (selecionadoId && fila.data && !fila.data.some((i) => i.id === selecionadoId)) setSelecionadoId(null);
  }, [fila.data, selecionadoId]);

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: [CHAVE_FILA_CHANCELA] });
    void qc.invalidateQueries({ queryKey: CHAVE_PENDENTES_CHANCELA });
  };

  const trocarAba = (nova: AbaId) => {
    setAba(nova);
    setSelecionadoId(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24" role="status" aria-label="Carregando">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!ehEquipe) {
    return (
      <AppLayout>
        <div className="container max-w-3xl py-6">
          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title="Acesso restrito à equipe científica"
            description="A fila de chancela é só para quem a equipe científica MyHealthID designou. Se você deveria ter acesso, fale com o administrador."
          />
        </div>
      </AppLayout>
    );
  }

  const podePorTipo = { treino, nutricao };
  const subtitulo = pendentes > 0
    ? `${pendentes} plano${pendentes > 1 ? 's' : ''} aguardando a sua chancela.`
    : 'Nenhum plano aguardando chancela agora.';
  const prazo = `Prazo da equipe: ${rotuloDiasUteis(config.prazo_chancela_dias_uteis)} para chancelar.`;

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-5">
        <PageHeader
          title="Fila de chancela MyHealthID"
          subtitle={`Planos de treino e nutrição gerados por clientes Premium. Eles só chegam ao cliente depois da chancela da equipe científica. ${prazo} ${subtitulo}`}
          icon={<ShieldCheck className="icon-md" />}
          actions={emAdministracao ? undefined : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={atualizar} disabled={fila.isFetching}>
              <RefreshCw className={cn('h-4 w-4', fila.isFetching && 'animate-spin')} /> Atualizar
            </Button>
          )}
        />

        <div role="tablist" aria-label="Seções da chancela" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {ABAS_FILA.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => trocarAba(a.id)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition',
                aba === a.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {a.rotulo}
              {a.id === 'aguardando' && pendentes > 0 && (
                <span className="ml-1.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {pendentes > 9 ? '9+' : pendentes}
                </span>
              )}
            </button>
          ))}
          {ehSuperAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'administracao'}
              onClick={() => trocarAba('administracao')}
              className={cn(
                'ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
                aba === 'administracao' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Settings2 className="h-4 w-4" aria-hidden /> Administração
            </button>
          )}
        </div>

        {emAdministracao && <AdministracaoChancela />}

        {!emAdministracao && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
            <div className={cn('space-y-2', selecionado && 'hidden lg:block')}>
              {atrasados > 0 && (
                <div role="status" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
                  <Clock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
                  <p>
                    <span className="font-semibold">{atrasados} plano{atrasados > 1 ? 's' : ''} passou do prazo de {rotuloDiasUteis(config.prazo_chancela_dias_uteis)}.</span>
                    {' '}Eles aparecem primeiro; o cliente já pode pedir um novo plano.
                  </p>
                </div>
              )}
              {fila.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando a fila…
                </div>
              )}
              {fila.isError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-semibold">Não consegui carregar a fila.</p>
                    <p className="text-muted-foreground">{fila.error instanceof Error ? fila.error.message : 'Tente de novo em instantes.'}</p>
                  </div>
                </div>
              )}
              {!fila.isLoading && !fila.isError && itens.length === 0 && (
                <EmptyState
                  icon={<ClipboardCheck className="h-5 w-5" />}
                  title={TITULO_VAZIO[abaFila]}
                  description={abaFila === 'aguardando' ? 'Quando um cliente Premium gerar um plano, ele aparece aqui.' : undefined}
                  className="py-8"
                />
              )}
              {itens.length > 0 && (
                <ul className="space-y-2" aria-label="Planos">
                  {itens.map((i) => (
                    <ItemDaFila
                      key={i.id}
                      item={i}
                      status={abaFila}
                      ativo={i.id === selecionadoId}
                      pode={podeChancelarItem(i, podePorTipo[i.tipo].pode)}
                      onAbrir={() => setSelecionadoId(i.id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className={cn('min-w-0', !selecionado && 'hidden lg:block')}>
              {selecionado ? (
                <ChancelaDetalhe
                  key={selecionado.id}
                  item={selecionado}
                  status={abaFila}
                  pode={podeChancelarItem(selecionado, podePorTipo[selecionado.tipo].pode)}
                  labelExigido={podePorTipo[selecionado.tipo].labelExigido}
                  onVoltar={() => setSelecionadoId(null)}
                  onAtualizar={atualizar}
                  onConcluido={() => {
                    setSelecionadoId(null);
                    atualizar();
                  }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                  Selecione um plano da fila para ler, editar e chancelar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
