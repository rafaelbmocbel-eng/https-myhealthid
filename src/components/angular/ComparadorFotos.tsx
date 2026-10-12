import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, Camera, Check, Hand, Link2, Loader2, Maximize2, MousePointer2, Palette, Ruler, Share2, Smartphone, Sparkles, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CameraNivel from '@/components/angular/CameraNivel';
import PainelEstilo from '@/components/angular/PainelEstilo';
import PainelComparacao, { SUFIXO_ALCA, type FotoPainel } from '@/components/angular/PainelComparacao';
import { COR_REFERENCIA, ICONE_MEDIDA, LADO_MEDIDA } from '@/components/angular/iconesMedida';
import { cn } from '@/lib/utils';
import {
  REFS_COMPASSO, medidasDaVista, segmentosDaMedida, type GrupoMedida, type Medida, type OlharPara, type Ponto, type RefCompasso, type UnidadePrumo, type Vista,
} from '@/lib/angular/medidas';
import { giroDaFoto } from '@/lib/angular/sensor';
import { detectarPose } from '@/lib/angular/detector';
import { pontosAutomaticos, pontosDoPrumo, type Landmark } from '@/lib/angular/pose';
import {
  OPCOES_ANALISE_PADRAO, apoioPelaAlca, calcularResultados, faltaReferenciaDoPrumo, painelParaExportar,
  type AnaliseFoto, type AnaliseParaExportar, type OpcoesAnalise, type PainelParaExportar,
} from '@/lib/angular/analise';
import {
  TEXTO_NAO_CLASSIFICA, grau, medidasParaComparar, medidasParaExportar, motivoTexto, parearMedidas, variacaoTexto, type LinhaPareada,
} from '@/lib/angular/comparar';
import { analiseDoPainel, pontosSemOcultas, pontosSemReferencias } from '@/lib/angular/compararPaineis';
import { dataBR, fracaoDeRolagem, posicaoDeRolagem, razaoDaCaixa } from '@/lib/angular/compararLayout';
import { lerEstilo, salvarEstilo, type EstiloMarcacao } from '@/lib/angular/estilo';

/** Foto já analisada na tela principal, para semear um dos dois painéis. */
export interface FotoAnalisada {
  /** Pontos, nível, escala e opções da foto. `analise.imagem` deve ser o `<img>` da foto. */
  analise: AnaliseFoto;
  /** Endereço da foto (o mesmo `blob:` da tela principal). */
  url: string;
  rotulo?: string;
  /** aaaa-mm-dd. Sem isso a data fica vazia e nada vai impresso na arte: o comparador não presume a data da foto. */
  data?: string;
  /** Pontos de pose já detectados nesta foto; servem para achar o rosto na arte para Instagram. */
  landmarks?: Landmark[] | null;
}

/** Pontos de pose de cada foto da arte, na ordem de `arte.paineis` (null onde não houve detecção). */
export interface ExtrasDaArte {
  landmarks: (Landmark[] | null)[];
}

/**
 * Ponto de entrada para a tela de análise:
 *
 *   <ComparadorFotos
 *     key={foto.url}                                   // remonte ao trocar a foto semente
 *     vista={vista}
 *     atual={{ analise, url: foto.url, landmarks }}    // `analise` é o AnaliseFoto da tela; vira o painel "Pós"
 *     estilo={estilo} onEstiloChange={mudarEstilo}     // o mesmo estilo das linhas da análise
 *     onExportar={(arte, extras) => abrirDialogoSocial(arte, extras.landmarks)}  // fotos já com as marcações
 *     onFechar={() => setComparando(false)} />
 *
 * A outra foto é carregada aqui dentro (galeria ou câmera) e marcada com as mesmas medidas. As edições feitas
 * no comparador ficam só nele; a foto semente não é alterada.
 */
export interface ComparadorFotosProps {
  vista: Vista;
  atual?: FotoAnalisada | null;
  /** Outra foto já analisada, se o integrador tiver uma (vai para o painel que `atual` não ocupa). */
  outra?: FotoAnalisada | null;
  posicaoAtual?: 'pre' | 'pos';
  estilo?: EstiloMarcacao;
  onEstiloChange?: (e: EstiloMarcacao) => void;
  /** Sem isso, o botão de arte para Instagram não aparece. */
  onExportar?: (arte: AnaliseParaExportar, extras: ExtrasDaArte) => void;
  onFechar?: () => void;
  titulo?: string;
}

interface FotoDoPainel extends FotoPainel { propria: boolean }

interface PainelEstado {
  rotulo: string;
  /** aaaa-mm-dd */
  data: string;
  foto: FotoDoPainel | null;
  pontos: Record<string, Ponto[]>;
  giroBase: number | null;
  cmPorPxBase: number | null;
  nivelTipo: 'horizontal' | 'vertical';
  escalaCm: string;
  landmarks: Landmark[] | null;
  /** Para onde o paciente olha nesta foto (perfil): o sentido do desvio do fio de prumo depende disso, então é dado de cada foto. */
  olhaPara: OlharPara;
}

