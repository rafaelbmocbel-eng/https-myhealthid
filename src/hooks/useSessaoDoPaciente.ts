import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { imagemParaPdf } from '@/lib/angular/analise';
import type { EstiloMarcacao } from '@/lib/angular/estilo';
import { gerarRelatorioAngular } from '@/lib/angular/relatorio';
import { LARGURA_MAX_FOTO_PDF, gerarRelatorioSessao, type VistaDoRelatorioSessao } from '@/lib/angular/relatorioSessao';
import { entregarPdf } from '@/lib/pdf/entrega';
import {
  agruparPorSessao, classificarPontos, dataDaSessao, descricaoDaNota, montarDadosExtras, novaSessaoId, tituloDaNota,
  type DadosExtrasFoto, type MetodoAnalise, type NotaDeAnalise, type PontosDaPosicao, type SessaoAgrupada,
} from '@/lib/angular/sessao';
import { ESQUEMA_ANALISE_FOTO, ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, vistaBaseDaSessao, type VistaSessao } from '@/lib/angular/tiposSessao';
import { compararSessoes, type ComparacaoSessoes, type SessaoParaComparar } from '@/lib/angular/comparar';
import { tabela } from '@/lib/dosagem/db';
import {
  ordemNaSessao, pacienteDaSessao, previstasEfetivas, resumoDoItem, type AcoesDaSessao, type EstadoSessao, type ItemPosicao, type ResumoDoItem,
} from '@/hooks/useSessaoPostural';

export const chaveDoHistorico = (pacienteId: string) => ['analise-angular-historico', pacienteId];

/** Quantas notas de análise angular o histórico pede: a lista mistura vídeo e foto, e cada sessão usa até quatro notas. */
export const LIMITE_DO_HISTORICO = 300;

/**
 * Sessões anteriores do paciente, da mais recente para a mais antiga. A consulta é só por tipo; o agrupamento por sessão
 * (e o descarte das notas de vídeo, que não têm vista) acontece aqui no navegador.
 */
export function useHistoricoDeSessoes(pacienteId: string) {
  const { data = [], isLoading } = useQuery({
    queryKey: chaveDoHistorico(pacienteId),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data: linhas, error } = await tabela('notas_prontuario').select('id, created_at, dados_extras')
        .eq('paciente_id', pacienteId).eq('tipo', 'analise_angular').order('created_at', { ascending: false }).limit(LIMITE_DO_HISTORICO);
      if (error) throw error;
      return (linhas ?? []) as NotaDeAnalise[];
    },
  });
  const sessoes = useMemo(() => agruparPorSessao(data), [data]);
  return { sessoes, carregando: isLoading };
}

export interface NotaMontada {
  titulo: string;
  descricao: string;
  dados_extras: DadosExtrasFoto;
  /** Id da sessão: liga as notas de uma avaliação e permite achá-las juntas. */
  referencia_id: string;
}

/**
 * Como os pontos da posição foram marcados, contando só as medidas que entram no resultado. "Automático" quer dizer que alguma medida do
 * resultado veio da sugestão do modelo: se a única sugestão ficou incompleta, o que está na nota foi feito à mão.
 */
function pontosDoItem(item: ItemPosicao, r: ResumoDoItem): { metodo: MetodoAnalise; pontos: PontosDaPosicao } {
  const pontos = classificarPontos(r.resultados.map((x) => x.medidaId), item.sugeridas, item.ajustadas);
  return { metodo: pontos.sugeridas.length > 0 ? 'automatica_conferida' : 'marcacao_manual', pontos };
}

/**
 * A nota do prontuário de uma posição: título com a posição, texto, `dados_extras` do esquema 2 e a sessão. Null sem nenhuma medida pronta.
 * "Método automático" quer dizer que algum ponto veio da sugestão do modelo; a nota diz quantas medidas foram ajustadas à mão,
 * e não afirma que o profissional conferiu, porque o aplicativo não verifica isso.
 */
