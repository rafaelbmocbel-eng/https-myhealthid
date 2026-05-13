import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar, Dumbbell, Heart, MessageCircle, DollarSign,
  CalendarDays, ClipboardList, Activity, ExternalLink, Loader2, Smartphone,
  TrendingUp, Trophy, Apple, Ruler, Bell, GraduationCap
} from 'lucide-react';
import DeverDeCasaDialog from './DeverDeCasaDialog';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPortalUrl } from '@/utils/linkUrls';
import { useToast } from '@/hooks/use-toast';

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
  const [deverOpen, setDeverOpen] = useState(false);
  const since30 = subDays(new Date(), 30).toISOString();
  const since7 = subDays(new Date(), 7).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['portal-controle-full', pacienteId],
    queryFn: async () => {
      const sb: any = supabase;
      const [
        dailyLogs, execucoes, prescricoes, agendamentos, pagamentos,
        chat, eventoInscricoes, healthData, respostas, meals, body, notif
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

  const portalUrl = portalToken ? getPortalUrl(portalToken) : '';
  const diarioSemana = data.dailyLogs.filter((l: any) => l.created_at >= since7).length;
  const execSemana = data.execucoes.filter((e: any) => e.created_at >= since7).length;
  const prescricoesAtivas = data.prescricoes.filter((p: any) => p.ativa).length;
  const proxAg = data.agendamentos.filter((a: any) => new Date(a.data_inicio) > new Date()).reverse()[0];
  const pagPendentes = data.pagamentos.filter((p: any) => p.status === 'pendente').length;
  const pagPagos30 = data.pagamentos.filter((p: any) => p.status === 'pago' && p.created_at >= since30).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  const chatNaoLido = data.chat.filter((c: any) => c.remetente === 'paciente' && !c.lida).length;
  const respostasPendentes = data.respostas.filter((r: any) => r.status !== 'concluida').length;
  const totalAtividade = data.dailyLogs.length + data.execucoes.length + data.health.length + data.chat.length + data.meals.length;

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

  const espacos = [
    { key: 'diario', icon: Heart, label: 'Diário', color: 'text-rose-600 bg-rose-50', stat: `${diarioSemana} (7d)`, total: data.dailyLogs.length },
    { key: 'exerc', icon: Dumbbell, label: 'Exercícios', color: 'text-amber-600 bg-amber-50', stat: `${execSemana} (7d)`, total: data.execucoes.length, sub: `${prescricoesAtivas} ativas` },
    { key: 'agenda', icon: Calendar, label: 'Agenda', color: 'text-blue-600 bg-blue-50', stat: proxAg ? format(parseISO(proxAg.data_inicio), 'dd/MM HH:mm', { locale: ptBR }) : '—', total: data.agendamentos.length },
    { key: 'pag', icon: DollarSign, label: 'Pagamentos', color: 'text-emerald-600 bg-emerald-50', stat: `R$ ${pagPagos30.toFixed(0)}`, total: data.pagamentos.length, sub: `${pagPendentes} pend.` },
    { key: 'chat', icon: MessageCircle, label: 'Chat', color: 'text-indigo-600 bg-indigo-50', stat: chatNaoLido > 0 ? `${chatNaoLido} novas` : 'Em dia', total: data.chat.length },
    { key: 'quest', icon: ClipboardList, label: 'Questionários', color: 'text-violet-600 bg-violet-50', stat: respostasPendentes > 0 ? `${respostasPendentes} pend.` : 'Em dia', total: data.respostas.length },
    { key: 'saude', icon: Activity, label: 'Wearables', color: 'text-cyan-600 bg-cyan-50', stat: `${data.health.length}`, total: data.health.length },
    { key: 'eventos', icon: CalendarDays, label: 'Eventos', color: 'text-fuchsia-600 bg-fuchsia-50', stat: `${data.eventos.length}`, total: data.eventos.length },
    { key: 'meals', icon: Apple, label: 'Refeições', color: 'text-orange-600 bg-orange-50', stat: `${data.meals.length}`, total: data.meals.length },
    { key: 'body', icon: Ruler, label: 'Composição', color: 'text-teal-600 bg-teal-50', stat: data.body[0]?.weight_kg ? `${data.body[0].weight_kg}kg` : '—', total: data.body.length },
    { key: 'notif', icon: Bell, label: 'Notificações', color: 'text-yellow-600 bg-yellow-50', stat: `${data.notif.filter((n: any) => !n.lida).length} novas`, total: data.notif.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm">Controle do Portal</h3>
              <Badge variant="outline" className="text-[10px] h-5">
                <Trophy className="h-3 w-3 mr-1" />
                {totalAtividade} atividades
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Visão completa — sem precisar abrir o portal do cliente
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {user && (
                <button
                  onClick={() => setDeverOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:opacity-90"
                >
                  <GraduationCap className="h-3 w-3" /> Dever de Casa
                </button>
              )}
              {portalToken && (
                <>
                  <button onClick={copyLink} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90">
                    <ExternalLink className="h-3 w-3" /> Copiar link
                  </button>
                  {telefone && (
                    <button onClick={sendWhatsApp} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-[11px] font-semibold hover:bg-success/20">
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Espaços resumo */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Espaços do Cliente</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {espacos.map((e) => {
            const Icon = e.icon;
            const inactive = e.total === 0;
            return (
              <Card key={e.key} className={`p-2.5 ${inactive ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${e.color}`}>
                    <Icon className="icon-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold leading-tight truncate">{e.label}</div>
                    <div className="text-[9px] text-muted-foreground">Total: {e.total}{e.sub ? ` · ${e.sub}` : ''}</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">{e.stat}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Drill-down acordeão com tudo que o cliente faz */}
      <Card className="p-2">
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

          {/* Exercícios */}
          <AccordionItem value="exerc">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Dumbbell className="icon-sm text-amber-600" /> Exercícios ({data.execucoes.length} execuções)</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.prescricoes.length > 0 && (
                    <div className="bg-muted/30 rounded-lg p-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Prescrições</div>
                      {data.prescricoes.map((p: any) => (
                        <div key={p.id} className="text-[11px] flex items-center justify-between">
                          <span>{p.nome || 'Prescrição'}</span>
                          <Badge variant={p.ativa ? 'default' : 'outline'} className="text-[9px] h-4">{p.ativa ? 'ativa' : 'inativa'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.execucoes.map((e: any) => (
                    <div key={e.id} className="border rounded-lg p-2 text-[11px]">
                      <div className="font-semibold">{format(parseISO(e.created_at), "dd/MM HH:mm", { locale: ptBR })}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {e.exercicios_executados ? `${(Array.isArray(e.exercicios_executados) ? e.exercicios_executados.length : 0)} exercícios` : 'Sessão'}
                        {e.duracao_total_segundos ? ` · ${Math.round(e.duracao_total_segundos / 60)}min` : ''}
                      </div>
                    </div>
                  ))}
                  {data.execucoes.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem execuções</p>}
                </div>
              </ScrollArea>
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

          {/* Chat */}
          <AccordionItem value="chat">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><MessageCircle className="icon-sm text-indigo-600" /> Chat ({data.chat.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.chat.slice().reverse().map((c: any) => (
                    <div key={c.id} className={`rounded-lg p-2 text-[11px] ${c.remetente === 'paciente' ? 'bg-muted/50 mr-6' : 'bg-primary/10 ml-6'}`}>
                      <div className="text-[9px] font-bold uppercase text-muted-foreground">{c.remetente} · {format(parseISO(c.created_at), 'dd/MM HH:mm', { locale: ptBR })}</div>
                      <div className="mt-0.5 whitespace-pre-wrap">{c.mensagem}</div>
                    </div>
                  ))}
                  {data.chat.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem mensagens</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* Wearables */}
          <AccordionItem value="health">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Activity className="icon-sm text-cyan-600" /> Wearables / Saúde ({data.health.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.health.map((h: any) => (
                    <div key={h.id} className="border rounded-lg p-2 text-[11px]">
                      <div className="font-semibold">{format(parseISO(h.date), 'dd/MM/yyyy', { locale: ptBR })}</div>
                      <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] text-muted-foreground">
                        {h.steps != null && <div>👣 {h.steps}</div>}
                        {h.heart_rate_avg != null && <div>❤️ {h.heart_rate_avg}bpm</div>}
                        {h.calories_burned != null && <div>🔥 {h.calories_burned}kcal</div>}
                        {h.distance_km != null && <div>📍 {h.distance_km}km</div>}
                        {h.active_minutes != null && <div>⏱ {h.active_minutes}min</div>}
                        {h.spo2_avg != null && <div>O₂ {h.spo2_avg}%</div>}
                      </div>
                    </div>
                  ))}
                  {data.health.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem dados</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* Refeições */}
          <AccordionItem value="meals">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Apple className="icon-sm text-orange-600" /> Refeições ({data.meals.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.meals.map((m: any) => (
                    <div key={m.id} className="border rounded-lg p-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{m.meal_type}</span>
                        <span className="text-[10px] text-muted-foreground">{format(parseISO(m.date), 'dd/MM', { locale: ptBR })}</span>
                      </div>
                      {m.description && <div className="text-[10px] text-muted-foreground">{m.description}</div>}
                      {m.calories && <div className="text-[10px]">🔥 {m.calories} kcal</div>}
                    </div>
                  ))}
                  {data.meals.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem refeições</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* Composição */}
          <AccordionItem value="body">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><Ruler className="icon-sm text-teal-600" /> Composição corporal ({data.body.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.body.map((b: any) => (
                    <div key={b.id} className="border rounded-lg p-2 text-[11px]">
                      <div className="font-semibold">{format(parseISO(b.date), 'dd/MM/yyyy', { locale: ptBR })}</div>
                      <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] text-muted-foreground">
                        {b.weight_kg && <div>Peso: <b className="text-foreground">{b.weight_kg}kg</b></div>}
                        {b.bmi && <div>IMC: <b className="text-foreground">{b.bmi}</b></div>}
                        {b.body_fat_pct && <div>Gord: <b className="text-foreground">{b.body_fat_pct}%</b></div>}
                        {b.muscle_mass_kg && <div>Mús: <b className="text-foreground">{b.muscle_mass_kg}kg</b></div>}
                        {b.waist_cm && <div>Cint: <b className="text-foreground">{b.waist_cm}cm</b></div>}
                      </div>
                    </div>
                  ))}
                  {data.body.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem registros</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

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

          {/* Questionários */}
          <AccordionItem value="quest">
            <AccordionTrigger className="text-xs font-bold py-2 px-2">
              <div className="flex items-center gap-2"><ClipboardList className="icon-sm text-violet-600" /> Questionários ({data.respostas.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-64">
                <div className="space-y-1.5 pr-2">
                  {data.respostas.map((r: any) => (
                    <div key={r.id} className="border rounded-lg p-2 text-[11px] flex items-center justify-between">
                      <div className="font-semibold">{format(parseISO(r.created_at), "dd/MM HH:mm", { locale: ptBR })}</div>
                      <Badge variant={r.status === 'concluida' ? 'default' : 'outline'} className="text-[9px] h-4">{r.status}</Badge>
                    </div>
                  ))}
                  {data.respostas.length === 0 && <p className="text-[11px] text-muted-foreground italic px-2">Sem respostas</p>}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

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

      {user && (
        <DeverDeCasaDialog
          open={deverOpen}
          onOpenChange={setDeverOpen}
          pacienteId={pacienteId}
          pacienteNome={pacienteNome}
          terapeutaId={user.id}
        />
      )}
    </div>
  );
}
