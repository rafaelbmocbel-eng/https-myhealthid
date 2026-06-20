import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Sparkles, Target, CheckCircle2, ChevronRight, Zap,
  AlertTriangle, Activity, Brain, Heart, Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Mapeamento região → desafio do dia ───────────────────────────────
const DESAFIOS: Record<string, { emoji: string; titulo: string; acao: string; xp: number }> = {
  cervical:    { emoji: '🔄', titulo: 'Solte o pescoço',     acao: 'Faça 5 rotações cervicais lentas para cada lado agora mesmo',         xp: 10 },
  lombar:      { emoji: '🧘', titulo: 'Cuide da lombar',     acao: 'Deite de costas e faça a ponte: levante o quadril por 5 seg × 8 reps', xp: 15 },
  cabeca:      { emoji: '🧠', titulo: 'Pause a mente',       acao: 'Feche os olhos e respire fundo por 2 min agora',                       xp: 10 },
  ombro_d:     { emoji: '💪', titulo: 'Ombro direito livre', acao: 'Pendule o braço direito solto por 30 seg para reduzir tensão',          xp: 10 },
  ombro_e:     { emoji: '💪', titulo: 'Ombro esquerdo livre',acao: 'Pendule o braço esquerdo solto por 30 seg para reduzir tensão',         xp: 10 },
  trapezio_d:  { emoji: '🙆', titulo: 'Solte o trapézio',    acao: 'Incline o pescoço para a esquerda e segure por 20 seg, depois troque', xp: 10 },
  trapezio_e:  { emoji: '🙆', titulo: 'Solte o trapézio',    acao: 'Incline o pescoço para a direita e segure por 20 seg, depois troque',  xp: 10 },
  dorsal:      { emoji: '🪑', titulo: 'Erga a postura',      acao: 'A cada 45 min: levante, estique os braços acima e respire fundo 3×',   xp: 15 },
  joelho_d:    { emoji: '🦵', titulo: 'Joelho direito',      acao: 'Sente, estique a perna e segure 10 seg × 6 reps',                      xp: 10 },
  joelho_e:    { emoji: '🦵', titulo: 'Joelho esquerdo',     acao: 'Sente, estique a perna e segure 10 seg × 6 reps',                      xp: 10 },
  abdomem:     { emoji: '🫁', titulo: 'Respire pelo diafragma', acao: 'Mão na barriga: inspire 4 seg (barriga sobe), expire 6 seg × 5 reps', xp: 10 },
  braco_d:     { emoji: '✋', titulo: 'Reduza a pressão',    acao: 'Evite apoiar o braço direito; faça movimentos suaves de flexão-extensão', xp: 10 },
  braco_e:     { emoji: '✋', titulo: 'Reduza a pressão',    acao: 'Evite apoiar o braço esquerdo; faça movimentos suaves de flexão-extensão', xp: 10 },
};

const DESAFIO_PADRAO = { emoji: '🎯', titulo: 'Mexa o corpo', acao: 'Caminhe por 10 minutos ao ar livre agora — qualquer movimento conta', xp: 10 };