type Dupla<T> = [T, T];
type Indice = 0 | 1;

const ZOOM_MAX = 5;
const ROTULOS_PADRAO: Dupla<string> = ['Pré', 'Pós'];
const GRUPOS: { id: GrupoMedida; titulo: string }[] = [
  { id: 'postura', titulo: 'Postura' },
  { id: 'ferramenta', titulo: 'Ferramentas' },
  { id: 'referencia', titulo: 'Referências da foto' },
];
const SETA_REF: Record<RefCompasso, typeof ArrowDown> = { baixo: ArrowDown, cima: ArrowUp, esquerda: ArrowLeft, direita: ArrowRight };
const UNIDADES_PRUMO: { id: UnidadePrumo; nome: string }[] = [{ id: 'graus', nome: 'Graus' }, { id: 'cm', nome: 'cm' }, { id: 'pct', nome: '% da altura' }];
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(1, +z.toFixed(2)));
const nf = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const painelVazio = (rotulo: string): PainelEstado => ({
  rotulo, data: '', foto: null, pontos: {}, giroBase: null, cmPorPxBase: null, nivelTipo: 'horizontal', escalaCm: '', landmarks: null, olhaPara: OPCOES_ANALISE_PADRAO.olhaPara,
});

// A data só entra se o integrador a informou: a foto semente pode ser uma foto antiga da galeria, e uma data de hoje inventada iria impressa na arte.
function painelDaSemente(s: FotoAnalisada, rotuloPadrao: string): PainelEstado {
  const a = s.analise;
  return {
    ...painelVazio(s.rotulo || rotuloPadrao), data: s.data ?? '',
    foto: { url: s.url, w: a.largura, h: a.altura, img: a.imagem as HTMLImageElement, propria: false },
    pontos: pontosSemReferencias(a.pontos), giroBase: a.giro, cmPorPxBase: a.cmPorPx, landmarks: s.landmarks ?? null, olhaPara: a.opcoes.olhaPara,
  };
}

function iniciais(atual: FotoAnalisada | null, outra: FotoAnalisada | null, posicao: 'pre' | 'pos'): Dupla<PainelEstado> {
  const base: Dupla<PainelEstado> = [painelVazio(ROTULOS_PADRAO[0]), painelVazio(ROTULOS_PADRAO[1])];
  const i: Indice = posicao === 'pre' ? 0 : 1;
  const j: Indice = i === 0 ? 1 : 0;
  if (atual) base[i] = painelDaSemente(atual, ROTULOS_PADRAO[i]);
  if (outra) base[j] = painelDaSemente(outra, ROTULOS_PADRAO[j]);
  return base;
}

