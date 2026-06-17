import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ChevronRight, Dumbbell, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { getDiretrizSnapshotFromScores } from '@/lib/protocoloSnapshot';

interface Props {
  pacienteId: string;
}

export default function ProtocoloAtivoResumo({ pacienteId }: Props) {
  const navigate = useNavigate();

  const { data: protocolo, isLoading: loadingProtocolo } = useQuery({
    queryKey: ['protocolo-ativo-resumo', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('protocolos')
        .select('id, scores_avaliacao, origem')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      const lista = data || [];
      return lista.find((p: any) => {
        const scores = p.scores_avaliacao || {};
        const snapshot = scores.diretriz_snapshot;
        const origem = String(p.origem || scores.origem || snapshot?.origem || '');
        return !!snapshot?.fases?.length && ['ia_voz', 'ia_escrita', 'avaliacao_voz'].includes(origem);
      }) || null;
    },
    enabled: !!pacienteId,
  });

  const { data: progressao, isLoading: loadingProgressao } = useQuery({
    queryKey: ['protocolo-ativo-progressao', protocolo?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('protocolo_progressao')
        .select('fase_atual')
        .eq('protocolo_id', protocolo!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!protocolo?.id,
  });

  if (loadingProtocolo || loadingProgressao) return null;

  const snapshot = protocolo ? getDiretrizSnapshotFromScores((protocolo as any).scores_avaliacao) : null;
  const faseAtual = progressao?.fase_atual || 1;
  const fase = snapshot ? (snapshot.fases.find(f => f.numero === faseAtual) || snapshot.fases[0]) : null;

  if (!protocolo || !snapshot || !fase) {
    return (
      <Card className="border-dashed border-violet-200/60 bg-violet-500/5">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <ClipboardList className="icon-sm text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Sem diretriz confirmada</p>
            <p className="text-micro text-muted-foreground">
              Quando uma diretriz de tratamento for confirmada, a fase atual e os próximos exercícios aparecem aqui.
            </p>
          </div>
          <button
            onClick={() => navigate(`/pacientes/${pacienteId}?tab=diretrizes`)}
            className="text-[11px] font-semibold text-violet-600 inline-flex items-center gap-0.5 shrink-0"
          >
            Ver Diretrizes <ChevronRight className="icon-xs" />
          </button>
        </CardContent>
      </Card>
    );
  }

  const proximosExercicios = fase.exercicios.slice(0, 3);
  const proximasTecnicas = fase.tecnicas.slice(0, 2);

  return (
    <Card className="border-violet-200/60 bg-gradient-to-br from-violet-500/5 to-transparent">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <ClipboardList className="icon-md text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Protocolo ativo · Fase {fase.numero}
              </p>
              <p className="text-sm font-semibold text-foreground truncate">{fase.titulo}</p>
              <p className="text-micro text-muted-foreground truncate">{fase.objetivo}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/pacientes/${pacienteId}?tab=diretrizes`)}
            className="text-[11px] font-semibold text-violet-600 inline-flex items-center gap-0.5 shrink-0"
          >
            Ver diretriz <ChevronRight className="icon-xs" />
          </button>
        </div>

        {proximosExercicios.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Dumbbell className="icon-xs" /> Próximos exercícios
            </p>
            {proximosExercicios.map((ex, i) => (
              <div key={i} className="text-xs bg-background/70 rounded-lg px-2.5 py-1.5">
                <span className="font-semibold text-foreground">{ex.nome}</span>
                {ex.motivo && <span className="text-muted-foreground"> — {ex.motivo}</span>}
              </div>
            ))}
          </div>
        )}

        {proximasTecnicas.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Sparkles className="icon-xs" /> Técnicas da fase
            </p>
            {proximasTecnicas.map((tec, i) => (
              <div key={i} className="text-xs bg-background/70 rounded-lg px-2.5 py-1.5">
                <span className="font-semibold text-foreground">{tec.nome}</span>
                {tec.motivo && <span className="text-muted-foreground"> — {tec.motivo}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
