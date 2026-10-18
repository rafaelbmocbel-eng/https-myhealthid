/*
 * Salvar e retomar a análise em vídeo. O vídeo nunca é guardado (fica só no aparelho do profissional); o que se
 * salva é a trilha de pontos (com as correções), os eventos editados e as medidas feitas à mão, num arquivo JSON
 * pequeno. Ao abrir de novo o mesmo vídeo, a "impressão" do arquivo (tamanho, duração e dimensões) confere
 * que a análise é daquele vídeo.
 */

import { lerTrilha, serializarTrilha } from '@/lib/angular/video/trilha';
import type { EventoPasso } from '@/lib/angular/video/eventos';
import type { TrilhaPose } from '@/lib/angular/video/tipos';
import type { CriterioProfissional, IdProtocolo } from '@/lib/angular/movimento/tipos';
import { lerCriteriosSalvos, lerProtocoloSalvo } from './criteriosSalvos';

export const APP_ANALISE = 'myhealthid-analise-video';
export const VERSAO_ANALISE = 1;

export interface ImpressaoVideo { nome: string; tamanho: number; duracao: number; largura: number; altura: number }



export interface AnaliseSalva {
  app: typeof APP_ANALISE;
  versao: number;
  salvoEm: string;
  video: ImpressaoVideo;
  modeloId: string;
  /** Quadros por segundo do arquivo de vídeo informados pelo profissional. */
  fpsVideo: number;
  intervalo: { inicio: number; fim: number };
  trilha: TrilhaPose;
  /** Eventos do ciclo como estavam (sugeridos e editados); null se nunca foram detectados. */
  eventos: EventoPasso[] | null;
  /** Centímetros por pixel (calibração de escala), se houver. */
  cmPorPx: number | null;
  /** Dados da interface que não afetam o cálculo (articulação aberta, medidas manuais etc.). */
  extras: Record<string, unknown>;
  /** Etapa 3 (opcional): critérios do profissional e protocolo do laudo. Arquivos antigos não os têm e abrem normalmente. */
  criterios?: CriterioProfissional[];
  protocoloMovimento?: IdProtocolo;
}

export type EntradaAnalise = Omit<AnaliseSalva, 'app' | 'versao' | 'salvoEm'> & { salvoEm?: string };

/** Texto do arquivo .json da análise. A trilha usa o formato compacto do motor (`serializarTrilha`), com quadros-chave e detecção original. */
export function serializarAnalise(a: EntradaAnalise): string {
  const { trilha, ...resto } = a;
  return JSON.stringify({ ...resto, app: APP_ANALISE, versao: VERSAO_ANALISE, salvoEm: a.salvoEm ?? new Date().toISOString(), trilha: JSON.parse(serializarTrilha(trilha)) });
}

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function impressaoValida(v: unknown): v is ImpressaoVideo {
  return ehObjeto(v) && typeof v.nome === 'string' && ehNumero(v.tamanho) && ehNumero(v.duracao) && ehNumero(v.largura) && ehNumero(v.altura);
}

function eventosValidos(v: unknown): v is EventoPasso[] {
  return Array.isArray(v) && v.every((e) => ehObjeto(e) && typeof e.id === 'string' && (e.tipo === 'contato' || e.tipo === 'saida') && (e.lado === 'D' || e.lado === 'E') && ehNumero(e.t) && ehNumero(e.i) && typeof e.sugerido === 'boolean');
}

export type ResultadoLeitura = { ok: true; analise: AnaliseSalva } | { ok: false; erro: string };

/** Lê o texto de um arquivo salvo, conferindo a estrutura. Nunca lança. */
export function lerAnaliseSalva(texto: string): ResultadoLeitura {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    // Arquivo que não é JSON (outro tipo de arquivo ou cortado).
    return { ok: false, erro: 'Esse arquivo não é uma análise salva do app.' };
  }
  if (!ehObjeto(bruto) || bruto.app !== APP_ANALISE) return { ok: false, erro: 'Esse arquivo não é uma análise salva do app.' };
  if (!ehNumero(bruto.versao) || bruto.versao > VERSAO_ANALISE) return { ok: false, erro: 'Esse arquivo foi salvo por uma versão mais nova do app. Atualize a página e tente de novo.' };
  if (!impressaoValida(bruto.video) || typeof bruto.modeloId !== 'string') return { ok: false, erro: 'A análise salva está incompleta ou danificada.' };
  let trilha: TrilhaPose;
  try {
    trilha = lerTrilha(bruto.trilha);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'A trilha da análise está danificada.' };
  }
  if (!trilha.quadros.length) return { ok: false, erro: 'A análise salva não tem nenhum quadro.' };
  const intervalo = ehObjeto(bruto.intervalo) && ehNumero(bruto.intervalo.inicio) && ehNumero(bruto.intervalo.fim) ? { inicio: bruto.intervalo.inicio, fim: bruto.intervalo.fim } : { inicio: 0, fim: bruto.video.duracao };
  const criterios = lerCriteriosSalvos(bruto.criterios);
  const protocoloMovimento = lerProtocoloSalvo(bruto.protocoloMovimento);
  return {
    ok: true,
    analise: {
      ...(criterios ? { criterios } : {}), ...(protocoloMovimento ? { protocoloMovimento } : {}),
      app: APP_ANALISE, versao: bruto.versao, salvoEm: typeof bruto.salvoEm === 'string' ? bruto.salvoEm : '',
      video: bruto.video, modeloId: bruto.modeloId, fpsVideo: ehNumero(bruto.fpsVideo) && bruto.fpsVideo > 0 ? bruto.fpsVideo : trilha.fps,
      intervalo, trilha, eventos: eventosValidos(bruto.eventos) ? bruto.eventos : null,
      cmPorPx: ehNumero(bruto.cmPorPx) && bruto.cmPorPx > 0 ? bruto.cmPorPx : null,
      extras: ehObjeto(bruto.extras) ? bruto.extras : {},
    },
  };
}

/** A análise salva é deste vídeo? Compara tamanho, dimensões e duração (o nome pode mudar ao compartilhar o arquivo). */
export function mesmaImpressao(a: ImpressaoVideo, b: ImpressaoVideo): boolean {
  const tamanhoIgual = a.tamanho <= 0 || b.tamanho <= 0 || a.tamanho === b.tamanho;
  return tamanhoIgual && a.largura === b.largura && a.altura === b.altura && Math.abs(a.duracao - b.duracao) <= 0.1;
}

/** Chave estável do rascunho automático deste vídeo. */
export const chaveDoRascunho = (v: ImpressaoVideo): string => `${v.tamanho}-${v.largura}x${v.altura}-${v.duracao.toFixed(2)}`;

export function nomeArquivoAnalise(modeloId: string, data: Date = new Date()): string {
  const d = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  return `analise-video-${modeloId.replace(/[^\w-]+/g, '_')}-${d}.json`;
}
