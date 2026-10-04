import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eswtEfdAcumulada, eswtEnergiaPorImpulsoMj, eswtTempoSessaoS, fmt, fmtTempo } from '@/lib/dosagem/calculos';
import { AVISO_VALIDACAO, CONDICOES_ESWT, type SugestaoESWT } from '@/lib/dosagem/protocolos';
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

const ESCALA_MAX = 0.8;

const descreverSugestao = (s: SugestaoESWT) => [
  s.tipo === 'focal' ? 'Focal' : 'Radial',
  s.efd !== undefined ? `${fmt(s.efd)} mJ/mm²` : s.efdFaixa ? `${fmt(s.efdFaixa[0])}–${fmt(s.efdFaixa[1])} mJ/mm²` : '',
  s.impulsos ? `${s.impulsos} impulsos` : '',
  s.hz ? `${s.hz} Hz` : '',
  s.sessoes ? `${s.sessoes} sessões${s.intervalo ? ` (${s.intervalo})` : ''}` : '',
].filter(Boolean).join(' · ');

export default function DosagemOndasChoque({ paciente, equipamentos, equipamentosDisponiveis, onGerenciarAparelhos }: Props) {
  const [condId, setCondId] = useState(CONDICOES_ESWT[0].id);
  const [equipId, setEquipId] = useState('manual');
  const [tipo, setTipo] = useState<'focal' | 'radial'>('focal');
  const [efd, setEfd] = useState('');
  const [bar, setBar] = useState('');
  const [impulsos, setImpulsos] = useState('');
  const [hz, setHz] = useState('');
  const [sessoes, setSessoes] = useState('');
  const [intervalo, setIntervalo] = useState('');
  const [areaFocal, setAreaFocal] = useState('');

  const cond = CONDICOES_ESWT.find((c) => c.id === condId)!;
  const eq = equipamentos.find((e) => e.id === equipId);

  const usar = (s: SugestaoESWT) => {
    setTipo(s.tipo);
    setEfd(s.efd !== undefined ? numStr(s.efd) : '');
    setImpulsos(s.impulsos ? String(s.impulsos) : '');
    setHz(s.hz ? String(s.hz) : '');
    setSessoes(s.sessoes ? String(s.sessoes) : '');
    setIntervalo(s.intervalo ?? '');
  };

  useEffect(() => { if (cond.sugestoes[0]) usar(cond.sugestoes[0]); }, [condId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!eq) return;
    const s = eq.specs;
    if (s.tipo) setTipo(s.tipo);
    if (s.area_focal_mm2) setAreaFocal(numStr(s.area_focal_mm2));
  }, [eq]);

  const efdN = parseNum(efd);
  const impN = parseNum(impulsos);
  const hzN = parseNum(hz);
  const sesN = parseNum(sessoes);
  const areaN = parseNum(areaFocal);
  const tempoS = eswtTempoSessaoS(impN ?? 0, hzN ?? 0);
  const efdSessao = eswtEfdAcumulada(efdN ?? 0, impN ?? 0, 1);
  const efdTotal = eswtEfdAcumulada(efdN ?? 0, impN ?? 0, sesN ?? 1);
  const energiaImpulso = eswtEnergiaPorImpulsoMj(efdN ?? 0, areaN ?? 0);
  const seg = useSeguranca('ondas_choque', paciente);
  const marcador = efdN ? Math.min(100, (efdN / ESCALA_MAX) * 100) : null;

  const efdTexto = tipo === 'focal' ? (efdN ? `EFD ${fmt(efdN)} mJ/mm²` : '') : [efdN ? `EFD ${fmt(efdN)} mJ/mm²` : '', parseNum(bar) ? `${fmt(parseNum(bar), 1)} bar` : ''].filter(Boolean).join(', ');

  const dose: DoseRegistrada | null = (efdN || parseNum(bar)) && impN ? {
    modalidade: 'ondas_choque',
    condicao: cond.nome,
    titulo: `Dosagem — Ondas de choque (${tipo === 'focal' ? 'focal' : 'radial'}) · ${cond.nome}`,
    linhas: [
      `Onda ${tipo === 'focal' ? 'focal' : 'radial'}: ${efdTexto}, ${impN} impulsos${hzN ? ` a ${fmt(hzN, 1)} Hz (${fmtTempo(tempoS)})` : ''}.`,
      efdSessao ? `EFD acumulada na sessão: ${fmt(efdSessao, 0)} mJ/mm²${sesN ? `; em ${sesN} sessão(ões): ${fmt(efdTotal, 0)} mJ/mm² (${fmt((efdTotal ?? 0) / 1000, 2)} J/mm²)` : ''}.` : '',
      sesN ? `Plano: ${sesN} sessão(ões)${intervalo ? `, intervalo: ${intervalo}` : ''}.` : '',
      energiaImpulso ? `Energia por impulso ≈ ${fmt(energiaImpulso, 1)} mJ (área focal ${fmt(areaN, 1)} mm²).` : '',
    ].filter(Boolean),
    parametros: { tipo, efd_mj_mm2: efdN, pressao_bar: parseNum(bar), impulsos: impN, hz: hzN, sessoes: sesN, intervalo, area_focal_mm2: areaN, tempo_sessao_s: tempoS, efd_acumulada_sessao: efdSessao, efd_acumulada_total: efdTotal },
    equipamento: eq ? `${eq.nome}${eq.modelo ? ` (${eq.modelo})` : ''}` : undefined,
    referencias: [...cond.fontes, 'schmitz2015'],
  } : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <div className="space-y-4">
        <Secao numero={1} titulo="Condição">
          <Select value={condId} onValueChange={setCondId}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{CONDICOES_ESWT.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
          <div className="rounded-xl bg-muted/40 p-3 space-y-2.5">
            <p className="text-xs leading-relaxed">{cond.resumo}</p>
            <div className="space-y-1.5">
              {cond.sugestoes.map((s, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-background p-2.5 text-xs space-y-1">
                  <p className="font-semibold tabular-nums">{descreverSugestao(s)}</p>
                  {s.nota && <p className="text-muted-foreground">{s.nota}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <FontesChips ids={s.fontes} />
                    <button type="button" onClick={() => usar(s)} className="shrink-0 font-medium text-primary hover:underline">Usar estes valores</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Secao>

        <Secao numero={2} titulo="Aparelho e parâmetros">
          <SeletorAparelho itens={equipamentos} valor={equipId} onChange={setEquipId} disponivel={equipamentosDisponiveis} onGerenciar={onGerenciarAparelhos} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Tipo de onda</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as 'focal' | 'radial')}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="focal">Focal</SelectItem><SelectItem value="radial">Radial</SelectItem></SelectContent>
              </Select>
            </div>
            <CampoNumero id="e-efd" label="EFD" unidade="mJ/mm²" valor={efd} onChange={setEfd}
              dica={cond.sugestoes.find((s) => s.efdFaixa)?.efdFaixa ? `Faixa do estudo: ${cond.sugestoes.find((s) => s.efdFaixa)!.efdFaixa!.map((v) => fmt(v)).join('–')}.` : 'Maior valor que o paciente tolerar, sem anestesia local.'} />
            {tipo === 'radial' && <CampoNumero id="e-bar" label="Pressão (se o aparelho usar bar)" unidade="bar" valor={bar} onChange={setBar} className="col-span-2" />}
            <CampoNumero id="e-imp" label="Impulsos por sessão" valor={impulsos} onChange={setImpulsos} />
            <CampoNumero id="e-hz" label="Frequência" unidade="Hz" valor={hz} onChange={setHz} />
            <CampoNumero id="e-ses" label="Número de sessões" valor={sessoes} onChange={setSessoes} />
            <div className="space-y-1">
              <Label htmlFor="e-int" className="text-xs font-medium">Intervalo entre sessões</Label>
              <input id="e-int" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} placeholder="ex.: 1 semana"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-[16px] sm:text-sm" />
            </div>
            {tipo === 'focal' && (
              <CampoNumero id="e-area" label="Área focal (opcional)" unidade="mm²" valor={areaFocal} onChange={setAreaFocal} className="col-span-2" dica="Dado do fabricante; permite calcular a energia por impulso." />
            )}
          </div>
        </Secao>

        <SegurancaPainel modalidade="ondas_choque" estado={seg} paciente={paciente} numero={3} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <Secao titulo="Dose calculada">
          <Linha rotulo="Duração da sessão" valor={fmtTempo(tempoS)} destaque dica="impulsos ÷ frequência" />
          <Linha rotulo="EFD acumulada na sessão" valor={efdSessao ? `${fmt(efdSessao, 0)} mJ/mm²` : '—'} dica="EFD × impulsos" />
          <Linha rotulo={`Em ${sesN ?? 1} sessão(ões)`} valor={efdTotal ? `${fmt(efdTotal, 0)} mJ/mm² · ${fmt(efdTotal / 1000, 2)} J/mm²` : '—'} />
          {tipo === 'focal' && <Linha rotulo="Energia por impulso" valor={energiaImpulso ? `≈ ${fmt(energiaImpulso, 1)} mJ` : '—'} dica="EFD × área focal" />}

          <div className="pt-2 space-y-1.5">
            <p className="text-xs font-medium">Onde está a sua EFD</p>
            <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-rose-300 dark:from-emerald-900 dark:via-amber-900 dark:to-rose-900">
              <span className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-foreground/60" style={{ left: `${(0.2 / ESCALA_MAX) * 100}%` }} />
              {marcador !== null && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow" style={{ left: `${marcador}%` }} />}
            </div>
            <div className="relative h-3 text-[10px] text-muted-foreground tabular-nums">
              <span className="absolute left-0">0</span>
              <span className="absolute -translate-x-1/2" style={{ left: `${(0.2 / ESCALA_MAX) * 100}%` }}>0,2</span>
              <span className="absolute right-0">0,8</span>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Nos ensaios, a EFD média foi 0,19 mJ/mm² (0,03–0,78). O limite de 0,2 entre “baixa” e “alta” energia é arbitrário e não há consenso; a literatura sugere abandonar essa divisão.
              {efdN !== null && efdN > ESCALA_MAX ? ' Seu valor passa da escala mostrada.' : ''}
            </p>
            <FontesChips ids={['schmitz2015']} />
          </div>
        </Secao>

        <Aviso icone={<Info className="h-4 w-4" />} titulo="Atenção ao registrar a EFD">
          Muitos ensaios não dizem se a EFD informada é a positiva ou a total. Anote qual valor o seu aparelho mostra.
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
