import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { BarChart3, ChevronLeft, Crosshair, Eye, EyeOff, FileText, GitCompareArrows, Palette, Redo2, Ruler, Share2, Sparkles, Trash2, Undo2, Waypoints } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { tabela } from '@/lib/dosagem/db';
import { entregarPdf, baixarBlob } from '@/lib/pdf/entrega';
import { gerarRelatorioGesto, gerarRelatorioVideo } from '@/lib/angular/relatorioVideo';
import { lerEstilo, rotuloGraus, salvarEstilo, type EstiloMarcacao } from '@/lib/angular/estilo';
import PainelEstilo from '@/components/angular/PainelEstilo';
import ExportarSocialDialog from '@/components/angular/ExportarSocialDialog';
import {
  FORMULA_ASSIMETRIA, AVISO_REFERENCIAS, MODELOS_GESTO, adicionarEvento, analisarGesto, detectarEventosCorrida, detectarEventosMarcha, ehCancelamento, landmarksDoRosto,
  calcularAnguloNoQuadro, legendaDosAngulos, modeloDoGesto, moverEvento, pontosCorrigidosNoQuadro, rastrearVideo, removerEvento, type DetectorQuadro, type EventoPasso, type IdGesto, type Lado, type QuadroPose,
} from '@/lib/angular/video';
import {
  apagarRascunho, lerRascunho, salvarRascunho,
} from '@/lib/angular/analiseVideo/rascunho';
import {
  chaveDoRascunho, lerAnaliseSalva, mesmaImpressao, nomeArquivoAnalise, serializarAnalise, type AnaliseSalva, type EntradaAnalise,
} from '@/lib/angular/analiseVideo/persistencia';
import { estimarFps, impressaoDoVideo, lerMetadadosDoVideo, type VideoCarregado } from '@/lib/angular/analiseVideo/carregarVideo';
import { trilhaVazia } from '@/lib/angular/analiseVideo/trilhaVazia';
import {
  avisosDoVideo, formatarSegundos, intervaloPadrao, marcasDoScrubber, opcoesDeTaxa, taxaInicial, trechoCabeNaTaxa, trechoMaximoS, type IntervaloVideo,
} from '@/lib/angular/analiseVideo/tempo';
import { lerTextoDoArquivo } from '@/lib/angular/analiseVideo/videoUtil';
import { LIGACOES_CORPO, marcacoesDoQuadro, pontosDasDefinicoes, pontosParaTela, quadroComPontos, rotuloDoPonto, sugestaoParaCorrecao, sugestoesDePontosAusentes } from '@/lib/angular/analiseVideo/marcacoes';
import {
  bandasDoGrupo, cartoesDeMetricas, compararLados, eventoParaUi, grupoInicial, gruposDeArticulacoes, marcadoresDeEventos, marcadoresExtras, modeloParaUi, seriesDoGrupoDaAnalise,
} from '@/lib/angular/analiseVideo/resultados';
import { notaMedidasForaDoTrecho, remapearCapturas, textoDoValor, type CapturaManual } from '@/lib/angular/analiseVideo/medidaManual';
import { AVISO_ESTIMATIVA_VIDEO, type AlcaUi, type MarcacaoAnguloUi, type PontosDoQuadro, type TipoEvento } from '@/lib/angular/analiseVideo/tiposUi';
import type { AnaliseParaExportar } from '@/lib/angular/analise';
import type { Landmark } from '@/lib/angular/pose';
import { detectorDeTeste } from './ganchoTeste';
import { carregarExportarVideoDialog, exportarVideoDisponivel, type PropsExportarVideoDialog } from './exportarVideoLigacao';
import EnviarVideo from './EnviarVideo';
import EscolherModelo from './EscolherModelo';
import PainelRastreio from './PainelRastreio';
import PlayerQuadros from './PlayerQuadros';
import ControlesQuadro from './ControlesQuadro';
import GraficoAngulo from './GraficoAngulo';
import CartoesMetricas from './CartoesMetricas';
import ListaEventos from './ListaEventos';
import CompararLados from './CompararLados';
import PainelMedidaManual from './PainelMedidaManual';
import PainelExportar from './PainelExportar';
import { useMedidasManuais } from './useMedidasManuais';
import { useReproducao } from './useReproducao';
import { useTrilhaEditavel } from './useTrilhaEditavel';
import { useEstadoLaudo } from './laudo/useEstadoLaudo';
import { fraseContagemPontos, useContagemPontosAConferir } from './laudo/useContagemPontosAConferir';
import type { AlvoDeCorrecao } from './laudo/PontosAConferir';
import { imagensParaRelatorio, painelDoQuadroAtual, quadrosDosExtremos, resumoEmLinhas, rotuloDoQuadro, type ContextoQuadro } from './saidas';

type Etapa = 'enviar' | 'modelo' | 'rastreando' | 'analisar';
// A aba Laudo (Etapa 3, beta) carrega o motor de movimento, o laudo e a biblioteca de hipóteses só quando é aberta.
const AbaLaudo = lazy(() => import('./laudo/AbaLaudo'));

type Aba = 'metricas' | 'eventos' | 'lados' | 'medir' | 'laudo' | 'exportar';

const MODELOS_UI = MODELOS_GESTO.map(modeloParaUi);
const ABAS: { id: Aba; nome: string; Icone: typeof Ruler; selo?: string }[] = [
  { id: 'metricas', nome: 'Métricas', Icone: BarChart3 },
  { id: 'eventos', nome: 'Eventos', Icone: Waypoints },
  { id: 'lados', nome: 'D × E', Icone: GitCompareArrows },
  { id: 'medir', nome: 'Medir', Icone: Ruler },
  { id: 'laudo', nome: 'Laudo', Icone: FileText, selo: 'beta' },
  { id: 'exportar', nome: 'Exportar', Icone: Share2 },
];

const botaoIcone = 'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card px-2.5 text-xs font-medium transition-colors hover:bg-muted/50 disabled:opacity-40';

export interface AnaliseVideoProps {
  paciente: { id: string; nome: string; sobrenome?: string | null } | null | undefined;
  /** De onde o profissional veio: "ponto" põe a medida ponto a ponto em primeiro plano, "gesto" o rastreio do gesto. */
  entrada: 'gesto' | 'ponto';
  modeloInicial?: IdGesto;
  /** Estilo das linhas; sem ele a análise usa (e grava) o estilo salvo no aparelho, o mesmo da análise em foto. */
  estilo?: EstiloMarcacao;
  aoMudarEstilo?: (e: EstiloMarcacao) => void;
}