// Mapeamento de sistema corporal → dica friendly
const INSIGHT_SISTEMA: Record<string, { icon: any; cor: string; bg: string; titulo: string; texto: string }> = {
  nervoso:       { icon: Brain,    cor: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30', titulo: 'Sistema nervoso', texto: 'Seu sistema nervoso está sobrecarregado. Sono, respiração e pausas são medicamentos naturais.' },
  musculoesqueletico: { icon: Activity, cor: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', titulo: 'Tensão muscular', texto: 'Músculos e articulações precisam de movimento e descaso alternados — evite ficar muito tempo parado.' },
  circulatorio:  { icon: Heart,    cor: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950/30',       titulo: 'Sistema circulatório', texto: 'Hidratação, movimento leve e evitar longas posições estáticas ajudam muito a circulação.' },
  respiratorio:  { icon: Wind,     cor: 'text-cyan-600',   bg: 'bg-cyan-50 dark:bg-cyan-950/30',     titulo: 'Sistema respiratório', texto: 'A respiração diafragmática profunda 3× ao dia ajuda a reduzir inflamação e tensão.' },
  digestorio:    { icon: Zap,      cor: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', titulo: 'Sistema digestório', texto: 'Mastigar devagar, manter hidratação e evitar estresse nas refeições faz toda diferença.' },
};

function getDesafioParaRegiao(regioes: string[]): typeof DESAFIO_PADRAO & { emoji: string } {
  for (const rid of regioes) {
    if (DESAFIOS[rid]) return DESAFIOS[rid];
  }
  return DESAFIO_PADRAO;
}

const HOJE = new Date().toISOString().slice(0, 10);

interface Props {
  pacienteId: string;
}

export default function PacienteInsightsDaAvaliacao({ pacienteId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const storageKey = `desafio-${HOJE}-${pacienteId}`;
  const [desafioConcluido, setDesafioConcluido] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  // Última avaliação por voz
  const { data: aval } = useQuery({
    queryKey: ['paciente-insights-aval', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_voz')
        .select('id, resultado, created_at, classificacao_severidade, queixa_principal')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
    staleTime: 120_000,
  });

  // Achados do avatar clínico — para gerar desafio do dia contextualizado
  const { data: eventosAvatar = [] } = useQuery({
    queryKey: ['paciente-insights-avatar', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('eventos_clinicos_anatomicos')
        .select('regiao_id, sistema, status, severidade')
        .eq('paciente_id', pacienteId)
        .neq('status', 'resolvido')
        .order('severidade', { ascending: false })
        .limit(5);
      return (data || []) as { regiao_id: string; sistema: string; status: string; severidade: number }[];
    },
    enabled: !!pacienteId,
    staleTime: 120_000,
  });

  // Último MyID (se existir) — complementa os insights
  const { data: myid } = useQuery({
    queryKey: ['paciente-insights-myid', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('myid_score, score_r, score_d, score_efi, myid_analysis')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
    staleTime: 120_000,
  });

  if (!aval && eventosAvatar.length === 0) return null;

  const resultado = aval?.resultado as any;
  const meta = resultado?._meta || {};
  const queixa = aval?.queixa_principal || resultado?.queixa_principal || resultado?.soap?.subjetivo || '';
  const redFlags = Array.isArray(meta?.red_flag_alerts) ? meta.red_flag_alerts as string[] : [];

  // Sistemas com achados ativos
  const sistemasAtivos = [...new Set(eventosAvatar.map(e => e.sistema))];
  const regioesAtivas = eventosAvatar.map(e => e.regiao_id);

  // Desafio do dia baseado no achado mais severo
  const desafio = getDesafioParaRegiao(regioesAtivas);

  const handleConcluirDesafio = () => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* */ }
    setDesafioConcluido(true);
    // Increment XP via supabase update
    if (user?.id) {
      supabase
        .from('pacientes')
        .select('xp_total')
        .eq('id', pacienteId)
        .maybeSingle()
        .then(({ data }) => {
          const xpAtual = (data as any)?.xp_total || 0;
          supabase.from('pacientes').update({ xp_total: xpAtual + desafio.xp }).eq('id', pacienteId);
        });
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Insights da avaliação ────────────────────────────── */}
      {(queixa || sistemasAtivos.length > 0) && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Sua saúde em foco
            </p>
          </div>

          {/* Queixa principal */}
          {queixa && (
            <div className="px-4 pb-2">
              <p className="text-sm text-foreground leading-snug line-clamp-2">
                {queixa.length > 120 ? queixa.slice(0, 120) + '…' : queixa}
              </p>
            </div>
          )}

          {/* Sistemas ativos */}
          {sistemasAtivos.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {sistemasAtivos.slice(0, 3).map(s => {
                const cfg = INSIGHT_SISTEMA[s] || INSIGHT_SISTEMA['musculoesqueletico'];
                const Icon = cfg.icon;
                return (
                  <div key={s} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', cfg.bg, cfg.cor)}>
                    <Icon className="h-3 w-3" />
                    {cfg.titulo}
                  </div>
                );
              })}
            </div>
          )}

          {/* MyID score (se disponível) */}
          {myid?.myid_score != null && (
            <div className="mx-4 mb-3 rounded-xl bg-muted/50 px-3 py-2 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground font-medium">Seu Score MyID</p>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-lg font-black',
                  Number(myid.myid_score) >= 70 ? 'text-emerald-600' :
                  Number(myid.myid_score) >= 50 ? 'text-amber-600' : 'text-red-600',
                )}>
                  {Math.round(Number(myid.myid_score))}
                </span>
                <span className="text-[11px] text-muted-foreground">/100</span>
              </div>
            </div>
          )}

          {/* Red Flags — aviso compacto */}
          {redFlags.length > 0 && (
            <div className="mx-4 mb-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700 dark:text-red-400 leading-snug">
                <span className="font-semibold">Atenção: </span>
                {redFlags.slice(0, 2).join('; ')}
                {redFlags.length > 2 && ` +${redFlags.length - 2} mais`}
              </p>
            </div>
          )}

          {/* Insight do sistema mais relevante */}
          {sistemasAtivos[0] && INSIGHT_SISTEMA[sistemasAtivos[0]] && (
            <div className={cn('mx-4 mb-4 rounded-xl px-3 py-2', INSIGHT_SISTEMA[sistemasAtivos[0]].bg)}>
              <p className="text-[11px] leading-snug text-foreground/80">
                💡 {INSIGHT_SISTEMA[sistemasAtivos[0]].texto}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Desafio do Dia ─────────────────────────────────────── */}
      <div className={cn(
        'rounded-2xl border p-4 transition-all',
        desafioConcluido
          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20'
          : 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent',
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0',
            desafioConcluido ? 'bg-emerald-100' : 'bg-primary/10',
          )}>
            {desafioConcluido ? '✅' : desafio.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Desafio do Dia
              </p>
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                desafioConcluido
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-primary/10 text-primary',
              )}>
                +{desafio.xp} XP
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5">{desafio.titulo}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desafio.acao}</p>
          </div>
        </div>

        {!desafioConcluido ? (
          <Button
            size="sm"
            className="w-full mt-3 h-8 gap-1.5 text-xs"
            onClick={handleConcluirDesafio}
          >
            <Target className="h-3.5 w-3.5 shrink-0" />
            Concluir e ganhar {desafio.xp} XP
          </Button>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-700">Desafio concluído hoje! Volte amanhã.</p>
          </div>
        )}
      </div>

      {/* CTA MyID (se não fez ainda) */}
      {!myid?.myid_score && (
        <button
          onClick={() => navigate('/paciente/questionarios')}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-dashed border-primary/30 hover:bg-primary/5 transition-colors group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-semibold text-foreground">Complete seu MyID</p>
              <p className="text-[10px] text-muted-foreground">Personalize ainda mais seus insights (+50 XP)</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-primary/60 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
