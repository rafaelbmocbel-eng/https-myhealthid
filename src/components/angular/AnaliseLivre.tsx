import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ClipboardCheck, Copy, FileDown, ImageDown, Instagram, Loader2, Plus, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CameraNivel from '@/components/angular/CameraNivel';
import { CartaoDasMedidas } from '@/components/angular/CartaoDasMedidas';
import { EditorDaFoto } from '@/components/angular/EditorDaFoto';
import { TextoDaMedida } from '@/components/angular/ResumoSessao';
import { INSTRUCAO_DA_POSICAO } from '@/components/angular/textosSessao';
import type { EstadoDaAnaliseLivre } from '@/hooks/useAnaliseLivre';
import type { VisaoDaFoto } from '@/hooks/useVisaoDaFoto';
import {
  analiseDaFotoParaExportar, baixarBlob, canvasComMedidas, canvasParaBlob, nomeArquivoImagem, type AnaliseParaExportar,
} from '@/lib/angular/analise';
import type { EstiloMarcacao } from '@/lib/angular/estilo';
import { medidasDaVista, type Medida } from '@/lib/angular/medidas';
import { NOME_LIVRE_MAX, limparNomeLivre, tituloDaAnaliseLivre } from '@/lib/angular/sessao';
import type { Landmark } from '@/lib/angular/pose';

const nf = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Análise livre: uma foto avulsa para medir qualquer coisa (um movimento, uma articulação, uma curva), sem as quatro posições da postura.
 * Só as ferramentas livres e as referências da foto (nível e escala), com o mesmo editor da postura. Cada análise é UMA nota do
 * prontuário, com o nome que o profissional deu. A foto fica só neste aparelho. O estado vem de `useAnaliseLivre`, na página.
 */
