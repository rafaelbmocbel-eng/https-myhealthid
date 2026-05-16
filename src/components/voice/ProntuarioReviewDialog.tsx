import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Save, Eye, EyeOff, Plus, Trash2, Sparkles, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

type Hipotese = { diagnostico: string; probabilidade?: string; evidencia?: string };
type FaseDiretriz = {
  key: string;
  titulo: string;
  objetivo: string;
  frequencia: string;
  exercicios: string[];
  tecnicas: string[];
  criterios_progressao: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assessment: any;
  pacienteId: string;
  servico: string;
  avaliacaoId: string | null;
  noteId: string | null;
  myidContext?: { score?: number; delta?: number; criticas?: string[]; data?: string } | null;
  painMap?: Record<string, number>;
  onSaved?: (noteId: string) => void;
}

const FASES_DEFAULT: Array<{ key: string; titulo: string; freq: string; obj: string }> = [
  { key: 'fase_1_alivio', titulo: 'Fase 1 — Alívio & Proteção', freq: '3x/semana', obj: 'Reduzir dor e proteger tecidos.' },
  { key: 'fase_2_carga', titulo: 'Fase 2 — Carga Progressiva', freq: '2-3x/semana', obj: 'Reintroduzir carga e mobilidade.' },
  { key: 'fase_3_retorno', titulo: 'Fase 3 — Retorno Funcional', freq: '2x/semana', obj: 'Restaurar função e prevenir recidiva.' },
  { key: 'fase_4_manutencao', titulo: 'Fase 4 — Manutenção & Performance', freq: '1-2x/semana', obj: 'Manter ganhos com ajustes cinético-corporais.' },
];

function arrToLines(arr: any[] | undefined, formatter: (x: any) => string): string {
  if (!arr || !arr.length) return '';
  return arr.map(formatter).filter(Boolean).join('\n');
}

