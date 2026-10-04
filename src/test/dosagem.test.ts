import { describe, expect, it } from 'vitest';
import {
  arredondar, avaliarDoseLaser, eswtEfdAcumulada, eswtEnergiaPorImpulsoMj, eswtTempoSessaoS, faixaComprimentoOnda,
  laserEnergiaPorPonto, laserFluencia, laserIrradiancia, laserTempoParaEnergia, potenciaMediaPulsada, taxaAquecimento,
  tempoParaAquecer, usAreaEmEras, usEnergiaTotalJ, usIntensidadeSata, usMinutosPorEra, usPotenciaEfetiva, usSataPulsado,
} from '@/lib/dosagem/calculos';
import { CONDICOES_ESWT, CONDICOES_LASER, CONDICOES_US } from '@/lib/dosagem/protocolos';
import { REFERENCIAS_DOSAGEM, referencia } from '@/lib/dosagem/referencias';
import {
  avaliarLimitesTens, batimentoHz, cargaPorPulsoUc, cicloBurstPct, cicloTrabalhoPct, ciclosPorBurst, contracoesPorSessao, correnteMediaMa,
  densidadeCorrenteMaCm2, duracaoBurstMs, ocupacaoPulsoPct, periodoMs, razaoOffOn, tempoSobEstimuloS,
} from '@/lib/dosagem/eletro';
import { detectarAlertas, ITENS_SEGURANCA, idadeEmAnos, itensDaModalidade } from '@/lib/dosagem/seguranca';

describe('laser', () => {
  it('energia = potência × tempo', () => {
    expect(laserEnergiaPorPonto(100, 40)).toBeCloseTo(4, 6); // 0,1 W × 40 s
    expect(laserEnergiaPorPonto(60, 50)).toBeCloseTo(3, 6); // 904 nm do ensaio de Aquiles
  });
  it('tempo para a energia alvo é o inverso', () => {
    expect(laserTempoParaEnergia(4, 100)).toBeCloseTo(40, 6);
    expect(laserTempoParaEnergia(2, 60)).toBeCloseTo(33.333, 2);
  });
  it('fluência e irradiância pela área do feixe na pele', () => {
    expect(laserFluencia(4, 0.5)).toBeCloseTo(8, 6);
    expect(laserIrradiancia(100, 0.5)).toBeCloseTo(200, 6);
  });
  it('potência média do pulsado = pico × largura × frequência', () => {
    // 50 W de pico (50000 mW), pulso de 100 ns, 10 kHz → 50 mW médios
    expect(potenciaMediaPulsada(50000, 100, 10000)).toBeCloseTo(50, 6);
  });
  it('entradas inválidas devolvem null, não NaN', () => {
    expect(laserEnergiaPorPonto(0, 10)).toBeNull();
    expect(laserEnergiaPorPonto(NaN, 10)).toBeNull();
    expect(laserFluencia(1, 0)).toBeNull();
  });
  it('classifica o comprimento de onda', () => {
    expect(faixaComprimentoOnda(810)).toBe('780-860');
    expect(faixaComprimentoOnda(850)).toBe('780-860');
    expect(faixaComprimentoOnda(904)).toBe('904');
    expect(faixaComprimentoOnda(660)).toBe('outra');
    expect(faixaComprimentoOnda(1064)).toBe('outra');
  });
});

