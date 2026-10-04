import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, TrendingUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  avaliarDoseLaser, faixaComprimentoOnda, fmt, fmtTempo, laserEnergiaPorPonto, laserFluencia, laserIrradiancia,
  laserTempoParaEnergia, potenciaMediaPulsada, type ModoLaser, type StatusDoseLaser,
} from '@/lib/dosagem/calculos';
import { AVISO_VALIDACAO, CONDICOES_LASER } from '@/lib/dosagem/protocolos';
import type { DoseRegistrada, EquipamentoFisio } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, CampoNumero, FontesChips, Linha, numStr, parseNum, Secao, SeletorAparelho } from './comuns';
import { estiloAcento } from '@/lib/dosagem/acentos';
import { GraficoCard, JanelaDose } from './Graficos';
import { DoseBarraMovel, DoseHero, SeloStatus } from './visual';
import { RegistrarDosagem } from './RegistrarDosagem';
import { SegurancaPainel, useSeguranca } from './SegurancaPainel';

const TOM: Record<StatusDoseLaser, 'bom' | 'atencao' | 'ruim' | 'neutro'> = {
  abaixo: 'ruim', no_minimo: 'bom', dentro: 'bom', acima: 'atencao', sem_referencia: 'neutro',
};
const ROTULO_STATUS: Record<StatusDoseLaser, string> = {
  abaixo: 'Abaixo do mínimo', no_minimo: 'Na dose de referência', dentro: 'Na faixa estudada', acima: 'Acima da faixa estudada', sem_referencia: 'Sem faixa de referência',
};
const ICONE_STATUS: Record<StatusDoseLaser, JSX.Element> = {
  abaixo: <AlertTriangle className="h-4 w-4" />, no_minimo: <CheckCircle2 className="h-4 w-4" />, dentro: <CheckCircle2 className="h-4 w-4" />,
  acima: <TrendingUp className="h-4 w-4" />, sem_referencia: <CircleHelp className="h-4 w-4" />,
};

interface Props {
  paciente: PacienteDosagem | null | undefined;
  equipamentos: EquipamentoFisio[];
  equipamentosDisponiveis: boolean;
  onGerenciarAparelhos: () => void;
}