const nomeCompleto = (p: { nome: string; sobrenome?: string | null } | null | undefined) => (p ? `${p.nome} ${p.sobrenome ?? ''}`.trim() : 'Paciente');
const nomeDoProfissional = (p: { nome?: string | null; sobrenome?: string | null; crefito?: string | null } | null | undefined): string | undefined => {
  const nome = [p?.nome, p?.sobrenome].filter(Boolean).join(' ');
  return nome ? nome + (p?.crefito ? ` · CREFITO ${p.crefito}` : '') : undefined;
};
const GRUPOS_AUXILIARES = ['coxa', 'tibia'];
const hojeBR = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const dormir = (ms: number) => new Promise((ok) => window.setTimeout(ok, ms));

// Análise de gesto em vídeo: carregar, escolher o gesto, rastrear o corpo e analisar quadro a quadro com correção dos pontos
// (estilo stop-motion), gráfico, métricas com referência e saídas (vídeo analisado, quadro do Instagram, PDF, arquivo).
export default function AnaliseVideo({ paciente, entrada, modeloInicial = 'marcha', estilo: estiloExterno, aoMudarEstilo }: AnaliseVideoProps) {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fpsEscolhido = useRef(false);

  const [etapa, setEtapa] = useState<Etapa>('enviar');
  const [aba, setAba] = useState<Aba>('metricas');
  const [video, setVideo] = useState<VideoCarregado | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [modeloId, setModeloId] = useState<IdGesto>(modeloInicial);
  const [fpsVideo, setFpsVideo] = useState(30);
  const [taxaFps, setTaxaFps] = useState(30);
  const [intervalo, setIntervalo] = useState<IntervaloVideo>({ inicio: 0, fim: 0 });
  const [progresso, setProgresso] = useState(0);
  const [preparandoModelo, setPreparandoModelo] = useState(false);
  const [aoVivo, setAoVivo] = useState<QuadroPose | null>(null);
  const [rascunho, setRascunho] = useState<{ texto: string; salvoEm: string } | null>(null);
  const [pendente, setPendente] = useState<AnaliseSalva | null>(null);
  const [eventos, setEventos] = useState<EventoPasso[] | null>(null);
  const [grupoId, setGrupoId] = useState('');
  const [cameraFixa, setCameraFixa] = useState(true);
  const [mostrarEsqueleto, setMostrarEsqueleto] = useState(true);
  const [mostrarAngulos, setMostrarAngulos] = useState(true);
  const [painelEstilo, setPainelEstilo] = useState(false);
  const [estiloLocal, setEstiloLocal] = useState<EstiloMarcacao>(() => lerEstilo());
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [arteSocial, setArteSocial] = useState<{ arte: AnaliseParaExportar; landmarks: (Landmark[] | null)[] } | null>(null);
  const [DialogoVideo, setDialogoVideo] = useState<ComponentType<PropsExportarVideoDialog> | null>(null);
  const [videoAberto, setVideoAberto] = useState(false);
  const [preparandoVideo, setPreparandoVideo] = useState(false);
  const [pontoCorrigindo, setPontoCorrigindo] = useState<{ nome: string; quadro: number } | null>(null);

  const estilo = estiloExterno ?? estiloLocal;
  const mudarEstilo = (e: EstiloMarcacao) => { setEstiloLocal(e); salvarEstilo(e); aoMudarEstilo?.(e); };

  const edicao = useTrilhaEditavel();
  const trilha = edicao.trilha;

  // Os instantes dos quadros não mudam quando um ponto é corrigido: a lista só é recriada se a trilha for outra.
  const temposAnteriores = useRef<number[]>([]);
  const tempos = useMemo(() => {
    const novo = trilha?.quadros.map((q) => q.t) ?? [];
    const ant = temposAnteriores.current;
    if (ant.length === novo.length && ant.every((v, i) => v === novo[i])) return ant;
    temposAnteriores.current = novo;
    return novo;
  }, [trilha]);

  const fps = trilha?.fps ?? 30;
  const repro = useReproducao({ videoRef, tempos, fps, ativo: etapa === 'analisar' });
  const { quadro } = repro;
  const quadroPose = trilha?.quadros[quadro];
  const nQuadros = trilha?.quadros.length ?? 0;

  const temRastreio = useMemo(() => !!trilha && trilha.quadros.some((q) => Object.keys(q.pontos).length > 0), [trilha]);
  const modelo = modeloDoGesto(modeloId);
  const estadoLaudo = useEstadoLaudo(modeloId, modelo.vista);
  const grupos = useMemo(() => gruposDeArticulacoes(modelo.articulacoes), [modelo]);
  const grupo = grupos.find((g) => g.id === grupoId) ?? grupos[0];

  const manual = useMedidasManuais({ quadro, t: quadroPose?.t ?? 0, largura: video?.largura ?? 1, altura: video?.altura ?? 1, quadroPose, tocando: repro.tocando, tempos, fps });

  const analise = useMemo(
    () => (temRastreio && trilha ? analisarGesto(modelo, trilha, { eventos: eventos ?? undefined, escalaCmPorPx: manual.cmPorPx, cameraFixa }) : null),
    [temRastreio, trilha, modelo, eventos, manual.cmPorPx, cameraFixa],
  );
  const direcao = analise?.direcao ?? 1;
  const protocoloDoLaudo = useMemo(() => estadoLaudo.protocolos.find((p) => p.id === estadoLaudo.protocoloId) ?? null, [estadoLaudo.protocolos, estadoLaudo.protocoloId]);
  const pontosAConferir = useContagemPontosAConferir({ protocolo: protocoloDoLaudo, trilha: temRastreio ? trilha : null, eventos, direcao });

  // As sugestões de eventos do primeiro cálculo viram a lista editável do profissional.
  useEffect(() => {
    if (analise && eventos === null && modelo.eventos) setEventos(analise.eventos);
  }, [analise, eventos, modelo.eventos]);

  const series = useMemo(() => (analise && grupo ? seriesDoGrupoDaAnalise(grupo, analise.series) : []), [analise, grupo]);
  const eventosAtuais = useMemo(() => eventos ?? [], [eventos]);
  const marcadores = useMemo(
    () => [...marcadoresDeEventos(eventosAtuais), ...(trilha && analise ? marcadoresExtras(trilha, analise.repeticoes, analise.aterrissagem) : [])],
    [eventosAtuais, trilha, analise],
  );
  const bandas = useMemo(() => (grupo ? bandasDoGrupo(grupo.id, modelo.id) : []), [grupo, modelo.id]);
  const cartoes = useMemo(() => (analise ? cartoesDeMetricas(analise.metricas, modelo) : []), [analise, modelo]);
  const linhasLados = useMemo(() => (analise ? compararLados(grupos, analise.series) : []), [analise, grupos]);
  const eventosUi = useMemo(() => eventosAtuais.map(eventoParaUi), [eventosAtuais]);
  const marcas = useMemo(
    () => marcasDoScrubber(nQuadros, edicao.corrigidos, eventosAtuais.map((e) => ({ i: e.i, tipo: e.tipo, lado: e.lado, id: e.id }))),
    [nQuadros, edicao.corrigidos, eventosAtuais],
  );

  // O que o player desenha: pontos do quadro, ligações, alças dos pontos do grupo aberto e os ângulos (que acompanham o arrasto).
  const defsVisiveis = useMemo(() => grupo?.defs ?? [], [grupo]);
  const alcas = useMemo<AlcaUi[]>(() => {
    const nomes = pontosDasDefinicoes(defsVisiveis);
    if (modelo.eventos) for (const n of ['calcanhar_d', 'calcanhar_e', 'pe_d', 'pe_e']) if (!nomes.includes(n)) nomes.push(n);
    if (pontoCorrigindo && !nomes.includes(pontoCorrigindo.nome)) nomes.push(pontoCorrigindo.nome);
    return nomes.map((nome) => ({ nome, rotulo: rotuloDoPonto(nome) }));
  }, [defsVisiveis, modelo.eventos, pontoCorrigindo]);
  const pontosTela = useMemo<PontosDoQuadro | null>(() => pontosParaTela(quadroPose), [quadroPose]);
  const marcacoesDe = useCallback((p: PontosDoQuadro): MarcacaoAnguloUi[] => (quadroPose ? marcacoesDoQuadro(defsVisiveis, quadroComPontos(quadroPose, p), direcao) : []), [quadroPose, defsVisiveis, direcao]);
  const fantasmas = useMemo<PontosDoQuadro>(() => {
    if (!(etapa === 'analisar' && trilha && temRastreio)) return {};
    const sugestoes = sugestoesDePontosAusentes(trilha, quadro, alcas.map((a) => a.nome));
    // O quadro de "Ir ao quadro" pode estar no meio de um buraco longo, fora da janela de vizinhos: sem alça ali o ponto não teria como ser corrigido.
    if (pontoCorrigindo && pontoCorrigindo.quadro === quadro && !sugestoes[pontoCorrigindo.nome]) {
      const inicial = sugestaoParaCorrecao(trilha, quadro, pontoCorrigindo.nome);
      if (inicial) sugestoes[pontoCorrigindo.nome] = inicial;
    }
    return sugestoes;
  }, [etapa, trilha, temRastreio, quadro, alcas, pontoCorrigindo]);
  const corrigidosNoQuadro = trilha ? pontosCorrigidosNoQuadro(trilha, quadro) : [];

  // ---------- carregar o vídeo ----------

  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  const reiniciar = () => {
    edicao.iniciar(null); setEventos(null); manual.restaurar([], {}, '');
    estadoLaudo.restaurar();
    setPontoCorrigindo(null);
    repro.setQuadro(0);
  };

  const escolherVideo = async (f: File) => {
    if (!f.type.startsWith('video/')) { toast.error('Escolha um arquivo de vídeo.'); return; }
    setAbrindo(true);
    try {
      const v = await lerMetadadosDoVideo(f);
      // Com uma análise aberta esperando o vídeo, só o vídeo dela serve: um vídeo errado não entra no estado nem apaga o arquivo aberto.
      if (pendente && !mesmaImpressao(pendente.video, impressaoDoVideo(v))) {
        URL.revokeObjectURL(v.url);
        toast.error('Este vídeo não é o da análise salva (tamanho ou duração diferentes). Escolha o arquivo original.');
        return;
      }
      abortRef.current?.abort();
      reiniciar();
      setVideo(v);
      fpsEscolhido.current = false;
      setFpsVideo(30);
      setTaxaFps(Math.min(30, modelo.fpsSugerido));
      setIntervalo(intervaloPadrao(v.duracao));
      setRascunho(null);
      if (pendente) {
        const a = pendente;
        setPendente(null);
        restaurar(a, v);
        return;
      }
      setEtapa('modelo');
      void estimarFps(v.url).then((est) => {
        if (!est || fpsEscolhido.current) return;
        setFpsVideo(est);
        const padrao = intervaloPadrao(v.duracao);
        setTaxaFps(taxaInicial(modelo.fpsSugerido, padrao.fim - padrao.inicio, est));
      });
      void lerRascunho(chaveDoRascunho(impressaoDoVideo(v))).then((texto) => {
        if (!texto) return;
        const r = lerAnaliseSalva(texto);
        if (r.ok) setRascunho({ texto, salvoEm: r.analise.salvoEm });
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui abrir esse vídeo.');
    } finally {
      setAbrindo(false);
    }
  };

  const escolherModelo = (id: string) => {
    const novo = modeloDoGesto(id as IdGesto);
    setModeloId(novo.id);
    setGrupoId('');
    setEventos(null);
    fpsEscolhido.current = true;
    setTaxaFps(taxaInicial(novo.fpsSugerido, intervalo.fim - intervalo.inicio, fpsVideo));
  };
  const escolherFpsVideo = (f: number) => {
    fpsEscolhido.current = true;
    setFpsVideo(f);
    setTaxaFps((t) => Math.min(t, f));
  };

  useEffect(() => { if (grupos.length && !grupos.some((g) => g.id === grupoId)) setGrupoId(grupoInicial(modelo, grupos)); }, [grupos, grupoId, modelo]);
  useEffect(() => {
    const validas = opcoesDeTaxa(fpsVideo).map((o) => o.fps);
    if (!validas.includes(taxaFps)) setTaxaFps(validas.filter((f) => f <= taxaFps).pop() ?? validas[0]);
  }, [fpsVideo, taxaFps]);

  // ---------- rastrear ----------

  const rastrear = async () => {
    if (!video) return;
    // A tela não deixa chegar aqui com um trecho que não cabe na taxa; se chegar, o motor reduziria a taxa em silêncio, então volta para o profissional decidir.
    if (!trechoCabeNaTaxa(intervalo.fim - intervalo.inicio, taxaFps)) {
      toast.error(`A ${taxaFps.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} q/s o trecho máximo é ${trechoMaximoS(taxaFps)} s. Reduza o trecho ou escolha uma taxa menor.`);
      repro.pausar();
      setEtapa('modelo');
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setProgresso(0);
    setEtapa('rastreando');
    for (let i = 0; i < 120 && !videoRef.current; i++) await dormir(16);
    const el = videoRef.current;
    if (!el) { toast.error('Não consegui preparar o vídeo.'); setEtapa('modelo'); return; }
    try {
      const t = await rastrearVideo(el, { fps: taxaFps, intervalo, detector: detectorDeTeste() as DetectorQuadro | undefined, onProgresso: setProgresso, onPreparando: setPreparandoModelo, onQuadro: (q, i) => { if (i % 2 === 0) setAoVivo(q); }, sinal: ac.signal });
      if (ac.signal.aborted) return;
      setAoVivo(null);
      setPreparandoModelo(false);
      edicao.iniciar(t);
      // As medidas guardadas apontam o quadro por índice; a trilha nova pode ter outra taxa, então elas acompanham o instante.
      // As que ficam fora do novo trecho continuam na lista (só o profissional as remove) e voltam a valer se um trecho futuro incluir o instante.
      const remapeadas = remapearCapturas(manual.capturas, t.quadros.map((q) => q.t), t.fps);
      manual.restaurar(remapeadas.capturas);
      const fora = remapeadas.foraDoTrecho;
      if (fora > 0) toast.info(`${fora} ${fora === 1 ? 'medida guardada está fora do trecho atual' : 'medidas guardadas estão fora do trecho atual'}. Na aba Medir ${fora === 1 ? 'ela continua' : 'elas continuam'} na lista, sem entrar no PDF, no vídeo exportado, no resumo copiado nem no registro no prontuário.`);
      setEventos(null);
      repro.setQuadro(0);
      setAba('metricas');
      setEtapa('analisar');
    } catch (e) {
      setAoVivo(null);
      setPreparandoModelo(false);
      if (ehCancelamento(e)) { setEtapa(trilha ? 'analisar' : 'modelo'); return; }
      toast.error(e instanceof Error ? e.message : 'Não consegui rastrear o vídeo agora. Tente de novo com internet.');
      setEtapa(trilha ? 'analisar' : 'modelo');
    }
  };

  const voltarParaAnalise = () => {
    setGrupoId('');
    setEventos(null);
    repro.setQuadro(0);
    setEtapa('analisar');
  };

  const soMedir = () => {
    if (!video) return;
    if (trilha) { voltarParaAnalise(); setAba('medir'); return; }
    edicao.iniciar(trilhaVazia(fpsVideo, intervalo.inicio, intervalo.fim, video.largura, video.altura));
    setEventos(null);
    repro.setQuadro(0);
    setAba('medir');
    setEtapa('analisar');
  };

  const trocarGesto = () => { repro.pausar(); setEtapa('modelo'); };

  // ---------- correções, eventos ----------

  const corrigir = useCallback((nome: string, p: { x: number; y: number }) => {
    edicao.corrigir(quadro, nome, p);
    setPontoCorrigindo((atual) => (atual && atual.nome === nome ? null : atual));
  }, [edicao, quadro]);

  // "Ir ao quadro" dos pontos a conferir: o player para no quadro com o ponto destacado, e a página sobe até ele (no celular o player fica acima das abas).
  const irAoPontoPerdido = ({ quadro: destino, ponto }: AlvoDeCorrecao) => {
    setPontoCorrigindo({ nome: ponto, quadro: destino });
    repro.irPara(destino);
    videoRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };

  const adicionarEv = (tipo: TipoEvento, lado: Lado) => { if (trilha) setEventos((l) => adicionarEvento(l ?? [], trilha, lado, tipo, quadro)); };
  const moverEv = (id: string) => { if (trilha) setEventos((l) => moverEvento(l ?? [], trilha, id, quadro)); };
  const removerEv = (id: string) => setEventos((l) => removerEvento(l ?? [], id));
  const restaurarSugestoes = () => {
    if (!trilha) return;
    const novas = modelo.eventos === 'corrida' ? detectarEventosCorrida(trilha, { direcao }) : detectarEventosMarcha(trilha, { direcao });
    setEventos((l) => {
      const editados = (l ?? []).filter((e) => !e.sugerido);
      return [...editados, ...novas.filter((n) => !editados.some((e) => e.id === n.id))].sort((a, b) => a.i - b.i);
    });
    toast.success('Sugestões recalculadas com os pontos atuais. Os eventos que você editou foram mantidos.');
  };

  // ---------- salvar e retomar ----------

  const montarSalvo = useCallback((): EntradaAnalise | null => {
    if (!video || !trilha) return null;
    return {
      video: impressaoDoVideo(video), modeloId, fpsVideo, intervalo, trilha, eventos, cmPorPx: manual.cmPorPx,
      extras: { grupoId, cameraFixa, capturas: manual.capturas, refs: manual.refs, escalaCm: manual.escalaCm, nivelTipo: manual.nivelTipo },
      ...(estadoLaudo.criterios.length ? { criterios: estadoLaudo.criterios } : {}),
      ...(estadoLaudo.protocoloEscolhido ? { protocoloMovimento: estadoLaudo.protocoloEscolhido } : {}),
    };
  }, [video, trilha, modeloId, fpsVideo, intervalo, eventos, manual.cmPorPx, manual.capturas, manual.refs, manual.escalaCm, manual.nivelTipo, grupoId, cameraFixa, estadoLaudo.criterios, estadoLaudo.protocoloEscolhido]);

  const restaurar = (a: AnaliseSalva, v: VideoCarregado) => {
    const id = MODELOS_GESTO.some((m) => m.id === a.modeloId) ? (a.modeloId as IdGesto) : modeloId;
    setModeloId(id);
    setFpsVideo(a.fpsVideo);
    fpsEscolhido.current = true;
    setTaxaFps(a.trilha.fps);
    setIntervalo(a.intervalo);
    edicao.iniciar(a.trilha);
    setEventos(a.eventos);
    const ex = a.extras;
    manual.restaurar(
      Array.isArray(ex.capturas) ? (ex.capturas as CapturaManual[]) : [],
      ex.refs && typeof ex.refs === 'object' ? (ex.refs as Record<string, { x: number; y: number }[]>) : {},
      typeof ex.escalaCm === 'string' ? ex.escalaCm : '',
      ex.nivelTipo === 'vertical' ? 'vertical' : 'horizontal',
    );
    if (typeof ex.grupoId === 'string') setGrupoId(ex.grupoId);
    if (typeof ex.cameraFixa === 'boolean') setCameraFixa(ex.cameraFixa);
    estadoLaudo.restaurar(a.criterios, a.protocoloMovimento);
    repro.setQuadro(0);
    setVideo(v);
    setAba(Array.isArray(ex.capturas) && ex.capturas.length && !a.trilha.quadros.some((q) => Object.keys(q.pontos).length) ? 'medir' : 'metricas');
    setEtapa('analisar');
    toast.success('Análise retomada.');
  };

  const abrirArquivo = async (f: File) => {
    try {
      const r = lerAnaliseSalva(await lerTextoDoArquivo(f));
      if (!r.ok) { toast.error('erro' in r ? r.erro : 'Não consegui abrir a análise.'); return; }
      if (video && etapa !== 'enviar') {
        if (!mesmaImpressao(r.analise.video, impressaoDoVideo(video))) { toast.error('Essa análise é de outro vídeo. Escolha o vídeo dela para retomar.'); return; }
        restaurar(r.analise, video);
        return;
      }
      setPendente(r.analise);
      toast.success('Análise aberta. Agora escolha o vídeo dela para retomar.');
    } catch {
      toast.error('Não consegui ler o arquivo.');
    }
  };

  const salvarArquivo = () => {
    const s = montarSalvo();
    if (!s) return;
    baixarBlob(new Blob([serializarAnalise(s)], { type: 'application/json' }), nomeArquivoAnalise(modeloId));
    toast.success('Análise salva. Para retomar, abra este arquivo e escolha o mesmo vídeo.');
  };

  // Rascunho automático no aparelho (IndexedDB): reabrir o mesmo vídeo oferece retomar de onde parou.
  useEffect(() => {
    if (etapa !== 'analisar' || !video || !trilha) return;
    const id = window.setTimeout(() => {
      const s = montarSalvo();
      if (s) void salvarRascunho(chaveDoRascunho(s.video), serializarAnalise(s));
    }, 1500);
    return () => window.clearTimeout(id);
  }, [etapa, video, trilha, montarSalvo]);

  const retomarRascunho = () => {
    if (!rascunho || !video) return;
    const r = lerAnaliseSalva(rascunho.texto);
    if (r.ok) restaurar(r.analise, video);
    setRascunho(null);
  };
  const descartarRascunho = () => {
    if (video) void apagarRascunho(chaveDoRascunho(impressaoDoVideo(video)));
    setRascunho(null);
  };

  // ---------- saídas ----------

  const contextoQuadro = (): ContextoQuadro | null => {
    const v = videoRef.current;
    if (!v || !trilha) return null;
    return { video: v, trilha, estilo, defs: defsVisiveis, direcao, capturas: manual.noTrecho, giro: manual.giro, cmPorPx: manual.cmPorPx };
  };

  const dadosDoRelatorio = () => ({
    paciente: nomeCompleto(paciente),
    profissional: nomeDoProfissional(profile),
    data: hojeBR(),
  });

  const gerarPdf = async () => {
    const c = contextoQuadro();
    if (!c || !trilha || !video) return;
    repro.pausar();
    setGerandoPdf(true);
    try {
      const capturas = manual.noTrecho;
      const fora = manual.foraDoTrecho.length;
      const notaFora = notaMedidasForaDoTrecho(fora, 'relatório');
      if (!analise) {
        if (!capturas.length) { toast.error(fora > 0 ? 'As medidas guardadas estão fora do trecho atual e não entram no PDF. Guarde uma medida dentro do trecho ou rastreie o corpo.' : 'Guarde ao menos uma medida, ou rastreie o corpo, para gerar o PDF.'); return; }
        const imagens = await imagensParaRelatorio(c, [...new Set(capturas.map((x) => x.quadro))], (i) => rotuloDoQuadro(c, i), quadro);
        const porQuadro = new Map(imagens.map((m) => [m.indice, m]));
        const { blob, nome } = await gerarRelatorioVideo({
          ...dadosDoRelatorio(), fps: Math.round(trilha.fps),
          notaExtra: [manual.giro !== null && Math.abs(manual.giro) >= 0.05 ? `Imagem nivelada por uma referência ${manual.nivelTipo} marcada (correção de ${Math.abs(manual.giro).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}°).` : undefined, notaFora].filter(Boolean).join(' ') || undefined,
          capturas: capturas.map((x) => ({ t: x.t, quadro: x.quadro + 1, nome: x.nome, valorTexto: textoDoValor(x.valor, x.unidade), texto: x.texto, imagem: porQuadro.get(x.quadro)?.imagem ?? null })),
        });
        entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: 'Análise angular em vídeo' });
        return;
      }
      const principal = series[0];
      const indices = [...new Set([...quadrosDosExtremos(principal ? principal.pontos.map((p) => p.v) : []), ...capturas.map((x) => x.quadro)])].sort((a, b) => a - b);
      const imagens = await imagensParaRelatorio(c, indices, (i) => rotuloDoQuadro(c, i, grupo?.nome), quadro);
      const { blob, nome } = await gerarRelatorioGesto({
        ...dadosDoRelatorio(),
        modelo: { nome: modelo.nome, vista: modelo.vista === 'lateral' ? 'Vista lateral' : 'Vista frontal' },
        duracaoS: (tempos[tempos.length - 1] ?? 0) - (tempos[0] ?? 0), fpsAnalise: Math.round(trilha.fps),
        cartoes,
        graficos: grupos.filter((g) => !GRUPOS_AUXILIARES.includes(g.id) || g.id === grupo?.id).map((g) => ({ titulo: g.nome, legendaSinal: legendaDosAngulos(g.defs), dados: { series: seriesDoGrupoDaAnalise(g, analise.series), marcadores, bandas: bandasDoGrupo(g.id, modelo.id), t0: tempos[0] ?? 0, duracao: Math.max(0.1, (tempos[tempos.length - 1] ?? 0) - (tempos[0] ?? 0)) } }))
          .filter((g) => g.dados.series.some((s) => s.pontos.some((p) => p.v !== null))),
        quadros: imagens.map(({ rotulo, imagem }) => ({ rotulo, imagem })),
        capturas: capturas.map((x) => ({ t: x.t, quadro: x.quadro + 1, nome: x.nome, valorTexto: textoDoValor(x.valor, x.unidade), texto: x.texto })),
        correcoes: { quadros: edicao.resumo.quadros, pontos: edicao.resumo.pontos },
        eventosEditados: eventosAtuais.filter((e) => !e.sugerido).length,
        avisoReferencias: AVISO_REFERENCIAS,
        avisos: [...analise.avisos, ...modelo.avisos, ...(notaFora ? [notaFora] : [])],
      });
      entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: `Análise de ${modelo.nome.toLowerCase()}` });
    } catch {
      toast.error('Não consegui gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const abrirQuadroInstagram = () => {
    const c = contextoQuadro();
    if (!c || !trilha) return;
    repro.pausar();
    const painel = painelDoQuadroAtual(c, quadro);
    if (!painel) { toast.error('Este navegador não conseguiu montar a imagem do quadro.'); return; }
    const medidas = defsVisiveis.flatMap((d) => {
      const g = calcularAnguloNoQuadro(d, quadroPose, direcao);
      return g === null ? [] : [{ nome: d.nome, valor: rotuloGraus(g, estilo.casasRotulo ?? 1) }];
    });
    const arte: AnaliseParaExportar = { paineis: [painel], medidas, nota: AVISO_ESTIMATIVA_VIDEO };
    setArteSocial({ arte, landmarks: [temRastreio ? landmarksDoRosto(trilha, quadro) : null] });
  };

  const abrirVideoAnalisado = async () => {
    if (!trilha || !videoRef.current) return;
    repro.pausar();
    if (!DialogoVideo) {
      setPreparandoVideo(true);
      try {
        const C = await carregarExportarVideoDialog();
        if (!C) { toast.error('A exportação do vídeo analisado não está disponível nesta versão do app.'); return; }
        setDialogoVideo(() => C);
      } catch {
        toast.error('Não consegui abrir a exportação do vídeo. Confira a internet e tente de novo.');
        return;
      } finally {
        setPreparandoVideo(false);
      }
    }
    setVideoAberto(true);
  };

  const resumoLinhas = () => resumoEmLinhas(cartoes, manual.noTrecho);
  // Fica fora de `resumoLinhas`: essas linhas também alimentam os cartões do vídeo exportado, onde a nota seria lida como uma métrica.
  const resumoComNota = (saida: 'resumo' | 'registro') => [...resumoLinhas(), notaMedidasForaDoTrecho(manual.foraDoTrecho.length, saida)].filter(Boolean).join('\n');

  const copiar = async () => {
    try { await navigator.clipboard.writeText(`Análise de ${modelo.nome} por vídeo\n${resumoComNota('resumo')}`); toast.success('Resumo copiado.'); } catch { toast.error('Não consegui copiar.'); }
  };

  const registrar = async () => {
    if (!paciente || !user || !trilha) return;
    setRegistrando(true);
    try {
      const comRastreio = !!analise;
      const { error } = await tabela('notas_prontuario').insert({
        paciente_id: paciente.id, terapeuta_id: user.id, tipo: 'analise_angular',
        titulo: comRastreio ? `Análise angular — ${modelo.nome} por vídeo` : 'Análise angular — ponto a ponto em vídeo',
        descricao: `${resumoComNota('registro')}\n${comRastreio ? `Pontos do corpo detectados automaticamente em vídeo (${Math.round(trilha.fps)} quadros por segundo)${edicao.resumo.pontos ? ` e corrigidos à mão em ${edicao.resumo.quadros} quadros` : ''}; valores de referência só quando há fonte verificada. ` : `Pontos marcados pelo profissional em quadros do vídeo (${Math.round(trilha.fps)} quadros por segundo). `}Medida de acompanhamento, não é diagnóstico. O vídeo não é armazenado.`,
        dados_extras: {
          metodo: comRastreio ? 'video_gesto' : 'video_ponto_a_ponto', gesto: modelo.id, fps_analise: trilha.fps,
          ...(analise ? {
            metricas: analise.metricas.filter((m) => m.valor !== null).map((m) => ({ metrica: m.metrica, lado: m.lado, valor: Math.round((m.valor as number) * 100) / 100, unidade: m.unidade })),
            correcoes: edicao.resumo, eventos_editados: eventosAtuais.filter((e) => !e.sugerido).length,
          } : {}),
          capturas: manual.noTrecho.map((x) => ({ id: x.medidaId, t: x.t, quadro: x.quadro, valor: Math.round(x.valor * 10) / 10, ...(x.unidade === 'cm' ? { unidade: 'cm' } : {}) })),
          nivel_graus: manual.giro, escala_cm_por_px: manual.cmPorPx,
        },
      });
      if (error) throw error;
      toast.success(`Análise registrada no prontuário de ${paciente.nome}.`);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível registrar.');
    } finally {
      setRegistrando(false);
    }
  };

  // ---------- teclado ----------

  useEffect(() => {
    if (etapa !== 'analisar') return;
    const aoTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) edicao.refazerUltima(); else edicao.desfazerUltima(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); edicao.refazerUltima(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); repro.passo(e.shiftKey ? -10 : -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); repro.passo(e.shiftKey ? 10 : 1); }
      else if (e.key === ' ' && alvo?.tagName !== 'BUTTON') { e.preventDefault(); repro.alternar(); }
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [etapa, edicao, repro]);

  // ---------- tela ----------

  const emAnalise = etapa === 'analisar' || etapa === 'rastreando';
  const podeCorrigir = etapa === 'analisar' && !repro.tocando && !(aba === 'medir' && manual.ativaId) && temRastreio;
  const temFantasma = Object.keys(fantasmas).length > 0;
  let avisoQuadro: string | null = null;
  if (etapa === 'analisar' && temRastreio && !pontosTela) avisoQuadro = temFantasma ? 'Corpo não detectado neste quadro. Arraste os pontos tracejados para posicioná-los.' : 'Corpo não detectado neste quadro';
  else if (etapa === 'analisar' && podeCorrigir && pontoCorrigindo && pontoCorrigindo.quadro === quadro) {
    const rotulo = rotuloDoPonto(pontoCorrigindo.nome).toLowerCase();
    const temAlca = !!pontosTela?.[pontoCorrigindo.nome] || !!fantasmas[pontoCorrigindo.nome];
    if (temAlca) avisoQuadro = `Corrija ${rotulo} (anel laranja): arraste até a posição da articulação.`;
    else avisoQuadro = `Sem alça para ${rotulo} neste quadro: ele não foi detectado em nenhum quadro e os pontos ligados a ele também faltam aqui. Vá a outro quadro.`;
  } else if (etapa === 'analisar' && podeCorrigir && temFantasma) avisoQuadro = 'Pontos tracejados: não detectados. Arraste até o lugar certo.';
  const avisosVideo = video ? avisosDoVideo({ duracao: video.duracao, largura: video.largura, altura: video.altura, tamanho: video.tamanho }).mensagens : [];

  if (etapa === 'enviar' || !video) {
    return (
      <div className="space-y-3">
        {pendente && <p className="rounded-xl bg-primary/10 p-3 text-sm font-medium" role="status">Análise aberta ({MODELOS_GESTO.find((m) => m.id === pendente.modeloId)?.nome ?? 'gesto'}). Escolha agora o vídeo dela para retomar.</p>}
        <EnviarVideo aoEscolherVideo={escolherVideo} aoAbrirAnalise={abrirArquivo} ocupado={abrindo} dica={entrada === 'ponto' ? 'Câmera parada, de lado, com o corpo inteiro no quadro.' : 'Grave de lado (ou de frente, no salto e no ombro), com a câmera parada e o corpo inteiro no quadro, boa luz e roupa justa.'} />
      </div>
    );
  }

  if (etapa === 'modelo') {
    return (
      <div className="space-y-3">
        {rascunho && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm" role="status" data-testid="aviso-rascunho">
            <span className="min-w-0 flex-1">Há uma análise deste vídeo salva neste aparelho{rascunho.salvoEm ? ` (${new Date(rascunho.salvoEm).toLocaleString('pt-BR')})` : ''}.</span>
            <button type="button" onClick={retomarRascunho} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Retomar</button>
            <button type="button" onClick={descartarRascunho} className="min-h-11 rounded-xl border border-border px-4 font-medium">Descartar</button>
          </div>
        )}
        <EscolherModelo
          video={video} modelos={MODELOS_UI} modeloId={modeloId} aoModelo={escolherModelo}
          fpsVideo={fpsVideo} aoFpsVideo={escolherFpsVideo} taxaFps={taxaFps} aoTaxa={setTaxaFps}
          intervalo={intervalo} aoIntervalo={setIntervalo} avisos={avisosVideo} fpsSugerido={modelo.fpsSugerido}
          aoRastrear={rastrear} aoUsarRastreio={trilha ? voltarParaAnalise : undefined} aoSoMedir={soMedir} primario={entrada === 'ponto' ? 'medir' : 'rastrear'}
          aoTrocarVideo={escolherVideo}
        />
        {modelo.gravacao.length > 0 && (
          <details className="rounded-2xl border border-border/60 bg-card p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Como gravar este gesto</summary>
            <ul className="mt-2 space-y-1">{modelo.gravacao.map((g) => <li key={g}>• {g}</li>)}</ul>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]" data-testid="analise-video">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={trocarGesto} disabled={etapa === 'rastreando'} className={cn(botaoIcone, 'shrink-0')} aria-label="Trocar o gesto ou o trecho"><ChevronLeft className="h-4 w-4" /> Trocar</button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" data-testid="nome-modelo">{modelo.nome}<span className="ml-1.5 text-xs font-normal text-muted-foreground">{modelo.vista === 'lateral' ? 'vista lateral' : 'vista frontal'}</span></p>
        </div>
        {etapa === 'analisar' && trilha && (
          <p className="-mt-1 px-1 text-xs tabular-nums text-muted-foreground" data-testid="taxa-efetiva">
            {temRastreio ? 'Rastreado' : 'Quadros'} a <strong className="text-foreground">{fps.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} q/s</strong> · {nQuadros.toLocaleString('pt-BR')} quadros · {formatarSegundos(nQuadros / fps, 1)}
          </p>
        )}

        <PlayerQuadros
          url={video.url} largura={video.largura} altura={video.altura} videoRef={videoRef} quadro={quadro} nQuadros={nQuadros}
          pontos={etapa === 'analisar' ? pontosTela : etapa === 'rastreando' ? pontosParaTela(aoVivo ?? undefined) : null} ligacoes={LIGACOES_CORPO} alcas={alcas} fantasmas={fantasmas} pontoEmDestaque={pontoCorrigindo && pontoCorrigindo.quadro === quadro ? pontoCorrigindo.nome : null} marcacoesDe={marcacoesDe} estilo={estilo}
          mostrarEsqueleto={mostrarEsqueleto} mostrarAngulos={mostrarAngulos} podeCorrigir={podeCorrigir}
          aoCorrigir={corrigir} aoDeslizar={repro.irPara} tocando={repro.tocando} aoPausar={repro.pausar} aviso={avisoQuadro}
          camadaExtra={etapa === 'analisar' ? manual.camada : undefined} aoArrastarExtra={manual.arrastar} gestosExtra={etapa === 'analisar' && aba === 'medir' ? manual.gestos : undefined}
        />

        {etapa === 'rastreando' && <PainelRastreio progresso={progresso} aoCancelar={() => abortRef.current?.abort()} texto={preparandoModelo ? 'Baixando o modelo de detecção…' : undefined} />}

        {etapa === 'analisar' && (
          <>
            <ControlesQuadro quadro={quadro} nQuadros={nQuadros} t={quadroPose?.t ?? 0} fps={trilha?.fps} tocando={repro.tocando} velocidade={repro.velocidade} marcas={marcas} faixas={edicao.faixas}
              aoIr={repro.irPara} aoPasso={repro.passo} aoAlternar={repro.alternar} aoVelocidade={repro.setVelocidade} />

            <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Ferramentas da análise">
              <button type="button" className={botaoIcone} onClick={edicao.desfazerUltima} disabled={!edicao.podeDesfazer} aria-label="Desfazer a última correção" data-testid="desfazer"><Undo2 className="h-4 w-4" /></button>
              <button type="button" className={botaoIcone} onClick={edicao.refazerUltima} disabled={!edicao.podeRefazer} aria-label="Refazer a correção" data-testid="refazer"><Redo2 className="h-4 w-4" /></button>
              <button type="button" className={botaoIcone} onClick={() => edicao.removerCorrecoesDoQuadro(quadro)} disabled={!corrigidosNoQuadro.length} aria-label="Remover as correções deste quadro" data-testid="remover-correcao"><Trash2 className="h-4 w-4" /><span className="hidden min-[400px]:inline">Quadro</span></button>
              <button type="button" className={cn(botaoIcone, mostrarEsqueleto && 'border-primary bg-primary/10')} aria-pressed={mostrarEsqueleto} onClick={() => setMostrarEsqueleto((v) => !v)} aria-label="Mostrar o esqueleto e os pontos">{mostrarEsqueleto ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              <button type="button" className={cn(botaoIcone, mostrarAngulos && 'border-primary bg-primary/10', 'font-bold')} aria-pressed={mostrarAngulos} onClick={() => setMostrarAngulos((v) => !v)} aria-label="Mostrar os ângulos">°</button>
              <button type="button" className={cn(botaoIcone, painelEstilo && 'border-primary bg-primary/10')} aria-pressed={painelEstilo} onClick={() => setPainelEstilo((v) => !v)} aria-label="Estilo das linhas"><Palette className="h-4 w-4" /></button>
            </div>
            {painelEstilo && <PainelEstilo estilo={estilo} aoMudar={mudarEstilo} aoFechar={() => setPainelEstilo(false)} />}

            {temRastreio && (
              <p className="flex items-start gap-1.5 rounded-xl bg-muted/40 p-2.5 text-xs leading-snug text-muted-foreground">
                <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Arraste um ponto para corrigir: vira quadro-chave (bolinha amarela). Entre dois quadros-chave a posição é interpolada (faixa amarela, anel tracejado). Deslize no vídeo para mudar de quadro.
                  {edicao.resumo.pontos > 0 && <strong className="text-foreground"> {edicao.resumo.pontos} {edicao.resumo.pontos === 1 ? 'ponto corrigido' : 'pontos corrigidos'}.</strong>}</span>
              </p>
            )}

            {analise && grupo ? (
              <section className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" aria-label="Gráfico ângulo x tempo">
                <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Articulação do gráfico">
                  {grupos.map((g) => (
                    <button key={g.id} type="button" role="tab" aria-selected={g.id === grupo.id} onClick={() => setGrupoId(g.id)} data-testid={`grupo-${g.id}`}
                      className={cn('min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-semibold transition-colors', g.id === grupo.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>{g.nome}</button>
                  ))}
                </div>
                <GraficoAngulo titulo={grupo.nome} series={series} marcadores={marcadores} bandas={bandas} t0={tempos[0] ?? 0} duracao={Math.max(0.1, (tempos[tempos.length - 1] ?? 0) - (tempos[0] ?? 0))}
                  t={quadroPose?.t ?? 0} aoIrPara={(t) => repro.irPara(Math.round((t - (tempos[0] ?? 0)) * fps))} legendaSinal={legendaDosAngulos(grupo.defs)} />
                <p className="text-[11px] leading-snug text-muted-foreground">Toque ou arraste no gráfico para ir ao instante. A curva é suavizada só para o desenho; a medida usa os pontos do vídeo.</p>
              </section>
            ) : (
              <div className="space-y-2 rounded-2xl border border-dashed border-border bg-card p-4 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">Para ver os ângulos, o gráfico e as métricas, rastreie o corpo neste vídeo.</p>
                <button type="button" onClick={rastrear} className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" data-testid="rastrear-agora">Rastrear o corpo agora</button>
              </div>
            )}
          </>
        )}
      </div>

      {etapa === 'analisar' && (
        <aside className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <div role="tablist" aria-label="Painel da análise" className="grid grid-cols-6 gap-1 rounded-2xl bg-muted/60 p-1">
            {ABAS.map(({ id, nome, Icone, selo }) => {
              const aConferir = id === 'laudo' ? pontosAConferir : 0;
              const rotulo = selo ? `${nome} (${selo})${aConferir > 0 ? ` · ${fraseContagemPontos(aConferir)}` : ''}` : undefined;
              return (
                <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} data-testid={`aba-${id}`} aria-label={rotulo} title={aConferir > 0 ? rotulo : undefined}
                  className={cn('relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] font-semibold transition-all', aba === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <Icone className="h-4 w-4" aria-hidden />{nome}
                  {selo && <span className="text-[9px] font-medium uppercase leading-none tracking-wide text-muted-foreground" aria-hidden>{selo}</span>}
                  {aConferir > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-black" aria-hidden data-testid="contagem-pontos-a-conferir">{aConferir}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={cn('space-y-3', !(analise && (aba === 'metricas' || aba === 'lados')) && 'rounded-2xl border border-border/60 bg-card p-3')} role="tabpanel">
            {aba === 'metricas' && (
              analise ? (
                <>
                  {modelo.metricas.some((m) => m.requerCameraFixa) && (
                    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3 text-sm">
                      <span>Câmera parada (o paciente atravessa o quadro)</span>
                      <input type="checkbox" checked={cameraFixa} onChange={(e) => setCameraFixa(e.target.checked)} className="h-5 w-5 accent-primary" />
                    </label>
                  )}
                  <CartoesMetricas cartoes={cartoes} aviso={AVISO_REFERENCIAS} />
                  {[...analise.avisos, ...modelo.avisos].length > 0 && <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">{[...analise.avisos, ...modelo.avisos].map((a) => <li key={a}>• {a}</li>)}</ul>}
                </>
              ) : <p className="text-xs text-muted-foreground">As métricas aparecem depois do rastreio do corpo.</p>
            )}
            {aba === 'eventos' && (
              modelo.eventos && analise ? (
                <ListaEventos eventos={eventosUi} quadroAtual={quadro} aoIr={repro.irPara} aoAdicionar={adicionarEv} aoMover={moverEv} aoRemover={removerEv} aoRestaurar={restaurarSugestoes} />
              ) : <p className="text-xs text-muted-foreground">{modelo.eventos ? 'Os eventos aparecem depois do rastreio.' : 'Este gesto não usa eventos de contato e saída do pé: os picos das repetições aparecem como marcas no gráfico.'}</p>
            )}
            {aba === 'lados' && (analise ? <CompararLados linhas={linhasLados} formula={FORMULA_ASSIMETRIA} /> : <p className="text-xs text-muted-foreground">A comparação aparece depois do rastreio.</p>)}
            {aba === 'medir' && <PainelMedidaManual m={manual} temRastreio={temRastreio} tocando={repro.tocando} aoIr={repro.irPara} />}
            {aba === 'laudo' && (
              <Suspense fallback={<p className="text-xs text-muted-foreground" role="status">Carregando o laudo…</p>}>
                <AbaLaudo
                  estado={estadoLaudo} vistaDeclarada={modelo.vista} trilha={temRastreio ? trilha : null} escalaCmPorPixel={manual.cmPorPx} eventos={eventos} direcao={direcao}
                  video={{ nome: video.nome, duracaoS: video.duracao, largura: video.largura, altura: video.altura }}
                  trecho={tempos.length ? { inicio: tempos[0], fim: tempos[tempos.length - 1] } : undefined}
                  quadrosChaveCorrigidos={edicao.resumo.quadros} medidasManuaisForaDoTrecho={manual.foraDoTrecho.length}
                  paciente={paciente ? nomeCompleto(paciente) : undefined} profissional={nomeDoProfissional(profile)} aoIrAoQuadro={irAoPontoPerdido}
                />
              </Suspense>
            )}
            {aba === 'exportar' && (
              <PainelExportar
                temAnalise={!!trilha} gerandoPdf={gerandoPdf} registrando={registrando} temPaciente={!!paciente} correcoes={{ quadros: edicao.resumo.quadros, pontos: edicao.resumo.pontos }}
                videoDisponivel={exportarVideoDisponivel()} preparandoVideo={preparandoVideo}
                aoBaixarVideo={abrirVideoAnalisado} aoQuadroInstagram={abrirQuadroInstagram} aoPdf={gerarPdf}
                aoSalvar={salvarArquivo} aoAbrir={abrirArquivo} aoRegistrar={registrar} aoCopiar={copiar}
              />
            )}
          </div>
        </aside>
      )}

      {DialogoVideo && trilha && (
        <DialogoVideo
          aberto={videoAberto} aoFechar={() => setVideoAberto(false)} video={videoRef.current} trilha={trilha} definicoes={defsVisiveis} estilo={estilo}
          intervalo={{ inicio: tempos[0] ?? 0, fim: tempos[tempos.length - 1] ?? 0 }} direcao={direcao} titulo={modelo.nome} linhasMetricas={resumoLinhas()} terapeutaId={user?.id}
          cartoes={cartoes} series={series} marcadores={marcadores} bandas={bandas}
        />
      )}
      <ExportarSocialDialog aberto={!!arteSocial} aoFechar={() => setArteSocial(null)} arte={arteSocial?.arte ?? null} landmarks={arteSocial?.landmarks} terapeutaId={user?.id} />
    </div>
  );
}

