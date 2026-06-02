import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, FileText, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const FULL_LABELS: Record<string, string> = {
  D: 'Dor', EFI: 'Atividades do dia', P: 'Cabeça e emoções', I: 'Mudanças recentes',
  R: 'Sono e energia', C: 'Vida pessoal', AF: 'Movimento', HID: 'Hidratação',
  NUT: 'Alimentação', ERG: 'Postura no dia', N: 'Sinais do corpo', MED: 'Medicação',
};

// Friendly labels for the most common raw keys (best-effort)
const FRIENDLY_KEY: Record<string, string> = {
  bloco_1_did_physio: 'Já fez fisioterapia',
  bloco_1_physio_result: 'Resultado da fisioterapia',
  bloco_2_pain_now: 'Dor agora (0–10)',
  bloco_2_pain_max: 'Pior dor (0–10)',
  bloco_2_temporal_pattern: 'Padrão temporal',
  bloco_2_red_flags: 'Red flags',
  bloco_3_work: 'Trabalho (0–10)',
  bloco_3_home: 'Tarefas domésticas',
  bloco_3_exercise: 'Exercício',
  bloco_3_independence: 'Independência',
  bloco_3_social: 'Vida social',
  bloco_4_belief_damage: 'Crença de dano',
  bloco_4_avoidance: 'Evitação',
  bloco_4_self_efficacy: 'Autoeficácia',
  bloco_5a_hours: 'Horas de sono',
  bloco_5a_quality: 'Qualidade do sono',
  bloco_5a_awake: 'Acorda à noite',
  bloco_5b_tired_awake: 'Cansaço ao acordar',
  bloco_5c_stress: 'Estresse',
  bloco_5c_anxiety: 'Ansiedade',
  bloco_5c_control: 'Sensação de controle',
  bloco_5e_sitting_hours: 'Horas sentado/dia',
  bloco_5e_lifestyle: 'Estilo de vida',
  bloco_5e_exercise_types: 'Tipos de exercício',
  bloco_5e_intensity: 'Intensidade do exercício',
  bloco_5f_water_liters: 'Litros de água/dia',
  bloco_5f_urine_color: 'Cor da urina',
  bloco_5f_micturition: 'Frequência miccional',
  bloco_5f_dehydration_symptoms: 'Sintomas de desidratação',
  bloco_5g_quality: 'Qualidade da alimentação',
  bloco_5g_fruits_portions: 'Porções de frutas/vegetais',
  bloco_5g_protein: 'Ingestão de proteína',
  bloco_5g_inflammatory: 'Alimentos inflamatórios',
  bloco_5g_deficiency: 'Deficiência nutricional',
  bloco_5h_workspace: 'Workspace',
  bloco_5h_sitting_continuous: 'Tempo sentado contínuo',
  bloco_5h_sleep_position: 'Posição de dormir',
  bloco_5h_mattress: 'Colchão',
  bloco_5h_bad_habits: 'Hábitos posturais ruins',
  bloco_6_axial_trauma: 'Trauma axial',
  bloco_6_visceral_issues: 'Sintomas viscerais',
  bloco_6_endometriosis: 'Endometriose',
  bloco_6_daily_nsaid: 'AINE diário',
  bloco_6_muscle_relaxant: 'Relaxante muscular',
};

function formatKey(k: string) { return FRIENDLY_KEY[k] || k.replace(/^bloco_\w+_/, '').replace(/_/g, ' '); }
function formatValue(v: any): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') {
    const entries = Object.entries(v).filter(([_, x]) => x);
    return entries.length ? entries.map(([k]) => k).join(', ') : '—';
  }
  return String(v);
}

interface Insight {
  titulo: string;
  acao: string;
  evidencia?: string;
  prazo?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pacienteId: string;
  pacienteNome?: string;
  dimensao: string | null;
  scoreValor?: number;
  respostasBrutas?: Record<string, any>;
  queixaPrincipal?: string;
}

