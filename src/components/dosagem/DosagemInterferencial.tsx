import { useState } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { estiloAcento } from '@/lib/dosagem/acentos';
import { fmt } from '@/lib/dosagem/calculos';
import { AVISO_VALIDACAO } from '@/lib/dosagem/protocolos';
import { CONDICOES_IFC, type ParamsEletro } from '@/lib/dosagem/protocolosEletro';
import type { DoseRegistrada } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, CampoNumero, condicaoInicial, FontesChips, Linha, numStr, parseNum, Secao } from './comuns';
import { CartaoCondicaoEletro, RegraIntensidade, SeletorCondicao } from './EletroComuns';
import { GraficoCard, OndaBatimento } from './Graficos';
import { RegistrarDosagem } from './RegistrarDosagem';
import { SegurancaPainel, useSeguranca } from './SegurancaPainel';
import { DoseBarraMovel, DoseHero } from './visual';

export default function DosagemInterferencial({ paciente, condicaoInicial: condIni }: { paciente: PacienteDosagem | null | undefined; condicaoInicial?: string | null }) {
  const [condId, setCondId] = useState(condicaoInicial(CONDICOES_IFC, condIni));
  const [f1, setF1] = useState('4000');
  const [amf, setAmf] = useState('');
  const [sweep, setSweep] = useState('');
  const [polar, setPolar] = useState<'tetra' | 'bi'>('tetra');
  const [duracao, setDuracao] = useState('');
  const [sessoes, setSessoes] = useState('');
  const [corrente, setCorrente] = useState('');
  const [area, setArea] = useState('');

  const cond = CONDICOES_IFC.find((c) => c.id === condId)!;
  const usar = (p: ParamsEletro) => {
    if (p.portadoraHz) setF1(numStr(p.portadoraHz));
    setAmf(numStr(p.amfHz)); setDuracao(numStr(p.duracaoMin)); setSessoes(numStr(p.sessoes)); setCorrente(numStr(p.correnteMa));
  };

  const f1N = parseNum(f1), amfN = parseNum(amf), swN = parseNum(sweep), d = parseNum(duracao), ses = parseNum(sessoes), i = parseNum(corrente);
  const f2 = f1N && amfN ? f1N + amfN : null;
  const faixaAmf = amfN ? (swN ? `${fmt(amfN, 0)}–${fmt(amfN + swN, 0)} Hz` : `${fmt(amfN, 0)} Hz`) : null;
  const carrierFora = f1N !== null && (f1N <= 1000 || f1N >= 10000);
  const amfFora = amfN !== null && amfN > 250;
  const seg = useSeguranca('interferencial', paciente);

  const dose: DoseRegistrada | null = f1N && amfN && d ? {
    modalidade: 'interferencial',
    condicao: cond.nome,
    titulo: `Dosagem — Interferencial · ${cond.nome}`,
    linhas: [
      `Interferencial ${polar === 'tetra' ? 'tetrapolar' : 'bipolar'}: portadoras de ${fmt(f1N, 0)} e ${fmt(f2, 0)} Hz, batimento (AMF) de ${faixaAmf}${swN ? ` (ΔF ${fmt(swN, 0)} Hz)` : ''}.`,
      `${fmt(d, 0)} min${ses ? `, ${ses} sessão(ões)` : ''}${area ? `; eletrodos de ${fmt(parseNum(area), 0)} cm²` : ''}.`,
      i ? `Intensidade ${fmt(i, 0)} mA, ajustada para formigamento forte e confortável.` : 'Intensidade titulada para formigamento forte e confortável, sem dor.',
    ],
    parametros: { portadora_1_hz: f1N, portadora_2_hz: f2, amf_hz: amfN, delta_f_hz: swN, polaridade: polar, duracao_min: d, sessoes: ses, corrente_ma: i, area_cm2: parseNum(area) },
    referencias: [...cond.fontes, 'rampazo2022'],
  } : null;

  return (
    <div style={estiloAcento('interferencial')} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <DoseBarraMovel modalidade="interferencial" rotulo="Batimento (AMF)" valor={faixaAmf ? faixaAmf.replace(' Hz', '') : '—'} unidade="Hz" nota={f2 ? `${fmt(f1N, 0)} e ${fmt(f2, 0)} Hz` : undefined} />
        <Secao numero={1} titulo="Condição">
          <SeletorCondicao condicoes={CONDICOES_IFC} valor={condId} onChange={setCondId} />
          <CartaoCondicaoEletro cond={cond} onUsar={usar} />
        </Secao>

        <Secao numero={2} titulo="Parâmetros">
          <RegraIntensidade fontes={['rampazo2022', 'ata2024']}>
            Aumente até o paciente referir formigamento forte, mas confortável, sem dor. A maioria dos parâmetros parece não influenciar a analgesia.
          </RegraIntensidade>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero id="i-f1" label="Portadora fixa" unidade="Hz" valor={f1} onChange={setF1} dica="Entre 1 e 10 kHz; os ensaios usaram 4 kHz." />
            <CampoNumero id="i-amf" label="Batimento (AMF)" unidade="Hz" valor={amf} onChange={setAmf} dica="A diferença entre as duas correntes (0–250 Hz)." />
            <CampoNumero id="i-sw" label="Varredura ΔF (opcional)" unidade="Hz" valor={sweep} onChange={setSweep} dica="Com AMF de 100 e ΔF de 50, o batimento varia de 100 a 150 Hz." />
            <div className="space-y-1">
              <Label className="text-xs font-medium">Eletrodos</Label>
              <Select value={polar} onValueChange={(v) => setPolar(v as 'tetra' | 'bi')}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="tetra">Tetrapolar (4)</SelectItem><SelectItem value="bi">Bipolar (2)</SelectItem></SelectContent>
              </Select>
            </div>
            <CampoNumero id="i-d" label="Duração da sessão" unidade="min" valor={duracao} onChange={setDuracao} />
            <CampoNumero id="i-s" label="Sessões (plano)" valor={sessoes} onChange={setSessoes} />
            <CampoNumero id="i-i" label="Corrente (opcional)" unidade="mA" valor={corrente} onChange={setCorrente} />
            <CampoNumero id="i-a" label="Área do eletrodo (opcional)" unidade="cm²" valor={area} onChange={setArea} dica="Os ensaios usaram 5 × 5 cm." />
          </div>
          {carrierFora && <Aviso tom="atencao" icone={<TriangleAlert className="h-4 w-4" />}>A interferencial usa portadoras de média frequência, acima de 1 e abaixo de 10 kHz.<FontesChips ids={['rampazo2022']} className="mt-1.5" /></Aviso>}
          {amfFora && <Aviso tom="atencao" icone={<TriangleAlert className="h-4 w-4" />}>O batimento descrito vai de 0 a 250 Hz.<FontesChips ids={['rampazo2022']} className="mt-1.5" /></Aviso>}
          {polar === 'tetra' && <p className="text-[11px] text-muted-foreground">No modo tetrapolar a interferência acontece dentro dos tecidos, com máximo na diagonal de 45°.</p>}
        </Secao>

        <SegurancaPainel modalidade="interferencial" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <DoseHero modalidade="interferencial" rotulo="Batimento (AMF)" valor={faixaAmf ? faixaAmf.replace(' Hz', '') : '—'} unidade="Hz"
          detalhe={f1N && f2 ? `portadoras ${fmt(f1N, 0)} e ${fmt(f2, 0)} Hz${d ? ` · ${fmt(d, 0)} min` : ''}` : 'Informe a portadora e o batimento'} />

        {f1N && f2 && amfN && (
          <GraficoCard titulo="Duas correntes, um batimento" legenda="Esquema fora de escala: as portadoras reais têm milhares de ciclos por segundo.">
            <OndaBatimento f1Txt={`${fmt(f1N, 0)} Hz`} f2Txt={`${fmt(f2, 0)} Hz`} batTxt={`batimento = |f2 − f1| = ${fmt(amfN, 0)} Hz`} />
          </GraficoCard>
        )}

        <Secao titulo="Em números">
          <Linha rotulo="Segunda portadora" valor={f2 ? `${fmt(f2, 0)} Hz` : '—'} dica="portadora fixa + batimento" />
          <Linha rotulo="Batimento com varredura" valor={faixaAmf ?? '—'} />
          <Linha rotulo="Pulso" valor="125 µs" dica="valor fixo na maioria dos aparelhos" />
        </Secao>

        <Aviso tom="atencao" icone={<Info className="h-4 w-4" />} titulo="Evidência mista">
          A primeira revisão sistemática concluiu que, sozinha, a interferencial não foi melhor que placebo ou outra terapia; em dor de ombro não foi eficaz; em osteoartrite de joelho houve alívio de dor na meta-análise.
          <FontesChips ids={['fuentes2010', 'yu2015', 'chen2022']} className="mt-1.5" />
        </Aviso>
        <Aviso tom="neutro" icone={<Info className="h-4 w-4" />} titulo="Sobre faixas de AMF">
          Efeitos atribuídos a faixas de batimento (por exemplo, 130 Hz sedativo, 0–100 Hz estimulante) vêm mais da experiência dos autores que de evidência.
          <FontesChips ids={['rampazo2022']} className="mt-1.5" />
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
