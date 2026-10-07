import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dumbbell, Sparkles, Loader2, Trash2, Pencil, ShieldAlert } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import NumberField from '@/components/ui/number-field';
import { toast } from 'sonner';
import { usePodeChancelar } from '@/hooks/usePodeChancelar';
import PlanoTreinoEditor from './PlanoTreinoEditor';
import AcompanhamentoPlanoCard from './AcompanhamentoPlanoCard';
import RevisorSeguranca from '@/components/planos/RevisorSeguranca';
import LiberarPlanoDialog from '@/components/planos/LiberarPlanoDialog';
import TriagemBloqueioDialog from '@/components/planos/TriagemBloqueioDialog';
import SeloGovernanca from '@/components/planos/SeloGovernanca';
import ResumoAcompanhamento from '@/components/planos/ResumoAcompanhamento';
import TreinoDocumento from '@/components/paciente/TreinoDocumento';
import { gerarPlanoComTriagem, idadeEmAnos, resumoMotivosBloqueio } from '@/lib/geracaoPlano';
import { avisoAposEdicao, type BloqueioTriagem, type OverrideTriagem } from '@/lib/governanca';

interface Props {
  pacienteId: string;
  autoGerar?: boolean;
  ocultarGerador?: boolean;
  /**
   * Estado da geração automática ("Montar todos"): 'pausado' = a triagem de segurança
   * parou e espera decisão; 'liberado' = o plano foi gerado; 'dispensado' = o
   * profissional deixou para depois (o pai pode oferecer tentar de novo).
   */
  onBloqueioAuto?: (estado: 'pausado' | 'liberado' | 'dispensado') => void;
}

interface PedidoTreino {
  corpo: Record<string, unknown>;
  meta: { objetivo: string; nivel: string; freq: number; duracao: number; restricoes: string };
}

interface PendenteTriagem {
  bloqueio: BloqueioTriagem;
  pedido: PedidoTreino;
  auto: boolean;
}

