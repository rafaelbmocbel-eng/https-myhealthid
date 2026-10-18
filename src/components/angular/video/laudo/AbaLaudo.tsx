import { useMemo, useState } from 'react';
import { Copy, FileDown, FlaskConical, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { baixarBlob } from '@/lib/pdf/entrega';
import { notaMedidasForaDoTrecho } from '@/lib/angular/analiseVideo/medidaManual';
import { INTRO_INDISPONIVEIS, maisOuMenos, TEXTO_SEM_INDISPONIVEIS, TITULOS } from '@/lib/angular/movimento/frases';
import type { ContextoLaudo, EventoPasso, IdProtocolo, LaudoMovimento, PlanoCamera, Protocolo } from '@/lib/angular/movimento/tipos';
import type { TrilhaPose } from '@/lib/angular/video/tipos';
import Disclosure from './Disclosure';
import EditorCriterios from './EditorCriterios';
import ListaAchados from './ListaAchados';
import SeletorProtocolo from './SeletorProtocolo';
import TabelaRepeticoes from './TabelaRepeticoes';
import TabelaTexto from './TabelaTexto';
import { resumoDoLaudoEmTexto } from './resumoTexto';
import { useAnaliseMovimento } from './useAnaliseMovimento';
import type { EstadoLaudo } from './useEstadoLaudo';

export const AVISO_BETA_LAUDO = 'Protótipo (beta) · apoio à avaliação do profissional · não é diagnóstico';

export interface PropsAbaLaudo {
  estado: EstadoLaudo;
  /** Vista que o profissional declarou ao escolher o gesto. */
  vistaDeclarada: PlanoCamera;
  /** Trilha atual, com as correções do profissional; null enquanto o corpo não foi rastreado. */
  trilha: TrilhaPose | null;
  escalaCmPorPixel: number | null;
  /** Marcha: eventos conferidos na aba Eventos; null deixa o motor detectar. */
  eventos: EventoPasso[] | null;
  direcao: 1 | -1;
  video: { nome: string; duracaoS?: number; largura?: number; altura?: number };
  trecho?: { inicio: number; fim: number };
  quadrosChaveCorrigidos: number;
  /** Medidas manuais em instantes fora do trecho: não entram no laudo, que traz a nota. */
  medidasManuaisForaDoTrecho: number;
  paciente?: string;
  profissional?: string;
  /** AAAA-MM-DD; sem ele vale o dia de hoje (fuso de São Paulo). */
  data?: string;
  /** Pontos de troca para os testes: o PDF é gerado sob demanda (jsPDF fora do pacote principal) e baixado pelo navegador. */
  gerarPdf?: (laudo: LaudoMovimento) => Promise<Blob>;
  baixar?: (blob: Blob, nome: string) => void;
}

export function hojeIso(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export const nomeArquivoLaudo = (protocolo: IdProtocolo, data: string): string => `laudo-${protocolo.replace(/_/g, '-')}-${data}.pdf`;

const gerarPdfSobDemanda = async (laudo: LaudoMovimento): Promise<Blob> => (await import('@/lib/angular/movimento/laudoPdf')).gerarPdfLaudo(laudo);

const botao = 'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45';

function Aviso({ children, testid }: { children: string; testid?: string }) {
  return <p className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs leading-snug text-muted-foreground" data-testid={testid}>{children}</p>;
}

interface CalculadoProps extends Omit<PropsAbaLaudo, 'trilha' | 'vistaDeclarada'> {
  trilha: TrilhaPose;
  protocolo: Protocolo;
}

// Os hooks ficam aqui, num componente que só existe com trilha e protocolo: a casca (AbaLaudo) decide o que mostrar sem hooks depois de retorno antecipado.
function LaudoCalculado({
  estado, protocolo, trilha, escalaCmPorPixel, eventos, direcao, video, trecho, quadrosChaveCorrigidos, medidasManuaisForaDoTrecho, paciente, profissional, data, gerarPdf = gerarPdfSobDemanda, baixar = baixarBlob,
}: CalculadoProps) {
  const [gerando, setGerando] = useState(false);
  const dia = useMemo(() => data ?? hojeIso(), [data]);
  const trechoInicio = trecho?.inicio, trechoFim = trecho?.fim;
  const contexto = useMemo<Omit<ContextoLaudo, 'criterios'>>(
    () => ({
      video: { nome: video.nome, duracaoS: video.duracaoS, largura: video.largura, altura: video.altura },
      data: dia, taxaEfetivaFps: trilha.fps, quadrosChaveCorrigidos, medidasManuaisForaDoTrecho, responsavelRevisao: '',
      ...(trechoInicio !== undefined && trechoFim !== undefined ? { trecho: { inicio: trechoInicio, fim: trechoFim } } : {}),
      ...(paciente ? { paciente } : {}), ...(profissional ? { profissional } : {}),
    }),
    [video.nome, video.duracaoS, video.largura, video.altura, dia, trilha.fps, trechoInicio, trechoFim, quadrosChaveCorrigidos, medidasManuaisForaDoTrecho, paciente, profissional],
  );
  const { analise, laudo, atualizando } = useAnaliseMovimento({ protocolo, trilha, criterios: estado.criterios, escalaCmPorPixel, eventos, direcao, contexto });

  const baixarPdf = async () => {
    setGerando(true);
    try {
      baixar(await gerarPdf(laudo), nomeArquivoLaudo(protocolo.id, dia));
      toast.success('Laudo em PDF gerado.');
    } catch {
      toast.error('Não consegui gerar o PDF do laudo.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumoDoLaudoEmTexto(laudo));
      toast.success('Resumo copiado.');
    } catch {
      toast.error('Não consegui copiar.');
    }
  };

  const notaFora = notaMedidasForaDoTrecho(medidasManuaisForaDoTrecho, 'relatório');
  const metodoTabelas = laudo.metodo.tabelas;

  return (
    <div className="space-y-4" aria-busy={atualizando} data-testid="laudo-calculado">
      {atualizando && <p className="text-xs text-muted-foreground" role="status">Atualizando o laudo com as últimas correções…</p>}

      <section className="space-y-2" aria-labelledby="laudo-resumo-titulo" data-testid="resumo-do-laudo">
        <h3 id="laudo-resumo-titulo" className="text-sm font-semibold">{laudo.resumo.titulo}</h3>
        <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card p-3 text-xs leading-snug">
          {laudo.resumo.paragrafos.map((p) => <p key={p}>{p}</p>)}
          <p className="text-muted-foreground">
            {analise.incerteza.angularGraus === null
              ? 'Incerteza angular não estimada neste vídeo (amostras insuficientes).'
              : `Incerteza angular estimada neste vídeo: ${maisOuMenos(analise.incerteza.angularGraus, '°')} (fórmula em Método).`}
          </p>
        </div>
      </section>

      <ListaAchados laudo={laudo} />

      <TabelaRepeticoes analise={analise} protocolo={protocolo} />

      <EditorCriterios protocolo={protocolo} criterios={estado.criterios} aoAtualizar={estado.mudarCriterios} analise={analise} profissional={profissional} />

      <section className="space-y-2" aria-labelledby="laudo-indisponiveis-titulo" data-testid="achados-indisponiveis">
        <h3 id="laudo-indisponiveis-titulo" className="text-sm font-semibold">{TITULOS.indisponiveis} ({analise.indisponiveis.length})</h3>
        {analise.indisponiveis.length === 0 ? <Aviso>{TEXTO_SEM_INDISPONIVEIS}</Aviso> : (
          <>
            <p className="text-xs leading-snug text-muted-foreground">{INTRO_INDISPONIVEIS}</p>
            <ul className="space-y-2">
              {analise.indisponiveis.map((i) => (
                <li key={i.chave} className="space-y-1 rounded-2xl border border-border/60 bg-card p-3" data-testid="achado-indisponivel">
                  <p className="text-sm font-semibold leading-snug">{i.titulo}</p>
                  <p className="text-xs leading-snug">{i.motivo}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{i.comoObter}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Disclosure titulo={laudo.metodo.titulo} resumo="Como as repetições são identificadas, como a incerteza é estimada e quais regras disparam um achado" testid="metodo-do-laudo">
        <div className="space-y-2 text-xs leading-snug">
          {laudo.metodo.paragrafos.map((p) => <p key={p}>{p}</p>)}
          {laudo.metodo.itens.length > 0 && <ul className="space-y-1">{laudo.metodo.itens.map((i) => <li key={i}>• {i}</li>)}</ul>}
          {metodoTabelas.map((t) => <TabelaTexto key={t.titulo ?? t.colunas.join('|')} tabela={t} />)}
        </div>
      </Disclosure>

      <section className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" aria-labelledby="laudo-limitacoes-titulo" data-testid="limitacoes-do-laudo">
        <h3 id="laudo-limitacoes-titulo" className="text-sm font-semibold">{laudo.limitacoes.titulo}</h3>
        <ul className="space-y-1.5 text-xs leading-snug">{laudo.limitacoes.itens.map((l) => <li key={l}>• {l}</li>)}</ul>
      </section>

      <section className="space-y-2" aria-labelledby="laudo-saidas-titulo">
        <h3 id="laudo-saidas-titulo" className="text-sm font-semibold">Saídas do laudo</h3>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <button type="button" onClick={baixarPdf} disabled={gerando || atualizando} data-testid="baixar-laudo" className={cn(botao, 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/92')}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />} Baixar laudo (PDF)
          </button>
          <button type="button" onClick={copiar} disabled={atualizando} data-testid="copiar-resumo-laudo" className={cn(botao, 'border-border/60 bg-card hover:bg-muted/50')}>
            <Copy className="h-4 w-4" aria-hidden /> Copiar resumo
          </button>
        </div>
        {notaFora && <p className="text-[11px] leading-snug text-muted-foreground" data-testid="nota-medidas-fora">{notaFora}</p>}
        <p className="flex items-start gap-1.5 rounded-xl bg-muted/40 p-2.5 text-[11px] leading-snug text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Tudo é calculado neste aparelho: o vídeo não é enviado e nenhum modelo de linguagem escreve o laudo. O texto vem de modelos de frase e da biblioteca de hipóteses com fonte. O PDF leva só texto, tabelas e gráficos de ângulo, sem imagem do paciente. O campo de responsável pela revisão sai em branco para o profissional preencher.</span>
        </p>
      </section>
    </div>
  );
}

// Aba "Laudo (beta)": apoio à avaliação biomecânica feita pelo profissional. Mede, descreve e lista hipóteses com fonte; não treina, não dá nota e não diagnostica.
export default function AbaLaudo({ estado, vistaDeclarada, trilha, ...resto }: PropsAbaLaudo) {
  const protocolo = estado.protocolos.find((p) => p.id === estado.protocoloId) ?? null;
  return (
    <div className="min-w-0 space-y-4" data-testid="aba-laudo-conteudo">
      <h2 className="sr-only">Laudo de apoio à avaliação do movimento (beta)</h2>
      <p className="flex items-start gap-2 rounded-2xl border border-amber-500/60 bg-amber-500/10 p-3 text-xs font-medium leading-snug" role="note" data-testid="aviso-beta-laudo">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{AVISO_BETA_LAUDO}</span>
      </p>
      {!protocolo ? (
        <Aviso testid="sem-protocolo">Este gesto ainda não tem protocolo de laudo. A primeira versão cobre o agachamento (vista lateral e vista frontal) e a marcha (vista lateral). Use “Trocar” para escolher um desses gestos.</Aviso>
      ) : (
        <>
          <SeletorProtocolo protocolos={estado.protocolos} protocoloId={estado.protocoloId} vistaDeclarada={vistaDeclarada} aoEscolher={estado.escolherProtocolo} />
          {trilha
            ? <LaudoCalculado estado={estado} protocolo={protocolo} trilha={trilha} {...resto} />
            : <Aviso testid="sem-rastreio">Rastreie o corpo neste vídeo para gerar o laudo: as medidas por repetição e por lado saem da trilha de pontos.</Aviso>}
        </>
      )}
    </div>
  );
}
