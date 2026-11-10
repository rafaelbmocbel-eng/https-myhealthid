import { useEffect, useMemo, useReducer, useRef } from 'react';
import { parseNum } from '@/components/dosagem/comuns';
import { calcularResultados, medidasSalvas, opcoesPadraoDoLado, type AnaliseFoto, type ResultadoAnalise } from '@/lib/angular/analise';
import type { MedidaSalva } from '@/lib/angular/comparar';
import { cmPorPixel, rotacaoDoNivel, type OlharPara, type Ponto, type RefCompasso, type UnidadePrumo } from '@/lib/angular/medidas';
import type { Landmark } from '@/lib/angular/pose';
import { giroDaFoto } from '@/lib/angular/sensor';
import { novaSessaoId, previstasPadrao } from '@/lib/angular/sessao';
import { VISTAS_DA_SESSAO, vistaBaseDaSessao, type VistaSessao } from '@/lib/angular/tiposSessao';

/*
 * Sessão de avaliação postural em foto: UM item por posição (frente, perfil direito, perfil esquerdo, costas), cada um com
 * a sua foto, pontos, referências (nível e escala), pontos do modelo e o id da nota já gravada. Trocar de aba nunca mexe nos outros.
 * O reducer é puro: as URLs das fotos são revogadas pelo hook, depois que a tela deixa de usá-las.
 */

export interface FotoDaPosicao {
  /** Endereço `blob:` da foto (já reduzida). */
  url: string;
  w: number;
  h: number;
  img: HTMLImageElement;
}

/** O que a última marcação automática desta posição achou, para a tela mostrar em vez de calar. */
export interface SugestaoGuardada {
  avisos: string[];
  descartados: { medidaId: string; motivo: string }[];
  origens: Record<string, string>;
  /** Quantas medidas ficaram marcadas por esta sugestão (acumulado na posição). */
  marcadas: number;
}

export interface ItemPosicao {
  foto: FotoDaPosicao | null;
  /** Pontos de cada medida em px da foto, na ordem de marcação. */
  pontos: Record<string, Ponto[]>;
  /** Medida selecionada na barra de ferramentas ('' = a primeira da vista). */
  ativa: string;
  nivelTipo: 'horizontal' | 'vertical';
  escalaCm: string;
  /** Inclinação do celular ao fotografar (câmera do app); null se a foto veio da galeria. */
  inclinacaoCaptura: number | null;
  inverterSensor: boolean;
  /** Para onde o paciente olha na foto de perfil (lado da imagem). */
  olhaPara: OlharPara;
  /** Pontos do modelo da foto atual; servem para sugerir de novo sem detectar outra vez. */
  landmarks: Landmark[] | null;
  /** O profissional mandou trocar direito e esquerdo do modelo nesta foto. */
  inverterDE: boolean;
  /** Medidas cujos pontos vieram da sugestão automática. */
  sugeridas: string[];
  /** Medidas sugeridas cujos pontos o profissional depois moveu, desfez ou refez à mão. */
  ajustadas: string[];
  sugestao: SugestaoGuardada | null;
  /** Nota do prontuário desta posição; salvar de novo atualiza esta mesma nota. */
  notaId: string | null;
  /** Paciente dono de `notaId`: se o paciente mudar, a nota antiga não é atualizada. */
  notaPaciente: string | null;
  /** Gravada e sem mudança desde então. */
  salva: boolean;
  pulada: boolean;
}

export type VisaoDaSessao = 'posicao' | 'resumo';

export interface EstadoSessao {
  id: string;
  /** ISO de quando a sessão começou. */
  iniciadaEm: string;
  /** Posições planejadas, na ordem de fotografar. */
  previstas: VistaSessao[];
  atual: VistaSessao;
  visao: VisaoDaSessao;
  itens: Record<VistaSessao, ItemPosicao>;
  /** Valem para a sessão toda (as ferramentas de compasso e fio de prumo). */
  compassoRef: RefCompasso;
  unidadePrumo: UnidadePrumo;
}

export type ModoDeAplicar = 'vazias' | 'todas' | 'substituiveis';

