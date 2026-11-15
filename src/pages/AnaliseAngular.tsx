import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, ClipboardCheck, Columns2, Copy, FileDown, Film, ImageDown, Instagram, Loader2, Ruler, SkipForward, Smartphone, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import MarchaVideo from '@/components/angular/MarchaVideo';
import PontoAPontoVideo from '@/components/angular/PontoAPontoVideo';
import CameraNivel from '@/components/angular/CameraNivel';
import ComparadorFotos, { type ExtrasDaArte } from '@/components/angular/ComparadorFotos';
import ExportarSocialDialog from '@/components/angular/ExportarSocialDialog';
import { CartaoDasMedidas } from '@/components/angular/CartaoDasMedidas';
import AnaliseLivre from '@/components/angular/AnaliseLivre';
import { EditorDaFoto } from '@/components/angular/EditorDaFoto';
import ResumoSessao, { SeletorDeAnterior, TabelaComparacao, TextoDaMedida } from '@/components/angular/ResumoSessao';
import { AvisosDaMarcacao, SentidoDoOlhar, SessaoVistas, type AbaDaSessao } from '@/components/angular/SessaoVistas';
import { useConfirmacao } from '@/components/angular/ConfirmarAcao';
import { DICA_COMPARAR, INSTRUCAO_DA_POSICAO } from '@/components/angular/textosSessao';
import {
  algoPreenchido, estadoDaAba, ordemNaSessao, pacienteDaSessao, previstasEfetivas, proximaPosicao, temMarcacao, useSessaoPostural, type FotoDaPosicao,
} from '@/hooks/useSessaoPostural';
import { useMarcacaoAutomatica } from '@/hooks/useMarcacaoAutomatica';
import { useCameraDaSessao } from '@/hooks/useCameraDaSessao';
import { useAnaliseLivre } from '@/hooks/useAnaliseLivre';
import { useGravarPosicao, useHistoricoDeSessoes, useRelatoriosDaSessao } from '@/hooks/useSessaoDoPaciente';
import { useVisaoDaFoto } from '@/hooks/useVisaoDaFoto';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { medidasDaVista, type Medida, type UnidadePrumo } from '@/lib/angular/medidas';
import { prepararFoto } from '@/lib/angular/fotoSessao';
import { paresMembrosSuperiores } from '@/lib/angular/relatorioSessao';
import { compararSessoes, type SessaoParaComparar } from '@/lib/angular/comparar';
import { sessoesComPosicao } from '@/lib/angular/sessao';
import { ESQUEMA_ANALISE_FOTO, ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, vistaBaseDaSessao, type VistaSessao } from '@/lib/angular/tiposSessao';
import {
  analiseDaFotoParaExportar, baixarBlob, canvasComMedidas, canvasParaBlob, faltaReferenciaDoPrumo, nomeArquivoImagem, type AnaliseParaExportar,
} from '@/lib/angular/analise';
import { lerEstilo, salvarEstilo, type EstiloMarcacao } from '@/lib/angular/estilo';
import { usePacienteDosagem, usePacientesLista } from '@/hooks/useProntuarioSeguranca';
import type { Landmark } from '@/lib/angular/pose';

const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const UNIDADES_PRUMO: { id: UnidadePrumo; nome: string }[] = [{ id: 'graus', nome: 'Graus' }, { id: 'cm', nome: 'cm' }, { id: 'pct', nome: '% da altura' }];

type ModoDaPagina = 'foto' | 'livre' | 'marcha';
const MODOS: { id: ModoDaPagina; rotulo: string; Icone: typeof Camera }[] = [
  { id: 'foto', rotulo: 'Postura em foto', Icone: Camera },
  { id: 'livre', rotulo: 'Análise livre', Icone: Ruler },
  { id: 'marcha', rotulo: 'Análise em vídeo', Icone: Film },
];