export default function AnaliseLivre({ livre, visao, paciente, estilo, aoMudarEstilo, aoAbrirArte }: {
  livre: EstadoDaAnaliseLivre;
  /** Grade, estilo e "ver só o desenho": ficam na página para sobreviver à troca de aba. */
  visao: VisaoDaFoto;
  paciente: { id: string; nome: string } | null | undefined;
  estilo: EstiloMarcacao;
  aoMudarEstilo: (e: EstiloMarcacao) => void;
  aoAbrirArte: (arte: AnaliseParaExportar, landmarks: (Landmark[] | null)[]) => void;
}) {
  const { acoes, atual: item, resumo, nome } = livre;
  const foto = item.foto;
  const [cameraAberta, setCameraAberta] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const campoNome = useRef<HTMLInputElement>(null);

  const disponiveis = useMemo(() => medidasDaVista('livre'), []);
  const medidaAtiva: Medida = disponiveis.find((m) => m.id === item.ativa) ?? disponiveis[0];
  const { analise, medidas, temResultado, temMarcacao: temPontosMarcados, giro, giroMarcado, giroSensor, cmPorPx, notaNivel } = resumo;

  const nomeLimpo = limparNomeLivre(nome);
  const podeSalvar = !!paciente && temResultado && !livre.outroPaciente;
  const salva = item.salva && !!item.notaId;

  const abrirCamera = () => livre.pedirCamera(() => setCameraAberta(true));
  const entradaDeFoto = (e: ChangeEvent<HTMLInputElement>) => { livre.escolherFoto(e.target.files?.[0]); e.target.value = ''; };

  const baixarImagem = async () => {
    if (!foto) return;
    setBaixando(true);
    try {
      const cv = canvasComMedidas(analise, estilo, { auxiliares: false });
      const blob = cv ? await canvasParaBlob(cv) : null;
      if (!blob) { toast.error('Não consegui gerar a imagem.'); return; }
      baixarBlob(blob, nomeArquivoImagem('livre', new Date(), 'png'));
      toast.success('Imagem baixada com as marcações.');
    } catch {
      toast.error('Não consegui gerar a imagem.');
    } finally {
      setBaixando(false);
    }
  };

  const abrirArte = () => {
    if (!foto) return;
    const arte = analiseDaFotoParaExportar(analise, estilo);
    if (!arte) { toast.error('Não consegui montar a imagem.'); return; }
    aoAbrirArte(arte, [null]);
  };

  const copiar = async () => {
    const texto = medidas.map((m) => `• ${m.texto}`).join('\n');
    try { await navigator.clipboard.writeText(`${tituloDaAnaliseLivre(nome)}\n${texto}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  return (
    <div className="space-y-3" data-testid="analise-livre">
      <section className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" aria-label="Análise livre">
        <div className="flex items-start justify-between gap-2">
          <label htmlFor="nome-analise-livre" className="text-sm font-semibold">
            O que você está analisando? <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </label>
          {(!!foto || nome.length > 0) && (
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 gap-1.5" onClick={() => livre.novaAnalise(() => campoNome.current?.focus())} data-testid="nova-analise-livre">
              <Plus className="h-4 w-4" /> Nova análise livre
            </Button>
          )}
        </div>
        <Input id="nome-analise-livre" ref={campoNome} value={nome} maxLength={NOME_LIVRE_MAX} onChange={(e) => acoes.definirNomeLivre(e.target.value)}
          placeholder="elevação do braço direito" className="h-10 text-[16px] sm:text-sm" autoComplete="off" />
        <p className="text-[11px] text-muted-foreground">
          Vira o nome da análise no prontuário e no PDF.
          <span className="ml-1 tabular-nums">{nome.length}/{NOME_LIVRE_MAX}</span>
        </p>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {!foto ? (
            <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-semibold">Tirar ou escolher a foto da análise</span>
              <span className="max-w-sm text-sm font-medium" data-testid="instrucao-livre">{INSTRUCAO_DA_POSICAO.livre}</span>
              <span className="max-w-sm text-xs text-muted-foreground">Uma foto só. Se puder, deixe a câmera parada e a imagem reta. A foto fica só neste aparelho.</span>
              <input type="file" accept="image/*" className="sr-only" aria-label="Escolher a foto da análise livre" onChange={entradaDeFoto} />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.preventDefault(); abrirCamera(); }}><Smartphone className="h-3.5 w-3.5" /> Tirar a foto no app</Button>
            </label>
          ) : (
            <EditorDaFoto
              posicao="livre" foto={foto} item={item} resumo={resumo} disponiveis={disponiveis} medidaAtiva={medidaAtiva} acoes={acoes}
              estilo={estilo} aoMudarEstilo={aoMudarEstilo} visao={visao} baixando={baixando} aoBaixar={() => void baixarImagem()}
              fimDaBarra={(
                <>
                  <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Tirar a foto no app" title="Tirar a foto no app" onClick={abrirCamera}><Smartphone className="h-4 w-4" /></Button>
                  <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Trocar a foto" aria-label="Trocar a foto">
                    <Camera className="h-4 w-4" />
                    <input type="file" accept="image/*" className="sr-only" onChange={entradaDeFoto} />
                  </label>
                </>
              )}
              aposABarra={(
                <Button className="h-auto min-h-11 w-full gap-1.5 whitespace-normal px-2 text-[13px] leading-tight" onClick={abrirArte} disabled={!temPontosMarcados} data-testid="baixar-instagram-livre"
                  title={temPontosMarcados ? 'Arte pronta para Stories, Reels ou Feed' : 'Marque uma medida para montar a arte'}>
                  <Instagram className="h-4 w-4 shrink-0" /> Baixar para Instagram
                </Button>
              )} />
          )}
        </div>

        {foto && (
          <aside className="space-y-3 lg:sticky lg:top-4">
            <CartaoDasMedidas posicao="livre" item={item} acoes={acoes} disponiveis={disponiveis} medidaAtiva={medidaAtiva}
              giro={giro} giroMarcado={giroMarcado} giroSensor={giroSensor} cmPorPx={cmPorPx} compassoRef={livre.estado.compassoRef} />

            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" data-testid="resultado-livre">
              <p className="text-sm font-semibold">Resultado <span className="text-xs font-normal text-muted-foreground">· {nomeLimpo || 'Análise livre'}</span></p>
              {!temResultado ? <p className="text-xs text-muted-foreground">Complete uma medida para ver o resultado.</p> : (
                <ul className="space-y-1.5 text-sm tabular-nums">{medidas.map((m) => <li key={m.id}><TextoDaMedida m={m} /></li>)}</ul>
              )}
              {notaNivel && <p className="text-[11px] text-muted-foreground">Correção de nível aplicada: {nf(Math.abs(giro ?? 0))}°.</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => void livre.salvar()} disabled={!podeSalvar || livre.salvando} className="min-w-[180px] flex-1 gap-1.5" data-testid="salvar-livre">
                  {livre.salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} {item.notaId ? 'Atualizar análise' : 'Salvar análise'}
                </Button>
                <Button variant="outline" onClick={copiar} disabled={!temResultado} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
              </div>
              {salva && <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400" data-testid="livre-salva">Salva no prontuário.</p>}
              {!salva && !!item.notaId && <p className="text-[11px] text-muted-foreground" data-testid="livre-alterada">Há alterações ainda não salvas: use “Atualizar análise”.</p>}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="outline" onClick={() => void livre.gerarPdf()} disabled={!temResultado || livre.gerando} className="gap-1.5">
                  {livre.gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF desta análise
                </Button>
                <Button variant="outline" onClick={() => void baixarImagem()} disabled={!temPontosMarcados || baixando} className="gap-1.5">
                  {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} Baixar imagem
                </Button>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={livre.comFoto} onChange={(e) => livre.setComFoto(e.target.checked)} /> Incluir a foto com as marcações</label>
              </div>
              {!paciente && temResultado && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo para salvar no prontuário. A análise e o PDF funcionam sem paciente.</p>}
              {paciente && !temResultado && <p className="text-[11px] text-muted-foreground">Complete uma medida para poder salvar.</p>}
              {livre.outroPaciente && (
                <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                  Esta análise já foi salva em outro paciente. Para salvar neste paciente, comece uma nova análise livre.
                </p>
              )}
            </div>

            <p className="px-1 text-[11px] leading-snug text-muted-foreground">
              Estimativa por foto: o app mede os pontos que você marcou, no plano da imagem. Sem a referência de nível, os ângulos usam a horizontal e a vertical da foto: com a câmera torta, os desníveis saem errados. Serve para acompanhar a evolução entre fotos feitas do mesmo jeito; não define diagnóstico.
            </p>
          </aside>
        )}
      </div>

      {cameraAberta && (
        <CameraNivel
          onFechar={() => setCameraAberta(false)} posicao="Análise livre" instrucao={INSTRUCAO_DA_POSICAO.livre}
          onCapturar={(arquivo, inclinacao) => { void livre.aplicarFoto(arquivo, inclinacao); setCameraAberta(false); }} />
      )}
    </div>
  );
}
