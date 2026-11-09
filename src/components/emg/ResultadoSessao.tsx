import { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { ContracaoResumo, ResultadoEtapa, ResumoSessao } from '@/lib/emg/sessao';
import { numeroPt, pctPt, uvPt } from './desenho';
import GraficoEnvelope from './GraficoEnvelope';

const NOMES_QUALIDADE = { bom: 'Boa', atencao: 'Pede atenção', ruim: 'Ruim' } as const;

function media(valores: number[]): number | null {
  return valores.length === 0 ? null : valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

interface CartaoProps {
  rotulo: string;
  valor: string;
  detalhe?: string;
  testid: string;
}

function Cartao({ rotulo, valor, detalhe, testid }: CartaoProps) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card p-3" data-testid={testid}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="break-words font-mono text-lg font-bold leading-tight tabular-nums sm:text-xl">{valor}</p>
      {detalhe && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function LinhaContracao({ c, indice }: { c: ContracaoResumo; indice: number }) {
  return (
    <li className="space-y-0.5 py-2 text-sm" data-testid="contracao">
      <p className="font-medium">
        {indice}. de {numeroPt(c.inicioS, 1)} s a {numeroPt(c.fimS, 1)} s ({numeroPt(c.duracaoS, 1)} s)
      </p>
      <p className="text-xs text-muted-foreground">
        Pico {c.picoPctCvm === null ? `${uvPt(c.picoUv)} µV` : `${pctPt(c.picoPctCvm)} % da CVM (${uvPt(c.picoUv)} µV)`} · RMS médio{' '}
        {c.rmsMedioPctCvm === null ? `${uvPt(c.rmsMedioUv)} µV` : `${pctPt(c.rmsMedioPctCvm)} % da CVM (${uvPt(c.rmsMedioUv)} µV)`}
      </p>
    </li>
  );
}

interface Props {
  resumo: ResumoSessao;
  etapas: readonly ResultadoEtapa[];
  fsHz: number;
}

function ResultadoSessao({ resumo, etapas, fsHz }: Props) {
  const cvm = resumo.cvmUv;
  const contracoes = resumo.contracoes;
  const n = contracoes.length;
  // Várias gravações de tarefa são emendadas, como a análise faz (resumirSessao).
  const sinalDaTarefa = useMemo(() => {
    const tarefas = etapas.filter((e) => e.tipo === 'tarefa');
    if (tarefas.length === 0) return null;
    if (tarefas.length === 1) return tarefas[0].amostras;
    const total = tarefas.reduce((soma, e) => soma + e.amostras.length, 0);
    const emendado = new Float64Array(total);
    let pos = 0;
    for (const e of tarefas) {
      emendado.set(e.amostras, pos);
      pos += e.amostras.length;
    }
    return emendado;
  }, [etapas]);

  const rmsMedioPct = media(contracoes.flatMap((c) => (c.rmsMedioPctCvm === null ? [] : [c.rmsMedioPctCvm])));
  const rmsMedioUv = media(contracoes.map((c) => c.rmsMedioUv));
  const picoUvMax = n === 0 ? null : Math.max(...contracoes.map((c) => c.picoUv));

  return (
    <Card className="space-y-4 p-3 sm:p-4" aria-label="Resultado da sessão">
      <div>
        <h2 className="text-base font-semibold">Resultado</h2>
        <p className="text-xs text-muted-foreground">Medida de apoio; a interpretação é sua.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Cartao
          testid="cartao-cvm"
          rotulo="CVM"
          valor={cvm === null ? '—' : `${uvPt(cvm)} µV`}
          detalhe={
            resumo.tentativasCvm === 0
              ? 'Não gravada'
              : `${resumo.tentativasCvm} ${resumo.tentativasCvm === 1 ? 'tentativa' : 'tentativas'}: ${resumo.cvmPorTentativaUv.map(uvPt).join(' · ')} µV`
          }
        />
        <Cartao
          testid="cartao-ruido"
          rotulo="Ruído basal"
          valor={resumo.ruidoBasalRmsUv === null ? '—' : `${uvPt(resumo.ruidoBasalRmsUv)} µV`}
          detalhe={
            resumo.qualidade === null
              ? 'Sem repouso gravado'
              : `RMS no trecho mais quieto do repouso. Qualidade: ${NOMES_QUALIDADE[resumo.qualidade.nivel].toLowerCase()}`
          }
        />
        <Cartao
          testid="cartao-contracoes"
          rotulo="Contrações"
          valor={resumo.linhaDeBase === null || resumo.duracaoTarefaS === 0 ? '—' : String(n)}
          detalhe={
            resumo.duracaoTarefaS === 0
              ? 'Tarefa não gravada'
              : resumo.linhaDeBase === null
                ? 'Sem repouso utilizável'
                : `em ${numeroPt(resumo.duracaoTarefaS, 1)} s de tarefa`
          }
        />
        <Cartao
          testid="cartao-pico"
          rotulo="Pico"
          valor={
            resumo.picoPctCvmMax !== null ? `${pctPt(resumo.picoPctCvmMax)} % da CVM` : picoUvMax !== null ? `${uvPt(picoUvMax)} µV` : '—'
          }
          detalhe={n === 0 ? 'Sem contrações' : resumo.picoPctCvmMax === null ? 'Sem CVM para normalizar' : 'Maior pico entre as contrações'}
        />
        <Cartao
          testid="cartao-rms-medio"
          rotulo="RMS médio"
          valor={rmsMedioPct !== null ? `${pctPt(rmsMedioPct)} % da CVM` : rmsMedioUv !== null ? `${uvPt(rmsMedioUv)} µV` : '—'}
          detalhe={n === 0 ? 'Sem contrações' : 'Média das contrações'}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Contrações detectadas</h3>
        {n === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="sem-contracoes">
            {resumo.duracaoTarefaS === 0 ? 'Grave a tarefa para detectar contrações.' : 'Nenhuma contração detectada na tarefa.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/50" data-testid="lista-contracoes">
            {contracoes.map((c, i) => (
              <LinhaContracao key={`${c.inicioS}-${i}`} c={c} indice={i + 1} />
            ))}
          </ul>
        )}
      </div>

      {sinalDaTarefa && (
        <GraficoEnvelope amostras={sinalDaTarefa} fsHz={fsHz} contracoes={contracoes} limiarUv={resumo.linhaDeBase?.limiarUv ?? null} cvmUv={cvm} />
      )}

      {resumo.avisos.length > 0 && (
        <div className="space-y-1.5 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40" data-testid="avisos-resumo">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Avisos do registro
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900 dark:text-amber-200">
            {resumo.avisos.map((aviso, i) => (
              <li key={i}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default memo(ResultadoSessao);