export default function DosagemLaser({ paciente, equipamentos, equipamentosDisponiveis, onGerenciarAparelhos }: Props) {
  const [condId, setCondId] = useState(CONDICOES_LASER[0].id);
  const [equipId, setEquipId] = useState('manual');
  const [nm, setNm] = useState('810');
  const [modo, setModo] = useState<ModoLaser>('continuo');
  const [pot, setPot] = useState('');
  const [area, setArea] = useState('');
  const [entrada, setEntrada] = useState<'energia' | 'tempo'>('energia');
  const [energiaAlvo, setEnergiaAlvo] = useState('');
  const [tempo, setTempo] = useState('');
  const [pontos, setPontos] = useState('3');
  const [tecnica, setTecnica] = useState<'fixa' | 'varredura'>('fixa');
  const [pico, setPico] = useState('');
  const [largura, setLargura] = useState('');
  const [freq, setFreq] = useState('');

  const cond = CONDICOES_LASER.find((c) => c.id === condId)!;
  const eq = equipamentos.find((e) => e.id === equipId);
  const nmN = parseNum(nm);
  const faixa = nmN ? faixaComprimentoOnda(nmN) : 'outra';
  const janela = cond.janelas.find((j) => j.faixa === faixa) ?? cond.janelas.find((j) => j.faixa === 'qualquer');

  // Dose de referência para este comprimento de onda (4× em 904 nm contínuo, quando a fonte pede).
  const referenciaJ = useMemo(() => {
    if (!janela) return null;
    const fator = faixa === '904' && modo === 'continuo' && !janela.semFatorContinuo ? 4 : 1;
    return (janela.sugeridaJ ?? janela.minJ) * fator;
  }, [janela, faixa, modo]);

  // Aparelho cadastrado preenche os campos (potência medida tem prioridade).
  useEffect(() => {
    if (!eq) return;
    const s = eq.specs;
    if (s.comprimento_onda_nm) setNm(numStr(s.comprimento_onda_nm));
    if (s.modo) setModo(s.modo);
    const p = s.potencia_medida_mw ?? s.potencia_media_mw;
    if (p) setPot(numStr(p));
    if (s.area_feixe_cm2) setArea(numStr(s.area_feixe_cm2));
  }, [eq]);

  // Trocou a condição ou a faixa: leva a energia alvo para a referência.
  useEffect(() => {
    if (referenciaJ) setEnergiaAlvo(numStr(referenciaJ));
  }, [condId, referenciaJ]);

  const potN = parseNum(pot);
  const areaN = parseNum(area);
  const pontosN = Math.max(1, Math.round(parseNum(pontos) ?? 1));
  const energiaPonto = entrada === 'energia' ? parseNum(energiaAlvo) : laserEnergiaPorPonto(potN ?? 0, parseNum(tempo) ?? 0);
  const tempoPonto = entrada === 'energia' ? laserTempoParaEnergia(parseNum(energiaAlvo) ?? 0, potN ?? 0) : parseNum(tempo);
  const fluencia = laserFluencia(energiaPonto ?? 0, areaN ?? 0);
  const irradiancia = laserIrradiancia(potN ?? 0, areaN ?? 0);
  const energiaTotal = energiaPonto ? energiaPonto * pontosN : null;
  const tempoTotal = tempoPonto ? tempoPonto * pontosN : null;
  const potPulsada = potenciaMediaPulsada(parseNum(pico) ?? 0, parseNum(largura) ?? 0, parseNum(freq) ?? 0);

  const avaliacao = avaliarDoseLaser({ nm: nmN ?? 0, modo, energiaPontoJ: energiaPonto, janelas: cond.janelas });
  const seg = useSeguranca('laser', paciente);

  const dose: DoseRegistrada | null = energiaPonto && potN && nmN && tempoPonto ? {
    modalidade: 'laser',
    condicao: cond.nome,
    titulo: `Dosagem — Laser · ${cond.nome}`,
    linhas: [
      `Laser ${fmt(nmN, 0)} nm, ${modo === 'continuo' ? 'contínuo' : 'pulsado'}, potência média ${fmt(potN, 1)} mW.`,
      `${fmtTempo(tempoPonto)} por ponto → ${fmt(energiaPonto)} J por ponto${fluencia ? ` (${fmt(fluencia)} J/cm² em feixe de ${fmt(areaN)} cm²)` : ''}.`,
      `${pontosN} ponto(s): energia total ${fmt(energiaTotal)} J, tempo total ${fmtTempo(tempoTotal)}. Técnica: ${tecnica === 'fixa' ? 'ponteira fixa em contato' : 'varredura (ponteira em movimento)'}.`,
      `Comparação com a literatura: ${avaliacao.mensagem}`,
    ],
    parametros: { nm: nmN, modo, potencia_mw: potN, area_cm2: areaN, energia_ponto_j: energiaPonto, tempo_ponto_s: tempoPonto, pontos: pontosN, energia_total_j: energiaTotal, fluencia_j_cm2: fluencia, tecnica, status_literatura: avaliacao.status },
    equipamento: eq ? `${eq.nome}${eq.modelo ? ` (${eq.modelo})` : ''}${eq.specs.potencia_medida_mw ? ' — potência medida' : ''}` : undefined,
    referencias: [...cond.fontes, ...avaliacao.fontes, 'jenkins2011'],
  } : null;

  return (
    <div style={estiloAcento('laser')} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <DoseBarraMovel modalidade="laser" rotulo="Energia por ponto" valor={energiaPonto ? fmt(energiaPonto) : '—'} unidade="J" nota={ROTULO_STATUS[avaliacao.status]} />
        <Secao numero={1} titulo="Condição">
          <Select value={condId} onValueChange={setCondId}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{CONDICOES_LASER.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
          <div className="rounded-xl bg-muted/40 p-3 space-y-2">
            <p className="text-xs leading-relaxed">{cond.resumo}</p>
            {cond.janelas.length > 0 && (
              <ul className="space-y-0.5 text-xs">
                {cond.janelas.map((j) => (
                  <li key={j.faixa} className="flex items-baseline gap-1.5">
                    <span className="font-semibold">{j.faixa === '904' ? '904 nm' : j.faixa === '780-860' ? '780–860 nm' : 'Vermelho / infravermelho'}:</span>
                    <span className="tabular-nums">{j.maxJ !== undefined ? `${j.minJ}–${j.maxJ} J` : `mínimo ${j.minJ} J`} por ponto</span>
                  </li>
                ))}
              </ul>
            )}
            {cond.semDose && <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Sem dose por ponto confirmada nas fontes lidas. Você pode calcular e registrar a sua dose mesmo assim.</p>}
            {cond.aplicacao && <ul className="list-disc pl-4 text-[11.5px] text-muted-foreground space-y-0.5">{cond.aplicacao.map((a) => <li key={a}>{a}</li>)}</ul>}
            <FontesChips ids={[...cond.fontes, ...cond.janelas.flatMap((j) => j.fontes)]} />
          </div>
        </Secao>

        <Secao numero={2} titulo="Aparelho e parâmetros">
          <SeletorAparelho itens={equipamentos} valor={equipId} onChange={setEquipId} disponivel={equipamentosDisponiveis} onGerenciar={onGerenciarAparelhos} />
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero id="l-nm" label="Comprimento de onda" unidade="nm" valor={nm} onChange={setNm} />
            <div className="space-y-1">
              <Label className="text-xs font-medium">Modo</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as ModoLaser)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuo">Contínuo</SelectItem>
                  <SelectItem value="pulsado">Pulsado / superpulsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CampoNumero id="l-pot" label="Potência média" unidade="mW" valor={pot} onChange={setPot}
              dica={eq?.specs.potencia_medida_mw ? 'Usando a potência MEDIDA do cadastro.' : 'Use a potência medida na saída da ponteira, não a do rótulo.'} />
            <CampoNumero id="l-area" label="Área do feixe na pele" unidade="cm²" valor={area} onChange={setArea} dica="Não é, necessariamente, a área da janela da ponteira." />
          </div>

          {modo === 'pulsado' && (
            <details className="rounded-xl border border-border/60 p-3 text-xs">
              <summary className="cursor-pointer font-medium">Só tenho a potência de pico? Calcular a média</summary>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <CampoNumero id="l-pico" label="Pico" unidade="mW" valor={pico} onChange={setPico} />
                <CampoNumero id="l-larg" label="Largura" unidade="ns" valor={largura} onChange={setLargura} />
                <CampoNumero id="l-freq" label="Frequência" unidade="Hz" valor={freq} onChange={setFreq} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="tabular-nums">Potência média: <strong>{potPulsada ? `${fmt(potPulsada, 2)} mW` : '—'}</strong></p>
                <button type="button" disabled={!potPulsada} onClick={() => potPulsada && setPot(numStr(Math.round(potPulsada * 100) / 100))}
                  className="font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline">Usar como potência média</button>
              </div>
            </details>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">Como definir a dose por ponto</Label>
              <div className="inline-flex rounded-lg bg-muted p-0.5 text-[11px] font-medium">
                {(['energia', 'tempo'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setEntrada(k)}
                    className={cn('rounded-md px-2.5 py-1', entrada === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                    {k === 'energia' ? 'Pela energia (J)' : 'Pelo tempo (s)'}
                  </button>
                ))}
              </div>
            </div>
            {entrada === 'energia' ? (
              <CampoNumero id="l-alvo" label="Energia por ponto" unidade="J" valor={energiaAlvo} onChange={setEnergiaAlvo}
                dica={referenciaJ ? `Referência para este comprimento de onda: ${fmt(referenciaJ, 1)} J por ponto.` : 'Sem referência para este comprimento de onda; defina a sua dose.'} />
            ) : (
              <CampoNumero id="l-tempo" label="Tempo por ponto" unidade="s" valor={tempo} onChange={setTempo}
                dica={referenciaJ && potN ? `Para ${fmt(referenciaJ, 1)} J seriam ${fmtTempo(laserTempoParaEnergia(referenciaJ, potN))} por ponto.` : undefined} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CampoNumero id="l-pontos" label="Número de pontos" valor={pontos} onChange={setPontos} dica="Em tendinopatia: 2–3 pontos sobre o tendão." />
            <div className="space-y-1">
              <Label className="text-xs font-medium">Técnica</Label>
              <Select value={tecnica} onValueChange={(v) => setTecnica(v as 'fixa' | 'varredura')}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">Ponteira fixa, em contato</SelectItem>
                  <SelectItem value="varredura">Varredura (em movimento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {tecnica === 'varredura' && (
            <Aviso tom="atencao" icone={<Info className="h-4 w-4" />}>Mover a ponteira reduz a dose por cm² tratado. As faixas da literatura são por ponto, com a ponteira parada.</Aviso>
          )}
        </Secao>

        <SegurancaPainel modalidade="laser" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <DoseHero modalidade="laser" rotulo="Energia por ponto" valor={energiaPonto ? fmt(energiaPonto) : '—'} unidade="J"
          detalhe={energiaPonto ? `${fmtTempo(tempoPonto)} por ponto${fluencia ? ` · ${fmt(fluencia)} J/cm²` : ''}` : 'Informe potência e dose'}>
          <SeloStatus tom={TOM[avaliacao.status]} icone={ICONE_STATUS[avaliacao.status]}>{ROTULO_STATUS[avaliacao.status]}</SeloStatus>
        </DoseHero>

        {avaliacao.status !== 'sem_referencia' && avaliacao.minJ !== undefined && (
          <GraficoCard titulo="Onde a sua dose cai" legenda={<>{avaliacao.mensagem}{avaliacao.fator === 4 && ' Em 904 nm contínuo, a referência é 4× a do superpulsado.'}</>}>
            <JanelaDose min={avaliacao.minJ} max={avaliacao.maxJ} valor={energiaPonto} tom={TOM[avaliacao.status]} />
            <FontesChips ids={avaliacao.fontes} className="mt-2" />
          </GraficoCard>
        )}
        {avaliacao.status === 'sem_referencia' && (
          <Aviso tom="neutro" icone={<CircleHelp className="h-4 w-4" />} titulo="Sem faixa de referência">{avaliacao.mensagem}</Aviso>
        )}

        <Secao titulo="Em números">
          <Linha rotulo="Densidade de energia" valor={fluencia ? `${fmt(fluencia)} J/cm²` : '—'} dica={areaN ? undefined : 'Informe a área do feixe'} />
          <Linha rotulo="Irradiância" valor={irradiancia ? `${fmt(irradiancia, 1)} mW/cm²` : '—'} />
          <Linha rotulo={`Total em ${pontosN} ponto${pontosN > 1 ? 's' : ''}`} valor={energiaTotal ? `${fmt(energiaTotal)} J${tempoTotal ? ` · ${fmtTempo(tempoTotal)}` : ''}` : '—'} />
        </Secao>

        <Aviso icone={<Info className="h-4 w-4" />}>
          Registre sempre: comprimento de onda, potência, tempo, área do feixe, pulso, local, número de sessões e intervalo. A potência cai com o aquecimento e com a idade do aparelho; meça-a de tempos em tempos.
          <FontesChips ids={['jenkins2011', 'walt2022']} className="mt-1.5" />
        </Aviso>

        <Secao titulo="Registrar">
          <RegistrarDosagem paciente={paciente ?? null} dose={dose} segurancaPronta={seg.pronto}
            motivoBloqueio={!seg.conferido ? 'Marque que conferiu as contraindicações.' : 'Confirme os alertas encontrados no prontuário.'} />
        </Secao>
        <p className="px-1 text-[10.5px] leading-snug text-muted-foreground">{AVISO_VALIDACAO}</p>
      </aside>
    </div>
  );
}
