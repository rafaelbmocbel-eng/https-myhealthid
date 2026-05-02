import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Dumbbell, FileText, Heart, MessageCircle, DollarSign,
  CalendarDays, ClipboardList, Activity, ExternalLink, Loader2, Smartphone,
  TrendingUp, Trophy
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPortalUrl } from '@/utils/linkUrls';
import { useToast } from '@/hooks/use-toast';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  portalToken?: string | null;
  telefone?: string | null;
}

export default function PortalControleTab({ pacienteId, pacienteNome, portalToken, telefone }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const since30 = subDays(new Date(), 30).toISOString();
  const since7 = subDays(new Date(), 7).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['portal-controle', pacienteId],
    queryFn: async () => {
      const sb: any = supabase;
      const [
        dailyLogs, execucoes, prescricoes, agendamentos, pagamentos,
        chat, eventoInscricoes, healthData, respostas
      ] = await Promise.all([
        sb.from('daily_logs').select('id, mood, pain, energy, sleep_hours, created_at').eq('paciente_id', pacienteId).gte('created_at', since30).order('created_at', { ascending: false }),
        sb.from('studio_execucoes').select('id, created_at, treino_id').eq('paciente_id', pacienteId).gte('created_at', since30).order('created_at', { ascending: false }),
        sb.from('prescricoes_exercicios').select('id, ativa').eq('paciente_id', pacienteId),
        sb.from('agendamentos').select('id, data_inicio, status').eq('paciente_id', pacienteId).gte('data_inicio', since30),
        sb.from('pagamentos_paciente').select('id, valor, status, created_at').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(20),
        sb.from('chat_mensagens').select('id, created_at, remetente, lida').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(20),
        sb.from('evento_inscricoes').select('id, evento_id, created_at').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(10),
        sb.from('health_metrics').select('id, created_at').eq('paciente_id', pacienteId).gte('created_at', since30).order('created_at', { ascending: false }).limit(50),
        sb.from('respostas_avaliacao_paciente').select('id, created_at, status').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(20),
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
      };
    },
    enabled: !!user,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const portalUrl = portalToken ? getPortalUrl(portalToken) : '';
  const lastDiario = data.dailyLogs[0]?.created_at;
  const diarioSemana = data.dailyLogs.filter((l: any) => l.created_at >= since7).length;
  const lastExec = data.execucoes[0]?.created_at;
  const execSemana = data.execucoes.filter((e: any) => e.created_at >= since7).length;
  const prescricoesAtivas = data.prescricoes.filter((p: any) => p.ativa).length;
  const proxAg = data.agendamentos.filter((a: any) => new Date(a.data_inicio) > new Date()).sort((a: any, b: any) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())[0];
  const pagPendentes = data.pagamentos.filter((p: any) => p.status === 'pendente').length;
  const pagPagos30 = data.pagamentos.filter((p: any) => p.status === 'pago' && p.created_at >= since30).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  const lastChat = data.chat[0];
  const chatNaoLido = data.chat.filter((c: any) => c.remetente_tipo === 'paciente' && c.created_at >= since7).length;
  const respostasPendentes = data.respostas.filter((r: any) => r.status !== 'concluida').length;

  const copyLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast({ title: 'Link do portal copiado! 🔗' });
  };

  const sendWhatsApp = () => {
    if (!telefone || !portalUrl) return;
    const msg = `Olá ${pacienteNome}! 🩺\n\nAcesse seu Portal do Paciente:\n${portalUrl}`;
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const espacos = [
    {
      key: 'diario',
      icon: Heart,
      label: 'Diário de Saúde',
      color: 'text-rose-600 bg-rose-50',
      stat: `${diarioSemana} reg. (7d)`,
      detail: lastDiario ? `Último: ${format(parseISO(lastDiario), "dd/MM 'às' HH:mm", { locale: ptBR })}` : 'Nunca registrou',
      total: data.dailyLogs.length,
    },
    {
      key: 'exercicios',
      icon: Dumbbell,
      label: 'Exercícios',
      color: 'text-amber-600 bg-amber-50',
      stat: `${execSemana} sessões (7d)`,
      detail: `${prescricoesAtivas} prescrição(ões) ativa(s)${lastExec ? ` · Última: ${format(parseISO(lastExec), 'dd/MM', { locale: ptBR })}` : ''}`,
      total: data.execucoes.length,
    },
    {
      key: 'agenda',
      icon: Calendar,
      label: 'Agenda',
      color: 'text-blue-600 bg-blue-50',
      stat: proxAg ? format(parseISO(proxAg.data_inicio), "dd/MM HH:mm", { locale: ptBR }) : 'Sem próximo',
      detail: `${data.agendamentos.length} agendamentos (30d)`,
      total: data.agendamentos.length,
    },
    {
      key: 'pagamentos',
      icon: DollarSign,
      label: 'Pagamentos',
      color: 'text-emerald-600 bg-emerald-50',
      stat: `R$ ${pagPagos30.toFixed(2)}`,
      detail: `${pagPendentes} pendente(s) · pagos 30d`,
      total: data.pagamentos.length,
    },
    {
      key: 'chat',
      icon: MessageCircle,
      label: 'Chat',
      color: 'text-indigo-600 bg-indigo-50',
      stat: chatNaoLido > 0 ? `${chatNaoLido} do paciente` : 'Sem novas',
      detail: lastChat ? `Última: ${format(parseISO(lastChat.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}` : 'Sem mensagens',
      total: data.chat.length,
    },
    {
      key: 'questionarios',
      icon: ClipboardList,
      label: 'Questionários',
      color: 'text-violet-600 bg-violet-50',
      stat: respostasPendentes > 0 ? `${respostasPendentes} pendente(s)` : 'Em dia',
      detail: `${data.respostas.length} respostas registradas`,
      total: data.respostas.length,
    },
    {
      key: 'saude',
      icon: Activity,
      label: 'Saúde / Wearables',
      color: 'text-cyan-600 bg-cyan-50',
      stat: `${data.health.length} registros (30d)`,
      detail: data.health.length > 0 ? `Último: ${format(parseISO(data.health[0].created_at), 'dd/MM', { locale: ptBR })}` : 'Sem dados',
      total: data.health.length,
    },
    {
      key: 'eventos',
      icon: CalendarDays,
      label: 'Eventos',
      color: 'text-fuchsia-600 bg-fuchsia-50',
      stat: `${data.eventos.length} inscrição(ões)`,
      detail: data.eventos[0] ? `Última: ${format(parseISO(data.eventos[0].created_at), 'dd/MM', { locale: ptBR })}` : 'Nenhuma',
      total: data.eventos.length,
    },
  ];

  const totalAtividade = data.dailyLogs.length + data.execucoes.length + data.health.length + data.chat.length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Portal */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm">Portal do Paciente</h3>
              <Badge variant="outline" className="text-[10px] h-5">
                <Trophy className="h-3 w-3 mr-1" />
                {totalAtividade} atividades (30d)
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {portalUrl || 'Sem link de portal disponível'}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {portalToken && (
                <>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition"
                  >
                    <ExternalLink className="h-3 w-3" /> Copiar link
                  </button>
                  {telefone && (
                    <button
                      type="button"
                      onClick={sendWhatsApp}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-[11px] font-semibold hover:bg-success/20 transition"
                    >
                      <MessageCircle className="h-3 w-3" /> Enviar por WhatsApp
                    </button>
                  )}
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-foreground text-[11px] font-semibold hover:bg-muted/70 transition"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Grid de Espaços */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Controle dos Espaços do Portal
          </h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {espacos.map((e) => {
            const Icon = e.icon;
            const inactive = e.total === 0;
            return (
              <Card
                key={e.key}
                className={`p-3 hover:shadow-md transition-all ${inactive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${e.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-tight truncate">{e.label}</div>
                    <div className="text-[10px] text-muted-foreground">Total: {e.total}</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-foreground">{e.stat}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{e.detail}</div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Engajamento - resumo */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-rose-600" />
          <h4 className="text-xs font-bold">Resumo de Engajamento (30d)</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-lg font-black text-rose-600">{data.dailyLogs.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Diário</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-lg font-black text-amber-600">{data.execucoes.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Treinos</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-lg font-black text-indigo-600">{data.chat.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Mensagens</div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <div className="text-lg font-black text-cyan-600">{data.health.length}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Saúde</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