export default function PlanoTreinoCard({ pacienteId, autoGerar, ocultarGerador, onBloqueioAuto }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const chancela = usePodeChancelar('treino');

  const [objetivo, setObjetivo] = useState('hipertrofia');
  const [nivel, setNivel] = useState('iniciante');
  const [freq, setFreq] = useState(3);
  const [duracao, setDuracao] = useState(12);
  const [restricoes, setRestricoes] = useState('');
  const [editarPlano, setEditarPlano] = useState<any | null>(null);
  // Edição INLINE do treino (TreinoDocumento) direto no card, sem abrir dialog —
  // guarda o id do plano em edição e o conteúdo/título em rascunho.
  const [editandoInlineId, setEditandoInlineId] = useState<string | null>(null);
  const [docConteudo, setDocConteudo] = useState<any>(null);
  const [docTitulo, setDocTitulo] = useState<string>('');
  const [salvandoDoc, setSalvandoDoc] = useState(false);
  // O formulário de gerar só aparece quando NÃO há plano (primeira vez). Depois
  // some — fica só o plano compartilhável — com um "gerar outro" discreto.
  const [mostrarGerador, setMostrarGerador] = useState(false);
  // Mostra só UM plano (o liberado, ou o mais recente); os rascunhos antigos
  // ficam recolhidos para não parecer duplicado.
  const [verOutros, setVerOutros] = useState(false);
  // Geração parada pela triagem: guarda o pedido para reenviar o MESMO pedido com
  // o override do profissional. Na geração automática o diálogo não abre sozinho.
  const [pendente, setPendente] = useState<PendenteTriagem | null>(null);
  const [dialogoTriagemAberto, setDialogoTriagemAberto] = useState(false);
  const [liberarId, setLiberarId] = useState<string | null>(null);
  const autoDisparado = useRef(false);

  const { data: planos = [] } = useQuery({
    queryKey: ['planos-treino', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('planos_treino').select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const montarPedido = async (): Promise<PedidoTreino> => {
    const [pac, antro, testes] = await Promise.all([
      supabase.from('pacientes').select('nome, sobrenome, data_nascimento, sexo').eq('id', pacienteId).maybeSingle(),
      (supabase as any).from('antropometria').select('peso_kg, altura_cm, imc, gordura_pct').eq('paciente_id', pacienteId).order('data_medicao', { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from('testes_funcionais_paciente').select('tipo_teste, resultado, unidade, classificacao').eq('paciente_id', pacienteId).order('data_teste', { ascending: false }).limit(8),
    ]);
    const p = pac.data as any;
    return {
      corpo: {
        objetivo, nivel,
        frequencia_semanal: freq,
        duracao_semanas: duracao,
        restricoes: restricoes || null,
        antropometria: antro.data || null,
        testes: testes.data || [],
        idade: idadeEmAnos(p?.data_nascimento), sexo: p?.sexo,
        paciente_id: pacienteId,
      },
      meta: { objetivo, nivel, freq, duracao, restricoes },
    };
  };

  const gerarMut = useMutation({
    mutationFn: async (v: { pedido?: PedidoTreino; override?: OverrideTriagem; auto?: boolean }) => {
      const pedido = v.pedido ?? await montarPedido();
      const r = await gerarPlanoComTriagem('gerar-plano-treino', pedido.corpo, v.override);
      if (r.tipo === 'bloqueio') return { tipo: 'bloqueio' as const, bloqueio: r.bloqueio, pedido, auto: !!v.auto };

      const { meta } = pedido;
      const { error: insErr } = await (supabase as any).from('planos_treino').insert({
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        titulo: r.plano.titulo || `Plano ${meta.objetivo} ${meta.nivel}`,
        objetivo: meta.objetivo, nivel: meta.nivel,
        frequencia_semanal: meta.freq,
        duracao_semanas: meta.duracao,
        restricoes: meta.restricoes || null,
        estrutura: r.plano,
        aprovado: false,
      });
      if (insErr) throw insErr;
      return { tipo: 'plano' as const };
    },
    onSuccess: (res) => {
      if (res.tipo === 'bloqueio') {
        setPendente({ bloqueio: res.bloqueio, pedido: res.pedido, auto: res.auto });
        setDialogoTriagemAberto(!res.auto);
        if (res.auto) onBloqueioAuto?.('pausado');
        return;
      }
      toast.success('Plano gerado e salvo como rascunho');
      setPendente(null);
      setDialogoTriagemAberto(false);
      onBloqueioAuto?.('liberado');
      qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
      setRestricoes('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar plano'),
  });

  const cancelarTriagem = () => {
    setDialogoTriagemAberto(false);
    if (pendente && !pendente.auto) setPendente(null);
  };

  const dispensarPausa = () => {
    setPendente(null);
    autoDisparado.current = false;
    onBloqueioAuto?.('dispensado');
  };

  // "Montar todos os planos": dispara a geração UMA vez quando ainda não há plano.
  useEffect(() => {
    if (autoGerar && !autoDisparado.current && planos.length === 0 && !gerarMut.isPending) {
      autoDisparado.current = true;
      gerarMut.mutate({ auto: true });
    }
  }, [autoGerar, planos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidarPlanos = () => {
    qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
    qc.invalidateQueries({ queryKey: ['portal-controle-full', pacienteId] });
  };

  const [apagarId, setApagarId] = useState<string | null>(null);
  const apagar = async (id: string) => {
    await (supabase as any).from('planos_treino').delete().eq('id', id);
    invalidarPlanos();
  };

  const salvarDoc = async (plano: any) => {
    if (!plano) return;
    setSalvandoDoc(true);
    try {
      const { data, error } = await (supabase as any).from('planos_treino')
        .update({ estrutura: docConteudo, titulo: docTitulo || plano.titulo })
        .eq('id', plano.id)
        .select('aprovado');
      if (error) throw error;
      if (Array.isArray(data) && data.length === 0) throw new Error('Não consegui salvar: o plano não foi encontrado ou você não tem permissão.');
      const aviso = avisoAposEdicao('Treino', !!plano.aprovado, Array.isArray(data) ? data[0]?.aprovado : null);
      if (aviso.nivel === 'aviso') toast.warning(aviso.mensagem);
      else toast.success(aviso.mensagem);
      setEditandoInlineId(null);
      invalidarPlanos();
    } catch (e: any) {
      toast.error(e.message || 'Não consegui salvar');
    } finally {
      setSalvandoDoc(false);
    }
  };

  // Liberar passa pela revisão de segurança e pelo RPC liberar_plano (LiberarPlanoDialog):
  // é o banco que carimba quem liberou. Chancela = só o profissional habilitado libera.
  const abrirLiberar = (plano: any) => {
    if (!chancela.pode) { toast.error(chancela.motivo); return; }
    setLiberarId(plano.id);
  };

  // Ocultar (aprovado=false) é sempre permitido.
  const ocultar = async (plano: any) => {
    const { error } = await (supabase as any).from('planos_treino').update({ aprovado: false }).eq('id', plano.id);
    if (error) return toast.error(error.message);
    toast.success('Ocultado do paciente');
    invalidarPlanos();
  };

  // Um plano em destaque (liberado ou o mais recente); o resto fica recolhido.
  const principal = planos.find((p: any) => p.aprovado) || planos[0] || null;
  const outros = planos.filter((p: any) => p !== principal);
  const planosVisiveis = principal ? [principal, ...(verOutros ? outros : [])] : [];
  const planoParaLiberar = planos.find((p: any) => p.id === liberarId) || null;

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Dumbbell className="icon-sm text-primary" /> Plano de Treino
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(planos.length === 0 || mostrarGerador) && !ocultarGerador && (
        <>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Objetivo</label>
            <Select value={objetivo} onValueChange={setObjetivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hipertrofia">Hipertrofia</SelectItem>
                <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="saude">Saúde geral</SelectItem>
                <SelectItem value="reabilitacao">Reabilitação</SelectItem>
                <SelectItem value="forca">Força</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Nível</label>
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Freq./semana</label>
            <NumberField min={1} max={7} value={freq} onValueChange={setFreq} emptyValue={3} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Duração (sem)</label>
            <NumberField min={2} max={52} value={duracao} onValueChange={setDuracao} emptyValue={12} />
          </div>
        </div>
        <Textarea placeholder="Restrições/lesões (opcional)" rows={2} value={restricoes} onChange={(e) => setRestricoes(e.target.value)} />

        <Button size="sm" onClick={() => gerarMut.mutate({})} disabled={gerarMut.isPending} className="w-full">
          {gerarMut.isPending ? <Loader2 className="icon-xs animate-spin mr-2" /> : <Sparkles className="icon-xs mr-2" />}
          {gerarMut.isPending ? 'Gerando plano periodizado...' : 'Gerar plano com IA'}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center -mt-1">
          A IA usa a avaliação presencial (avatar clínico + queixa), o MyID e os questionários respondidos. Depois é só editar e liberar.
        </p>
        </>
        )}

        {/* Modo "Montar todos": sem plano ainda, mostra só um aviso — a geração vem do botão único acima */}
        {ocultarGerador && planos.length === 0 && (
          <p className="text-sm text-muted-foreground py-3 text-center flex items-center justify-center gap-1.5">
            {gerarMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {gerarMut.isPending ? 'Montando o plano de treino…' : pendente ? 'Aguardando a sua decisão sobre a triagem de segurança.' : 'Ainda não gerado.'}
          </p>
        )}

        {/* Já existe plano e o gerador está escondido: opção discreta de gerar outro */}
        {planos.length > 0 && !mostrarGerador && !ocultarGerador && (
          <Button size="sm" variant="ghost" className="w-full h-8 text-[11px] gap-1.5 text-muted-foreground" onClick={() => setMostrarGerador(true)}>
            <Sparkles className="icon-xs" /> Gerar outro plano
          </Button>
        )}

        {pendente && !dialogoTriagemAberto && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <ShieldAlert className="icon-xs text-amber-600 shrink-0" /> Geração pausada pela triagem de segurança
            </p>
            <p className="text-xs text-foreground/85">
              {resumoMotivosBloqueio(pendente.bloqueio)}. Nenhum plano foi gerado: revise os pontos e decida se quer prosseguir.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-[11px]" onClick={() => setDialogoTriagemAberto(true)}>Revisar e decidir</Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={dispensarPausa}>Dispensar</Button>
            </div>
          </div>
        )}

        {planos.length > 0 && !chancela.loading && !chancela.pode && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center -mt-1">🔒 {chancela.motivo}</p>
        )}

        {planosVisiveis.map((p: any) => {
          const emEdicao = editandoInlineId === p.id;
          return (
          <div key={p.id} className="p-3 rounded-lg border border-border/40 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{p.titulo}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.frequencia_semanal}x/sem · {p.duracao_semanas} sem
                  <Badge variant="outline" className="ml-2 text-[10px]">{p.objetivo}</Badge>
                  <Badge variant="outline" className="ml-1 text-[10px]">{p.nivel}</Badge>
                </div>
              </div>
              {p.aprovado
                ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">Liberado</Badge>
                : <Badge variant="outline" className="text-[10px] shrink-0">Rascunho</Badge>}
              <Button size="sm" variant={p.aprovado ? 'ghost' : 'default'} className="h-7 text-[11px] px-2 shrink-0"
                disabled={!p.aprovado && (chancela.loading || !chancela.pode)}
                title={!p.aprovado && !chancela.pode ? chancela.motivo : (chancela.viaClinica ? chancela.motivo : undefined)}
                onClick={() => (p.aprovado ? ocultar(p) : abrirLiberar(p))}>
                {p.aprovado ? 'Ocultar' : 'Liberar'}
              </Button>
              {/* Editar plano avançado: troca de exercício (busca na biblioteca),
                  carga, fase, séries/reps. */}
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Trocar exercícios (avançado)" onClick={() => setEditarPlano(p)}><Dumbbell className="icon-xs" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Excluir plano" aria-label="Excluir plano" onClick={() => setApagarId(p.id)}><Trash2 className="icon-xs text-destructive" /></Button>
            </div>

            <SeloGovernanca conteudo={p.estrutura} aprovado={!!p.aprovado} origem="profissional" visao="profissional" />

            {/* Barra de edição inline — mostra/edita o treino aqui mesmo (como no portal) */}
            <div className="flex items-center gap-2">
              {!emEdicao ? (
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]"
                  onClick={() => { setEditandoInlineId(p.id); setDocConteudo(p.estrutura || {}); setDocTitulo(p.titulo || ''); }}>
                  <Pencil className="icon-xs" /> Editar movimentos
                </Button>
              ) : (
                <>
                  <Button size="sm" className="h-7 gap-1.5 text-[11px]" onClick={() => salvarDoc(p)} disabled={salvandoDoc}>
                    {salvandoDoc ? <Loader2 className="icon-xs animate-spin" /> : null} Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditandoInlineId(null)} disabled={salvandoDoc}>Cancelar</Button>
                </>
              )}
            </div>

            {/* Treino visível JÁ AQUI (com GIFs) — e editável inline, sem precisar do olho */}
            <TreinoDocumento
              nome=""
              titulo={emEdicao ? docTitulo : (p.titulo || '')}
              conteudo={emEdicao ? docConteudo : (p.estrutura || {})}
              editando={emEdicao}
              onTituloChange={setDocTitulo}
              onConteudoChange={setDocConteudo}
              origemGov="profissional"
              aprovado={!!p.aprovado}
            />

            <ResumoAcompanhamento conteudo={p.estrutura} />

            <RevisorSeguranca pacienteId={pacienteId} tipo="treino" plano={p.estrutura} planoId={p.id} />
          </div>
          );
        })}

        {planos.length > 0 && <AcompanhamentoPlanoCard pacienteId={pacienteId} />}

        {outros.length > 0 && (
          <button
            onClick={() => setVerOutros(v => !v)}
            className="w-full text-center text-[11px] font-semibold text-muted-foreground py-1 rounded-lg hover:bg-muted/40"
          >
            {verOutros ? 'Ocultar rascunhos antigos' : `Ver outros ${outros.length} rascunho${outros.length > 1 ? 's' : ''}`}
          </button>
        )}
      </CardContent>

      <TriagemBloqueioDialog
        bloqueio={dialogoTriagemAberto ? pendente?.bloqueio ?? null : null}
        chamador="profissional"
        enviando={gerarMut.isPending}
        onCancelar={cancelarTriagem}
        onProsseguir={(override) => { if (pendente) gerarMut.mutate({ pedido: pendente.pedido, override }); }}
      />

      <LiberarPlanoDialog
        tipo="treino"
        planoId={planoParaLiberar?.id ?? ''}
        pacienteId={pacienteId}
        open={!!planoParaLiberar}
        onOpenChange={(aberto) => { if (!aberto) setLiberarId(null); }}
        onLiberado={() => {
          invalidarPlanos();
          qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
        }}
        podeLiberar={chancela.pode}
        motivoBloqueio={chancela.motivo}
        terapeutaId={planoParaLiberar?.terapeuta_id}
        tituloPlano={planoParaLiberar?.titulo}
      />

      {editarPlano && (
        <PlanoTreinoEditor plano={editarPlano} pacienteId={pacienteId} onClose={() => setEditarPlano(null)} />
      )}

      <AlertDialog open={!!apagarId} onOpenChange={(open) => !open && setApagarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano de treino?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O plano será removido do paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (apagarId) apagar(apagarId); setApagarId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
