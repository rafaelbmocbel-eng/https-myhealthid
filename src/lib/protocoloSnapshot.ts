import type { ProtocoloAnalise } from '@/utils/demandasAnalyzer';

export interface DiretrizSnapshotExercise {
  nome: string;
  categoria: string;
  nivel_evidencia?: string;
  series: number | string;
  repeticoes: number | string;
  duracao: string;
  motivo: string;
  descricao: string;
  instrucoes: string[];
}

export interface DiretrizSnapshotTechnique {
  nome: string;
  nivel_evidencia?: string;
  descricao: string;
  duracao: string;
  frequencia: string;
  motivo: string;
  categoria?: string;
}

export interface DiretrizSnapshotPhase {
  numero: number;
  titulo: string;
  semanas: string;
  semanas_inicio: number;
  semanas_fim: number;
  objetivo: string;
  demandasAlvo: string[];
  criteriosProgressao?: string[];
  frequenciaSemanal: number;
  duracaoSessao: string;
  exercicios: DiretrizSnapshotExercise[];
  tecnicas: DiretrizSnapshotTechnique[];
}

export interface DiretrizSnapshot {
  versao: number;
  createdAt: string;
  fases: DiretrizSnapshotPhase[];
  origem?: string;
  frequenciaSugerida?: string;
  prognostico?: string;
  criteriosAlta?: string[];
  manutencao?: Record<string, unknown>;
  referenciasChave?: string[];
  textoConfirmado?: string;
}

type JsonRecord = Record<string, unknown>;

const getObjectValue = (value: unknown, key: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return (value as JsonRecord)[key];
};

const getStringFromObject = (value: unknown, key: string) => {
  const objectValue = getObjectValue(value, key);
  return typeof objectValue === 'string' ? objectValue : '';
};

export function createDiretrizSnapshot(analise: ProtocoloAnalise): DiretrizSnapshot {
  return {
    versao: 1,
    createdAt: new Date().toISOString(),
    fases: analise.fases.map((fase) => ({
      numero: fase.numero,
      titulo: fase.titulo,
      semanas: fase.semanas,
      semanas_inicio: fase.semanas_inicio,
      semanas_fim: fase.semanas_fim,
      objetivo: fase.objetivo,
      demandasAlvo: [...fase.demandasAlvo],
      frequenciaSemanal: fase.frequenciaSemanal,
      duracaoSessao: fase.duracaoSessao,
      exercicios: fase.exercicios.map((exercicio) => ({
        nome: exercicio.nome,
        categoria: exercicio.categoria,
        series: exercicio.series,
        repeticoes: exercicio.repeticoes,
        duracao: exercicio.duracao,
        motivo: exercicio.motivo,
        descricao: exercicio.descricao,
        instrucoes: [...(exercicio.instrucoes || [])],
      })),
      tecnicas: fase.tecnicas.map((tecnica) => ({
        nome: tecnica.nome,
        descricao: tecnica.descricao,
        duracao: tecnica.duracao,
        frequencia: tecnica.frequencia,
        motivo: tecnica.motivo,
      })),
    })),
  };
}

const FASES_VOZ = [
  { numero: 1, key: 'fase_1_alivio', titulo: 'Fase 1 — Alívio & Proteção', semanas_inicio: 1, semanas_fim: 2 },
  { numero: 2, key: 'fase_2_carga', titulo: 'Fase 2 — Carga Progressiva', semanas_inicio: 3, semanas_fim: 6 },
  { numero: 3, key: 'fase_3_retorno', titulo: 'Fase 3 — Retorno Funcional', semanas_inicio: 7, semanas_fim: 12 },
];

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const getRecord = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
);

export function createDiretrizSnapshotFromVoz(
  diretriz: unknown,
  options: { origem?: string; createdAt?: string; textoConfirmado?: string } = {},
): DiretrizSnapshot | null {
  const d = getRecord(diretriz);
  if (Object.keys(d).length === 0) return null;

  return {
    versao: 1,
    createdAt: options.createdAt || new Date().toISOString(),
    origem: options.origem || 'ia_voz',
    frequenciaSugerida: typeof d.frequencia_sugerida === 'string' ? d.frequencia_sugerida : undefined,
    prognostico: typeof d.prognostico === 'string' ? d.prognostico : undefined,
    criteriosAlta: asStringArray(d.criterios_alta),
    manutencao: getRecord(d.manutencao),
    referenciasChave: asStringArray(d.referencias_chave),
    textoConfirmado: options.textoConfirmado,
    fases: FASES_VOZ.map((cfg) => {
      const fase = getRecord(d[cfg.key]);
      const objetivos = asStringArray(fase.objetivos || fase.objetivo);
      const criterios = asStringArray(fase.criterios_progressao || fase.criterios);
      const tecnicas = Array.isArray(fase.tecnicas || fase.techniques) ? (fase.tecnicas || fase.techniques) as unknown[] : [];
      const exercicios = Array.isArray(fase.exercicios || fase.exercises) ? (fase.exercicios || fase.exercises) as unknown[] : [];

      return {
        numero: cfg.numero,
        titulo: cfg.titulo,
        semanas: typeof fase.duracao_semanas === 'string' ? fase.duracao_semanas : `${cfg.semanas_inicio}-${cfg.semanas_fim}`,
        semanas_inicio: cfg.semanas_inicio,
        semanas_fim: cfg.semanas_fim,
        objetivo: objetivos[0] || 'Conduta terapêutica planejada.',
        demandasAlvo: objetivos.slice(1),
        criteriosProgressao: criterios,
        frequenciaSemanal: 0,
        duracaoSessao: typeof fase.duracao_sessao === 'string' ? fase.duracao_sessao : '',
        exercicios: exercicios.map((item) => {
          const ex = getRecord(item);
          return {
            nome: String(ex.nome || ex.exercicio || ex.titulo || ex.name || 'Exercício'),
            categoria: String(ex.categoria || 'Exercício terapêutico'),
            series: String(ex.series || ex.serie || ''),
            repeticoes: String(ex.repeticoes || ex.reps || ''),
            duracao: String(ex.duracao || ex.dosagem || ''),
            motivo: String(ex.motivo || ex.justificativa || ''),
            descricao: String(ex.descricao || ''),
            instrucoes: asStringArray(ex.instrucoes),
          };
        }),
        tecnicas: tecnicas.map((item) => {
          const tec = getRecord(item);
          return {
            nome: String(tec.nome || tec.tecnica || tec.titulo || tec.name || 'Técnica'),
            descricao: String(tec.descricao || tec.justificativa || ''),
            duracao: String(tec.duracao || tec.dosagem || ''),
            frequencia: String(tec.frequencia || d.frequencia_sugerida || ''),
            motivo: String(tec.motivo || tec.justificativa || ''),
            categoria: String(tec.categoria || tec.lente_clinica || 'referência'),
            ...(typeof tec.nivel_evidencia === 'string' ? { nivel_evidencia: tec.nivel_evidencia } : {}),
          };
        }),
      } satisfies DiretrizSnapshotPhase;
    }),
  };
}

