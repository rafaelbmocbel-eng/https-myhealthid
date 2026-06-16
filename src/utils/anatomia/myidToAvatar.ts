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

/**
 * NOTA — Princípio anti-nocebo (revisão clínica multidisciplinar):
 * Scores dimensionais (EFI, AF, R, C, ERG, P, I, N, HID) são indicadores indiretos
 * e NUNCA devem acender regiões no mapa corporal por inferência estatística pura —
 * isso gerava ruído clínico (ex.: EFI alto acendia 5 articulações sem o paciente
 * jamais ter relatado dor nelas). Essas dimensões agora alimentam o componente
 * `RadarDeAvaliacao` (sugestões textuais de investigação, sem alarme visual).
 *
 * Esta função permanece focada exclusivamente em regiões EXPLICITAMENTE
 * mencionadas pelo paciente em texto livre (queixa, observações, etc.) —
 * a única fonte legítima para destacar uma região anatômica a partir do MyID.
 */

/**
 * Calcula intensidade no avatar (0-10) a partir do score de dor (D).
 */
function scoreParaIntensidade(score: number): number {
  // score 0-10 → intensidade 3-10 (mínimo 3 pra aparecer no avatar)
  return Math.min(10, Math.max(3, Math.round(score * 1.1)));
}

/**
 * Motor principal: recebe scores + texto do MyID e produz achados pro avatar.
 * Só gera achados a partir de menções explícitas de região no relato do paciente —
 * nunca a partir de scores dimensionais isolados (ver nota acima).
 */
export function inferirAchadosDoMyID(input: MyIDInput): AchadoAvatar[] {
  const achadosPorRegiao = new Map<string, AchadoAvatar>();

  // Extrair regiões mencionadas no texto livre do MyID (ex: pain_location)
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
