import { useState } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import { estiloAcento } from '@/lib/dosagem/acentos';
import { fmt, fmtTempo } from '@/lib/dosagem/calculos';
import { cargaPorPulsoUc, cicloTrabalhoPct, contracoesPorSessao, densidadeCorrenteMaCm2, periodoMs, razaoOffOn, tempoSobEstimuloS } from '@/lib/dosagem/eletro';
import { AVISO_VALIDACAO } from '@/lib/dosagem/protocolos';
import { CONDICOES_NMES, type ParamsEletro } from '@/lib/dosagem/protocolosEletro';
import type { DoseRegistrada } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, CampoNumero, condicaoInicial, FontesChips, Linha, numStr, parseNum, Secao } from './comuns';
import { CartaoCondicaoEletro, RegraIntensidade, SeletorCondicao } from './EletroComuns';
import { GraficoCard, OndaOnOff, OndaPulsos } from './Graficos';
import { RegistrarDosagem } from './RegistrarDosagem';
import { SegurancaPainel, useSeguranca } from './SegurancaPainel';
import { DoseBarraMovel, DoseHero } from './visual';

export default function DosagemNmes({ paciente, condicaoInicial: condIni }: { paciente: PacienteDosagem | null | undefined; condicaoInicial?: string | null }) {
  const [condId, setCondId] = useState(condicaoInicial(CONDICOES_NMES, condIni));
  const [freq, setFreq] = useState('');
  const [largura, setLargura] = useState('');
  const [on, setOn] = useState('');
  const [off, setOff] = useState('');
  const [rampa, setRampa] = useState('');
  const [duracao, setDuracao] = useState('');
  const [sessoes, setSessoes] = useState('');
  const [corrente, setCorrente] = useState('');
  const [area, setArea] = useState('');

  const cond = CONDICOES_NMES.find((c) => c.id === condId)!;
  const usar = (p: ParamsEletro) => {
    setFreq(numStr(p.freqHz)); setLargura(numStr(p.larguraUs)); setOn(numStr(p.onS)); setOff(numStr(p.offS));
    setRampa(numStr(p.rampaS)); setDuracao(numStr(p.duracaoMin)); setSessoes(numStr(p.sessoes)); setCorrente(numStr(p.correnteMa));
  };

  const f = parseNum(freq), w = parseNum(largura), onN = parseNum(on), offN = parseNum(off), r = parseNum(rampa);
  const d = parseNum(duracao), ses = parseNum(sessoes), i = parseNum(corrente), a = parseNum(area);
  const ciclo = onN && offN !== null ? cicloTrabalhoPct(onN, offN) : null;
  const razao = onN && offN !== null ? razaoOffOn(onN, offN) : null;
  const contr = onN && offN !== null && d ? contracoesPorSessao(d, onN, offN) : null;
  const sob = contr && onN ? tempoSobEstimuloS(contr, onN) : null;
  const carga = cargaPorPulsoUc(i ?? 0, w ?? 0);
  const dens = densidadeCorrenteMaCm2(i ?? 0, a ?? 0);
  const seg = useSeguranca('nmes', paciente);

  const dose: DoseRegistrada | null = f && onN && offN !== null && d ? {
    modalidade: 'nmes',
    condicao: cond.nome,
    titulo: `Dosagem — FES/NMES · ${cond.nome}`,
    linhas: [
      `NMES ${fmt(f, 0)} Hz${w ? `, pulso de ${fmt(w, 0)} µs` : ''}, on ${fmt(onN, 1)} s : off ${fmt(offN, 1)} s${r ? `, rampa ${fmt(r, 1)} s` : ''} (ciclo de trabalho ${fmt(ciclo, 0)}%, 1:${fmt(razao, 1)}).`,
      `${fmt(d, 0)} min: ${contr ?? '—'} contrações, ${fmtTempo(sob)} sob estímulo${ses ? `; plano de ${ses} sessão(ões)` : ''}.`,
      i ? `Intensidade ${fmt(i, 0)} mA${a ? ` em eletrodo de ${fmt(a, 0)} cm² (${fmt(dens, 2)} mA/cm²)` : ''}.` : 'Intensidade: a maior que o paciente tolerar, com contração visível.',
    ],
    parametros: { freq_hz: f, largura_us: w, on_s: onN, off_s: offN, rampa_s: r, duracao_min: d, sessoes: ses, corrente_ma: i, area_cm2: a, ciclo_pct: ciclo, contracoes: contr, tempo_sob_estimulo_s: sob },
    referencias: [...cond.fontes, 'maffiuletti2013', 'doucet2012'],
  } : null;

  return (
    <div style={estiloAcento('nmes')} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <DoseBarraMovel modalidade="nmes" rotulo="Contrações por sessão" valor={contr !== null ? String(contr) : '—'} nota={ciclo !== null ? `ciclo ${fmt(ciclo, 0)}%` : undefined} />
        <Secao numero={1} titulo="Aplicação">
          <SeletorCondicao condicoes={CONDICOES_NMES} valor={condId} onChange={setCondId} />
          <CartaoCondicaoEletro cond={cond} onUsar={usar} />
        </Secao>

        <Secao numero={2} titulo="Parâmetros">
          <RegraIntensidade fontes={['maffiuletti2013', 'doucet2012']}>
            Use a maior intensidade que o paciente tolerar, com contração visível. O torque evocado é o principal determinante da eficácia — e quase nenhum ensaio o relata; se puder medir, anote.
          </RegraIntensidade>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero id="n-f" label="Frequência" unidade="Hz" valor={freq} onChange={setFreq} />
            <CampoNumero id="n-w" label="Largura de pulso" unidade="µs" valor={largura} onChange={setLargura} />
            <CampoNumero id="n-on" label="Tempo ON" unidade="s" valor={on} onChange={setOn} />
            <CampoNumero id="n-off" label="Tempo OFF" unidade="s" valor={off} onChange={setOff} />
            <CampoNumero id="n-r" label="Rampa" unidade="s" valor={rampa} onChange={setRampa} dica="1–3 s são comuns." />
            <CampoNumero id="n-d" label="Duração da sessão" unidade="min" valor={duracao} onChange={setDuracao} />
            <CampoNumero id="n-s" label="Sessões (plano)" valor={sessoes} onChange={setSessoes} />
            <CampoNumero id="n-i" label="Corrente (opcional)" unidade="mA" valor={corrente} onChange={setCorrente} />
            <CampoNumero id="n-a" label="Área do eletrodo (opcional)" unidade="cm²" valor={area} onChange={setArea} className="col-span-2" />
          </div>
          {f !== null && f < 16 && (
            <Aviso tom="atencao" icone={<TriangleAlert className="h-4 w-4" />}>Abaixo de 16 Hz, a estimulação não bastou para levar o joelho a 40° no estudo revisado. A maioria dos regimes clínicos usa 20–50 Hz.<FontesChips ids={['doucet2012']} className="mt-1.5" /></Aviso>
          )}
          {f !== null && f >= 16 && f < 20 && (
            <Aviso icone={<Info className="h-4 w-4" />}>A maioria dos regimes clínicos usa 20–50 Hz.<FontesChips ids={['doucet2012']} className="mt-1.5" /></Aviso>
          )}
        </Secao>

        <SegurancaPainel modalidade="nmes" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <DoseHero modalidade="nmes" rotulo="Contrações por sessão" valor={contr !== null ? String(contr) : '—'}
          detalhe={ciclo !== null ? `on:off 1:${fmt(razao, 1)} · ciclo de ${fmt(ciclo, 0)}% · ${fmtTempo(sob)} sob estímulo` : 'Informe on, off e duração'} />

        {onN && offN !== null && (
          <GraficoCard titulo="Ciclo de contração" legenda="Desenho proporcional ao ciclo. A revisão cita o ciclo de 1:3 como padrão em aplicações clínicas comuns.">
            <OndaOnOff onS={onN} offS={offN} rampaS={r ?? 0} />
          </GraficoCard>
        )}
        {f && w && (
          <GraficoCard titulo="Pulsos dentro do ON" legenda="Esquema fora de escala.">
            <OndaPulsos bifasico larguraTxt={`${fmt(w, 0)} µs`} periodoTxt={`${fmt(periodoMs(f), 1)} ms · ${fmt(f, 0)} Hz`} />
          </GraficoCard>
        )}

        <Secao titulo="Em números">
          <Linha rotulo="Ciclo de trabalho" valor={ciclo !== null ? `${fmt(ciclo, 0)}%` : '—'} />
          <Linha rotulo="Tempo sob estímulo" valor={fmtTempo(sob)} />
          <Linha rotulo="Carga por fase" valor={carga ? `${fmt(carga, 2)} µC` : '—'} dica={i && w ? 'corrente × largura' : 'informe corrente e largura'} />
          <Linha rotulo="Densidade de corrente" valor={dens ? `${fmt(dens, 2)} mA/cm²` : '—'} dica={a ? undefined : 'informe a área do eletrodo'} />
        </Secao>

        <Aviso tom="neutro" icone={<Info className="h-4 w-4" />} titulo="O que as revisões dizem">
          Na NMES, o exercício voluntário parece mais eficaz na maioria das situações, e a NMES faz sentido contra não fazer exercício. Em pós-artroplastia, muitos desfechos não atingiram a diferença clinicamente importante.
          <FontesChips ids={['bax2005', 'peng2021']} className="mt-1.5" />
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
