import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Brain, CheckCircle2, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { generateGuidelineExplanation4Lines } from '@/utils/myidCalculations';

const FASE_NOMES = ['Controle & Proteção', 'Mobilização & Proliferação', 'Remodelação & Força', 'Funcionalidade & Retorno'];
const FASE_CORES_BG = ['bg-indigo-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50'];
const FASE_CORES_TEXT = ['text-indigo-700', 'text-amber-700', 'text-emerald-700', 'text-red-700'];
const FASE_CORES_BADGE = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500'];

const EVIDENCIA_BADGE: Record<string, { label: string; class: string }> = {
  A: { label: 'Evidência A', class: 'bg-emerald-100 text-emerald-700' },
  B: { label: 'Evidência B', class: 'bg-blue-100 text-blue-700' },
  C: { label: 'Evidência C', class: 'bg-amber-100 text-amber-700' },
};

const COMPLEXIDADE_BADGE: Record<string, { label: string; class: string }> = {
  basica: { label: 'Básica', class: 'bg-emerald-100 text-emerald-700' },
  intermediaria: { label: 'Intermediária', class: 'bg-amber-100 text-amber-700' },
  avancada: { label: 'Avançada', class: 'bg-red-100 text-red-700' },
};

const CAT_LABELS: Record<string, { icon: string; label: string }> = {
  terapia_manual: { icon: '🖐️', label: 'Terapia Manual' },
  eletroterapia: { icon: '⚡', label: 'Eletrotermofototerapia' },
  exercicio_respiratorio: { icon: '🫁', label: 'Exercícios Respiratórios' },
  tracao: { icon: '🔗', label: 'Tração' },
  outros: { icon: '🧊', label: 'Outras Técnicas' },
};

interface Props {
  protocoloId: string;
  faseAtual: number;
}

