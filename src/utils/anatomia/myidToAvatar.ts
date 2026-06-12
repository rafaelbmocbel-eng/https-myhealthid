// ============================================================
// MyID → Avatar Inference Engine
// Traduz scores do MyID em regiões pré-marcadas no avatar
// com SEVERIDADE derivada do score (não chapada).
// ============================================================

import { encontrarSintomasEmTexto, type SistemaCorporal } from './mapeamentoSintomas';

export type AvatarFonte = 'myid' | 'voz_ia' | 'manual';

export interface AchadoAvatar {
  regiao_id: string;
  intensidade: number; // 0-10
  fontes: AvatarFonte[];
  sistema: SistemaCorporal;
  // Rastreabilidade
  myid_dimensao_origem?: string;
  myid_score_origem?: number;
  termos_voz?: string[];
  motivo: string;
}

interface MyIDScores {
  D?: number | null;        // Dor
  EFI?: number | null;      // Funcionalidade
  P?: number | null;        // Psicológico
  I?: number | null;        // Inércia
  R?: number | null;        // Regulação
  C?: number | null;        // Contexto
  AF?: number | null;       // Atividade Física
  HID?: number | null;
  NUT?: number | null;
  ERG?: number | null;      // Ergonomia
  N?: number | null;        // Ruído Sistêmico
}

interface MyIDInput {
  scores: MyIDScores;
  textoRelato?: string; // pain_location, queixa, observações
}

// Cada regra: se o score atinge o limiar, marca essas regiões.
// O multiplicador determina como o score vira intensidade no avatar.
const REGRAS_MYID: Array<{
  dimensao: keyof MyIDScores;
  limiar: number;
  regioes: string[];
  sistema: SistemaCorporal;
  motivo: string;
}> = [
  // EFI alto = limitação funcional → articulações de carga
  {
    dimensao: 'EFI',
    limiar: 6,
    regioes: ['joelho_d', 'joelho_e', 'lombar', 'ombro_d', 'ombro_e'],
    sistema: 'musculoesqueletico',
    motivo: 'Limitação funcional alta — articulações de carga sob sobrecarga',
  },
  // AF alto = inatividade → sedentarismo concentra dor lombar/glútea
  {
    dimensao: 'AF',
    limiar: 6,
    regioes: ['lombar', 'gluteos', 'coxa_d', 'coxa_e'],
    sistema: 'musculoesqueletico',
    motivo: 'Inatividade física — encurtamentos e desuso de cadeia posterior',
  },
  // R alto = regulação ruim (sono/estresse) → somatização em cabeça
  {
    dimensao: 'R',
    limiar: 7,
    regioes: ['cabeca', 'cervical'],
    sistema: 'nervoso',
    motivo: 'Desregulação (sono/estresse) — manifestação cervical e cefaleia',
  },
  // C alto = contexto adverso → tensão muscular psicossomática
  {
    dimensao: 'C',
    limiar: 6,
    regioes: ['trapezio_d', 'trapezio_e', 'cervical'],
    sistema: 'musculoesqueletico',
    motivo: 'Contexto adverso — tensão psicossomática em cintura escapular',
  },
  // ERG alto = ergonomia ruim (postura) → cadeia postural completa
  {
    dimensao: 'ERG',
    limiar: 6,
    regioes: ['cervical', 'lombar', 'trapezio_d', 'trapezio_e', 'dorsal'],
    sistema: 'musculoesqueletico',
    motivo: 'Ergonomia inadequada — sobrecarga postural axial',
  },
  // P alto = kinesiofobia → afeta movimento global, marcador na lombar (mais comum)
  {
    dimensao: 'P',
    limiar: 5,
    regioes: ['lombar'],
    sistema: 'nervoso',
    motivo: 'Kinesiofobia — evitação de movimento amplifica dor central',
  },
];

/**
 * Calcula intensidade no avatar (0-10) a partir do score MyID.
 * Quanto maior o score, mais intenso o achado visual.
 */
function scoreParaIntensidade(score: number): number {
  // score 0-10 → intensidade 3-10 (mínimo 3 pra aparecer no avatar)
  return Math.min(10, Math.max(3, Math.round(score * 1.1)));
}

/**
 * Motor principal: recebe scores + texto do MyID e produz achados pro avatar.
 */
