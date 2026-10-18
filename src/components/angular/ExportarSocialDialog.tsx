import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Loader2, Share2, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import PreviaArteSocial, { type FerramentaPrevia } from '@/components/angular/PreviaArteSocial';
import { cn } from '@/lib/utils';
import type { AnaliseParaExportar } from '@/lib/angular/analise';
import type { Landmark } from '@/lib/angular/pose';
import { carregarBrandingClinica } from '@/utils/pdfBranding';
import {
  AVISO_CONSELHO, DICA_TITULO_SEM_PACIENTE, TEXTO_CONSENTIMENTO, TEXTO_ROSTO_CONFERIDO, podeExportar,
} from '@/lib/social/consentimento';
import {
  carregarMarcaDoApp, carregarSeloDaClinica, carregarImagem, layoutDaArte, perfilDasMarcacoes, prepararPaineis, renderizarArteSocial,
  type OpcoesArte, type PainelPronto, type RecursosArte, type SeloImagem,
} from '@/lib/social/desenhar';
import { baixarBlob, canvasParaPng, canvasParaPngSincrono, compartilharArquivo, nomeArquivoSocial } from '@/lib/social/exportar';
import { garantirFontesSociais } from '@/lib/social/fontes';
import {
  FORMATOS, NOMES_LAYOUT, ORDEM_FORMATOS, layoutEfetivo, layoutSugerido, layoutsDisponiveis, tituloModoSugerido,
  type FormatoSocial, type LayoutArte, type TituloModo,
} from '@/lib/social/formatos';
import {
  ENQUADRAMENTO_PADRAO, PERDA_MAXIMA_PREENCHER_COM_MARCAS, VISIVEL_MINIMO_PREENCHER, ZOOM_MAX, ZOOM_MIN, ajusteSugerido, arrastarEnquadramento, enquadramentoAutomatico as enquadramentoDeAbertura, janelaDaImagem, perfilMedio, zoomarEnquadramento,
  type Enquadramento, type ModoAjuste,
} from '@/lib/social/geometria';
import {
  MAX_PERFIS, lerAvatar, lerPreferencias, normalizarPerfil, normalizarPerfis, salvarAvatar, salvarPreferencias, type SeloModo,
} from '@/lib/social/perfis';
import {
  MULTIPLICADOR_MAX, MULTIPLICADOR_MIN, caixaDoRostoPorLandmarks, caixaRostoPadrao, escalarCaixaRosto, moverCaixaRosto,
  type CaixaRosto, type ModoRosto, type ModoRostoProtegido,
} from '@/lib/social/rosto';

/**
 * Diálogo "Arte para Instagram": recebe uma ou duas fotos já marcadas (saída de `analiseDaFotoParaExportar`
 * ou do `ComparadorFotos`) e gera o PNG no formato do story, do feed ou quadrado.
 *
 *   <ExportarSocialDialog
 *     aberto={!!arte} aoFechar={() => setArte(null)}
 *     arte={arte}                    // mantenha a MESMA referência enquanto o diálogo estiver aberto
 *     landmarks={[poseDaFoto1, poseDaFoto2]}   // opcional: o rosto é achado pelos pontos de pose
 *     terapeutaId={user?.id} />      // opcional: traz a logo da clínica para o selo
 *
 * Baixar e compartilhar só liberam depois de o profissional marcar a autorização do paciente. Para a
 * etapa do vídeo, use `arteDeQuadroDeVideo(canvas)` (em `@/lib/social`) para entregar um quadro como arte.
 */
export interface ExportarSocialDialogProps {
  aberto: boolean;
  aoFechar: () => void;
  arte: AnaliseParaExportar | null;
  /** Pontos de pose de cada foto, na ordem de `arte.paineis`; sem eles, a área do rosto é posicionada à mão. */
  landmarks?: (Landmark[] | null | undefined)[];
  terapeutaId?: string | null;
  formatoInicial?: FormatoSocial;
}

const ESCALA_PREVIA = 0.6;
const ROTULO_FORMATO: Record<FormatoSocial, string> = { story: 'Story / Reels', feed: 'Feed retrato', quadrado: 'Quadrado' };