export default function ProntuarioReviewDialog({
  open, onOpenChange, assessment, pacienteId, servico, avaliacaoId, noteId, myidContext, painMap, onSaved,
}: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Sempre vão (texto editável)
  const [resumoClinico, setResumoClinico] = useState('');
  const [analiseDor, setAnaliseDor] = useState('');
  const [funcionalidade, setFuncionalidade] = useState('');
  const [psicossocial, setPsicossocial] = useState('');
  const [resumoMyID, setResumoMyID] = useState('');

  // Opcionais
  const [hipoteses, setHipoteses] = useState<(Hipotese & { incluir: boolean })[]>([]);
  const [raciocinioBlocos, setRaciocinioBlocos] = useState<{ key: string; label: string; texto: string; incluir: boolean }[]>([]);
  const [cifIncluir, setCifIncluir] = useState(true);
  const [diretrizIncluir, setDiretrizIncluir] = useState(true);
  const [bonecoIncluir, setBonecoIncluir] = useState(true);

  // Diretriz editável (4 fases)
  const [fases, setFases] = useState<FaseDiretriz[]>([]);

  // ── Inicializa estados quando abre ──
  useEffect(() => {
    if (!open || !assessment) return;

    setResumoClinico(assessment.resumo_clinico || '');
    setAnaliseDor(
      assessment.dor
        ? `Localização: ${assessment.dor.localizacao || 'N/I'}\nEVA: ${assessment.dor.intensidade_eva ?? '?'}/10\nTipo: ${assessment.dor.tipo || 'N/I'}\n${assessment.dor.fatores_agravantes ? `Agrava: ${Array.isArray(assessment.dor.fatores_agravantes) ? assessment.dor.fatores_agravantes.join(', ') : assessment.dor.fatores_agravantes}\n` : ''}${assessment.dor.fatores_aliviantes ? `Alivia: ${Array.isArray(assessment.dor.fatores_aliviantes) ? assessment.dor.fatores_aliviantes.join(', ') : assessment.dor.fatores_aliviantes}` : ''}`.trim()
        : ''
    );

    const f = assessment.funcionalidade;
    setFuncionalidade(
      typeof f === 'string'
        ? f
        : f && typeof f === 'object'
          ? Object.entries(f).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
          : ''
    );

    const p = assessment.fatores_psicossociais;
    setPsicossocial(
      typeof p === 'string'
        ? p
        : Array.isArray(p)
          ? p.join('\n')
          : p && typeof p === 'object'
            ? Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
            : ''
    );

    if (myidContext?.score != null) {
      const partes: string[] = [];
      if (myidContext.data) partes.push(`MyID em ${new Date(myidContext.data).toLocaleDateString('pt-BR')}.`);
      partes.push(`Score MyID: ${Math.round(myidContext.score)}.`);
      if (myidContext.delta != null && myidContext.delta !== 0) {
        partes.push(`Variação vs anterior: ${myidContext.delta > 0 ? '+' : ''}${Math.round(myidContext.delta)} pts.`);
      }
      if (myidContext.criticas?.length) partes.push(`Dimensões críticas: ${myidContext.criticas.join(', ')}.`);
      setResumoMyID(partes.join(' '));
    } else {
      setResumoMyID('');
    }

    const hips: Hipotese[] = Array.isArray(assessment.hipoteses_diagnosticas) ? assessment.hipoteses_diagnosticas : [];
    setHipoteses(hips.map((h, i) => ({ ...h, incluir: i === 0 }))); // primeira pré-marcada

    const rac = assessment.raciocinio_multidisciplinar;
    if (rac && typeof rac === 'object') {
      setRaciocinioBlocos(
        Object.entries(rac).map(([key, val]) => ({
          key,
          label: key.replace(/_/g, ' '),
          texto: typeof val === 'string' ? val : JSON.stringify(val, null, 2),
          incluir: false,
        }))
      );
    } else {
      setRaciocinioBlocos([]);
    }

    // Diretriz: monta 4 fases (3 da IA + Manutenção sugerida)
    const d = assessment.diretriz_tratamento || {};
    setFases(
      FASES_DEFAULT.map((cfg) => {
        const base = d[cfg.key] || {};
        const isManut = cfg.key === 'fase_4_manutencao';
        const exsRaw = base.exercicios || base.exercises || [];
        const tecsRaw = base.tecnicas || base.techniques || [];

        const exsManutSugest = isManut
          ? [
              'Musculação 2x/semana — foco em padrões funcionais (puxar, empurrar, agachar, hinge)',
              'Mobilidade ativa diária (10 min) nas regiões críticas identificadas',
              'Cardio aeróbio 2x/semana — 30 min em zona moderada',
            ]
          : [];
        const tecsManutSugest = isManut
          ? [
              'Reavaliação postural a cada 3 meses',
              'Ajuste de padrão respiratório e ergonômico no trabalho/treino',
              'MyID trimestral para monitorar regressão de ganhos',
            ]
          : [];

        return {
          key: cfg.key,
          titulo: cfg.titulo,
          objetivo: base.objetivo || cfg.obj,
          frequencia: base.frequencia || base.frequencia_sugerida || cfg.freq,
          exercicios: (Array.isArray(exsRaw) ? exsRaw.map((x: any) => typeof x === 'string' ? x : x?.nome || JSON.stringify(x)) : [String(exsRaw)]).filter(Boolean).concat(exsManutSugest),
          tecnicas: (Array.isArray(tecsRaw) ? tecsRaw.map((x: any) => typeof x === 'string' ? x : x?.nome || JSON.stringify(x)) : [String(tecsRaw)]).filter(Boolean).concat(tecsManutSugest),
          criterios_progressao: base.criterios_progressao || base.criterios || (isManut ? 'Manter score MyID estável; sem retorno de dor >3/10.' : ''),
        };
      })
    );
  }, [open, assessment, myidContext]);

  const cifLista = useMemo(() => Array.isArray(assessment?.cif_codes) ? assessment.cif_codes : [], [assessment]);

  const handleConfirm = async () => {
    if (!user || !pacienteId) return;
    setSaving(true);
    try {
      const dataAtual = new Date().toLocaleDateString('pt-BR');

      const hipotesesIncluidas = hipoteses.filter((h) => h.incluir);
      const racicinioIncluido = raciocinioBlocos.filter((r) => r.incluir);

      const partes: string[] = [];
      partes.push(`📅 AVALIAÇÃO PRESENCIAL — ${dataAtual}`);
      if (resumoMyID) partes.push(`\n🧬 CONTEXTO MyID\n${resumoMyID}`);
      if (resumoClinico) partes.push(`\n📋 RESUMO CLÍNICO\n${resumoClinico}`);
      if (analiseDor) partes.push(`\n🩹 ANÁLISE DA DOR\n${analiseDor}`);
      if (funcionalidade) partes.push(`\n🏃 FUNCIONALIDADE\n${funcionalidade}`);
      if (psicossocial) partes.push(`\n🧠 FATORES PSICOSSOCIAIS\n${psicossocial}`);

      if (hipotesesIncluidas.length) {
        partes.push(`\n🎯 HIPÓTESE(S) DIAGNÓSTICA(S) SELECIONADA(S)`);
        hipotesesIncluidas.forEach((h, i) => {
          partes.push(`${i + 1}. ${h.diagnostico}${h.probabilidade ? ` (${h.probabilidade})` : ''}${h.evidencia ? `\n   Evidência: ${h.evidencia}` : ''}`);
        });
      }

      if (racicinioIncluido.length) {
        partes.push(`\n🧩 RACIOCÍNIO CLÍNICO`);
        racicinioIncluido.forEach((r) => {
          partes.push(`• ${r.label}: ${r.texto}`);
        });
      }

      if (cifIncluir && cifLista.length) {
        partes.push(`\n🏷️ CIF`);
        cifLista.forEach((c: any) => {
          partes.push(`• ${c.codigo || c.code || ''} — ${c.descricao || c.label || c.titulo || ''}`);
        });
      }

      if (diretrizIncluir && fases.length) {
        partes.push(`\n🎯 DIRETRIZ DE TRATAMENTO`);
        fases.forEach((f) => {
          partes.push(`\n▸ ${f.titulo}`);
          if (f.objetivo) partes.push(`   Objetivo: ${f.objetivo}`);
          if (f.frequencia) partes.push(`   Frequência: ${f.frequencia}`);
          if (f.exercicios.length) partes.push(`   Exercícios:\n${f.exercicios.map((e) => `     • ${e}`).join('\n')}`);
          if (f.tecnicas.length) partes.push(`   Técnicas:\n${f.tecnicas.map((t) => `     • ${t}`).join('\n')}`);
          if (f.criterios_progressao) partes.push(`   Critérios: ${f.criterios_progressao}`);
        });
      }

      if (bonecoIncluir && painMap && Object.keys(painMap).length) {
        partes.push(`\n🧍 MAPA DE DOR (boneco)`);
        Object.entries(painMap).forEach(([region, intensity]) => {
          partes.push(`• ${region}: ${intensity}/10`);
        });
      }

      const descricao = partes.join('\n');

      const dadosExtras = {
        versao_revisao: 2,
        data_avaliacao: new Date().toISOString(),
        avaliacao_voz_id: avaliacaoId,
        myid_contexto: myidContext || null,
        mapa_dor: bonecoIncluir ? painMap || null : null,
        diretriz_snapshot: diretrizIncluir
          ? {
              versao: 2,
              createdAt: new Date().toISOString(),
              fases: fases.map((f, i) => ({
                numero: i + 1,
                titulo: f.titulo,
                objetivo: f.objetivo,
                semanas: '',
                semanas_inicio: 0,
                semanas_fim: 0,
                demandasAlvo: [],
                frequenciaSemanal: 0,
                duracaoSessao: f.frequencia,
                exercicios: f.exercicios.map((nome) => ({
                  nome, categoria: 'Personalizado', series: '-', repeticoes: '-',
                  duracao: '', motivo: '', descricao: '', instrucoes: [],
                })),
                tecnicas: f.tecnicas.map((nome) => ({
                  nome, descricao: '', duracao: '', frequencia: f.frequencia, motivo: '',
                })),
                criterios_progressao: f.criterios_progressao,
              })),
            }
          : null,
        selecoes: {
          hipoteses: hipotesesIncluidas,
          raciocinio: racicinioIncluido.map((r) => r.key),
          cif: cifIncluir,
          diretriz: diretrizIncluir,
          boneco: bonecoIncluir,
        },
      };

      const payload = {
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        tipo: 'avaliacao_presencial',
        titulo: `Avaliação Presencial — ${dataAtual}`,
        descricao,
        dados_extras: dadosExtras,
        referencia_id: avaliacaoId,
      };

      let savedId = noteId;
      if (noteId) {
        const { error } = await (supabase as any).from('notas_prontuario').update(payload).eq('id', noteId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from('notas_prontuario').insert(payload).select('id').single();
        if (error) throw error;
        savedId = data?.id;
      }

      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['prontuario'] });

      toast({ title: '✅ Enviado ao prontuário', description: 'Nota registrada com as seleções escolhidas.' });
      onSaved?.(savedId || '');
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // helpers fase
  const updateFase = (idx: number, patch: Partial<FaseDiretriz>) =>
    setFases((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const addItemFase = (idx: number, campo: 'exercicios' | 'tecnicas') =>
    setFases((prev) => prev.map((f, i) => (i === idx ? { ...f, [campo]: [...f[campo], ''] } : f)));

  const updateItemFase = (idx: number, campo: 'exercicios' | 'tecnicas', itemIdx: number, val: string) =>
    setFases((prev) => prev.map((f, i) => {
      if (i !== idx) return f;
      const arr = [...f[campo]];
      arr[itemIdx] = val;
      return { ...f, [campo]: arr };
    }));

  const removeItemFase = (idx: number, campo: 'exercicios' | 'tecnicas', itemIdx: number) =>
    setFases((prev) => prev.map((f, i) => {
      if (i !== idx) return f;
      const arr = f[campo].filter((_, j) => j !== itemIdx);
      return { ...f, [campo]: arr };
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar antes de enviar ao prontuário</DialogTitle>
          <DialogDescription>
            Escolha o que vai para o prontuário do paciente. Insights e hipóteses não selecionadas ficam visíveis só para você.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-4">
            {/* Resumo MyID */}
            {resumoMyID && (
              <section className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Resumo MyID (sempre vai)</label>
                <Textarea value={resumoMyID} onChange={(e) => setResumoMyID(e.target.value)} rows={3} />
              </section>
            )}

            {/* Resumo Clínico */}
            <section className="space-y-1.5">
              <label className="text-xs font-medium">Resumo clínico (sempre vai)</label>
              <Textarea value={resumoClinico} onChange={(e) => setResumoClinico(e.target.value)} rows={4} />
            </section>

            {/* Dor */}
            <section className="space-y-1.5">
              <label className="text-xs font-medium">Análise da dor (sempre vai)</label>
              <Textarea value={analiseDor} onChange={(e) => setAnaliseDor(e.target.value)} rows={3} />
            </section>

            {/* Funcionalidade */}
            <section className="space-y-1.5">
              <label className="text-xs font-medium">Funcionalidade (sempre vai)</label>
              <Textarea value={funcionalidade} onChange={(e) => setFuncionalidade(e.target.value)} rows={3} />
            </section>

            {/* Psicossocial */}
            <section className="space-y-1.5">
              <label className="text-xs font-medium">Fatores psicossociais (sempre vai)</label>
              <Textarea value={psicossocial} onChange={(e) => setPsicossocial(e.target.value)} rows={3} />
            </section>

            {/* Hipóteses */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Hipóteses diagnósticas — escolha as que vão</label>
                <Badge variant="outline" className="text-[10px]">{hipoteses.filter(h => h.incluir).length}/{hipoteses.length} selecionadas</Badge>
              </div>
              {hipoteses.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma hipótese gerada.</p>}
              {hipoteses.map((h, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={h.incluir}
                      onCheckedChange={(v) => setHipoteses((prev) => prev.map((x, j) => j === i ? { ...x, incluir: !!v } : x))}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1.5">
                      <Input
                        value={h.diagnostico}
                        onChange={(e) => setHipoteses((prev) => prev.map((x, j) => j === i ? { ...x, diagnostico: e.target.value } : x))}
                        placeholder="Diagnóstico"
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={h.probabilidade || ''}
                          onChange={(e) => setHipoteses((prev) => prev.map((x, j) => j === i ? { ...x, probabilidade: e.target.value } : x))}
                          placeholder="Probabilidade (alta / média)"
                          className="h-8 text-xs flex-1"
                        />
                      </div>
                      <Textarea
                        value={h.evidencia || ''}
                        onChange={(e) => setHipoteses((prev) => prev.map((x, j) => j === i ? { ...x, evidencia: e.target.value } : x))}
                        placeholder="Evidência / justificativa (personalize para este paciente)"
                        rows={2}
                        className="text-xs"
                      />
                      {!h.incluir && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><EyeOff className="h-3 w-3" /> Visível apenas para você no histórico</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Raciocínio */}
            {raciocinioBlocos.length > 0 && (
              <section className="space-y-2">
                <label className="text-xs font-medium">Raciocínio clínico — escolha trechos para enviar</label>
                {raciocinioBlocos.map((r, i) => (
                  <div key={r.key} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={r.incluir}
                        onCheckedChange={(v) => setRaciocinioBlocos((prev) => prev.map((x, j) => j === i ? { ...x, incluir: !!v } : x))}
                      />
                      <span className="text-xs font-medium capitalize">{r.label}</span>
                      {!r.incluir && <Badge variant="outline" className="text-[10px] ml-auto"><EyeOff className="h-3 w-3 mr-1" />só profissional</Badge>}
                    </div>
                    <Textarea
                      value={r.texto}
                      onChange={(e) => setRaciocinioBlocos((prev) => prev.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
                      rows={3}
                      className="text-xs"
                    />
                  </div>
                ))}
              </section>
            )}

            {/* CIF */}
            {cifLista.length > 0 && (
              <section className="rounded-lg border p-3">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Checkbox checked={cifIncluir} onCheckedChange={(v) => setCifIncluir(!!v)} />
                  Incluir mapeamento CIF ({cifLista.length} código(s))
                </label>
              </section>
            )}

            {/* Boneco */}
            {painMap && Object.keys(painMap).length > 0 && (
              <section className="rounded-lg border p-3">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Checkbox checked={bonecoIncluir} onCheckedChange={(v) => setBonecoIncluir(!!v)} />
                  Incluir mapa de dor (boneco) — {Object.keys(painMap).length} região(ões) marcada(s)
                </label>
              </section>
            )}

            {/* Diretriz */}
            <section className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium">
                <Checkbox checked={diretrizIncluir} onCheckedChange={(v) => setDiretrizIncluir(!!v)} />
                Incluir Diretriz de Tratamento (4 fases — edite cada uma)
              </label>
              {diretrizIncluir && (
                <Accordion type="multiple" defaultValue={['fase_1_alivio']} className="w-full">
                  {fases.map((f, idx) => (
                    <AccordionItem key={f.key} value={f.key}>
                      <AccordionTrigger className="text-xs">{f.titulo}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-muted-foreground">Objetivo</label>
                            <Textarea value={f.objetivo} onChange={(e) => updateFase(idx, { objetivo: e.target.value })} rows={2} className="text-xs" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-muted-foreground">Frequência</label>
                            <Input value={f.frequencia} onChange={(e) => updateFase(idx, { frequencia: e.target.value })} className="h-8 text-xs" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase text-muted-foreground">Exercícios</label>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => addItemFase(idx, 'exercicios')}>
                                <Plus className="h-3 w-3 mr-1" />Adicionar
                              </Button>
                            </div>
                            {f.exercicios.map((e, j) => (
                              <div key={j} className="flex gap-1.5 items-start">
                                <Input value={e} onChange={(ev) => updateItemFase(idx, 'exercicios', j, ev.target.value)} className="h-8 text-xs" placeholder="Nome do exercício / observações" />
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => removeItemFase(idx, 'exercicios', j)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase text-muted-foreground">Técnicas / condutas</label>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => addItemFase(idx, 'tecnicas')}>
                                <Plus className="h-3 w-3 mr-1" />Adicionar
                              </Button>
                            </div>
                            {f.tecnicas.map((t, j) => (
                              <div key={j} className="flex gap-1.5 items-start">
                                <Input value={t} onChange={(ev) => updateItemFase(idx, 'tecnicas', j, ev.target.value)} className="h-8 text-xs" placeholder="Técnica" />
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => removeItemFase(idx, 'tecnicas', j)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase text-muted-foreground">Critérios de progressão / alta</label>
                            <Textarea value={f.criterios_progressao} onChange={(e) => updateFase(idx, { criterios_progressao: e.target.value })} rows={2} className="text-xs" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </section>

            {/* Insights */}
            {Array.isArray(assessment?.insights_baseados_evidencia) && assessment.insights_baseados_evidencia.length > 0 && (
              <section className="rounded-lg border border-dashed p-3 bg-muted/30">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium">Insights baseados em evidências</span>
                  <Badge variant="outline" className="text-[10px] ml-auto"><EyeOff className="h-3 w-3 mr-1" />Uso interno — não vai ao prontuário</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Visíveis só para você no histórico da avaliação ({assessment.insights_baseados_evidencia.length} insight(s)).
                </p>
              </section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Enviando...' : (noteId ? 'Atualizar prontuário' : 'Enviar ao prontuário')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
