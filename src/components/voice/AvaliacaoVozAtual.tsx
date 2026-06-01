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
    if (!latest) return;
    setAddOpen(false);
    setReprocessing(true);
    try {
      const stamp = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const existingTranscript = (latest as any).transcricao || '';
      const addition = `\n\n--- Complemento (${stamp}) ---\n${capturedText || '(áudio anexado)'}`;
      const merged = existingTranscript + addition;

      // 1. Atualiza transcrição
      await (supabase as any)
        .from('avaliacoes_voz')
        .update({ transcricao: merged })
        .eq('id', latest.id);

      // 2. Reprocessa com IA
      toast({ title: '🧠 Reprocessando avaliação...', description: 'A IA está reanalisando com os dados atualizados.' });

      const body: any = {
        transcript: merged,
        serviceType: (latest as any).servico || serviceType,
        patientName,
      };
      if (capturedAudioBase64) {
        body.audioBase64 = capturedAudioBase64;
        body.audioMimeType = capturedAudioMimeType || 'audio/webm';
      }

      const { data, error: fnErr } = await supabase.functions.invoke('voice-assessment', { body });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      let autoPainMap: Record<string, number> | null = null;
      if (data?.assessment) {
        const cleanResult = JSON.parse(JSON.stringify(data.assessment));
        const finalTranscript = data.transcricao && data.transcricao.length > merged.length
          ? data.transcricao
          : merged;

        // Re-extrai mapa de dor após o reprocesso para manter o avatar atualizado
        try {
          const { REGIONS, STRUCTURES } = await import('@/components/presencial/Body3DAvatar');
          const regions = REGIONS.map((r: any) => ({
            id: r.id,
            label: `${r.label} (${r.view === 'back' ? 'posterior' : 'anterior'})`,
          }));
          const catalog = Object.fromEntries(
            Object.entries(STRUCTURES).map(([rid, cats]) => [rid, { categories: cats as any }])
          );
          const { data: painData } = await supabase.functions.invoke('extract-pain-from-voice', {
            body: { transcript: finalTranscript, regions, catalog },
          });
          if (painData?.findings?.length) {
            const map: Record<string, number> = {};
            painData.findings.forEach((f: any) => { map[f.region_id] = f.intensity; });
            autoPainMap = map;
          }
        } catch (e) {
          console.warn('[Complementar] pain extraction failed', e);
        }

        const prevMeta = ((latest as any).resultado as any)?._meta || {};
        cleanResult._meta = {
          ...prevMeta,
          ...(cleanResult._meta || {}),
          savedAt: new Date().toISOString(),
          mapa_dor: autoPainMap ?? prevMeta.mapa_dor ?? null,
        };

        await (supabase as any).from('avaliacoes_voz').update({
          resultado: cleanResult,
          transcricao: finalTranscript,
          queixa_principal: data.assessment.queixa_principal || (latest as any).queixa_principal,
          classificacao_severidade: data.assessment.classificacao_severidade || (latest as any).classificacao_severidade,
        }).eq('id', latest.id);
      }

      // 3. Registra no prontuário
      if (user) {
        try {
          await (supabase as any).from('notas_prontuario').insert({
            paciente_id: pacienteId,
            terapeuta_id: user.id,
            tipo: 'avaliacao_voz',
            titulo: `Avaliação por Voz atualizada — ${(latest as any).classificacao_severidade || 'N/A'}`,
            descricao: `📝 Avaliação complementada e reprocessada pela IA.\n\n${capturedText.slice(0, 500)}`,
            dados_extras: { voice_assessment_id: latest.id },
            referencia_id: latest.id,
          });
        } catch {}
      }

      qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest', pacienteId, user?.id] });
      qc.invalidateQueries({ queryKey: ['avaliacoes-voz-presencial'] });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
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
