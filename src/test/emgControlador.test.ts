import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControladorEmg, LIMITE_SEM_DADOS_MS, MAX_TENTATIVAS_CVM, type EventoControlador } from '../components/emg/controlador';
import type { LoteDeAmostras } from '../lib/emg/moduloEmg';
import { resumirSessao } from '../lib/emg/sessao';

// Os números esperados saem de contas simples (amostras = taxa x segundos), não do código testado.

let agoraMs = 0;

function lote(n: number, opcoes: { fsHz?: number; primeiro?: number; bruto?: number } = {}): LoteDeAmostras {
  const { fsHz = 500, primeiro = 0, bruto = 7 } = opcoes;
  // A amostra de índice i vale primeiro + i: dá para saber exatamente quais entraram numa gravação.
  const filtradas = Float64Array.from({ length: n }, (_, i) => primeiro + i);
  return { brutas: new Float64Array(n).fill(bruto), filtradas, tsMs: 0, fsHz };
}

function criar(opcoes: { preparoS?: number; repousoS?: number; cvmS?: number } = {}): { c: ControladorEmg; eventos: EventoControlador[] } {
  const c = new ControladorEmg({ agora: () => agoraMs, preparoS: 1, repousoS: 2, cvmS: 2, ...opcoes });
  const eventos: EventoControlador[] = [];
  c.ouvir((e) => eventos.push(e));
  return { c, eventos };
}

beforeEach(() => {
  agoraMs = 1_000_000;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ControladorEmg: entrada de sinal', () => {
  it('sem lote recebido não há taxa e não dá para iniciar etapa', () => {
    const { c } = criar();
    expect(c.fsHz).toBeNull();
    expect(c.fsSessao).toBeNull();
    expect(c.etapas).toEqual([]);
    expect(() => c.iniciarEtapa('repouso')).toThrow('Ainda não chegou sinal do módulo.');
    expect(c.estado()).toEqual({ fase: 'parada', tipo: null, numero: 0, decorridoS: 0, alvoS: null, descansoRestanteS: null });
  });

  it('guarda o sinal filtrado e o bruto em buffers separados e conta lotes e amostras', () => {
    const { c } = criar();
    c.aoAmostras(lote(50, { fsHz: 500, bruto: 123 }));
    c.aoAmostras(lote(30, { fsHz: 500, primeiro: 100, bruto: 123 }));
    expect(c.fsHz).toBe(500);
    expect(c.lotesRecebidos).toBe(2);
    expect(c.amostrasRecebidas).toBe(80);
    expect(c.bufferVivo.comprimento).toBe(80);
    expect(Array.from(c.bufferVivo.ultimas(2))).toEqual([128, 129]);
    expect(Array.from(c.bufferBruto.ultimas(2))).toEqual([123, 123]);
  });

  it('o buffer vivo guarda só os últimos 10 s (a 1000 Hz, 10000 amostras), mas conta tudo', () => {
    const { c } = criar();
    c.aoAmostras(lote(12_000, { fsHz: 1000 }));
    expect(c.bufferVivo.comprimento).toBe(10_000);
    expect(c.bufferVivo.totalRecebido).toBe(12_000);
    expect(c.bufferVivo.ultimas(1)[0]).toBe(11_999);
    // O bruto guarda só 2 s.
    expect(c.bufferBruto.comprimento).toBe(2000);
  });

  it('lote vazio é ignorado: nem a taxa muda', () => {
    const { c } = criar();
    c.aoAmostras(lote(0, { fsHz: 1000 }));
    expect(c.fsHz).toBeNull();
    expect(c.lotesRecebidos).toBe(0);
  });

  it('sinalRecente: média, RMS, mínimo e máximo dos últimos instantes; valores não finitos ficam de fora', () => {
    const { c } = criar();
    const filtradas = Float64Array.from([3, Number.NaN, 4, Number.POSITIVE_INFINITY]);
    c.aoAmostras({ brutas: Float64Array.from([10, 10, 10, 10]), filtradas, tsMs: 0, fsHz: 2 });
    const s = c.sinalRecente(2);
    expect(s.filtrado).not.toBeNull();
    expect(s.filtrado!.amostras).toBe(2);
    expect(s.filtrado!.media).toBeCloseTo(3.5, 12);
    expect(s.filtrado!.rms).toBeCloseTo(Math.sqrt((9 + 16) / 2), 12);
    expect(s.filtrado!.min).toBe(3);
    expect(s.filtrado!.max).toBe(4);
    expect(s.bruto).toEqual({ amostras: 4, media: 10, rms: 10, min: 10, max: 10 });
  });

  it('sinalRecente sem lote ou só com lixo devolve nulos', () => {
    const { c } = criar();
    expect(c.sinalRecente()).toEqual({ filtrado: null, bruto: null });
    c.aoAmostras({ brutas: Float64Array.from([Number.NaN]), filtradas: Float64Array.from([Number.NaN]), tsMs: 0, fsHz: 500 });
    expect(c.sinalRecente()).toEqual({ filtrado: null, bruto: null });
  });

  it('taxa medida: amostras por segundo de relógio, só depois de 2 s de dados', () => {
    const { c } = criar();
    expect(c.taxaMedidaHz()).toBeNull();
    // 50 amostras a cada 100 ms = 500 amostras por segundo.
    for (let i = 0; i <= 30; i++) {
      c.aoAmostras(lote(50));
      if (i === 10) expect(c.taxaMedidaHz()).toBeNull();
      if (i === 20) expect(c.taxaMedidaHz()).toBeCloseTo(500, 9);
      agoraMs += 100;
    }
    // Último lote entrou 3 s depois do primeiro; as 50 amostras do 1º não contam (não houve tempo antes dele).
    expect(c.taxaMedidaHz()).toBeCloseTo((31 * 50 - 50) / 3, 9);
  });

  it('novaConexao zera sinal e contadores, cancela etapa em andamento e mantém as etapas gravadas', () => {
    const { c, eventos } = criar({ preparoS: 0 });
    c.aoAmostras(lote(10));
    c.iniciarEtapa('repouso');
    c.aoAmostras(lote(1000));
    expect(c.etapas).toHaveLength(1);
    c.iniciarEtapa('cvm');
    eventos.length = 0;

    c.novaConexao();
    expect(c.estado().fase).toBe('parada');
    expect(c.etapas).toHaveLength(1);
    expect(c.fsHz).toBeNull();
    expect(c.lotesRecebidos).toBe(0);
    expect(c.amostrasRecebidas).toBe(0);
    expect(c.bufferVivo.comprimento).toBe(0);
    expect(c.bufferBruto.comprimento).toBe(0);
    expect(c.taxaMedidaHz()).toBeNull();
    expect(eventos.some((e) => e.tipo === 'fase' && e.fase === 'parada')).toBe(true);
  });
});

