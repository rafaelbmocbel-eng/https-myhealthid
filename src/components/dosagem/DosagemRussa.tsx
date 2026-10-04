import { useState } from 'react';
import { Info } from 'lucide-react';
import { estiloAcento } from '@/lib/dosagem/acentos';
import { fmt, fmtTempo } from '@/lib/dosagem/calculos';
import { cicloBurstPct, cicloTrabalhoPct, ciclosPorBurst, contracoesPorSessao, periodoMs, tempoSobEstimuloS } from '@/lib/dosagem/eletro';
import { AVISO_VALIDACAO } from '@/lib/dosagem/protocolos';
import { CONDICOES_RUSSA, type ParamsEletro } from '@/lib/dosagem/protocolosEletro';
import type { DoseRegistrada } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, CampoNumero, FontesChips, Linha, numStr, parseNum, Secao } from './comuns';
import { CartaoCondicaoEletro, RegraIntensidade, SeletorCondicao } from './EletroComuns';
import { GraficoCard, OndaBursts, OndaOnOff } from './Graficos';
import { RegistrarDosagem } from './RegistrarDosagem';
import { SegurancaPainel, useSeguranca } from './SegurancaPainel';
import { DoseBarraMovel, DoseHero } from './visual';

export default function DosagemRussa({ paciente }: { paciente: PacienteDosagem | null | undefined }) {
  const [condId, setCondId] = useState(CONDICOES_RUSSA[0].id);
  const [portadora, setPortadora] = useState('');
  const [burst, setBurst] = useState('');
  const [duracaoBurst, setDuracaoBurst] = useState('');
  const [on, setOn] = useState('');
  const [off, setOff] = useState('');
  const [duracao, setDuracao] = useState('');
  const [sessoes, setSessoes] = useState('');
  const [corrente, setCorrente] = useState('');

  const cond = CONDICOES_RUSSA.find((c) => c.id === condId)!;
  const usar = (p: ParamsEletro) => {
    setPortadora(numStr(p.portadoraHz)); setBurst(numStr(p.burstHz)); setOn(numStr(p.onS)); setOff(numStr(p.offS));
    setDuracao(numStr(p.duracaoMin)); setSessoes(numStr(p.sessoes)); setCorrente(numStr(p.correnteMa));
  };

  const pt = parseNum(portadora), b = parseNum(burst), db = parseNum(duracaoBurst), onN = parseNum(on), offN = parseNum(off);
  const d = parseNum(duracao), ses = parseNum(sessoes), i = parseNum(corrente);
  const perB = b ? periodoMs(b) : null;
  const cicloB = b && db ? cicloBurstPct(b, db) : null;
  const cpb = pt && db ? ciclosPorBurst(pt, db) : null;
  const cicloOn = onN && offN !== null ? cicloTrabalhoPct(onN, offN) : null;
  const contr = onN && offN !== null && d ? contracoesPorSessao(d, onN, offN) : null;
  const sob = contr && onN ? tempoSobEstimuloS(contr, onN) : null;
  const seg = useSeguranca('russa', paciente);
  const burstLongo = db !== null && db > 4;
  const burstInvalido = b && db && cicloB === null;

  const dose: DoseRegistrada | null = pt && b && d ? {
    modalidade: 'russa',
    condicao: cond.nome,
    titulo: `Dosagem — Corrente russa · ${cond.nome}`,
    linhas: [
      `Russa: portadora ${fmt(pt, 0)} Hz, burst ${fmt(b, 0)} Hz${db ? ` com ${fmt(db, 1)} ms (ciclo do burst ${fmt(cicloB, 0)}%; ${fmt(cpb, 0)} ciclos da portadora por burst)` : ''}.`,
      onN && offN !== null ? `On ${fmt(onN, 1)} s : off ${fmt(offN, 1)} s (ciclo de ${fmt(cicloOn, 0)}%); ${fmt(d, 0)} min: ${contr ?? '—'} contrações, ${fmtTempo(sob)} sob estímulo${ses ? `; ${ses} sessão(ões)` : ''}.` : `${fmt(d, 0)} min${ses ? `; ${ses} sessão(ões)` : ''}.`,
      i ? `Intensidade ${fmt(i, 0)} mA.` : 'Intensidade: a maior que o paciente tolerar, com contração visível.',
    ],
    parametros: { portadora_hz: pt, burst_hz: b, duracao_burst_ms: db, ciclo_burst_pct: cicloB, ciclos_portadora_por_burst: cpb, on_s: onN, off_s: offN, duracao_min: d, sessoes: ses, corrente_ma: i, contracoes: contr },
    referencias: [...cond.fontes, 'vaz2017'],
  } : null;

  return (
    <div style={estiloAcento('russa')} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <DoseBarraMovel modalidade="russa" rotulo={db ? 'Duração do burst' : 'Período do burst'} valor={db ? fmt(db, 1) : perB ? fmt(perB, 1) : '—'} unidade="ms" nota={cpb ? `${fmt(cpb, 0)} ciclos por burst` : undefined} />
        <Secao numero={1} titulo="Origem e evidência">
          <SeletorCondicao condicoes={CONDICOES_RUSSA} valor={condId} onChange={setCondId} />
          <CartaoCondicaoEletro cond={cond} onUsar={usar} />
        </Secao>

        <Secao numero={2} titulo="Parâmetros">
          <RegraIntensidade fontes={['akinoglu2020', 'hasan2024']}>
            Nos ensaios, a intensidade foi levada até a tolerância: 70% do limiar máximo de dor tolerado em um, 7/10 na escala de dor em outro. Anote o que o seu paciente tolerou.
          </RegraIntensidade>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero id="r-pt" label="Portadora" unidade="Hz" valor={portadora} onChange={setPortadora} dica="2500 Hz = 2,5 kHz." />
            <CampoNumero id="r-b" label="Frequência de burst" unidade="Hz" valor={burst} onChange={setBurst} />
            <CampoNumero id="r-db" label="Duração do burst (opcional)" unidade="ms" valor={duracaoBurst} onChange={setDuracaoBurst} className="col-span-2" dica="Os ensaios lidos não informam este valor; Ward sugere bursts retangulares de 2–4 ms." />
            <CampoNumero id="r-on" label="Tempo ON" unidade="s" valor={on} onChange={setOn} />
            <CampoNumero id="r-off" label="Tempo OFF" unidade="s" valor={off} onChange={setOff} />
            <CampoNumero id="r-d" label="Duração da sessão" unidade="min" valor={duracao} onChange={setDuracao} />
            <CampoNumero id="r-s" label="Sessões (plano)" valor={sessoes} onChange={setSessoes} />
            <CampoNumero id="r-i" label="Corrente (opcional)" unidade="mA" valor={corrente} onChange={setCorrente} className="col-span-2" />
          </div>
          {burstInvalido && (
            <Aviso tom="atencao" icone={<Info className="h-4 w-4" />}>Um burst de {fmt(db, 1)} ms não cabe no período de {fmt(perB, 1)} ms a {fmt(b, 0)} Hz.</Aviso>
          )}
          {burstLongo && !burstInvalido && (
            <Aviso icone={<Info className="h-4 w-4" />}>Seu burst passa da faixa de 2–4 ms sugerida por Ward (2009), que considera subótimos os parâmetros usuais da russa.<FontesChips ids={['ward2009']} className="mt-1.5" /></Aviso>
          )}
        </Secao>

        <SegurancaPainel modalidade="russa" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <DoseHero modalidade="russa" rotulo={db ? 'Duração do burst' : 'Período do burst'} valor={db ? fmt(db, 1) : perB ? fmt(perB, 1) : '—'} unidade="ms"
          detalhe={pt && b ? `portadora ${fmt(pt / 1000, 2)} kHz · ${fmt(b, 0)} bursts/s${cpb ? ` · ${fmt(cpb, 0)} ciclos por burst` : ''}` : 'Informe portadora e frequência de burst'} />

        {pt && b && (
          <GraficoCard titulo="Bursts da portadora" legenda="Esquema fora de escala: a portadora real tem muito mais ciclos por burst.">
            <OndaBursts portadoraTxt={`portadora ${fmt(pt / 1000, 2)} kHz`} burstTxt={db ? `burst ${fmt(db, 1)} ms` : 'burst'} periodoTxt={`período ${fmt(perB, 1)} ms · ${fmt(b, 0)} Hz`} ciclo={cicloB !== null ? cicloB / 100 : 0.5} />
          </GraficoCard>
        )}
        {onN && offN !== null && (
          <GraficoCard titulo="Ciclo de contração">
            <OndaOnOff onS={onN} offS={offN} rampaS={0} />
          </GraficoCard>
        )}

        <Secao titulo="Em números">
          <Linha rotulo="Período do burst" valor={perB ? `${fmt(perB, 1)} ms` : '—'} />
          <Linha rotulo="Ciclo do burst" valor={cicloB !== null ? `${fmt(cicloB, 0)}%` : '—'} dica={db ? undefined : 'informe a duração do burst'} />
          <Linha rotulo="Ciclos da portadora por burst" valor={cpb ? fmt(cpb, 0) : '—'} />
          <Linha rotulo="Contrações por sessão" valor={contr !== null ? String(contr) : '—'} dica={cicloOn !== null ? `ciclo on:off de ${fmt(cicloOn, 0)}%` : undefined} />
          <Linha rotulo="Tempo sob estímulo" valor={fmtTempo(sob)} />
        </Secao>

        <Aviso tom="atencao" icone={<Info className="h-4 w-4" />} titulo="A literatura não favorece a russa">
          A evidência não sustenta que a corrente de kHz seja melhor que a pulsada de baixa frequência para fortalecer, e em um estudo ela teve o menor torque evocado.
          <FontesChips ids={['vaz2017', 'dasilva2015', 'dantas2015']} className="mt-1.5" />
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