function Grupo({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={titulo}>
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

interface OpcaoChip<T extends string> { valor: T; rotulo: string; detalhe?: string }

function Chips<T extends string>({ rotulo, valor, opcoes, aoEscolher, colunas }: { rotulo: string; valor: T; opcoes: OpcaoChip<T>[]; aoEscolher: (v: T) => void; colunas?: string }) {
  return (
    <div role="group" aria-label={rotulo} className={cn('grid gap-1.5', colunas ?? 'grid-cols-2 sm:grid-cols-3')}>
      {opcoes.map((o) => (
        <button
          key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => aoEscolher(o.valor)}
          className={cn('flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-1 text-sm font-semibold leading-tight transition-colors',
            valor === o.valor ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}
        >
          {o.rotulo}
          {o.detalhe && <span className="text-[11px] font-normal text-muted-foreground">{o.detalhe}</span>}
        </button>
      ))}
    </div>
  );
}

function Deslizante({ rotulo, valor, min, max, passo, aoMudar, texto }: { rotulo: string; valor: number; min: number; max: number; passo: number; aoMudar: (v: number) => void; texto: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
        <span className="text-xs font-semibold tabular-nums">{texto}</span>
      </div>
      <input type="range" min={min} max={max} step={passo} value={valor} aria-label={rotulo} onChange={(e) => aoMudar(Number(e.target.value))} className="h-11 w-full cursor-pointer touch-pan-x accent-primary" />
    </div>
  );
}

function Interruptor({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{rotulo}</span>
      <Switch checked={marcado} onCheckedChange={aoMudar} aria-label={rotulo} />
    </label>
  );
}

/** Miniatura quadrada (centro da foto) para o avatar da legenda: pequena para caber no armazenamento do navegador. */
async function miniaturaDoAvatar(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(url);
    const lado = 192;
    const cv = document.createElement('canvas');
    cv.width = lado;
    cv.height = lado;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('Sem canvas');
    const e = Math.max(lado / img.naturalWidth, lado / img.naturalHeight);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (lado - img.naturalWidth * e) / 2, (lado - img.naturalHeight * e) / 2, img.naturalWidth * e, img.naturalHeight * e);
    return cv.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const aplicar = (lista: Enquadramento[], i: number, novo: Enquadramento, juntas: boolean) => (juntas ? lista.map(() => novo) : lista.map((e, k) => (k === i ? novo : e)));

export default function ExportarSocialDialog({ aberto, aoFechar, arte, landmarks, terapeutaId, formatoInicial = 'story' }: ExportarSocialDialogProps) {
  const nPaineis = arte?.paineis.length ?? 0;
  const [inicial] = useState(lerPreferencias);
  // Último modo que esconde o rosto: é o de toda arte nova e o único que fica lembrado ("Mostrar" vale só para uma arte).
  const modoProtegido = useRef<ModoRostoProtegido>(inicial.modoRosto);

  // ---- conteúdo ----
  const [formato, setFormato] = useState<FormatoSocial>(formatoInicial);
  const [layout, setLayout] = useState<LayoutArte>('unica');
  const [tituloModoEscolhido, setTituloModoEscolhido] = useState<TituloModo | null>(null);
  const [titulo, setTitulo] = useState('');
  const [legenda, setLegenda] = useState('');
  const [rotulos, setRotulos] = useState<string[]>([]);
  const [datas, setDatas] = useState<string[]>([]);
  const [mostrarDatas, setMostrarDatas] = useState(true);
  const [perfisTexto, setPerfisTexto] = useState<string[]>(() => Array.from({ length: MAX_PERFIS }, (_, i) => inicial.perfis[i] ?? ''));
  const [margensStories, setMargensStories] = useState(inicial.margensStories);
  const [seloModo, setSeloModo] = useState<SeloModo>(inicial.seloModo);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => lerAvatar());

  // ---- fotos ----
  const [paineis, setPaineis] = useState<PainelPronto[] | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [ajusteEscolhido, setAjusteEscolhido] = useState<ModoAjuste | null>(null);
  // Sem gesto do usuário (`null`), o enquadramento é o automático, que leva o rosto para o alto da caixa.
  const [enquadramentoManual, setEnquadramentoManual] = useState<Enquadramento[] | null>(null);
  const [juntas, setJuntas] = useState(true);
  const [fotoDoZoom, setFotoDoZoom] = useState(0);
  const [ferramenta, setFerramenta] = useState<FerramentaPrevia>('enquadrar');

  // ---- rosto ----
  const [modoRosto, setModoRosto] = useState<ModoRosto>(inicial.modoRosto);
  const [rostosBase, setRostosBase] = useState<(CaixaRosto | null)[]>([]);
  const [rostoAutomatico, setRostoAutomatico] = useState<boolean[]>([]);
  // Posição do rosto no momento da abertura: o enquadramento automático não pode andar junto com a área arrastada.
  const [rostoReferencia, setRostoReferencia] = useState<CaixaRosto | null>(null);
  const [mulLargura, setMulLargura] = useState(1);
  const [mulAltura, setMulAltura] = useState(1);
  // Sem rosto localizado, a área padrão pode não estar sobre ele: o profissional confere na prévia e confirma.
  const [rostoConferido, setRostoConferido] = useState(false);

  // ---- recursos de imagem ----
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selo, setSelo] = useState<SeloImagem | null>(null);
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);
  const [logoIndisponivel, setLogoIndisponivel] = useState(false);

  // ---- saída ----
  const [autorizado, setAutorizado] = useState(false);
  const [ocupado, setOcupado] = useState<null | 'baixar' | 'compartilhar'>(null);
  const [imagemManual, setImagemManual] = useState<string | null>(null);

  const layoutEf = layoutEfetivo(layout, nPaineis);
  const tituloModo = tituloModoEscolhido ?? tituloModoSugerido(layoutEf);

  // Abre sempre "limpo": a autorização do paciente vale para esta arte, nunca para a próxima.
  useEffect(() => {
    if (!aberto || !arte) return undefined;
    let cancelado = false;
    const n = arte.paineis.length;
    setAutorizado(false);
    setModoRosto(modoProtegido.current);
    setRostoConferido(false);
    setPaineis(null);
    setErroCarga(null);
    setImagemManual(null);
    setFormato(formatoInicial);
    setLayout(layoutSugerido(formatoInicial, n));
    setTituloModoEscolhido(null);
    setTitulo(arte.titulo ?? '');
    setLegenda(arte.legenda ?? '');
    setRotulos(arte.paineis.map((p) => p.rotulo ?? ''));
    setDatas(arte.paineis.map((p) => p.data ?? ''));
    setAjusteEscolhido(null);
    setEnquadramentoManual(null);
    setJuntas(true);
    setFotoDoZoom(0);
    setMulLargura(1);
    setMulAltura(1);
    (async () => {
      try {
        await garantirFontesSociais();
        const prontos = await prepararPaineis(arte);
        if (cancelado) return;
        const bases = prontos.map((p, i) => caixaDoRostoPorLandmarks(landmarks?.[i], p.largura, p.altura));
        setRostosBase(bases.map((b, i) => b ?? caixaRostoPadrao(prontos[i].largura, prontos[i].altura)));
        setRostoAutomatico(bases.map((b) => b !== null));
        setRostoReferencia(bases[0] ?? caixaRostoPadrao(prontos[0].largura, prontos[0].altura));
        setFerramenta(bases.some((b) => b === null) ? 'rosto' : 'enquadrar');
        setPaineis(prontos);
      } catch (e) {
        if (!cancelado) setErroCarga(e instanceof Error ? e.message : 'Não consegui abrir as fotos.');
      }
    })();
    return () => { cancelado = true; };
    // `landmarks` costuma ser recriado a cada render do pai; só vale o que chegou junto com a arte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, arte]);

  // Fechado, solta as fotos (até três canvases grandes por foto) e a imagem final. Espera a animação de saída terminar.
  useEffect(() => {
    if (aberto) return undefined;
    const t = window.setTimeout(() => {
      setPaineis(null);
      setRostosBase((r) => (r.length ? [] : r));
      setRostoAutomatico((r) => (r.length ? [] : r));
      setImagemManual(null);
      setSelo(null);
    }, 400);
    return () => window.clearTimeout(t);
  }, [aberto]);

  // Logo da clínica (só se houver terapeuta).
  useEffect(() => {
    if (!aberto || !terapeutaId) { setLogoUrl(null); return undefined; }
    let cancelado = false;
    carregarBrandingClinica(terapeutaId).then((b) => { if (!cancelado) setLogoUrl(b.clinicaLogoUrl ?? null); }).catch(() => {
      // Sem a logo da clínica o selo usa a marca do app; nada a avisar.
    });
    return () => { cancelado = true; };
  }, [aberto, terapeutaId]);

  useEffect(() => {
    if (!aberto) return undefined;
    let cancelado = false;
    (async () => {
      try {
        let s: SeloImagem | null = null;
        if (seloModo === 'marca') s = await carregarMarcaDoApp();
        else if (seloModo === 'clinica') s = await carregarSeloDaClinica(logoUrl);
        if (cancelado) return;
        setSelo(s);
        setLogoIndisponivel(seloModo === 'clinica' && !!logoUrl && s?.tipo === 'marca');
      } catch {
        // Nem a marca do app abriu (assets bloqueados): segue sem selo.
        if (!cancelado) { setSelo(null); setLogoIndisponivel(false); }
      }
    })();
    return () => { cancelado = true; };
  }, [aberto, seloModo, logoUrl]);

  useEffect(() => {
    if (!avatarUrl) { setAvatarImg(null); return undefined; }
    let cancelado = false;
    carregarImagem(avatarUrl).then((img) => { if (!cancelado) setAvatarImg(img); }).catch(() => { if (!cancelado) setAvatarImg(null); });
    return () => { cancelado = true; };
  }, [avatarUrl]);

  useEffect(() => () => { if (imagemManual) URL.revokeObjectURL(imagemManual); }, [imagemManual]);

  const perfis = useMemo(() => normalizarPerfis(perfisTexto), [perfisTexto]);
  const recursos = useMemo<RecursosArte>(() => ({ selo, avatar: avatarImg }), [selo, avatarImg]);
  const rostos = useMemo(() => rostosBase.map((c) => (c ? escalarCaixaRosto(c, mulLargura, mulAltura) : null)), [rostosBase, mulLargura, mulAltura]);
  // Sem área de rosto (modo "Mostrar") a única ferramenta é enquadrar, mesmo que a escolha anterior fosse posicionar o rosto.
  const ferramentaEf: FerramentaPrevia = modoRosto === 'nenhum' ? 'enquadrar' : ferramenta;
  const algumSemRosto = rostoAutomatico.some((a) => !a);
  const rostoPendente = modoRosto !== 'nenhum' && algumSemRosto && !rostoConferido;

  const nota = arte?.nota;
  const opcoesBase = useMemo<OpcoesArte>(() => ({
    formato, layout: layoutEf, tituloModo, titulo, legenda, perfis, margensStories, rotulos, datas, mostrarDatas, nota,
  }), [formato, layoutEf, tituloModo, titulo, legenda, perfis, margensStories, rotulos, datas, mostrarDatas, nota]);
  const layoutAtual = useMemo(() => layoutDaArte(opcoesBase, nPaineis, recursos), [opcoesBase, nPaineis, recursos]);

  // Onde estão as marcações de todas as fotos: o enquadramento de abertura nunca corta o que foi medido.
  const perfilMarcas = useMemo(
    () => (paineis ? perfilMedio(paineis.map((p) => (p.camadas ? perfilDasMarcacoes(p.camadas.marcacoes, p.largura, p.altura) : null))) : null),
    [paineis],
  );

  const ajuste: ModoAjuste = useMemo(() => {
    if (ajusteEscolhido) return ajusteEscolhido;
    const p = paineis?.[0], c = layoutAtual.paineis[0];
    if (!p || !c) return 'inteira';
    const sugerido = ajusteSugerido(c.w, c.h, p.largura, p.altura, perfilMarcas ? PERDA_MAXIMA_PREENCHER_COM_MARCAS : undefined);
    if (sugerido === 'inteira') return sugerido;
    // Preencher corta a foto: só vale se, mesmo bem enquadrado, quase todas as marcações continuam à vista.
    const cabe = layoutAtual.paineis.every((caixa, i) => {
      const q = paineis?.[i];
      return !q || enquadramentoDeAbertura(caixa, q.largura, q.altura, 'preencher', rostoReferencia, perfilMarcas).visivel >= VISIVEL_MINIMO_PREENCHER;
    });
    return cabe ? 'preencher' : 'inteira';
  }, [ajusteEscolhido, paineis, layoutAtual, rostoReferencia, perfilMarcas]);

  // O perfil das marcações é o médio das fotos, então fotos do mesmo tamanho recebem o mesmo enquadramento (a comparação fica justa).
  const enquadramentoAutomatico = useMemo<Enquadramento[]>(() => {
    return Array.from({ length: nPaineis }, (_, i) => {
      const p = paineis?.[i], c = layoutAtual.paineis[i];
      if (!p || !c) return ENQUADRAMENTO_PADRAO;
      return enquadramentoDeAbertura(c, p.largura, p.altura, ajuste, rostoReferencia, perfilMarcas).enquadramento;
    });
  }, [nPaineis, paineis, layoutAtual, ajuste, rostoReferencia, perfilMarcas]);

  const enquadramentos = enquadramentoManual ?? enquadramentoAutomatico;

  const opcoes = useMemo<OpcoesArte>(() => ({ ...opcoesBase, modoAjuste: ajuste, enquadramentos, modoRosto, rostos }), [opcoesBase, ajuste, enquadramentos, modoRosto, rostos]);

  const mudarPerfil = (i: number, v: string) => setPerfisTexto((l) => l.map((x, k) => (k === i ? v : x)));
  const concluirPerfil = (i: number) => {
    const limpa = perfisTexto.map((x, k) => (k === i ? normalizarPerfil(x) : x));
    setPerfisTexto(limpa);
    salvarPreferencias({ perfis: normalizarPerfis(limpa), seloModo, margensStories, modoRosto: modoProtegido.current });
  };
  const lembrar = (parte: Partial<{ seloModo: SeloModo; margensStories: boolean; modoRosto: ModoRostoProtegido }>) => {
    salvarPreferencias({ perfis, seloModo, margensStories, modoRosto: modoProtegido.current, ...parte });
  };
  const escolherModoRosto = (v: ModoRosto) => {
    setModoRosto(v);
    setRostoConferido(false);
    if (v === 'nenhum') {
      setFerramenta('enquadrar');
      return;
    }
    modoProtegido.current = v;
    lembrar({ modoRosto: v });
  };
  const mudarMulLargura = (v: number) => { setMulLargura(v); setRostoConferido(false); };
  const mudarMulAltura = (v: number) => { setMulAltura(v); setRostoConferido(false); };

  // ---- gestos na prévia ----
  const arrastar = useCallback((i: number, dx: number, dy: number) => {
    const caixa = layoutAtual.paineis[i], p = paineis?.[i];
    if (!caixa || !p) return;
    if (ferramentaEf === 'enquadrar') {
      setEnquadramentoManual((prev) => {
        const lista = prev ?? enquadramentoAutomatico;
        return aplicar(lista, i, arrastarEnquadramento(lista[i] ?? ENQUADRAMENTO_PADRAO, dx, dy, caixa, p.largura, p.altura, ajuste), juntas);
      });
    } else if (modoRosto !== 'nenhum') {
      const j = janelaDaImagem(caixa, p.largura, p.altura, ajuste, enquadramentos[i] ?? ENQUADRAMENTO_PADRAO);
      if (!(j.escala > 0)) return;
      setRostoConferido(false);
      setRostosBase((prev) => prev.map((c, k) => (k === i && c ? moverCaixaRosto(c, c.cx + dx / (j.escala * p.largura), c.cy + dy / (j.escala * p.altura)) : c)));
    }
  }, [layoutAtual, paineis, ferramentaEf, ajuste, juntas, modoRosto, enquadramentos, enquadramentoAutomatico]);

  const dar = useCallback((i: number, fator: number, foco: { x: number; y: number }) => {
    const caixa = layoutAtual.paineis[i], p = paineis?.[i];
    if (!caixa || !p) return;
    setEnquadramentoManual((prev) => {
      const lista = prev ?? enquadramentoAutomatico;
      const atual = lista[i] ?? ENQUADRAMENTO_PADRAO;
      return aplicar(lista, i, zoomarEnquadramento(atual, atual.zoom * fator, caixa, p.largura, p.altura, ajuste, foco), juntas);
    });
  }, [layoutAtual, paineis, ajuste, juntas, enquadramentoAutomatico]);

  const mudarZoom = (z: number) => {
    if (!paineis) return;
    setEnquadramentoManual((prev) => (prev ?? enquadramentoAutomatico).map((e, k) => {
      if (!juntas && k !== fotoDoZoom) return e;
      const caixa = layoutAtual.paineis[k], p = paineis[k];
      return caixa && p ? zoomarEnquadramento(e, z, caixa, p.largura, p.altura, ajuste) : { ...e, zoom: z };
    }));
  };

  const escolherAvatar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const dataUrl = await miniaturaDoAvatar(arquivo);
      setAvatarUrl(dataUrl);
      salvarAvatar(dataUrl);
    } catch {
      toast.error('Não consegui abrir essa imagem para o avatar.');
    }
  };

  const removerAvatar = () => {
    setAvatarUrl(null);
    salvarAvatar(null);
  };

  // ---- ações ----
  const montarArquivo = async () => {
    if (!paineis) throw new Error('As fotos ainda estão carregando.');
    await garantirFontesSociais();
    const { canvas } = renderizarArteSocial(opcoes, paineis, recursos, 1);
    const blob = await canvasParaPng(canvas);
    const nome = nomeArquivoSocial(formato, layoutEf);
    return { blob, nome, arquivo: new File([blob], nome, { type: 'image/png' }) };
  };

  // No toque de Compartilhar não pode haver `await` antes do share (Safari/WebView do iPhone): renderiza e codifica na hora.
  // As fontes já foram carregadas quando a arte abriu.
  const montarArquivoNoToque = () => {
    if (!paineis) throw new Error('As fotos ainda estão carregando.');
    const { canvas } = renderizarArteSocial(opcoes, paineis, recursos, 1);
    const blob = canvasParaPngSincrono(canvas);
    const nome = nomeArquivoSocial(formato, layoutEf);
    return { blob, nome, arquivo: new File([blob], nome, { type: 'image/png' }) };
  };

  const falha = (e: unknown) => {
    const seguranca = e instanceof Error && e.name === 'SecurityError';
    toast.error(seguranca ? 'A logo da clínica não pôde ser usada. Troque o selo por “Marca MyHealthID” e tente de novo.' : 'Não consegui gerar a imagem. Tente de novo.');
  };

  const baixar = async () => {
    if (!podeExportar(autorizado, ocupado !== null, rostoPendente)) return;
    setOcupado('baixar');
    try {
      const { blob, nome } = await montarArquivo();
      baixarBlob(blob, nome);
      // O WebView do app nem sempre aceita baixar por link: mostra a imagem para salvar com o toque longo.
      if (Capacitor.isNativePlatform()) setImagemManual(URL.createObjectURL(blob));
      toast.success('Imagem pronta. Confira em Arquivos ou Downloads.');
    } catch (e) {
      falha(e);
    } finally {
      setOcupado(null);
    }
  };

  const compartilhar = async () => {
    if (!podeExportar(autorizado, ocupado !== null, rostoPendente)) return;
    setOcupado('compartilhar');
    try {
      const { blob, nome, arquivo } = montarArquivoNoToque();
      const r = await compartilharArquivo(arquivo);
      if (r === 'indisponivel') {
        baixarBlob(blob, nome);
        if (Capacitor.isNativePlatform()) setImagemManual(URL.createObjectURL(blob));
        toast.info('Este aparelho não abre o compartilhamento direto. A imagem foi baixada.');
      } else if (r === 'bloqueado') {
        toast.info('O aparelho não abriu o compartilhamento. Toque em Compartilhar de novo ou use Baixar PNG.');
      }
    } catch (e) {
      falha(e);
    } finally {
      setOcupado(null);
    }
  };

  const nomeFoto = (i: number) => (rotulos[i]?.trim() ? rotulos[i].trim() : `Foto ${i + 1}`);
  const layoutsOk = layoutsDisponiveis(nPaineis);
  const zoomAtual = enquadramentos[juntas ? 0 : fotoDoZoom]?.zoom ?? 1;
  const liberado = podeExportar(autorizado, ocupado !== null, rostoPendente) && !!paineis;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[94dvh] sm:w-[calc(100%-2rem)] sm:rounded-lg [&>button]:top-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:[&>button]:top-3">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))' }}>
          <DialogTitle className="text-base">Arte para Instagram</DialogTitle>
          <DialogDescription className="text-xs">Monte a imagem com as marcações, confira a prévia e baixe já no formato certo.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="corpo-social">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
            {/* Prévia */}
            <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              {erroCarga && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erroCarga}</p>}
              {!paineis && !erroCarga && (
                <div className="flex h-56 items-center justify-center gap-2 rounded-xl bg-muted/40 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Montando a prévia…</div>
              )}
              {paineis && (
                <PreviaArteSocial
                  opcoes={opcoes} paineis={paineis} recursos={recursos} escala={ESCALA_PREVIA} ferramenta={ferramentaEf}
                  aoArrastar={arrastar} aoZoom={dar}
                  descricao={`Prévia da arte ${ROTULO_FORMATO[formato]}, ${NOMES_LAYOUT[layoutEf].toLowerCase()}`}
                />
              )}
              {paineis && (
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3" data-testid="controles-da-foto">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Arrastar na prévia</p>
                    <Chips<FerramentaPrevia>
                      rotulo="Ferramenta da prévia" valor={ferramentaEf} aoEscolher={setFerramenta} colunas="grid-cols-2"
                      opcoes={[{ valor: 'enquadrar', rotulo: 'Enquadrar a foto', detalhe: 'arraste e use pinça' }, ...(modoRosto !== 'nenhum' ? [{ valor: 'rosto' as const, rotulo: 'Posicionar o rosto', detalhe: 'arraste a área' }] : [])]}
                    />
                    {modoRosto !== 'nenhum' && algumSemRosto && (
                      <p role="status" className="rounded-lg bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-300" data-testid="aviso-rosto-previa">
                        Não achei o rosto automaticamente. Arraste a área sobre ele e confira na prévia antes de baixar.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5" role="group" aria-label="Enquadramento das fotos">
                    <Chips<ModoAjuste> rotulo="Ajuste da foto na caixa" valor={ajuste} aoEscolher={(v) => { setAjusteEscolhido(v); setEnquadramentoManual(null); }} colunas="grid-cols-2" opcoes={[{ valor: 'inteira', rotulo: 'Foto inteira', detalhe: 'não corta' }, { valor: 'preencher', rotulo: 'Preencher', detalhe: 'corta o excesso' }]} />
                    {nPaineis >= 2 && <Interruptor rotulo="Mover as duas fotos juntas" marcado={juntas} aoMudar={(v) => { setJuntas(v); if (v) setEnquadramentoManual((prev) => { const lista = prev ?? enquadramentoAutomatico; return lista.map(() => lista[fotoDoZoom] ?? ENQUADRAMENTO_PADRAO); }); }} />}
                    {nPaineis >= 2 && !juntas && (
                      <Chips<string> rotulo="Foto do zoom" valor={String(fotoDoZoom)} aoEscolher={(v) => setFotoDoZoom(Number(v))} colunas="grid-cols-2" opcoes={Array.from({ length: nPaineis }, (_, i) => ({ valor: String(i), rotulo: nomeFoto(i) }))} />
                    )}
                    <Deslizante rotulo="Zoom da foto" valor={zoomAtual} min={ZOOM_MIN} max={ZOOM_MAX} passo={0.05} aoMudar={mudarZoom} texto={`${Math.round(zoomAtual * 100)}%`} />
                    {nPaineis >= 2 && <p className="text-xs text-muted-foreground">Para comparar de verdade, as duas fotos usam o mesmo enquadramento.</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="space-y-5">
              <Grupo titulo="Formato">
                <Chips<FormatoSocial> rotulo="Formato da imagem" valor={formato} aoEscolher={setFormato} colunas="grid-cols-3" opcoes={ORDEM_FORMATOS.map((f) => ({ valor: f, rotulo: ROTULO_FORMATO[f], detalhe: `${FORMATOS[f].proporcao} · ${FORMATOS[f].largura}×${FORMATOS[f].altura}` }))} />
                {formato === 'story' && <Interruptor rotulo="Margens de Stories (texto fora das faixas cobertas pelo Instagram)" marcado={margensStories} aoMudar={(v) => { setMargensStories(v); lembrar({ margensStories: v }); }} />}
              </Grupo>

              {nPaineis >= 2 && (
                <Grupo titulo="Disposição das fotos">
                  <Chips<LayoutArte> rotulo="Disposição" valor={layoutEf} aoEscolher={(l) => { setLayout(l); setTituloModoEscolhido(null); }} colunas="grid-cols-2" opcoes={layoutsOk.map((l) => ({ valor: l, rotulo: NOMES_LAYOUT[l] }))} />
                </Grupo>
              )}

              <Grupo titulo="Título" dica={DICA_TITULO_SEM_PACIENTE}>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={70} placeholder="Ex.: Pós-operatório de SLAP" aria-label="Título da arte" className="h-11 text-base" />
                <Chips<TituloModo> rotulo="Posição do título" valor={titulo.trim() ? tituloModo : 'nenhum'} aoEscolher={setTituloModoEscolhido} colunas="grid-cols-3" opcoes={[{ valor: 'vertical', rotulo: 'Vertical' }, { valor: 'horizontal', rotulo: 'No topo' }, { valor: 'nenhum', rotulo: 'Sem título' }]} />
              </Grupo>

              <Grupo titulo="Rótulos das fotos">
                {rotulos.map((r, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                    <Input value={r} onChange={(e) => setRotulos((l) => l.map((x, k) => (k === i ? e.target.value : x)))} maxLength={30} placeholder={nPaineis >= 2 ? (i === 0 ? 'Pré-Sessão' : 'Pós-Sessão') : 'Rótulo (opcional)'} aria-label={`Rótulo da foto ${i + 1}`} className="h-11 text-base" />
                    <Input value={datas[i] ?? ''} onChange={(e) => setDatas((l) => l.map((x, k) => (k === i ? e.target.value : x)))} maxLength={10} inputMode="numeric" placeholder="dd/mm/aaaa" aria-label={`Data da foto ${i + 1}`} className="h-11 text-base" />
                  </div>
                ))}
                <Interruptor rotulo="Mostrar as datas" marcado={mostrarDatas} aoMudar={setMostrarDatas} />
              </Grupo>

              <Grupo titulo="Legenda e avatar">
                <Input value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={60} placeholder="Ex.: 3ª semana de PO" aria-label="Legenda da pílula" className="h-11 text-base" />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 text-sm font-semibold hover:bg-muted/50">
                    <Upload className="h-4 w-4" aria-hidden /> {avatarUrl ? 'Trocar avatar' : 'Escolher avatar'}
                    <input type="file" accept="image/*" className="sr-only" aria-label="Escolher a foto do avatar" onChange={(e) => { void escolherAvatar(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {avatarUrl && (
                    <button type="button" onClick={removerAvatar} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted/50"><Trash2 className="h-4 w-4" aria-hidden /> Remover avatar</button>
                  )}
                </div>
              </Grupo>

              <Grupo titulo="Perfis no rodapé" dica="Até três, sem o @. Ficam lembrados para a próxima arte.">
                {perfisTexto.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-center text-base font-semibold text-muted-foreground" aria-hidden>@</span>
                    <Input value={p} onChange={(e) => mudarPerfil(i, e.target.value)} onBlur={() => concluirPerfil(i)} maxLength={200} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={i === 0 ? 'seuperfil' : 'outro perfil (opcional)'} aria-label={`Perfil ${i + 1}`} className="h-11 text-base" />
                  </div>
                ))}
              </Grupo>

              <Grupo titulo="Selo">
                <Chips<SeloModo> rotulo="Selo no canto" valor={seloModo} aoEscolher={(v) => { setSeloModo(v); lembrar({ seloModo: v }); }} opcoes={[{ valor: 'clinica', rotulo: 'Logo da clínica' }, { valor: 'marca', rotulo: 'MyHealthID' }, { valor: 'nenhum', rotulo: 'Sem selo' }]} />
                {seloModo === 'clinica' && !logoUrl && <p className="text-xs text-muted-foreground">Nenhuma logo de clínica encontrada: o selo usa a marca do MyHealthID.</p>}
                {seloModo === 'clinica' && logoIndisponivel && (
                  <p role="status" className="rounded-lg bg-amber-500/10 p-2 text-xs font-medium text-amber-800 dark:text-amber-300" data-testid="aviso-logo">
                    Não consegui usar a logo da clínica (o endereço dela não permite o uso em imagens). O selo está com a marca do MyHealthID; reenvie a logo nas configurações da clínica para usá-la aqui.
                  </p>
                )}
              </Grupo>

              <Grupo titulo="Privacidade do rosto" dica="Escondido por padrão. Desligue só se o paciente autorizou aparecer.">
                <Chips<ModoRosto> rotulo="Esconder o rosto" valor={modoRosto} aoEscolher={escolherModoRosto} opcoes={[{ valor: 'desfoque', rotulo: 'Desfocar' }, { valor: 'tarja', rotulo: 'Tarja' }, { valor: 'nenhum', rotulo: 'Mostrar' }]} />
                {modoRosto !== 'nenhum' && (
                  <>
                    <Deslizante rotulo="Largura da área" valor={mulLargura} min={MULTIPLICADOR_MIN} max={MULTIPLICADOR_MAX} passo={0.05} aoMudar={mudarMulLargura} texto={`${Math.round(mulLargura * 100)}%`} />
                    <Deslizante rotulo="Altura da área" valor={mulAltura} min={MULTIPLICADOR_MIN} max={MULTIPLICADOR_MAX} passo={0.05} aoMudar={mudarMulAltura} texto={`${Math.round(mulAltura * 100)}%`} />
                    <p className={cn('text-xs', algumSemRosto ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')} data-testid="dica-rosto">
                      {algumSemRosto
                        ? 'Não achei o rosto automaticamente em alguma foto. Use “Posicionar o rosto” e arraste a área sobre ele.'
                        : 'Rosto localizado pelos pontos do corpo. Confira na prévia e ajuste se precisar.'}
                    </p>
                  </>
                )}
              </Grupo>
            </div>
          </div>
        </div>

        {/* Autorização e ações: sempre à vista no rodapé do diálogo. */}
        <div
          className="max-h-[55dvh] shrink-0 space-y-2 overflow-y-auto overscroll-contain border-t border-border/60 bg-background px-4 pt-3" data-testid="rodape-social"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
        >
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-2.5 text-sm">
            <Checkbox checked={autorizado} onCheckedChange={(v) => setAutorizado(v === true)} className="mt-0.5 h-6 w-6" />
            <span className="font-medium leading-snug">{TEXTO_CONSENTIMENTO}</span>
          </label>
          {modoRosto !== 'nenhum' && algumSemRosto && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2.5 text-sm" data-testid="conferir-rosto">
              <Checkbox checked={rostoConferido} onCheckedChange={(v) => setRostoConferido(v === true)} className="mt-0.5 h-6 w-6" />
              <span className="font-medium leading-snug">{TEXTO_ROSTO_CONFERIDO}</span>
            </label>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {AVISO_CONSELHO}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-12 gap-2" onClick={() => void baixar()} disabled={!liberado} data-testid="baixar-png">
              {ocupado === 'baixar' ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Baixar PNG
            </Button>
            <Button variant="outline" className="h-12 gap-2" onClick={() => void compartilhar()} disabled={!liberado} data-testid="compartilhar">
              {ocupado === 'compartilhar' ? <Loader2 className="animate-spin" aria-hidden /> : <Share2 aria-hidden />} Compartilhar
            </Button>
          </div>
          {imagemManual && (
            <div className="space-y-1.5 rounded-xl border border-border/60 p-2.5">
              <p className="text-xs text-muted-foreground">Se a imagem não foi salva, toque e segure sobre ela e escolha “Salvar imagem”.</p>
              <img src={imagemManual} alt="Arte pronta para salvar" className="mx-auto max-h-48 w-auto rounded-lg" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
