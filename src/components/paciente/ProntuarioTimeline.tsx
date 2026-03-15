import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText, Activity, Stethoscope, Heart, ClipboardCheck,
  Dumbbell, Calendar, AlertTriangle, Brain, Zap, RefreshCw, Loader2,
} from 'lucide-react';
import type { NotaProntuario } from '@/hooks/useNotasProntuario';

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  myid_resposta: {
    icon: <Activity className="h-4 w-4" />,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'MyID Respondido',
  },
  avaliacao_profissional: {
    icon: <Stethoscope className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Avaliação Profissional',
  },
  sessao_confirmada: {
    icon: <ClipboardCheck className="h-4 w-4" />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    label: 'Sessão Confirmada',
  },
  diario_paciente: {
    icon: <Heart className="h-4 w-4" />,
    color: 'bg-rose-100 text-rose-700 border-rose-200',
    label: 'Diário do Paciente',
  },
  treino_executado: {
    icon: <Dumbbell className="h-4 w-4" />,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    label: 'Treino Executado',
  },
  conduta_diretriz: {
    icon: <Brain className="h-4 w-4" />,
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    label: 'Conduta / Diretriz',
  },
  geral: {
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-muted text-muted-foreground border-border',
    label: 'Nota',
  },
};

interface Props {
  notas: NotaProntuario[];
  isLoading?: boolean;
}

export default function ProntuarioTimeline({ notas, isLoading }: Props) {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleBackfill = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('backfill-prontuario', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const count = data?.notas_criadas || 0;
      toast({ title: `Histórico sincronizado! ✅`, description: `${count} nota(s) de prontuário gerada(s) a partir de dados existentes.` });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  const showBackfillButton = true; // Always show for convenience

  if (notas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium text-sm">Nenhuma nota de prontuário registrada</p>
        <p className="text-xs mt-1 mb-4">As notas serão geradas automaticamente conforme o paciente interagir com o sistema.</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleBackfill} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar Histórico Existente
        </Button>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, NotaProntuario[]> = {};
  notas.forEach(n => {
    const dateKey = format(parseISO(n.created_at), 'yyyy-MM-dd');
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(n);
  });

  return (
    <ScrollArea className="max-h-[600px]">
      <div className="space-y-6 pr-2">
        {Object.entries(grouped).map(([dateKey, dayNotas]) => (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-background z-10 py-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {format(parseISO(dateKey), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3 ml-2 border-l-2 border-muted pl-4">
              {dayNotas.map(nota => {
                const cfg = TIPO_CONFIG[nota.tipo] || TIPO_CONFIG.geral;
                const hasRedFlags = nota.tipo === 'myid_resposta' && nota.dados_extras?.scores;

                return (
                  <div key={nota.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[22px] top-3 h-3 w-3 rounded-full bg-background border-2 border-primary" />

                    <Card className="border shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {format(parseISO(nota.created_at), 'HH:mm')}
                              </span>
                              {hasRedFlags && (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Red Flags
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-foreground mb-1">{nota.titulo}</h4>
                            <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                              {nota.descricao}
                            </pre>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
