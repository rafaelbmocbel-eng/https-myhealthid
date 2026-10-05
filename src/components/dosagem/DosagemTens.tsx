import { useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { estiloAcento } from '@/lib/dosagem/acentos';
import { fmt } from '@/lib/dosagem/calculos';
import { avaliarLimitesTens, cargaPorPulsoUc, correnteMediaMa, densidadeCorrenteMaCm2, ocupacaoPulsoPct, periodoMs } from '@/lib/dosagem/eletro';
import { AVISO_VALIDACAO } from '@/lib/dosagem/protocolos';
import { CONDICOES_TENS, type ParamsEletro } from '@/lib/dosagem/protocolosEletro';
import type { DoseRegistrada } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, CampoNumero, condicaoInicial, FontesChips, Linha, numStr, parseNum, Secao } from './comuns';
import { CartaoCondicaoEletro, RegraIntensidade, SeletorCondicao } from './EletroComuns';
import { GraficoCard, OndaPulsos } from './Graficos';
import { RegistrarDosagem } from './RegistrarDosagem';
import { SegurancaPainel, useSeguranca } from './SegurancaPainel';
import { DoseBarraMovel, DoseHero, SeloStatus } from './visual';

export default function DosagemTens({ paciente, condicaoInicial: condIni }: { paciente: PacienteDosagem | null | undefined; condicaoInicial?: string | null }) {
  const [condId, setCondId] = useState(condicaoInicial(CONDICOES_TENS, condIni));
  const [freq, setFreq] = useState('');
  const [largura, setLargura] = useState('');
  const [bifasico, setBifasico] = useState(true);
  const [corrente, setCorrente] = useState('');
  const [area, setArea] = useState('');
  const [duracao, setDuracao] = useState('');
  const [sessoes, setSessoes] = useState('');

  const cond = CONDICOES_TENS.find((c) => c.id === condId)!;
  const usar = (p: ParamsEletro) => {
    setFreq(numStr(p.freqHz)); setLargura(numStr(p.larguraUs)); setDuracao(numStr(p.duracaoMin)); setSessoes(numStr(p.sessoes));
    if (p.correnteMa) setCorrente(numStr(p.correnteMa));
  };

  const f = parseNum(freq), w = parseNum(largura), i = parseNum(corrente), a = parseNum(area), d = parseNum(duracao), ses = parseNum(sessoes);
  const per = periodoMs(f ?? 0);
  const ocup = ocupacaoPulsoPct(w ?? 0, f ?? 0);
  const carga = cargaPorPulsoUc(i ?? 0, w ?? 0);
  const media = correnteMediaMa(i ?? 0, w ?? 0, f ?? 0);
  const dens = densidadeCorrenteMaCm2(i ?? 0, a ?? 0);
  const limites = avaliarLimitesTens({ freqHz: f, larguraUs: w, picoMa: i });
  const seg = useSeguranca('tens', paciente);

  const dose: DoseRegistrada | null = f && w && d ? {
    modalidade: 'tens',
    condicao: cond.nome,
    titulo: `Dosagem — TENS · ${cond.nome}`,
    linhas: [
      `TENS ${fmt(f, 0)} Hz, pulso de ${fmt(w, 0)} µs (${bifasico ? 'bifásico' : 'monofásico'}), ${fmt(d, 0)} min${ses ? `, ${ses} sessão(ões)` : ''}.`,
      i ? `Intensidade ${fmt(i, 0)} mA${a ? ` em eletrodo de ${fmt(a, 0)} cm² (${fmt(dens, 2)} mA/cm²)` : ''}; carga por fase ${fmt(carga, 2)} µC.` : 'Intensidade titulada pela sensação do paciente (forte, não dolorosa, no local ou perto da dor).',
      limites.dentro ? 'Dentro dos limites dos estudos do meta-TENS (≤ 250 pps, ≤ 500 µs, ≤ 60 mA).' : limites.avisos.join(' '),
    ],
    parametros: { freq_hz: f, largura_us: w, bifasico, corrente_ma: i, area_cm2: a, duracao_min: d, sessoes: ses, carga_uc: carga, corrente_media_ma: media, densidade_ma_cm2: dens },
    referencias: [...cond.fontes, 'johnson2022'],
  } : null;

  return (
    <div style={estiloAcento('tens')} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <DoseBarraMovel modalidade="tens" rotulo="Frequência" valor={f ? fmt(f, 0) : '—'} unidade="Hz" nota={f && w ? (limites.dentro ? 'dentro dos limites' : 'fora dos limites') : undefined} />
        <Secao numero={1} titulo="Condição">
          <SeletorCondicao condicoes={CONDICOES_TENS} valor={condId} onChange={setCondId} />
          <CartaoCondicaoEletro cond={cond} onUsar={usar} />
        </Secao>

        <Secao numero={2} titulo="Parâmetros">
          <RegraIntensidade fontes={['johnson2022', 'aarskog2007', 'bjordal2003']}>
            Forte, mas não dolorosa, no local ou perto da dor. Titule durante a sessão e aumente se a sensação diminuir (acomodação). A intensidade foi o parâmetro com respaldo de dose-resposta.
          </RegraIntensidade>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero id="t-f" label="Frequência" unidade="Hz" valor={freq} onChange={setFreq} />
            <CampoNumero id="t-w" label="Largura de pulso" unidade="µs" valor={largura} onChange={setLargura} />
            <div className="space-y-1">
              <Label className="text-xs font-medium">Forma do pulso</Label>
              <Select value={bifasico ? 'bi' : 'mono'} onValueChange={(v) => setBifasico(v === 'bi')}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bi">Bifásico</SelectItem><SelectItem value="mono">Monofásico</SelectItem></SelectContent>
              </Select>
            </div>
            <CampoNumero id="t-d" label="Duração da sessão" unidade="min" valor={duracao} onChange={setDuracao} />
            <CampoNumero id="t-s" label="Sessões (plano)" valor={sessoes} onChange={setSessoes} />
            <CampoNumero id="t-i" label="Corrente (opcional)" unidade="mA" valor={corrente} onChange={setCorrente} dica="O que o aparelho mostra no limiar desejado." />
            <CampoNumero id="t-a" label="Área do eletrodo (opcional)" unidade="cm²" valor={area} onChange={setArea} className="col-span-2" />
          </div>
        </Secao>

        <SegurancaPainel modalidade="tens" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <DoseHero modalidade="tens" rotulo="Frequência" valor={f ? fmt(f, 0) : '—'} unidade="Hz"
          detalhe={w || d ? [w ? `${fmt(w, 0)} µs` : '', d ? `${fmt(d, 0)} min` : ''].filter(Boolean).join(' · ') : 'Informe frequência, pulso e duração'}>
          {f && w && (
            <SeloStatus tom={limites.dentro ? 'bom' : 'atencao'} icone={limites.dentro ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}>
              {limites.dentro ? 'Dentro dos limites dos estudos' : 'Fora dos limites dos estudos'}
            </SeloStatus>
          )}
        </DoseHero>
        {!limites.dentro && limites.avisos.map((m) => <Aviso key={m} tom="atencao" icone={<TriangleAlert className="h-4 w-4" />}>{m}</Aviso>)}

        {f && w && (
          <GraficoCard titulo="Trem de pulsos" legenda="Esquema fora de escala: com 100 Hz e 200 µs, o pulso ocupa 2% do período.">
            <OndaPulsos bifasico={bifasico} larguraTxt={`${fmt(w, 0)} µs`} periodoTxt={`${fmt(per, 1)} ms · ${fmt(f, 0)} Hz`} />
          </GraficoCard>
        )}

        <Secao titulo="Em números">
          <Linha rotulo="Período" valor={per ? `${fmt(per, 1)} ms` : '—'} />
          <Linha rotulo="Ocupação do pulso" valor={ocup ? `${fmt(ocup, 2)}%` : '—'} dica="largura × frequência" />
          <Linha rotulo="Carga por fase" valor={carga ? `${fmt(carga, 2)} µC` : '—'} dica={i ? 'corrente × largura' : 'informe a corrente'} />
          <Linha rotulo="Corrente média" valor={media ? `${fmt(media, 3)} mA` : '—'} />
          <Linha rotulo="Densidade de corrente" valor={dens ? `${fmt(dens, 2)} mA/cm²` : '—'} dica={a ? undefined : 'informe a área do eletrodo'} />
        </Secao>

        <Aviso tom="neutro" titulo="Limites usados no meta-TENS">
          Os 381 ensaios excluíram frequências acima de 250 pps, larguras acima de 500 µs e amplitudes acima de 60 mA pico a pico. Não são recomendações: são o que a revisão incluiu.
          <FontesChips ids={['johnson2022']} className="mt-1.5" />
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
