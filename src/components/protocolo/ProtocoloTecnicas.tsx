import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Brain, Zap, BookOpen, Shield, ChevronDown, ChevronUp, Check, Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

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
  tecnicas: any[];
  faseAtual: number;
  protocoloId: string;
}

export default function ProtocoloTecnicas({ tecnicas, faseAtual, protocoloId }: Props) {
  const [fasesAbertas, setFasesAbertas] = useState<Set<number>>(new Set([faseAtual - 1]));
  const [salvando, setSalvando] = useState(false);
  const qc = useQueryClient();

  // Fetch already selected techniques for this protocol
  const { data: tratamentos = [] } = useQuery({
    queryKey: ['protocolo-tratamentos', protocoloId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('protocolo_tratamentos')
        .select('*')
        .eq('protocolo_id', protocoloId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const selectedIds = new Set(tratamentos.filter((t: any) => t.ativo).map((t: any) => t.tecnica_id));

  const toggleTecnica = async (tecnicaId: string, faseNum: number) => {
    setSalvando(true);
    try {
      const existing = tratamentos.find((t: any) => t.tecnica_id === tecnicaId);
      if (existing) {
        // Toggle ativo
        await (supabase as any)
          .from('protocolo_tratamentos')
          .update({ ativo: !existing.ativo })
          .eq('id', existing.id);
      } else {
        // Insert new
        await (supabase as any)
          .from('protocolo_tratamentos')
          .insert({
            protocolo_id: protocoloId,
            tecnica_id: tecnicaId,
            fase_numero: faseNum,
            ativo: true,
          });
      }
      qc.invalidateQueries({ queryKey: ['protocolo-tratamentos', protocoloId] });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar tratamento', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const toggleFase = (i: number) => {
    setFasesAbertas(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  // Group by fase_ideal
  const porFase: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] };
  tecnicas.forEach(t => {
    const f = t.fase_ideal || 1;
    if (porFase[f]) porFase[f].push(t);
  });

  const totalSelecionadas = selectedIds.size;

  return (
    <div className="space-y-4 mb-6">
      {/* Header: Cardápio */}
      <div className="clinical-card border-l-4 border-primary bg-primary/5 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Cardápio de {tecnicas.length} técnicas</strong> — selecione as que farão parte do <strong className="text-primary">Tratamento</strong> deste paciente.
            </p>
          </div>
          <Badge className="bg-primary text-primary-foreground shrink-0">
            {totalSelecionadas} selecionada{totalSelecionadas !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {[1, 2, 3, 4].map(faseNum => {
        const idx = faseNum - 1;
        const tecsFase = porFase[faseNum] || [];
        if (tecsFase.length === 0) return null;
        const aberta = fasesAbertas.has(idx);
        const isAtual = faseAtual === faseNum;
        const selecionadasFase = tecsFase.filter(t => selectedIds.has(t.id)).length;

        // Group by category
        const porCategoria: Record<string, any[]> = {};
        tecsFase.forEach(t => {
          const cat = t.categoria || 'outros';
          if (!porCategoria[cat]) porCategoria[cat] = [];
          porCategoria[cat].push(t);
        });

        return (
          <div key={faseNum} className={`rounded-xl border overflow-hidden ${isAtual ? 'ring-2 ring-primary' : ''}`}>
            <button
              className={`w-full flex items-center justify-between p-4 ${FASE_CORES_BG[idx]} text-left`}
              onClick={() => toggleFase(idx)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${FASE_CORES_BADGE[idx]} flex items-center justify-center text-white text-sm font-bold`}>
                  {faseNum}
                </div>
                <div>
                  <div className={`font-semibold ${FASE_CORES_TEXT[idx]}`}>
                    Fase {faseNum}: {FASE_NOMES[idx]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selecionadasFase}/{tecsFase.length} técnica{tecsFase.length !== 1 ? 's' : ''} selecionadas para tratamento
                    {isAtual && <Badge className="ml-2 bg-primary text-primary-foreground text-[10px] h-4">Fase Atual</Badge>}
                  </div>
                </div>
              </div>
              {aberta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {aberta && (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(porCategoria).map(([cat, tecs]) => {
                    const catInfo = CAT_LABELS[cat] || { icon: '🔧', label: cat };
                    return (
                      <div key={cat} className="border rounded-lg p-3">
                        <h4 className="font-semibold text-sm mb-2">{catInfo.icon} {catInfo.label}</h4>
                        <div className="space-y-2">
                          {tecs.map(tec => {
                            const evBadge = EVIDENCIA_BADGE[tec.nivel_evidencia] || EVIDENCIA_BADGE.B;
                            const compBadge = COMPLEXIDADE_BADGE[tec.complexidade] || COMPLEXIDADE_BADGE.basica;
                            const isSelected = selectedIds.has(tec.id);
                            return (
                              <div
                                key={tec.id}
                                className={`p-2 rounded-md transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary/10 border border-primary/30'
                                    : 'bg-muted/40 hover:bg-muted/60 border border-transparent'
                                }`}
                                onClick={() => toggleTecnica(tec.id, faseNum)}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <span className="text-sm font-medium">{tec.nome}</span>
                                  </div>
                                  <div className="flex gap-0.5 shrink-0">
                                    <Badge className={`${evBadge.class} border-0 text-[8px] h-3.5 px-1`}>{evBadge.label}</Badge>
                                    <Badge className={`${compBadge.class} border-0 text-[8px] h-3.5 px-1`}>{compBadge.label}</Badge>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 ml-7">{tec.descricao}</p>
                                {tec.indicacoes && <p className="text-[10px] text-emerald-600 mt-0.5 ml-7">✓ {tec.indicacoes}</p>}
                                {tec.contraindicacoes && <p className="text-[10px] text-destructive mt-0.5 ml-7">⚠ {tec.contraindicacoes}</p>}
                                {tec.parametros && typeof tec.parametros === 'object' && (
                                  <div className="flex flex-wrap gap-0.5 mt-1 ml-7">
                                    {Object.entries(tec.parametros).slice(0, 3).map(([k, v]) => (
                                      <Badge key={k} variant="outline" className="text-[8px] py-0 h-3.5">{k}: {String(v)}</Badge>
                                    ))}
                                  </div>
                                )}
                                {tec.prerequisitos?.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 ml-7">
                                    <Shield className="h-2 w-2 text-amber-500" />
                                    <span className="text-[9px] text-amber-600">Pré-req: {tec.prerequisitos.join(', ')}</span>
                                  </div>
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
            )}
          </div>
        );
      })}

      {salvando && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
        </div>
      )}
    </div>
  );
}
