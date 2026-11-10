import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { grau, variacaoTexto, type ComparacaoPosicao, type ComparacaoSessoes, type MedidaSalva } from '@/lib/angular/comparar';
import { nomeDoResultado } from '@/lib/angular/medidas';
import { NOTA_MEMBROS_SUPERIORES, type GrupoMembroSuperior } from '@/lib/angular/relatorioSessao';
import { dataDaSessao, rotuloDaSessao, type SessaoAgrupada } from '@/lib/angular/sessao';
import { ROTULO_VISTA_SESSAO, type VistaSessao } from '@/lib/angular/tiposSessao';
import type { EstadoDaAba } from '@/hooks/useSessaoPostural';
import { DICA_COMPARAR, ehMedidaParaConfirmar } from '@/components/angular/textosSessao';

export function TextoDaMedida({ m }: { m: Pick<MedidaSalva, 'id' | 'texto' | 'graus' | 'unidade'> }) {
  return (
    <>
      {m.texto ?? `${nomeDoResultado(m.id) ?? m.id}: ${grau(m.graus, m.unidade)}`}
      {ehMedidaParaConfirmar(m.id) && <span className="text-muted-foreground"> (estimativa: confirme)</span>}
    </>
  );
}

function LinhasDaPosicao({ c }: { c: ComparacaoPosicao }) {
  return (
    <div className="space-y-1.5" data-testid={`comparacao-${c.posicao}`}>
      <p className="text-xs font-semibold">{c.rotulo}</p>
      {c.situacao !== 'ambas' ? null : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Medida</th><th className="px-2 font-medium">Antes</th><th className="px-2 font-medium">Agora</th><th className="pl-2 font-medium">Variação</th></tr></thead>
            <tbody>
              {c.linhas.map((l) => (
                <tr key={l.id} className="border-t border-border/50 align-top">
                  <td className="py-1.5 pr-2">
                    {nomeDoResultado(l.id) ?? l.nome}
                    {l.explicacao && <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{l.explicacao}</span>}
                  </td>
                  <td className="px-2">{grau(l.antes?.graus, l.antes?.unidade ?? l.depois?.unidade)}{l.sentidoAntes && <span className="block text-[10px] text-muted-foreground">{l.sentidoAntes.rotulo}</span>}</td>
                  <td className="px-2">{grau(l.depois?.graus, l.depois?.unidade ?? l.antes?.unidade)}{l.sentidoDepois && <span className="block text-[10px] text-muted-foreground">{l.sentidoDepois.rotulo}</span>}</td>
                  <td className="pl-2 font-medium">{variacaoTexto(l.diferenca, l.unidade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {c.avisos.map((a) => <p key={a.texto} className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">{a.texto}</p>)}
    </div>
  );
}

/** Comparação com a avaliação anterior, posição por posição. Mostra só números, lados e avisos neutros: nada de melhor ou pior. */
export function TabelaComparacao({ comparacao }: { comparacao: ComparacaoSessoes }) {
  if (comparacao.posicoes.length === 0) return <p className="text-xs text-muted-foreground">Ainda não há medida para comparar.</p>;
  return (
    <div className="space-y-3">
      {comparacao.posicoes.map((c) => <LinhasDaPosicao key={c.posicao} c={c} />)}
      {comparacao.avisos.map((a) => <p key={a.texto} className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">{a.texto}</p>)}
      <p className="text-[11px] text-muted-foreground">O número não mostra o lado (direito ou esquerdo, anterior ou posterior, varo ou valgo, à frente ou atrás do fio): veja a leitura de cada avaliação. Se o lado mudou entre as avaliações, a variação não é calculada. {comparacao.textoNaoClassifica}</p>
    </div>
  );
}

/** Escolha da avaliação anterior: cada opção traz a data e quantas posições tem, para duas avaliações do mesmo dia não se confundirem. */
export function SeletorDeAnterior({ sessoes, valor, aoMudar, rotulo = 'Avaliação anterior' }: {
  sessoes: SessaoAgrupada[];
  /** Id escolhido; vazio = a mais recente da lista. */
  valor: string;
  aoMudar: (id: string) => void;
  rotulo?: string;
}) {
  const efetivo = valor && sessoes.some((s) => s.id === valor) ? valor : (sessoes[0]?.id ?? '');
  return (
    <select value={efetivo} onChange={(e) => aoMudar(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" aria-label={rotulo}>
      {sessoes.map((s, i) => <option key={s.id} value={s.id}>{rotuloDaSessao(s)}{i === 0 ? ' (mais recente)' : ''}</option>)}
    </select>
  );
}

export interface PosicaoDoResumo {
  posicao: VistaSessao;
  estado: EstadoDaAba;
  medidas: MedidaSalva[];
}

/**
 * Resumo da sessão: todas as posições com suas medidas, a tabela direito x esquerdo dos membros superiores, a comparação
 * com a avaliação anterior e o PDF. Também serve para uma sessão de uma posição só.
 */
export default function ResumoSessao({
  posicoes, membros, anteriores, anteriorId, anterior, comparacao, comFoto, aoMudarComFoto, aoEscolherAnterior, aoIr, aoGerarPdf, gerando, temPaciente, aoNovaSessao,
}: {
  posicoes: PosicaoDoResumo[];
  membros: GrupoMembroSuperior[];
  anteriores: SessaoAgrupada[];
  anteriorId: string;
  anterior: SessaoAgrupada | null;
  comparacao: ComparacaoSessoes | null;
  comFoto: boolean;
  aoMudarComFoto: (v: boolean) => void;
  aoEscolherAnterior: (id: string) => void;
  aoIr: (p: VistaSessao) => void;
  aoGerarPdf: () => void;
  gerando: boolean;
  temPaciente: boolean;
  /** Recomeça a sessão do zero (fotos e pontos descartados; o que foi salvo continua no prontuário). */
  aoNovaSessao?: () => void;
}) {
  const feitas = posicoes.filter((p) => p.medidas.length > 0);
  return (
    <div className="space-y-3" data-testid="resumo-sessao">
      <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
        <p className="text-sm font-semibold">Medidas da sessão</p>
        <ul className="space-y-2">
          {posicoes.map((p) => (
            <li key={p.posicao} className="rounded-xl border border-border/50 p-2.5" data-testid={`resumo-${p.posicao}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{ROTULO_VISTA_SESSAO[p.posicao]}</p>
                <span className={cn('text-[11px]', p.estado === 'salva' ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                  {p.estado === 'salva' ? 'salva ✓' : p.estado === 'pulada' ? 'pulada' : p.medidas.length ? 'não salva' : 'sem medidas'}
                </span>
              </div>
              {p.medidas.length > 0
                ? <ul className="mt-1 space-y-0.5 text-xs tabular-nums">{p.medidas.map((m) => <li key={m.id}><TextoDaMedida m={m} /></li>)}</ul>
                : <p className="mt-1 text-xs text-muted-foreground">{p.estado === 'pulada' ? 'Posição pulada nesta sessão.' : 'Ainda sem medidas nesta posição.'}</p>}
              <Button type="button" variant="ghost" size="sm" className="mt-1 h-10 px-2 text-xs" onClick={() => aoIr(p.posicao)}>
                {p.medidas.length > 0 ? 'Abrir esta posição' : 'Fazer esta posição'}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {membros.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" data-testid="tabela-membros-superiores">
          <p className="text-sm font-semibold">Membros superiores: direito e esquerdo</p>
          {membros.map((g) => (
            <div key={g.titulo} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{g.titulo}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Medida</th><th className="px-2 font-medium">Direito</th><th className="px-2 font-medium">Esquerdo</th><th className="pl-2 font-medium">Diferença (D − E)</th></tr></thead>
                  <tbody>
                    {g.linhas.map((l) => (
                      <tr key={l.nome} className="border-t border-border/50 align-top">
                        <td className="py-1.5 pr-2">{l.nome}{ehMedidaParaConfirmar(l.direito?.id ?? l.esquerdo?.id ?? '') && <span className="block text-[10px] text-muted-foreground">estimativa: confirme</span>}</td>
                        <td className="px-2">{grau(l.direito?.graus, l.direito?.unidade)}{l.direito?.sentido && <span className="block text-[10px] text-muted-foreground">{l.direito.sentido}</span>}</td>
                        <td className="px-2">{grau(l.esquerdo?.graus, l.esquerdo?.unidade)}{l.esquerdo?.sentido && <span className="block text-[10px] text-muted-foreground">{l.esquerdo.sentido}</span>}</td>
                        <td className="pl-2 font-medium">{variacaoTexto(l.diferenca, l.unidade)}{l.motivoSemDiferenca && <span className="block text-[10px] font-normal text-muted-foreground">{l.motivoSemDiferenca}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">{NOTA_MEMBROS_SUPERIORES}</p>
        </div>
      )}

      {temPaciente && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" data-testid="comparacao-sessao">
          <p className="text-sm font-semibold">Comparar com avaliação anterior</p>
          {anteriores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ainda não há avaliação anterior de análise angular em foto registrada para este paciente.</p>
          ) : (
            <>
              <SeletorDeAnterior sessoes={anteriores} valor={anteriorId} aoMudar={aoEscolherAnterior} />
              {anterior && <p className="text-[11px] text-muted-foreground">Comparando com a avaliação de {dataDaSessao(anterior.iniciadaEm) || 'data não informada'}.</p>}
              {comparacao && (feitas.length === 0 ? <p className="text-xs text-muted-foreground">Complete uma medida para comparar.</p> : <TabelaComparacao comparacao={comparacao} />)}
            </>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={aoGerarPdf} disabled={feitas.length === 0 || gerando} className="min-h-11 gap-1.5">
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Gerar PDF da sessão
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={comFoto} onChange={(e) => aoMudarComFoto(e.target.checked)} /> Incluir as fotos</label>
        </div>
        <p className="text-[11px] text-muted-foreground">{DICA_COMPARAR} Serve para acompanhar a evolução; não define diagnóstico.</p>
      </div>

      {aoNovaSessao && (
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={aoNovaSessao}>Começar uma nova sessão</Button>
      )}
    </div>
  );
}
