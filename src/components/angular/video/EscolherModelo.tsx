import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Dumbbell, Footprints, Hand, Ruler, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoCarregado } from '@/lib/angular/analiseVideo/carregarVideo';
import { FPS_COMUNS } from '@/lib/angular/analiseVideo/carregarVideo';
import { ajustarIntervalo, estimativaDoRastreio, formatarSegundos, maiorTaxaQueComporta, opcoesDeTaxa, taxaMaximaParaTrecho, trechoCabeNaTaxa, trechoMaximoS, type IntervaloVideo } from '@/lib/angular/analiseVideo/tempo';
import type { ModeloUi } from '@/lib/angular/analiseVideo/tiposUi';

const ICONES: [string, LucideIcon][] = [['marcha', Footprints], ['corrida', Zap], ['agach', Dumbbell], ['salto', ArrowDownToLine], ['aterr', ArrowDownToLine], ['bra', ArrowUpFromLine], ['ombro', Hand], ['livre', Ruler]];
const iconeDoModelo = (id: string): LucideIcon => ICONES.find(([k]) => id.toLowerCase().includes(k))?.[1] ?? Activity;

interface Props {
  video: VideoCarregado;
  modelos: ModeloUi[];
  modeloId: string;
  aoModelo: (id: string) => void;
  fpsVideo: number;
  aoFpsVideo: (fps: number) => void;
  taxaFps: number;
  aoTaxa: (fps: number) => void;
  intervalo: IntervaloVideo;
  aoIntervalo: (i: IntervaloVideo) => void;
  avisos: string[];
  aoRastrear: () => void;
  /** Já existe uma análise aberta: volta a ela aplicando o gesto escolhido aos pontos já rastreados (sem rastrear de novo). */
  aoUsarRastreio?: () => void;
  /** Abre a análise sem rastrear o corpo: só a marcação ponto a ponto, quadro a quadro. */
  aoSoMedir: () => void;
  /** Taxa (q/s) que o gesto escolhido pede. Se a análise ficou abaixo dela porque o trecho não comporta, a tela diz isso. */
  fpsSugerido?: number;
  /** Qual ação é a principal: quem entra pela medida ponto a ponto vê "Só medir" em destaque. */
  primario?: 'rastrear' | 'medir';
  aoTrocarVideo: (arquivo: File) => void;
}

const ACOES_INICIAIS = (rastrear: () => void, medir: () => void) => [
  ['rastrear', 'Rastrear o corpo no vídeo', rastrear, 'botao-rastrear'],
  ['medir', 'Só medir ponto a ponto (sem rastrear)', medir, 'botao-so-medir'],
] as const;

