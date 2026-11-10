import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ClipboardCheck, Columns2, Copy, Eye, EyeOff, FileDown, Film, Grid3x3, Hand, ImageDown, Instagram, Loader2, Maximize2, MousePointer2, Palette, Ruler, SkipForward, Smartphone, Sparkles, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import MarchaVideo from '@/components/angular/MarchaVideo';
import PontoAPontoVideo from '@/components/angular/PontoAPontoVideo';
import CameraNivel from '@/components/angular/CameraNivel';
import LupaFoto from '@/components/angular/LupaFoto';
import ComparadorFotos, { type ExtrasDaArte } from '@/components/angular/ComparadorFotos';
import ExportarSocialDialog from '@/components/angular/ExportarSocialDialog';
import PainelEstilo from '@/components/angular/PainelEstilo';
import ResumoSessao, { SeletorDeAnterior, TabelaComparacao, TextoDaMedida } from '@/components/angular/ResumoSessao';
import { AvisosDaMarcacao, SessaoVistas, type AbaDaSessao } from '@/components/angular/SessaoVistas';
import { useConfirmacao } from '@/components/angular/ConfirmarAcao';
import { DICA_COMPARAR, INSTRUCAO_DA_POSICAO } from '@/components/angular/textosSessao';
import { ItensSvg } from '@/components/angular/MarcacaoSvg';
import { COR_REFERENCIA, ICONE_MEDIDA, LADO_MEDIDA } from '@/components/angular/iconesMedida';
import { useGestosFoto } from '@/hooks/useGestosFoto';
import {
  algoPreenchido, estadoDaAba, ordemNaSessao, pacienteDaSessao, previstasEfetivas, proximaPosicao, temMarcacao, useSessaoPostural, type FotoDaPosicao,
} from '@/hooks/useSessaoPostural';
import { useMarcacaoAutomatica } from '@/hooks/useMarcacaoAutomatica';
import { useCameraDaSessao } from '@/hooks/useCameraDaSessao';
import { useGravarPosicao, useHistoricoDeSessoes, useRelatoriosDaSessao } from '@/hooks/useSessaoDoPaciente';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { medidasDaVista, REFS_COMPASSO, segmentosDaMedida, type GrupoMedida, type Medida, type Ponto, type RefCompasso, type UnidadePrumo } from '@/lib/angular/medidas';
import { prepararFoto } from '@/lib/angular/fotoSessao';
import { paresMembrosSuperiores } from '@/lib/angular/relatorioSessao';
import { compararSessoes, type SessaoParaComparar } from '@/lib/angular/comparar';
import { sessoesComPosicao } from '@/lib/angular/sessao';
import { ESQUEMA_ANALISE_FOTO, ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, vistaBaseDaSessao, type VistaSessao } from '@/lib/angular/tiposSessao';
import {
  alcaDoPrumo, analiseDaFotoParaExportar, apoioPelaAlca, baixarBlob, canvasComMedidas, canvasParaBlob, faltaReferenciaDoPrumo, itensDaAnalise,
  nomeArquivoImagem, type AnaliseParaExportar,
} from '@/lib/angular/analise';
import { escalaDoEstilo, escalaNaTela, lerEstilo, salvarEstilo, type EstiloMarcacao } from '@/lib/angular/estilo';
import { usePacienteDosagem, usePacientesLista } from '@/hooks/useProntuarioSeguranca';
import type { Landmark } from '@/lib/angular/pose';

const GRUPOS: { id: GrupoMedida; titulo: string }[] = [
  { id: 'postura', titulo: 'Postura' },
  { id: 'ferramenta', titulo: 'Ferramentas' },
  { id: 'referencia', titulo: 'Referências da foto' },
];

const CORES = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
const ZOOM_MAX = 5;
const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
// Alvo de toque mínimo (px de tela) das alças, para o dedo acertar mesmo com a foto pequena.
const TOQUE_ATIVA = 16;
const TOQUE_OUTRAS = 10;
// Marcando pontos novos o alvo é menor, para um ponto próximo do anterior não ser tomado por arrasto.
const TOQUE_MARCANDO = 5;
const TOQUE_ALCA = 18;
// A prévia pequena nunca afina as retas abaixo de ~1/3 de pixel de tela por unidade de espessura do estilo.
const ESP_MIN_TELA_PX = 0.33;
const SUFIXO_ALCA = ':alca';
const SETA_REF: Record<RefCompasso, typeof ArrowDown> = { baixo: ArrowDown, cima: ArrowUp, esquerda: ArrowLeft, direita: ArrowRight };
const UNIDADES_PRUMO: { id: UnidadePrumo; nome: string }[] = [{ id: 'graus', nome: 'Graus' }, { id: 'cm', nome: 'cm' }, { id: 'pct', nome: '% da altura' }];

