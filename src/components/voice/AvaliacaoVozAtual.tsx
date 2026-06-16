import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FileText, Mic, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import VoiceAssessment from './VoiceAssessment';
import AvaliacaoSecoesEditaveis from './AvaliacaoSecoesEditaveis';
import { reprocessarComplemento, invalidarCachesAvaliacaoVoz } from '@/utils/voiceAssessment/reprocessarComplemento';

interface Props {
  pacienteId: string;
  patientName: string;
  serviceType?: 'identidade' | 'cobzero' | 'studio';
}

export default function AvaliacaoVozAtual({ pacienteId, patientName, serviceType = 'identidade' }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const { data: latest, isLoading } = useQuery({
    queryKey: ['avaliacao-voz-latest', pacienteId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('id, created_at, resultado, transcricao, servico, classificacao_severidade, queixa_principal')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!pacienteId,
  });

  const handleComplementar = async (
    capturedText: string,
    capturedAudioBase64?: string,
    capturedAudioMimeType?: string,
  ) => {
    if (!latest || !user) return;
    setAddOpen(false);
    setReprocessing(true);
    try {
      const stamp = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const existingTranscript = (latest as any).transcricao || '';
      const addition = `\n\n--- Complemento (${stamp}) ---\n${capturedText || '(áudio anexado)'}`;
      const merged = existingTranscript + addition;

      toast({ title: '🧠 Reprocessando avaliação...', description: 'A IA está reanalisando com os dados atualizados.' });

      await reprocessarComplemento({
        avaliacaoId: latest.id,
        pacienteId,
        terapeutaId: user.id,
        patientName,
        serviceType: (latest as any).servico || serviceType,
        finalTranscript: merged,
        audioBase64: capturedAudioBase64,
        audioMimeType: capturedAudioMimeType,
        prevResultado: (latest as any).resultado,
        prevQueixaPrincipal: (latest as any).queixa_principal,
        prevSeveridade: (latest as any).classificacao_severidade,
        notaProntuarioTitulo: `Avaliação por Voz atualizada — ${(latest as any).classificacao_severidade || 'N/A'}`,
        notaProntuarioDescricao: `📝 Avaliação complementada e reprocessada pela IA.\n\n${capturedText.slice(0, 500)}`,
      });

      invalidarCachesAvaliacaoVoz(qc, pacienteId);
      toast({ title: 'Avaliação atualizada! ✅', description: 'Dados clínicos reprocessados com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao reprocessar', description: e.message, variant: 'destructive' });
    } finally {
      setReprocessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="icon-sm animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!latest) return null;

  const mode = (latest as any).resultado?._meta?.mode === 'written' ? 'written' : 'voice';
  const hasResult = !!(latest as any).resultado;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <FileText className="icon-xs" />
          <span>
            Última avaliação — {format(new Date(latest.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        {hasResult && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={reprocessing}
            className="h-8 gap-1.5"
          >
            {reprocessing ? (
              <>
                <Loader2 className="icon-xs animate-spin" />
                Reprocessando...
              </>
            ) : (
              <>
                <Plus className="icon-xs" />
                Complementar com áudio ou texto
              </>
            )}
          </Button>
        )}
      </div>

      {hasResult ? (
        <AvaliacaoSecoesEditaveis
          pacienteId={pacienteId}
          avaliacaoId={latest.id}
          resultado={(latest as any).resultado}
          transcricao={(latest as any).transcricao}
        />
      ) : (
        <VoiceAssessment
          key={latest.id}
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          mode={mode as any}
          initialRecord={{ id: latest.id, resultado: (latest as any).resultado, transcricao: latest.transcricao }}
        />
      )}

      {/* Dialog: complementar avaliação existente com voz/áudio/texto */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-violet-600" />
              Complementar avaliação
            </DialogTitle>
            <DialogDescription>
              Grave por voz, faça upload de áudio ou escreva uma observação. A IA vai somar ao resultado existente e atualizar a análise.
            </DialogDescription>
          </DialogHeader>
          <VoiceAssessment
            serviceType={(latest as any).servico || serviceType}
            pacienteId={pacienteId}
            patientName={patientName}
            appendMode
            mode="voice"
            onAppendCapture={handleComplementar}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