describe('ControladorEmg: etapas do protocolo', () => {
  it('repouso: preparo de 1 s (500 amostras), depois 2 s gravados (1000 amostras), na contagem exata', () => {
    const { c, eventos } = criar();
    c.aoAmostras(lote(10));
    c.iniciarEtapa('repouso');
    expect(c.estado()).toMatchObject({ fase: 'preparo', tipo: 'repouso', numero: 1, decorridoS: 0, alvoS: 1 });

    c.aoAmostras(lote(250));
    expect(c.estado()).toMatchObject({ fase: 'preparo', decorridoS: 0.5, alvoS: 1 });
    c.aoAmostras(lote(249));
    expect(c.estado()).toMatchObject({ fase: 'preparo' });
    // A 500ª amostra do preparo fecha a contagem: começa a gravar, ainda sem nada gravado.
    c.aoAmostras(lote(1));
    expect(c.estado()).toMatchObject({ fase: 'gravando', tipo: 'repouso', decorridoS: 0, alvoS: 2 });
    c.aoAmostras(lote(500));
    expect(c.estado()).toMatchObject({ fase: 'gravando', decorridoS: 1, alvoS: 2 });
    expect(c.etapas).toHaveLength(0);
    c.aoAmostras(lote(500));

    expect(c.estado().fase).toBe('parada');
    expect(c.etapas).toHaveLength(1);
    expect(c.etapas[0]).toMatchObject({ tipo: 'repouso', numero: 1, duracaoS: 2 });
    expect(c.etapas[0].amostras).toHaveLength(1000);
    expect(c.fsSessao).toBe(500);
    expect(eventos.map((e) => e.tipo)).toEqual(['fase', 'fase', 'fase', 'etapa-finalizada', 'etapas-mudaram']);
    expect(eventos.filter((e) => e.tipo === 'fase').map((e) => (e as { fase: string }).fase)).toEqual(['preparo', 'gravando', 'parada']);
  });

  it('um lote que atravessa o preparo e a gravação grava só as amostras depois do preparo, e só até o alvo', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    // 500 de preparo (valores 0..499), 1000 gravados (500..1499) e 300 a mais (1500..1799) que NÃO podem entrar.
    c.aoAmostras(lote(1800));
    const [etapa] = c.etapas;
    expect(etapa.amostras).toHaveLength(1000);
    expect(etapa.amostras[0]).toBe(500);
    expect(etapa.amostras[999]).toBe(1499);
    expect(c.estado().fase).toBe('parada');
  });

  it('sem preparo (0 s) a gravação começa na hora', () => {
    const { c } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1));
    c.iniciarEtapa('cvm');
    expect(c.estado()).toMatchObject({ fase: 'gravando', tipo: 'cvm', numero: 1, alvoS: 2 });
    c.aoAmostras(lote(1000));
    expect(c.etapas[0].amostras[0]).toBe(0);
  });

  it('não deixa começar outra etapa enquanto uma está em andamento', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    expect(() => c.iniciarEtapa('cvm')).toThrow('Já há uma etapa em andamento: espere ou cancele.');
  });

  it('CVM: tentativas numeradas, descanso de 30 s só entre as 3 primeiras e limite de 6', () => {
    const { c } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1));
    for (let i = 1; i <= 3; i++) {
      c.iniciarEtapa('cvm');
      expect(c.estado().numero).toBe(i);
      c.aoAmostras(lote(1000));
      agoraMs += 10_000;
      if (i < 3) {
        // 10 s depois da tentativa: faltam 20 s dos 30 sugeridos.
        expect(c.estado().descansoRestanteS).toBeCloseTo(20, 9);
      } else {
        expect(c.estado().descansoRestanteS).toBeNull();
      }
    }
    expect(c.quantas('cvm')).toBe(3);
    expect(c.etapas.map((e) => e.numero)).toEqual([1, 2, 3]);

    for (let i = 4; i <= MAX_TENTATIVAS_CVM; i++) {
      c.iniciarEtapa('cvm');
      c.aoAmostras(lote(1000));
    }
    expect(MAX_TENTATIVAS_CVM).toBe(6);
    expect(c.quantas('cvm')).toBe(6);
    expect(() => c.iniciarEtapa('cvm')).toThrow('O limite é de 6 tentativas de CVM: refaça a última.');
  });

  it('o descanso sugerido acaba em 30 s e some quando começa outra etapa', () => {
    const { c } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1));
    c.iniciarEtapa('cvm');
    c.aoAmostras(lote(1000));
    agoraMs += 29_000;
    expect(c.estado().descansoRestanteS).toBeCloseTo(1, 9);
    agoraMs += 1_000;
    expect(c.estado().descansoRestanteS).toBeNull();
    agoraMs += 5_000;
    c.iniciarEtapa('repouso');
    expect(c.estado().descansoRestanteS).toBeNull();
  });

  it('tarefa: grava até o usuário parar, com alvo nulo, e guarda tudo o que foi gravado', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('tarefa');
    c.aoAmostras(lote(500)); // preparo
    c.aoAmostras(lote(1234));
    expect(c.estado()).toMatchObject({ fase: 'gravando', tipo: 'tarefa', alvoS: null });
    expect(c.estado().decorridoS).toBeCloseTo(1234 / 500, 9);

    c.finalizarTarefa();
    expect(c.estado().fase).toBe('parada');
    expect(c.etapas[0].amostras).toHaveLength(1234);
    expect(c.etapas[0].tipo).toBe('tarefa');
  });

  it('parar a tarefa na contagem, antes de gravar, cancela sem guardar nada', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('tarefa');
    c.aoAmostras(lote(100));
    c.finalizarTarefa();
    expect(c.estado().fase).toBe('parada');
    expect(c.etapas).toHaveLength(0);
  });

  it('finalizarTarefa não mexe em repouso nem em CVM e não faz nada fora de etapa', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.finalizarTarefa();
    c.iniciarEtapa('repouso');
    c.aoAmostras(lote(600));
    c.finalizarTarefa();
    expect(c.estado()).toMatchObject({ fase: 'gravando', tipo: 'repouso' });
  });

  it('a tarefa tem teto de 15 min (900 s): a etapa fecha, guarda 900 s e avisa', () => {
    const { c, eventos } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1, { fsHz: 100 }));
    c.iniciarEtapa('tarefa');
    c.aoAmostras(lote(90_000 + 77, { fsHz: 100 }));
    expect(c.etapas[0].amostras).toHaveLength(90_000);
    expect(c.etapas[0].duracaoS).toBe(900);
    expect(eventos).toContainEqual({ tipo: 'aviso', texto: 'A tarefa chegou ao limite de 15 minutos e foi encerrada.' });
  });

  it('a tarefa que bate no teto sai marcada como cortada, também quando o lote fecha os 900 s sem sobra', () => {
    const canal = { id: '1', musculo: 'Quadríceps', lado: 'D' } as const;
    // 900 s a 100 Hz = 90 000 amostras. Lotes de 25 amostras (250 ms) fecham o teto exatamente, sem sobra.
    const exata = criar({ preparoS: 0 });
    exata.c.aoAmostras(lote(1, { fsHz: 100 }));
    exata.c.iniciarEtapa('tarefa');
    for (let i = 0; i < 3600; i++) exata.c.aoAmostras(lote(25, { fsHz: 100 }));
    expect(exata.c.etapas).toHaveLength(1);
    expect(exata.c.etapas[0].amostras).toHaveLength(90_000);
    expect(exata.c.etapas[0].truncada).toBe(true);
    const avisos = resumirSessao(exata.c.etapas, 100, canal).avisos;
    expect(avisos).toContain('A etapa "tarefa" atingiu o limite de 900 s e foi cortada: o que viesse depois não foi gravado.');

    // Com sobra no lote (o teto passa no meio de um lote) o resultado é o mesmo.
    const comSobra = criar({ preparoS: 0 });
    comSobra.c.aoAmostras(lote(1, { fsHz: 100 }));
    comSobra.c.iniciarEtapa('tarefa');
    comSobra.c.aoAmostras(lote(90_077, { fsHz: 100 }));
    expect(comSobra.c.etapas[0].truncada).toBe(true);
  });

  it('tarefa parada pelo usuário antes do teto, repouso e CVM não são marcados como cortados', () => {
    const canal = { id: '1', musculo: 'Quadríceps', lado: 'D' } as const;
    const { c } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1, { fsHz: 100 }));
    c.iniciarEtapa('repouso');
    c.aoAmostras(lote(200, { fsHz: 100 }));
    c.iniciarEtapa('cvm');
    c.aoAmostras(lote(200, { fsHz: 100 }));
    // Falta 1 amostra para os 900 s: o usuário para antes do teto.
    c.iniciarEtapa('tarefa');
    c.aoAmostras(lote(89_999, { fsHz: 100 }));
    expect(c.estado().fase).toBe('gravando');
    c.finalizarTarefa();
    expect(c.etapas.map((e) => e.truncada)).toEqual([false, false, false]);
    expect(resumirSessao(c.etapas, 100, canal).avisos.join(' ')).not.toMatch(/foi cortada/);
  });

  it('cancelarEtapa: volta a parada, avisa com o motivo e não grava; sem etapa não emite nada', () => {
    const { c, eventos } = criar();
    c.cancelarEtapa('nada');
    expect(eventos).toEqual([]);
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    eventos.length = 0;
    c.cancelarEtapa('Motivo qualquer.');
    expect(c.estado().fase).toBe('parada');
    expect(c.etapas).toHaveLength(0);
    expect(eventos).toEqual([
      { tipo: 'fase', fase: 'parada', etapa: null, numero: 0 },
      { tipo: 'aviso', texto: 'Motivo qualquer.' },
    ]);
    // O sinal que chega depois não é gravado.
    c.aoAmostras(lote(5000));
    expect(c.etapas).toHaveLength(0);
  });

  it('descartarParaRefazer: repouso e tarefa saem por inteiro; da CVM sai só a última; renumera e avisa', () => {
    const { c, eventos } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1));
    for (const tipo of ['repouso', 'cvm', 'cvm', 'tarefa'] as const) {
      c.iniciarEtapa(tipo);
      if (tipo === 'tarefa') {
        c.aoAmostras(lote(700));
        c.finalizarTarefa();
      } else {
        c.aoAmostras(lote(1000));
      }
    }
    expect(c.etapas.map((e) => `${e.tipo}${e.numero}`)).toEqual(['repouso1', 'cvm1', 'cvm2', 'tarefa1']);
    eventos.length = 0;

    expect(c.descartarParaRefazer('cvm')).toBe(1);
    expect(c.etapas.map((e) => `${e.tipo}${e.numero}`)).toEqual(['repouso1', 'cvm1', 'tarefa1']);
    expect(eventos).toEqual([{ tipo: 'etapas-mudaram' }]);

    expect(c.descartarParaRefazer('repouso')).toBe(1);
    expect(c.descartarParaRefazer('repouso')).toBe(0);
    expect(c.fsSessao).toBe(500);
    expect(c.descartarParaRefazer('tarefa')).toBe(1);
    expect(c.descartarParaRefazer('cvm')).toBe(1);
    expect(c.etapas).toEqual([]);
    expect(c.fsSessao).toBeNull();
  });

  it('descartarParaRefazer durante uma etapa é recusado', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    expect(() => c.descartarParaRefazer('repouso')).toThrow('Cancele a etapa em andamento antes de refazer.');
  });

  it('reiniciarSessao esquece tudo, cancela a etapa e avisa', () => {
    const { c, eventos } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    c.aoAmostras(lote(1000));
    c.iniciarEtapa('cvm');
    eventos.length = 0;
    c.reiniciarSessao('Recomeçando.');
    expect(c.etapas).toEqual([]);
    expect(c.fsSessao).toBeNull();
    expect(c.estado().fase).toBe('parada');
    expect(eventos.map((e) => e.tipo)).toEqual(['fase', 'etapas-mudaram', 'aviso']);
  });

  it('mudança da taxa do módulo no meio da sessão descarta as etapas (misturar 500 Hz e 1000 Hz estragaria a análise)', () => {
    const { c, eventos } = criar({ preparoS: 0 });
    c.aoAmostras(lote(1, { fsHz: 500 }));
    c.iniciarEtapa('repouso');
    c.aoAmostras(lote(1000, { fsHz: 500 }));
    expect(c.fsSessao).toBe(500);

    c.aoAmostras(lote(10, { fsHz: 1000 }));
    expect(c.etapas).toEqual([]);
    expect(c.fsSessao).toBeNull();
    const aviso = eventos.find((e) => e.tipo === 'aviso');
    expect(aviso).toMatchObject({ texto: expect.stringMatching(/taxa de amostragem do módulo mudou/) });

    // Nova sessão já na taxa nova.
    c.iniciarEtapa('repouso');
    c.aoAmostras(lote(2000, { fsHz: 1000 }));
    expect(c.fsSessao).toBe(1000);
  });
});