export function montarNotaDaPosicao(e: EstadoSessao, posicao: VistaSessao): NotaMontada | null {
  const item = e.itens[posicao];
  const r = resumoDoItem(item, posicao, e.compassoRef, e.unidadePrumo);
  if (!r.temResultado) return null;
  const { vista, lado } = vistaBaseDaSessao(posicao);
  const { ordem } = ordemNaSessao(e, posicao);
  const { metodo, pontos } = pontosDoItem(item, r);
  const automatico = metodo === 'automatica_conferida';
  return {
    titulo: tituloDaNota(posicao),
    descricao: descricaoDaNota({ medidasTexto: r.medidas.map((m) => `• ${m.texto}`).join('\n'), metodo, nivelNota: r.notaNivel, pontos: automatico ? pontos : null }),
    dados_extras: montarDadosExtras({
      vista, lado, medidas: r.medidas, metodo, nivelGraus: r.giro, escalaCmPorPx: r.cmPorPx, opcoes: r.analise.opcoes,
      sessao: { id: e.id, ordem, previstas: previstasEfetivas(e), iniciadaEm: e.iniciadaEm },
      pontosAjustados: automatico ? pontos.ajustadas : null,
    }),
    referencia_id: e.id,
  };
}

interface Destino { id: string; nome: string }

const CONFLITO_DE_CHAVE = '23505';
const MSG_NOTA_REGRAVADA = 'A nota anterior desta posição não foi encontrada no prontuário; gravei de novo.';
const MSG_NOTA_BLOQUEADA = 'Não consegui atualizar esta posição: a nota anterior existe, mas você não pode alterá-la.';

interface ErroDoBanco { message?: string; code?: string }

