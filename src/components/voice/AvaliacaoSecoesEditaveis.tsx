import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  | 'diretriz'
  | 'insights';

// Seções que NÃO podem ser confirmadas no prontuário (apoio à decisão, referência)
const SECOES_SEM_PRONTUARIO: SecaoKey[] = ['insights', 'hipoteses'];

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
    if (n == null) return 'bg-muted text-muted-foreground';
    if (n >= 3) return 'bg-red-500/10 text-red-700';
    if (n >= 2) return 'bg-amber-500/10 text-amber-700';
    if (n >= 1) return 'bg-sky-500/10 text-sky-700';
    return 'bg-emerald-500/10 text-emerald-700';
  };
  return (
    <ul className="space-y-1.5">
      {data.map((x: any, i: number) => {
        const codigo = x.codigo || x.code || '';
        const desc = x.descricao || x.label || x.titulo || '';
        const sev = x.severidade;
        return (
          <li key={i} className="flex items-start gap-2 rounded-lg border border-border/30 bg-indigo-500/[0.03] px-3 py-2">
            <span className="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-700 px-1.5 py-0.5 text-[11px] font-mono font-bold shrink-0">{codigo}</span>
            <span className="text-[13px] text-foreground/85 leading-snug flex-1">{desc}</span>
            {sev != null && (
              <span className={cn('shrink-0 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold', sevTone(Number(sev)))}>
                sev {sev}
              </span>
            )}
          </li>
        );
      })}
    </ul>
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

function ResumoPretty({ texto }: { texto: string }) {
  if (!texto?.trim()) return null;
  return <p className="text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap">{texto}</p>;
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

    const fasesConfig = [
      { numero: 1, key: 'fase_1_alivio', titulo: 'Fase 1 — Alívio & Proteção', semanas_inicio: 1, semanas_fim: 2 },
      { numero: 2, key: 'fase_2_carga', titulo: 'Fase 2 — Carga Progressiva', semanas_inicio: 3, semanas_fim: 6 },
      { numero: 3, key: 'fase_3_retorno', titulo: 'Fase 3 — Retorno Funcional', semanas_inicio: 7, semanas_fim: 12 },
    ];

    const diretrizSnapshot = {
      versao: 1,
      createdAt: new Date().toISOString(),
      origem: origemDiretriz,
      fases: fasesConfig.map((cfg) => {
        const fase = diretriz?.[cfg.key] || {};
        const tecnicas = Array.isArray(fase.tecnicas) ? fase.tecnicas : [];
        return {
          numero: cfg.numero,
          titulo: cfg.titulo,
          semanas: `${cfg.semanas_inicio}-${cfg.semanas_fim}`,
          semanas_inicio: cfg.semanas_inicio,
          semanas_fim: cfg.semanas_fim,
          objetivo: (fase.objetivos || [])[0] || 'Conduta terapêutica planejada.',
          demandasAlvo: (fase.objetivos || []).slice(1),
          frequenciaSemanal: 0,
          duracaoSessao: fase.duracao_semanas || '',
          exercicios: [],
          tecnicas: tecnicas.map((t: any) => ({
            nome: t.tecnica || 'Técnica',
            descricao: t.justificativa || '',
            duracao: '',
            frequencia: diretriz.frequencia_sugerida || '',
            motivo: t.justificativa || '',
            categoria: t.lente_clinica || 'referencia',
          })),
        };
      }),
    };

    const { data: prot, error: protErr } = await (supabase as any)
      .from('protocolos')
      .insert({
        terapeuta_id: user.id,
        paciente_id: pacienteId,
        titulo: `Diretriz — ${queixa}`,
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

    const fasesPayload = fasesConfig.map((cfg) => {
      const fase = diretriz?.[cfg.key] || {};
      return {
        protocolo_id: prot.id,
        numero_fase: cfg.numero,
        titulo: cfg.titulo,
        semanas_inicio: cfg.semanas_inicio,
        semanas_fim: cfg.semanas_fim,
        objetivos: Array.isArray(fase.objetivos) ? fase.objetivos : [],
        sessoes_por_semana: 2,
      };
    });
    await (supabase as any).from('protocolo_fases').insert(fasesPayload);

    return prot.id as string;
  };

  const toggleConfirmacao = async (key: SecaoKey) => {
    const nova = new Set(confirmadas);
    const estavaConfirmada = nova.has(key);
    if (estavaConfirmada) nova.delete(key); else nova.add(key);
    setSaving(key);
    try {
      setConfirmadas(nova);

      // Caso especial: confirmar a Diretriz → cria protocolo e navega para a aba Diretrizes
      let protocoloIdCriado: string | null = resultado?._secoes?.diretriz_protocolo_id || null;
      if (key === 'diretriz' && !estavaConfirmada) {
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

      if (key === 'diretriz' && !estavaConfirmada && protocoloIdCriado) {
        toast({
          title: '✅ Diretriz enviada para a aba Diretrizes',
          description: 'Agora você pode refinar a diretriz com opções baseadas em evidências.',
        });
        navigate(`/pacientes/${pacienteId}?tab=diretrizes&protocolo=${protocoloIdCriado}`);
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {secoesDisponiveis.map((s) => {
          const accent = ACCENTS[s.key];
          const confirmada = confirmadas.has(s.key);
          const editandoEsta = editando === s.key;
          const savingEsta = saving === s.key;
          const Icon = s.Icon;
          const isDiretriz = s.key === 'diretriz';
          const semProntuario = SECOES_SEM_PRONTUARIO.includes(s.key);

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

              {/* Header compacto */}
              <div className="px-3 sm:px-3.5 pt-2.5 pb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', accent.iconBg, accent.iconText)}>
                    <Icon className="icon-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-[13px] text-foreground leading-tight">{s.titulo}</span>
                      {semProntuario ? (
                        <Badge variant="outline" className="text-[9px] gap-0.5 font-normal border-border/60 text-muted-foreground py- 0 px-1.5">
                          Apoio
                        </Badge>
                      ) : confirmada && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[9px] gap-0.5 hover:bg-emerald-500/10 font-normal py-0 px-1.5">
                          <CheckCircle2 className="icon-xs" /> Prontuário
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {semProntuario ? 'Não vai para o prontuário' : (confirmada ? 'Sincronizado' : 'Pendente')}
                    </p>
                  </div>
                </div>

                {!editandoEsta && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => iniciarEdicao(s.key)}
                      disabled={savingEsta}
                      title="Editar"
                    >
                      <Pencil className="icon-xs" />
                    </Button>
                    {!semProntuario && (
                      <Button
                        size="sm"
                        variant={confirmada ? 'outline' : 'default'}
                        className={cn(
                          'h-7 px-2.5 gap-1 rounded-md text-[11px] font-medium',
                          confirmada && 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800'
                        )}
                        onClick={() => toggleConfirmacao(s.key)}
                        disabled={savingEsta}
                      >
                        {savingEsta ? <Loader2 className="icon-xs animate-spin" /> : confirmada ? <X className="icon-xs" /> : <Check className="icon-xs" />}
                        {confirmada ? 'Remover' : 'Confirmar'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
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
                      <DiretrizFases texto={textos[s.key]} />
                    ) : s.key === 'soap' ? (
                      <SoapPretty texto={textos[s.key]} />
                    ) : (
                      <div className={cn('rounded-lg border border-border/30 px-3 py-2.5 sm:px-3.5 sm:py-3', accent.surface)}>
                        {s.key === 'dor' ? (
                          <DorPretty data={resultado?.dor} />
                        ) : s.key === 'funcionalidade' ? (
                          <ObjPretty data={resultado?.funcionalidade} />
                        ) : s.key === 'psicossocial' ? (
                          <ObjPretty data={resultado?.fatores_psicossociais || resultado?.psicossocial} />
                        ) : s.key === 'red_flags' ? (
                          <RedFlagsPretty data={resultado?.red_flags || resultado?.redflags} />
                        ) : s.key === 'hipoteses' ? (
                          <HipotesesPretty data={resultado?.hipoteses_diagnosticas} />
                        ) : s.key === 'cif' ? (
                          <CifPretty data={resultado?.cif_codes} />
                        ) : s.key === 'insights' ? (
                          <InsightsPretty data={resultado?.insights_baseados_evidencia} />
                        ) : s.key === 'resumo_clinico' ? (
                          <ResumoPretty texto={textos[s.key]} />
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