function Segmentado<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: { id: T; nome: ReactNode }[]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="grid gap-1.5 rounded-2xl bg-muted/60 p-1.5" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} onClick={() => onChange(o.id)}
          className={cn('min-h-10 min-w-0 truncate rounded-xl px-3 py-2 text-sm font-semibold transition-all', valor === o.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

function Celula({ titulo, valor, legenda, destaque }: { titulo: string; valor: string; legenda?: string | null; destaque?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-lg px-1 py-1.5', destaque && 'bg-primary/10')}>
      <p className="truncate text-[11px] text-muted-foreground">{titulo}</p>
      <p className={cn('text-sm tabular-nums', destaque ? 'font-bold' : 'font-medium')}>{valor}</p>
      {legenda && <p className="text-[10px] leading-tight text-muted-foreground">{legenda}</p>}
    </div>
  );
}

function LinhaDiferenca({ l, rotuloAntes, rotuloDepois }: { l: LinhaPareada; rotuloAntes: string; rotuloDepois: string }) {
  const motivo = motivoTexto(l, rotuloAntes, rotuloDepois);
  return (
    <li className="rounded-xl border border-border/50 p-2" data-testid={`diferenca-${l.id}`}>
      <p className="text-sm font-medium">{l.nome}</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5 text-center">
        <Celula titulo={rotuloAntes} valor={grau(l.antes?.graus, l.antes?.unidade)} legenda={l.sentidoAntes?.rotulo} />
        <Celula titulo={rotuloDepois} valor={grau(l.depois?.graus, l.depois?.unidade)} legenda={l.sentidoDepois?.rotulo} />
        <Celula titulo="Diferença" valor={variacaoTexto(l.diferenca, l.unidade)} destaque={l.diferenca !== null} />
      </div>
      {motivo && <p className="mt-1 text-[11px] text-muted-foreground">{motivo}</p>}
    </li>
  );
}

export default function ComparadorFotos({ vista, atual = null, outra = null, posicaoAtual = 'pos', estilo: estiloProp, onEstiloChange, onExportar, onFechar, titulo = 'Comparar fotos' }: ComparadorFotosProps) {
  const [paineis, setPaineis] = useState<Dupla<PainelEstado>>(() => iniciais(atual, outra, posicaoAtual));
  const [opcoes, setOpcoes] = useState<OpcoesAnalise>(() => atual?.analise.opcoes ?? outra?.analise.opcoes ?? OPCOES_ANALISE_PADRAO);
  const [modo, setModo] = useState<'comparar' | 'marcar'>('comparar');
  const [disposicao, setDisposicao] = useState<'lado' | 'empilhada'>('lado');
  const [sincronizar, setSincronizar] = useState(true);
  const [zooms, setZooms] = useState<Dupla<number>>([1, 1]);
  const [mover, setMover] = useState(false);
  const [editando, setEditando] = useState<Indice>(() => {
    const ini = iniciais(atual, outra, posicaoAtual);
    return ini[0].foto && !ini[1].foto ? 1 : 0;
  });
  const [ativa, setAtiva] = useState('');
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(() => new Set());
  const [estiloLocal, setEstiloLocal] = useState<EstiloMarcacao>(() => estiloProp ?? lerEstilo());
  const [painelEstilo, setPainelEstilo] = useState(false);
  const [detectando, setDetectando] = useState<Indice | null>(null);
  const [camera, setCamera] = useState<Indice | null>(null);
  const estilo = estiloProp ?? estiloLocal;

  const rolagemEsq = useRef<HTMLDivElement>(null);
  const rolagemDir = useRef<HTMLDivElement>(null);
  const rolagens: Dupla<typeof rolagemEsq> = [rolagemEsq, rolagemDir];
  const sincronizandoRolagem = useRef(false);
  const origemZoom = useRef<Indice>(0);
  const paineisRef = useRef(paineis);
  paineisRef.current = paineis;

  useEffect(() => () => { paineisRef.current.forEach((p) => { if (p.foto?.propria) URL.revokeObjectURL(p.foto.url); }); }, []);

  const disponiveis = useMemo(() => medidasDaVista(vista), [vista]);
  const medidaAtiva: Medida = disponiveis.find((m) => m.id === ativa) ?? disponiveis[0];

  // Uma análise por foto: a completa (edição) e a sem as medidas escondidas (comparação, tabela e arte).
  const analises = useMemo<Dupla<AnaliseFoto>>(() => {
    const de = (p: PainelEstado) => analiseDoPainel({ vista, foto: p.foto, pontos: p.pontos, nivelTipo: p.nivelTipo, escalaCm: p.escalaCm, giroBase: p.giroBase, cmPorPxBase: p.cmPorPxBase, opcoes: { ...opcoes, olhaPara: p.olhaPara } });
    return [de(paineis[0]), de(paineis[1])];
  }, [paineis, vista, opcoes]);
  const visiveis = useMemo<Dupla<AnaliseFoto>>(
    () => [{ ...analises[0], pontos: pontosSemOcultas(analises[0].pontos, ocultas) }, { ...analises[1], pontos: pontosSemOcultas(analises[1].pontos, ocultas) }],
    [analises, ocultas],
  );
  const linhas = useMemo(
    () => parearMedidas(medidasParaComparar(calcularResultados(visiveis[0])), medidasParaComparar(calcularResultados(visiveis[1]))),
    [visiveis],
  );
  const comMarcas = disponiveis.filter((m) => !m.auxiliar && ((paineis[0].pontos[m.id]?.length ?? 0) + (paineis[1].pontos[m.id]?.length ?? 0)) > 0);
  const rotulo = (i: Indice) => paineis[i].rotulo.trim() || ROTULOS_PADRAO[i];

  const atualizar = (i: Indice, mudanca: Partial<PainelEstado> | ((p: PainelEstado) => Partial<PainelEstado>)) =>
    setPaineis((s) => {
      const novo: Dupla<PainelEstado> = [s[0], s[1]];
      novo[i] = { ...s[i], ...(typeof mudanca === 'function' ? mudanca(s[i]) : mudanca) };
      return novo;
    });

  const alterarPontos = (i: Indice, medida: string, fn: (p: Ponto[]) => Ponto[]) =>
    atualizar(i, (p) => ({ pontos: { ...p.pontos, [medida]: fn(p.pontos[medida] ?? []) } }));

  // ---- zoom e rolagem sincronizados ----
  const definirZoom = (i: Indice, z: number) => {
    origemZoom.current = i;
    setZooms((s) => {
      if (sincronizar) return [z, z];
      const n: Dupla<number> = [s[0], s[1]];
      n[i] = z;
      return n;
    });
  };
  const alternarSincronia = () => {
    if (!sincronizar) setZooms((s) => [s[0], s[0]]);
    setSincronizar((v) => !v);
  };
  const passoZoom = (d: number) => { setZooms((s) => [limitarZoom(s[0] + d), limitarZoom(s[1] + d)]); };
  const ajustarTudo = () => { setZooms([1, 1]); setMover(false); };

  const copiarRolagem = (de: Indice) => {
    const a = rolagens[de].current, b = rolagens[de === 0 ? 1 : 0].current;
    if (!sincronizar || sincronizandoRolagem.current || !a || !b) return;
    const x = posicaoDeRolagem(fracaoDeRolagem(a.scrollLeft, a.scrollWidth, a.clientWidth), b.scrollWidth, b.clientWidth);
    const y = posicaoDeRolagem(fracaoDeRolagem(a.scrollTop, a.scrollHeight, a.clientHeight), b.scrollHeight, b.clientHeight);
    if (Math.abs(b.scrollLeft - x) < 1 && Math.abs(b.scrollTop - y) < 1) return;
    sincronizandoRolagem.current = true;
    b.scrollLeft = x; b.scrollTop = y;
    requestAnimationFrame(() => { sincronizandoRolagem.current = false; });
  };
  useLayoutEffect(() => { if (modo === 'comparar') copiarRolagem(origemZoom.current); }, [zooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- fotos ----
  const trocarFoto = (i: Indice, foto: FotoDoPainel, inclinacao: number | null) => {
    const antiga = paineisRef.current[i].foto;
    if (antiga?.propria) URL.revokeObjectURL(antiga.url);
    atualizar(i, { foto, pontos: {}, giroBase: inclinacao !== null ? giroDaFoto(inclinacao) : null, cmPorPxBase: null, escalaCm: '', landmarks: null, olhaPara: OPCOES_ANALISE_PADRAO.olhaPara });
    setZooms((s) => (sincronizar ? [1, 1] : (i === 0 ? [1, s[1]] : [s[0], 1])));
    setMover(false);
    setEditando(i);
    setModo('marcar');
  };

  // As fotos trocam de lugar; os nomes (Pré e Pós) ficam onde estão, porque o primeiro lugar é o de cima ou da esquerda na arte.
  const trocarFotos = () => {
    setPaineis((s) => [{ ...s[1], rotulo: s[0].rotulo }, { ...s[0], rotulo: s[1].rotulo }]);
    setEditando((e) => (e === 0 ? 1 : 0));
  };

  const marcarAutomatico = async (i: Indice, alvo?: FotoDoPainel, silencioso = false) => {
    const f = alvo ?? paineisRef.current[i].foto;
    if (!f) return;
    setDetectando(i);
    try {
      const lm = await detectarPose(f.img);
      if (!lm) { if (!silencioso) toast.error('Não achei o corpo na foto. Marque os pontos à mão.'); return; }
      if (paineisRef.current[i].foto?.img === f.img) atualizar(i, { landmarks: lm });
      const sugeridos = pontosAutomaticos(lm, vista, f.w, f.h);
      const ids = Object.keys(sugeridos);
      if (!ids.length) { if (!silencioso) toast.warning('O corpo apareceu cortado ou pouco nítido. Marque os pontos à mão.'); return; }
      if (paineisRef.current[i].foto?.img !== f.img) return;
      atualizar(i, (p) => ({ pontos: { ...p.pontos, ...sugeridos } }));
      setAtiva((a) => a || ids[0]);
      toast.success(`Marquei ${ids.length} medida(s) em ${paineisRef.current[i].rotulo.trim() || ROTULOS_PADRAO[i]}. Confira cada ponto.`);
    } catch {
      // Sem internet para baixar o modelo, ou navegador sem suporte: segue a marcação manual.
      if (!silencioso) toast.error('Não consegui carregar a marcação automática agora. Marque os pontos à mão.');
    } finally {
      setDetectando(null);
    }
  };

  const sugerirPrumo = async (i: Indice) => {
    const f = paineisRef.current[i].foto;
    if (!f) return;
    setDetectando(i);
    try {
      const lm = await detectarPose(f.img);
      if (!lm) { toast.error('Não achei o corpo na foto. Marque os pontos à mão.'); return; }
      if (paineisRef.current[i].foto?.img === f.img) atualizar(i, { landmarks: lm });
      const s = pontosDoPrumo(lm, vista, f.w, f.h);
      if (!s) { toast.warning('O corpo apareceu cortado ou pouco nítido. Marque os pontos à mão.'); return; }
      atualizar(i, (p) => ({ pontos: { ...p.pontos, [s.medidaId]: s.pontos }, ...(s.olhaPara ? { olhaPara: s.olhaPara } : {}) }));
      setAtiva(s.medidaId);
      toast.success('Sugeri o apoio e os pontos do fio. Confira cada ponto e arraste o que estiver fora do lugar.');
    } catch {
      // Sem internet para baixar o modelo, ou navegador sem suporte: segue a marcação manual.
      toast.error('Não consegui carregar a marcação automática agora. Marque os pontos à mão.');
    } finally {
      setDetectando(null);
    }
  };

  const escolherFoto = (i: Indice, arquivo: File | undefined, inclinacao: number | null = null) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const foto: FotoDoPainel = { url, w: img.naturalWidth, h: img.naturalHeight, img, propria: true };
      trocarFoto(i, foto, inclinacao);
      void marcarAutomatico(i, foto, true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error('Não consegui abrir essa imagem.'); };
    img.src = url;
  };

  // ---- estilo e exportação ----
  const mudarEstilo = (e: EstiloMarcacao) => {
    setEstiloLocal(e);
    onEstiloChange?.(e);
    if (!estiloProp) salvarEstilo(e);
  };

  const exportar = () => {
    const arte: PainelParaExportar[] = [];
    const landmarks: (Landmark[] | null)[] = [];
    paineis.forEach((p, i) => {
      if (!p.foto) return;
      const painel = painelParaExportar(visiveis[i], estilo, { rotulo: rotulo(i as Indice), data: dataBR(p.data) || undefined, ladoMax: 2000 });
      if (!painel) return;
      arte.push(painel);
      landmarks.push(p.landmarks);
    });
    if (!arte.length) { toast.error('Escolha pelo menos uma foto para exportar.'); return; }
    onExportar?.({ paineis: arte, medidas: medidasParaExportar(linhas) }, { landmarks });
  };

  // ---- blocos de interface ----
  const vazio = (i: Indice) => (
    <div className="flex w-full flex-col items-center gap-2 text-center text-white">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/50 px-3 py-2 text-sm font-semibold">
        <Camera className="h-4 w-4" aria-hidden /> Escolher a foto
        <input type="file" accept="image/*" className="sr-only" aria-label={`Escolher a foto ${rotulo(i)}`} onChange={(e) => { escolherFoto(i, e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <button type="button" onClick={() => setCamera(i)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-white/80 underline-offset-2 hover:underline">
        <Smartphone className="h-3.5 w-3.5" aria-hidden /> Tirar a foto no app
      </button>
    </div>
  );

  const alternar = (id: string) => setOcultas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const temFoto = paineis.some((p) => p.foto);
  const razaoComparar = razaoDaCaixa(paineis.map((p) => (p.foto ? p.foto.w / p.foto.h : null)));
  const zoomsIguais = zooms[0] === zooms[1];

  const barraZoom = (
    <div className="flex items-center gap-0.5" role="group" aria-label="Zoom">
      <Button size="icon" variant="ghost" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => passoZoom(-0.5)} disabled={zooms[0] <= 1 && zooms[1] <= 1}><ZoomOut className="h-4 w-4" /></Button>
      <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums">{zoomsIguais ? `${Math.round(zooms[0] * 100)}%` : `${Math.round(zooms[0] * 100)}/${Math.round(zooms[1] * 100)}%`}</span>
      <Button size="icon" variant="ghost" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => passoZoom(0.5)} disabled={zooms[0] >= ZOOM_MAX && zooms[1] >= ZOOM_MAX}><ZoomIn className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" aria-label="Ajustar à tela" title="Ajustar à tela" onClick={ajustarTudo}><Maximize2 className="h-4 w-4" /></Button>
    </div>
  );

  // ---- modo comparar ----
  const comparar = (
    <div className="space-y-3">
      <Segmentado<'lado' | 'empilhada'> valor={disposicao} onChange={setDisposicao} rotulo="Disposição das fotos" opcoes={[{ id: 'lado', nome: 'Lado a lado' }, { id: 'empilhada', nome: 'Empilhadas' }]} />
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5">
          <Button variant={sincronizar ? 'default' : 'outline'} className="h-10 gap-1.5" aria-pressed={sincronizar} onClick={alternarSincronia} title="Zoom e posição juntos nas duas fotos">
            <Link2 className="h-4 w-4" /> Zoom junto
          </Button>
          <Button variant="outline" className="h-10 gap-1.5" onClick={trocarFotos} disabled={!temFoto} title={`Trocar as fotos de lugar (${rotulo(0)} e ${rotulo(1)})`}>
            <ArrowLeftRight className="h-4 w-4" /> Trocar
          </Button>
        </div>
        {barraZoom}
      </div>

      <div className={cn('grid gap-2', disposicao === 'lado' ? 'grid-cols-2' : 'grid-cols-1')}>
        {([0, 1] as const).map((i) => (
          <div key={i} className="min-w-0 space-y-1.5" data-testid={`painel-${i}`}>
            <div className={cn('grid gap-1.5', disposicao === 'lado' ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,10.5rem)]')}>
              <Input value={paineis[i].rotulo} maxLength={24} onChange={(e) => atualizar(i, { rotulo: e.target.value })} aria-label={`Nome da foto ${i + 1}`} placeholder={ROTULOS_PADRAO[i]} className="h-10 text-[16px] font-semibold sm:text-sm" />
              <Input type="date" value={paineis[i].data} onChange={(e) => atualizar(i, { data: e.target.value })} aria-label={`Data da foto ${rotulo(i)}`} className="h-10 min-w-0 px-2 text-[16px] sm:px-3 sm:text-sm" />
            </div>
            <PainelComparacao
              foto={paineis[i].foto} analise={visiveis[i]} medidas={disponiveis} estilo={estilo} zoom={zooms[i]} setZoom={(z) => definirZoom(i, z)} zoomMax={ZOOM_MAX}
              razao={razaoComparar} alturaMax={disposicao === 'lado' ? '68dvh' : '62dvh'} rolagemRef={rolagens[i]} aoRolar={() => copiarRolagem(i)}
              vazio={vazio(i)} descricao={`Foto ${rotulo(i)} com as medidas marcadas`}
            />
            <div className="flex gap-1.5">
              <Button variant="outline" className="h-10 flex-1 gap-1.5 px-2 text-xs" onClick={() => { setEditando(i); setModo('marcar'); }}>
                <Ruler className="h-4 w-4" /> {paineis[i].foto ? 'Marcar' : 'Escolher'}
              </Button>
              {paineis[i].foto && (
                <label className="inline-flex h-10 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-background hover:bg-muted/60" title="Trocar a foto" aria-label={`Trocar a foto ${rotulo(i)}`}>
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { escolherFoto(i, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {comMarcas.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Medidas mostradas">
          {comMarcas.map((m) => {
            const mostrada = !ocultas.has(m.id);
            return (
              <button key={m.id} type="button" aria-pressed={mostrada} onClick={() => alternar(m.id)}
                className={cn('inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium', mostrada ? 'border-primary bg-primary/10' : 'border-border/60 text-muted-foreground')}>
                {mostrada && <Check className="h-3.5 w-3.5" aria-hidden />} {m.nome}
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" aria-label="Diferença por medida" data-testid="diferencas">
        <p className="text-sm font-semibold">Diferença por medida <span className="text-xs font-normal text-muted-foreground">({rotulo(1)} − {rotulo(0)})</span></p>
        {linhas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Marque as mesmas medidas nas duas fotos (botão “Marcar”) para ver a diferença em graus.</p>
        ) : (
          <>
            <ul className="space-y-2">{linhas.map((l) => <LinhaDiferenca key={l.id} l={l} rotuloAntes={rotulo(0)} rotuloDepois={rotulo(1)} />)}</ul>
            <p className="text-[11px] leading-snug text-muted-foreground">{TEXTO_NAO_CLASSIFICA}</p>
          </>
        )}
      </section>

      <Button variant={painelEstilo ? 'default' : 'outline'} className="h-11 w-full gap-2" aria-pressed={painelEstilo} onClick={() => setPainelEstilo((v) => !v)}>
        <Palette className="h-4 w-4" /> Estilo das linhas
      </Button>
      {painelEstilo && <PainelEstilo estilo={estilo} aoMudar={mudarEstilo} aoFechar={() => setPainelEstilo(false)} />}

      {onExportar && (
        <Button className="h-11 w-full gap-2" onClick={exportar} disabled={!temFoto}>
          <Share2 className="h-4 w-4" /> Baixar para Instagram
        </Button>
      )}
    </div>
  );

  // ---- modo marcar ----
  const pEd = paineis[editando];
  const aEd = analises[editando];
  const outro: Indice = editando === 0 ? 1 : 0;
  const ptsAtiva = pEd.pontos[medidaAtiva.id] ?? [];
  const proximo = ptsAtiva.length < medidaAtiva.pontos.length ? medidaAtiva.pontos[ptsAtiva.length] : null;
  const completaEm = (i: Indice, m: Medida) => (paineis[i].pontos[m.id]?.length ?? 0) >= m.pontos.length;
  const semEscala = medidaAtiva.id === 'regua' && !aEd.cmPorPx;
  const faltaPrumo = faltaReferenciaDoPrumo(aEd);

  const arrastar = (medida: string, indice: number, p: Ponto) => {
    if (medida.endsWith(SUFIXO_ALCA)) {
      // A alça do topo só desloca o fio na horizontal; o apoio mantém a altura.
      const id = medida.slice(0, -SUFIXO_ALCA.length);
      atualizar(editando, (s) => ({ pontos: { ...s.pontos, [id]: (s.pontos[id] ?? []).map((q, k) => (k === 0 ? apoioPelaAlca(p, q, aEd.giro, aEd.largura) : q)) } }));
      return;
    }
    alterarPontos(editando, medida, (s) => s.map((q, k) => (k === indice ? p : q)));
  };

  const marcar = (
    <div className="space-y-2">
      <Segmentado<'0' | '1'> valor={editando === 0 ? '0' : '1'} onChange={(v) => { setEditando(v === '0' ? 0 : 1); setMover(false); }} rotulo="Foto a marcar"
        opcoes={[{ id: '0', nome: rotulo(0) }, { id: '1', nome: rotulo(1) }]} />

      <PainelComparacao
        foto={pEd.foto} analise={aEd} medidas={disponiveis} estilo={estilo} zoom={zooms[editando]} setZoom={(z) => definirZoom(editando, z)} zoomMax={ZOOM_MAX}
        razao={razaoDaCaixa([pEd.foto ? pEd.foto.w / pEd.foto.h : null])} alturaMax="72dvh" editavel mover={mover}
        medidaAtiva={medidaAtiva.id} pontosAtiva={ptsAtiva} segmentosAtiva={segmentosDaMedida(medidaAtiva).filter(([i, j]) => i < ptsAtiva.length && j < ptsAtiva.length)}
        podeMarcar={!!proximo} aoMarcar={(p) => alterarPontos(editando, medidaAtiva.id, (s) => [...s, p])}
        aoArrastar={arrastar} aoIniciarArrasto={(m) => setAtiva(m.endsWith(SUFIXO_ALCA) ? m.slice(0, -SUFIXO_ALCA.length) : m)}
        rolagemRef={editando === 0 ? rolagemEsq : rolagemDir} vazio={vazio(editando)} descricao={`Foto ${rotulo(editando)}: toque para marcar os pontos`}
      />

      <nav aria-label="Ferramentas de medida" className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-card p-1">
        {GRUPOS.map((g, gi) => {
          const itens = disponiveis.filter((m) => m.grupo === g.id);
          if (!itens.length) return null;
          return (
            <div key={g.id} className="contents">
              {gi > 0 && <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />}
              {itens.map((m) => {
                const Icone = ICONE_MEDIDA[m.id] ?? Ruler;
                const ativaM = m.id === medidaAtiva.id;
                const falta = completaEm(outro, m) && !completaEm(editando, m);
                return (
                  <button key={m.id} type="button" onClick={() => setAtiva(m.id)} aria-pressed={ativaM} aria-label={m.nome} title={m.nome}
                    className={cn('relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors', ativaM ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                    <Icone className="h-5 w-5" style={!ativaM && COR_REFERENCIA[m.id] ? { color: COR_REFERENCIA[m.id] } : undefined} />
                    {LADO_MEDIDA[m.id] && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none">{LADO_MEDIDA[m.id]}</span>}
                    {completaEm(editando, m) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" aria-label="feita nesta foto" />}
                    {falta && <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-card" aria-label={`já marcada na foto ${rotulo(outro)}`} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-0.5 rounded-2xl border border-border/60 bg-card p-1" role="toolbar" aria-label="Ações da foto">
        <Button className="h-10 gap-1.5" onClick={() => void marcarAutomatico(editando)} disabled={!pEd.foto || detectando !== null} title="Marcar os pontos automaticamente">
          {detectando === editando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} <span className="hidden sm:inline">Automático</span>
        </Button>
        <Button size="icon" variant="ghost" aria-label="Desfazer o último ponto" title="Desfazer" onClick={() => alterarPontos(editando, medidaAtiva.id, (s) => s.slice(0, -1))} disabled={!ptsAtiva.length}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label="Limpar a medida" title="Limpar a medida" onClick={() => alterarPontos(editando, medidaAtiva.id, () => [])} disabled={!ptsAtiva.length}><Trash2 className="h-4 w-4" /></Button>
        {barraZoom}
        <Button size="icon" variant={mover ? 'default' : 'ghost'} aria-pressed={mover} aria-label={mover ? 'Voltar a marcar' : 'Mover a foto com um dedo'} title={mover ? 'Voltar a marcar' : 'Mover a foto com um dedo'} onClick={() => setMover((m) => !m)} disabled={zooms[editando] <= 1}>
          {mover ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
        </Button>
        <span className="ml-auto flex items-center gap-0.5">
          <Button size="icon" variant="ghost" aria-label="Tirar a foto no app" title="Tirar a foto no app" onClick={() => setCamera(editando)}><Smartphone className="h-4 w-4" /></Button>
          <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Trocar a foto" aria-label="Trocar a foto">
            <Camera className="h-4 w-4" />
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { escolherFoto(editando, e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </span>
      </div>

      <p className="text-xs text-muted-foreground" role="status">
        <strong className="text-foreground">{medidaAtiva.nome}.</strong>{' '}
        {!pEd.foto ? 'Escolha a foto para marcar.'
          : mover ? 'Modo mover: arraste a foto com um dedo.'
            : proximo ? <>Toque e segure para ver a lupa; solte para marcar <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong>.</>
              : 'Medida completa. Arraste um ponto para ajustar.'}
        {' '}Dois dedos: zoom e mover.
      </p>

      {medidaAtiva.id === 'nivel' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">Marque 2 pontos sobre algo reto na vida real (rodapé ou chão: horizontal; fio de prumo ou batente: vertical). Os ângulos desta foto saem corrigidos.</p>
          <div className="grid grid-cols-2 gap-1">
            {(['horizontal', 'vertical'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={pEd.nivelTipo === t} onClick={() => atualizar(editando, { nivelTipo: t })}
                className={cn('min-h-10 rounded-lg border px-2 py-1.5 font-medium capitalize', pEd.nivelTipo === t ? 'border-primary bg-primary/10' : 'border-border/60')}>{t}</button>
            ))}
          </div>
          {aEd.giro !== null && <p className="font-medium">{Math.abs(aEd.giro) < 0.05 ? 'Foto já está nivelada.' : `Foto girada ${nf(Math.abs(aEd.giro))}°: os ângulos já saem corrigidos.`}</p>}
        </div>
      )}
      {medidaAtiva.id === 'escala' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">Marque as pontas de um objeto de tamanho conhecido, no mesmo plano do paciente, e informe o comprimento.</p>
          <div className="flex items-center gap-2">
            <Input inputMode="decimal" value={pEd.escalaCm} onChange={(e) => atualizar(editando, { escalaCm: e.target.value })} placeholder="Comprimento" className="h-10 text-[16px] sm:text-sm" aria-label="Comprimento do objeto em centímetros" />
            <span className="shrink-0 font-medium">cm</span>
          </div>
          {aEd.cmPorPx && <p className="font-medium">Escala pronta: a régua já mede em centímetros.</p>}
        </div>
      )}
      {semEscala && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">Para medir em centímetros, primeiro calibre a escala (em “Referências da foto”).</p>}
      {medidaAtiva.definicao && medidaAtiva.desenho !== 'prumo' && medidaAtiva.id !== 'compasso-ref' && (
        <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground" data-testid="definicao-medida"><strong className="text-foreground">Como é medido.</strong> {medidaAtiva.definicao}</p>
      )}
      {medidaAtiva.id === 'compasso-ref' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs" data-testid="cartao-compasso-ref">
          <p className="text-muted-foreground">{medidaAtiva.definicao}</p>
          <p className="font-medium">Medir contra (vale para as duas fotos)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {REFS_COMPASSO.map((r) => {
              const Seta = SETA_REF[r.id];
              return (
                <button key={r.id} type="button" aria-pressed={opcoes.compassoRef === r.id} onClick={() => setOpcoes((o) => ({ ...o, compassoRef: r.id }))}
                  className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-center font-medium leading-tight', opcoes.compassoRef === r.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
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
            <p className="font-medium">Mostrar o desvio em (vale para as duas fotos)</p>
            <div className="grid grid-cols-3 gap-1.5">
              {UNIDADES_PRUMO.map((u) => (
                <button key={u.id} type="button" aria-pressed={opcoes.unidadePrumo === u.id} onClick={() => setOpcoes((o) => ({ ...o, unidadePrumo: u.id }))}
                  className={cn('min-h-11 rounded-xl border px-1.5 py-1.5 font-medium leading-tight', opcoes.unidadePrumo === u.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>{u.nome}</button>
              ))}
            </div>
          </div>
          {vista === 'perfil' && (
            <div className="space-y-1">
              <p className="font-medium">O paciente olha para a (vale só para esta foto)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([['esquerda', ArrowLeft], ['direita', ArrowRight]] as const).map(([lado, Seta]) => (
                  <button key={lado} type="button" aria-pressed={pEd.olhaPara === lado} onClick={() => atualizar(editando, { olhaPara: lado })}
                    className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 font-medium', pEd.olhaPara === lado ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
                    <Seta className="h-4 w-4" aria-hidden /> {lado === 'esquerda' ? 'Esquerda' : 'Direita'} da imagem
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button size="sm" variant="outline" className="h-11 w-full gap-1.5" onClick={() => void sugerirPrumo(editando)} disabled={detectando !== null || !pEd.foto}>
            {detectando === editando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sugerir os pontos do fio
          </Button>
          {faltaPrumo && <p className="rounded-lg bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">{faltaPrumo}</p>}
        </div>
      )}

      <Button className="h-11 w-full" onClick={() => { setModo('comparar'); setMover(false); }}>Ver a comparação</Button>
    </div>
  );

  return (
    <section className="space-y-3" aria-label={titulo} data-testid="comparador-fotos">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="text-xs text-muted-foreground">Vista {vista}. As mesmas medidas marcadas nas duas fotos; as fotos ficam só neste aparelho.</p>
        </div>
        {onFechar && <Button variant="ghost" size="icon" className="shrink-0" aria-label="Fechar a comparação" onClick={onFechar}><X className="h-4 w-4" /></Button>}
      </div>

      <Segmentado<'comparar' | 'marcar'> valor={modo} onChange={setModo} rotulo="Modo" opcoes={[{ id: 'comparar', nome: 'Comparar' }, { id: 'marcar', nome: 'Marcar' }]} />

      {modo === 'comparar' ? comparar : marcar}

      {camera !== null && (
        <CameraNivel onFechar={() => setCamera(null)} onCapturar={(f, incl) => { const i = camera; setCamera(null); escolherFoto(i, f, incl); }} />
      )}
    </section>
  );
}