export type AcaoSessao =
  | { tipo: 'ir'; posicao: VistaSessao }
  | { tipo: 'resumo' }
  | { tipo: 'foto'; posicao: VistaSessao; foto: FotoDaPosicao; inclinacao: number | null }
  | { tipo: 'ativar'; posicao: VistaSessao; medida: string }
  | { tipo: 'marcar'; posicao: VistaSessao; medida: string; ponto: Ponto }
  | { tipo: 'arrastar'; posicao: VistaSessao; medida: string; indice: number; ponto: Ponto }
  | { tipo: 'desfazer'; posicao: VistaSessao; medida: string }
  | { tipo: 'limpar'; posicao: VistaSessao; medida: string }
  | {
    tipo: 'sugestao'; posicao: VistaSessao; img: HTMLImageElement; pontos: Record<string, Ponto[]>; modo: ModoDeAplicar;
    landmarks?: Landmark[] | null; sugestao?: SugestaoGuardada; inverterDE?: boolean; olhaPara?: OlharPara; ativar?: string;
  }
  | { tipo: 'editar'; posicao: VistaSessao; mudanca: Partial<Pick<ItemPosicao, 'nivelTipo' | 'escalaCm' | 'inclinacaoCaptura' | 'inverterSensor' | 'olhaPara'>> }
  /** `sessaoId` e `item` são os da hora em que a nota foi montada: a gravação termina depois, e a tela pode ter mudado nesse meio-tempo. */
  | { tipo: 'salva'; posicao: VistaSessao; notaId: string; pacienteId: string; sessaoId: string; item: ItemPosicao }
  | { tipo: 'nao_salva'; posicao: VistaSessao; sessaoId: string }
  | { tipo: 'pular'; posicao: VistaSessao }
  | { tipo: 'opcoes'; compassoRef?: RefCompasso; unidadePrumo?: UnidadePrumo }
  | { tipo: 'reiniciar'; id: string; iniciadaEm: string };

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

export function itemVazio(posicao: VistaSessao): ItemPosicao {
  return {
    foto: null, pontos: {}, ativa: '', nivelTipo: 'horizontal', escalaCm: '', inclinacaoCaptura: null, inverterSensor: false,
    olhaPara: opcoesPadraoDoLado(vistaBaseDaSessao(posicao).lado).olhaPara,
    landmarks: null, inverterDE: false, sugeridas: [], ajustadas: [], sugestao: null,
    notaId: null, notaPaciente: null, salva: false, pulada: false,
  };
}

export function estadoInicial(id: string, iniciadaEm: string, opcoes?: Pick<EstadoSessao, 'compassoRef' | 'unidadePrumo'>): EstadoSessao {
  return {
    id, iniciadaEm, previstas: previstasPadrao(), atual: 'frente', visao: 'posicao',
    itens: Object.fromEntries(VISTAS_DA_SESSAO.map((p) => [p, itemVazio(p)])) as Record<VistaSessao, ItemPosicao>,
    compassoRef: opcoes?.compassoRef ?? 'baixo', unidadePrumo: opcoes?.unidadePrumo ?? 'graus',
  };
}

// ---------------------------------------------------------------------------
// Consultas puras sobre o estado
// ---------------------------------------------------------------------------

export const temPontos = (item: ItemPosicao, medida: string) => (item.pontos[medida]?.length ?? 0) > 0;

/** Alguma medida da posição tem ponto marcado (à mão ou sugerido). */
export const temMarcacao = (item: ItemPosicao) => Object.values(item.pontos).some((p) => p.length > 0);

/** Os pontos de alguma medida ainda vêm da sugestão automática (mesmo que ajustados). */
export const usouSugestao = (item: ItemPosicao) => item.sugeridas.some((id) => temPontos(item, id));

/** Medidas sugeridas e depois ajustadas à mão que ainda têm pontos. */
export const ajustadasDoItem = (item: ItemPosicao) => item.ajustadas.filter((id) => item.sugeridas.includes(id) && temPontos(item, id));

export type EstadoDaAba = 'sem_foto' | 'marcando' | 'salva' | 'pulada';

