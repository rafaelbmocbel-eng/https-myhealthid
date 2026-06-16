// ============================================================
// RadarDeAvaliacao — Sugestões clínicas textuais derivadas dos scores MyID
// Substitui o comportamento anterior de acender regiões no avatar.
// Linguagem: sugestiva, não alarmante. Sem urgência, sem corpo em destaque.
// ============================================================

import { Activity, Moon, Brain, Zap, AlertTriangle, Droplets, Utensils, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
  scores: {
    D?: number | null;
    EFI?: number | null;
    P?: number | null;
    I?: number | null;
    R?: number | null;
    C?: number | null;
    AF?: number | null;
    HID?: number | null;
    NUT?: number | null;
    ERG?: number | null;
    N?: number | null;
  };
}

type IconeKey = 'activity' | 'moon' | 'brain' | 'zap' | 'alert' | 'droplets' | 'utensils';

const ICONES: Record<IconeKey, React.ComponentType<{ size?: number; className?: string }>> = {
  activity: Activity,
  moon: Moon,
  brain: Brain,
  zap: Zap,
  alert: AlertTriangle,
  droplets: Droplets,
  utensils: Utensils,
};

const SUGESTOES: Array<{
  dimensao: keyof Props['scores'];
  limiar: number;
  especialidades: string[];
  sugestao: string;
  icone: IconeKey;
}> = [
  {
    dimensao: 'EFI',
    limiar: 6,
    especialidades: ['Fisioterapia', 'Educação Física'],
    sugestao: 'Avaliar mobilidade articular e capacidade funcional — limitação funcional reportada',
    icone: 'activity',
  },
  {
    dimensao: 'AF',
    limiar: 6,
    especialidades: ['Educação Física', 'Fisioterapia'],
    sugestao: 'Investigar nível de condicionamento físico e desequilíbrios musculares por inatividade',
    icone: 'activity',
  },
  {
    dimensao: 'R',
    limiar: 7,
    especialidades: ['Psicologia', 'Medicina', 'Fisioterapia'],
    sugestao: 'Avaliar qualidade do sono e marcadores de estresse — possível impacto em dor e recuperação',
    icone: 'moon',
  },
  {
    dimensao: 'C',
    limiar: 6,
    especialidades: ['Psicologia', 'Terapia Ocupacional'],
    sugestao: 'Investigar fatores contextuais e psicossociais — tensão muscular de origem emocional possível',
    icone: 'brain',
  },
  {
    dimensao: 'ERG',
    limiar: 6,
    especialidades: ['Fisioterapia', 'Terapia Ocupacional', 'Educação Física'],
    sugestao: 'Avaliar ergonomia e postura — sobrecarga axial por ambiente de trabalho/postura habitual',
    icone: 'zap',
  },
  {
    dimensao: 'P',
    limiar: 5,
    especialidades: ['Psicologia', 'Fisioterapia'],
    sugestao: 'Investigar componente psicológico da dor — possível kinesiofobia ou sensibilização central',
    icone: 'brain',
  },
  {
    dimensao: 'I',
    limiar: 6,
    especialidades: ['Educação Física', 'Fisioterapia'],
    sugestao: 'Avaliar sedentarismo crônico — articulações de carga sem suporte muscular adequado',
    icone: 'activity',
  },
  {
    dimensao: 'N',
    limiar: 6,
    especialidades: ['Medicina', 'Nutrição'],
    sugestao: 'Investigar inflamação sistêmica ou sensibilização central — sintomas difusos relatados',
    icone: 'alert',
  },
  {
    dimensao: 'HID',
    limiar: 7,
    especialidades: ['Nutrição', 'Medicina'],
    sugestao: 'Orientar hidratação — nível insuficiente pode amplificar cefaleia e tensão muscular',
    icone: 'droplets',
  },
  {
    dimensao: 'NUT',
    limiar: 6,
    especialidades: ['Nutrição', 'Medicina'],
    sugestao: 'Avaliar padrão alimentar — impacto potencial em inflamação e recuperação tecidual',
    icone: 'utensils',
  },
];

const MAX_VISIVEL = 6;

export function RadarDeAvaliacao({ scores }: Props) {
  const [expandido, setExpandido] = useState(false);

  // Filtra sugestões cujo score atingiu o limiar, ordenadas por distância ao limiar (mais relevantes primeiro)
  const sugestoesAtivas = SUGESTOES
    .filter(s => {
      const score = scores[s.dimensao];
      return score != null && score >= s.limiar;
    })
    .sort((a, b) => {
      const scoreA = scores[a.dimensao] ?? 0;
      const scoreB = scores[b.dimensao] ?? 0;
      const distA = scoreA - a.limiar;
      const distB = scoreB - b.limiar;
      return distB - distA;
    });

  if (sugestoesAtivas.length === 0) {
    return null;
  }

  const visiveis = expandido ? sugestoesAtivas : sugestoesAtivas.slice(0, MAX_VISIVEL);
  const ocultas = sugestoesAtivas.length - MAX_VISIVEL;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
      {/* Título */}
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <AlertTriangle size={9} />
        Radar de Avaliação
      </p>

      {/* Lista de sugestões */}
      <div className="space-y-1.5">
        {visiveis.map((s, idx) => {
          const Icone = ICONES[s.icone];
          return (
            <div key={`${s.dimensao}-${idx}`} className="flex items-start gap-2 text-[10px] text-muted-foreground">
              {/* Dot */}
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />

              {/* Texto + especialidades */}
              <div className="flex-1 min-w-0">
                <span className="leading-snug">
                  <Icone size={9} className="inline mr-1 opacity-60" />
                  Sugerimos avaliar: {s.sugestao}
                </span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {s.especialidades.map(esp => (
                    <span
                      key={esp}
                      className="text-[8px] bg-background border rounded px-1 leading-tight"
                    >
                      {esp}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandir/recolher */}
      {ocultas > 0 && !expandido && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="flex items-center gap-0.5 text-[9px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          <ChevronRight size={9} />
          +{ocultas} outras sugestões
        </button>
      )}

      {/* Disclaimer */}
      <p className="text-[9px] text-muted-foreground/60 italic">
        Baseado em autorelato MyID — requer avaliação presencial para confirmação
      </p>
    </div>
  );
}