describe('avaliação da dose do laser', () => {
  const tendinopatia = CONDICOES_LASER.find((c) => c.id === 'tendinopatia_membro_inferior')!;
  const joelho = CONDICOES_LASER.find((c) => c.id === 'osteoartrite_joelho')!;
  const muscular = CONDICOES_LASER.find((c) => c.id === 'desempenho_muscular')!;

  it('tendinopatia: mínimo de 2 J (904) e 4 J (780–860)', () => {
    expect(avaliarDoseLaser({ nm: 904, modo: 'pulsado', energiaPontoJ: 1.5, janelas: tendinopatia.janelas }).status).toBe('abaixo');
    expect(avaliarDoseLaser({ nm: 904, modo: 'pulsado', energiaPontoJ: 2, janelas: tendinopatia.janelas }).status).toBe('no_minimo');
    expect(avaliarDoseLaser({ nm: 810, modo: 'continuo', energiaPontoJ: 3, janelas: tendinopatia.janelas }).status).toBe('abaixo');
    expect(avaliarDoseLaser({ nm: 810, modo: 'continuo', energiaPontoJ: 4, janelas: tendinopatia.janelas }).status).toBe('no_minimo');
  });
  it('904 nm contínuo pede 4× a dose do superpulsado', () => {
    const r = avaliarDoseLaser({ nm: 904, modo: 'continuo', energiaPontoJ: 2, janelas: tendinopatia.janelas });
    expect(r.status).toBe('abaixo');
    expect(r.minJ).toBe(8);
    expect(r.fator).toBe(4);
  });
  it('joelho: faixa estudada com teto', () => {
    expect(avaliarDoseLaser({ nm: 830, modo: 'continuo', energiaPontoJ: 6, janelas: joelho.janelas }).status).toBe('dentro');
    expect(avaliarDoseLaser({ nm: 830, modo: 'continuo', energiaPontoJ: 12, janelas: joelho.janelas }).status).toBe('acima');
    expect(avaliarDoseLaser({ nm: 904, modo: 'pulsado', energiaPontoJ: 3, janelas: joelho.janelas }).status).toBe('dentro');
    expect(avaliarDoseLaser({ nm: 904, modo: 'pulsado', energiaPontoJ: 0.5, janelas: joelho.janelas }).status).toBe('abaixo');
  });
  it('desempenho muscular vale para luz vermelha e sem fator contínuo', () => {
    expect(avaliarDoseLaser({ nm: 660, modo: 'continuo', energiaPontoJ: 5, janelas: muscular.janelas }).status).toBe('dentro');
    const r = avaliarDoseLaser({ nm: 904, modo: 'continuo', energiaPontoJ: 5, janelas: muscular.janelas });
    expect(r.fator).toBe(1);
    expect(r.status).toBe('dentro');
  });
  it('comprimento de onda sem referência e condição sem dose', () => {
    expect(avaliarDoseLaser({ nm: 660, modo: 'continuo', energiaPontoJ: 4, janelas: tendinopatia.janelas }).status).toBe('sem_referencia');
    const cervical = CONDICOES_LASER.find((c) => c.id === 'cervical')!;
    expect(avaliarDoseLaser({ nm: 810, modo: 'continuo', energiaPontoJ: 4, janelas: cervical.janelas }).status).toBe('sem_referencia');
  });
});

describe('ultrassom', () => {
  it('intensidade = potência ÷ ERA e o inverso', () => {
    expect(usIntensidadeSata(5, 5)).toBeCloseTo(1, 6);
    expect(usPotenciaEfetiva(1.5, 5)).toBeCloseTo(7.5, 6);
  });
  it('1,5 W/cm² × 5 cm² × 10 min = 4500 J (ensaio de tendinite calcária)', () => {
    expect(usEnergiaTotalJ(usPotenciaEfetiva(1.5, 5)!, 10)).toBeCloseTo(4500, 6);
  });
  it('pulsado: SATA = SATP × ciclo de trabalho', () => {
    expect(usSataPulsado(2, 20)).toBeCloseTo(0.4, 6);
    expect(usSataPulsado(2, 120)).toBeNull();
  });
  it('área em ERAs e minutos por ERA', () => {
    expect(usAreaEmEras(20, 5)).toBe(4);
    expect(usMinutosPorEra(8, 20, 5)).toBe(2);
  });
  it('taxa de aquecimento: valores medidos e interpolação', () => {
    expect(taxaAquecimento(1, 1.0)).toBeCloseTo(0.16, 6);
    expect(taxaAquecimento(3, 1.5)).toBeCloseTo(0.89, 6);
    expect(taxaAquecimento(3, 1.25)).toBeCloseTo((0.58 + 0.89) / 2, 6);
    expect(taxaAquecimento(1, 2.0)).toBeCloseTo(0.38, 6);
  });
  it('não extrapola fora de 0,5–2,0 W/cm²', () => {
    expect(taxaAquecimento(3, 0.3)).toBeNull();
    expect(taxaAquecimento(3, 2.5)).toBeNull();
  });
  it('tempo para aquecer = ΔT ÷ taxa', () => {
    expect(tempoParaAquecer(4, 0.89)).toBeCloseTo(4.494, 2);
    expect(tempoParaAquecer(1, null)).toBeNull();
  });
});

describe('ondas de choque', () => {
  it('tempo da sessão = impulsos ÷ Hz (2000 a 4 Hz = 500 s)', () => {
    expect(eswtTempoSessaoS(2000, 4)).toBe(500);
  });
  it('EFD acumulada = EFD × impulsos × sessões', () => {
    expect(eswtEfdAcumulada(0.16, 2000, 3)).toBeCloseTo(960, 6); // mJ/mm²
  });
  it('energia por impulso = EFD × área focal', () => {
    expect(eswtEnergiaPorImpulsoMj(0.2, 30)).toBeCloseTo(6, 6);
  });
});

describe('arredondamento', () => {
  it('arredonda sem erro de ponto flutuante', () => {
    expect(arredondar(1.005, 2)).toBe(1.01);
    expect(arredondar(2.5, 0)).toBe(3);
  });
});