describe('ControladorEmg: vigia de sinal e eventos', () => {
  it('sem lote por mais de 2,5 s a etapa em andamento é cancelada; antes disso, não', () => {
    const { c, eventos } = criar();
    c.aoAmostras(lote(1));
    expect(c.verificarSemDados()).toBe(false);
    c.iniciarEtapa('repouso');
    agoraMs += LIMITE_SEM_DADOS_MS;
    expect(c.verificarSemDados()).toBe(false);
    agoraMs += 1;
    eventos.length = 0;
    expect(c.verificarSemDados()).toBe(true);
    expect(c.estado().fase).toBe('parada');
    expect(eventos).toContainEqual({ tipo: 'aviso', texto: 'O sinal parou de chegar durante a etapa, que foi descartada. Confira a conexão e refaça.' });
    expect(c.verificarSemDados()).toBe(false);
  });

  it('um lote que chega zera a espera da vigia', () => {
    const { c } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    agoraMs += 2000;
    c.aoAmostras(lote(10));
    agoraMs += 2000;
    expect(c.verificarSemDados()).toBe(false);
  });

  it('ouvir devolve a função que cancela; um ouvinte que lança não impede os outros', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { c } = criar();
    const recebidos: string[] = [];
    c.ouvir(() => {
      throw new Error('ouvinte com defeito');
    });
    const parar = c.ouvir((e) => recebidos.push(e.tipo));
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    expect(recebidos).toEqual(['fase']);
    expect(erro).toHaveBeenCalled();
    parar();
    c.cancelarEtapa();
    expect(recebidos).toEqual(['fase']);
  });

  it('destruir cancela a etapa e solta os ouvintes', () => {
    const { c, eventos } = criar();
    c.aoAmostras(lote(1));
    c.iniciarEtapa('repouso');
    c.destruir();
    expect(c.estado().fase).toBe('parada');
    eventos.length = 0;
    c.iniciarEtapa('repouso');
    expect(eventos).toEqual([]);
  });
});