export default function MyIDDimensionDrillDown({
  open, onOpenChange, pacienteId, pacienteNome, dimensao, scoreValor, respostasBrutas, queixaPrincipal,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selecionados, setSelecionados] = useState<Record<number, boolean>>({});
  const [aplicando, setAplicando] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['myid-dim-insights', pacienteId, dimensao],
    enabled: open && !!dimensao,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('myid-dimension-insights', {
        body: { dimensao, scoreValor, respostasBrutas, pacienteNome, queixaPrincipal },
      });
      if (error) throw error;
      return data as {
        interpretacao?: string;
        achados?: string[];
        insights?: Insight[];
        integracao_diretriz?: string;
        respostas?: Record<string, any>;
      };
    },
  });

  const respostasFiltradas = data?.respostas || respostasBrutas || {};
  const insights = data?.insights || [];

  const toggle = (i: number) => setSelecionados(s => ({ ...s, [i]: !s[i] }));

  const aplicarNaAvaliacao = async () => {
    if (!user || !dimensao) return;
    const escolhidos = insights.filter((_, i) => selecionados[i]);
    if (escolhidos.length === 0) {
      toast({ title: 'Selecione ao menos um insight', variant: 'destructive' });
      return;
    }
    setAplicando(true);
    try {
      const dimLabel = FULL_LABELS[dimensao] || dimensao;
      const descricao = [
        `Análise da dimensão MyID: ${dimLabel} (score ${scoreValor?.toFixed(1) ?? '—'}/10).`,
        data?.interpretacao ? `\nInterpretação: ${data.interpretacao}` : '',
        '\nPropostas incorporadas à avaliação:',
        ...escolhidos.map((it, idx) => `${idx + 1}. ${it.titulo} — ${it.acao}${it.prazo ? ` (${it.prazo})` : ''}`),
        data?.integracao_diretriz ? `\nIntegração com a diretriz: ${data.integracao_diretriz}` : '',
      ].filter(Boolean).join('\n');

      const { error: notaErr } = await (supabase as any).from('notas_prontuario').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        tipo: 'avaliacao',
        titulo: `MyID — Insights para ${dimLabel}`,
        descricao,
        dados_extras: {
          origem: 'myid_dimension_insights',
          dimensao,
          score: scoreValor,
          insights: escolhidos,
          interpretacao: data?.interpretacao,
          integracao_diretriz: data?.integracao_diretriz,
        },
      });
      if (notaErr) throw notaErr;

      toast({
        title: 'Insights aplicados',
        description: 'Adicionados à avaliação e ao prontuário. Atualize a diretriz se necessário.',
      });
      setSelecionados({});
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao aplicar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setAplicando(false);
    }
  };

  if (!dimensao) return null;
  const dimLabel = FULL_LABELS[dimensao] || dimensao;
  const respostasEntries = Object.entries(respostasFiltradas);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="icon-sm text-primary" />
              {dimLabel} <span className="text-muted-foreground">({dimensao})</span>
            </DialogTitle>
            {scoreValor != null && (
              <Badge variant="outline" className="text-xs">{scoreValor.toFixed(1)} / 10</Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            Respostas da paciente nesta dimensão e propostas de melhora geradas com base em evidência.
          </DialogDescription>
        </DialogHeader>

        {/* Respostas brutas */}
        <section className="rounded-lg border border-border/40 bg-card/40 p-3">
          <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2">
            <FileText className="icon-xs text-muted-foreground" /> Respostas registradas
          </h4>
          {respostasEntries.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Sem respostas registradas nesta dimensão.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {respostasEntries.map(([k, v]) => (
                <li key={k} className="py-1.5 flex items-start gap-3 text-[12px]">
                  <span className="text-muted-foreground min-w-[140px]">{formatKey(k)}</span>
                  <span className="font-medium text-foreground/90">{formatValue(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AI insights */}
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2">
            <Lightbulb className="icon-xs text-primary" /> Insights de possibilidades
          </h4>

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="icon-sm animate-spin" /> Gerando propostas com IA…
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="icon-xs" />
              {(error as Error).message}
              <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-2 h-7">Tentar de novo</Button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {data?.interpretacao && (
                <p className="text-[12px] text-foreground/80 leading-relaxed mb-3 italic">
                  {data.interpretacao}
                </p>
              )}

              {data?.achados && data.achados.length > 0 && (
                <ul className="text-[11px] text-muted-foreground mb-3 list-disc pl-4 space-y-0.5">
                  {data.achados.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}

              {insights.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem propostas geradas.</p>
              ) : (
                <ul className="space-y-2">
                  {insights.map((it, i) => (
                    <li
                      key={i}
                      onClick={() => toggle(i)}
                      className={`cursor-pointer rounded-md border p-2.5 transition ${
                        selecionados[i] ? 'border-primary bg-primary/10' : 'border-border/40 bg-background hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className={`icon-sm shrink-0 mt-0.5 ${selecionados[i] ? 'text-primary' : 'text-muted-foreground/40'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold">{it.titulo}</span>
                            {it.prazo && <Badge variant="outline" className="text-[9px] py-0">{it.prazo}</Badge>}
                          </div>
                          <p className="text-[11px] text-foreground/80 mt-1 leading-relaxed">{it.acao}</p>
                          {it.evidencia && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">📚 {it.evidencia}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {data?.integracao_diretriz && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Integração com a diretriz</p>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">{data.integracao_diretriz}</p>
                </div>
              )}
            </>
          )}
        </section>

        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-[10px] text-muted-foreground">
            {Object.values(selecionados).filter(Boolean).length} de {insights.length} selecionado(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button
              size="sm"
              onClick={aplicarNaAvaliacao}
              disabled={aplicando || Object.values(selecionados).filter(Boolean).length === 0}
            >
              {aplicando ? <Loader2 className="icon-sm animate-spin mr-1" /> : <Sparkles className="icon-sm mr-1" />}
              Aplicar à avaliação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