describe('protocolos e fontes', () => {
  it('toda fonte citada existe no catálogo, com PMID', () => {
    const ids = new Set<string>();
    CONDICOES_LASER.forEach((c) => { c.fontes.forEach((f) => ids.add(f)); c.janelas.forEach((j) => j.fontes.forEach((f) => ids.add(f))); });
    CONDICOES_US.forEach((c) => c.fontes.forEach((f) => ids.add(f)));
    CONDICOES_ESWT.forEach((c) => { c.fontes.forEach((f) => ids.add(f)); c.sugestoes.forEach((s) => s.fontes.forEach((f) => ids.add(f))); });
    ITENS_SEGURANCA.forEach((i) => (i.refs || []).forEach((f) => ids.add(f)));
    for (const id of ids) {
      const r = referencia(id);
      expect(r, `fonte ausente: ${id}`).toBeTruthy();
      expect(r!.pmid).toMatch(/^\d+$/);
    }
  });
  it('não há ids de fonte repetidos', () => {
    const ids = REFERENCIAS_DOSAGEM.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('condições sem dose não trazem janela', () => {
    CONDICOES_LASER.filter((c) => c.semDose).forEach((c) => expect(c.janelas).toHaveLength(0));
  });
});

describe('segurança', () => {
  it('toda modalidade tem itens e os de literatura citam fonte', () => {
    for (const m of ['laser', 'ultrassom', 'ondas_choque'] as const) expect(itensDaModalidade(m).length).toBeGreaterThan(3);
    ITENS_SEGURANCA.filter((i) => i.fonte === 'literatura').forEach((i) => expect(i.refs?.length).toBeGreaterThan(0));
  });
  it('acende o alerta de marca-passo e anticoagulante, ignorando acentos e caixa', () => {
    const itens = itensDaModalidade('ondas_choque');
    const a = detectarAlertas([
      { origem: 'Histórico', texto: 'Paciente com MARCAPASSO desde 2019 e uso de Xarelto.' },
    ], itens);
    expect(a.eswt_marcapasso?.[0].trecho).toMatch(/MARCAPASSO/);
    expect(a.eswt_coagulo?.length).toBe(1);
  });
  it('não acende nada em texto sem sinais', () => {
    expect(Object.keys(detectarAlertas([{ origem: 'Queixa', texto: 'Dor no joelho direito ao subir escada' }], ITENS_SEGURANCA))).toHaveLength(0);
  });
  it('idade em anos', () => {
    expect(idadeEmAnos('2000-06-15', new Date('2026-06-14T12:00:00'))).toBe(25);
    expect(idadeEmAnos('2000-06-15', new Date('2026-06-15T12:00:00'))).toBe(26);
    expect(idadeEmAnos(null)).toBeNull();
  });
});

describe('correntes elétricas', () => {
  it('período e ocupação do pulso', () => {
    expect(periodoMs(100)).toBe(10);
    expect(ocupacaoPulsoPct(200, 100)).toBeCloseTo(2, 6); // 200 µs a 100 Hz = 2% do período
  });
  it('carga por pulso, corrente média e densidade de corrente', () => {
    expect(cargaPorPulsoUc(20, 200)).toBeCloseTo(4, 6); // 20 mA × 200 µs = 4 µC
    expect(correnteMediaMa(20, 200, 100)).toBeCloseTo(0.4, 6);
    expect(densidadeCorrenteMaCm2(20, 25)).toBeCloseTo(0.8, 6);
  });
  it('NMES: ciclo de trabalho, razão e contrações', () => {
    expect(cicloTrabalhoPct(10, 10)).toBe(50);
    expect(razaoOffOn(5, 15)).toBe(3); // 1:3
    expect(contracoesPorSessao(20, 10, 10)).toBe(60);
    expect(tempoSobEstimuloS(60, 10)).toBe(600);
    expect(contracoesPorSessao(15, 2, 2)).toBe(225);
  });
  it('russa: burst, ciclo e ciclos da portadora', () => {
    expect(duracaoBurstMs(50, 50)).toBe(10);
    expect(cicloBurstPct(50, 10)).toBe(50);
    expect(cicloBurstPct(50, 30)).toBeNull(); // 30 ms a 50 Hz passa do período de 20 ms
    expect(ciclosPorBurst(2500, 10)).toBe(25);
  });
  it('interferencial: batimento = diferença das portadoras', () => {
    expect(batimentoHz(4000, 4100)).toBe(100);
    expect(batimentoHz(4100, 4000)).toBe(100);
    expect(batimentoHz(0, 100)).toBeNull();
  });
  it('limites do meta-TENS', () => {
    expect(avaliarLimitesTens({ freqHz: 100, larguraUs: 200, picoMa: 30 }).dentro).toBe(true);
    const r = avaliarLimitesTens({ freqHz: 300, larguraUs: 600, picoMa: 70 });
    expect(r.dentro).toBe(false);
    expect(r.avisos).toHaveLength(3);
  });
});