export function estadoDaAba(item: ItemPosicao): EstadoDaAba {
  if (item.pulada && !item.foto) return 'pulada';
  if (!item.foto) return 'sem_foto';
  return item.salva && !!item.notaId ? 'salva' : 'marcando';
}

/** Posições que continuam na sessão (as puladas saem). Dão a numeração "2 de 4" da nota. */
export const previstasEfetivas = (e: EstadoSessao): VistaSessao[] => e.previstas.filter((p) => !e.itens[p].pulada);

/** Ordem e total da posição entre as previstas que não foram puladas. */
export function ordemNaSessao(e: EstadoSessao, posicao: VistaSessao): { ordem: number; total: number } {
  const efetivas = previstasEfetivas(e);
  const i = efetivas.indexOf(posicao);
  if (i >= 0) return { ordem: i + 1, total: efetivas.length };
  const j = e.previstas.indexOf(posicao);
  return { ordem: (j >= 0 ? j : VISTAS_DA_SESSAO.indexOf(posicao)) + 1, total: Math.max(efetivas.length, 1) };
}

/**
 * Próxima posição a fotografar depois de `depoisDe`: a seguinte da ordem prevista que não tem foto e não foi pulada,
 * voltando ao início se for preciso. Null quando todas já têm foto ou foram puladas. `ignorar` lista posições que ainda não
 * aparecem no estado mas já foram fotografadas (a foto está sendo preparada).
 */
export function proximaPosicao(e: EstadoSessao, depoisDe: VistaSessao = e.atual, ignorar: readonly VistaSessao[] = []): VistaSessao | null {
  const ordem = e.previstas;
  const inicio = Math.max(ordem.indexOf(depoisDe), 0);
  for (let k = 1; k <= ordem.length; k++) {
    const p = ordem[(inicio + k) % ordem.length];
    if (p === depoisDe || ignorar.includes(p)) continue;
    const item = e.itens[p];
    if (!item.foto && !item.pulada) return p;
  }
  return null;
}

/** Alguma posição já tem foto: trocar o paciente ou reiniciar descartaria trabalho. */
export const algoPreenchido = (e: EstadoSessao) => VISTAS_DA_SESSAO.some((p) => !!e.itens[p].foto);

/** Há posição com marcação ainda não gravada (para avisar antes de fechar a página). */
export const temNaoSalva = (e: EstadoSessao) => VISTAS_DA_SESSAO.some((p) => {
  const item = e.itens[p];
  return !!item.foto && temMarcacao(item) && !item.salva;
});

/** Paciente a quem pertencem as notas já gravadas desta sessão; null se nada foi gravado. */
export const pacienteDaSessao = (e: EstadoSessao): string | null => VISTAS_DA_SESSAO.map((p) => e.itens[p].notaPaciente).find((x): x is string => !!x) ?? null;

/**
 * Das medidas sugeridas, as que `modo` manda aplicar na posição: 'vazias' só as sem ponto nenhum; 'substituiveis' as vazias e as
 * que ainda são exatamente a sugestão (nunca ajustadas); 'todas' todas. A tela usa a mesma função para contar e para perguntar.
 */
