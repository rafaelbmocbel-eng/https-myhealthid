import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Mic, MicOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { atualizarPlanoComEdicoes, condutasProfissional } from '@/utils/voiceAssessment/atualizarPlanoComEdicoes';
import { invalidarCachesAvaliacaoVoz } from '@/utils/voiceAssessment/reprocessarComplemento';

// O que o profissional decidiu tratar/avaliar. Fica separado do quadro clínico
// para a IA saber, sem adivinhar, que isso é o eixo obrigatório do plano.
export default function CondutasProfissionalCard({ avaliacaoId, pacienteId, resultado }: {
  avaliacaoId: string;
  pacienteId: string;
  resultado: any;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const salvo = condutasProfissional(resultado);
  const [texto, setTexto] = useState(salvo);
  const [etapa, setEtapa] = useState<null | 'salvando' | 'plano'>(null);
  const { isListening, startListening, stopListening, isSupported } = useSpeechToText();

  // Atualiza o campo quando a avaliação é recarregada, sem apagar o que está sendo digitado.
  useEffect(() => {
    setTexto((atual) => (atual.trim() ? atual : salvo));
  }, [salvo]);

  const alterado = texto.trim() !== salvo;

  const ditar = () => {
    if (isListening) { stopListening(); return; }
    const base = texto.trim();
    startListening((falado) => setTexto(base ? `${base}\n${falado}` : falado));
  };

  const salvar = async () => {
    if (!user) return;
    if (isListening) stopListening();
    setEtapa('salvando');
    try {
      const { data: row, error } = await (supabase as any)
        .from('avaliacoes_voz').select('resultado').eq('id', avaliacaoId).maybeSingle();
      if (error) throw error;
      const r = (typeof row?.resultado === 'string' ? JSON.parse(row.resultado) : row?.resultado) || {};
      const { error: errUpd } = await (supabase as any).from('avaliacoes_voz').update({
        resultado: {
          ...r,
          _secoes: { ...(r._secoes || {}), condutas_profissional: texto.trim(), condutas_em: new Date().toISOString() },
        },
      }).eq('id', avaliacaoId);
      if (errUpd) throw errUpd;
      invalidarCachesAvaliacaoVoz(qc, pacienteId);

      if (!texto.trim()) { toast.success('Condutas removidas'); return; }
      setEtapa('plano');
      toast.message('Condutas salvas — refazendo o plano com elas...');
      await atualizarPlanoComEdicoes({ avaliacaoId, terapeutaId: user.id });
      invalidarCachesAvaliacaoVoz(qc, pacienteId);
      qc.invalidateQueries({ queryKey: ['avaliacao-voz-diretriz-protocolo'] });
      toast.success('Plano atualizado com as suas condutas');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar as condutas');
    } finally {
      setEtapa(null);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3 sm:p-4 space-y-2.5 lg:col-span-2">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
          <ClipboardList className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Condutas do profissional</p>
          <p className="text-xs text-muted-foreground">
            O que você quer avaliar e tratar. Entra obrigatoriamente no plano, evolui pelas fases e a literatura complementa.
            No plano, suas condutas aparecem com ★.
          </p>
        </div>
      </div>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder={'Ex.:\n• Avaliar escoliose\n• Tratar iliopsoas e diafragma\n• Mobilização neural do nervo femoral\n• Mobilização articular L1, L2 e L5'}
        className="text-sm bg-background"
      />
      <div className="flex flex-wrap gap-2 justify-end">
        {isSupported && (
          <Button type="button" size="sm" variant="outline" onClick={ditar} disabled={!!etapa} className="gap-1.5">
            {isListening ? <MicOff className="h-3.5 w-3.5 text-red-600" /> : <Mic className="h-3.5 w-3.5" />}
            {isListening ? 'Parar ditado' : 'Ditar'}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={salvar}
          disabled={!!etapa || !alterado}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {etapa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {etapa === 'salvando' ? 'Salvando...' : etapa === 'plano' ? 'Refazendo o plano...' : 'Salvar e atualizar plano'}
        </Button>
      </div>
    </div>
  );
}