// Análise angular em foto: uma sessão com até quatro posições (frente, perfil direito, perfil esquerdo, costas). Em cada uma o
// profissional marca os pontos (ou deixa o app sugerir) e o app calcula. Nível e escala corrigem a foto torta e dão medidas em
// centímetros. A foto fica só no navegador; o prontuário recebe as medidas, uma nota por posição, ligadas pela sessão.
// A análise livre é uma foto avulsa, com as ferramentas livres, numa sessão à parte (ver useAnaliseLivre): trocar de aba não perde nada.
export default function AnaliseAngular() {
  const { user, profile } = useAuth();
  const [sp, setSp] = useSearchParams();
  const pacienteId = sp.get('paciente') || '';
  const modoDaUrl = sp.get('modo');
  const modoAnalise: ModoDaPagina = modoDaUrl === 'marcha' || modoDaUrl === 'livre' ? modoDaUrl : 'foto';
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
  const [modoVideo, setModoVideo] = useState<'ponto' | 'auto'>('ponto');
  const [estilo, setEstiloLocal] = useState<EstiloMarcacao>(() => lerEstilo());
  const visao = useVisaoDaFoto();
  const visaoLivre = useVisaoDaFoto();
  const livre = useAnaliseLivre({ paciente, userId: user?.id, profile, estilo, confirmar });
  const [baixando, setBaixando] = useState(false);
  const [comparando, setComparando] = useState(false);
  // A arte e os pontos de pose andam juntos: o diálogo recomeça do zero quando a referência da arte muda.
  const [arteSocial, setArteSocial] = useState<{ arte: AnaliseParaExportar; landmarks: (Landmark[] | null)[] } | null>(null);
  const comparadorRef = useRef<HTMLDivElement>(null);
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => { montada.current = false; };
  }, []);

  // A comparação padrão é a avaliação anterior mais recente: ao trocar de paciente, a escolha do anterior é refeita.
  useEffect(() => { setAnteriorId(''); }, [pacienteId]);

  const mudarEstilo = (e: EstiloMarcacao) => { setEstiloLocal(e); salvarEstilo(e); };

  // A página estava rolada até a foto: ao abrir a comparação, leva o título dela para a vista.
  useEffect(() => {
    if (comparando) comparadorRef.current?.scrollIntoView?.({ block: 'start' });
  }, [comparando]);

  const disponiveis = useMemo(() => medidasDaVista(vista), [vista]);
  const medidaAtiva: Medida = disponiveis.find((m) => m.id === item.ativa) ?? disponiveis[0];

  // Estado serializável da análise: o mesmo alimenta a tela, o PDF, a imagem baixada e a arte social.
  const { analise, medidas: medidasAtuais, temResultado, temMarcacao: temPontosMarcados, giro, giroMarcado, giroSensor, cmPorPx, notaNivel } = resumo;
  const faltaPrumo = faltaReferenciaDoPrumo(analise);

  // ---- foto de cada posição ----
  const aplicarFoto = async (alvo: VistaSessao, arquivo: Blob, inclinacao: number | null) => {
    // O preparo da foto demora: se a sessão recomeçou ou a página saiu nesse meio-tempo, a foto não vale mais.
    const sessaoId = estadoRef.current.id;
    const aindaVale = () => montada.current && estadoRef.current.id === sessaoId;
    let nova: FotoDaPosicao;
    try {
      nova = await prepararFoto(arquivo);
    } catch {
      if (aindaVale()) toast.error('Não consegui abrir essa imagem.');
      return;
    }
    if (!aindaVale()) {
      URL.revokeObjectURL(nova.url);
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
    const sessaoId = estadoRef.current.id;
    const salvaEm = posicao;
    if (!(await salvar(salvaEm))) return;
    // A gravação demora: só segue se a pessoa ainda estiver olhando para a posição que acabou de salvar.
    const agora = estadoRef.current;
    if (agora.id === sessaoId && agora.atual === salvaEm && agora.visao === 'posicao') irParaProxima(salvaEm);
  };

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
  const abrirArteDaLivre = (arte: AnaliseParaExportar, landmarks: (Landmark[] | null)[]) => setArteSocial({ arte, landmarks });

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
  const mudarModo = (id: ModoDaPagina) => { const n = new URLSearchParams(sp); if (id === 'foto') n.delete('modo'); else n.set('modo', id); setSp(n, { replace: true }); };
  const mudarPaciente = (v: string) => {
    if (v === pacienteId) return;
    const aplicar = () => { const n = new URLSearchParams(sp); if (v) n.set('paciente', v); else n.delete('paciente'); setSp(n, { replace: true }); };
    // Trocar de paciente com a sessão (ou a análise livre) em andamento gravaria as medidas no cliente errado: pergunta e recomeça as duas.
    // Escolher o primeiro paciente de uma análise avulsa não perde nada e segue com o que está na tela.
    const comPostura = algoPreenchido(estadoRef.current);
    const comLivre = livre.preenchida;
    const temDono = !!pacienteDaSessao(estadoRef.current) || !!livre.donoDaNota;
    if ((comPostura || comLivre) && (pacienteId || temDono)) {
      let texto = 'A sessão em andamento será reiniciada: as fotos e os pontos desta sessão serão descartados. As posições já salvas continuam no prontuário do paciente anterior.';
      if (comLivre && !comPostura) texto = 'A análise livre em andamento será reiniciada: a foto e os pontos serão descartados. A análise já salva continua no prontuário do paciente anterior.';
      if (comLivre && comPostura) texto = 'A sessão de postura e a análise livre em andamento serão reiniciadas: as fotos e os pontos serão descartados. O que já foi salvo continua no prontuário do paciente anterior.';
      confirmar({
        titulo: 'Trocar o paciente?',
        texto,
        confirmar: 'Trocar e reiniciar',
        aoConfirmar: () => { acoes.reiniciar(); livre.acoes.reiniciar(); aplicar(); },
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

        <div role="tablist" aria-label="Tipo de análise" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
          {MODOS.map(({ id, rotulo, Icone }) => (
            <button key={id} type="button" role="tab" aria-selected={modoAnalise === id} onClick={() => mudarModo(id)}
              className={cn('flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-center text-xs font-semibold leading-tight transition-all sm:flex-row sm:gap-2 sm:px-3 sm:text-sm', modoAnalise === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icone className="h-4 w-4 shrink-0" /> {rotulo}
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
        ) : modoAnalise === 'livre' ? (
          <AnaliseLivre livre={livre} visao={visaoLivre} paciente={paciente} estilo={estilo} aoMudarEstilo={mudarEstilo} aoAbrirArte={abrirArteDaLivre} />
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
                    <EditorDaFoto
                      posicao={posicao} foto={foto} item={item} resumo={resumo} disponiveis={disponiveis} medidaAtiva={medidaAtiva} acoes={acoes}
                      estilo={estilo} aoMudarEstilo={mudarEstilo} visao={visao} baixando={baixando} aoBaixar={() => void baixarImagem()}
                      inicioDaBarra={(
                        <Button size="sm" className="h-10 gap-1.5" onClick={() => void marcacao.automatico(posicao)} disabled={marcacao.detectando !== null} title="Marcar automaticamente as medidas que ainda não têm pontos">
                          {marcacao.detectando === posicao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} <span className="hidden sm:inline">Automático</span>
                        </Button>
                      )}
                      fimDaBarra={(
                        <>
                          <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Tirar a foto no app" title="Tirar a foto no app" onClick={() => abrirCamera(posicao, false)}><Smartphone className="h-4 w-4" /></Button>
                          <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Trocar a foto" aria-label="Trocar a foto">
                            <Camera className="h-4 w-4" />
                            <input type="file" accept="image/*" className="sr-only" onChange={entradaDeFoto(posicao)} />
                          </label>
                        </>
                      )}
                      aposABarra={(
                        <>
                          <AvisosDaMarcacao sugestao={item.sugestao} inverterDE={item.inverterDE} temPontosDoModelo={!!item.landmarks}
                            aoInverter={() => void marcacao.alternarDireitaEsquerda(posicao)} ocupado={marcacao.detectando !== null} />

                          {vista === 'perfil' && <SentidoDoOlhar valor={item.olhaPara} aoMudar={(sentido) => acoes.editar(posicao, { olhaPara: sentido })} />}

                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="h-auto min-h-11 gap-1.5 whitespace-normal px-2 text-[13px] leading-tight" onClick={() => setComparando(true)} data-testid="abrir-comparador">
                              <Columns2 className="h-4 w-4 shrink-0" /> Comparar lado a lado
                            </Button>
                            <Button className="h-auto min-h-11 gap-1.5 whitespace-normal px-2 text-[13px] leading-tight" onClick={abrirArteDaFoto} disabled={!temPontosMarcados} data-testid="baixar-instagram"
                              title={temPontosMarcados ? 'Arte pronta para Stories, Reels ou Feed' : 'Marque uma medida para montar a arte'}>
                              <Instagram className="h-4 w-4 shrink-0" /> Baixar para Instagram
                            </Button>
                          </div>
                        </>
                      )} />
                  )}
                </div>

                {foto && (
                  <aside className="space-y-3 lg:sticky lg:top-4">
                    <CartaoDasMedidas posicao={posicao} item={item} acoes={acoes} disponiveis={disponiveis} medidaAtiva={medidaAtiva}
                      giro={giro} giroMarcado={giroMarcado} giroSensor={giroSensor} cmPorPx={cmPorPx} compassoRef={estado.compassoRef}>
                      {item.sugeridas.includes(medidaAtiva.id) && item.sugestao?.origens[medidaAtiva.id] && (
                        <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground" data-testid="origem-sugestao">Pontos sugeridos pelo modelo: {item.sugestao?.origens[medidaAtiva.id]}.</p>
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
                          <Button size="sm" variant="outline" className="h-11 w-full gap-1.5" onClick={() => void marcacao.sugerirPrumo(posicao)} disabled={marcacao.detectando !== null}>
                            {marcacao.detectando === posicao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sugerir os pontos do fio
                          </Button>
                          {faltaPrumo && <p className="rounded-lg bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">{faltaPrumo}</p>}
                        </div>
                      )}
                    </CartaoDasMedidas>

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
