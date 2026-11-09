import { describe, expect, it } from 'vitest';
import { paraGravar, type CanalEmg, type ResumoSessao } from '@/lib/emg/sessao';
import { resumoCurto, resumoExame } from '@/lib/examesPresenciais';

const LAUDO =
  'Eletromiografia (EMG) de superfície — Quadríceps D\n\nMedida de apoio à avaliação, feita com sensor de EMG de superfície sem fio.';

type Obj = Record<string, unknown>;

function contracao(picoUv: number, picoPctCvm: number | null): Obj {
  return { inicioS: 1, fimS: 3, duracaoS: 2, picoUv, rmsMedioUv: picoUv / 2, picoPctCvm, rmsMedioPctCvm: null };
}

// Formato gravado em dados.analise (DadosExameEmg v1), escrito à mão.
function analise(resumo: Obj = {}, canal: Obj = {}): Obj {
  return {
    versao: 1,
    fsHz: 1000,
    canais: [{ id: '1', musculo: 'Quadríceps', lado: 'D' }],
    resumo: {
      canal: { id: '1', musculo: 'Quadríceps', lado: 'D', ...canal },
      duracaoRepousoS: 5,
      duracaoTarefaS: 20,
      linhaDeBase: { mediaUv: 2, desvioUv: 0.2, limiarUv: 3, pisoPicoUv: 7 },
      cvmUv: 245.3,
      contracoes: [contracao(100, 40), contracao(155, 63.4), contracao(90, 36), contracao(120, 48)],
      picoPctCvmMax: 63.4,
      ...resumo,
    },
    etapas: [],
    observacoes: null,
  };
}

function lista(a: unknown, extra: Obj = {}): string {
  return resumoCurto('eletromiografia', { resultado: LAUDO, analise: a, ...extra });
}

describe('lista do histórico — eletromiografia', () => {
  it('mostra músculo, lado, CVM, nº de contrações e pico em % da CVM, não o texto do laudo', () => {
    const t = lista(analise());
    expect(t).toBe('EMG de superfície — Quadríceps D: CVM de 245 µV; 4 contrações, pico de 63 % da CVM.');
    expect(t).not.toContain('Medida de apoio');
  });

  it('usa vírgula e uma casa na CVM abaixo de 100 µV, e singular com uma contração', () => {
    const t = lista(analise({ cvmUv: 45.3, contracoes: [contracao(45.3, 100)], picoPctCvmMax: 100 }));
    expect(t).toBe('EMG de superfície — Quadríceps D: CVM de 45,3 µV; 1 contração, pico de 100 % da CVM.');
  });

  it('lado E acrescenta E; sem lado fica só o músculo; sem músculo usa o id do canal', () => {
    expect(lista(analise({}, { musculo: 'Glúteo médio', lado: 'E' }))).toMatch(/^EMG de superfície — Glúteo médio E: /);
    expect(lista(analise({}, { musculo: 'Reto abdominal', lado: '-' }))).toMatch(/^EMG de superfície — Reto abdominal: /);
    expect(lista(analise({}, { musculo: '  ', id: '4', lado: '-' }))).toMatch(/^EMG de superfície — canal 4: /);
    expect(lista(analise({}, { musculo: ' Bíceps ', lado: 'D' }))).toMatch(/^EMG de superfície — Bíceps D: /);
  });

  it('sem CVM: mostra o maior pico em µV e avisa que não é comparável', () => {
    const t = lista(analise({ cvmUv: null, picoPctCvmMax: null, contracoes: [contracao(120.4, null), contracao(80, null)] }));
    expect(t).toBe(
      'EMG de superfície — Quadríceps D: sem CVM registrada; 2 contrações, pico de 120 µV absolutos (sem normalização pela CVM; não comparáveis entre pessoas ou sessões).',
    );
  });

  it('diz o que faltou quando não há contrações para contar', () => {
    expect(lista(analise({ duracaoTarefaS: 0, contracoes: [], picoPctCvmMax: null }))).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; tarefa não gravada.',
    );
    expect(lista(analise({ linhaDeBase: null, contracoes: [], picoPctCvmMax: null }))).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; contrações não detectadas (sem repouso utilizável).',
    );
    expect(lista(analise({ contracoes: [], picoPctCvmMax: null }))).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; nenhuma contração detectada na tarefa.',
    );
  });

  it('encurta nome de músculo muito longo', () => {
    const t = lista(analise({}, { musculo: 'M'.repeat(70) }));
    expect(t.startsWith(`EMG de superfície — ${'M'.repeat(60)}… D: `)).toBe(true);
  });

  it('lê o JSON que o módulo grava de verdade (paraGravar, depois ida e volta pelo banco)', () => {
    const canal: CanalEmg = { id: '1', musculo: 'Quadríceps', lado: 'D' };
    const resumo: ResumoSessao = {
      canal,
      duracaoRepousoS: 5,
      duracaoTarefaS: 20,
      ruidoBasalRmsUv: 1.8,
      repousoRmsUv: 2,
      qualidade: null,
      linhaDeBase: { mediaUv: 2, desvioUv: 0.2, limiarUv: 3, pisoPicoUv: 7 },
      tentativasCvm: 1,
      cvmPorTentativaUv: [245.3],
      cvmUv: 245.3,
      contracoes: [
        { inicioS: 1, fimS: 3, duracaoS: 2, picoUv: 100, rmsMedioUv: 60, picoPctCvm: 40.8, rmsMedioPctCvm: 24.5 },
        { inicioS: 6, fimS: 8, duracaoS: 2, picoUv: 155, rmsMedioUv: 90, picoPctCvm: 63.4, rmsMedioPctCvm: 36.7 },
      ],
      picoPctCvmMax: 63.4,
      avisos: [],
    };
    const dados = JSON.parse(JSON.stringify({ resultado: LAUDO, analise: paraGravar(resumo, [], 1000, canal) })) as Obj;
    expect(resumoCurto('eletromiografia', dados)).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; 2 contrações, pico de 63 % da CVM.',
    );
  });
});