export default function ProtocoloTratamento({ protocoloId, faseAtual }: Props) {
  const [salvando, setSalvando] = useState(false);
  const qc = useQueryClient();

  const { data: tratamentos = [], isLoading } = useQuery({
    queryKey: ['protocolo-tratamentos', protocoloId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('protocolo_tratamentos')
        .select('*, tecnica:tecnica_id(*)')
        .eq('protocolo_id', protocoloId)
        .eq('ativo', true)
        .order('fase_numero');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: protocolData } = useQuery({
    queryKey: ['protocolo-metadata', protocoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos')
        .select('*')
        .eq('id', protocoloId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const salvarProtocolo = async () => {
    setSalvando(true);
    try {
      const { error } = await (supabase as any)
        .from('protocolos')
        .update({ status: 'ativo', updated_at: new Date().toISOString() })
        .eq('id', protocoloId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['protocolos'] });
      toast({ title: '✅ Diretriz salva com sucesso!', description: 'A diretriz está disponível na aba Diretrizes do paciente.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar diretriz', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) return null;

  // Group by fase_numero
  const porFase: Record<number, any[]> = {};
  tratamentos.forEach(t => {
    const f = t.fase_numero || 1;
    if (!porFase[f]) porFase[f] = [];
    porFase[f].push(t);
  });

  if (tratamentos.length === 0) {
    return (
      <div className="text-center py-16 border rounded-xl border-dashed">
        <Brain className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
        <p className="font-medium text-foreground">Nenhuma técnica selecionada para tratamento</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vá até a aba <strong>"Cardápio de Técnicas"</strong> para selecionar as técnicas que farão parte do tratamento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="clinical-card border-l-4 border-emerald-500 bg-emerald-50/50 mb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{tratamentos.length} técnica{tratamentos.length !== 1 ? 's' : ''} selecionadas</strong> para o tratamento deste paciente, organizadas por fase.
            </p>
          </div>
          <Button
            onClick={salvarProtocolo}
            disabled={salvando}
            className="bg-gradient-primary text-white gap-2 shrink-0"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Diretriz
          </Button>
        </div>

        {/* 4-Line Explanation */}
        {protocolData && (
          <div className="mt-2 p-3 bg-white/60 rounded-lg border border-emerald-100">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">Resumo da Diretriz</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {generateGuidelineExplanation4Lines(protocolData).map((line, i) => (
                <p key={i} className="text-xs text-slate-600 leading-relaxed font-medium flex items-start gap-1.5">
                  <span className="text-emerald-500">•</span>{line}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {[1, 2, 3, 4].map(faseNum => {
        const idx = faseNum - 1;
        const tecsFase = porFase[faseNum] || [];
        if (tecsFase.length === 0) return null;
        const isAtual = faseAtual === faseNum;

        // Group by category
        const porCategoria: Record<string, any[]> = {};
        tecsFase.forEach(t => {
          const cat = t.tecnica?.categoria || 'outros';
          if (!porCategoria[cat]) porCategoria[cat] = [];
          porCategoria[cat].push(t);
        });

        return (
          <div key={faseNum} className={`rounded-xl border overflow-hidden ${isAtual ? 'ring-2 ring-primary' : ''}`}>
            <div className={`flex items-center gap-3 p-4 ${FASE_CORES_BG[idx]}`}>
              <div className={`w-8 h-8 rounded-full ${FASE_CORES_BADGE[idx]} flex items-center justify-center text-white text-sm font-bold`}>
                {faseNum}
              </div>
              <div>
                <div className={`font-semibold ${FASE_CORES_TEXT[idx]}`}>
                  Fase {faseNum}: {FASE_NOMES[idx]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tecsFase.length} técnica{tecsFase.length !== 1 ? 's' : ''} no tratamento
                  {isAtual && <Badge className="ml-2 bg-primary text-primary-foreground text-[10px] h-4">Fase Atual</Badge>}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(porCategoria).map(([cat, items]) => {
                  const catInfo = CAT_LABELS[cat] || { icon: '🔧', label: cat };
                  return (
                    <div key={cat} className="border rounded-lg p-3">
                      <h4 className="font-semibold text-sm mb-2">{catInfo.icon} {catInfo.label}</h4>
                      <div className="space-y-2">
                        {items.map(item => {
                          const tec = item.tecnica;
                          if (!tec) return null;
                          const evBadge = EVIDENCIA_BADGE[tec.nivel_evidencia] || EVIDENCIA_BADGE.B;
                          const compBadge = COMPLEXIDADE_BADGE[tec.complexidade] || COMPLEXIDADE_BADGE.basica;
                          return (
                            <div key={item.id} className="p-2 rounded-md bg-primary/5 border border-primary/20">
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex items-center gap-1.5">
                                  <Zap className="h-3 w-3 text-primary shrink-0" />
                                  <span className="text-sm font-medium">{tec.nome}</span>
                                </div>
                                <div className="flex gap-0.5 shrink-0">
                                  <Badge className={`${evBadge.class} border-0 text-[8px] h-3.5 px-1`}>{evBadge.label}</Badge>
                                  <Badge className={`${compBadge.class} border-0 text-[8px] h-3.5 px-1`}>{compBadge.label}</Badge>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 ml-4.5">{tec.descricao}</p>
                              {tec.indicacoes && <p className="text-[10px] text-emerald-600 mt-0.5 ml-4.5">✓ {tec.indicacoes}</p>}
                              {tec.contraindicacoes && <p className="text-[10px] text-destructive mt-0.5 ml-4.5">⚠ {tec.contraindicacoes}</p>}
                              {tec.parametros && typeof tec.parametros === 'object' && (
                                <div className="flex flex-wrap gap-0.5 mt-1 ml-4.5">
                                  {Object.entries(tec.parametros).slice(0, 3).map(([k, v]) => (
                                    <Badge key={k} variant="outline" className="text-[8px] py-0 h-3.5">{k}: {String(v)}</Badge>
                                  ))}
                                </div>
                              )}
                              {item.observacoes && (
                                <p className="text-[10px] text-amber-600 mt-1 ml-4.5 italic">💡 {item.observacoes}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
