import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Film, Image as IconeImagem, Loader2, Share2, ShieldAlert, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ehCancelamento } from '@/lib/angular/video/rastrear';
import {
  LIMITES_EXPORTACAO, NOMES_FORMATO_VIDEO, ORDEM_FORMATOS_VIDEO, VELOCIDADES_EXPORTACAO, ajustarTrecho, avisoDoTipoDeArquivo, bitrateDoVideo, ehErroExportacao, ehFormatoSocial,
  extensaoDoMime, nomeArquivoVideo, planejarSaida, rotuloTempo, rotuloVelocidade, trechoMaximoS, trechoPadrao, validarExportacao, type FormatoVideo,
} from '@/lib/angular/video/exportarVideoPuro';
import {
  abrirFonteDeVideo, criarPrevia, exportarVideoAnalise, suporteDeGravacao, type FonteDeVideo, type OpcoesExportarVideo, type OpcoesSocial, type Previa, type ResumoDoRosto,
} from '@/lib/angular/video/exportarVideo';
import { indiceNoTempo } from '@/lib/angular/video/trilha';
import { AVISO_CONSELHO, DICA_TITULO_SEM_PACIENTE, TEXTO_CONSENTIMENTO, TEXTO_ROSTO_CONFERIDO, podeExportar } from '@/lib/social/consentimento';
import { carregarImagem, carregarMarcaDoApp, carregarSeloDaClinica, type SeloImagem } from '@/lib/social/desenhar';
import { baixarBlob, canvasParaPng, compartilharArquivo, dataParaArquivo } from '@/lib/social/exportar';
import { MAX_PERFIS, lerAvatar, lerPreferencias, normalizarPerfil, normalizarPerfis, salvarPreferencias, type SeloModo } from '@/lib/social/perfis';
import { MULTIPLICADOR_MAX, MULTIPLICADOR_MIN, type ModoRosto, type ModoRostoProtegido } from '@/lib/social/rosto';
import { Chips, Deslizante, Grupo, Interruptor } from './controlesExportar';
import type { PropsExportarVideoDialog } from './exportarVideoLigacao';

/**
 * Diálogo "Baixar vídeo analisado": o profissional escolhe o formato (original ou Instagram), a velocidade (câmera lenta), o trecho e o
 * que entra no vídeo (gráfico e métricas), confere um quadro de prévia (com o rosto já coberto) e baixa o arquivo. O vídeo é gravado em
 * tempo real, no próprio aparelho, e o original não sai dele.
 */

interface Resultado { url: string; nome: string; tipo: string; tamanho: number; arquivo: File; duracaoS: number }

const ROTULO_VELOCIDADE: Record<number, string> = { 1: 'normal', 0.5: 'lenta', 0.25: 'bem lenta', 0.1: 'quadro a quadro' };

/** Tamanho da prévia: no celular ela fica fixa no alto, pequena, para as escolhas aparecerem nela; "ampliar" a deixa grande. */
const classeDaPrevia = (grande: boolean) => `mx-auto block h-auto w-auto max-w-full ${grande ? 'max-h-[60dvh]' : 'max-h-[28dvh]'} lg:max-h-[42dvh]`;

interface PropsBarra { valorInicial: () => number; assinar: (atualizar: ((p: number) => void) | null) => void; aoCancelar: () => void }

/**
 * Barra de progresso da gravação. Tem o próprio estado: o progresso muda a cada quadro gravado e, se o diálogo inteiro
 * se redesenhasse a cada vez, o celular gastaria o tempo que a gravação precisa.
 */
const BarraDeGravacao = memo(function BarraDeGravacao({ valorInicial, assinar, aoCancelar }: PropsBarra) {
  const [progresso, setProgresso] = useState(valorInicial);
  useEffect(() => {
    assinar(setProgresso);
    return () => assinar(null);
  }, [assinar]);
  return (
    <div className="space-y-2" data-testid="gravando-video">
      <Progress value={progresso} className="h-3" aria-label="Progresso da gravação" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium" role="status">Gravando… {progresso}%</p>
        <Button type="button" variant="outline" className="h-11 gap-2" onClick={aoCancelar} data-testid="cancelar-gravacao"><Square className="h-4 w-4" aria-hidden /> Cancelar</Button>
      </div>
    </div>
  );
});

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

