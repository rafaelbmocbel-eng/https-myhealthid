import { useEffect, useState } from 'react';
import { Flame, Info, TriangleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  fmt, fmtTempo, taxaAquecimento, tempoParaAquecer, usAreaEmEras, usEnergiaTotalJ, usMinutosPorEra, usPotenciaEfetiva, usSataPulsado,
} from '@/lib/dosagem/calculos';
import { AVISO_VALIDACAO, CONDICOES_US, NIVEL_EVIDENCIA_ROTULO } from '@/lib/dosagem/protocolos';
import type { DoseRegistrada, EquipamentoFisio } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, CampoNumero, FontesChips, Linha, numStr, parseNum, Secao, SeletorAparelho } from './comuns';
import { RegistrarDosagem } from './RegistrarDosagem';
import { SegurancaPainel, useSeguranca } from './SegurancaPainel';

interface Props {
  paciente: PacienteDosagem | null | undefined;
  equipamentos: EquipamentoFisio[];
  equipamentosDisponiveis: boolean;
  onGerenciarAparelhos: () => void;
}

export default function DosagemUltrassom({ paciente, equipamentos, equipamentosDisponiveis, onGerenciarAparelhos }: Props) {
  const [condId, setCondId] = useState(CONDICOES_US[0].id);
  const [equipId, setEquipId] = useState('manual');
  const [freq, setFreq] = useState<'1' | '3'>('1');
  const [modo, setModo] = useState<'continuo' | 'pulsado'>('continuo');
  const [sata, setSata] = useState('');
  const [satp, setSatp] = useState('');
  const [ciclo, setCiclo] = useState('20');
  const [era, setEra] = useState('');
  const [area, setArea] = useState('');
  const [tempo, setTempo] = useState('');

  const cond = CONDICOES_US.find((c) => c.id === condId)!;
  const eq = equipamentos.find((e) => e.id === equipId);

  useEffect(() => {
    if (!eq) return;
    const s = eq.specs;
    if (s.frequencia_mhz === 1 || s.frequencia_mhz === 3) setFreq(String(s.frequencia_mhz) as '1' | '3');
    if (s.era_cm2) setEra(numStr(s.era_cm2));
  }, [eq]);

  const aplicarProtocolo = () => {
    const s = cond.sugestao;
    if (!s) return;
    if (s.freqMhz) setFreq(String(s.freqMhz) as '1' | '3');
    if (s.modo) setModo(s.modo);
    if (s.sata) setSata(numStr(s.sata));
    if (s.tempoMin) setTempo(numStr(s.tempoMin));
  };

  const eraN = parseNum(era);
  const areaN = parseNum(area);
  const tempoN = parseNum(tempo);
  const freqN = freq === '1' ? 1 : 3;
  const sataEf = modo === 'continuo' ? parseNum(sata) : usSataPulsado(parseNum(satp) ?? 0, parseNum(ciclo) ?? 0);
  const potEf = usPotenciaEfetiva(sataEf ?? 0, eraN ?? 0);
  const energia = usEnergiaTotalJ(potEf ?? 0, tempoN ?? 0);
  const eras = usAreaEmEras(areaN ?? 0, eraN ?? 0);
  const minPorEra = usMinutosPorEra(tempoN ?? 0, areaN ?? 0, eraN ?? 0);
  const energiaCm2 = energia && areaN ? energia / areaN : null;

  const taxa = modo === 'continuo' && sataEf ? taxaAquecimento(freqN, sataEf) : null;
  const t1 = tempoParaAquecer(1, taxa);
  const t2 = tempoParaAquecer(2, taxa);
  const t4 = tempoParaAquecer(4, taxa);
  const aquecimentoNoTempo = taxa && tempoN ? taxa * tempoN : null;

  const bnr = eq?.specs.bnr;
  const potMax = eq?.specs.potencia_max_w;
  const seg = useSeguranca('ultrassom', paciente);

  const dose: DoseRegistrada | null = sataEf && eraN && tempoN ? {
    modalidade: 'ultrassom',
    condicao: cond.nome,
    titulo: `Dosagem — Ultrassom · ${cond.nome}`,
    linhas: [
      `Ultrassom ${freq} MHz, ${modo === 'continuo' ? 'contínuo' : `pulsado (ciclo de trabalho ${fmt(parseNum(ciclo), 0)}%)`}, intensidade SATA ${fmt(sataEf, 2)} W/cm², ERA ${fmt(eraN, 2)} cm².`,
      `${fmt(tempoN, 1)} min${areaN ? ` em ${fmt(areaN, 1)} cm² (${fmt(eras, 1)} ERAs; ${fmt(minPorEra, 1)} min por ERA)` : ''}: potência efetiva ${fmt(potEf, 2)} W, energia ${fmt(energia, 0)} J${energiaCm2 ? ` (${fmt(energiaCm2, 1)} J/cm²)` : ''}.`,
      aquecimentoNoTempo ? `Aquecimento estimado de ${fmt(aquecimentoNoTempo, 1)} °C (estimativa a partir de adultos saudáveis).` : '',
    ].filter(Boolean),
    parametros: { freq_mhz: freqN, modo, sata_wcm2: sataEf, ciclo_pct: modo === 'pulsado' ? parseNum(ciclo) : null, era_cm2: eraN, area_cm2: areaN, tempo_min: tempoN, potencia_efetiva_w: potEf, energia_j: energia, aquecimento_estimado_c: aquecimentoNoTempo },
    equipamento: eq ? `${eq.nome}${eq.modelo ? ` (${eq.modelo})` : ''}` : undefined,
    referencias: [...cond.fontes, ...(taxa ? ['draper1995'] : [])],
  } : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <div className="space-y-4">
        <Secao numero={1} titulo="Objetivo ou condição">
          <Select value={condId} onValueChange={setCondId}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{CONDICOES_US.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
          <div className="rounded-xl bg-muted/40 p-3 space-y-2">
            <p className="text-xs leading-relaxed">{cond.resumo}</p>
            <p className="text-[11px] font-medium text-muted-foreground">Nível de evidência: {NIVEL_EVIDENCIA_ROTULO[cond.evidencia]}</p>
            {cond.sugestao && (
              <div className="rounded-lg border border-border/60 bg-background p-2.5 text-xs space-y-1.5">
                <p className="font-semibold">Protocolo do estudo</p>
                <p className="tabular-nums">
                  {[cond.sugestao.freqMhz ? `${cond.sugestao.freqMhz} MHz` : '', cond.sugestao.modo ? (cond.sugestao.modo === 'continuo' ? 'contínuo' : 'pulsado') : '',
                    cond.sugestao.sata ? `${fmt(cond.sugestao.sata)} W/cm²` : '', cond.sugestao.tempoMin ? `${cond.sugestao.tempoMin} min` : '', cond.sugestao.sessoes ?? ''].filter(Boolean).join(' · ')}
                </p>
                {cond.sugestao.nota && <p className="text-muted-foreground">{cond.sugestao.nota}</p>}
                <button type="button" onClick={aplicarProtocolo} className="font-medium text-primary hover:underline">Usar estes valores</button>
              </div>
            )}
            <FontesChips ids={cond.fontes} />
          </div>
        </Secao>

        <Secao numero={2} titulo="Aparelho e parâmetros">
          <SeletorAparelho itens={equipamentos} valor={equipId} onChange={setEquipId} disponivel={equipamentosDisponiveis} onGerenciar={onGerenciarAparelhos} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Frequência</Label>
              <Select value={freq} onValueChange={(v) => setFreq(v as '1' | '3')}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1 MHz</SelectItem><SelectItem value="3">3 MHz</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Modo</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as 'continuo' | 'pulsado')}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="continuo">Contínuo</SelectItem><SelectItem value="pulsado">Pulsado</SelectItem></SelectContent>
              </Select>
            </div>
            {modo === 'continuo' ? (
              <CampoNumero id="u-sata" label="Intensidade" unidade="W/cm²" valor={sata} onChange={setSata} className="col-span-2" dica="O valor que o aparelho mostra (SATA)." />
            ) : (
              <>
                <CampoNumero id="u-satp" label="Intensidade de pico (SATP)" unidade="W/cm²" valor={satp} onChange={setSatp} />
                <CampoNumero id="u-ciclo" label="Ciclo de trabalho" unidade="%" valor={ciclo} onChange={setCiclo} />
                <p className="col-span-2 text-[11px] text-muted-foreground tabular-nums">Intensidade média (SATA) = SATP × ciclo = <strong>{sataEf ? `${fmt(sataEf, 2)} W/cm²` : '—'}</strong></p>
              </>
            )}
            <CampoNumero id="u-era" label="ERA do transdutor" unidade="cm²" valor={era} onChange={setEra} dica="Use a ERA do laudo de calibração, não a do rótulo." />
            <CampoNumero id="u-area" label="Área a tratar" unidade="cm²" valor={area} onChange={setArea} />
            <CampoNumero id="u-tempo" label="Tempo de aplicação" unidade="min" valor={tempo} onChange={setTempo} className="col-span-2" />
          </div>
          {typeof bnr === 'number' && bnr > 8 && (
            <Aviso tom="ruim" icone={<TriangleAlert className="h-4 w-4" />} titulo="BNR acima de 8">O BNR de um transdutor não deve passar de 8: o feixe tem pontos quentes. Reavalie o aparelho antes de usar.</Aviso>
          )}
          {potMax && potEf && potEf > potMax && (
            <Aviso tom="atencao" icone={<TriangleAlert className="h-4 w-4" />}>A potência efetiva calculada ({fmt(potEf, 2)} W) é maior que a máxima cadastrada ({fmt(potMax, 1)} W). Confira a ERA e a intensidade.</Aviso>
          )}
        </Secao>

        <SegurancaPainel modalidade="ultrassom" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <Secao titulo="Dose calculada">
          <Linha rotulo="Intensidade média (SATA)" valor={sataEf ? `${fmt(sataEf, 2)} W/cm²` : '—'} destaque />
          <Linha rotulo="Potência efetiva" valor={potEf ? `${fmt(potEf, 2)} W` : '—'} dica="intensidade × ERA" />
          <Linha rotulo="Energia total" valor={energia ? `${fmt(energia, 0)} J` : '—'} />
          <Linha rotulo="Energia por cm² tratado" valor={energiaCm2 ? `${fmt(energiaCm2, 1)} J/cm²` : '—'} />
          <Linha rotulo="Área em ERAs" valor={eras ? fmt(eras, 1) : '—'} />
          <Linha rotulo="Tempo por ERA" valor={minPorEra ? `${fmt(minPorEra, 1)} min` : '—'} dica="para comparar com a sua prática" />
        </Secao>

        <Secao titulo="Aquecimento estimado" direita={<Flame className="h-4 w-4 text-orange-500" />}>
          {modo === 'pulsado' ? (
            <Aviso icone={<Info className="h-4 w-4" />}>Sem estimativa de aquecimento no modo pulsado: as fontes lidas só medem o ultrassom contínuo.</Aviso>
          ) : taxa ? (
            <>
              <Linha rotulo="Ritmo estimado" valor={`${fmt(taxa, 2)} °C/min`} />
              <Linha rotulo="+ 1 °C em" valor={fmtTempo(t1 !== null ? t1 * 60 : null)} dica={t1 !== null && t1 > 10 ? 'passa dos 10 min medidos' : undefined} />
              <Linha rotulo="+ 2 °C em" valor={fmtTempo(t2 !== null ? t2 * 60 : null)} dica={t2 !== null && t2 > 10 ? 'passa dos 10 min medidos' : undefined} />
              <Linha rotulo="+ 4 °C em" valor={fmtTempo(t4 !== null ? t4 * 60 : null)} dica={t4 !== null && t4 > 10 ? 'passa dos 10 min medidos' : undefined} />
              {aquecimentoNoTempo !== null && (
                <Linha rotulo={`No tempo escolhido (${fmt(tempoN, 1)} min)`} valor={`≈ ${fmt(aquecimentoNoTempo, 1)} °C`} dica={tempoN && tempoN > 10 ? 'além dos 10 min medidos' : undefined} />
              )}
              <Aviso icone={<Info className="h-4 w-4" />}>
                Estimativa linear a partir do ritmo medido por Draper em adultos saudáveis (tríceps sural, 10 min, ultrassom contínuo; profundidades de 2,5 e 5 cm em 1 MHz e de 0,8 e 1,6 cm em 3 MHz). Tecido, profundidade, área e velocidade do transdutor mudam o resultado.
              </Aviso>
              <FontesChips ids={['draper1995']} />
            </>
          ) : (
            <Aviso icone={<Info className="h-4 w-4" />}>
              {sataEf
                ? 'Intensidade fora de 0,5–2,0 W/cm², a faixa medida: sem estimativa (não extrapolamos).'
                : 'Informe a intensidade para estimar o aquecimento.'}
              {' '}Referência: a 3 MHz e 0,132 W/cm² com o transdutor parado, +1 °C em cerca de 10 min e +4 °C em cerca de 80 min.
            </Aviso>
          )}
          <details className="text-[11.5px] text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground/80">Outros dados medidos</summary>
            <ul className="mt-1.5 list-disc pl-4 space-y-1">
              <li>Tendão de Aquiles, 3 MHz a 1 W/cm² por 10 min: com gel, +13,3 °C; com almofada de 1 cm, +9,3 °C; de 2 cm, +6,5 °C.</li>
              <li>Depois de 3 MHz a 1,5 W/cm² até ≥ 5 °C, o alongamento rende em média 3,3 minutos.</li>
            </ul>
            <FontesChips ids={['draper2010', 'draper1995b', 'rigby2015']} className="mt-1.5" />
          </details>
        </Secao>

        <Aviso tom="neutro" icone={<Info className="h-4 w-4" />} titulo="Calibração importa">
          ERA e potência variam entre transdutores e geraram até 50% de diferença na intensidade. No Brasil, só 32,3% dos aparelhos testados estavam de acordo com a norma.
          <FontesChips ids={['johns2007', 'ferrari2010', 'hekkenberg1994']} className="mt-1.5" />
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
