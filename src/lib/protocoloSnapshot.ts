import type { ProtocoloAnalise } from '@/utils/demandasAnalyzer';

export interface DiretrizSnapshotExercise {
  nome: string;
  categoria: string;
  series: number | string;
  repeticoes: number | string;
  duracao: string;
  motivo: string;
  descricao: string;
  instrucoes: string[];
}

export interface DiretrizSnapshotTechnique {
  nome: string;
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
  frequenciaSemanal: number;
  duracaoSessao: string;
  exercicios: DiretrizSnapshotExercise[];
  tecnicas: DiretrizSnapshotTechnique[];
}

export interface DiretrizSnapshot {
  versao: number;
  createdAt: string;
  fases: DiretrizSnapshotPhase[];
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