export function idsAplicaveis(item: ItemPosicao, ids: readonly string[], modo: ModoDeAplicar): string[] {
  if (modo === 'todas') return [...ids];
  if (modo === 'vazias') return ids.filter((id) => !temPontos(item, id));
  return ids.filter((id) => !temPontos(item, id) || (item.sugeridas.includes(id) && !item.ajustadas.includes(id)));
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const mudar = (e: EstadoSessao, posicao: VistaSessao, p: Partial<ItemPosicao>): EstadoSessao =>
  ({ ...e, itens: { ...e.itens, [posicao]: { ...e.itens[posicao], ...p } } });

const comAjustada = (item: ItemPosicao, medida: string) =>
  (item.sugeridas.includes(medida) && !item.ajustadas.includes(medida) ? [...item.ajustadas, medida] : item.ajustadas);

export function reducerSessao(e: EstadoSessao, a: AcaoSessao): EstadoSessao {
  switch (a.tipo) {
    case 'ir':
      return e.atual === a.posicao && e.visao === 'posicao' ? e : { ...e, atual: a.posicao, visao: 'posicao' };
    case 'resumo':
      return e.visao === 'resumo' ? e : { ...e, visao: 'resumo' };
    case 'foto': {
      const antes = e.itens[a.posicao];
      // A nota já gravada continua sendo a desta posição: salvar a foto nova atualiza a mesma nota.
      return mudar(e, a.posicao, { ...itemVazio(a.posicao), foto: a.foto, inclinacaoCaptura: a.inclinacao, notaId: antes.notaId, notaPaciente: antes.notaPaciente });
    }
    case 'ativar': {
      const item = e.itens[a.posicao];
      return item.ativa === a.medida ? e : mudar(e, a.posicao, { ativa: a.medida });
    }
    case 'marcar': {
      const item = e.itens[a.posicao];
      return mudar(e, a.posicao, { pontos: { ...item.pontos, [a.medida]: [...(item.pontos[a.medida] ?? []), a.ponto] }, salva: false });
    }
    case 'arrastar': {
      const item = e.itens[a.posicao];
      const lista = item.pontos[a.medida];
      if (!lista || !lista[a.indice]) return e;
      return mudar(e, a.posicao, {
        pontos: { ...item.pontos, [a.medida]: lista.map((q, i) => (i === a.indice ? a.ponto : q)) },
        ajustadas: comAjustada(item, a.medida), salva: false,
      });
    }
    case 'desfazer': {
      const item = e.itens[a.posicao];
      const lista = item.pontos[a.medida];
      if (!lista?.length) return e;
      return mudar(e, a.posicao, { pontos: { ...item.pontos, [a.medida]: lista.slice(0, -1) }, ajustadas: comAjustada(item, a.medida), salva: false });
    }
    case 'limpar': {
      const item = e.itens[a.posicao];
      if (!item.pontos[a.medida]?.length) return e;
      return mudar(e, a.posicao, { pontos: { ...item.pontos, [a.medida]: [] }, ajustadas: comAjustada(item, a.medida), salva: false });
    }
    case 'sugestao': {
      const item = e.itens[a.posicao];
      // A foto foi trocada enquanto o modelo trabalhava: o resultado é da foto antiga e não vale.
      if (!item.foto || item.foto.img !== a.img) return e;
      const aplicar = idsAplicaveis(item, Object.keys(a.pontos), a.modo);
      const pontos = { ...item.pontos };
      for (const id of aplicar) pontos[id] = a.pontos[id];
      const sugestao = a.sugestao ? { ...a.sugestao, marcadas: [...new Set([...item.sugeridas, ...aplicar])].filter((id) => (pontos[id]?.length ?? 0) > 0).length } : item.sugestao;
      return mudar(e, a.posicao, {
        pontos,
        sugeridas: [...new Set([...item.sugeridas, ...aplicar])],
        ajustadas: item.ajustadas.filter((id) => !aplicar.includes(id)),
        landmarks: a.landmarks === undefined ? item.landmarks : a.landmarks,
        inverterDE: a.inverterDE ?? item.inverterDE,
        olhaPara: a.olhaPara ?? item.olhaPara,
        sugestao,
        ativa: aplicar.length ? (a.ativar && aplicar.includes(a.ativar) ? a.ativar : aplicar[0]) : item.ativa,
        salva: aplicar.length ? false : item.salva,
      });
    }
    case 'editar': {
      const item = e.itens[a.posicao];
      return mudar(e, a.posicao, { ...a.mudanca, ...(item.foto ? { salva: false } : {}) });
    }
    case 'salva': {
      // Gravação de outra sessão (a sessão recomeçou no meio): a nota não pertence a esta.
      if (a.sessaoId !== e.id) return e;
      // Se a posição mudou depois de a nota ser montada, a nota fica guardada (o próximo "Atualizar" não duplica), mas a posição continua não salva.
      const igual = e.itens[a.posicao] === a.item;
      return mudar(e, a.posicao, { notaId: a.notaId, notaPaciente: a.pacienteId, ...(igual ? { salva: true } : {}) });
    }
    case 'nao_salva':
      return a.sessaoId !== e.id || !e.itens[a.posicao].salva ? e : mudar(e, a.posicao, { salva: false });
    case 'pular': {
      const item = e.itens[a.posicao];
      return item.foto || item.pulada ? e : mudar(e, a.posicao, { pulada: true });
    }
    case 'opcoes': {
      const compassoRef = a.compassoRef ?? e.compassoRef, unidadePrumo = a.unidadePrumo ?? e.unidadePrumo;
      if (compassoRef === e.compassoRef && unidadePrumo === e.unidadePrumo) return e;
      return { ...e, compassoRef, unidadePrumo };
    }
    case 'reiniciar':
      return estadoInicial(a.id, a.iniciadaEm, e);
    default:
      return e;
  }
}

// ---------------------------------------------------------------------------
// O que se calcula de cada posição (resultados, nível, escala)
// ---------------------------------------------------------------------------

const nf = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export interface ResumoDoItem {
  analise: AnaliseFoto;
  resultados: ResultadoAnalise[];
  /** Como ficam gravadas na nota: valor em módulo e o lado em `sentido`. */
  medidas: MedidaSalva[];
  giro: number | null;
  giroMarcado: number | null;
  giroSensor: number | null;
  origemGiro: string;
  cmPorPx: number | null;
  /** Frase da correção de nível aplicada; undefined sem correção. */
  notaNivel?: string;
  temResultado: boolean;
  temMarcacao: boolean;
  usouIA: boolean;
  /** Medidas sugeridas e ajustadas à mão. */
  ajustadas: string[];
}

const cache = new WeakMap<ItemPosicao, { chave: string; resumo: ResumoDoItem }>();

/** Cálculo completo de uma posição, guardado por item: só refaz quando os pontos ou as referências mudam. */
export function resumoDoItem(item: ItemPosicao, posicao: VistaSessao, compassoRef: RefCompasso, unidadePrumo: UnidadePrumo): ResumoDoItem {
  const chave = `${posicao}|${compassoRef}|${unidadePrumo}`;
  const guardado = cache.get(item);
  if (guardado && guardado.chave === chave) return guardado.resumo;

  const { vista, lado } = vistaBaseDaSessao(posicao);
  const nivel = item.pontos.nivel;
  const giroMarcado = nivel && nivel.length >= 2 ? rotacaoDoNivel(nivel[0], nivel[1], item.nivelTipo) : null;
  const giroSensor = item.inclinacaoCaptura !== null ? giroDaFoto(item.inclinacaoCaptura, item.inverterSensor) : null;
  const giro = giroMarcado ?? giroSensor;
  const origemGiro = giroMarcado !== null ? 'por uma referência marcada na foto' : 'pelo sensor do celular ao fotografar';
  const escala = item.pontos.escala, cm = parseNum(item.escalaCm);
  const cmPorPx = escala && escala.length >= 2 && cm ? cmPorPixel(escala[0], escala[1], cm) : null;
  const analise: AnaliseFoto = {
    vista, ...(vista === 'perfil' && lado ? { lado } : {}),
    largura: item.foto?.w ?? 0, altura: item.foto?.h ?? 0, imagem: item.foto?.img ?? null,
    pontos: item.pontos, giro, cmPorPx, opcoes: { compassoRef, unidadePrumo, olhaPara: item.olhaPara },
  };
  const resultados = calcularResultados(analise);
  const medidas = medidasSalvas(resultados);
  const resumo: ResumoDoItem = {
    analise, resultados, medidas, giro, giroMarcado, giroSensor, origemGiro, cmPorPx,
    ...(giro !== null && Math.abs(giro) >= 0.05
      ? { notaNivel: `Foto nivelada ${origemGiro} (correção de ${nf(Math.abs(giro))}°); os ângulos valem para acompanhar a evolução entre fotos feitas do mesmo jeito.` }
      : {}),
    temResultado: medidas.length > 0, temMarcacao: temMarcacao(item), usouIA: usouSugestao(item), ajustadas: ajustadasDoItem(item),
  };
  cache.set(item, { chave, resumo });
  return resumo;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const urlsDoEstado = (e: EstadoSessao) => VISTAS_DA_SESSAO.flatMap((p) => e.itens[p].foto?.url ?? []);

export function useSessaoPostural() {
  const [estado, dispatch] = useReducer(reducerSessao, undefined, () => estadoInicial(novaSessaoId(), new Date().toISOString()));
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // Revoga a URL de toda foto que saiu do estado (trocada ou descartada) e todas ao desmontar.
  const urlsVivas = useRef(new Set<string>());
  useEffect(() => {
    const agora = new Set(urlsDoEstado(estado));
    for (const u of urlsVivas.current) if (!agora.has(u)) URL.revokeObjectURL(u);
    urlsVivas.current = agora;
  }, [estado]);
  useEffect(() => () => { for (const u of urlsVivas.current) URL.revokeObjectURL(u); urlsVivas.current = new Set(); }, []);

  const pendente = temNaoSalva(estado);
  useEffect(() => {
    if (!pendente) return;
    const aviso = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [pendente]);

  const acoes = useMemo(() => ({
    ir: (posicao: VistaSessao) => dispatch({ tipo: 'ir', posicao }),
    abrirResumo: () => dispatch({ tipo: 'resumo' }),
    definirFoto: (posicao: VistaSessao, foto: FotoDaPosicao, inclinacao: number | null = null) => dispatch({ tipo: 'foto', posicao, foto, inclinacao }),
    ativar: (posicao: VistaSessao, medida: string) => dispatch({ tipo: 'ativar', posicao, medida }),
    marcar: (posicao: VistaSessao, medida: string, ponto: Ponto) => dispatch({ tipo: 'marcar', posicao, medida, ponto }),
    arrastar: (posicao: VistaSessao, medida: string, indice: number, ponto: Ponto) => dispatch({ tipo: 'arrastar', posicao, medida, indice, ponto }),
    desfazer: (posicao: VistaSessao, medida: string) => dispatch({ tipo: 'desfazer', posicao, medida }),
    limpar: (posicao: VistaSessao, medida: string) => dispatch({ tipo: 'limpar', posicao, medida }),
    aplicarSugestao: (a: Omit<Extract<AcaoSessao, { tipo: 'sugestao' }>, 'tipo'>) => dispatch({ tipo: 'sugestao', ...a }),
    editar: (posicao: VistaSessao, mudanca: Extract<AcaoSessao, { tipo: 'editar' }>['mudanca']) => dispatch({ tipo: 'editar', posicao, mudanca }),
    marcarSalva: (a: Omit<Extract<AcaoSessao, { tipo: 'salva' }>, 'tipo'>) => dispatch({ tipo: 'salva', ...a }),
    desmarcarSalva: (posicao: VistaSessao, sessaoId: string) => dispatch({ tipo: 'nao_salva', posicao, sessaoId }),
    pular: (posicao: VistaSessao) => dispatch({ tipo: 'pular', posicao }),
    definirOpcoes: (o: { compassoRef?: RefCompasso; unidadePrumo?: UnidadePrumo }) => dispatch({ tipo: 'opcoes', ...o }),
    reiniciar: () => dispatch({ tipo: 'reiniciar', id: novaSessaoId(), iniciadaEm: new Date().toISOString() }),
  }), []);

  const atual = estado.itens[estado.atual];
  const resumo = resumoDoItem(atual, estado.atual, estado.compassoRef, estado.unidadePrumo);
  const resumos = useMemo(
    () => Object.fromEntries(VISTAS_DA_SESSAO.map((p) => [p, resumoDoItem(estado.itens[p], p, estado.compassoRef, estado.unidadePrumo)])) as Record<VistaSessao, ResumoDoItem>,
    [estado.itens, estado.compassoRef, estado.unidadePrumo],
  );

  return { estado, estadoRef, acoes, atual, resumo, resumos };
}

export type AcoesDaSessao = ReturnType<typeof useSessaoPostural>['acoes'];