export default function ExportarVideoDialog({
  aberto, aoFechar, video, trilha, definicoes, estilo, intervalo, direcao, titulo, linhasMetricas, cartoes, series, marcadores, bandas, terapeutaId, formatoInicial = 'original',
}: PropsExportarVideoDialog) {
  const suporte = useMemo(() => suporteDeGravacao(), []);
  const [inicial] = useState(lerPreferencias);
  const modoProtegido = useRef<ModoRostoProtegido>(inicial.modoRosto);

  // ---- o que entra no vídeo ----
  const [formato, setFormato] = useState<FormatoVideo>(formatoInicial);
  const [velocidade, setVelocidade] = useState<number>(1);
  const [trecho, setTrecho] = useState(() => trechoPadrao(intervalo, 1));
  const [comGrafico, setComGrafico] = useState(true);
  const [comMetricas, setComMetricas] = useState(true);

  // ---- moldura do Instagram ----
  const [tituloArte, setTituloArte] = useState('');
  const [legenda, setLegenda] = useState('');
  const [perfisTexto, setPerfisTexto] = useState<string[]>(() => Array.from({ length: MAX_PERFIS }, (_, i) => inicial.perfis[i] ?? ''));
  const [margensStories, setMargensStories] = useState(inicial.margensStories);
  const [seloModo, setSeloModo] = useState<SeloModo>(inicial.seloModo);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selo, setSelo] = useState<SeloImagem | null>(null);
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);

  // ---- rosto e autorização ----
  const [modoRosto, setModoRosto] = useState<ModoRosto>(inicial.modoRosto);
  const [mulLargura, setMulLargura] = useState(1);
  const [mulAltura, setMulAltura] = useState(1);
  const [autorizado, setAutorizado] = useState(false);
  const [rostoConferido, setRostoConferido] = useState(false);

  // ---- prévia e gravação ----
  const [fonteOk, setFonteOk] = useState(false);
  const [erroFonte, setErroFonte] = useState<string | null>(null);
  const [montandoPrevia, setMontandoPrevia] = useState(false);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);
  const [resumoRosto, setResumoRosto] = useState<ResumoDoRosto | null>(null);
  const [indicePrevia, setIndicePrevia] = useState(0);
  const [previaGrande, setPreviaGrande] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const fonteRef = useRef<FonteDeVideo | null>(null);
  const previaRef = useRef<Previa | null>(null);
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const indiceRef = useRef(0);
  const grandeRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const conteudoRef = useRef<HTMLDivElement | null>(null);
  const progressoRef = useRef(0);
  const assinanteRef = useRef<((p: number) => void) | null>(null);
  const assinarProgresso = useCallback((atualizar: ((p: number) => void) | null) => { assinanteRef.current = atualizar; }, []);
  const lerProgresso = useCallback(() => progressoRef.current, []);
  const aoProgresso = useCallback((p: number) => {
    const v = Math.round(p * 100);
    if (v === progressoRef.current) return;
    progressoRef.current = v;
    assinanteRef.current?.(v);
  }, []);

  const social = ehFormatoSocial(formato);
  const temMetricas = (cartoes?.length ?? 0) > 0 || (linhasMetricas?.length ?? 0) > 0;
  const temGrafico = definicoes.length > 0 || (series?.length ?? 0) > 0;
  const chaveLinhas = (linhasMetricas ?? []).join('\n');
  const perfis = useMemo(() => normalizarPerfis(perfisTexto), [perfisTexto]);
  const nQuadros = trilha.quadros.length;
  const primeiroIndice = indiceNoTempo(trilha, trecho.inicio);
  const ultimoIndice = indiceNoTempo(trilha, trecho.fim);
  const plano = planejarSaida({ intervalo: trecho, velocidade, fpsRastreio: trilha.fps });
  const precisaAutorizacao = social || modoRosto === 'nenhum';
  const rostoPendente = modoRosto !== 'nenhum' && !!resumoRosto?.semRosto && !rostoConferido;
  const problema = validarExportacao({ formato, velocidade, intervalo: trecho, nQuadros, modoRosto, autorizadoMoldura: social ? autorizado : false, autorizado });
  const liberado = suporte.ok && fonteOk && !gravando && !rostoPendente && podeExportar(!precisaAutorizacao || autorizado, gravando, false) && !problema;
  const aviso = avisoDoTipoDeArquivo(suporte.escolha, formato);

  // Abre sempre "limpo": a autorização do paciente vale para este vídeo, nunca para o próximo.
  useEffect(() => {
    if (!aberto) return;
    setAutorizado(false);
    setRostoConferido(false);
    setModoRosto(modoProtegido.current);
    setResultado(null);
    progressoRef.current = 0;
    setFormato(formatoInicial);
    setVelocidade(1);
    setTrecho(trechoPadrao(intervalo, 1));
    setTituloArte(titulo ? `Análise de ${titulo.toLowerCase()}` : '');
    setLegenda('');
    setMulLargura(1);
    setMulAltura(1);
    const meio = Math.round((indiceNoTempo(trilha, intervalo.inicio) + indiceNoTempo(trilha, intervalo.fim)) / 2);
    indiceRef.current = meio;
    setIndicePrevia(meio);
    // Só a abertura conta: os valores de partida vêm das propriedades daquele momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // O quadro da prévia fica sempre dentro do trecho escolhido.
  useEffect(() => {
    const dentro = Math.min(ultimoIndice, Math.max(primeiroIndice, indiceRef.current));
    if (dentro !== indiceRef.current) { indiceRef.current = dentro; setIndicePrevia(dentro); }
  }, [primeiroIndice, ultimoIndice]);

  // Cópia oculta do vídeo, aberta enquanto o diálogo está aberto (a prévia e a gravação dividem a mesma).
  useEffect(() => {
    if (!aberto || !video || !suporte.ok) return undefined;
    let cancelado = false;
    const ctl = new AbortController();
    setErroFonte(null);
    abrirFonteDeVideo(video, ctl.signal).then((f) => {
      if (cancelado) { f.liberar(); return; }
      fonteRef.current = f;
      setFonteOk(true);
    }).catch((e: unknown) => {
      if (!cancelado && !ehCancelamento(e)) setErroFonte(e instanceof Error ? e.message : 'Não consegui abrir o vídeo para gerar o arquivo.');
    });
    return () => {
      cancelado = true;
      ctl.abort();
      abortRef.current?.abort();
      previaRef.current?.liberar();
      previaRef.current = null;
      fonteRef.current?.liberar();
      fonteRef.current = null;
      setFonteOk(false);
    };
  }, [aberto, video, suporte.ok]);

  // Logo da clínica, selo e avatar da moldura.
  useEffect(() => {
    if (!aberto || !terapeutaId) { setLogoUrl(null); return undefined; }
    let cancelado = false;
    // Carregado só quando há clínica: a configuração de marca puxa o cliente do banco, que o diálogo não precisa para o resto.
    import('@/utils/pdfBranding').then((m) => m.carregarBrandingClinica(terapeutaId)).then((b) => { if (!cancelado) setLogoUrl(b.clinicaLogoUrl ?? null); }).catch(() => {
      // Sem a logo da clínica o selo usa a marca do app.
    });
    return () => { cancelado = true; };
  }, [aberto, terapeutaId]);

  useEffect(() => {
    if (!aberto || !social) return undefined;
    let cancelado = false;
    (async () => {
      try {
        let s: SeloImagem | null = null;
        if (seloModo === 'marca') s = await carregarMarcaDoApp();
        else if (seloModo === 'clinica') s = await carregarSeloDaClinica(logoUrl);
        if (!cancelado) setSelo(s);
      } catch {
        // Nem a marca do app abriu (arquivos bloqueados): a moldura sai sem selo.
        if (!cancelado) setSelo(null);
      }
    })();
    return () => { cancelado = true; };
  }, [aberto, social, seloModo, logoUrl]);

  useEffect(() => {
    const avatar = lerAvatar();
    if (!aberto || !avatar) { setAvatarImg(null); return undefined; }
    let cancelado = false;
    carregarImagem(avatar).then((img) => { if (!cancelado) setAvatarImg(img); }).catch(() => { if (!cancelado) setAvatarImg(null); });
    return () => { cancelado = true; };
  }, [aberto]);

  useEffect(() => () => { if (resultado) URL.revokeObjectURL(resultado.url); }, [resultado]);

  // Gravar o canvas depende de o navegador desenhar a página: com a tela de análise inteira ainda por trás do diálogo, o Chrome do
  // computador chega a gravar só alguns quadros por segundo. Enquanto grava, o resto da página fica escondido (volta ao terminar).
  useEffect(() => {
    if (!gravando) return undefined;
    const conteudo = conteudoRef.current;
    const copiaDoVideo = fonteRef.current?.el;
    const escondidos: [HTMLElement, string][] = [];
    for (const el of Array.from(document.body.children)) {
      // A cópia do vídeo que está sendo gravada fica como está: alguns navegadores não entregam quadros de vídeo escondido.
      if (!(el instanceof HTMLElement) || (conteudo && el.contains(conteudo)) || el === copiaDoVideo) continue;
      escondidos.push([el, el.style.visibility]);
      el.style.visibility = 'hidden';
    }
    return () => { for (const [el, antes] of escondidos) el.style.visibility = antes; };
  }, [gravando]);

  const moldura = useMemo<OpcoesSocial | undefined>(() => (social
    ? { autorizado, titulo: tituloArte.trim() || undefined, legenda: legenda.trim() || undefined, perfis, margensStories, selo, avatar: avatarImg }
    : undefined), [social, autorizado, tituloArte, legenda, perfis, margensStories, selo, avatarImg]);

  const opcoes = useMemo<OpcoesExportarVideo | null>(() => (video ? {
    video, trilha, definicoes, estilo, formato, velocidade, mostrarGrafico: comGrafico && temGrafico, mostrarMetricas: comMetricas && temMetricas, moldura, modoRosto, intervalo: trecho,
    direcao, titulo, linhasMetricas: chaveLinhas ? chaveLinhas.split('\n') : undefined, cartoes, series, marcadores, bandas, autorizado, ajusteRosto: { mulLargura, mulAltura },
  } : null), [video, trilha, definicoes, estilo, formato, velocidade, comGrafico, temGrafico, comMetricas, temMetricas, moldura, modoRosto, trecho, direcao, titulo, chaveLinhas, cartoes, series, marcadores, bandas, autorizado, mulLargura, mulAltura]);

  // Prévia: o mesmo desenho do arquivo, para conferir o rosto coberto, o gráfico e a moldura antes de gravar.
  useEffect(() => {
    if (!aberto || !fonteOk || !opcoes || gravando) return undefined;
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setMontandoPrevia(true);
      setErroPrevia(null);
      try {
        previaRef.current?.liberar();
        previaRef.current = null;
        const p = await criarPrevia({ ...opcoes, fonte: fonteRef.current ?? undefined });
        if (cancelado) { p.liberar(); return; }
        previaRef.current = p;
        p.canvas.className = classeDaPrevia(grandeRef.current);
        p.canvas.setAttribute('role', 'img');
        p.canvas.setAttribute('aria-label', 'Prévia do vídeo analisado');
        hostRef.current?.replaceChildren(p.canvas);
        setResumoRosto(p.resumoRosto);
        await p.mostrar(indiceRef.current);
      } catch (e) {
        if (!cancelado) setErroPrevia(e instanceof Error ? e.message : 'Não consegui montar a prévia.');
      } finally {
        if (!cancelado) setMontandoPrevia(false);
      }
    }, 220);
    return () => { cancelado = true; window.clearTimeout(timer); };
  }, [aberto, fonteOk, opcoes, gravando]);

  const irParaQuadro = useCallback((i: number) => {
    indiceRef.current = i;
    setIndicePrevia(i);
    const p = previaRef.current;
    if (!p) return;
    filaRef.current = filaRef.current.then(() => p.mostrar(i)).catch(() => {
      // A prévia foi trocada no meio do arrasto: o quadro seguinte já a refaz.
    });
  }, []);

  const alternarTamanhoDaPrevia = () => {
    const novo = !previaGrande;
    grandeRef.current = novo;
    setPreviaGrande(novo);
    if (previaRef.current) previaRef.current.canvas.className = classeDaPrevia(novo);
  };

  const escolherVelocidade = (v: number) => {
    setVelocidade(v);
    setTrecho((t) => ajustarTrecho(t, intervalo, 'fim', trechoMaximoS(v)));
  };
  const mudarInicio = (v: number) => setTrecho((t) => ajustarTrecho({ ...t, inicio: v }, intervalo, 'inicio', trechoMaximoS(velocidade)));
  const mudarFim = (v: number) => setTrecho((t) => ajustarTrecho({ ...t, fim: v }, intervalo, 'fim', trechoMaximoS(velocidade)));

  const lembrar = (parte: Partial<{ seloModo: SeloModo; margensStories: boolean; modoRosto: ModoRostoProtegido }>) => {
    salvarPreferencias({ perfis, seloModo, margensStories, modoRosto: modoProtegido.current, ...parte });
  };
  const mudarPerfil = (i: number, v: string) => setPerfisTexto((l) => l.map((x, k) => (k === i ? v : x)));
  const concluirPerfil = (i: number) => {
    const limpa = perfisTexto.map((x, k) => (k === i ? normalizarPerfil(x) : x));
    setPerfisTexto(limpa);
    salvarPreferencias({ perfis: normalizarPerfis(limpa), seloModo, margensStories, modoRosto: modoProtegido.current });
  };
  const escolherModoRosto = (v: ModoRosto) => {
    setModoRosto(v);
    setRostoConferido(false);
    if (v !== 'nenhum') { modoProtegido.current = v; lembrar({ modoRosto: v }); }
  };

  // ---- gravação ----
  const baixar = async () => {
    if (!liberado || !opcoes || !fonteRef.current) return;
    progressoRef.current = 0;
    setGravando(true);
    setResultado(null);
    // Libera a prévia: a gravação precisa da memória e do decodificador de vídeo.
    previaRef.current?.liberar();
    previaRef.current = null;
    hostRef.current?.replaceChildren();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const inicio = performance.now();
    try {
      const blob = await exportarVideoAnalise({ ...opcoes, fonte: fonteRef.current, onProgresso: aoProgresso, sinal: ctl.signal });
      const nome = nomeArquivoVideo(formato, titulo, extensaoDoMime(blob.type));
      const arquivo = new File([blob], nome, { type: blob.type });
      baixarBlob(blob, nome);
      setResultado({ url: URL.createObjectURL(blob), nome, tipo: blob.type, tamanho: blob.size, arquivo, duracaoS: (performance.now() - inicio) / 1000 });
      toast.success('Vídeo pronto. Confira em Arquivos ou Downloads.');
    } catch (e) {
      if (ehCancelamento(e)) toast.info('Gravação cancelada.');
      else if (ehErroExportacao(e)) toast.error(e.message);
      else toast.error('Não consegui gerar o vídeo. Tente de novo com um trecho menor.');
    } finally {
      abortRef.current = null;
      setGravando(false);
    }
  };

  const cancelar = () => abortRef.current?.abort();

  const compartilhar = async () => {
    if (!resultado) return;
    const r = await compartilharArquivo(resultado.arquivo);
    if (r === 'indisponivel') {
      baixarBlob(resultado.arquivo, resultado.nome);
      toast.info('Este aparelho não abre o compartilhamento direto. O vídeo foi baixado.');
    } else if (r === 'bloqueado') {
      toast.info('O aparelho não abriu o compartilhamento. Toque em Compartilhar de novo ou use Baixar.');
    }
  };

  const baixarQuadro = async () => {
    const p = previaRef.current;
    if (!p || gravando || (precisaAutorizacao && !autorizado)) return;
    try {
      const png = await canvasParaPng(p.canvas);
      baixarBlob(png, `quadro-${formato}-${dataParaArquivo()}.png`);
      toast.success('Quadro pronto. Confira em Arquivos ou Downloads.');
    } catch {
      toast.error('Não consegui gerar a imagem do quadro.');
    }
  };

  const fechar = () => { if (gravando) abortRef.current?.abort(); aoFechar(); };

  const tempoDoQuadro = trilha.quadros[indicePrevia] ? trilha.quadros[indicePrevia].t - trecho.inicio : 0;
  const bytesEstimados = (bitrateDoVideo(1080, 1080) / 8) * plano.duracaoSaidaS;
  const sobraDeTrecho = intervalo.fim - intervalo.inicio > trechoMaximoS(velocidade) + 1e-6;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent ref={conteudoRef} data-testid="dialogo-exportar-video" onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[94dvh] sm:w-[calc(100%-2rem)] sm:rounded-lg [&>button]:top-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:[&>button]:top-3">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))' }}>
          <DialogTitle className="text-base">Baixar vídeo analisado</DialogTitle>
          <DialogDescription className="text-xs">Com as marcações, o gráfico e as métricas. Pode sair em câmera lenta e já no formato do Instagram.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="corpo-exportar-video">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
            {/* Prévia: no celular o bloco do alto fica fixo enquanto os controles rolam por baixo (o `contents` põe os filhos direto na grade). */}
            <div className="contents lg:sticky lg:top-0 lg:block lg:max-h-[calc(94dvh-15rem)] lg:space-y-3 lg:self-start lg:overflow-y-auto">
              <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background px-4 pb-2 pt-1 lg:static lg:mx-0 lg:bg-transparent lg:p-0">
                {!suporte.ok && (
                  <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="aviso-sem-gravacao">{suporte.motivo}</p>
                )}
                {suporte.ok && !video && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">O vídeo não está disponível. Feche e abra a análise de novo.</p>}
                {erroFonte && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erroFonte}</p>}
                {erroPrevia && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erroPrevia}</p>}
                {suporte.ok && (
                  <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-[#0a0f1c]" data-testid="previa-video">
                    <div ref={hostRef} className={gravando ? 'hidden' : 'min-h-24'} />
                    {(montandoPrevia || (!fonteOk && !erroFonte)) && !gravando && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/50 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Montando a prévia…</div>
                    )}
                    {gravando && (
                      <div className="flex min-h-24 flex-col items-center justify-center gap-1 p-4 text-center text-white" role="status">
                        <Film className="h-6 w-6 opacity-70" aria-hidden />
                        <p className="text-sm font-semibold">Gravando em tempo real…</p>
                        <p className="text-xs opacity-70">Mantenha esta tela aberta e o aparelho desbloqueado até o fim.</p>
                      </div>
                    )}
                  </div>
                )}
                {suporte.ok && !gravando && fonteOk && (
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Deslizante
                        rotulo="Quadro da prévia" valor={indicePrevia} min={primeiroIndice} max={Math.max(primeiroIndice + 1, ultimoIndice)} passo={1} aoMudar={irParaQuadro}
                        texto={`${rotuloTempo(Math.max(0, tempoDoQuadro))} · quadro ${indicePrevia + 1}`}
                      />
                    </div>
                    <button type="button" onClick={alternarTamanhoDaPrevia} aria-pressed={previaGrande} className="mb-1 min-h-11 shrink-0 rounded-xl border border-border/60 px-3 text-xs font-semibold hover:bg-muted/50 lg:hidden" data-testid="ampliar-previa">
                      {previaGrande ? 'Reduzir' : 'Ampliar'}
                    </button>
                  </div>
                )}
              </div>
              {suporte.ok && !gravando && fonteOk && (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
                  {modoRosto !== 'nenhum' && resumoRosto && (
                    <p className={resumoRosto.semRosto ? 'rounded-lg bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-300' : 'text-xs text-muted-foreground'} data-testid="dica-rosto-video" role={resumoRosto.semRosto ? 'status' : undefined}>
                      {resumoRosto.semRosto
                        ? `Em ${Math.round(resumoRosto.porOrigem.fixa)}% dos quadros não achei o rosto: uma área fixa no alto do vídeo o cobre. Passe pelos quadros na prévia e confira se ele está coberto.`
                        : 'Rosto localizado pelos pontos do corpo em todos os quadros. Confira na prévia.'}
                    </p>
                  )}
                  <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={() => void baixarQuadro()} disabled={!previaRef.current || (precisaAutorizacao && !autorizado)} data-testid="baixar-quadro-previa">
                    <IconeImagem className="h-4 w-4" aria-hidden /> Baixar este quadro (PNG)
                  </Button>
                  {precisaAutorizacao && !autorizado && <p className="text-[11px] text-muted-foreground">Marque a autorização do paciente (no rodapé) para baixar o quadro ou o vídeo.</p>}
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="space-y-5">
              <Grupo titulo="Formato" dica={formato === 'original' ? 'O vídeo na proporção original, com o gráfico e as métricas embaixo.' : 'Moldura com título, selo e perfis, no tamanho do Instagram (1080 px de largura).'}>
                <Chips<FormatoVideo> rotulo="Formato do vídeo" valor={formato} desabilitado={gravando} aoEscolher={setFormato} colunas="grid-cols-2 sm:grid-cols-4"
                  opcoes={ORDEM_FORMATOS_VIDEO.map((f) => ({ valor: f, rotulo: NOMES_FORMATO_VIDEO[f].nome, detalhe: NOMES_FORMATO_VIDEO[f].detalhe }))} />
                {aviso && <p role="status" className="rounded-lg bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-300" data-testid="aviso-tipo-arquivo">{aviso}</p>}
              </Grupo>

              <Grupo titulo="Velocidade" dica="A câmera lenta mostra cada quadro analisado por mais tempo: o vídeo fica mais longo.">
                <Chips<string> rotulo="Velocidade do vídeo" valor={String(velocidade)} desabilitado={gravando} aoEscolher={(v) => escolherVelocidade(Number(v))} colunas="grid-cols-2 sm:grid-cols-4"
                  opcoes={VELOCIDADES_EXPORTACAO.map((v) => ({ valor: String(v), rotulo: rotuloVelocidade(v), detalhe: ROTULO_VELOCIDADE[v] }))} />
              </Grupo>

              <Grupo titulo="Trecho" dica={`O vídeo gerado pode ter até ${LIMITES_EXPORTACAO.duracaoMaximaSaidaS} s: ele é gravado em tempo real.`}>
                <Deslizante rotulo="Início do trecho" valor={trecho.inicio} min={intervalo.inicio} max={intervalo.fim} passo={Math.max(0.01, 1 / trilha.fps)} aoMudar={mudarInicio} texto={rotuloTempo(trecho.inicio - intervalo.inicio)} desabilitado={gravando} />
                <Deslizante rotulo="Fim do trecho" valor={trecho.fim} min={intervalo.inicio} max={intervalo.fim} passo={Math.max(0.01, 1 / trilha.fps)} aoMudar={mudarFim} texto={rotuloTempo(trecho.fim - intervalo.inicio)} desabilitado={gravando} />
                <p className="text-xs text-muted-foreground" data-testid="resumo-duracao">
                  Vídeo final: <strong className="text-foreground">{rotuloTempo(plano.duracaoSaidaS, 1)}</strong> · cerca de {megabytes(bytesEstimados)}
                </p>
                {sobraDeTrecho && <p className="text-xs text-muted-foreground">Nesta velocidade cabem {trechoMaximoS(velocidade).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s do vídeo; o trecho foi cortado.</p>}
              </Grupo>

              <Grupo titulo="O que aparece">
                <Interruptor rotulo="Gráfico ângulo × tempo (com o cursor)" marcado={comGrafico && temGrafico} aoMudar={setComGrafico} desabilitado={gravando || !temGrafico} />
                <Interruptor rotulo="Cartões de métricas (com a referência e a fonte)" marcado={comMetricas && temMetricas} aoMudar={setComMetricas} desabilitado={gravando || !temMetricas} />
                <p className="text-xs text-muted-foreground">Faixas de referência só aparecem quando há fonte confirmada; sem elas, o cartão diz “sem referência”.</p>
              </Grupo>

              {social && (
                <>
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {AVISO_CONSELHO}</p>
                  <Grupo titulo="Título" dica={DICA_TITULO_SEM_PACIENTE}>
                    <Input value={tituloArte} onChange={(e) => setTituloArte(e.target.value)} maxLength={70} placeholder="Ex.: Análise de marcha" aria-label="Título da arte" className="h-11 text-base" disabled={gravando} />
                  </Grupo>
                  <Grupo titulo="Legenda e perfis" dica="Até três perfis, sem o @. Ficam lembrados para a próxima arte.">
                    <Input value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={60} placeholder="Ex.: 3ª semana de tratamento" aria-label="Legenda da pílula" className="h-11 text-base" disabled={gravando} />
                    {perfisTexto.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 text-center text-base font-semibold text-muted-foreground" aria-hidden>@</span>
                        <Input value={p} onChange={(e) => mudarPerfil(i, e.target.value)} onBlur={() => concluirPerfil(i)} maxLength={200} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                          placeholder={i === 0 ? 'seuperfil' : 'outro perfil (opcional)'} aria-label={`Perfil ${i + 1}`} className="h-11 text-base" disabled={gravando} />
                      </div>
                    ))}
                  </Grupo>
                  <Grupo titulo="Selo">
                    <Chips<SeloModo> rotulo="Selo no canto" valor={seloModo} desabilitado={gravando} aoEscolher={(v) => { setSeloModo(v); lembrar({ seloModo: v }); }}
                      opcoes={[{ valor: 'clinica', rotulo: 'Logo da clínica' }, { valor: 'marca', rotulo: 'MyHealthID' }, { valor: 'nenhum', rotulo: 'Sem selo' }]} />
                    {formato === 'story' && <Interruptor rotulo="Margens de Stories (texto fora das faixas cobertas pelo Instagram)" marcado={margensStories} desabilitado={gravando} aoMudar={(v) => { setMargensStories(v); lembrar({ margensStories: v }); }} />}
                  </Grupo>
                </>
              )}

              <Grupo titulo="Privacidade do rosto" dica="Coberto em todos os quadros por padrão. Desligue só se o paciente autorizou aparecer.">
                <Chips<ModoRosto> rotulo="Esconder o rosto" valor={modoRosto} desabilitado={gravando} aoEscolher={escolherModoRosto}
                  opcoes={[{ valor: 'desfoque', rotulo: 'Desfocar' }, { valor: 'tarja', rotulo: 'Tarja' }, { valor: 'nenhum', rotulo: 'Mostrar' }]} />
                {modoRosto !== 'nenhum' && (
                  <>
                    <Deslizante rotulo="Largura da área" valor={mulLargura} min={MULTIPLICADOR_MIN} max={MULTIPLICADOR_MAX} passo={0.05} aoMudar={(v) => { setMulLargura(v); setRostoConferido(false); }} texto={`${Math.round(mulLargura * 100)}%`} desabilitado={gravando} />
                    <Deslizante rotulo="Altura da área" valor={mulAltura} min={MULTIPLICADOR_MIN} max={MULTIPLICADOR_MAX} passo={0.05} aoMudar={(v) => { setMulAltura(v); setRostoConferido(false); }} texto={`${Math.round(mulAltura * 100)}%`} desabilitado={gravando} />
                  </>
                )}
              </Grupo>
            </div>
          </div>
        </div>

        {/* Autorização e ações: sempre à vista no rodapé do diálogo. */}
        <div
          className="max-h-[55dvh] shrink-0 space-y-2 overflow-y-auto overscroll-contain border-t border-border/60 bg-background px-4 pt-3" data-testid="rodape-exportar-video"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
        >
          {precisaAutorizacao && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-2.5 text-sm">
              <Checkbox checked={autorizado} disabled={gravando} onCheckedChange={(v) => setAutorizado(v === true)} className="mt-0.5 h-6 w-6" data-testid="autorizacao-video" />
              <span className="font-medium leading-snug">{TEXTO_CONSENTIMENTO}</span>
            </label>
          )}
          {modoRosto !== 'nenhum' && resumoRosto?.semRosto && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2.5 text-sm" data-testid="conferir-rosto-video">
              <Checkbox checked={rostoConferido} disabled={gravando} onCheckedChange={(v) => setRostoConferido(v === true)} className="mt-0.5 h-6 w-6" />
              <span className="font-medium leading-snug">{TEXTO_ROSTO_CONFERIDO}</span>
            </label>
          )}
          {problema && problema.codigo !== 'consentimento' && <p role="alert" className="text-xs font-medium text-destructive" data-testid="problema-exportacao">{problema.message}</p>}

          {gravando ? (
            <BarraDeGravacao valorInicial={lerProgresso} assinar={assinarProgresso} aoCancelar={cancelar} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-12 gap-2" onClick={() => void baixar()} disabled={!liberado} data-testid="baixar-video-arquivo">
                <Download aria-hidden /> Baixar vídeo
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={() => void compartilhar()} disabled={!resultado} data-testid="compartilhar-video">
                <Share2 aria-hidden /> Compartilhar
              </Button>
            </div>
          )}

          {resultado && !gravando && (
            <div className="space-y-1.5 rounded-xl border border-border/60 p-2.5" data-testid="resultado-video">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{resultado.nome}</strong> · {megabytes(resultado.tamanho)} · {resultado.tipo.split(';')[0].replace('video/', '').toUpperCase()}
              </p>
              {Capacitor.isNativePlatform() && (
                <>
                  <p className="text-xs text-muted-foreground">Se o vídeo não foi salvo, toque em Compartilhar ou segure sobre o vídeo e escolha “Salvar”.</p>
                  <video src={resultado.url} controls playsInline muted className="mx-auto max-h-48 w-auto rounded-lg" />
                </>
              )}
              <button type="button" onClick={() => setResultado(null)} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs text-muted-foreground hover:bg-muted/50"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Dispensar</button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
