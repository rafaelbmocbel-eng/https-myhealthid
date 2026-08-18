import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar, Dumbbell, Heart, MessageCircle, DollarSign,
  CalendarDays, ClipboardList, Activity, ExternalLink, Loader2, Smartphone,
  TrendingUp, Trophy, Apple, Bell, GraduationCap, Stethoscope, Rocket, Sparkles,
  Pencil, Save, X
} from 'lucide-react';
const PlanoTreinoCard = lazy(() => import('@/components/educador/PlanoTreinoCard'));
const PlanoAlimentarCard = lazy(() => import('@/components/nutricao/PlanoAlimentarCard'));
const DiretrizNutricionalCard = lazy(() => import('@/components/nutricao/DiretrizNutricionalCard'));
const DiretrizTreinoCard = lazy(() => import('@/components/educador/DiretrizTreinoCard'));
const DiretrizLenteCard = lazy(() => import('@/components/diretrizes/DiretrizLenteCard'));
const RelatorioAvaliacaoCard = lazy(() => import('@/components/paciente/RelatorioAvaliacaoCard'));
const QuestionariosClinicosCard = lazy(() => import('@/components/paciente/QuestionariosClinicosCard'));
const ExamesPresenciaisCard = lazy(() => import('@/components/presencial/ExamesPresenciaisCard'));
const TreinoDocumento = lazy(() => import('@/components/paciente/TreinoDocumento'));
const JornadaPacienteCard = lazy(() => import('@/components/paciente/JornadaPacienteCard'));
import AvatarClinicoCard from '../avatar/AvatarClinicoCard';
import { format, parseISO, subDays } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { getPortalUrl } from '@/utils/linkUrls';
import { useToast } from '@/hooks/use-toast';
import { usePodeChancelar } from '@/hooks/usePodeChancelar';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  portalToken?: string | null;
  telefone?: string | null;
  tipoConta?: string | null;
}

const moodEmoji = (m: number) => ['😞','😕','😐','🙂','😄'][Math.max(0, Math.min(4, m - 1))];