describe('lista do histórico — eletromiografia sem análise legível (comportamento anterior)', () => {
  const longo = 'x'.repeat(100);
  const antigo = `${'x'.repeat(90)}…`;

  const quebrados: Array<[string, unknown]> = [
    ['sem analise', undefined],
    ['analise null', null],
    ['analise texto', 'texto'],
    ['analise número', 5],
    ['analise lista', []],
    ['versão futura', { ...analise(), versao: 2 }],
    ['versão como texto', { ...analise(), versao: '1' }],
    ['sem versão', { ...analise(), versao: undefined }],
    ['resumo null', { versao: 1, resumo: null }],
    ['sem resumo', { versao: 1 }],
    ['canal null', analise({ canal: null })],
    ['músculo não é texto', analise({}, { musculo: 7 })],
    ['lado inválido', analise({}, { lado: 'X' })],
    ['sem músculo e sem id', analise({}, { musculo: '', id: undefined })],
    ['CVM ausente', analise({ cvmUv: undefined })],
    ['CVM NaN', analise({ cvmUv: Number.NaN })],
    ['CVM como texto', analise({ cvmUv: '245' })],
    ['pico % como texto', analise({ picoPctCvmMax: '63' })],
    ['pico % ausente', analise({ picoPctCvmMax: undefined })],
    ['duração da tarefa ausente', analise({ duracaoTarefaS: undefined })],
    ['linha de base ausente', analise({ linhaDeBase: undefined })],
    ['linha de base texto', analise({ linhaDeBase: 'ok' })],
    ['contrações não é lista', analise({ contracoes: 'quatro' })],
    ['contração null', analise({ contracoes: [null] })],
    ['contração sem pico', analise({ contracoes: [{ inicioS: 1 }] })],
    ['pico da contração como texto', analise({ contracoes: [{ picoUv: '100' }] })],
  ];

  it.each(quebrados)('%s: não lança e mostra o começo do texto do resultado', (_nome, a) => {
    expect(lista(a, { resultado: longo })).toBe(antigo);
  });

  it('sem análise e sem resultado, mostra só o nome do exame', () => {
    expect(resumoCurto('eletromiografia', {})).toBe('Eletromiografia');
    expect(resumoCurto('eletromiografia', { analise: null })).toBe('Eletromiografia');
  });
});

describe('lista do histórico — outros exames não mudam', () => {
  it('bioimpedância continua com os campos de destaque', () => {
    expect(resumoCurto('bioimpedancia', { peso_kg: 80, gordura_pct: 22, massa_muscular_kg: 31.5, gordura_visceral: 6 })).toBe(
      'Peso 80 kg · % de gordura 22 % · Massa muscular esquelética 31.5 kg · Nível de gordura visceral 6',
    );
  });

  it('dinamometria e baropodometria continuam mostrando o começo do resultado, mesmo com analise no JSON', () => {
    const analiseEmg = analise();
    const longo = 'y'.repeat(100);
    const antigo = `${'y'.repeat(90)}…`;
    expect(resumoCurto('dinamometria', { resultado: longo, analise: analiseEmg })).toBe(antigo);
    expect(resumoCurto('baropodometria', { resultado: longo, analise: analiseEmg })).toBe(antigo);
    expect(resumoCurto('dinamometria', { resultado: 'Preensão D 30 kgf', analise: analiseEmg })).toBe('Preensão D 30 kgf');
  });

  it('teste de pisada, tipo desconhecido e resumoExame do EMG ficam como antes', () => {
    expect(resumoCurto('teste_pisada', { pisada_direita: 'neutra', tipo_arco: 'plano' })).toBe(
      'Pisada (pé direito) neutra · Tipo de arco plano',
    );
    expect(resumoCurto('inexistente', { resultado: 'abc' })).toBe('');
    expect(resumoExame('eletromiografia', { resultado: 'abc', analise: analise() })).toBe('Eletromiografia: resultado abc');
  });
});
