import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Kanban, MessageCircle, Phone, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatPhoneNumber } from '@/utils/whatsapp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Stage = 'novo' | 'qualificado' | 'agendado' | 'fechado' | 'perdido';

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'novo', label: 'Novo', color: 'bg-sky-500/10 text-sky-700 border-sky-500/30' },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  { key: 'agendado', label: 'Agendado', color: 'bg-violet-500/10 text-violet-700 border-violet-500/30' },
  { key: 'fechado', label: 'Fechado', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  { key: 'perdido', label: 'Perdido', color: 'bg-rose-500/10 text-rose-700 border-rose-500/30' },
];

interface Lead {
  id: string;
  nome_contato: string | null;
  telefone: string;
  paciente_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  intencao_atual: string | null;
  lead_score: number;
  pipeline_stage: Stage;
  pipeline_updated_at: string;
}

export default function CrmPipeline() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crm-pipeline', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversas')
        .select('id, nome_contato, telefone, paciente_id, ultima_mensagem, ultima_mensagem_em, intencao_atual, lead_score, pipeline_stage, pipeline_updated_at')
        .eq('terapeuta_id', user!.id)
        .eq('arquivada', false)
        .order('pipeline_updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!user,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('crm-pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas', filter: `terapeuta_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['crm-pipeline'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return leads.filter((l) =>
      !q || (l.nome_contato || '').toLowerCase().includes(q) || l.telefone.includes(q),
    );
  }, [leads, busca]);

  const porEtapa = useMemo(() => {
    const map: Record<Stage, Lead[]> = { novo: [], qualificado: [], agendado: [], fechado: [], perdido: [] };
    for (const l of filtrados) map[l.pipeline_stage]?.push(l);
    return map;
  }, [filtrados]);

  const mover = async (leadId: string, novaStage: Stage) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.pipeline_stage === novaStage) return;

    let motivo: string | null = null;
    if (novaStage === 'perdido') {
      motivo = prompt('Motivo da perda (opcional):') || null;
    }

    // Optimistic
    qc.setQueryData<Lead[]>(['crm-pipeline', user?.id], (old) =>
      (old || []).map((l) => l.id === leadId ? { ...l, pipeline_stage: novaStage, pipeline_updated_at: new Date().toISOString() } : l),
    );

    const { error } = await supabase
      .from('whatsapp_conversas')
      .update({ pipeline_stage: novaStage, pipeline_motivo_perda: motivo, pipeline_updated_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) {
      toast.error('Erro ao mover: ' + error.message);
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
    } else {
      toast.success(`Movido para ${STAGES.find((s) => s.key === novaStage)?.label}`);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          icon={<Kanban className="icon-lg" />}
          title="Pipeline CRM"
          subtitle="Acompanhe leads do primeiro contato ao fechamento"
          actions={
            <Link to="/crm/inbox">
              <Button variant="outline" size="sm" className="gap-1.5">
                <MessageCircle className="icon-xs" /> Inbox
              </Button>
            </Link>
          }
        />

        <div className="mt-4 mb-3 max-w-sm relative">
          <Search className="icon-xs absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar lead..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 overflow-x-auto pb-2">
            {STAGES.map((stage) => (
              <div
                key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) mover(dragId, stage.key); setDragId(null); }}
                className={cn(
                  "rounded-xl border border-border/40 bg-card/40 flex flex-col min-h-[300px]",
                  dragId && "ring-2 ring-primary/30",
                )}
              >
                <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", stage.color)}>
                      {stage.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{porEtapa[stage.key].length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100dvh-280px)]">
                  {porEtapa[stage.key].length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-6">Vazio</div>
                  )}
                  {porEtapa[stage.key].map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => setDragId(null)}
                      className="rounded-lg border border-border/40 bg-background p-3 shadow-xs cursor-move hover:shadow-md transition"
                    >
                      <div className="flex items-start gap-2">
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">
                          {(l.nome_contato || l.telefone).slice(0, 2).toUpperCase()}
                        </AvatarFallback></Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {l.nome_contato || formatPhoneNumber(l.telefone)}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="icon-xs" /> {formatPhoneNumber(l.telefone)}
                          </div>
                        </div>
                        {l.lead_score > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5">⭐ {l.lead_score}</Badge>
                        )}
                      </div>
                      {l.intencao_atual && (
                        <div className="mt-1.5 text-[10px] inline-block px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {l.intencao_atual}
                        </div>
                      )}
                      {l.ultima_mensagem && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{l.ultima_mensagem}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {l.ultima_mensagem_em && formatDistanceToNow(new Date(l.ultima_mensagem_em), { addSuffix: true, locale: ptBR })}
                        </span>
                        <div className="flex gap-1">
                          <Link to={`/crm/inbox?conversa=${l.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MessageCircle className="icon-xs" />
                            </Button>
                          </Link>
                          {l.paciente_id && (
                            <Link to={`/pacientes/${l.paciente_id}`}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <User className="icon-xs" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-micro text-muted-foreground mt-3">
          Arraste os cards entre as colunas para mudar a etapa.
        </p>
      </div>
    </AppLayout>
  );
}