export function inferirAchadosDoMyID(input: MyIDInput): AchadoAvatar[] {
  const achadosPorRegiao = new Map<string, AchadoAvatar>();

  // 1) Aplicar regras baseadas nos scores
  REGRAS_MYID.forEach(regra => {
    const score = input.scores[regra.dimensao];
    if (score == null || score < regra.limiar) return;

    const intensidade = scoreParaIntensidade(score);

    regra.regioes.forEach(regiao_id => {
      const existente = achadosPorRegiao.get(regiao_id);
      if (!existente || existente.intensidade < intensidade) {
        achadosPorRegiao.set(regiao_id, {
          regiao_id,
          intensidade,
          fontes: ['myid'],
          sistema: regra.sistema,
          myid_dimensao_origem: regra.dimensao,
          myid_score_origem: score,
          motivo: regra.motivo,
        });
      }
    });
  });

  // 2) Extrair regiões mencionadas no texto livre do MyID (ex: pain_location)
  if (input.textoRelato && input.textoRelato.trim().length > 0) {
    const sintomas = encontrarSintomasEmTexto(input.textoRelato);
    const scoreDor = input.scores.D ?? 0;
    const intensidadeBase = scoreParaIntensidade(scoreDor > 0 ? scoreDor : 5);

    sintomas.forEach(s => {
      const existente = achadosPorRegiao.get(s.regiao_id);
      if (!existente) {
        achadosPorRegiao.set(s.regiao_id, {
          regiao_id: s.regiao_id,
          intensidade: intensidadeBase,
          fontes: ['myid'],
          sistema: s.sistema,
          myid_dimensao_origem: 'D',
          myid_score_origem: scoreDor || undefined,
          termos_voz: [s.termo],
          motivo: `Relato MyID: "${s.termo}"`,
        });
      } else {
        // Aumenta intensidade se também aparece no relato
        existente.intensidade = Math.min(10, existente.intensidade + 1);
        existente.termos_voz = [...(existente.termos_voz ?? []), s.termo];
      }
    });
  }

  return Array.from(achadosPorRegiao.values());
}

/**
 * Merge: combina achados MyID + Voz + Manual em um único mapa,
 * triangulando fontes e amplificando severidade quando há convergência.
 */
export interface AchadoUnificado {
  regiao_id: string;
  intensidade: number;
  fontes: AvatarFonte[];
  triangulado: boolean; // 2+ fontes
  origem_principal: AvatarFonte;
  metadata: {
    fontes: AvatarFonte[];
    myid_dimensao_origem?: string;
    myid_score_origem?: number;
    termos_voz?: string[];
    confianca: 'alta' | 'media' | 'baixa';
  };
}

export function mergearFontes(
  fromMyID: AchadoAvatar[],
  fromVoz: Array<{ regiao_id: string; intensidade: number; termos?: string[] }>,
  fromManual: Record<string, number>,
): Map<string, AchadoUnificado> {
  const merged = new Map<string, AchadoUnificado>();

  const upsert = (regiao_id: string, fonte: AvatarFonte, intensidade: number, extra?: Partial<AchadoUnificado['metadata']>) => {
    const existing = merged.get(regiao_id);
    if (!existing) {
      merged.set(regiao_id, {
        regiao_id,
        intensidade,
        fontes: [fonte],
        triangulado: false,
        origem_principal: fonte,
        metadata: {
          fontes: [fonte],
          confianca: 'baixa',
          ...extra,
        },
      });
    } else {
      if (!existing.fontes.includes(fonte)) {
        existing.fontes.push(fonte);
        existing.metadata.fontes.push(fonte);
      }
      // Manual prevalece como origem principal (clínico viu)
      if (fonte === 'manual') existing.origem_principal = 'manual';
      // Intensidade = maior das fontes + bônus de triangulação
      existing.intensidade = Math.max(existing.intensidade, intensidade);
      if (existing.fontes.length >= 2) {
        existing.triangulado = true;
        existing.intensidade = Math.min(10, existing.intensidade + 1);
      }
      // Merge metadata
      if (extra) {
        existing.metadata = { ...existing.metadata, ...extra, fontes: existing.metadata.fontes };
      }
      // Confiança escala com número de fontes
      existing.metadata.confianca =
        existing.fontes.length >= 3 ? 'alta' :
        existing.fontes.length === 2 ? 'media' : 'baixa';
    }
  };

  fromMyID.forEach(a => upsert(a.regiao_id, 'myid', a.intensidade, {
    myid_dimensao_origem: a.myid_dimensao_origem,
    myid_score_origem: a.myid_score_origem,
    termos_voz: a.termos_voz,
  }));

  fromVoz.forEach(v => upsert(v.regiao_id, 'voz_ia', v.intensidade, {
    termos_voz: v.termos,
  }));

  Object.entries(fromManual).forEach(([rid, intensity]) => {
    if (intensity > 0) upsert(rid, 'manual', intensity);
  });

  return merged;
}
