import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pencil, Check, X, CheckCircle2, Loader2,
  FileText, Brain, Activity, HeartPulse, AlertTriangle,
  Target, Tags, ListChecks, Stethoscope, Sparkles, MessageCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createDiretrizSnapshotFromVoz } from '@/lib/protocoloSnapshot';


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
  | 'diretriz'
  | 'insights';

// Seções que NÃO podem ser confirmadas no prontuário (apoio à decisão, referência)
const SECOES_SEM_PRONTUARIO: SecaoKey[] = ['insights', 'hipoteses'];

// Seções agrupadas no mesmo card (renderizadas juntas, confirmadas juntas)
const GRUPO_FUNC_PSI: SecaoKey[] = ['funcionalidade', 'psicossocial'];

// Agrupamento em abas para navegação mobile-first
const TABS_CONFIG = [
  { id: 'clinico',      label: 'Clínico',    keys: ['resumo_clinico'] as SecaoKey[] },
  // "Quadro" e "Diagnóstico" unidos numa aba só.
  { id: 'quadro',       label: 'Quadro/Dx',  keys: ['dor', 'funcionalidade', 'psicossocial', 'red_flags', 'hipoteses', 'cif'] as SecaoKey[] },
  { id: 'tratamento',   label: 'Tratamento', keys: ['diretriz', 'insights'] as SecaoKey[] },
];

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
  insights:       { ring: 'from-fuchsia-400/40 to-fuchsia-500/10', iconBg: 'bg-fuchsia-500/10', iconText: 'text-fuchsia-600', badgeBg: 'bg-fuchsia-500/10', badgeText: 'text-fuchsia-700', surface: 'bg-fuchsia-500/[0.04]' },
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
    key: 'diretriz', titulo: 'Plano de Reabilitação Cinético-Funcional', emoji: '🧭', Icon: ListChecks,
    builder: (r) => {
      const d = r?.diretriz_tratamento;
      if (!d || typeof d !== 'object') return '';

      // Ordem fixa das fases para garantir Fase 1 → 2 → 3
      const FASE_ORDER: Array<{ key: string; label: string }> = [
        { key: 'fase_1_alivio',  label: 'Fase 1 — Alívio & Proteção' },
        { key: 'fase_2_carga',   label: 'Fase 2 — Carga Progressiva' },
        { key: 'fase_3_retorno', label: 'Fase 3 — Retorno Funcional' },
      ];

      const fmtTecnica = (it: any): string => {
        if (typeof it === 'string') return it;
        if (!it || typeof it !== 'object') return String(it ?? '');
        const nome = it.tecnica || it.nome || it.exercicio || it.titulo || it.name || '';
        const evid = it.nivel_evidencia ? ` [${it.nivel_evidencia}]` : '';
        const lente = it.lente_clinica ? ` · ${it.lente_clinica}` : '';
        const dose = it.dosagem ? `\n        💊 ${it.dosagem}` : '';
        const just = it.justificativa ? `\n        ↳ ${it.justificativa}` : '';
        if (nome) return `${nome}${evid}${lente}${dose}${just}`;
        return Object.entries(it).map(([kk, vv]) => `${kk}: ${typeof vv === 'string' ? vv : JSON.stringify(vv)}`).join(' | ');
      };

      const blocosFase: string[] = [];
      FASE_ORDER.forEach(({ key, label }) => {
        const v = (d as any)[key];
        if (!v || typeof v !== 'object') return;
        const parts: string[] = [`▸ ${label}`];
        if (v.duracao_semanas) parts.push(`   ⏱ Duração: ${v.duracao_semanas}`);
        if (Array.isArray(v.objetivos) && v.objetivos.length) {
          parts.push(`   🎯 Objetivos:\n${v.objetivos.map((o: string) => `     • ${o}`).join('\n')}`);
        } else if (v.objetivo) {
          parts.push(`   🎯 Objetivo: ${v.objetivo}`);
        }
        const tecs = v.tecnicas || v.techniques;
        if (Array.isArray(tecs) && tecs.length) {
          parts.push(`   🛠 Técnicas:\n${tecs.map((t: any) => `     • ${fmtTecnica(t)}`).join('\n')}`);
        }
        const crit = v.criterios_progressao || v.criterios;
        if (Array.isArray(crit) && crit.length) {
          parts.push(`   ✅ Critérios de progressão:\n${crit.map((c: string) => `     • ${c}`).join('\n')}`);
        } else if (typeof crit === 'string') {
          parts.push(`   ✅ Critérios de progressão: ${crit}`);
        }
        blocosFase.push(parts.join('\n'));
      });

      // Bloco global no final
      const finais: string[] = [];
      if (d.frequencia_sugerida) finais.push(`📅 Frequência sugerida: ${d.frequencia_sugerida}`);
      if (d.prognostico) finais.push(`🔮 Prognóstico: ${d.prognostico}`);
      if (Array.isArray(d.criterios_alta) && d.criterios_alta.length) {
        finais.push(`🏁 Critérios de alta:\n${d.criterios_alta.map((c: string) => `   • ${c}`).join('\n')}`);
      }
      if (d.manutencao && typeof d.manutencao === 'object') {
        const m = d.manutencao;
        const partsM: string[] = ['🌱 Plano de Manutenção (pós-alta)'];
        if (m.mensagem_paciente) partsM.push(`   💬 ${m.mensagem_paciente}`);
        if (Array.isArray(m.rotina_minima) && m.rotina_minima.length) {
          partsM.push(`   🔁 Rotina mínima:\n${m.rotina_minima.map((c: string) => `     • ${c}`).join('\n')}`);
        }
        if (m.frequencia_reavaliacao) partsM.push(`   📆 Reavaliação: ${m.frequencia_reavaliacao}`);
        if (Array.isArray(m.sinais_para_retornar) && m.sinais_para_retornar.length) {
          partsM.push(`   ⚠️ Voltar ao profissional se:\n${m.sinais_para_retornar.map((c: string) => `     • ${c}`).join('\n')}`);
        }
        if (Array.isArray(m.habitos_chave) && m.habitos_chave.length) {
          partsM.push(`   ✨ Hábitos-chave:\n${m.habitos_chave.map((c: string) => `     • ${c}`).join('\n')}`);
        }
        finais.push(partsM.join('\n'));
      }
      if (Array.isArray(d.referencias_chave) && d.referencias_chave.length) {
        finais.push(`📚 Referências-chave:\n${d.referencias_chave.map((c: string) => `   • ${c}`).join('\n')}`);
      }

      return [blocosFase.join('\n\n'), finais.join('\n\n')].filter(Boolean).join('\n\n');
    },
  },
  {
    key: 'insights', titulo: 'Insights baseados em evidências', emoji: '💡', Icon: Sparkles,
    builder: (r) => {
      const ins = r?.insights_baseados_evidencia;
      if (!Array.isArray(ins) || ins.length === 0) return '';
      return ins.map((i: any, idx: number) => {
        const texto = typeof i === 'string' ? i : (i.insight || i.texto || '');
        const ref = typeof i === 'object' ? (i.referencia || i.fonte) : null;
        return `${idx + 1}. ${texto}${ref ? `\n   📖 ${ref}` : ''}`;
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
// ---------- Diretriz: cada fase com cor própria (1 vermelha, 2 amarela, 3 verde) ----------
const FASE_THEMES = [
  { ring: 'from-red-400/60 to-red-500/10',       chip: 'bg-red-500/10 text-red-700 border-red-500/20',         num: 'bg-red-500/10 text-red-600',         label: 'Fase 1' },
  { ring: 'from-amber-400/60 to-amber-500/10',   chip: 'bg-amber-500/10 text-amber-700 border-amber-500/20',   num: 'bg-amber-500/10 text-amber-600',     label: 'Fase 2' },
  { ring: 'from-emerald-400/60 to-emerald-500/10', chip: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', num: 'bg-emerald-500/10 text-emerald-600', label: 'Fase 3' },
];

function DiretrizFases({ texto }: { texto: string }) {
  if (!texto?.trim()) return null;
  // Separa rodapé global (não começa com ▸) das fases — inclui 🌱 (manutenção)
  const idxPrimeiroRodape = texto.search(/\n(?:📅|🔮|🏁|🌱|📚)/);
  const corpoFases = idxPrimeiroRodape >= 0 ? texto.slice(0, idxPrimeiroRodape) : texto;
  const rodapeFull = idxPrimeiroRodape >= 0 ? texto.slice(idxPrimeiroRodape).trim() : '';

  // Extrai bloco de manutenção (🌱) para renderizar em destaque
  let rodape = rodapeFull;
  let manutencao = '';
  const manutMatch = rodapeFull.match(/🌱[\s\S]*?(?=\n(?:📅|🔮|🏁|📚)|$)/);
  if (manutMatch) {
    manutencao = manutMatch[0].trim();
    rodape = rodapeFull.replace(manutMatch[0], '').trim();
  }

  // Extrai bloco de referências para renderizar separadamente, bem compacto, no final
  let referencias: string[] = [];
  const refMatch = rodape.match(/📚\s*Referências[^:]*:\s*\n?([\s\S]*?)(?=\n(?:📅|🔮|🏁|🌱|📚)|$)/);
  if (refMatch) {
    referencias = refMatch[1]
      .split('\n')
      .map((l) => l.replace(/^\s*[•\-·]\s*/, '').trim())
      .filter(Boolean);
    rodape = rodape.replace(refMatch[0], '').trim();
  }

  const partes = corpoFases.split(/\n?▸\s/).filter((p) => p.trim().length > 0);
  if (partes.length === 0 && !rodape && !manutencao && referencias.length === 0) {
    return (
      <div className="rounded-xl p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85 border border-border/30 bg-emerald-500/[0.04]">
        {texto}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {partes.map((bloco, idx) => {
        const linhas = bloco.split('\n');
        const titulo = linhas[0]?.trim() || `Fase ${idx + 1}`;
        const corpo = linhas.slice(1).join('\n').trim();
        const tema = FASE_THEMES[idx] || FASE_THEMES[FASE_THEMES.length - 1];
        return (
          <div key={idx} className="relative rounded-xl border border-border/40 bg-card/60 p-3.5 pl-4 overflow-hidden">
            <div className={cn('absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b', tema.ring)} />
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold shrink-0', tema.num)}>
                {idx + 1}
              </span>
              <span className="font-semibold text-sm text-foreground truncate">{titulo}</span>
              <span className={cn('ml-auto inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium', tema.chip)}>
                {tema.label}
              </span>
            </div>
            {corpo && (
              <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/80 pl-1">
                {corpo}
              </div>
            )}
          </div>
        );
      })}
      {manutencao && (
        <div className="relative rounded-xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.06] to-teal-500/[0.04] p-3.5 pl-4 overflow-hidden">
          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-emerald-400/70 to-teal-500/30" />
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[13px] bg-emerald-500/15 shrink-0">🌱</span>
            <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Plano de Manutenção</span>
            <span className="ml-auto inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">
              Pós-alta
            </span>
          </div>
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85 pl-1">
            {manutencao.replace(/^🌱[^\n]*\n?/, '').trim()}
          </div>
        </div>
      )}
      {rodape && (
        <div className="rounded-xl border border-border/40 bg-muted/30 p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/80">
          {rodape}
        </div>
      )}
      {referencias.length > 0 && (
        <details className="group rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-[11px] open:bg-muted/30">
          <summary className="flex items-center gap-1.5 cursor-pointer list-none text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-[10px]">📚</span>
            <span className="font-medium uppercase tracking-wider">Referências</span>
            <span className="text-muted-foreground/60">({referencias.length})</span>
            <span className="ml-auto text-[10px] text-muted-foreground/50 group-open:rotate-90 transition-transform">›</span>
          </summary>
          <ol className="mt-2 pl-4 space-y-0.5 list-decimal text-muted-foreground/90 leading-snug">
            {referencias.map((r, i) => (
              <li key={i} className="text-[11px]">{r}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

// ---------- Renderizador estruturado do SOAP ----------
const SOAP_PARTS: Array<{ key: 'S' | 'O' | 'A' | 'P'; label: string; tone: { ring: string; chip: string; surface: string } }> = [
  { key: 'S', label: 'Subjetivo',  tone: { ring: 'bg-sky-500',     chip: 'bg-sky-500/10 text-sky-700 border-sky-500/20',         surface: 'bg-sky-500/[0.04]' } },
  { key: 'O', label: 'Objetivo',   tone: { ring: 'bg-teal-500',    chip: 'bg-teal-500/10 text-teal-700 border-teal-500/20',      surface: 'bg-teal-500/[0.04]' } },
  { key: 'A', label: 'Avaliação',  tone: { ring: 'bg-violet-500',  chip: 'bg-violet-500/10 text-violet-700 border-violet-500/20', surface: 'bg-violet-500/[0.04]' } },
  { key: 'P', label: 'Plano',      tone: { ring: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', surface: 'bg-emerald-500/[0.04]' } },
];

function SoapPretty({ texto }: { texto: string }) {
  if (!texto?.trim()) {
    return <div className="text-xs text-muted-foreground italic px-1">Sem conteúdo SOAP gerado.</div>;
  }
  // Split por marcadores "S —", "O —", "A —", "P —" (com — ou - ou :)
  const re = /(?:^|\n)\s*([SOAP])\s*[—\-:]\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+\s*\n?/g;
  const matches: Array<{ key: 'S'|'O'|'A'|'P'; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    matches.push({ key: m[1] as any, start: m.index + m[0].length, end: -1 });
    if (matches.length > 1) matches[matches.length - 2].end = m.index;
  }
  if (matches.length) matches[matches.length - 1].end = texto.length;

  const conteudo = new Map<string, string>();
  matches.forEach((mm) => {
    conteudo.set(mm.key, texto.slice(mm.start, mm.end).trim());
  });

  // Fallback se parser falhou
  if (conteudo.size === 0) {
    return (
      <div className="rounded-lg px-3 py-2.5 text-[12.5px] leading-snug whitespace-pre-wrap text-foreground/85 border border-border/30 bg-slate-500/[0.04]">
        {texto}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {SOAP_PARTS.map(({ key, label, tone }) => {
        const txt = conteudo.get(key) || '—';
        const vazio = txt === '—' || !txt;
        return <SoapCell key={key} k={key} label={label} tone={tone} txt={txt} vazio={vazio} />;
      })}
    </div>
  );
}

function SoapCell({ k, label, tone, txt, vazio }: { k: string; label: string; tone: any; txt: string; vazio: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 180;
  const tooLong = txt.length > LIMIT;
  const shown = !expanded && tooLong ? txt.slice(0, LIMIT).trimEnd() + '…' : txt;
  return (
    <div
      className={cn(
        'relative rounded-md border border-border/30 pl-2.5 pr-2 py-1.5 overflow-hidden',
        tone.surface
      )}
    >
      <div className={cn('absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full', tone.ring)} />
      <div className="flex items-center gap-1 mb-0.5">
        <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold border', tone.chip)}>
          {k}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/60">{label}</span>
      </div>
      <p className={cn(
        'text-[11.5px] leading-snug whitespace-pre-wrap',
        vazio ? 'text-muted-foreground/50 italic' : 'text-foreground/80'
      )}>
        {shown}
      </p>
      {tooLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[10px] font-medium text-primary/80 hover:text-primary"
        >
          {expanded ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </div>
  );
}


// ---------- Renderizadores estruturados por seção ----------
function Field({ label, value }: { label: string; value: React.ReactNode; accent?: Accent }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground min-w-[80px] pt-0.5 shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-foreground/85 leading-snug flex-1">{value}</span>
    </div>
  );
}

function humanLabel(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function EvaBadge({ valor }: { valor: number }) {
  const tone =
    valor >= 7 ? 'bg-red-500/10 text-red-700 border-red-500/20'
    : valor >= 4 ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
    : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  const label = valor >= 7 ? 'Intensa' : valor >= 4 ? 'Moderada' : 'Leve';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold', tone)}>
      <span className="tabular-nums">{valor}/10</span>
      <span className="opacity-70 font-normal">· {label}</span>
    </span>
  );
}

function DorPretty({ data }: { data: any }) {
  if (!data) return null;
  const ag = data.fatores_agravantes;
  const al = data.fatores_aliviantes || data.fatores_atenuantes;
  return (
    <div className="divide-y divide-border/30">
      {data.localizacao && <Field label="Localização" value={data.localizacao} />}
      {data.intensidade_eva != null && <Field label="EVA" value={<EvaBadge valor={Number(data.intensidade_eva)} />} />}
      {data.tipo && <Field label="Tipo" value={data.tipo} />}
      {data.inicio && <Field label="Início" value={data.inicio} />}
      {data.duracao && <Field label="Duração" value={data.duracao} />}
      {ag && (
        <Field label="Agrava" value={
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(ag) ? ag : [ag]).map((f: any, i: number) => (
              <span key={i} className="inline-flex rounded-md bg-rose-500/10 text-rose-700 px-2 py-0.5 text-[11px]">{String(f)}</span>
            ))}
          </div>
        } />
      )}
      {al && (
        <Field label="Alivia" value={
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(al) ? al : [al]).map((f: any, i: number) => (
              <span key={i} className="inline-flex rounded-md bg-emerald-500/10 text-emerald-700 px-2 py-0.5 text-[11px]">{String(f)}</span>
            ))}
          </div>
        } />
      )}
    </div>
  );
}

function ObjPretty({ data }: { data: any }) {
  if (!data) return null;
  if (typeof data === 'string') return <p className="text-[13px] leading-relaxed text-foreground/85">{data}</p>;
  if (Array.isArray(data)) {
    return (
      <ul className="space-y-1.5 text-[13px] text-foreground/85">
        {data.map((x: any, i: number) => (
          <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{typeof x === 'string' ? x : JSON.stringify(x)}</span></li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div className="divide-y divide-border/30">
      {entries.map(([k, v]) => (
        <Field
          key={k}
          label={humanLabel(k)}
          value={
            Array.isArray(v)
              ? <div className="flex flex-wrap gap-1">{v.map((x: any, i: number) => (
                  <span key={i} className="inline-flex rounded-md bg-muted text-foreground/80 px-2 py-0.5 text-[11px]">{typeof x === 'string' ? x : JSON.stringify(x)}</span>
                ))}</div>
              : typeof v === 'object'
                ? <span className="text-foreground/80">{Object.entries(v as any).map(([kk, vv]) => `${humanLabel(kk)}: ${vv}`).join(' · ')}</span>
                : String(v)
          }
        />
      ))}
    </div>
  );
}

function RedFlagsPretty({ data }: { data: any }) {
  const lista = Array.isArray(data) ? data : (data ? [data] : []);
  if (lista.length === 0) return null;
  return (
    <ul className="space-y-2">
      {lista.map((f: any, i: number) => {
        const txt = typeof f === 'string' ? f : (f.descricao || f.flag || JSON.stringify(f));
        return (
          <li key={i} className="flex items-start gap-2.5 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-red-500/15 text-red-700 text-[10px] font-bold shrink-0">{i + 1}</span>
            <span className="text-[13px] text-foreground/85 leading-relaxed">{txt}</span>
          </li>
        );
      })}
    </ul>
  );
}

function HipotesesPretty({ data }: { data: any }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const tone = (p?: string) => {
    const s = (p || '').toLowerCase();
    if (s.includes('alt')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    if (s.includes('méd') || s.includes('med') || s.includes('mod')) return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
    if (s.includes('baix')) return 'bg-muted text-muted-foreground border-border';
    return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  };
  return (
    <div className="space-y-2">
      {data.map((x: any, i: number) => (
        <div key={i} className="rounded-lg border border-border/40 bg-card/60 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/10 text-amber-700 text-[10px] font-bold shrink-0">{i + 1}</span>
              <span className="font-semibold text-[13px] text-foreground truncate">{x.diagnostico || x.hipotese || '—'}</span>
            </div>
            {x.probabilidade && (
              <span className={cn('shrink-0 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium', tone(x.probabilidade))}>
                {x.probabilidade}
              </span>
            )}
          </div>
          {x.evidencia && (
            <p className="text-[12px] text-muted-foreground leading-relaxed pl-7">
              <span className="font-medium text-foreground/60">Evidência: </span>{x.evidencia}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function CifPretty({ data }: { data: any }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const sevTone = (n?: number) => {
    if (n == null) return '';
    if (n >= 3) return 'text-red-600';
    if (n >= 2) return 'text-amber-600';
    if (n >= 1) return 'text-sky-600';
    return 'text-emerald-600';
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.map((x: any, i: number) => {
        const codigo = x.codigo || x.code || '';
        const desc = x.descricao || x.label || x.titulo || '';
        const sev = x.severidade;
        return (
          <span
            key={i}
            title={desc}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] px-2.5 py-1 text-[11px]"
          >
            <span className="font-mono font-bold text-indigo-700">{codigo}</span>
            <span className="text-foreground/70 max-w-[120px] truncate">{desc}</span>
            {sev != null && <span className={cn('font-semibold opacity-70', sevTone(Number(sev)))}>{sev}</span>}
          </span>
        );
      })}
    </div>
  );
}

function InsightsPretty({ data }: { data: any }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <div className="space-y-2">
      {data.map((i: any, idx: number) => {
        const texto = typeof i === 'string' ? i : (i.insight || i.texto || '');
        const ref = typeof i === 'object' ? (i.referencia || i.fonte) : null;
        return (
          <div key={idx} className="rounded-lg border border-fuchsia-500/15 bg-fuchsia-500/[0.04] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-fuchsia-500/15 text-fuchsia-700 text-[10px] font-bold shrink-0">{idx + 1}</span>
              <p className="text-[13px] text-foreground/85 leading-relaxed flex-1">{texto}</p>
            </div>
            {ref && <p className="text-[11px] text-muted-foreground mt-1.5 pl-7">📖 {ref}</p>}
          </div>
        );
      })}
    </div>
  );
}

function InsightsCompact({ data }: { data: any }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  const texto = typeof first === 'string' ? first : (first.insight || first.texto || '');
  return (
    <div className="space-y-2">
      <span className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium',
        'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/20'
      )}>
        💡 {data.length} {data.length === 1 ? 'insight' : 'insights'} baseados em evidências
      </span>
      <p className="text-[13px] text-foreground/80 leading-relaxed line-clamp-2">{texto}</p>
      {data.length > 1 && (
        <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
          <ListChecks className="h-3 w-3 shrink-0" />
          {data.length - 1} insight{data.length - 1 > 1 ? 's' : ''} adicionais disponíveis
        </p>
      )}
    </div>
  );
}

function ResumoPretty({ texto }: { texto: string }) {
  if (!texto?.trim()) return null;
  return <p className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap">{texto}</p>;
}

// Cartão-resumo panorâmico da aba Clínico: severidade (num relance) + a
// narrativa do resumo. NÃO repete red flags (aba Quadro/Dx) nem plano (aba
// Tratamento) — cada dado num lugar só.
function ResumoSoapCard({ texto, severidade }: { texto: string; severidade?: string | null }) {
  const temTexto = !!texto?.trim();
  if (!temTexto && !severidade) return null;
  return (
    <div className="relative rounded-lg border border-border/30 px-3 py-2.5 sm:px-3.5 sm:py-3 bg-sky-500/[0.04] pl-4 space-y-2">
      <div className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full bg-sky-400/60" />
      {severidade && (
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300">
          {severidade}
        </span>
      )}
      {temTexto && (
        <p className="text-[12.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap">{texto}</p>
      )}
    </div>
  );
}

// ---------- Diretriz compacta — cards por fase com layout igual à aba Diretrizes, porém resumidos ----------
const FASES_COMPACTO = [
  { key: 'fase_1_alivio',  label: 'Fase 1 — Alívio & Proteção',    chipLabel: 'Fase 1',      chip: 'bg-red-500/10 text-red-700 border-red-500/20',             num: 'bg-red-500/10 text-red-600',             ring: 'from-red-400/60 to-red-500/10' },
  { key: 'fase_2_carga',   label: 'Fase 2 — Carga Progressiva',     chipLabel: 'Fase 2',      chip: 'bg-amber-500/10 text-amber-700 border-amber-500/20',       num: 'bg-amber-500/10 text-amber-600',         ring: 'from-amber-400/60 to-amber-500/10' },
  { key: 'fase_3_retorno', label: 'Fase 3 — Retorno Funcional',     chipLabel: 'Fase 3',      chip: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', num: 'bg-emerald-500/10 text-emerald-600',     ring: 'from-emerald-400/60 to-emerald-500/10' },
  { key: 'fase_4_manutencao', label: 'Fase 4 — Pós-Reabilitação',  chipLabel: 'Manutenção',  chip: 'bg-violet-500/10 text-violet-700 border-violet-500/20',    num: 'bg-violet-500/10 text-violet-600',       ring: 'from-violet-400/60 to-violet-500/10' },
];

function DiretrizCompact({ diretriz }: { diretriz: any }) {
  if (!diretriz || typeof diretriz !== 'object') return null;

  const fases = FASES_COMPACTO.map(f => ({ ...f, data: diretriz[f.key] })).filter(f => f.data);
  // Também aceita fase_4 vindo como campo separado 'manutencao'
  const manut = diretriz.manutencao && typeof diretriz.manutencao === 'object' ? diretriz.manutencao : null;
  if (fases.length === 0 && !manut) return null;

  const nomeTec = (it: any) =>
    typeof it === 'string' ? it : (it?.nome || it?.tecnica || it?.exercicio || it?.titulo || '');
  const textoObj = (o: any) =>
    typeof o === 'string' ? o : (o?.descricao || o?.objetivo || o?.text || '');
  const textoCrit = (c: any) =>
    typeof c === 'string' ? c : (c?.criterio || c?.descricao || '');

  return (
    <div className="space-y-2">
      {fases.map((f, idx) => {
        const v = f.data;
        const dur: string | undefined = v?.duracao_semanas;
        const objs: any[] = Array.isArray(v?.objetivos) ? v.objetivos : [];
        const tecs: any[] = Array.isArray(v?.tecnicas) ? v.tecnicas : (Array.isArray(v?.exercicios) ? v.exercicios : []);
        const crit: any[] = Array.isArray(v?.criterios_progressao) ? v.criterios_progressao
          : v?.criterios_progressao ? [v.criterios_progressao] : [];

        return (
          <div key={f.key} className="relative rounded-xl border border-border/40 bg-card/60 p-3 pl-3.5">
            <div className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b', f.ring)} />

            {/* Cabeçalho: número + nome + chip de fase */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0', f.num)}>
                  {idx + 1}
                </span>
                <span className="font-semibold text-[13px] text-foreground truncate">{f.label}</span>
              </div>
              <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium shrink-0', f.chip)}>
                {f.chipLabel}
              </span>
            </div>

            {/* Duração */}
            {dur && <p className="text-[11px] text-muted-foreground mb-2">⏱️ {dur}</p>}

            {/* Objetivos — até 4 linhas */}
            {objs.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">🎯 Objetivos</p>
                <ul className="space-y-0.5">
                  {objs.slice(0, 4).map((o, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] text-foreground/80">
                      <span className="shrink-0">•</span>
                      <span className="line-clamp-1">{textoObj(o)}</span>
                    </li>
                  ))}
                  {objs.length > 4 && (
                    <li className="text-[11px] text-muted-foreground/60 pl-3">+{objs.length - 4} objetivos</li>
                  )}
                </ul>
              </div>
            )}

            {/* Técnicas — chips com nome, até 5 */}
            {tecs.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">🔧 Técnicas</p>
                <div className="flex flex-wrap gap-1">
                  {tecs.slice(0, 5).map((t, i) => (
                    <span key={i} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/75">
                      {nomeTec(t) || `Técnica ${i + 1}`}
                    </span>
                  ))}
                  {tecs.length > 5 && (
                    <span className="text-[11px] text-muted-foreground/60 self-center">+{tecs.length - 5}</span>
                  )}
                </div>
              </div>
            )}

            {/* Critérios de progressão — até 2 linhas */}
            {crit.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">✅ Progressão</p>
                {crit.slice(0, 2).map((c, i) => (
                  <p key={i} className="text-[11px] text-foreground/75 line-clamp-1">• {textoCrit(c)}</p>
                ))}
                {crit.length > 2 && (
                  <p className="text-[11px] text-muted-foreground/60">+{crit.length - 2} critérios</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Fase Manutenção — vinda do campo 'manutencao' (quando não está em fase_4_manutencao) */}
      {manut && !diretriz.fase_4_manutencao && (
        <div className="relative rounded-xl border border-border/40 bg-card/60 p-3 pl-3.5">
          <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-violet-400/60 to-violet-500/10" />

          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 bg-violet-500/10 text-violet-600">
                {fases.length + 1}
              </span>
              <span className="font-semibold text-[13px] text-foreground truncate">Pós-Reabilitação & Manutenção</span>
            </div>
            <span className="inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium shrink-0 bg-violet-500/10 text-violet-700 border-violet-500/20">
              Manutenção
            </span>
          </div>

          {manut.frequencia_reavaliacao && (
            <p className="text-[11px] text-muted-foreground mb-2">⏱️ {String(manut.frequencia_reavaliacao)}</p>
          )}

          {manut.mensagem_paciente && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">🎯 Orientação</p>
              <p className="text-[12px] text-foreground/80 line-clamp-2">{String(manut.mensagem_paciente)}</p>
            </div>
          )}

          {Array.isArray(manut.rotina_minima) && manut.rotina_minima.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">🔧 Rotina mínima</p>
              <div className="flex flex-wrap gap-1">
                {(manut.rotina_minima as string[]).slice(0, 4).map((r: string, i: number) => (
                  <span key={i} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/75 max-w-[200px] truncate">
                    {r}
                  </span>
                ))}
                {manut.rotina_minima.length > 4 && (
                  <span className="text-[11px] text-muted-foreground/60 self-center">+{manut.rotina_minima.length - 4}</span>
                )}
              </div>
            </div>
          )}

          {Array.isArray(manut.sinais_para_retornar) && manut.sinais_para_retornar.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">⚠️ Retornar ao profissional</p>
              {(manut.sinais_para_retornar as string[]).slice(0, 2).map((s: string, i: number) => (
                <p key={i} className="text-[11px] text-foreground/75 line-clamp-1">• {s}</p>
              ))}
              {manut.sinais_para_retornar.length > 2 && (
                <p className="text-[11px] text-muted-foreground/60">+{manut.sinais_para_retornar.length - 2} sinais</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Frequência e prognóstico globais */}
      {(diretriz.frequencia_sugerida || diretriz.prognostico) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground px-1 pt-0.5">
          {diretriz.frequencia_sugerida && <span>📅 {diretriz.frequencia_sugerida}</span>}
          {diretriz.prognostico && <span className="line-clamp-1 max-w-[260px]">🔮 {diretriz.prognostico}</span>}
        </div>
      )}
    </div>
  );
}

export default function AvaliacaoSecoesEditaveis({ pacienteId, avaliacaoId, resultado, transcricao }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();


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
  const [confirmadas, setConfirmadas] = useState<Set<SecaoKey>>(() => {
    if (confirmadasIniciais.length > 0) return new Set(confirmadasIniciais);
    // Primeira abertura: pré-seleciona todas as seções confirmáveis que têm conteúdo
    return new Set(
      SECOES
        .filter(s => !SECOES_SEM_PRONTUARIO.includes(s.key))
        .filter(s => (editadasIniciais[s.key] ?? s.builder(resultado, transcricao)).trim().length > 0)
        .map(s => s.key)
    );
  });
  const [editando, setEditando] = useState<SecaoKey | null>(null);
  const [rascunho, setRascunho] = useState<string>('');
  const [saving, setSaving] = useState<SecaoKey | null>(null);

  // `textos`/`confirmadas` só são inicializados na primeira renderização (useState lazy init).
  // Sem isto, quando a avaliação é reprocessada (ex.: "Complementar com áudio ou texto") e o
  // componente recebe um `resultado` novo via prop, a tela continua mostrando o resumo antigo
  // até a página ser recarregada — re-sincroniza sempre que a avaliação for resalva.
  // Se é primeira abertura (nenhuma seção confirmada no DB), persiste a pré-seleção automática
  const autoConfirmadoRef = useRef(false);
  useEffect(() => {
    if (autoConfirmadoRef.current) return;
    if (confirmadasIniciais.length > 0) { autoConfirmadoRef.current = true; return; }
    if (confirmadas.size === 0) { autoConfirmadoRef.current = true; return; }
    autoConfirmadoRef.current = true;
    const novoResultado = {
      ...resultado,
      _secoes: { ...(resultado?._secoes || {}), editadas: editadasIniciais, confirmadas: Array.from(confirmadas) },
    };
    supabase.from('avaliacoes_voz').update({ resultado: novoResultado }).eq('id', avaliacaoId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ultimoSavedAtRef = useRef(resultado?._meta?.savedAt);
  useEffect(() => {
    const savedAt = resultado?._meta?.savedAt;
    if (savedAt === ultimoSavedAtRef.current) return;
    ultimoSavedAtRef.current = savedAt;
    const metaAtual = resultado?._secoes || {};
    const editadasAtuais: Record<string, string> = metaAtual.editadas || {};
    const confirmadasAtuais: SecaoKey[] = Array.isArray(metaAtual.confirmadas) ? metaAtual.confirmadas : [];
    const novosTextos = {} as Record<SecaoKey, string>;
    SECOES.forEach((s) => {
      novosTextos[s.key] = editadasAtuais[s.key] ?? s.builder(resultado, transcricao);
    });
    setTextos(novosTextos);
    setConfirmadas(new Set(confirmadasAtuais));
  }, [resultado, transcricao]);

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

  const { data: pacienteInfo } = useQuery({
    queryKey: ['paciente-phone', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('nome, sobrenome, telefone')
        .eq('id', pacienteId)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
    staleTime: 60_000,
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

  const criarOuRecuperarProtocoloDaDiretriz = async (): Promise<string | null> => {
    if (!user) return null;
    const existenteId = resultado?._secoes?.diretriz_protocolo_id;
    if (existenteId) {
      const { data: jaExiste } = await (supabase as any)
        .from('protocolos').select('id').eq('id', existenteId).maybeSingle();
      if (jaExiste?.id) return jaExiste.id;
    }

    const diretriz = resultado?.diretriz_tratamento;
    if (!diretriz) return null;

    const queixa = resultado?.queixa_principal || 'Avaliação presencial';
    const classif = resultado?.classificacao_severidade || 'N/I';
    const origemDiretriz = 'ia_voz';

    const tituloProtocolo = `Diretriz — ${queixa}`;

    const { data: existentePorTitulo } = await (supabase as any)
      .from('protocolos')
      .select('id')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', user.id)
      .eq('origem', origemDiretriz)
      .eq('titulo', tituloProtocolo)
      .maybeSingle();
    if (existentePorTitulo?.id) return existentePorTitulo.id;

    const diretrizSnapshot = createDiretrizSnapshotFromVoz(diretriz, {
      origem: origemDiretriz,
      textoConfirmado: textos.diretriz,
    });
    if (!diretrizSnapshot) return null;

    const { data: prot, error: protErr } = await (supabase as any)
      .from('protocolos')
      .insert({
        terapeuta_id: user.id,
        paciente_id: pacienteId,
        titulo: tituloProtocolo,
        descricao: resultado?.resumo_clinico || null,
        objetivo_geral: `Plano clínico em 3 fases para "${queixa}" — gerado a partir da avaliação (${classif}).`,
        duracao_total: '12 semanas',
        frequencia: diretriz.frequencia_sugerida || '2-3x por semana',
        status: 'ativo',
        origem: origemDiretriz,
        scores_avaliacao: {
          origem: origemDiretriz,
          classificacao: classif,
          queixa_principal: queixa,
          prognostico: diretriz.prognostico || null,
          criterios_alta: diretriz.criterios_alta || [],
          diretriz_snapshot: diretrizSnapshot,
        },
      })
      .select('id').single();
    if (protErr) throw protErr;

    const fasesPayload = diretrizSnapshot.fases.map((fase) => ({
      protocolo_id: prot.id,
      numero_fase: fase.numero,
      titulo: fase.titulo,
      semanas_inicio: fase.semanas_inicio,
      semanas_fim: fase.semanas_fim,
      objetivos: [fase.objetivo, ...fase.demandasAlvo, ...(fase.criteriosProgressao || [])].filter(Boolean),
      sessoes_por_semana: 2,
    }));
    await (supabase as any).from('protocolo_fases').insert(fasesPayload);

    return prot.id as string;
  };

  const toggleConfirmacao = async (key: SecaoKey) => {
    const nova = new Set(confirmadas);
    const estavaConfirmada = nova.has(key);
    const diretrizConfirmadaSemProtocolo = key === 'diretriz' && estavaConfirmada && !resultado?._secoes?.diretriz_protocolo_id;
    if (estavaConfirmada && !diretrizConfirmadaSemProtocolo) nova.delete(key); else nova.add(key);
    setSaving(key);
    try {
      setConfirmadas(nova);

      // Caso especial: confirmar a Diretriz → cria protocolo e navega para a aba Diretrizes
      let protocoloIdCriado: string | null = resultado?._secoes?.diretriz_protocolo_id || null;
      if (key === 'diretriz' && (!estavaConfirmada || diretrizConfirmadaSemProtocolo)) {
        protocoloIdCriado = await criarOuRecuperarProtocoloDaDiretriz();
      }

      const novoResultado = {
        ...resultado,
        _secoes: {
          ...(resultado?._secoes || {}),
          editadas: editadasIniciais,
          confirmadas: Array.from(nova),
          ...(protocoloIdCriado ? { diretriz_protocolo_id: protocoloIdCriado } : {}),
        },
      };
      await supabase.from('avaliacoes_voz').update({ resultado: novoResultado }).eq('id', avaliacaoId);
      await sincronizarProntuario(nova, textos);

      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['prontuario'] });
      qc.invalidateQueries({ queryKey: ['nota-avaliacao-presencial', avaliacaoId] });
      qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });

      if (key === 'diretriz' && (!estavaConfirmada || diretrizConfirmadaSemProtocolo) && protocoloIdCriado) {
        toast({
          title: '✅ Diretriz enviada para a aba Diretrizes',
          description: 'Abra a aba "Diretrizes" para refinar com opções baseadas em evidências.',
        });
      } else {
        toast({ title: estavaConfirmada ? 'Removida do prontuário' : 'Enviada ao prontuário' });
      }

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

  // Seções que podem ser confirmadas (excluindo as de apoio)
  const secoesConfirmaveis = secoesDisponiveis.filter((s) => !SECOES_SEM_PRONTUARIO.includes(s.key));
  const todasConfirmadas = secoesConfirmaveis.length > 0 && secoesConfirmaveis.every((s) => confirmadas.has(s.key));

  const total = secoesConfirmaveis.length;
  const progresso = total > 0 ? Math.round((confirmadas.size / total) * 100) : 0;

  const confirmarTodas = async () => {
    const pendentes = secoesConfirmaveis.filter((s) => !confirmadas.has(s.key));
    if (pendentes.length === 0) return;
    for (const s of pendentes) {
      await toggleConfirmacao(s.key);
    }
  };

  return (
    <div className="space-y-5">
      {/* Abas de navegação + Grid de cards */}
      {(() => {
        const renderCards = (secoesParaRenderizar: SecaoDef[]) => {
          const rendered = new Set<SecaoKey>();
          const cards: React.ReactNode[] = [];
          secoesParaRenderizar.forEach((s) => {
            if (rendered.has(s.key)) return;

            // Card agrupado: Funcionalidade + Psicossocial
            if (s.key === 'funcionalidade' || s.key === 'psicossocial') {
              const sFunc = secoesDisponiveis.find((x) => x.key === 'funcionalidade');
              const sPsi = secoesDisponiveis.find((x) => x.key === 'psicossocial');
              if (!rendered.has('funcionalidade') && (sFunc || sPsi)) {
                rendered.add('funcionalidade');
                rendered.add('psicossocial');
                const accentF = ACCENTS['funcionalidade'];
                const confirmadaF = confirmadas.has('funcionalidade');
                const confirmadaP = confirmadas.has('psicossocial');
                const savingF = saving === 'funcionalidade' || saving === 'psicossocial';
                const sDefFunc = SECOES.find((x) => x.key === 'funcionalidade')!;
                const sDefPsi = SECOES.find((x) => x.key === 'psicossocial')!;
                const funcEditada = sFunc && textos['funcionalidade'] !== sDefFunc.builder(resultado, transcricao);
                const psiEditada = sPsi && textos['psicossocial'] !== sDefPsi.builder(resultado, transcricao);
                cards.push(
                  <Card
                    key="func-psi"
                    className={cn(
                      'relative rounded-2xl border bg-card shadow-xs transition-all duration-300 overflow-hidden',
                      (confirmadaF && confirmadaP) ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-border/50 hover:border-border hover:shadow-md',
                    )}
                  >
                    <div className={cn('h-1 w-full bg-gradient-to-r', accentF.ring)} />
                    <div className="px-3 sm:px-3.5 pt-2.5 pb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', accentF.iconBg, accentF.iconText)}>
                          <Activity className="icon-sm" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-[13px] text-foreground leading-tight">Estado Funcional</span>
                            {(confirmadaF || confirmadaP) && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[9px] gap-0.5 hover:bg-emerald-500/10 font-normal py-0 px-1.5">
                                <CheckCircle2 className="icon-xs" /> Prontuário
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {(confirmadaF || confirmadaP) ? 'Sincronizado' : 'Pendente'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {savingF ? (
                          <Loader2 className="icon-xs animate-spin text-muted-foreground mx-1" />
                        ) : (confirmadaF && confirmadaP) ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (sFunc) await toggleConfirmacao('funcionalidade');
                              if (sPsi) await toggleConfirmacao('psicossocial');
                            }}
                            title="Remover do prontuário"
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/25 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="icon-xs" />
                          </button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 gap-1 rounded-md text-[11px] font-medium"
                            onClick={async () => {
                              if (sFunc) await toggleConfirmacao('funcionalidade');
                              if (sPsi) await toggleConfirmacao('psicossocial');
                            }}
                            disabled={savingF}
                          >
                            <Check className="icon-xs" /> Adicionar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="px-3 sm:px-3.5 pb-3 sm:pb-3.5 space-y-3">
                      {sFunc && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Funcionalidade</p>
                          <div className={cn('rounded-lg border border-border/30 px-3 py-2.5', accentF.surface)}>
                            {funcEditada
                              ? <p className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap">{textos['funcionalidade']}</p>
                              : <ObjPretty data={resultado?.funcionalidade} />}
                          </div>
                        </div>
                      )}
                      {sPsi && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Fatores Psicossociais</p>
                          <div className={cn('rounded-lg border border-border/30 px-3 py-2.5', ACCENTS['psicossocial'].surface)}>
                            {psiEditada
                              ? <p className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap">{textos['psicossocial']}</p>
                              : <ObjPretty data={resultado?.fatores_psicossociais || resultado?.psicossocial} />}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              }
              return;
            }

            // Card normal
            const accent = ACCENTS[s.key];
            const confirmada = confirmadas.has(s.key);
            const editandoEsta = editando === s.key;
            const savingEsta = saving === s.key;
            const Icon = s.Icon;
            const isDiretriz = s.key === 'diretriz';
            const semProntuario = SECOES_SEM_PRONTUARIO.includes(s.key);
            const diretrizPendenteEnvio = isDiretriz && confirmada && !resultado?._secoes?.diretriz_protocolo_id;
            const textoOriginal = s.builder(resultado, transcricao);
            const editadoManualmente = textos[s.key] !== textoOriginal;
            rendered.add(s.key);

            cards.push(
              <Card
                key={s.key}
                className={cn(
                  'relative rounded-2xl border bg-card shadow-xs transition-all duration-300 overflow-hidden',
                  confirmada ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-border/50 hover:border-border hover:shadow-md',
                  isDiretriz && 'lg:col-span-2'
                )}
              >
                <div className={cn('h-1 w-full bg-gradient-to-r', accent.ring)} />
                <div className="px-3 sm:px-3.5 pt-2.5 pb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', accent.iconBg, accent.iconText)}>
                      <Icon className="icon-sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-[13px] text-foreground leading-tight">{s.titulo}</span>
                        {semProntuario ? (
                          <Badge variant="outline" className="text-[9px] gap-0.5 font-normal border-border/60 text-muted-foreground py-0 px-1.5">
                            Apoio
                          </Badge>
                        ) : confirmada && (
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[9px] gap-0.5 hover:bg-emerald-500/10 font-normal py-0 px-1.5">
                            <CheckCircle2 className="icon-xs" /> Prontuário
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {semProntuario ? 'Não vai para o prontuário' : (diretrizPendenteEnvio ? 'Pendente na aba Diretrizes' : (confirmada ? 'Sincronizado' : 'Pendente'))}
                      </p>
                    </div>
                  </div>

                  {!editandoEsta && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                        onClick={() => iniciarEdicao(s.key)}
                        disabled={savingEsta}
                        title="Editar texto"
                      >
                        <Pencil className="icon-xs" />
                      </Button>
                      {!semProntuario && (
                        savingEsta ? (
                          <Loader2 className="icon-xs animate-spin text-muted-foreground mx-1" />
                        ) : diretrizPendenteEnvio ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 gap-1 rounded-md text-[11px] font-medium"
                            onClick={() => toggleConfirmacao(s.key)}
                          >
                            <Check className="icon-xs" /> Enviar
                          </Button>
                        ) : confirmada ? (
                          <button
                            type="button"
                            onClick={() => toggleConfirmacao(s.key)}
                            title="Remover do prontuário"
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/25 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="icon-xs" />
                          </button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 gap-1 rounded-md text-[11px] font-medium"
                            onClick={() => toggleConfirmacao(s.key)}
                          >
                            <Check className="icon-xs" /> Adicionar
                          </Button>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="px-3 sm:px-3.5 pb-3 sm:pb-3.5">
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
                    <SectionCollapse>
                      {s.key === 'diretriz' ? (
                        editadoManualmente
                          ? <DiretrizFases texto={textos[s.key]} />
                          : <DiretrizCompact diretriz={resultado?.diretriz_tratamento} />
                      ) : s.key === 'resumo_clinico' ? (
                        <ResumoSoapCard texto={textos[s.key]} severidade={resultado?.classificacao_severidade} />
                      ) : (
                        <div className={cn('rounded-lg border border-border/30 px-3 py-2.5 sm:px-3.5 sm:py-3', accent.surface)}>
                          {s.key === 'dor' ? (
                            editadoManualmente
                              ? <ResumoPretty texto={textos[s.key]} />
                              : <DorPretty data={resultado?.dor} />
                          ) : s.key === 'red_flags' ? (
                            editadoManualmente
                              ? <ResumoPretty texto={textos[s.key]} />
                              : <RedFlagsPretty data={resultado?.red_flags || resultado?.redflags} />
                          ) : s.key === 'hipoteses' ? (
                            editadoManualmente
                              ? <ResumoPretty texto={textos[s.key]} />
                              : <HipotesesPretty data={resultado?.hipoteses_diagnosticas} />
                          ) : s.key === 'cif' ? (
                            editadoManualmente
                              ? <ResumoPretty texto={textos[s.key]} />
                              : <CifPretty data={resultado?.cif_codes} />
                          ) : s.key === 'insights' ? (
                            editadoManualmente
                              ? <ResumoPretty texto={textos[s.key]} />
                              : <InsightsCompact data={resultado?.insights_baseados_evidencia} />
                          ) : (
                            <p className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap">{textos[s.key]}</p>
                          )}
                        </div>
                      )}
                    </SectionCollapse>
                  )}
                </div>
              </Card>
            );
          });

            return cards;
          };

          if (secoesDisponiveis.length === 0) {
            return (
              <Card className="rounded-2xl border-dashed border-border/50">
                <CardContent className="p-6 text-center text-caption text-muted-foreground">
                  Nenhuma seção disponível nesta avaliação.
                </CardContent>
              </Card>
            );
          }

          return (
            <Tabs defaultValue="clinico" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-9 mb-2.5">
                {TABS_CONFIG.map(tab => {
                  const count = secoesDisponiveis.filter(s => tab.keys.includes(s.key)).length;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="text-[11px] sm:text-xs gap-1 px-1 sm:px-2">
                      {tab.label}
                      {count > 0 && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0 tabular-nums">{count}</span>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {TABS_CONFIG.map(tab => {
                const secoesTab = secoesDisponiveis.filter(s => tab.keys.includes(s.key));
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {secoesTab.length === 0 ? (
                      <Card className="rounded-2xl border-dashed border-border/50">
                        <CardContent className="p-6 text-center text-caption text-muted-foreground">
                          Nenhuma seção nesta aba.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                        {renderCards(secoesTab)}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          );
        })()}
    </div>
  );
}

// ---------- Collapse: encurta a janela do card e mostra "Ver mais" ----------
function SectionCollapse({ children, alwaysOpen = false, collapsedHeight = 132 }: { children: React.ReactNode; alwaysOpen?: boolean; collapsedHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(alwaysOpen);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    if (alwaysOpen) return;
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > collapsedHeight + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [alwaysOpen, collapsedHeight, children]);

  if (alwaysOpen) return <>{children}</>;

  return (
    <div className="relative">
      <div
        ref={ref}
        style={{ maxHeight: expanded ? undefined : collapsedHeight }}
        className={cn('overflow-hidden transition-[max-height] duration-300', !expanded && overflowing && 'mask-fade-bottom')}
      >
        {children}
      </div>
      {!expanded && overflowing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent rounded-b-lg" />
      )}
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary/80 hover:text-primary"
        >
          <ChevronDown className={cn('icon-xs transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}