const chip = (ativo: boolean) => cn('flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold tabular-nums transition-colors', ativo ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50');

// Segundo passo: o gesto a analisar, o trecho do vídeo e a taxa da análise.
export default function EscolherModelo({ video, modelos, modeloId, aoModelo, fpsVideo, aoFpsVideo, taxaFps, aoTaxa, intervalo, aoIntervalo, avisos, aoRastrear, aoUsarRastreio, aoSoMedir, fpsSugerido, primario = 'rastrear', aoTrocarVideo }: Props) {
  const previa = useRef<HTMLVideoElement>(null);
  const taxas = opcoesDeTaxa(fpsVideo);
  const trecho = Math.max(0, intervalo.fim - intervalo.inicio);
  const nf = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  // Cada taxa tem o seu trecho máximo (limite de quadros ÷ taxa): a seleção trava nele, então a taxa escolhida é a que sai e o motor nunca a reduz em silêncio.
  const trechoMax = trechoMaximoS(taxaFps);
  const cabe = trechoCabeNaTaxa(trecho, taxaFps);
  const candidata = cabe ? null : maiorTaxaQueComporta(trecho, fpsVideo);
  const sugestao = candidata && trechoCabeNaTaxa(trecho, candidata.fps) ? candidata : null;
  const mover = (lado: 'inicio' | 'fim', valor: number) => {
    const novo = ajustarIntervalo({ ...intervalo, [lado]: valor }, video.duracao, lado, trechoMax);
    aoIntervalo(novo);
    if (previa.current) previa.current.currentTime = lado === 'inicio' ? novo.inicio : Math.max(novo.inicio, novo.fim - 0.05);
  };
  const modelo = modelos.find((m) => m.id === modeloId);

  // As opções do aviso de limite somem quando resolvem o limite, levando o foco junto: quem usa teclado ou leitor de tela cairia no topo da página.
  // O foco vai para o botão de rastrear, que acabou de ser liberado, e só se o limite foi mesmo resolvido (sem estado que sobre para depois).
  const botaoRastrear = useRef<HTMLButtonElement>(null);
  const [focarRastrear, setFocarRastrear] = useState(false);
  useEffect(() => {
    if (!focarRastrear) return;
    setFocarRastrear(false);
    if (cabe) botaoRastrear.current?.focus();
  }, [focarRastrear, cabe]);

  // A taxa que o gesto pede é a maior oferecida até a sugerida. Se ela não cabe no trecho, a taxa pré-selecionada desce para a que cabe: isso precisa estar escrito.
  const taxaDoGesto = fpsSugerido ? taxas.filter((o) => o.fps <= fpsSugerido).pop() : undefined;
  const abaixoDoGesto = cabe && taxaDoGesto && taxaFps < taxaDoGesto.fps && !trechoCabeNaTaxa(trecho, taxaDoGesto.fps) ? taxaDoGesto : null;
  const usarTaxaDoGesto = (fps: number) => {
    const novo = ajustarIntervalo(intervalo, video.duracao, 'fim', trechoMaximoS(fps));
    setFocarRastrear(true);
    aoIntervalo(novo);
    aoTaxa(fps);
    if (previa.current) previa.current.currentTime = Math.max(novo.inicio, novo.fim - 0.05);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
        <video ref={previa} src={video.url} muted playsInline controls preload="metadata" className="mx-auto block max-h-[32dvh] w-full" aria-label="Prévia do vídeo" />
      </div>

      <section className="space-y-2" aria-label="Trecho do vídeo">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Trecho a analisar</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{formatarSegundos(trecho, 1)} de {formatarSegundos(video.duracao, 1)}</span>
        </div>
        {video.duracao > 1 && (
          <div className="grid gap-1">
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="w-12 shrink-0">Início</span>
              <input type="range" min={0} max={Math.max(0, video.duracao - 0.5)} step={0.1} value={intervalo.inicio} aria-label="Início do trecho" onChange={(e) => mover('inicio', Number(e.target.value))} className="h-11 w-full cursor-pointer touch-pan-x accent-primary" />
              <span className="w-14 shrink-0 text-right tabular-nums text-foreground">{formatarSegundos(intervalo.inicio, 1)}</span>
            </label>
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="w-12 shrink-0">Fim</span>
              <input type="range" min={0.5} max={video.duracao} step={0.1} value={intervalo.fim} aria-label="Fim do trecho" onChange={(e) => mover('fim', Number(e.target.value))} className="h-11 w-full cursor-pointer touch-pan-x accent-primary" />
              <span className="w-14 shrink-0 text-right tabular-nums text-foreground">{formatarSegundos(intervalo.fim, 1)}</span>
            </label>
          </div>
        )}
        <p className="text-xs text-muted-foreground" role="status" data-testid="limite-trecho">A {nf(taxaFps)} q/s o trecho máximo é <strong className="text-foreground">{nf(trechoMax)} s</strong>.</p>
      </section>

      <section className="space-y-2" aria-label="Gesto a analisar">
        <h3 className="text-sm font-semibold">O que você vai analisar?</h3>
        <div role="radiogroup" aria-label="Modelo de gesto" className="grid gap-2 sm:grid-cols-2">
          {modelos.map((m) => {
            const Icone = iconeDoModelo(m.id);
            const ativo = m.id === modeloId;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={ativo} onClick={() => aoModelo(m.id)} data-testid={`modelo-${m.id}`}
                className={cn('flex min-h-[72px] items-start gap-3 rounded-2xl border p-3 text-left transition-colors', ativo ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border/60 bg-card hover:bg-muted/40')}>
                <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ativo ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}><Icone className="h-5 w-5" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{m.nome}</span>
                  <span className="block text-[11px] font-medium text-muted-foreground">{m.vista}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{m.descricao}</span>
                </span>
              </button>
            );
          })}
        </div>
        {modelo && modelo.itens.length > 0 && (
          <p className="rounded-xl bg-muted/40 p-2.5 text-xs leading-snug text-muted-foreground"><strong className="text-foreground">Mede:</strong> {modelo.itens.join(' · ')}.</p>
        )}
      </section>

      <section className="space-y-2" aria-label="Taxa de quadros">
        <div>
          <h3 className="text-sm font-semibold">Vídeo gravado a quantos quadros por segundo?</h3>
          <p className="text-xs text-muted-foreground">Define o passo de cada quadro e os tempos das métricas. Câmera lenta do celular costuma ser 120 ou 240.</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7" role="group" aria-label="Quadros por segundo do vídeo">
          {FPS_COMUNS.map((f) => <button key={f} type="button" aria-pressed={fpsVideo === f} onClick={() => aoFpsVideo(f)} className={chip(fpsVideo === f)}>{f}</button>)}
        </div>
        {taxas.length > 1 && (
          <>
            <h3 className="pt-1 text-sm font-semibold">Detalhe da análise</h3>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Detalhe da análise">
              {taxas.map((t) => (
                <button key={t.id} type="button" aria-pressed={taxaFps === t.fps} onClick={() => aoTaxa(t.fps)} data-testid={`taxa-${t.id}`} className={cn(chip(taxaFps === t.fps), 'flex-col leading-tight')}>
                  {t.nome}
                  <span className="text-[11px] font-normal text-muted-foreground">{t.fps} q/s</span>
                  <span className="text-[11px] font-normal text-muted-foreground">trecho até {nf(trechoMaximoS(t.fps))} s</span>
                </button>
              ))}
            </div>
          </>
        )}
        {abaixoDoGesto && (
          <div className="space-y-2 rounded-xl bg-muted/50 p-2.5 text-xs leading-snug text-muted-foreground" role="status" data-testid="aviso-taxa-do-gesto">
            <p>
              A sugestão para {modelo?.nome ?? 'este gesto'} é <strong className="text-foreground">{nf(abaixoDoGesto.fps)} q/s</strong>, mas um trecho de {formatarSegundos(trecho, 1)} comporta
              até {taxaMaximaParaTrecho(trecho)} q/s: a análise ficou em <strong className="text-foreground">{nf(taxaFps)} q/s</strong>. O trecho não foi encurtado.
            </p>
            <button type="button" onClick={() => usarTaxaDoGesto(abaixoDoGesto.fps)} data-testid="usar-taxa-do-gesto"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-border/60 bg-background px-3 py-1.5 text-center text-sm font-semibold text-foreground hover:bg-muted/50">
              Usar {nf(abaixoDoGesto.fps)} q/s e reduzir o trecho para {nf(trechoMaximoS(abaixoDoGesto.fps))} s
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Estimativa: cerca de {estimativaDoRastreio(trecho, taxaFps)} s para rastrear. A primeira vez baixa o modelo de detecção (cerca de 6 MB); deixe a tela aberta.</p>
        {!cabe && (
          <div className="space-y-2 rounded-xl bg-amber-500/10 p-2.5 text-xs leading-snug text-amber-800 dark:text-amber-300" role="alert" id="aviso-limite-trecho" data-testid="aviso-limite-trecho">
            <p>O trecho de {formatarSegundos(trecho, 1)} não cabe a {nf(taxaFps)} q/s: o máximo é {nf(trechoMax)} s. Escolha uma opção; a análise nunca reduz a taxa sozinha.</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <button type="button" onClick={() => { setFocarRastrear(true); mover('fim', intervalo.fim); }} data-testid="reduzir-trecho"
                className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-amber-700/40 bg-background px-3 py-1.5 text-center text-sm font-semibold text-foreground hover:bg-muted/50">
                Reduzir o trecho para {nf(trechoMax)} s
              </button>
              {sugestao && (
                <button type="button" onClick={() => { setFocarRastrear(true); aoTaxa(sugestao.fps); }} data-testid="sugerir-taxa"
                  className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-amber-700/40 bg-background px-3 py-1.5 text-center text-sm font-semibold text-foreground hover:bg-muted/50">
                  Para {nf(trecho)} s use até {taxaMaximaParaTrecho(trecho)} q/s
                  <span className="text-[11px] font-normal text-muted-foreground">Escolher {sugestao.fps} q/s</span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {avisos.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300" role="status">
          {avisos.map((a) => <li key={a}>• {a}</li>)}
        </ul>
      )}

      <div className="grid gap-2">
        {aoUsarRastreio && (
          <button type="button" onClick={aoUsarRastreio} data-testid="botao-usar-rastreio"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/92 active:scale-[0.98]">
            Voltar à análise com este gesto
          </button>
        )}
        {[...ACOES_INICIAIS(aoRastrear, aoSoMedir)]
          .sort((a, b) => (a[0] === primario ? -1 : b[0] === primario ? 1 : 0))
          .map(([id, texto, acao, testid]) => (
            <button key={id} ref={id === 'rastrear' ? botaoRastrear : undefined} type="button" onClick={acao} data-testid={testid} disabled={id === 'rastrear' && !cabe} aria-describedby={id === 'rastrear' && !cabe ? 'aviso-limite-trecho' : undefined}
              className={cn('flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
                id === primario && !aoUsarRastreio ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/92' : 'border border-border/60 bg-card text-sm hover:bg-muted/50')}>
              {aoUsarRastreio && id === 'rastrear' ? 'Rastrear o corpo de novo (apaga as correções)' : texto}
            </button>
          ))}
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-border/60 bg-card px-4 text-sm font-medium hover:bg-muted/50">
          Trocar o vídeo
          <input type="file" accept="video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) aoTrocarVideo(f); }} />
        </label>
      </div>
    </div>
  );
}