/** Atualiza a nota; false quando nenhuma linha casou (nota excluída ou fora do alcance deste profissional), que o banco não trata como erro. */
async function atualizarNota(id: string, pacienteId: string, nota: NotaMontada): Promise<boolean> {
  const { data, error } = await tabela('notas_prontuario')
    .update({ titulo: nota.titulo, descricao: nota.descricao, dados_extras: nota.dados_extras, referencia_id: nota.referencia_id })
    .eq('id', id).eq('paciente_id', pacienteId).select('id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function inserirNota(id: string, pacienteId: string, userId: string, nota: NotaMontada): Promise<ErroDoBanco | null> {
  const { error } = await tabela('notas_prontuario').insert({
    id, paciente_id: pacienteId, terapeuta_id: userId, tipo: 'analise_angular',
    titulo: nota.titulo, descricao: nota.descricao, dados_extras: nota.dados_extras, referencia_id: nota.referencia_id,
  });
  return error ?? null;
}

type Desfecho = 'salva' | 'atualizada' | 'regravada';

/**
 * Grava uma posição no prontuário: insere na primeira vez e, depois, ATUALIZA a mesma nota (o id fica guardado na posição),
 * então tocar duas vezes nunca cria duas notas. O id da nota nasce no navegador e fica guardado entre tentativas: se o insert
 * chegou ao servidor e a resposta se perdeu, a nova tentativa cai em conflito de chave e segue para o update da mesma nota.
 * Update que não casa nenhuma linha (a nota foi excluída no prontuário) grava a posição de novo com o mesmo id.
 */
export function useGravarPosicao(o: { estadoRef: MutableRefObject<EstadoSessao>; acoes: AcoesDaSessao; paciente: Destino | null | undefined; userId: string | undefined }) {
  const { estadoRef, acoes, paciente, userId } = o;
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState<VistaSessao | null>(null);
  const emAndamento = useRef(new Set<VistaSessao>());
  const idsTentados = useRef(new Map<string, string>());

  const salvar = useCallback(async (posicao: VistaSessao): Promise<boolean> => {
    if (!paciente || !userId || emAndamento.current.has(posicao)) return false;
    const e = estadoRef.current;
    const dono = pacienteDaSessao(e);
    if (dono && dono !== paciente.id) {
      toast.error('Esta sessão já tem posições salvas de outro paciente. Reinicie a sessão para salvar neste paciente.');
      return false;
    }
    const nota = montarNotaDaPosicao(e, posicao);
    if (!nota) return false;
    const item = e.itens[posicao];
    const existente = item.notaId && item.notaPaciente === paciente.id ? item.notaId : null;
    const chaveDoId = `${e.id}|${paciente.id}|${posicao}`;
    emAndamento.current.add(posicao);
    setSalvando(posicao);
    try {
      let notaId: string;
      let desfecho: Desfecho;
      if (existente) {
        notaId = existente;
        if (await atualizarNota(existente, paciente.id, nota)) {
          desfecho = 'atualizada';
        } else {
          const erroAoRegravar = await inserirNota(existente, paciente.id, userId, nota);
          if (erroAoRegravar) {
            acoes.desmarcarSalva(posicao, e.id);
            throw erroAoRegravar.code === CONFLITO_DE_CHAVE ? new Error(MSG_NOTA_BLOQUEADA) : erroAoRegravar;
          }
          desfecho = 'regravada';
        }
      } else {
        notaId = idsTentados.current.get(chaveDoId) ?? novaSessaoId();
        idsTentados.current.set(chaveDoId, notaId);
        const erroAoInserir = await inserirNota(notaId, paciente.id, userId, nota);
        if (erroAoInserir && erroAoInserir.code !== CONFLITO_DE_CHAVE) throw erroAoInserir;
        if (erroAoInserir && !(await atualizarNota(notaId, paciente.id, nota))) throw new Error(MSG_NOTA_BLOQUEADA);
        desfecho = 'salva';
      }
      acoes.marcarSalva({ posicao, notaId, pacienteId: paciente.id, sessaoId: e.id, item });
      if (desfecho === 'regravada') toast.warning(MSG_NOTA_REGRAVADA);
      else toast.success(desfecho === 'atualizada' ? `Posição atualizada no prontuário de ${paciente.nome}.` : `Posição salva no prontuário de ${paciente.nome}.`);
      void qc.invalidateQueries({ queryKey: chaveDoHistorico(paciente.id) });
      return true;
    } catch (erro) {
      toast.error((erro as ErroDoBanco)?.message || 'Não foi possível salvar.');
      return false;
    } finally {
      emAndamento.current.delete(posicao);
      setSalvando((s) => (s === posicao ? null : s));
    }
  }, [acoes, estadoRef, paciente, qc, userId]);

  return { salvando, salvar };
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A sessão em andamento contra a avaliação anterior, como a tela monta a comparação: medidas e correção de nível de cada posição feita. */
function compararParaRelatorio(e: EstadoSessao, anterior: SessaoAgrupada | null): { comparacao: ComparacaoSessoes; feitas: VistaSessao[] } | null {
  if (!anterior) return null;
  const posicoes: SessaoParaComparar['posicoes'] = {};
  const feitas: VistaSessao[] = [];
  for (const posicao of VISTAS_DA_SESSAO) {
    const r = resumoDoItem(e.itens[posicao], posicao, e.compassoRef, e.unidadePrumo);
    if (!r.temResultado) continue;
    posicoes[posicao] = { medidas: r.medidas, nivelGraus: r.giro };
    feitas.push(posicao);
  }
  return { comparacao: compararSessoes({ esquema: ESQUEMA_ANALISE_FOTO, posicoes }, anterior), feitas };
}

/**
 * Avisos de comparabilidade que o PDF imprime fora das posições: o que `compararSessoes` diz da posição que só existia na avaliação
 * anterior (não há bloco para ela no relatório) e os avisos da comparação toda (formatos diferentes, perfil antigo sem lado).
 */
export function avisosGeraisDoRelatorio(e: EstadoSessao, anterior: SessaoAgrupada | null): string[] {
  const c = compararParaRelatorio(e, anterior);
  if (!c) return [];
  const semBloco = c.comparacao.posicoes.filter((p) => !(c.feitas as string[]).includes(p.posicao));
  return [...semBloco.flatMap((p) => p.avisos), ...c.comparacao.avisos].map((a) => a.texto);
}

/**
 * As posições com medidas, no formato do PDF da sessão. `anterior` liga as colunas "Antes" e "Variação" de cada posição que a
 * avaliação anterior também tem; a foto só entra se `comFoto` e se a posição ainda tem a foto na memória.
 */
export function vistasDoRelatorio(e: EstadoSessao, o: { anterior: SessaoAgrupada | null; comFoto: boolean; estilo: EstiloMarcacao }): VistaDoRelatorioSessao[] {
  const comparacao = compararParaRelatorio(e, o.anterior)?.comparacao;
  return VISTAS_DA_SESSAO.flatMap((posicao): VistaDoRelatorioSessao[] => {
    const item = e.itens[posicao];
    const r = resumoDoItem(item, posicao, e.compassoRef, e.unidadePrumo);
    if (!r.temResultado) return [];
    const antes = o.anterior?.posicoes[posicao];
    const imagem = o.comFoto && item.foto ? imagemParaPdf(r.analise, o.estilo, LARGURA_MAX_FOTO_PDF)?.url ?? null : null;
    const { metodo, pontos } = pontosDoItem(item, r);
    const avisos = (comparacao?.posicoes.find((c) => c.posicao === posicao)?.avisos ?? []).map((a) => a.texto);
    return [{
      posicao, vistaNome: ROTULO_VISTA_SESSAO[posicao], medidas: r.medidas,
      anterior: o.anterior && antes?.medidas.length ? { data: dataDaSessao(o.anterior.iniciadaEm), medidas: antes.medidas } : null,
      imagem,
      metodo,
      ...(metodo === 'automatica_conferida' ? { pontos } : {}),
      ...(r.notaNivel ? { notaNivel: minuscula(r.notaNivel) } : {}),
      ...(avisos.length ? { avisos } : {}),
    }];
  });
}

/** O que a tela mostra ao comparar só esta posição com a avaliação anterior: os avisos da posição e os da comparação toda. */
function avisosDaPosicao(posicao: VistaSessao, resumo: ResumoDoItem, anterior: SessaoAgrupada | null): string[] {
  const antes = anterior?.posicoes[posicao];
  if (!anterior || !antes || !resumo.temResultado) return [];
  const comparacao = compararSessoes(
    { esquema: ESQUEMA_ANALISE_FOTO, posicoes: { [posicao]: { medidas: resumo.medidas, nivelGraus: resumo.giro } } },
    { esquema: anterior.esquema, posicoes: { [posicao]: antes } },
  );
  return [...comparacao.posicoes.flatMap((c) => c.avisos), ...comparacao.avisos].map((a) => a.texto);
}

interface PacienteDoPdf extends Destino { sobrenome?: string | null }

const hojeBR = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/**
 * PDF da posição que está na tela (o relatório de uma vista, como sempre) e PDF da sessão (todas as posições com medidas, com
 * a comparação com a avaliação anterior e, se pedido, as fotos). Sem paciente os dois funcionam, só que sem o vínculo com o cadastro.
 */
export function useRelatoriosDaSessao(o: {
  estadoRef: MutableRefObject<EstadoSessao>;
  posicao: VistaSessao;
  resumo: ResumoDoItem;
  temFoto: boolean;
  paciente: PacienteDoPdf | null | undefined;
  profile: { nome: string; sobrenome?: string | null; crefito?: string | null } | null | undefined;
  estilo: EstiloMarcacao;
  comFoto: boolean;
  anteriorDaPosicao: SessaoAgrupada | null;
  anteriorDoResumo: SessaoAgrupada | null;
}) {
  const { estadoRef, posicao, resumo, temFoto, paciente, profile, estilo, comFoto, anteriorDaPosicao, anteriorDoResumo } = o;
  const [gerando, setGerando] = useState(false);
  const pacienteNome = paciente ? `${paciente.nome} ${paciente.sobrenome ?? ''}`.trim() : 'Paciente';
  const profissional = profile ? `${profile.nome} ${profile.sobrenome || ''}`.trim() + (profile.crefito ? ` · CREFITO ${profile.crefito}` : '') : undefined;

  const gerarPdf = async () => {
    if (!temFoto || !resumo.temResultado) return;
    setGerando(true);
    try {
      const imagem = comFoto ? imagemParaPdf(resumo.analise, estilo) : null;
      const antes = anteriorDaPosicao?.posicoes[posicao];
      const { metodo, pontos } = pontosDoItem(estadoRef.current.itens[posicao], resumo);
      const avisos = avisosDaPosicao(posicao, resumo, anteriorDaPosicao);
      const { blob, nome } = await gerarRelatorioAngular({
        paciente: pacienteNome, profissional, data: hojeBR(),
        vistaNome: ROTULO_VISTA_SESSAO[posicao].toLowerCase(),
        medidas: resumo.medidas,
        metodo, ...(metodo === 'automatica_conferida' ? { pontos } : {}),
        anterior: anteriorDaPosicao && antes?.medidas.length ? { data: dataDaSessao(anteriorDaPosicao.iniciadaEm), medidas: antes.medidas } : null,
        imagem,
        notaExtra: resumo.notaNivel,
        ...(avisos.length ? { avisos } : {}),
      });
      entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: 'Análise angular' });
    } catch {
      toast.error('Não consegui gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const gerarPdfDaSessao = async () => {
    setGerando(true);
    try {
      const vistas = vistasDoRelatorio(estadoRef.current, { anterior: anteriorDoResumo, comFoto, estilo });
      if (!vistas.length) { toast.error('Complete uma medida em alguma posição para gerar o PDF.'); return; }
      const avisosGerais = avisosGeraisDoRelatorio(estadoRef.current, anteriorDoResumo);
      const { blob, nome } = await gerarRelatorioSessao({ paciente: pacienteNome, profissional, data: hojeBR(), vistas, ...(avisosGerais.length ? { avisosGerais } : {}) });
      entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: 'Análise angular da sessão' });
    } catch {
      toast.error('Não consegui gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  return { gerando, gerarPdf, gerarPdfDaSessao };
}
