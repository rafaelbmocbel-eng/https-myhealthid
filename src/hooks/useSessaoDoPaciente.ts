import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { imagemParaPdf } from '@/lib/angular/analise';
import type { EstiloMarcacao } from '@/lib/angular/estilo';
import { gerarRelatorioAngular } from '@/lib/angular/relatorio';
import { LARGURA_MAX_FOTO_PDF, gerarRelatorioSessao, type VistaDoRelatorioSessao } from '@/lib/angular/relatorioSessao';
import { entregarPdf } from '@/lib/pdf/entrega';
import {
  agruparPorSessao, dataDaSessao, descricaoDaNota, montarDadosExtras, novaSessaoId, tituloDaNota,
  type DadosExtrasFoto, type NotaDeAnalise, type SessaoAgrupada,
} from '@/lib/angular/sessao';
import { ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, vistaBaseDaSessao, type VistaSessao } from '@/lib/angular/tiposSessao';
import { tabela } from '@/lib/dosagem/db';
import {
  ordemNaSessao, pacienteDaSessao, previstasEfetivas, resumoDoItem, type AcoesDaSessao, type EstadoSessao, type ResumoDoItem,
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
 * A nota do prontuário de uma posição: título "(n de total)", texto, `dados_extras` do esquema 2 e a sessão. Null sem nenhuma medida pronta.
 * "Método automático" quer dizer que algum ponto veio da sugestão do modelo; a nota diz quantas medidas foram ajustadas à mão,
 * e não afirma que o profissional conferiu, porque o aplicativo não verifica isso.
 */
export function montarNotaDaPosicao(e: EstadoSessao, posicao: VistaSessao): NotaMontada | null {
  const item = e.itens[posicao];
  const r = resumoDoItem(item, posicao, e.compassoRef, e.unidadePrumo);
  if (!r.temResultado) return null;
  const { vista, lado } = vistaBaseDaSessao(posicao);
  const { ordem, total } = ordemNaSessao(e, posicao);
  const metodo = r.usouIA ? 'automatica_conferida' as const : 'marcacao_manual' as const;
  const ajustadas = r.usouIA ? r.ajustadas : null;
  return {
    titulo: tituloDaNota(posicao, ordem, total),
    descricao: descricaoDaNota({ medidasTexto: r.medidas.map((m) => `• ${m.texto}`).join('\n'), metodo, nivelNota: r.notaNivel, pontosAjustados: ajustadas }),
    dados_extras: montarDadosExtras({
      vista, lado, medidas: r.medidas, metodo, nivelGraus: r.giro, escalaCmPorPx: r.cmPorPx, opcoes: r.analise.opcoes,
      sessao: { id: e.id, ordem, previstas: previstasEfetivas(e), iniciadaEm: e.iniciadaEm },
      pontosAjustados: ajustadas,
    }),
    referencia_id: e.id,
  };
}

interface Destino { id: string; nome: string }

/**
 * Grava uma posição no prontuário: insere na primeira vez e, depois, ATUALIZA a mesma nota (o id fica guardado na posição),
 * então tocar duas vezes nunca cria duas notas. O id da nota nasce no navegador para não depender da resposta do insert.
 */
export function useGravarPosicao(o: { estadoRef: MutableRefObject<EstadoSessao>; acoes: AcoesDaSessao; paciente: Destino | null | undefined; userId: string | undefined }) {
  const { estadoRef, acoes, paciente, userId } = o;
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState<VistaSessao | null>(null);
  const emAndamento = useRef(new Set<VistaSessao>());

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
    emAndamento.current.add(posicao);
    setSalvando(posicao);
    try {
      let notaId = existente;
      if (notaId) {
        const { error } = await tabela('notas_prontuario')
          .update({ titulo: nota.titulo, descricao: nota.descricao, dados_extras: nota.dados_extras, referencia_id: nota.referencia_id })
          .eq('id', notaId).eq('paciente_id', paciente.id);
        if (error) throw error;
      } else {
        notaId = novaSessaoId();
        const { error } = await tabela('notas_prontuario').insert({
          id: notaId, paciente_id: paciente.id, terapeuta_id: userId, tipo: 'analise_angular',
          titulo: nota.titulo, descricao: nota.descricao, dados_extras: nota.dados_extras, referencia_id: nota.referencia_id,
        });
        if (error) throw error;
      }
      acoes.marcarSalva(posicao, notaId, paciente.id);
      toast.success(existente ? `Posição atualizada no prontuário de ${paciente.nome}.` : `Posição salva no prontuário de ${paciente.nome}.`);
      void qc.invalidateQueries({ queryKey: chaveDoHistorico(paciente.id) });
      return true;
    } catch (erro) {
      toast.error((erro as { message?: string })?.message || 'Não foi possível salvar.');
      return false;
    } finally {
      emAndamento.current.delete(posicao);
      setSalvando((s) => (s === posicao ? null : s));
    }
  }, [acoes, estadoRef, paciente, qc, userId]);

  return { salvando, salvar };
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * As posições com medidas, no formato do PDF da sessão. `anterior` liga as colunas "Antes" e "Variação" de cada posição que a
 * avaliação anterior também tem; a foto só entra se `comFoto` e se a posição ainda tem a foto na memória.
 */
export function vistasDoRelatorio(e: EstadoSessao, o: { anterior: SessaoAgrupada | null; comFoto: boolean; estilo: EstiloMarcacao }): VistaDoRelatorioSessao[] {
  return VISTAS_DA_SESSAO.flatMap((posicao): VistaDoRelatorioSessao[] => {
    const item = e.itens[posicao];
    const r = resumoDoItem(item, posicao, e.compassoRef, e.unidadePrumo);
    if (!r.temResultado) return [];
    const antes = o.anterior?.posicoes[posicao];
    const imagem = o.comFoto && item.foto ? imagemParaPdf(r.analise, o.estilo, LARGURA_MAX_FOTO_PDF)?.url ?? null : null;
    return [{
      posicao, vistaNome: ROTULO_VISTA_SESSAO[posicao], medidas: r.medidas,
      anterior: o.anterior && antes?.medidas.length ? { data: dataDaSessao(o.anterior.iniciadaEm) || 'data não informada', medidas: antes.medidas } : null,
      imagem,
      metodo: r.usouIA ? 'automatica_conferida' : 'marcacao_manual',
      ...(r.usouIA ? { pontosAjustados: r.ajustadas.length } : {}),
      ...(r.notaNivel ? { notaNivel: minuscula(r.notaNivel) } : {}),
    }];
  });
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
      const { blob, nome } = await gerarRelatorioAngular({
        paciente: pacienteNome, profissional, data: hojeBR(),
        vistaNome: ROTULO_VISTA_SESSAO[posicao].toLowerCase(),
        medidas: resumo.medidas,
        metodo: resumo.usouIA ? 'automatica_conferida' : 'marcacao_manual',
        anterior: anteriorDaPosicao && antes?.medidas.length ? { data: dataDaSessao(anteriorDaPosicao.iniciadaEm) || 'data não informada', medidas: antes.medidas } : null,
        imagem,
        notaExtra: resumo.notaNivel,
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
      const { blob, nome } = await gerarRelatorioSessao({ paciente: pacienteNome, profissional, data: hojeBR(), vistas });
      entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: 'Análise angular da sessão' });
    } catch {
      toast.error('Não consegui gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  return { gerando, gerarPdf, gerarPdfDaSessao };
}
