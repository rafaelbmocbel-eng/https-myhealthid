import { describe, expect, it, vi } from 'vitest';
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
import { lerFicha } from '@/lib/dosagem/importarFicha';
import { extrairJson, montarPrompt, validarFicha } from '../../supabase/functions/_shared/ficha-aparelho';
import { FAIXAS, PATOLOGIAS, indicacoesOrdenadas, interpretarDescricao, interpretarProntuario, modalidadesSemDados, patologia } from '@/lib/dosagem/guia';
import { CONDICOES_IFC, CONDICOES_NMES, CONDICOES_RUSSA, CONDICOES_TENS } from '@/lib/dosagem/protocolosEletro';
import { MODALIDADES } from '@/lib/dosagem/tipos';
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

describe('ler ficha técnica colada', () => {
  it('laser: comprimento de onda, potência, área e modo', () => {
    const r = lerFicha('Laser Ibramed modelo LP-808. Comprimento de onda: 808 nm. Potência óptica 100 mW. Área do feixe: 0,1 cm². Emissão contínua.', 'laser');
    expect(r.campos.nm).toBe('808');
    expect(r.campos.potMedia).toBe('100');
    expect(r.campos.areaFeixe).toBe('0,1');
    expect(r.campos.modoLaser).toBe('continuo');
    expect(r.campos.fabricante).toBe('Ibramed');
  });
  it('laser: nome do modelo com “Pulse” não vira modo pulsado', () => {
    const r = lerFicha('Ibramed modelo LaserPulse, 808 nm, 100 mW, emissão contínua', 'laser');
    expect(r.campos.modoLaser).toBe('continuo');
    expect(r.avisos.join(' ')).not.toMatch(/contínuo e pulsado/);
  });
  it('laser: potência em W vira mW, e a medida do laudo fica separada', () => {
    const r = lerFicha('Potência média 0,1 W. Potência medida no laudo: 92 mW. Pico 25 W, 904 nm, pulsado', 'laser');
    expect(r.campos.potMedia).toBe('100');
    expect(r.campos.potMedida).toBe('92');
    expect(r.campos.potPico).toBe('25000');
    expect(r.campos.modoLaser).toBe('pulsado');
  });
  it('laser: diâmetro vira área aproximada e avisa', () => {
    const r = lerFicha('Diâmetro do spot 3 mm, 660 nm, 40 mW', 'laser');
    expect(Number(r.campos.areaFeixe?.replace(',', '.'))).toBeCloseTo(0.0707, 3);
    expect(r.avisos.join(' ')).toMatch(/NA PELE/);
  });
  it('laser: vários comprimentos de onda geram aviso', () => {
    const r = lerFicha('Ponteiras 660 nm e 808 nm', 'laser');
    expect(r.campos.nm).toBe('660');
    expect(r.avisos.join(' ')).toMatch(/uma ponteira para cada/);
  });
  it('ultrassom: frequência, ERA e BNR', () => {
    const r = lerFicha('Transdutor 3 MHz, ERA: 4,2 cm², BNR 5,1. Potência máxima 8 W', 'ultrassom');
    expect(r.campos.freq).toBe('3');
    expect(r.campos.era).toBe('4,2');
    expect(r.campos.bnr).toBe('5,1');
    expect(r.campos.potMax).toBe('8');
  });
  it('ultrassom sem ERA avisa para usar o laudo', () => {
    expect(lerFicha('1 MHz, potência máxima 10 W', 'ultrassom').avisos.join(' ')).toMatch(/laudo de calibração/);
  });
  it('ondas de choque: tipo, área focal e limites', () => {
    const r = lerFicha('Onda focal. Área focal 28 mm². Frequência até 8 Hz. EFD até 0,55 mJ/mm².', 'ondas_choque');
    expect(r.campos.tipoOnda).toBe('focal');
    expect(r.campos.areaFocal).toBe('28');
    expect(r.campos.hzMax).toBe('8');
    expect(r.campos.efdMax).toBe('0,55');
  });
  it('data de calibração dd/mm/aaaa vira ISO; texto vazio ou sem valores não chuta', () => {
    expect(lerFicha('Calibrado em 15/03/2026. 1 MHz', 'ultrassom').campos.calibracao).toBe('2026-03-15');
    expect(lerFicha('', 'laser').achados).toHaveLength(0);
    const r = lerFicha('texto sem números úteis', 'laser');
    expect(r.achados).toHaveLength(0);
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});

describe('guia de recursos', () => {
  const condicoesPorModalidade: Record<string, string[]> = {
    laser: CONDICOES_LASER.map((c) => c.id),
    ultrassom: CONDICOES_US.map((c) => c.id),
    ondas_choque: CONDICOES_ESWT.map((c) => c.id),
    tens: CONDICOES_TENS.map((c) => c.id),
    nmes: CONDICOES_NMES.map((c) => c.id),
    russa: CONDICOES_RUSSA.map((c) => c.id),
    interferencial: CONDICOES_IFC.map((c) => c.id),
  };
  it('toda indicação aponta para uma condição que existe na calculadora', () => {
    for (const p of PATOLOGIAS) for (const i of p.indicacoes) {
      expect(condicoesPorModalidade[i.modalidade], `${p.id}/${i.modalidade}`).toContain(i.calc);
    }
  });
  it('toda fonte do guia existe no catálogo e as faixas são válidas', () => {
    for (const p of PATOLOGIAS) for (const i of p.indicacoes) {
      expect(FAIXAS[i.faixa]).toBeTruthy();
      expect(i.fontes.length, `${p.id}/${i.modalidade} sem fonte`).toBeGreaterThan(0);
      for (const f of i.fontes) expect(referencia(f), `fonte ausente: ${f}`).toBeTruthy();
    }
  });
  it('ids únicos e nenhuma modalidade repetida na mesma patologia', () => {
    expect(new Set(PATOLOGIAS.map((p) => p.id)).size).toBe(PATOLOGIAS.length);
    for (const p of PATOLOGIAS) expect(new Set(p.indicacoes.map((i) => i.modalidade)).size, p.id).toBe(p.indicacoes.length);
  });
  it('ordena da melhor para a pior faixa e mantém a ordem dos dados no empate', () => {
    const joelho = indicacoesOrdenadas(patologia('joelho_oa')!);
    expect(joelho[0].modalidade).toBe('laser');
    expect(joelho.map((i) => i.faixa)).toEqual(['A', 'B', 'B', 'B']);
    const ombro = indicacoesOrdenadas(patologia('ombro_manguito_impacto')!);
    expect(ombro.map((i) => i.faixa)).toEqual(['B', 'C', 'D', 'D']);
    const cervical = indicacoesOrdenadas(patologia('cervical')!).map((i) => i.modalidade);
    expect(cervical).toEqual(['ondas_choque', 'interferencial', 'tens', 'laser', 'ultrassom']);
  });
  it('lista as modalidades sem dados levantados', () => {
    const todas = MODALIDADES.map((m) => m.id);
    const sem = modalidadesSemDados(patologia('fascite_plantar')!, todas);
    expect(sem).not.toContain('laser');
    expect(sem).toContain('tens');
  });
  it('entende a descrição do paciente, com e sem acento', () => {
    expect(interpretarDescricao('Paciente com dor no joelho por artrose')[0].id).toBe('joelho_oa');
    expect(interpretarDescricao('TENDINITE PATELAR em atleta')[0].id).toBe('tendinopatia_patelar_aquiles');
    expect(interpretarDescricao('fascite plantar com esporão')[0].id).toBe('fascite_plantar');
    expect(interpretarDescricao('AVC há 2 anos com pé caído')[0].id).toBe('pe_caido_avc');
    expect(interpretarDescricao('esclerose múltipla, pé caído')[0].id).toBe('pe_caido_em');
    expect(interpretarDescricao('cervicalgia e torcicolo')[0].id).toBe('cervical');
    expect(interpretarDescricao('lombalgia aguda ontem')[0].id).toBe('lombar_aguda');
    expect(interpretarDescricao('lombalgia crônica há 1 ano')[0].id).toBe('lombar_cronica');
    expect(interpretarDescricao('pós-operatório de artroplastia total de joelho').map((r) => r.id)).toContain('quadriceps_pos_atj');
  });
  it('não inventa: texto sem relação ou muito curto devolve vazio', () => {
    expect(interpretarDescricao('paciente simpático e pontual')).toHaveLength(0);
    expect(interpretarDescricao('ab')).toHaveLength(0);
  });
});

describe('guia a partir do prontuário', () => {
  it('lê queixa, avatar e diagnósticos, e ignora texto que não é clínico', () => {
    const r = interpretarProntuario([
      { origem: 'Queixa principal', texto: 'Dor no calcanhar ao acordar' },
      { origem: 'Avatar clínico', texto: 'Fascite plantar à direita' },
      { origem: 'Medicamentos em uso', texto: 'Dor lombar crônica (não deveria contar)' },
    ]);
    expect(r[0].id).toBe('fascite_plantar');
    expect(r[0].origens).toEqual(['Queixa principal', 'Avatar clínico']);
    expect(r.some((x) => x.id === 'lombar_cronica')).toBe(false);
  });
});

describe('busca de ficha técnica (validação do que a IA devolve)', () => {
  const boa = {
    confere_modelo: { valor: true, trecho: 'Laser LaserPulse 808 nm da Ibramed' },
    comprimento_onda: { valor: 808, unidade: 'nm', trecho: 'Comprimento de onda: 808 nm' },
    potencia_media: { valor: 0.1, unidade: 'W', trecho: 'Potência de saída 0,1 W' },
    area_feixe: { valor: 3, unidade: 'mm2', trecho: 'Área do spot: 3 mm2' },
    modo: { valor: 'Contínuo', trecho: 'emissão contínua (CW)' },
  };
  it('aceita valores com trecho e converte unidades (W→mW, mm²→cm²)', () => {
    const r = validarFicha(boa, 'laser');
    expect(r.modeloConfere).toBe(true);
    expect(r.campos.nm).toBe('808');
    expect(r.campos.potMedia).toBe('100');
    expect(r.campos.areaFeixe).toBe('0,03');
    expect(r.campos.modoLaser).toBe('continuo');
    expect(r.evidencias.nm).toMatch(/808 nm/);
  });
  it('descarta o campo cujo número não está no trecho (alucinação)', () => {
    const r = validarFicha({ ...boa, comprimento_onda: { valor: 810, unidade: 'nm', trecho: 'Comprimento de onda: 808 nm' } }, 'laser');
    expect(r.campos.nm).toBeUndefined();
    expect(r.descartados.join(' ')).toMatch(/não aparece no trecho/);
  });
  it('descarta sem trecho, unidade errada ou valor implausível', () => {
    const r = validarFicha({
      confere_modelo: { valor: true, trecho: 'modelo exato citado' },
      comprimento_onda: { valor: 5000, unidade: 'nm', trecho: 'comprimento 5000 nm' },
      potencia_media: { valor: 100, unidade: 'cm2', trecho: 'potência 100 cm2' },
      potencia_pico: { valor: 50, unidade: 'mW', trecho: '' },
    }, 'laser');
    expect(Object.keys(r.campos)).toHaveLength(0);
    expect(r.descartados).toHaveLength(3);
  });
  it('sem confirmar o modelo exato, não devolve nada', () => {
    expect(validarFicha({ ...boa, confere_modelo: { valor: false, trecho: '' } }, 'laser').campos).toEqual({});
    expect(validarFicha({ ...boa, confere_modelo: { valor: true, trecho: '' } }, 'laser').modeloConfere).toBe(false);
    expect(validarFicha(null, 'laser').campos).toEqual({});
  });
  it('ultrassom: só 1 ou 3 MHz, ERA em cm²', () => {
    const r = validarFicha({
      confere_modelo: { valor: true, trecho: 'Transdutor modelo exato' },
      frequencia: { valor: 3, unidade: 'MHz', trecho: 'Frequência: 3 MHz' },
      era: { valor: 4.2, unidade: 'cm2', trecho: 'ERA 4,2 cm2' },
      bnr: { valor: 5.1, unidade: '', trecho: 'BNR máx. 5,1' },
    }, 'ultrassom');
    expect(r.campos).toEqual({ freq: '3', era: '4,2', bnr: '5,1' });
    expect(validarFicha({ confere_modelo: { valor: true, trecho: 'modelo exato aqui' }, frequencia: { valor: 2, unidade: 'MHz', trecho: 'frequência 2 MHz' } }, 'ultrassom').campos.freq).toBeUndefined();
  });
  it('ondas de choque: tipo, área focal em mm² e limites', () => {
    const r = validarFicha({
      confere_modelo: { valor: true, trecho: 'Aplicador focal modelo exato' },
      tipo: { valor: 'focal', trecho: 'onda de choque focal' },
      area_focal: { valor: 0.28, unidade: 'cm2', trecho: 'área focal 0,28 cm2' },
      efd_maxima: { valor: 0.55, unidade: 'mJ/mm2', trecho: 'até 0,55 mJ/mm2' },
    }, 'ondas_choque');
    expect(r.campos.tipoOnda).toBe('focal');
    expect(r.campos.areaFocal).toBe('28');
    expect(r.campos.efdMax).toBe('0,55');
  });
  it('extrai JSON mesmo dentro de cercas de código e ignora lixo', () => {
    expect(extrairJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extrairJson('Segue: {"a": {"b": 2}} fim')).toEqual({ a: { b: 2 } });
    expect(extrairJson('sem json')).toBeNull();
    expect(extrairJson('{quebrado')).toBeNull();
  });
  it('o prompt exige trecho literal e modelo exato', () => {
    const p = montarPrompt({ fabricante: 'Ibramed', modelo: 'LaserPulse', tipo: 'laser' });
    expect(p).toMatch(/LITERAL/);
    expect(p).toMatch(/EXATAMENTE deste modelo/);
    expect(p).toMatch(/Ibramed/);
  });
});

describe('análise angular', () => {
  const P = (x: number, y: number) => ({ x, y });
  it('ângulo interno em três pontos', async () => {
    const m = await import('../lib/angular/medidas');
    expect(m.anguloEm(P(0, 1), P(0, 0), P(1, 0))).toBeCloseTo(90, 6);
    expect(m.anguloEm(P(-1, 0), P(0, 0), P(1, 0))).toBeCloseTo(180, 6);
    expect(m.anguloEm(P(0, 0), P(0, 0), P(1, 0))).toBeNull();
  });
  it('retas em relação à horizontal e à vertical', async () => {
    const m = await import('../lib/angular/medidas');
    expect(m.anguloComHorizontal(P(0, 0), P(10, 10))).toBeCloseTo(45, 6);
    expect(m.anguloComHorizontal(P(10, 0), P(0, 10))).toBeCloseTo(45, 6);
    expect(m.desvioDaVertical(P(0, 0), P(0, 50))).toBeCloseTo(0, 6);
    expect(m.desvioDaVertical(P(0, 0), P(50, 50))).toBeCloseTo(45, 6);
  });
  it('o lado mais alto é o do paciente, em qualquer vista', async () => {
    const m = await import('../lib/angular/medidas');
    const ombros = m.MEDIDAS.find((x) => x.id === 'ombros')!;
    // y menor = mais alto na imagem; o direito do paciente está mais alto
    expect(ombros.calcular([P(10, 90), P(100, 100)])!.texto).toContain('lado direito mais alto');
    expect(ombros.calcular([P(10, 100), P(100, 90)])!.texto).toContain('lado esquerdo mais alto');
    expect(ombros.calcular([P(10, 100), P(100, 100)])!.valor).toBe(0);
  });
  it('toda medida declara pontos e retorna null com pontos coincidentes', async () => {
    const m = await import('../lib/angular/medidas');
    for (const med of m.MEDIDAS) {
      expect(med.pontos.length).toBeGreaterThanOrEqual(2);
      expect(med.calcular(med.pontos.map(() => P(5, 5)))).toBeNull();
    }
  });
});

describe('marcação automática', () => {
  const lm = (over: Record<number, [number, number, number?]>) => {
    const a = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
    for (const [i, [x, y, v]] of Object.entries(over)) a[Number(i)] = { x, y, visibility: v ?? 0.9 };
    return a;
  };
  it('de frente mapeia ombros, pelve, cabeça, tronco e joelhos pelo lado do paciente', async () => {
    const { pontosAutomaticos } = await import('../lib/angular/pose');
    const r = pontosAutomaticos(lm({ 12: [0.4, 0.3], 11: [0.6, 0.31], 24: [0.45, 0.6], 23: [0.55, 0.6], 8: [0.42, 0.1], 7: [0.58, 0.1], 26: [0.45, 0.75], 28: [0.45, 0.9] }), 'frente', 1000, 2000);
    expect(r.ombros).toEqual([{ x: 400, y: 600 }, { x: 600, y: 620 }]);
    expect(r.pelve).toHaveLength(2);
    expect(r.cabeca).toHaveLength(2);
    expect(r.tronco).toHaveLength(2);
    expect(r['joelho-d']).toHaveLength(3);
    expect(r['joelho-e']).toBeUndefined();
  });
  it('ignora pontos pouco visíveis', async () => {
    const { pontosAutomaticos } = await import('../lib/angular/pose');
    const r = pontosAutomaticos(lm({ 12: [0.4, 0.3, 0.2], 11: [0.6, 0.3] }), 'costas', 100, 100);
    expect(r.ombros).toBeUndefined();
  });
  it('no perfil usa o lado mais visível e não preenche o craniovertebral', async () => {
    const { pontosAutomaticos } = await import('../lib/angular/pose');
    const r = pontosAutomaticos(lm({ 11: [0.5, 0.3, 0.3], 23: [0.5, 0.6, 0.3], 25: [0.5, 0.75, 0.3], 27: [0.5, 0.9, 0.3], 12: [0.52, 0.3], 24: [0.52, 0.6], 26: [0.52, 0.75], 28: [0.52, 0.9] }), 'perfil', 100, 100);
    expect(r.joelho![0].x).toBeCloseTo(52, 6);
    expect(r.cva).toBeUndefined();
  });
});

describe('comparação entre avaliações', () => {
  it('calcula a variação só quando as duas avaliações têm a medida', async () => {
    const { compararMedidas, variacaoTexto, grau } = await import('../lib/angular/comparar');
    const r = compararMedidas(
      [{ id: 'ombros', graus: 2.1 }, { id: 'pelve', graus: 1 }],
      [{ id: 'ombros', graus: 3.4 }, { id: 'cabeca', graus: 5 }],
    );
    expect(r.find((l) => l.id === 'ombros')!.variacao).toBe(-1.3);
    expect(r.find((l) => l.id === 'pelve')!.variacao).toBeNull();
    expect(r.find((l) => l.id === 'cabeca')!.atual).toBeNull();
    expect(variacaoTexto(-1.3)).toBe('−1,3°');
    expect(variacaoTexto(0)).toBe('0,0°');
    expect(grau(null)).toBe('—');
  });
});

// Em jsdom a imagem da logo nunca carrega e travaria o teste.
vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: async () => {} }));

describe('PDF da análise angular', () => {
  it('gera um PDF com e sem avaliação anterior', async () => {
    const { gerarRelatorioAngular } = await import('../lib/angular/relatorio');
    const base = { paciente: 'Maria da Conceição', data: '05/10/2026', vistaNome: 'frente', metodo: 'marcacao_manual' as const, medidas: [{ id: 'ombros', graus: 2.1, texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' }] };
    const a = await gerarRelatorioAngular(base);
    const b = await gerarRelatorioAngular({ ...base, anterior: { data: '01/09/2026', medidas: [{ id: 'ombros', graus: 3.4 }] } });
    expect(a.nome).toBe('Analise_angular_MARIA_DA_CONCEICAO_2026-10-05.pdf');
    expect(a.blob.size).toBeGreaterThan(1000);
    expect(b.blob.size).toBeGreaterThan(a.blob.size - 200);
  });
});
