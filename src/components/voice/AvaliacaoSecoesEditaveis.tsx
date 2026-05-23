import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Pencil, Check, X, CheckCircle2, Loader2,
  FileText, Brain, Activity, HeartPulse, AlertTriangle,
  Target, Tags, ListChecks, Stethoscope, Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { buildSoapFromVoice } from '@/components/prontuario/SoapNoteForm';
import { cn } from '@/lib/utils';

interface Props {
  pacienteId: string;
  avaliacaoId: string;
  resultado: any;
  transcricao?: string | null;
}

type SecaoKey =
  | 'soap'
  | 'resumo_clinico'
  | 'dor'
  | 'funcionalidade'
  | 'psicossocial'
  | 'red_flags'
  | 'hipoteses'
  | 'cif'
  | 'diretriz';

// Accent palette (Tailwind classes) per section — keeps a calm, identifiable color identity
type Accent = {
  ring: string;       // top border/ribbon
  iconBg: string;     // icon circle bg
  iconText: string;   // icon color
  badgeBg: string;    // small chip bg
  badgeText: string;  // small chip text
  surface: string;    // content surface
};

const ACCENTS: Record<SecaoKey, Accent> = {
  soap:           { ring: 'from-slate-400/40 to-slate-500/10',   iconBg: 'bg-slate-500/10',   iconText: 'text-slate-600',   badgeBg: 'bg-slate-500/10',   badgeText: 'text-slate-700',   surface: 'bg-slate-500/[0.04]' },
  resumo_clinico: { ring: 'from-sky-400/40 to-sky-500/10',       iconBg: 'bg-sky-500/10',     iconText: 'text-sky-600',     badgeBg: 'bg-sky-500/10',     badgeText: 'text-sky-700',     surface: 'bg-sky-500/[0.04]' },
  dor:            { ring: 'from-rose-400/40 to-rose-500/10',     iconBg: 'bg-rose-500/10',    iconText: 'text-rose-600',    badgeBg: 'bg-rose-500/10',    badgeText: 'text-rose-700',    surface: 'bg-rose-500/[0.04]' },
  funcionalidade: { ring: 'from-teal-400/40 to-teal-500/10',     iconBg: 'bg-teal-500/10',    iconText: 'text-teal-600',    badgeBg: 'bg-teal-500/10',    badgeText: 'text-teal-700',    surface: 'bg-teal-500/[0.04]' },
  psicossocial:   { ring: 'from-violet-400/40 to-violet-500/10', iconBg: 'bg-violet-500/10',  iconText: 'text-violet-600',  badgeBg: 'bg-violet-500/10',  badgeText: 'text-violet-700',  surface: 'bg-violet-500/[0.04]' },
  red_flags:      { ring: 'from-red-400/50 to-red-500/10',       iconBg: 'bg-red-500/10',     iconText: 'text-red-600',     badgeBg: 'bg-red-500/10',     badgeText: 'text-red-700',     surface: 'bg-red-500/[0.04]' },
  hipoteses:      { ring: 'from-amber-400/40 to-amber-500/10',   iconBg: 'bg-amber-500/10',   iconText: 'text-amber-600',   badgeBg: 'bg-amber-500/10',   badgeText: 'text-amber-700',   surface: 'bg-amber-500/[0.04]' },
  cif:            { ring: 'from-indigo-400/40 to-indigo-500/10', iconBg: 'bg-indigo-500/10',  iconText: 'text-indigo-600',  badgeBg: 'bg-indigo-500/10',  badgeText: 'text-indigo-700',  surface: 'bg-indigo-500/[0.04]' },
  diretriz:       { ring: 'from-emerald-400/40 to-emerald-500/10', iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-700', surface: 'bg-emerald-500/[0.04]' },
};

interface SecaoDef {
  key: SecaoKey;
  titulo: string;
  emoji: string;
  Icon: React.ComponentType<{ className?: string }>;
  builder: (r: any, transcricao?: string | null) => string;
}

function arrText(arr: any): string {
  if (!arr) return '';
  if (Array.isArray(arr)) return arr.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ');
  return String(arr);
}

function objToText(obj: any): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'string' ? v : Array.isArray(v) ? arrText(v) : JSON.stringify(v)}`)
    .join('\n');
}

const SECOES: SecaoDef[] = [
  {
    key: 'soap',
    titulo: 'SOAP',
    emoji: '📝',
    Icon: FileText,
    builder: (r, t) => {
      const s = buildSoapFromVoice(r, t || undefined);
      return `S — SUBJETIVO\n${s.subjectivo}\n\nO — OBJETIVO\n${s.objetivo}\n\nA — AVALIAÇÃO\n${s.avaliacao}\n\nP — PLANO\n${s.plano}`;
    },
  },
  { key: 'resumo_clinico', titulo: 'Resumo Clínico', emoji: '📋', Icon: Stethoscope, builder: (r) => r?.resumo_clinico || '' },
  {
    key: 'dor', titulo: 'Análise da Dor', emoji: '🩹', Icon: HeartPulse,
    builder: (r) => {
      const d = r?.dor; if (!d) return '';
      const lines = [
        d.localizacao && `Localização: ${d.localizacao}`,
        d.intensidade_eva != null && `EVA: ${d.intensidade_eva}/10`,
        d.tipo && `Tipo: ${d.tipo}`,
        d.fatores_agravantes && `Agrava: ${arrText(d.fatores_agravantes)}`,
        (d.fatores_aliviantes || d.fatores_atenuantes) && `Alivia: ${arrText(d.fatores_aliviantes || d.fatores_atenuantes)}`,
      ].filter(Boolean);
      return lines.join('\n');
    },
  },
  { key: 'funcionalidade', titulo: 'Funcionalidade', emoji: '🏃', Icon: Activity, builder: (r) => objToText(r?.funcionalidade) },
  { key: 'psicossocial', titulo: 'Fatores Psicossociais', emoji: '🧠', Icon: Brain, builder: (r) => objToText(r?.fatores_psicossociais || r?.psicossocial) },
  {
    key: 'red_flags', titulo: 'Red Flags', emoji: '🚨', Icon: AlertTriangle,
    builder: (r) => {
      const rf = r?.red_flags || r?.redflags;
      if (!rf || (Array.isArray(rf) && rf.length === 0)) return '';
      if (Array.isArray(rf)) return rf.map((f: any, i: number) => `${i + 1}. ${typeof f === 'string' ? f : f.descricao || f.flag || JSON.stringify(f)}`).join('\n');
      return objToText(rf);
    },
  },
  {
    key: 'hipoteses', titulo: 'Hipóteses Diagnósticas', emoji: '🎯', Icon: Target,
    builder: (r) => {
      const h = r?.hipoteses_diagnosticas;
      if (!Array.isArray(h) || h.length === 0) return '';
      return h.map((x: any, i: number) =>
        `${i + 1}. ${x.diagnostico || x.hipotese || ''}${x.probabilidade ? ` (${x.probabilidade})` : ''}${x.evidencia ? `\n   Evidência: ${x.evidencia}` : ''}`
      ).join('\n');
    },
  },
  {
    key: 'cif', titulo: 'Mapeamento CIF', emoji: '🏷️', Icon: Tags,
    builder: (r) => {
      const c = r?.cif_codes;
      if (!Array.isArray(c) || c.length === 0) return '';
      return c.map((x: any) => `• ${x.codigo || x.code || ''} — ${x.descricao || x.label || x.titulo || ''}${x.severidade != null ? ` (sev ${x.severidade})` : ''}`).join('\n');
    },
  },
  {
    key: 'diretriz', titulo: 'Diretriz de Tratamento', emoji: '🧭', Icon: ListChecks,
    builder: (r) => {
      const d = r?.diretriz_tratamento;
      if (!d || typeof d !== 'object') return '';
      const fases = Object.entries(d);
      if (fases.length === 0) return '';
      const fmtItem = (it: any): string => {
        if (typeof it === 'string') return it;
        if (!it || typeof it !== 'object') return String(it ?? '');
        const nome = it.nome || it.tecnica || it.exercicio || it.titulo || it.name;
        const evid = it.nivel_evidencia ? ` [${it.nivel_evidencia}]` : '';
        const lente = it.lente_clinica ? ` — ${it.lente_clinica}` : '';
        const just = it.justificativa ? `\n        ↳ ${it.justificativa}` : '';
        if (nome) return `${nome}${evid}${lente}${just}`;
        return Object.entries(it).map(([kk, vv]) => `${kk}: ${typeof vv === 'string' ? vv : JSON.stringify(vv)}`).join(' | ');
      };
      return fases.map(([k, v]: [string, any]) => {
        const titulo = k.replace(/_/g, ' ').replace(/\bfase\b/i, 'Fase').replace(/^\w/, (c) => c.toUpperCase());
        const exs = v?.exercicios || v?.exercises;
        const tecs = v?.tecnicas || v?.techniques;
        const parts: string[] = [`▸ ${titulo}`];
        if (v?.objetivo) parts.push(`   Objetivo: ${v.objetivo}`);
        if (v?.frequencia || v?.frequencia_sugerida) parts.push(`   Frequência: ${v.frequencia || v.frequencia_sugerida}`);
        if (Array.isArray(exs) && exs.length) parts.push(`   Exercícios:\n${exs.map((e: any) => `     • ${fmtItem(e)}`).join('\n')}`);
        if (Array.isArray(tecs) && tecs.length) parts.push(`   Técnicas:\n${tecs.map((t: any) => `     • ${fmtItem(t)}`).join('\n')}`);
        if (v?.criterios_progressao || v?.criterios) parts.push(`   Critérios: ${v.criterios_progressao || v.criterios}`);
        return parts.join('\n');
      }).join('\n\n');
    },
  },
];

// ---------- Renderizador estruturado da Diretriz ----------
function DiretrizPretty({ diretriz, accent }: { diretriz: any; accent: Accent }) {
  if (!diretriz || typeof diretriz !== 'object') return null;
  const fases = Object.entries(diretriz);
  if (fases.length === 0) return null;

  const itemNome = (it: any) =>
    typeof it === 'string' ? it : (it?.nome || it?.tecnica || it?.exercicio || it?.titulo || it?.name || '');

  return (
    <div className="space-y-3">
      {fases.map(([k, v]: [string, any], idx) => {
        const titulo = k.replace(/_/g, ' ').replace(/\bfase\b/i, 'Fase').replace(/^\w/, (c) => c.toUpperCase());
        const exs = v?.exercicios || v?.exercises || [];
        const tecs = v?.tecnicas || v?.techniques || [];
        const freq = v?.frequencia || v?.frequencia_sugerida;
        const crit = v?.criterios_progressao || v?.criterios;
        return (
          <div key={k} className="relative rounded-xl border border-border/40 bg-card/60 p-3.5 pl-4">
            <div className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b', accent.ring)} />
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold', accent.iconBg, accent.iconText)}>
                  {idx + 1}
                </span>
                <span className="font-semibold text-sm text-foreground truncate">{titulo}</span>
              </div>
              {freq && (
                <Badge variant="outline" className="text-[10px] font-normal border-border/60">
                  {freq}
                </Badge>
              )}
            </div>
            {v?.objetivo && (
              <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">
                <span className="font-medium text-foreground/70">Objetivo: </span>{v.objetivo}
              </p>
            )}
            {Array.isArray(exs) && exs.length > 0 && (
              <div className="mb-2.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Exercícios</p>
                <div className="flex flex-wrap gap-1.5">
                  {exs.map((e: any, i: number) => {
                    const nome = itemNome(e);
                    const evid = typeof e === 'object' ? e?.nivel_evidencia : null;
                    return (
                      <span key={i} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium', accent.badgeBg, accent.badgeText)}>
                        {nome || `Item ${i + 1}`}
                        {evid && <span className="opacity-60 font-normal">[{evid}]</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {Array.isArray(tecs) && tecs.length > 0 && (
              <div className="mb-2.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Técnicas</p>
                <div className="flex flex-wrap gap-1.5">
                  {tecs.map((t: any, i: number) => {
                    const nome = itemNome(t);
                    return (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-muted text-foreground/75">
                        {nome || `Item ${i + 1}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {crit && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground/70">Critérios de progressão: </span>{crit}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AvaliacaoSecoesEditaveis({ pacienteId, avaliacaoId, resultado, transcricao }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const meta = resultado?._secoes || {};
  const editadasIniciais: Record<string, string> = meta.editadas || {};
  const confirmadasIniciais: SecaoKey[] = Array.isArray(meta.confirmadas) ? meta.confirmadas : [];

  const [textos, setTextos] = useState<Record<SecaoKey, string>>(() => {
    const init = {} as Record<SecaoKey, string>;
    SECOES.forEach((s) => {
      init[s.key] = editadasIniciais[s.key] ?? s.builder(resultado, transcricao);
    });
    return init;
  });
  const [confirmadas, setConfirmadas] = useState<Set<SecaoKey>>(new Set(confirmadasIniciais));
  const [editando, setEditando] = useState<SecaoKey | null>(null);
  const [rascunho, setRascunho] = useState<string>('');
  const [saving, setSaving] = useState<SecaoKey | null>(null);

  const { data: notaExistente } = useQuery({
    queryKey: ['nota-avaliacao-presencial', avaliacaoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('notas_prontuario')
        .select('id')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'avaliacao_presencial')
        .eq('referencia_id', avaliacaoId)
        .maybeSingle();
      return data;
    },
    enabled: !!avaliacaoId && !!pacienteId,
  });

  const secoesDisponiveis = useMemo(
    () => SECOES.filter((s) => textos[s.key]?.trim().length > 0),
    [textos]
  );

  const iniciarEdicao = (key: SecaoKey) => { setRascunho(textos[key] || ''); setEditando(key); };
  const cancelarEdicao = () => { setEditando(null); setRascunho(''); };

  const salvarEdicao = async (key: SecaoKey) => {
    setSaving(key);
    try {
      const novosTextos = { ...textos, [key]: rascunho };
      setTextos(novosTextos);
      const novoResultado = {
        ...resultado,
        _secoes: {
          ...(resultado?._secoes || {}),
          editadas: { ...editadasIniciais, [key]: rascunho },
          confirmadas: Array.from(confirmadas),
        },
      };
      await supabase.from('avaliacoes_voz').update({ resultado: novoResultado }).eq('id', avaliacaoId);
      if (confirmadas.has(key)) await sincronizarProntuario(confirmadas, novosTextos);
      setEditando(null);
      toast({ title: 'Edição salva' });
      qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest', pacienteId] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const toggleConfirmacao = async (key: SecaoKey) => {
    const nova = new Set(confirmadas);
    const estavaConfirmada = nova.has(key);
    if (estavaConfirmada) nova.delete(key); else nova.add(key);
    setSaving(key);
    try {
      setConfirmadas(nova);
      const novoResultado = {
        ...resultado,
        _secoes: {
          ...(resultado?._secoes || {}),
          editadas: editadasIniciais,
          confirmadas: Array.from(nova),
        },
      };
      await supabase.from('avaliacoes_voz').update({ resultado: novoResultado }).eq('id', avaliacaoId);
      await sincronizarProntuario(nova, textos);
      toast({ title: estavaConfirmada ? 'Removida do prontuário' : 'Enviada ao prontuário' });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['prontuario'] });
      qc.invalidateQueries({ queryKey: ['nota-avaliacao-presencial', avaliacaoId] });
    } catch (e: any) {
      setConfirmadas(new Set(estavaConfirmada ? [...confirmadas] : [...confirmadas].filter((k) => k !== key)));
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const sincronizarProntuario = async (setConf: Set<SecaoKey>, textosAtuais: Record<SecaoKey, string>) => {
    if (!user) return;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const incluidas = SECOES.filter((s) => setConf.has(s.key) && textosAtuais[s.key]?.trim());
    if (incluidas.length === 0) {
      if (notaExistente?.id) await (supabase as any).from('notas_prontuario').delete().eq('id', notaExistente.id);
      return;
    }
    const partes: string[] = [`📅 AVALIAÇÃO PRESENCIAL — ${dataAtual}`];
    incluidas.forEach((s) => { partes.push(`\n${s.emoji} ${s.titulo.toUpperCase()}\n${textosAtuais[s.key]}`); });
    const descricao = partes.join('\n');
    const payload = {
      paciente_id: pacienteId,
      terapeuta_id: user.id,
      tipo: 'avaliacao_presencial',
      titulo: `Avaliação Presencial — ${dataAtual}`,
      descricao,
      dados_extras: {
        versao_revisao: 3,
        modo: 'secoes_independentes',
        data_avaliacao: new Date().toISOString(),
        avaliacao_voz_id: avaliacaoId,
        secoes_confirmadas: incluidas.map((s) => s.key),
      },
      referencia_id: avaliacaoId,
    };
    if (notaExistente?.id) {
      await (supabase as any).from('notas_prontuario').update(payload).eq('id', notaExistente.id);
    } else {
      const { data } = await (supabase as any).from('notas_prontuario').insert(payload).select('id').single();
      qc.setQueryData(['nota-avaliacao-presencial', avaliacaoId], data);
    }
  };

  const total = secoesDisponiveis.length;
  const progresso = total > 0 ? Math.round((confirmadas.size / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header com progresso */}
      <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/[0.04] via-card to-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="icon-md" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground leading-tight">Seções da Avaliação</h3>
              <p className="text-caption text-muted-foreground mt-0.5">
                Edite cada parte e confirme as que vão para o prontuário.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground">{confirmadas.size}</span>
              <span className="text-sm text-muted-foreground">/ {total}</span>
            </div>
            <div className="flex-1 sm:w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {secoesDisponiveis.map((s) => {
          const accent = ACCENTS[s.key];
          const confirmada = confirmadas.has(s.key);
          const editandoEsta = editando === s.key;
          const savingEsta = saving === s.key;
          const Icon = s.Icon;
          const isDiretriz = s.key === 'diretriz';

          return (
            <Card
              key={s.key}
              className={cn(
                'relative rounded-2xl border bg-card shadow-xs transition-all duration-300 overflow-hidden',
                confirmada ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-border/50 hover:border-border hover:shadow-md',
                isDiretriz && 'lg:col-span-2'
              )}
            >
              {/* Ribbon de cor no topo */}
              <div className={cn('h-1 w-full bg-gradient-to-r', accent.ring)} />

              {/* Header */}
              <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', accent.iconBg, accent.iconText)}>
                    <Icon className="icon-md" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[15px] text-foreground leading-tight">{s.titulo}</span>
                      {confirmada && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px] gap-1 hover:bg-emerald-500/10 font-medium">
                          <CheckCircle2 className="icon-xs" /> no Prontuário
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {confirmada ? 'Sincronizado' : 'Pendente de confirmação'}
                    </p>
                  </div>
                </div>

                {!editandoEsta && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => iniciarEdicao(s.key)}
                      disabled={savingEsta}
                      title="Editar"
                    >
                      <Pencil className="icon-xs" />
                    </Button>
                    <Button
                      size="sm"
                      variant={confirmada ? 'outline' : 'default'}
                      className={cn(
                        'h-8 px-3 gap-1.5 rounded-lg text-xs font-medium',
                        confirmada && 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800'
                      )}
                      onClick={() => toggleConfirmacao(s.key)}
                      disabled={savingEsta}
                    >
                      {savingEsta ? <Loader2 className="icon-xs animate-spin" /> : confirmada ? <X className="icon-xs" /> : <Check className="icon-xs" />}
                      {confirmada ? 'Remover' : 'Confirmar'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-4 sm:px-5 pb-5">
                {editandoEsta ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Textarea
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      rows={Math.min(24, Math.max(6, rascunho.split('\n').length + 2))}
                      className="text-sm leading-relaxed resize-y min-h-[140px] rounded-xl border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 bg-background"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelarEdicao} disabled={savingEsta} className="rounded-lg h-8">
                        <X className="icon-xs mr-1.5" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => salvarEdicao(s.key)} disabled={savingEsta} className="rounded-lg h-8">
                        {savingEsta ? <Loader2 className="icon-xs animate-spin mr-1.5" /> : <Check className="icon-xs mr-1.5" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    'rounded-xl p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85 border border-border/30',
                    accent.surface
                  )}>
                    {textos[s.key]}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {secoesDisponiveis.length === 0 && (
        <Card className="rounded-2xl border-dashed border-border/50">
          <CardContent className="p-6 text-center text-caption text-muted-foreground">
            Nenhuma seção disponível nesta avaliação.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