// Análise angular em foto: uma sessão com até quatro posições (frente, perfil direito, perfil esquerdo, costas). Em cada uma o
// profissional marca os pontos (ou deixa o app sugerir) e o app calcula. Nível e escala corrigem a foto torta e dão medidas em
// centímetros. A foto fica só no navegador; o prontuário recebe as medidas, uma nota por posição, ligadas pela sessão.
export default function AnaliseAngular() {
  const { user, profile } = useAuth();
  const [sp, setSp] = useSearchParams();
  const pacienteId = sp.get('paciente') || '';
  const modoAnalise = sp.get('modo') === 'marcha' ? 'marcha' : 'foto';
  const { data: lista = [] } = usePacientesLista(user?.id);
  const { data: paciente } = usePacienteDosagem(pacienteId || null);

  const { estado, estadoRef, acoes, atual: item, resumo, resumos } = useSessaoPostural();
  const posicao = estado.atual;
  const { vista, lado } = vistaBaseDaSessao(posicao);
  const foto = item.foto;
  const pontos = item.pontos;
  const { pedir: confirmar, dialogo: dialogoConfirmar } = useConfirmacao();
  const marcacao = useMarcacaoAutomatica({ estadoRef, acoes }, confirmar);
  const { sessoes: historico } = useHistoricoDeSessoes(pacienteId);
  const { salvando, salvar } = useGravarPosicao({ estadoRef, acoes, paciente, userId: user?.id });

  const [anteriorId, setAnteriorId] = useState('');
  const [comFoto, setComFoto] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [mover, setMover] = useState(false);
  const [grade, setGrade] = useState(false);
  const [modoVideo, setModoVideo] = useState<'ponto' | 'auto'>('ponto');
  const [estilo, setEstiloLocal] = useState<EstiloMarcacao>(() => lerEstilo());
  const [painelEstilo, setPainelEstilo] = useState(false);
  const [semAlcas, setSemAlcas] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [comparando, setComparando] = useState(false);
  // A arte e os pontos de pose andam juntos: o diálogo recomeça do zero quando a referência da arte muda.
  const [arteSocial, setArteSocial] = useState<{ arte: AnaliseParaExportar; landmarks: (Landmark[] | null)[] } | null>(null);
  const [larguraTela, setLarguraTela] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const comparadorRef = useRef<HTMLDivElement>(null);

  // Outra posição ou outra foto: o zoom volta ao normal.
  useEffect(() => { setZoom(1); setMover(false); }, [posicao, foto]);

  // A comparação padrão é a avaliação anterior mais recente: ao trocar de paciente, a escolha do anterior é refeita.
  useEffect(() => { setAnteriorId(''); }, [pacienteId]);

  // Largura do SVG na tela: converte pixels de tela em pixels da foto (alvos de toque e rótulo legível).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => setLarguraTela(el.getBoundingClientRect().width);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [foto, zoom, painelEstilo, comparando, modoAnalise, estado.visao]);

  const mudarEstilo = (e: EstiloMarcacao) => { setEstiloLocal(e); salvarEstilo(e); };

  // A página estava rolada até a foto: ao abrir a comparação, leva o título dela para a vista.
  useEffect(() => {
    if (comparando) comparadorRef.current?.scrollIntoView?.({ block: 'start' });
  }, [comparando]);

  // Os botões de zoom ampliam em torno do centro do que está na tela (a pinça já ancora nos dedos).
  const centroZoom = useRef<{ fx: number; fy: number } | null>(null);
  const zoomBotao = (novo: (z: number) => number) => {
    const c = rolagemRef.current;
    if (c && c.scrollWidth > 0 && c.scrollHeight > 0) {
      centroZoom.current = { fx: (c.scrollLeft + c.clientWidth / 2) / c.scrollWidth, fy: (c.scrollTop + c.clientHeight / 2) / c.scrollHeight };
    }
    setZoom(novo);
  };
  useLayoutEffect(() => {
    const c = rolagemRef.current, k = centroZoom.current;
    centroZoom.current = null;
    if (!c || !k) return;
    c.scrollLeft = k.fx * c.scrollWidth - c.clientWidth / 2;
    c.scrollTop = k.fy * c.scrollHeight - c.clientHeight / 2;
  }, [zoom]);

  const disponiveis = useMemo(() => medidasDaVista(vista), [vista]);
  const medidaAtiva: Medida = disponiveis.find((m) => m.id === item.ativa) ?? disponiveis[0];
  const ptsAtiva = pontos[medidaAtiva.id] ?? [];
  const proximo = ptsAtiva.length < medidaAtiva.pontos.length ? medidaAtiva.pontos[ptsAtiva.length] : null;
  // A medida ativa fica por último no SVG: onde pontos de medidas diferentes coincidem (pelve e quadril do joelho), o toque é dela.
  const medidasDasAlcas = useMemo(
    () => [...disponiveis].sort((a, b) => Number(a.id === medidaAtiva.id) - Number(b.id === medidaAtiva.id)),
    [disponiveis, medidaAtiva.id],
  );

  // Estado serializável da análise: o mesmo alimenta a tela, o PDF, a imagem baixada e a arte social.
  const { analise, medidas: medidasAtuais, temResultado, temMarcacao: temPontosMarcados, giro, giroMarcado, giroSensor, cmPorPx, notaNivel } = resumo;
  const faltaPrumo = faltaReferenciaDoPrumo(analise);

  const kEstilo = foto ? escalaDoEstilo(foto.w, foto.h, zoom) : 1;
  const pxPorUnidade = foto && larguraTela > 0 ? larguraTela / foto.w : 0;
  const itensTela = useMemo(
    () => (foto ? itensDaAnalise(analise, estilo, { k: escalaNaTela(kEstilo, pxPorUnidade, estilo.tamanhoRotulo), espMinima: pxPorUnidade > 0 ? (estilo.espessura * ESP_MIN_TELA_PX) / pxPorUnidade : 0 }) : []),
    [foto, analise, estilo, kEstilo, pxPorUnidade],
  );
  const opacidadePorGrupo = useMemo(
    () => (semAlcas ? undefined : Object.fromEntries(disponiveis.filter((m) => m.id !== medidaAtiva.id).map((m) => [m.id, 0.6]))),
    [semAlcas, disponiveis, medidaAtiva.id],
  );

  // ---- foto de cada posição ----
  const aplicarFoto = async (alvo: VistaSessao, arquivo: Blob, inclinacao: number | null) => {
    let nova: FotoDaPosicao;
    try {
      nova = await prepararFoto(arquivo);
    } catch {
      toast.error('Não consegui abrir essa imagem.');
      return;
    }
    acoes.definirFoto(alvo, nova, inclinacao);
    void marcacao.aoCarregarFoto(alvo, nova);
  };

  // Trocar a foto de uma posição que já tem pontos pede confirmação: os pontos dela são apagados (as outras posições não mudam).
  const escolherFoto = (alvo: VistaSessao, arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    if (temMarcacao(estadoRef.current.itens[alvo])) {
      confirmar({
        titulo: 'Trocar a foto desta posição?',
        texto: `Os pontos marcados em ${ROTULO_VISTA_SESSAO[alvo].toLowerCase()} serão apagados. As outras posições não mudam.`,
        confirmar: 'Trocar a foto',
        aoConfirmar: () => void aplicarFoto(alvo, arquivo, null),
      });
      return;
    }
    void aplicarFoto(alvo, arquivo, null);
  };

  const cam = useCameraDaSessao({ estadoRef, acoes, confirmar, guardarFoto: (alvo, arquivo, inclinacao) => void aplicarFoto(alvo, arquivo, inclinacao) });
  const abrirCamera = cam.abrir;

  const irParaProxima = (depoisDe: VistaSessao) => {
    const proxima = proximaPosicao(estadoRef.current, depoisDe);
    if (proxima) acoes.ir(proxima);
    else acoes.abrirResumo();
  };
  const pularPosicao = () => {
    acoes.pular(posicao);
    const proxima = proximaPosicao(estadoRef.current, posicao, [posicao]);
    if (proxima) acoes.ir(proxima);
    else acoes.abrirResumo();
  };
  const salvarEIr = async () => {
    if (await salvar(posicao)) irParaProxima(posicao);
  };

  const doEvento = (e: { clientX: number; clientY: number }): Ponto | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.min(Math.max(p.x, 0), foto?.w ?? 0), y: Math.min(Math.max(p.y, 0), foto?.h ?? 0) };
  };

  // Um dedo marca e arrasta pontos (com a lupa); dois dedos fazem zoom e movem a foto.
  const gestos = useGestosFoto({
    svgRef, rolagemRef, caixaRef, zoom, setZoom, zoomMax: ZOOM_MAX, mover, noPonto: doEvento, podeMarcar: !!proximo,
    aoMarcar: (p) => acoes.marcar(posicao, medidaAtiva.id, p),
    aoArrastar: (medida, indice, p) => {
      if (medida.endsWith(SUFIXO_ALCA)) {
        // A alça do topo só desloca o fio na horizontal; o apoio mantém a altura.
        const id = medida.slice(0, -SUFIXO_ALCA.length);
        const apoio = pontos[id]?.[0];
        if (apoio) acoes.arrastar(posicao, id, 0, apoioPelaAlca(p, apoio, giro, foto?.w ?? 0));
        return;
      }
      acoes.arrastar(posicao, medida, indice, p);
    },
    aoIniciarArrasto: (medida) => acoes.ativar(posicao, medida.endsWith(SUFIXO_ALCA) ? medida.slice(0, -SUFIXO_ALCA.length) : medida),
  });

  const desfazer = () => acoes.desfazer(posicao, medidaAtiva.id);
  const limpar = () => acoes.limpar(posicao, medidaAtiva.id);

  const baixarImagem = async () => {
    if (!foto) return;
    setBaixando(true);
    try {
      const cv = canvasComMedidas(analise, estilo, { auxiliares: false });
      const blob = cv ? await canvasParaBlob(cv) : null;
      if (!blob) { toast.error('Não consegui gerar a imagem.'); return; }
      baixarBlob(blob, nomeArquivoImagem(vista, new Date(), 'png', lado));
      toast.success('Imagem baixada com as marcações.');
    } catch {
      toast.error('Não consegui gerar a imagem.');
    } finally {
      setBaixando(false);
    }
  };

  const abrirArteDaFoto = () => {
    if (!foto) return;
    const arte = analiseDaFotoParaExportar(analise, estilo);
    if (!arte) { toast.error('Não consegui montar a imagem.'); return; }
    setArteSocial({ arte, landmarks: [item.landmarks] });
  };
  const abrirArteDaComparacao = (arte: AnaliseParaExportar, extras: ExtrasDaArte) => setArteSocial({ arte, landmarks: extras.landmarks });

  const copiar = async () => {
    const texto = medidasAtuais.map((m) => `• ${m.texto}`).join('\n');
    try { await navigator.clipboard.writeText(`Análise angular — vista ${ROTULO_VISTA_SESSAO[posicao].toLowerCase()}\n${texto}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  // ---- avaliações anteriores (agrupadas por sessão) e comparação ----
  const candidatas = useMemo(() => sessoesComPosicao(historico, posicao, estado.id), [historico, posicao, estado.id]);
  const anteriorDaPosicao = candidatas.find((s) => s.id === anteriorId) ?? candidatas[0] ?? null;
  const comparacaoDaPosicao = useMemo(() => {
    const antes = anteriorDaPosicao?.posicoes[posicao];
    if (!anteriorDaPosicao || !antes || !resumo.temResultado) return null;
    return compararSessoes(
      { esquema: ESQUEMA_ANALISE_FOTO, posicoes: { [posicao]: { medidas: resumo.medidas, nivelGraus: resumo.giro } } },
      { esquema: anteriorDaPosicao.esquema, posicoes: { [posicao]: antes } },
    );
  }, [anteriorDaPosicao, posicao, resumo]);
  const temPerfilAntigo = (posicao === 'perfil_d' || posicao === 'perfil_e') && historico.some((s) => !!s.posicoes.perfil_sem_lado);

  const posicoesFeitas = VISTAS_DA_SESSAO.filter((p) => resumos[p].temResultado);
  const anteriores = useMemo(() => historico.filter((s) => s.id !== estado.id), [historico, estado.id]);
  const anteriorDoResumo = anteriores.find((s) => s.id === anteriorId) ?? anteriores.find((s) => posicoesFeitas.some((p) => !!s.posicoes[p])) ?? null;
  const comparacaoDaSessao = useMemo(() => {
    if (!anteriorDoResumo) return null;
    const atual: SessaoParaComparar = {
      esquema: ESQUEMA_ANALISE_FOTO,
      posicoes: Object.fromEntries(VISTAS_DA_SESSAO.filter((p) => resumos[p].temResultado).map((p) => [p, { medidas: resumos[p].medidas, nivelGraus: resumos[p].giro }])),
    };
    return compararSessoes(atual, anteriorDoResumo);
  }, [anteriorDoResumo, resumos]);

  const { gerando, gerarPdf, gerarPdfDaSessao } = useRelatoriosDaSessao({
    estadoRef, posicao, resumo, temFoto: !!foto, paciente, profile, estilo, comFoto, anteriorDaPosicao, anteriorDoResumo,
  });

  // ---- paciente e sessão ----
  const mudarModo = (id: 'foto' | 'marcha') => { const n = new URLSearchParams(sp); if (id === 'marcha') n.set('modo', 'marcha'); else n.delete('modo'); setSp(n, { replace: true }); };
  const mudarPaciente = (v: string) => {
    if (v === pacienteId) return;
    const aplicar = () => { const n = new URLSearchParams(sp); if (v) n.set('paciente', v); else n.delete('paciente'); setSp(n, { replace: true }); };
    // Trocar de paciente com a sessão em andamento gravaria as medidas no cliente errado: pergunta e recomeça a sessão.
    // Escolher o primeiro paciente de uma análise avulsa não perde nada e segue com a sessão.
    if (algoPreenchido(estadoRef.current) && (pacienteId || pacienteDaSessao(estadoRef.current))) {
      confirmar({
        titulo: 'Trocar o paciente?',
        texto: 'A sessão em andamento será reiniciada: as fotos e os pontos desta sessão serão descartados. As posições já salvas continuam no prontuário do paciente anterior.',
        confirmar: 'Trocar e reiniciar',
        aoConfirmar: () => { acoes.reiniciar(); aplicar(); },
      });
      return;
    }
    aplicar();
  };
  const novaSessao = () => confirmar({
    titulo: 'Começar uma nova sessão?',
    texto: 'As fotos e os pontos desta sessão serão descartados. As posições já salvas continuam no prontuário.',
    confirmar: 'Começar nova sessão',
    aoConfirmar: () => { acoes.reiniciar(); setAnteriorId(''); },
  });

  const donoDasNotas = pacienteDaSessao(estado);
  const outroPaciente = !!paciente && !!donoDasNotas && donoDasNotas !== paciente.id;
  const podeSalvar = !!paciente && temResultado && !outroPaciente;
  const proxima = proximaPosicao(estado, posicao);
  const efetivas = previstasEfetivas(estado);
  const abas: AbaDaSessao[] = VISTAS_DA_SESSAO.map((p) => ({ posicao: p, miniatura: estado.itens[p].foto?.url ?? null, estado: estadoDaAba(estado.itens[p]) }));
  const camera = cam.camera;
  const ordemDaCamera = camera ? ordemNaSessao(estado, camera.posicao) : null;

  const base = foto ? Math.max(foto.w, foto.h) / 110 : 8;
  const raio = base / Math.sqrt(zoom);
  const proporcao = foto ? foto.w / foto.h : 1;
  const semEscala = medidaAtiva.id === 'regua' && !cmPorPx;
  const alturaMaxDvh = painelEstilo ? 55 : 75;
  const toquePx = (css: number) => (pxPorUnidade > 0 ? css / pxPorUnidade : raio * 2);

  const entradaDeFoto = (alvo: VistaSessao) => (e: ChangeEvent<HTMLInputElement>) => { escolherFoto(alvo, e.target.files?.[0]); e.target.value = ''; };

  return (
    <AppLayout>
      <div className="container max-w-6xl space-y-5 px-0 py-6 sm:px-8">
        <PageHeader back="/aplicacoes" title="Análise angular" subtitle="Meça ângulos e desníveis em uma foto, ou ponto a ponto em um vídeo." icon={<Ruler className="icon-md" />} />

        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-medium">Paciente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <PacienteSelect pacientes={lista} value={pacienteId} onValueChange={mudarPaciente} placeholder="Escolher para salvar no prontuário…" />
            </div>
            {pacienteId && <Button variant="ghost" size="icon" aria-label="Tirar paciente" onClick={() => mudarPaciente('')}><X className="h-4 w-4" /></Button>}
          </div>
        </div>

        <div role="tablist" aria-label="Tipo de análise" className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
          {([['foto', 'Postura em foto', Camera], ['marcha', 'Análise em vídeo', Film]] as const).map(([id, rotulo, Icone]) => (
            <button key={id} type="button" role="tab" aria-selected={modoAnalise === id} onClick={() => mudarModo(id)}
              className={cn('flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all', modoAnalise === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icone className="h-4 w-4" /> {rotulo}
            </button>
          ))}
        </div>

        {modoAnalise === 'marcha' ? (
          <div className="space-y-3">
            <div role="tablist" aria-label="Tipo de análise em vídeo" className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
              {([['ponto', 'Ponto a ponto'], ['auto', 'Gesto automático']] as const).map(([id, rotulo]) => (
                <button key={id} type="button" role="tab" aria-selected={modoVideo === id} onClick={() => setModoVideo(id)}
                  className={cn('rounded-xl px-3 py-2 text-sm font-semibold transition-all', modoVideo === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{rotulo}</button>
              ))}
            </div>
            {modoVideo === 'ponto' ? <PontoAPontoVideo paciente={paciente} estilo={estilo} aoMudarEstilo={mudarEstilo} /> : <MarchaVideo paciente={paciente} estilo={estilo} aoMudarEstilo={mudarEstilo} />}
          </div>
        ) : comparando ? (
          <div ref={comparadorRef} className="mx-auto w-full max-w-4xl scroll-mt-20">
            <ComparadorFotos
              key={`${posicao}-${foto?.url ?? 'sem-foto'}`} vista={vista} lado={lado} seletorDePosicao
              atual={foto ? { analise, url: foto.url, landmarks: item.landmarks } : null}
              estilo={estilo} onEstiloChange={mudarEstilo} onExportar={abrirArteDaComparacao} onFechar={() => setComparando(false)} />
          </div>
        ) : (
          <div className="space-y-3">
            <SessaoVistas abas={abas} atual={posicao} visao={estado.visao} feitas={posicoesFeitas.length} total={efetivas.length} aoIr={acoes.ir} aoAbrirResumo={acoes.abrirResumo} />

            {estado.visao === 'resumo' ? (
              <ResumoSessao
                posicoes={VISTAS_DA_SESSAO.map((p) => ({ posicao: p, estado: estadoDaAba(estado.itens[p]), medidas: resumos[p].medidas }))}
                membros={paresMembrosSuperiores(VISTAS_DA_SESSAO.map((p) => ({ posicao: p, medidas: resumos[p].medidas })))}
                anteriores={anteriores} anteriorId={anteriorDoResumo?.id ?? ''} anterior={anteriorDoResumo} comparacao={comparacaoDaSessao}
                comFoto={comFoto} aoMudarComFoto={setComFoto} aoEscolherAnterior={setAnteriorId} aoIr={acoes.ir}
                aoGerarPdf={() => void gerarPdfDaSessao()} gerando={gerando} temPaciente={!!paciente} aoNovaSessao={novaSessao} />
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-3">
                  {!foto ? (
                    <>
                      <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm font-semibold">Tirar ou escolher a foto ({ROTULO_VISTA_SESSAO[posicao].toLowerCase()})</span>
                        <span className="max-w-sm text-sm font-medium" data-testid="instrucao-posicao">{INSTRUCAO_DA_POSICAO[posicao]}</span>
                        <span className="max-w-sm text-xs text-muted-foreground">Câmera parada na altura do meio do corpo, paciente inteiro no quadro, boa luz e roupa justa. A foto fica só neste aparelho.</span>
                        {item.pulada && <span className="text-xs font-medium text-muted-foreground">Esta posição foi pulada. Se quiser, fotografe agora.</span>}
                        <input type="file" accept="image/*" className="sr-only" aria-label={`Escolher a foto: ${ROTULO_VISTA_SESSAO[posicao]}`} onChange={entradaDeFoto(posicao)} />
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.preventDefault(); abrirCamera(posicao, true); }}><Smartphone className="h-3.5 w-3.5" /> Tirar a foto no app</Button>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {!item.pulada && (
                          <Button variant="outline" className="h-11 gap-2" onClick={pularPosicao} data-testid="pular-posicao">
                            <SkipForward className="h-4 w-4" /> Pular posição
                          </Button>
                        )}
                        <Button variant="outline" className={cn('h-auto min-h-11 gap-2 whitespace-normal text-[13px] leading-tight', item.pulada && 'col-span-2')} onClick={() => setComparando(true)} data-testid="abrir-comparador-vazio">
                          <Columns2 className="h-4 w-4 shrink-0" /> Comparar duas fotos lado a lado
                        </Button>
                      </div>
                      <p className="px-1 text-[11px] leading-snug text-muted-foreground">{DICA_COMPARAR}</p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div ref={caixaRef} className="relative min-w-0 flex-1">
                          <div ref={rolagemRef} className="overflow-auto rounded-2xl border border-border/60 bg-black" style={{ maxHeight: `${alturaMaxDvh}dvh` }}>
                            <svg ref={svgRef} viewBox={`0 0 ${foto.w} ${foto.h}`} className={cn('mx-auto block max-w-none select-none [-webkit-touch-callout:none]', !mover && 'touch-none')}
                              style={{ width: `min(${zoom * 100}%, calc(${alturaMaxDvh}dvh * ${proporcao.toFixed(4)} * ${zoom}))`, cursor: mover ? 'grab' : proximo ? 'crosshair' : 'default' }}
                              onContextMenu={(e) => e.preventDefault()}
                              {...gestos.handlers}>
                              <image href={foto.url} width={foto.w} height={foto.h} />
                              {grade && (
                                <g transform={giro ? `rotate(${giro} ${foto.w / 2} ${foto.h / 2})` : undefined} stroke="#06b6d4" strokeOpacity={0.6} strokeWidth={base / 12} strokeDasharray={`${base / 2} ${base / 2}`} pointerEvents="none">
                                  {Array.from({ length: 17 }, (_, i) => (
                                    <g key={i}>
                                      <line x1={-foto.w} x2={foto.w * 2} y1={(foto.h / 8) * (i - 4)} y2={(foto.h / 8) * (i - 4)} />
                                      <line y1={-foto.h} y2={foto.h * 2} x1={(foto.w / 8) * (i - 4)} x2={(foto.w / 8) * (i - 4)} />
                                    </g>
                                  ))}
                                </g>
                              )}
                              <ItensSvg itens={itensTela} opacidadePorGrupo={opacidadePorGrupo} />
                              {!semAlcas && medidasDasAlcas.map((m) => {
                                const p = pontos[m.id] ?? [];
                                const destaque = m.id === medidaAtiva.id;
                                const alca = destaque && m.desenho === 'prumo' && p.length > 0 ? alcaDoPrumo(p[0], foto.h, giro) : null;
                                return (
                                  <g key={m.id} opacity={destaque ? 1 : 0.6}>
                                    {p.map((q, i) => (
                                      <g key={i} onPointerDown={(e) => gestos.aoPressionarPonto(e, m.id, i)} style={{ cursor: mover ? 'grab' : 'move', pointerEvents: proximo && !destaque ? 'none' : undefined }}>
                                        <circle cx={q.x} cy={q.y} r={Math.max(raio, toquePx(proximo ? TOQUE_MARCANDO : destaque ? TOQUE_ATIVA : TOQUE_OUTRAS))} fill="transparent" />
                                        <circle cx={q.x} cy={q.y} r={raio} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={raio / 5} />
                                        <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={raio * 1.1} fill="#fff" fontWeight="700" pointerEvents="none">{i + 1}</text>
                                      </g>
                                    ))}
                                    {alca && (
                                      <g onPointerDown={(e) => gestos.aoPressionarPonto(e, `${m.id}${SUFIXO_ALCA}`, 0)} style={{ cursor: mover ? 'grab' : 'ew-resize' }} data-testid="alca-prumo">
                                        <circle cx={alca.x} cy={alca.y} r={toquePx(TOQUE_ALCA)} fill="transparent" />
                                        <circle cx={alca.x} cy={alca.y} r={toquePx(12)} fill={estilo.cor} stroke="#fff" strokeWidth={toquePx(2)} />
                                        <path d={`M ${alca.x - toquePx(6.5)} ${alca.y} H ${alca.x + toquePx(6.5)} M ${alca.x - toquePx(6.5)} ${alca.y} l ${toquePx(3)} ${-toquePx(3)} M ${alca.x - toquePx(6.5)} ${alca.y} l ${toquePx(3)} ${toquePx(3)} M ${alca.x + toquePx(6.5)} ${alca.y} l ${-toquePx(3)} ${-toquePx(3)} M ${alca.x + toquePx(6.5)} ${alca.y} l ${-toquePx(3)} ${toquePx(3)}`}
                                          stroke="#111" strokeWidth={toquePx(2)} strokeLinecap="round" fill="none" pointerEvents="none" />
                                      </g>
                                    )}
                                  </g>
                                );
                              })}
                            </svg>
                          </div>

                          {gestos.lupa && (
                            <LupaFoto lupa={gestos.lupa} href={foto.url} w={foto.w} h={foto.h} svgRef={svgRef} caixaRef={caixaRef}
                              pontos={ptsAtiva} segmentos={segmentosDaMedida(medidaAtiva)} comNovo={gestos.novoAtivo} />
                          )}
                        </div>

                        <nav aria-label="Ferramentas de medida" className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl border border-border/60 bg-card p-1" style={{ maxHeight: `${alturaMaxDvh}dvh` }}>
                          {GRUPOS.map((g, gi) => {
                            const itens = disponiveis.filter((m) => m.grupo === g.id);
                            if (!itens.length) return null;
                            return (
                              <div key={g.id} className="flex flex-col gap-1">
                                {gi > 0 && <span className="mx-1 h-px bg-border" aria-hidden />}
                                {itens.map((m) => {
                                  const Icone = ICONE_MEDIDA[m.id] ?? Ruler;
                                  const feita = (pontos[m.id]?.length ?? 0) >= m.pontos.length;
                                  const ativa = m.id === medidaAtiva.id;
                                  return (
                                    <button key={m.id} type="button" onClick={() => acoes.ativar(posicao, m.id)} aria-pressed={ativa} aria-label={m.nome} title={m.nome}
                                      className={cn('relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors', ativa ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                                      <Icone className="h-5 w-5" style={!ativa && COR_REFERENCIA[m.id] ? { color: COR_REFERENCIA[m.id] } : undefined} />
                                      {LADO_MEDIDA[m.id] && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none">{LADO_MEDIDA[m.id]}</span>}
                                      {feita && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" aria-hidden />}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </nav>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-card p-1" role="toolbar" aria-label="Ações da foto">
                        <Button size="sm" className="h-10 gap-1.5" onClick={() => void marcacao.automatico(posicao)} disabled={marcacao.detectando !== null} title="Marcar automaticamente as medidas que ainda não têm pontos">
                          {marcacao.detectando === posicao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} <span className="hidden sm:inline">Automático</span>
                        </Button>
                        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
                        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Desfazer o último ponto" title="Desfazer" onClick={desfazer} disabled={!ptsAtiva.length}><Undo2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Limpar a medida" title="Limpar a medida" onClick={limpar} disabled={!ptsAtiva.length}><Trash2 className="h-4 w-4" /></Button>
                        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
                        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => zoomBotao((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1}><ZoomOut className="h-4 w-4" /></Button>
                        <span className="min-w-[2.6rem] text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
                        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => zoomBotao((z) => Math.min(ZOOM_MAX, +(z + 0.5).toFixed(1)))} disabled={zoom >= ZOOM_MAX}><ZoomIn className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Ajustar à tela" title="Ajustar à tela" onClick={() => { setZoom(1); setMover(false); }}><Maximize2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant={mover ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={mover} aria-label={mover ? 'Voltar a marcar' : 'Mover a foto com um dedo'} title={mover ? 'Voltar a marcar' : 'Mover a foto com um dedo'} onClick={() => setMover((m) => !m)} disabled={zoom <= 1}>
                          {mover ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant={grade ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={grade} aria-label="Grade" title="Grade" onClick={() => setGrade((g) => !g)}><Grid3x3 className="h-4 w-4" /></Button>
                        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
                        <Button size="icon" variant={painelEstilo ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={painelEstilo} aria-label="Estilo das linhas" title="Estilo das linhas (espessura, cor, arco e rótulo)" onClick={() => setPainelEstilo((v) => !v)}><Palette className="h-4 w-4" /></Button>
                        <Button size="icon" variant={semAlcas ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={semAlcas} aria-label="Ver só o desenho" title="Ver só o desenho, sem as alças dos pontos" onClick={() => setSemAlcas((v) => !v)}>{semAlcas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Baixar imagem" title="Baixar a foto com as marcações (PNG)" onClick={() => void baixarImagem()} disabled={!temPontosMarcados || baixando}>{baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}</Button>
                        <span className="ml-auto flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Tirar a foto no app" title="Tirar a foto no app" onClick={() => abrirCamera(posicao, false)}><Smartphone className="h-4 w-4" /></Button>
                          <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Trocar a foto" aria-label="Trocar a foto">
                            <Camera className="h-4 w-4" />
                            <input type="file" accept="image/*" className="sr-only" onChange={entradaDeFoto(posicao)} />
                          </label>
                        </span>
                      </div>

                      <AvisosDaMarcacao sugestao={item.sugestao} inverterDE={item.inverterDE} temPontosDoModelo={!!item.landmarks}
                        aoInverter={() => void marcacao.alternarDireitaEsquerda(posicao)} ocupado={marcacao.detectando !== null} />

                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-auto min-h-11 gap-1.5 whitespace-normal px-2 text-[13px] leading-tight" onClick={() => setComparando(true)} data-testid="abrir-comparador">
                          <Columns2 className="h-4 w-4 shrink-0" /> Comparar lado a lado
                        </Button>
                        <Button className="h-auto min-h-11 gap-1.5 whitespace-normal px-2 text-[13px] leading-tight" onClick={abrirArteDaFoto} disabled={!temPontosMarcados} data-testid="baixar-instagram"
                          title={temPontosMarcados ? 'Arte pronta para Stories, Reels ou Feed' : 'Marque uma medida para montar a arte'}>
                          <Instagram className="h-4 w-4 shrink-0" /> Baixar para Instagram
                        </Button>
                      </div>

                      {painelEstilo && <PainelEstilo estilo={estilo} aoMudar={mudarEstilo} aoFechar={() => setPainelEstilo(false)} />}

                      <p className="text-xs text-muted-foreground" role="status">
                        <strong className="text-foreground">{medidaAtiva.nome}.</strong>{' '}
                        {mover ? 'Modo mover: arraste a foto com um dedo.'
                          : proximo ? <>Toque e segure para ver a lupa; solte para marcar <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong>.</>
                            : 'Medida completa. Arraste um ponto para ajustar.'}
                        {' '}Dois dedos: zoom e mover.
                      </p>
                    </div>
                  )}
                </div>

                {foto && (
                  <aside className="space-y-3 lg:sticky lg:top-4">
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
                      <details className="group rounded-xl border border-border/60 p-2.5">
                        <summary className="cursor-pointer text-sm font-semibold">Todas as medidas</summary>
                        <div className="mt-2 space-y-3">
                          {GRUPOS.map((g) => {
                            const itens = disponiveis.filter((m) => m.grupo === g.id);
                            if (!itens.length) return null;
                            return (
                              <div key={g.id} className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
                                {itens.map((m) => {
                                  const n = pontos[m.id]?.length ?? 0;
                                  const feita = n >= m.pontos.length;
                                  const estadoDaMedida = m.id === 'nivel' && giro !== null ? `${nf(Math.abs(giro))}°`
                                    : m.id === 'escala' && cmPorPx ? 'calibrada'
                                      : feita ? 'feita' : `${n}/${m.pontos.length}`;
                                  return (
                                    <button key={m.id} type="button" onClick={() => acoes.ativar(posicao, m.id)} aria-pressed={m.id === medidaAtiva.id}
                                      className={cn('flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                                        m.id === medidaAtiva.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                                      <span className="flex items-center gap-2">
                                        {COR_REFERENCIA[m.id] && <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_REFERENCIA[m.id] }} aria-hidden />}
                                        {m.nome}
                                      </span>
                                      <span className={cn('text-[11px] tabular-nums', feita ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{estadoDaMedida}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                      <p className="px-0.5 text-xs text-muted-foreground"><strong className="text-foreground">Ferramenta ativa:</strong> {medidaAtiva.nome}</p>
                      {medidaAtiva.id === 'nivel' && (
                        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                          {giroMarcado === null && giroSensor !== null ? (
                            <>
                              <p className="font-medium">{Math.abs(giroSensor) < 0.05 ? 'Foto já está nivelada.' : `Corrigido automaticamente pelo sensor do celular: foto girada ${nf(Math.abs(giroSensor))}°.`}</p>
                              <p className="text-muted-foreground">Ligue a grade e confira se as linhas acompanham o chão. Se estiverem tortas para o lado errado, inverta. Para usar outra referência, marque 2 pontos sobre algo reto (chão, rodapé ou fio de prumo).</p>
                              <div className="flex flex-wrap gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => acoes.editar(posicao, { inverterSensor: !item.inverterSensor })}>Inverter o sentido</Button>
                                <Button size="sm" variant="ghost" onClick={() => acoes.editar(posicao, { inclinacaoCaptura: null })}>Sem correção</Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-muted-foreground">Marque 2 pontos sobre algo que na vida real é reto: o rodapé ou o chão (horizontal), um fio de prumo ou batente de porta (vertical). O app mede o giro da foto e corrige todos os ângulos. Fotos tiradas pelo botão “Tirar a foto no app” já saem corrigidas.</p>
                              <div className="grid grid-cols-2 gap-1">
                                {(['horizontal', 'vertical'] as const).map((t) => (
                                  <button key={t} type="button" aria-pressed={item.nivelTipo === t} onClick={() => acoes.editar(posicao, { nivelTipo: t })}
                                    className={cn('rounded-lg border px-2 py-1.5 font-medium capitalize', item.nivelTipo === t ? 'border-primary bg-primary/10' : 'border-border/60')}>{t}</button>
                                ))}
                              </div>
                              {giro !== null && <p className="font-medium">{Math.abs(giro) < 0.05 ? 'Foto já está nivelada.' : `Foto girada ${nf(Math.abs(giro))}°: todos os ângulos já saem corrigidos.`}</p>}
                            </>
                          )}
                        </div>
                      )}
                      {medidaAtiva.id === 'escala' && (
                        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                          <p className="text-muted-foreground">Marque as pontas de um objeto de tamanho conhecido, no mesmo plano do paciente (fita métrica, régua, marcador no chão), e informe o comprimento.</p>
                          <div className="flex items-center gap-2">
                            <Input inputMode="decimal" value={item.escalaCm} onChange={(e) => acoes.editar(posicao, { escalaCm: e.target.value })} placeholder="Comprimento" className="h-9 text-[16px] sm:text-sm" aria-label="Comprimento do objeto em centímetros" />
                            <span className="shrink-0 font-medium">cm</span>
                          </div>
                          {cmPorPx && <p className="font-medium">Escala pronta: a régua já mede em centímetros.</p>}
                        </div>
                      )}
                      {semEscala && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">Para medir em centímetros, primeiro calibre a escala (em “Referências da foto”).</p>}
                      {medidaAtiva.id === 'cobb' && <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">Marque as duas retas (por exemplo, as linhas das vértebras limite da curva). O app dá o ângulo entre elas. Em foto, é uma estimativa; o Cobb de referência vem da radiografia.</p>}
                      {medidaAtiva.definicao && medidaAtiva.desenho !== 'prumo' && medidaAtiva.id !== 'compasso-ref' && (
                        <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground" data-testid="definicao-medida"><strong className="text-foreground">Como é medido.</strong> {medidaAtiva.definicao}</p>
                      )}
                      {item.sugeridas.includes(medidaAtiva.id) && item.sugestao?.origens[medidaAtiva.id] && (
                        <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground" data-testid="origem-sugestao">Pontos sugeridos pelo modelo: {item.sugestao?.origens[medidaAtiva.id]}.</p>
                      )}
                      {medidaAtiva.id === 'compasso-ref' && (
                        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs" data-testid="cartao-compasso-ref">
                          <p className="text-muted-foreground">{medidaAtiva.definicao}</p>
                          <p className="font-medium">Medir contra</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {REFS_COMPASSO.map((r) => {
                              const Seta = SETA_REF[r.id];
                              return (
                                <button key={r.id} type="button" aria-pressed={estado.compassoRef === r.id} onClick={() => acoes.definirOpcoes({ compassoRef: r.id })}
                                  className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-center font-medium leading-tight', estado.compassoRef === r.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
                                  <Seta className="h-4 w-4 shrink-0" aria-hidden /> {r.nome}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {medidaAtiva.desenho === 'prumo' && (
                        <div className="space-y-2.5 rounded-xl bg-muted/40 p-2.5 text-xs" data-testid="cartao-prumo">
                          <p className="text-muted-foreground">{medidaAtiva.definicao} Arraste a alça no topo do fio para posicioná-lo.</p>
                          <div className="space-y-1">
                            <p className="font-medium">Mostrar o desvio em</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {UNIDADES_PRUMO.map((u) => (
                                <button key={u.id} type="button" aria-pressed={estado.unidadePrumo === u.id} onClick={() => acoes.definirOpcoes({ unidadePrumo: u.id })}
                                  className={cn('min-h-11 rounded-xl border px-1.5 py-1.5 font-medium leading-tight', estado.unidadePrumo === u.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>{u.nome}</button>
                              ))}
                            </div>
                          </div>
                          {vista === 'perfil' && (
                            <div className="space-y-1">
                              <p className="font-medium">O paciente olha para a</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {([['esquerda', ArrowLeft], ['direita', ArrowRight]] as const).map(([sentido, Seta]) => (
                                  <button key={sentido} type="button" aria-pressed={item.olhaPara === sentido} onClick={() => acoes.editar(posicao, { olhaPara: sentido })}
                                    className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 font-medium', item.olhaPara === sentido ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
                                    <Seta className="h-4 w-4 shrink-0" aria-hidden /> {sentido === 'esquerda' ? 'Esquerda da imagem' : 'Direita da imagem'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <Button size="sm" variant="outline" className="h-11 w-full gap-1.5" onClick={() => void marcacao.sugerirPrumo(posicao)} disabled={marcacao.detectando !== null}>
                            {marcacao.detectando === posicao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sugerir os pontos do fio
                          </Button>
                          {faltaPrumo && <p className="rounded-lg bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">{faltaPrumo}</p>}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
                      <p className="text-sm font-semibold">Resultado <span className="text-xs font-normal text-muted-foreground">· {ROTULO_VISTA_SESSAO[posicao]}</span></p>
                      {!temResultado ? <p className="text-xs text-muted-foreground">Complete uma medida para ver o resultado.</p> : (
                        <ul className="space-y-1.5 text-sm tabular-nums">{medidasAtuais.map((m) => <li key={m.id}><TextoDaMedida m={m} /></li>)}</ul>
                      )}
                      {notaNivel && <p className="text-[11px] text-muted-foreground">Correção de nível aplicada: {nf(Math.abs(giro ?? 0))}°.</p>}
                      <p className="text-[11px] text-muted-foreground">{DICA_COMPARAR}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button onClick={() => void salvar(posicao)} disabled={!podeSalvar || salvando !== null} className="min-w-[180px] flex-1 gap-1.5" data-testid="salvar-posicao">
                          {salvando === posicao ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} {item.notaId ? 'Atualizar esta posição' : 'Salvar esta posição'}
                        </Button>
                        <Button variant="outline" onClick={copiar} disabled={!temResultado} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
                      </div>
                      <Button variant="outline" onClick={() => void salvarEIr()} disabled={!podeSalvar || salvando !== null} className="min-h-11 w-full" data-testid="salvar-e-proxima">
                        {proxima ? 'Salvar e ir para a próxima' : 'Salvar e ver o resumo'}
                      </Button>
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Button variant="outline" onClick={gerarPdf} disabled={!temResultado || gerando} className="gap-1.5">
                          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF desta posição
                        </Button>
                        <Button variant="outline" onClick={() => void baixarImagem()} disabled={!temPontosMarcados || baixando} className="gap-1.5">
                          {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} Baixar imagem
                        </Button>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={comFoto} onChange={(e) => setComFoto(e.target.checked)} /> Incluir a foto com as marcações</label>
                      </div>
                      {!paciente && temResultado && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo para salvar no prontuário. A análise e o PDF funcionam sem paciente.</p>}
                      {paciente && !temResultado && <p className="text-[11px] text-muted-foreground">Complete uma medida para poder salvar.</p>}
                      {outroPaciente && (
                        <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                          Esta sessão já tem posições salvas de outro paciente. Para salvar neste paciente, comece uma nova sessão (no resumo).
                        </p>
                      )}
                    </div>

                    {paciente && (
                      <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" data-testid="comparar-anterior">
                        <p className="text-sm font-semibold">Comparar com avaliação anterior</p>
                        {candidatas.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Ainda não há análise angular de {ROTULO_VISTA_SESSAO[posicao].toLowerCase()} registrada para este paciente.</p>
                        ) : (
                          <>
                            <SeletorDeAnterior sessoes={candidatas} valor={anteriorId} aoMudar={setAnteriorId} />
                            {!temResultado ? <p className="text-xs text-muted-foreground">Complete uma medida para comparar.</p> : comparacaoDaPosicao && <TabelaComparacao comparacao={comparacaoDaPosicao} />}
                          </>
                        )}
                        {temPerfilAntigo && <p className="text-[11px] text-muted-foreground">Há análises antigas de perfil sem o lado informado: elas não são comparadas com perfil direito ou esquerdo, porque não dá para saber de que lado foi a foto.</p>}
                      </div>
                    )}

                    <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                      A marcação automática acha centros de articulação, não os pontos ósseos da clínica (acrômio, crista ilíaca, C7, trocânter): use como ponto de partida, confira e ajuste. No ângulo craniovertebral o C7 sempre é marcado à mão. Sem a referência de nível, os ângulos usam a horizontal e a vertical da foto: com a câmera torta, os desníveis saem errados. Serve para acompanhar a evolução entre fotos feitas do mesmo jeito; não define diagnóstico.
                    </p>
                  </aside>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <ExportarSocialDialog aberto={!!arteSocial} aoFechar={() => setArteSocial(null)} arte={arteSocial?.arte ?? null} landmarks={arteSocial?.landmarks} terapeutaId={user?.id} />
      {camera && ordemDaCamera && (
        <CameraNivel
          onFechar={cam.fechar} onCapturar={cam.aoCapturar}
          posicao={ROTULO_VISTA_SESSAO[camera.posicao]} instrucao={INSTRUCAO_DA_POSICAO[camera.posicao]} ultima={camera.ultima || undefined}
          progresso={camera.sequencia ? `Posição ${ordemDaCamera.ordem} de ${ordemDaCamera.total}` : undefined}
          onPular={camera.sequencia ? cam.aoPular : undefined} />
      )}
      {dialogoConfirmar}
    </AppLayout>
  );
}