export default function PortalControleTab({ pacienteId, pacienteNome, portalToken, telefone, tipoConta }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gerandoDicas, setGerandoDicas] = useState(false);
  const [dicasRecemGeradas, setDicasRecemGeradas] = useState<any[] | null>(null);
  // Alguns clientes (cadastros antigos/importados) ficaram SEM portal_token, então
  // o link do portal não aparecia em lugar nenhum. Aqui o profissional gera o link
  // na hora — vale pra qualquer cliente sem token.
  const [tokenGerado, setTokenGerado] = useState<string | null>(null);
  const [gerandoToken, setGerandoToken] = useState(false);
  const [usandoBase, setUsandoBase] = useState<null | 'treino' | 'nutricao'>(null);
  const [gerarTodos, setGerarTodos] = useState(false);
  // Edição do plano do cliente DENTRO da página bonita (a "Plano que o cliente montou").
  // O profissional ajusta o plano direto ali e salva de volta em planos_ia_cliente.
  const [editandoPlano, setEditandoPlano] = useState(false);
  const [salvandoPlano, setSalvandoPlano] = useState(false);
  const [draftTreino, setDraftTreino] = useState<any>(null);
  const [draftNutri, setDraftNutri] = useState<any>(null);
  // Trava de liberação: só o profissional habilitado (ou clínica) libera cada área.
  const chancelaTreino = usePodeChancelar('treino');
  const chancelaNutri = usePodeChancelar('nutricao');

  // Gera (ou regenera) as dicas IA deste paciente na hora — e mostra o motivo
  // se a IA não conseguir (ex.: sem MyID concluído, sem evidência, erro).
  const gerarDicasAgora = async () => {
    setGerandoDicas(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('gerar-dicas-paciente', {
        body: { paciente_id: pacienteId },
      });
      if (error) throw new Error(error.message);
      const r = res as { ok?: boolean; geradas?: number; reason?: string; error?: string; terapeuta_dono?: string; dicas?: any[] };
      if (r?.ok) {
        if (Array.isArray(r.dicas)) setDicasRecemGeradas(r.dicas);
        if (r.terapeuta_dono && user?.id && r.terapeuta_dono !== user.id) {
          toast({ title: `✨ ${r.geradas} dicas geradas`, description: 'Atenção: este paciente pertence a outro profissional da equipe — as dicas ficam visíveis para ele.', variant: 'destructive' });
        } else {
          toast({ title: `✨ ${r.geradas} dicas geradas!` });
        }
        qc.invalidateQueries({ queryKey: ['portal-controle-full', pacienteId] });
      } else {
        const motivo = r?.reason === 'sem_evidencia'
          ? 'Sem artigos aplicáveis às áreas do MyID deste paciente.'
          : r?.reason === 'sem_dicas'
            ? 'A IA não retornou dicas — tente novamente.'
            : (r?.error || 'Motivo desconhecido.');
        toast({ title: 'Não foi possível gerar', description: motivo, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao gerar dicas', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setGerandoDicas(false);
    }
  };
  // "Usar como base": copia o plano que o CLIENTE gerou para a tabela do
  // profissional como RASCUNHO (aprovado=false), para o profissional refinar
  // e depois liberar a sua versão. Só aparece para quem já criou o plano.
  const usarComoBase = async (tipo: 'treino' | 'nutricao') => {
    if (!user) return;
    setUsandoBase(tipo);
    try {
      if (tipo === 'treino') {
        const t = geradoCliente?.treinoIA;
        const conteudo = (t?.conteudo || {}) as any;
        const fases = Array.isArray(conteudo.fases) ? conteudo.fases : [];
        const duracao = fases.reduce((s: number, f: any) => s + (Number(f.semanas) || 0), 0) || 8;
        const freq = fases.reduce((mx: number, f: any) => Math.max(mx, Array.isArray(f.sessoes) ? f.sessoes.length : 0), 0) || 3;
        const { error } = await (supabase as any).from('planos_treino').insert({
          terapeuta_id: user.id,
          paciente_id: pacienteId,
          titulo: `${t?.titulo || 'Treino do cliente'} (base do cliente)`,
          objetivo: conteudo?.baseadoEm?.objetivo ? 'personalizado' : 'saude',
          nivel: 'iniciante',
          frequencia_semanal: freq,
          duracao_semanas: duracao,
          restricoes: null,
          estrutura: conteudo,
          aprovado: false,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
      } else {
        const plano = (geradoCliente?.nutricaoIA || {}) as any;
        const { error } = await (supabase as any).from('planos_alimentares').insert({
          paciente_id: pacienteId,
          terapeuta_id: user.id,
          titulo: `${plano?.titulo || 'Plano alimentar do cliente'} (base do cliente)`,
          objetivo: 'Reeducação alimentar',
          calorias_alvo: plano?.calorias_totais || null,
          macros_alvo: plano?.macros || null,
          plano,
          ativo: true,
          aprovado: false,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['planos-alimentares', pacienteId] });
      }
      toast({ title: 'Copiado como rascunho ✅', description: 'Ajuste no card abaixo e libere a sua versão.' });
    } catch (e: any) {
      toast({ title: 'Não consegui copiar', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setUsandoBase(null);
    }
  };

  const since30 = subDays(new Date(), 30).toISOString();
  const since7 = subDays(new Date(), 7).toISOString();

  // O que o CLIENTE montou sozinho (premium): plano IA (treino+nutrição) que o
  // cliente gerou. Fica junto do que ele gera para o profissional acompanhar.
  const { data: geradoCliente } = useQuery({
    queryKey: ['portal-cliente-gerado', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('planos_ia_cliente')
        .select('tipo, titulo, conteudo').eq('paciente_id', pacienteId);
      const rows = (data || []) as any[];
      return {
        treinoIA: rows.find((r) => r.tipo === 'treino') || null,
        nutricaoIA: rows.find((r) => r.tipo === 'nutricao')?.conteudo || null,
      };
    },
  });

  // Plano do PROFISSIONAL em vigor para a página bonita: o liberado (aprovado) ou,
  // se não houver, o rascunho mais recente. É o que o profissional vê/edita.
  const profTreino = () => (data?.planosTreino || []).find((p: any) => p.aprovado) || data?.planosTreino?.[0] || null;
  const profNutri = () => (data?.planosAlim || []).find((p: any) => p.aprovado) || data?.planosAlim?.[0] || null;

  // Conteúdo a mostrar: rascunho em edição > plano do profissional > plano do cliente.
  const treinoParaMostrar = () => profTreino()?.estrutura || geradoCliente?.treinoIA?.conteudo || { fases: [] };
  const nutriParaMostrar = () => profNutri()?.plano || geradoCliente?.nutricaoIA || null;

  // Abre a edição partindo do plano em vigor (do profissional, ou do que o cliente montou).
  const iniciarEdicaoPlano = () => {
    setDraftTreino(JSON.parse(JSON.stringify(treinoParaMostrar())));
    const nut = nutriParaMostrar();
    setDraftNutri(nut ? JSON.parse(JSON.stringify(nut)) : { refeicoes: [] });
    setEditandoPlano(true);
  };

  // Salva como RASCUNHO do profissional (planos_treino/planos_alimentares, aprovado=false).
  // O cliente NÃO vê até o profissional Liberar. Cria a linha se ainda não existir.
  const salvarEdicaoPlano = async () => {
    if (!user) return;
    setSalvandoPlano(true);
    const sb: any = supabase;
    try {
      const temTreino = Array.isArray(draftTreino?.fases) && draftTreino.fases.length > 0;
      if (temTreino) {
        const pt = profTreino();
        if (pt?.id) {
          // Salvar sempre vira rascunho (aprovado=false): edição nunca chega ao
          // cliente sem passar pelo Liberar.
          const { error } = await sb.from('planos_treino').update({ estrutura: draftTreino, titulo: draftTreino?.titulo || pt.titulo, aprovado: false }).eq('id', pt.id);
          if (error) throw error;
        } else {
          const fases = draftTreino.fases;
          const duracao = fases.reduce((s: number, f: any) => s + (Number(f.semanas) || 0), 0) || 8;
          const freq = fases.reduce((mx: number, f: any) => Math.max(mx, Array.isArray(f.sessoes) ? f.sessoes.length : 0), 0) || 3;
          const { error } = await sb.from('planos_treino').insert({
            terapeuta_id: user.id, paciente_id: pacienteId,
            titulo: draftTreino?.titulo || geradoCliente?.treinoIA?.titulo || 'Plano de treino',
            objetivo: 'saude', nivel: 'iniciante',
            frequencia_semanal: freq, duracao_semanas: duracao,
            estrutura: draftTreino, aprovado: false,
          });
          if (error) throw error;
        }
      }
      const temNutri = Array.isArray(draftNutri?.refeicoes) && draftNutri.refeicoes.length > 0;
      if (temNutri) {
        const pn = profNutri();
        if (pn?.id) {
          const { error } = await sb.from('planos_alimentares').update({ plano: draftNutri, titulo: draftNutri?.titulo || pn.titulo, aprovado: false }).eq('id', pn.id);
          if (error) throw error;
        } else {
          const { error } = await sb.from('planos_alimentares').insert({
            paciente_id: pacienteId, terapeuta_id: user.id,
            titulo: draftNutri?.titulo || 'Plano alimentar',
            objetivo: 'Reeducação alimentar',
            calorias_alvo: draftNutri?.calorias_totais || null,
            macros_alvo: draftNutri?.macros || null,
            plano: draftNutri, ativo: true, aprovado: false,
          });
          if (error) throw error;
        }
      }
      toast({ title: 'Rascunho salvo ✅', description: 'O cliente só vê depois que você Liberar.' });
      qc.invalidateQueries({ queryKey: ['portal-controle-full', pacienteId] });
      setEditandoPlano(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setSalvandoPlano(false);
    }
  };

  // Libera (ou oculta) o plano do profissional para o cliente. Aprovar exige chancela.
  const liberarPlano = async (tabela: 'planos_treino' | 'planos_alimentares', id: string, aprovar: boolean, podeChancelar: boolean, motivo: string) => {
    if (aprovar && !podeChancelar) { toast({ title: motivo, variant: 'destructive' }); return; }
    const { error } = await (supabase as any).from(tabela).update({ aprovado: aprovar }).eq('id', id);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    toast({ title: aprovar ? '📲 Liberado para o cliente' : 'Ocultado do cliente' });
    qc.invalidateQueries({ queryKey: ['portal-controle-full', pacienteId] });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['portal-controle-full', pacienteId],
    queryFn: async () => {
      const sb: any = supabase;
      const [
        dailyLogs, execucoes, prescricoes, agendamentos, pagamentos,
        chat, eventoInscricoes, healthData, respostas, meals, body, notif,
        dicasIA, planosTreino, planosAlim, diretrizes
      ] = await Promise.all([
        sb.from('daily_logs').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(60),
        sb.from('studio_execucoes').select('id, created_at, treino_id, exercicios_executados, duracao_total_segundos').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(60),
        sb.from('prescricoes_exercicios').select('id, ativa, nome, created_at').eq('paciente_id', pacienteId).order('created_at', { ascending: false }),
        sb.from('agendamentos').select('id, data_inicio, data_fim, status, tipo_atendimento, observacoes').eq('paciente_id', pacienteId).order('data_inicio', { ascending: false }).limit(60),
        sb.from('pagamentos_paciente').select('id, valor, status, descricao, created_at, data_pagamento').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(60),
        sb.from('chat_mensagens').select('id, created_at, remetente, mensagem, lida').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(50),
        sb.from('evento_inscricoes').select('id, evento_id, created_at, status, pago, eventos(titulo, data_evento)').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(30),
        sb.from('health_metrics').select('*').eq('paciente_id', pacienteId).order('date', { ascending: false }).limit(30),
        sb.from('respostas_avaliacao_paciente').select('id, created_at, status, link_id').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(30),
        sb.from('meal_logs').select('id, date, meal_type, description, calories, time_eaten').eq('paciente_id', pacienteId).order('date', { ascending: false }).limit(30),
        sb.from('body_composition').select('*').eq('paciente_id', pacienteId).order('date', { ascending: false }).limit(20),
        sb.from('notificacoes').select('id, titulo, mensagem, lida, created_at, tipo').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(30),
        sb.from('paciente_dicas').select('dicas, gerado_em, terapeuta_id').eq('paciente_id', pacienteId).maybeSingle(),
        sb.from('planos_treino').select('id, created_at, aprovado, estrutura, titulo').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(5),
        sb.from('planos_alimentares').select('id, created_at, aprovado, calorias_alvo, titulo, plano').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(5),
        sb.from('diretrizes_profissionais').select('area').eq('paciente_id', pacienteId),
      ]);

      return {
        dailyLogs: (dailyLogs.data || []) as any[],
        execucoes: (execucoes.data || []) as any[],
        prescricoes: (prescricoes.data || []) as any[],
        agendamentos: (agendamentos.data || []) as any[],
        pagamentos: (pagamentos.data || []) as any[],
        chat: (chat.data || []) as any[],
        eventos: (eventoInscricoes.data || []) as any[],
        health: (healthData.data || []) as any[],
        respostas: (respostas.data || []) as any[],
        meals: (meals.data || []) as any[],
        body: (body.data || []) as any[],
        notif: (notif.data || []) as any[],
        dicasIA: (dicasIA.data || null) as { dicas: any[]; gerado_em: string; terapeuta_id?: string } | null,
        dicasIAErro: dicasIA.error?.message || null,
        planosTreino: (planosTreino.data || []) as any[],
        planosAlim: (planosAlim.data || []) as any[],
        diretrizes: (diretrizes.data || []) as { area: string }[],
      };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Token efetivo: o que veio do cadastro OU o que acabamos de gerar aqui.
  const tokenEfetivo = portalToken || tokenGerado;
  const portalUrl = tokenEfetivo ? getPortalUrl(tokenEfetivo) : '';

  // Gera e salva um portal_token pro cliente que estava sem link.
  const gerarTokenPortal = async () => {
    setGerandoToken(true);
    try {
      const novo = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const { error } = await supabase.from('pacientes').update({ portal_token: novo }).eq('id', pacienteId);
      if (error) throw error;
      setTokenGerado(novo);
      // Atualiza o perfil pra o token novo fluir pros outros lugares (aba, botão do topo).
      qc.invalidateQueries({ queryKey: ['paciente', pacienteId] });
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      toast({ title: 'Link do portal criado! 🔗', description: 'Agora é só enviar ou copiar.' });
    } catch (e: any) {
      toast({ title: 'Não consegui criar o link', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setGerandoToken(false);
    }
  };
  const diarioSemana = data.dailyLogs.filter((l: any) => l.created_at >= since7).length;
  const execSemana = data.execucoes.filter((e: any) => e.created_at >= since7).length;
  const prescricoesAtivas = data.prescricoes.filter((p: any) => p.ativa).length;
  const proxAg = data.agendamentos.filter((a: any) => new Date(a.data_inicio) > new Date()).reverse()[0];
  const pagPendentes = data.pagamentos.filter((p: any) => p.status === 'pendente').length;
  const pagPagos30 = data.pagamentos.filter((p: any) => p.status === 'pago' && p.created_at >= since30).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  const chatNaoLido = data.chat.filter((c: any) => c.remetente === 'paciente' && !c.lida).length;
  const respostasPendentes = data.respostas.filter((r: any) => r.status !== 'concluida').length;
  const totalAtividade = data.dailyLogs.length + data.execucoes.length + data.health.length + data.chat.length + data.meals.length;

  // Planos: um botão único monta o que ainda falta. Enquanto faltar algo (plano de
  // treino, nutrição, diretriz de treino ou nutricional), mostra o botão; os cards
  // individuais não exibem gerador próprio (evita "vários botões").
  const areasDiretriz = new Set((data.diretrizes || []).map((d) => d.area));
  const faltaPlanos =
    data.planosTreino.length === 0 ||
    data.planosAlim.length === 0 ||
    !areasDiretriz.has('educacao_fisica') ||
    !areasDiretriz.has('nutricao');

  // Plano do profissional em vigor (aprovado ou rascunho) + o que mostrar na página bonita.
  const ptv = profTreino();
  const pnv = profNutri();
  const temAlgumPlano = Boolean(ptv || pnv || geradoCliente?.treinoIA || geradoCliente?.nutricaoIA);

  const copyLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast({ title: 'Link do portal copiado! 🔗' });
  };

  const sendWhatsApp = () => {
    if (!telefone || !portalUrl) return;
    const msg = `Olá ${pacienteNome}! 🩺\n\nAcesse seu Portal:\n${portalUrl}`;
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const dicasVisiveis = (data.dicasIA?.dicas?.length ? data.dicasIA.dicas : dicasRecemGeradas) || [];
  const nDicasIA = dicasVisiveis.length;
  const planoTreinoAprovado = data.planosTreino.filter((p: any) => p.aprovado).length;
  const planoAlimAprovado = data.planosAlim.filter((p: any) => p.aprovado).length;


  return (
    <div className="space-y-4">
      {/* Ações do portal — linha compacta (enviar acesso). O "Dever de Casa"
          virou o Plano Fisioterápico, dentro do acordeão de planos. */}
      {!tokenEfetivo ? (
        // Cliente sem link ainda — gera na hora.
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-muted-foreground leading-snug">
              Este cliente ainda <b className="text-foreground">não tem link de acesso</b> ao portal. Gere o link
              pessoal dele (funciona com ou sem e-mail no cadastro).
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" disabled={gerandoToken} onClick={gerarTokenPortal}>
            {gerandoToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar link de acesso
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {telefone && (
              <button onClick={sendWhatsApp} className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-success/10 text-success text-xs font-semibold hover:bg-success/20 border border-success/20">
                <MessageCircle className="h-3.5 w-3.5" /> Enviar portal
              </button>
            )}
            <button onClick={copyLink} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-muted-foreground text-xs font-semibold hover:bg-muted/40">
              <ExternalLink className="h-3.5 w-3.5" /> Copiar link
            </button>
          </div>
          {/* Mostra o link em texto pra o profissional ver/copiar manualmente também. */}
          <button
            onClick={copyLink}
            title="Toque para copiar"
            className="w-full text-left text-[11px] text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-2.5 py-1.5 truncate"
          >
            {portalUrl}
          </button>
        </div>
      )}

      {/* Relatório de Avaliação — pontos fortes e a melhorar, gerado do MyID */}
      <Suspense fallback={null}>
        <RelatorioAvaliacaoCard pacienteId={pacienteId} pacienteNome={pacienteNome} pacienteTelefone={telefone} />
      </Suspense>

      {/* Questionários, Exames e Jornada foram para a lista única abaixo, como
          itens do mesmo estilo — layout uniforme, sem uns maiores que outros. */}

      {/* Espelho do portal — uma lista só (sem cards duplicando os mesmos números) */}
      <Card className="p-2">
        <div className="flex items-center gap-2 px-2 pt-2 pb-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">O que o cliente vê no portal</h4>
        </div>
        <Accordion type="multiple" className="w-full">
          {/* Diário */}
          <AccordionItem value="diario">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Heart className="icon-sm text-rose-600" /> Diário de Saúde ({data.dailyLogs.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.dailyLogs.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem registros</p>}
                  {data.dailyLogs.map((l: any) => (
                    <div key={l.id} className="border rounded-lg p-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{format(parseISO(l.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        <span className="text-base">{moodEmoji(l.mood)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] text-muted-foreground">
                        <div>Dor: <b className="text-foreground">{l.pain}/10</b></div>
                        <div>Energia: <b className="text-foreground">{l.energy}/5</b></div>
                        <div>Sono: <b className="text-foreground">{l.sleep_hours}h</b></div>
                      </div>
                      {l.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">"{l.notes}"</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* (Dever de Casa e Exercícios da IA agora vivem em "Minha jornada"
              acima — espelho exato do que o cliente vê e cumpre.) */}

          {/* PLANOS — UM lugar só para criar/gerar todos os planos (personal,
              nutrição, fisioterapia e futuros). A edição e a troca de qualquer
              parte ficam na página do plano (o botão de ver — a visão tipo PDF,
              que dá pra compartilhar). */}
          <AccordionItem value="planos">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Stethoscope className="icon-sm text-purple-600" /> Planos (treino, nutrição, fisioterapia)</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 px-1 pb-2">
                <p className="text-[10px] text-muted-foreground px-1">
                  Crie aqui os planos que o cliente ainda não tem. Para <strong>editar ou trocar qualquer parte</strong>, abra a visão do plano (o botão de ver 👁️) — é lá, na página que dá pra compartilhar, que você ajusta tudo.
                </p>

                {/* Botão ÚNICO: monta de uma vez o que ainda falta (treino, nutrição,
                    diretrizes e fisioterapia). Enquanto faltar algo, é o único caminho —
                    os cards abaixo não mostram gerador próprio. */}
                {!gerarTodos && faltaPlanos && (
                  <Button className="w-full gap-1.5" onClick={() => setGerarTodos(true)}>
                    <Sparkles className="icon-sm" /> Montar todos os planos (treino, nutrição e fisioterapia)
                  </Button>
                )}
                {gerarTodos && faltaPlanos && (
                  <p className="text-[11px] text-primary text-center flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Montando seus planos… isso leva alguns segundos.
                  </p>
                )}

                {/* A PÁGINA principal: aqui, na página bonita, o profissional VÊ, EDITA e
                    LIBERA o plano. Editar cria/atualiza um RASCUNHO do profissional
                    (escondido do cliente); o cliente só vê depois de "Liberar". */}
                {temAlgumPlano && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <div className="px-1 py-1 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                        <Dumbbell className="h-3.5 w-3.5" /> Meu Plano de Treino
                      </span>
                      <div className="flex items-center gap-1.5">
                        {editandoPlano ? (
                          <>
                            <Button size="sm" className="h-7 text-[11px] gap-1.5" disabled={salvandoPlano} onClick={salvarEdicaoPlano}>
                              {salvandoPlano ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar rascunho
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" disabled={salvandoPlano} onClick={() => setEditandoPlano(false)}>
                              <X className="h-3 w-3" /> Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={iniciarEdicaoPlano}>
                            <Pencil className="h-3 w-3" /> Editar plano
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Liberar para o cliente — por área, com a trava de segurança */}
                    {!editandoPlano && (ptv || pnv) && (
                      <div className="flex flex-wrap gap-1.5 px-1 mb-2">
                        {ptv && (
                          <Button size="sm" variant={ptv.aprovado ? 'ghost' : 'default'} className="h-7 text-[11px] gap-1.5"
                            disabled={!ptv.aprovado && (chancelaTreino.loading || !chancelaTreino.pode)}
                            title={!ptv.aprovado && !chancelaTreino.pode ? chancelaTreino.motivo : undefined}
                            onClick={() => liberarPlano('planos_treino', ptv.id, !ptv.aprovado, chancelaTreino.pode, chancelaTreino.motivo)}>
                            <Dumbbell className="h-3 w-3" /> {ptv.aprovado ? 'Ocultar treino' : 'Liberar treino'}
                          </Button>
                        )}
                        {pnv && (
                          <Button size="sm" variant={pnv.aprovado ? 'ghost' : 'default'} className="h-7 text-[11px] gap-1.5"
                            disabled={!pnv.aprovado && (chancelaNutri.loading || !chancelaNutri.pode)}
                            title={!pnv.aprovado && !chancelaNutri.pode ? chancelaNutri.motivo : undefined}
                            onClick={() => liberarPlano('planos_alimentares', pnv.id, !pnv.aprovado, chancelaNutri.pode, chancelaNutri.motivo)}>
                            <Apple className="h-3 w-3" /> {pnv.aprovado ? 'Ocultar nutrição' : 'Liberar nutrição'}
                          </Button>
                        )}
                      </div>
                    )}

                    {!editandoPlano && (
                      <p className="text-[10px] text-muted-foreground px-1 mb-2">
                        {(ptv && !ptv.aprovado) || (pnv && !pnv.aprovado)
                          ? '📝 Rascunho — o cliente ainda NÃO vê. Toque em Liberar para enviar.'
                          : (ptv?.aprovado || pnv?.aprovado)
                            ? '✅ Liberado — o cliente já vê este plano.'
                            : 'Plano que o cliente montou. Toque em Editar para criar a sua versão.'}
                      </p>
                    )}
                    {editandoPlano && (
                      <p className="text-[10px] text-muted-foreground px-1 mb-2">
                        Modo edição — ajuste qualquer característica (treino e nutrição). Ao salvar vira <strong>rascunho</strong>; o cliente só vê depois de Liberar.
                      </p>
                    )}

                    <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                      <TreinoDocumento
                        nome={pacienteNome}
                        titulo={editandoPlano ? draftTreino?.titulo : (ptv?.titulo || geradoCliente?.treinoIA?.titulo)}
                        conteudo={editandoPlano ? draftTreino : treinoParaMostrar()}
                        nutricao={editandoPlano ? draftNutri : nutriParaMostrar()}
                        editando={editandoPlano}
                        onConteudoChange={setDraftTreino}
                        onNutricaoChange={setDraftNutri}
                      />
                    </Suspense>
                  </div>
                )}

                {/* UMA caixa só com abas: Treino · Nutrição · Fisio/Clínico. Cada aba
                    reúne o plano + a diretriz daquela área. A criação vem do botão único
                    acima; aqui é só ver/editar/liberar o que já existe. */}
                <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <Tabs defaultValue="treino" className="w-full">
                    <TabsList className="w-full grid grid-cols-3 h-auto p-1">
                      <TabsTrigger value="treino" className="text-xs gap-1"><Dumbbell className="h-3.5 w-3.5" /> Treino</TabsTrigger>
                      <TabsTrigger value="nutricao" className="text-xs gap-1"><Apple className="h-3.5 w-3.5" /> Nutrição</TabsTrigger>
                      <TabsTrigger value="clinico" className="text-xs gap-1"><Activity className="h-3.5 w-3.5" /> Fisio/Clínico</TabsTrigger>
                    </TabsList>
                    {/* forceMount: mantém as abas montadas (as inativas ficam ocultas)
                        para o "Montar todos" gerar tudo de uma vez, não só a aba visível. */}
                    <TabsContent forceMount value="treino" className="space-y-3 mt-3 data-[state=inactive]:hidden">
                      <PlanoTreinoCard pacienteId={pacienteId} autoGerar={gerarTodos} ocultarGerador={faltaPlanos} />
                      <DiretrizTreinoCard pacienteId={pacienteId} autoGerar={gerarTodos} ocultarGerador={faltaPlanos} />
                    </TabsContent>
                    <TabsContent forceMount value="nutricao" className="space-y-3 mt-3 data-[state=inactive]:hidden">
                      <PlanoAlimentarCard pacienteId={pacienteId} autoGerar={gerarTodos} ocultarGerador={faltaPlanos} />
                      <DiretrizNutricionalCard pacienteId={pacienteId} autoGerar={gerarTodos} ocultarGerador={faltaPlanos} />
                    </TabsContent>
                    <TabsContent forceMount value="clinico" className="space-y-3 mt-3 data-[state=inactive]:hidden">
                      <DiretrizLenteCard pacienteId={pacienteId} autoGerar={gerarTodos} ocultarGerador={faltaPlanos} />
                    </TabsContent>
                  </Tabs>
                </Suspense>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Espelho do que o cliente vê/cumpre — mesma lista uniforme */}
          <AccordionItem value="jornada">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Rocket className="icon-sm text-violet-600" /> Jornada (o que o cliente cumpre)</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 pb-2">
                <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <JornadaPacienteCard pacienteId={pacienteId} soLeitura />
                </Suspense>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="quest">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><ClipboardList className="icon-sm text-violet-600" /> Questionários respondidos</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 pb-2">
                <Suspense fallback={null}>
                  <QuestionariosClinicosCard pacienteId={pacienteId} />
                </Suspense>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="exames">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Activity className="icon-sm text-teal-600" /> Exames presenciais</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 pb-2">
                <Suspense fallback={null}>
                  <ExamesPresenciaisCard pacienteId={pacienteId} soLeitura defaultAberto />
                </Suspense>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Agenda */}
          <AccordionItem value="agenda">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Calendar className="icon-sm text-blue-600" /> Agendamentos ({data.agendamentos.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.agendamentos.map((a: any) => (
                    <div key={a.id} className="border rounded-lg p-2 text-[11px] flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{format(parseISO(a.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}</div>
                        <div className="text-[10px] text-muted-foreground">{a.tipo_atendimento || '—'}</div>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4">{a.status}</Badge>
                    </div>
                  ))}
                  {data.agendamentos.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem agendamentos</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* Pagamentos */}
          <AccordionItem value="pag">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><DollarSign className="icon-sm text-emerald-600" /> Pagamentos ({data.pagamentos.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.pagamentos.map((p: any) => (
                    <div key={p.id} className="border rounded-lg p-2 text-[11px] flex items-center justify-between">
                      <div>
                        <div className="font-semibold">R$ {Number(p.valor).toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">{p.descricao || '—'} · {format(parseISO(p.created_at), 'dd/MM', { locale: ptBR })}</div>
                      </div>
                      <Badge variant={p.status === 'pago' ? 'default' : 'outline'} className="text-[9px] h-4">{p.status}</Badge>
                    </div>
                  ))}
                  {data.pagamentos.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem pagamentos</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* Avatar Clínico (Novo) */}
          <AccordionItem value="avatar">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Stethoscope className="icon-sm text-primary" /> Prontuário Visual (Avatar)</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-1">
                <AvatarClinicoCard pacienteId={pacienteId} isProfessional={false} />
              </div>
            </AccordionContent>
          </AccordionItem>


          {/* "Wearables / Saúde" saiu daqui: o wearable já tem o card dedicado
              "Monitor Wearable" no perfil — evita dois botões iguais.
              "Refeições" saiu (não é mais usado). "Composição corporal" saiu
              daqui: agora vive dentro de "Exames presenciais" (preenchido quando
              a bioimpedância é feita). */}

          {/* Eventos */}
          <AccordionItem value="eventos">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><CalendarDays className="icon-sm text-fuchsia-600" /> Eventos ({data.eventos.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.eventos.map((e: any) => (
                    <div key={e.id} className="border rounded-lg p-2 text-[11px] flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{e.eventos?.titulo || 'Evento'}</div>
                        <div className="text-[10px] text-muted-foreground">{e.eventos?.data_evento ? format(parseISO(e.eventos.data_evento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</div>
                      </div>
                      <div className="flex flex-col gap-0.5 items-end">
                        <Badge variant="outline" className="text-[9px] h-4">{e.status}</Badge>
                        {e.pago && <Badge className="text-[9px] h-4">pago</Badge>}
                      </div>
                    </div>
                  ))}
                  {data.eventos.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem inscrições</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* (Questionários respondidos agora ficam na linha recolhível acima.) */}

          {/* Notificações */}
          <AccordionItem value="notif">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Bell className="icon-sm text-yellow-600" /> Notificações ({data.notif.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.notif.map((n: any) => (
                    <div key={n.id} className={`border rounded-lg p-2 text-[11px] ${!n.lida ? 'bg-primary/5' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{n.titulo}</span>
                        <span className="text-[9px] text-muted-foreground">{format(parseISO(n.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{n.mensagem}</div>
                    </div>
                  ))}
                  {data.notif.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem notificações</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

    </div>
  );
}