export function getDiretrizSnapshotFromScores(scores: unknown): DiretrizSnapshot | null {
  const snapshot = getObjectValue(scores, 'diretriz_snapshot');
  const fases = getObjectValue(snapshot, 'fases');

  if (!snapshot || !Array.isArray(fases)) {
    return null;
  }

  return snapshot as DiretrizSnapshot;
}

export function createLegacyDiretrizSnapshot(params: {
  fases: any[];
  prescricoes: any[];
  tratamentos: any[];
}): DiretrizSnapshot | null {
  const { fases, prescricoes, tratamentos } = params;

  if (!Array.isArray(fases) || fases.length === 0) {
    return null;
  }

  const snapshotFases = fases
    .map((fase) => {
      const objetivos = Array.isArray(fase?.objetivos)
        ? fase.objetivos.filter((item: unknown) => typeof item === 'string')
        : [];

      const exercicios = (prescricoes || [])
        .filter((prescricao) => prescricao?.fase_id === fase.id)
        .map((prescricao) => ({
          nome: prescricao?.exercicio?.nome || 'Exercício',
          categoria: prescricao?.exercicio?.categoria || 'Exercício terapêutico',
          series: prescricao?.series || '-',
          repeticoes: prescricao?.repeticoes || '-',
          duracao: prescricao?.frequencia || '',
          motivo: '',
          descricao: prescricao?.exercicio?.descricao || prescricao?.observacoes || '',
          instrucoes: Array.isArray(prescricao?.exercicio?.instrucoes)
            ? prescricao.exercicio.instrucoes.filter((item: unknown) => typeof item === 'string')
            : [],
        }));

      const tecnicas = (tratamentos || [])
        .filter((tratamento) => tratamento?.fase_numero === fase.numero_fase && tratamento?.ativo !== false)
        .map((tratamento) => ({
          nome: tratamento?.tecnica?.nome || 'Técnica',
          descricao: tratamento?.tecnica?.descricao || tratamento?.observacoes || '',
          duracao: getStringFromObject(tratamento?.tecnica?.parametros, 'duracao'),
          frequencia: getStringFromObject(tratamento?.tecnica?.parametros, 'frequencia'),
          motivo: tratamento?.tecnica?.indicacoes || '',
          categoria: tratamento?.tecnica?.categoria || 'referencia',
        }));

      return {
        numero: fase?.numero_fase || 1,
        titulo: fase?.titulo || `Fase ${fase?.numero_fase || 1}`,
        semanas: `${fase?.semanas_inicio || 1}-${fase?.semanas_fim || 1}`,
        semanas_inicio: fase?.semanas_inicio || 1,
        semanas_fim: fase?.semanas_fim || 1,
        objetivo: objetivos[0] || 'Conduta terapêutica planejada.',
        demandasAlvo: objetivos.slice(1),
        frequenciaSemanal: fase?.sessoes_por_semana || 0,
        duracaoSessao: '',
        exercicios,
        tecnicas,
      } satisfies DiretrizSnapshotPhase;
    })
    .filter((fase) => fase.exercicios.length > 0 || fase.tecnicas.length > 0 || fase.objetivo);

  if (snapshotFases.length === 0) {
    return null;
  }

  return {
    versao: 0,
    createdAt: new Date().toISOString(),
    fases: snapshotFases,
  };
}

const summarizeItems = (items: string[]) => {
  if (items.length === 0) {
    return 'Nenhum item selecionado';
  }

  const preview = items.slice(0, 4).join(', ');
  return items.length > 4 ? `${preview} +${items.length - 4}` : preview;
};

export function buildDiretrizResumo(snapshot: DiretrizSnapshot): string {
  const linhas = snapshot.fases.map((fase) => {
    const exercicios = summarizeItems(fase.exercicios.map((item) => item.nome));
    const tecnicas = summarizeItems(fase.tecnicas.map((item) => item.nome));

    return [
      `Fase ${fase.numero} — ${fase.titulo}`,
      `Objetivo: ${fase.objetivo}`,
      `Exercícios (${fase.exercicios.length}): ${exercicios}`,
      `Técnicas (${fase.tecnicas.length}): ${tecnicas}`,
    ].join('\n');
  });

  return ['Diretriz personalizada salva como referência clínica.', ...linhas].join('\n\n');
}