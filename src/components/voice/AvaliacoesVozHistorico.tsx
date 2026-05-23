import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Mic, Pencil, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VoiceAssessment from './VoiceAssessment';

interface Props {
  pacienteId: string;
  patientName: string;
  serviceType?: 'identidade' | 'cobzero' | 'studio';
}

interface AvaliacaoVoz {
  id: string;
  created_at: string;
  servico: string | null;
  classificacao_severidade: string | null;
  queixa_principal: string | null;
  transcricao: string | null;
  resultado: any;
}

export default function AvaliacoesVozHistorico({ pacienteId, patientName, serviceType = 'identidade' }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [opened, setOpened] = useState<AvaliacaoVoz | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes-voz', pacienteId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('id, created_at, servico, classificacao_severidade, queixa_principal, transcricao, resultado')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AvaliacaoVoz[];
    },
    enabled: !!user && !!pacienteId,
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta avaliação? Esta ação não pode ser desfeita.')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('avaliacoes_voz').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Avaliação excluída' });
      qc.invalidateQueries({ queryKey: ['avaliacoes-voz'] });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="icon-sm animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!avaliacoes.length) return null;

  return (
    <>
      <section className="space-y-2">
        <h3 className="text-caption font-medium text-muted-foreground flex items-center gap-1.5">
          <FileText className="icon-xs" />
          Avaliações salvas ({avaliacoes.length})
        </h3>
        <div className="space-y-2">
          {avaliacoes.map((a) => {
            const origem = a.resultado?._meta?.origem || a.resultado?._meta?.mode;
            const isVoz = !origem || origem.includes('voice') || origem === 'voz';
            const queixa = a.queixa_principal || a.resultado?.queixa_principal || 'Sem queixa registrada';
            return (
              <div
                key={a.id}
                className="rounded-xl border border-border/40 bg-card p-3 sm:p-4 hover:shadow-xs transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOpened(a)}
                    className="flex-1 min-w-0 text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isVoz ? <Mic className="icon-xs text-primary" /> : <FileText className="icon-xs text-primary" />}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(a.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {a.classificacao_severidade && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {a.classificacao_severidade}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {queixa}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setOpened(a)}
                      title="Abrir e editar"
                    >
                      <Pencil className="icon-xs" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      title="Excluir"
                    >
                      {deletingId === a.id
                        ? <Loader2 className="icon-xs animate-spin" />
                        : <Trash2 className="icon-xs" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={!!opened} onOpenChange={(o) => !o && setOpened(null)}>
        <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="icon-sm" />
              Editar avaliação — {format(new Date(opened?.created_at || new Date()), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          {opened && (
            <VoiceAssessment
              key={opened.id}
              serviceType={serviceType}
              pacienteId={pacienteId}
              patientName={patientName}
              mode={(opened.resultado?._meta?.mode === 'written') ? 'written' : 'voice'}
              initialRecord={{ id: opened.id, resultado: opened.resultado, transcricao: opened.transcricao }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
