import { describe, it, expect } from 'vitest';
import {
  criadaComADataExplicita, dataDoDiagnosticoPodeSerDoSistema, erroDaDataDigitada,
} from '@/lib/resumoClinico/datas';
import { montarLinhaDoTempo } from '@/lib/resumoClinico/marcos';
import { FONTES_VAZIAS, INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO } from '@/lib/resumoClinico/tipos';
import type { LinhaBruta } from '@/lib/resumoClinico/tipos';

// O cartão de CID passou a enviar data_diagnostico sempre (a data escolhida ou null). Linha criada a partir do corte
// (meia-noite de 18/11/2026 no Brasil) não tem data preenchida pelo banco: o valor é do profissional e vale, mesmo igual ao
// dia do cadastro. Linha anterior ao corte (ou com created_at que não dá para ler) segue a regra antiga.

const HOJE = '2026-11-25';
const CORTE = '2026-11-18T03:00:00Z';
const NOTA_CADASTRO = 'A data do diagnóstico é a do dia do cadastro no app e pode ter sido preenchida pelo sistema';
const NOTA_NAO_INFORMADA = 'A data do diagnóstico não foi informada';
const NOTA_INVALIDA = 'A data do diagnóstico registrada não é válida';

const diag = (extra: LinhaBruta = {}): LinhaBruta => ({
  id: 'd', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', ativo: true, tipo: 'principal',
  data_diagnostico: '2019-03-04', created_at: '2026-11-20T15:00:00+00:00', ...extra,
});
const montar = (...linhas: LinhaBruta[]) => montarLinhaDoTempo({ ...FONTES_VAZIAS, diagnosticos: linhas }, HOJE);
const diasDosMarcos = (...linhas: LinhaBruta[]) => montar(...linhas).marcos.map((m) => m.data.iso);
const detalhesSemData = (...linhas: LinhaBruta[]) => montar(...linhas).semData.map((s) => s.detalhe);

describe('o corte: meia-noite de 18/11/2026 no Brasil', () => {
  it('a constante é o instante 2026-11-18T03:00:00Z', () => {
    expect(INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO).toBe(CORTE);
  });

  it('é exatamente a virada do dia 17 para o dia 18 no fuso do Brasil', () => {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
    const corte = Date.parse(INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO);
    expect(dia.format(new Date(corte - 1))).toBe('2026-11-17');
    expect(dia.format(new Date(corte))).toBe('2026-11-18');
  });
});

describe('criadaComADataExplicita (a linha é de depois do corte?)', () => {
  it.each([
    ['na virada exata, em UTC', '2026-11-18T03:00:00+00:00', true],
    ['na virada exata, com Z', '2026-11-18T03:00:00Z', true],
    ['na virada exata, com a hora do Brasil (meia-noite -03:00)', '2026-11-18T00:00:00-03:00', true],
    ['um segundo antes, em UTC', '2026-11-18T02:59:59+00:00', false],
    ['uma fração antes (microssegundos do PostgREST)', '2026-11-18T02:59:59.999999+00:00', false],
    ['um segundo antes, com a hora do Brasil (23:59:59 do dia 17)', '2026-11-17T23:59:59-03:00', false],
    ['um segundo depois, em UTC', '2026-11-18T03:00:01+00:00', true],
    ['com espaço no lugar do T', '2026-11-18 03:00:00+00:00', true],
    ['bem depois', '2026-11-24T10:00:00.123456+00:00', true],
    ['bem antes', '2026-02-03T15:00:00+00:00', false],
  ])('%s: %s', (_nome, criadoEm, esperado) => {
    expect(criadaComADataExplicita(criadoEm, HOJE)).toBe(esperado);
  });

  it.each([
    ['nulo', null],
    ['indefinido', undefined],
    ['vazio', ''],
    ['texto que não é data', 'ontem'],
    ['número', 12345],
    ['objeto', {}],
    ['só a data, sem hora (não dá o instante)', '2026-11-20'],
    ['hora sem fuso (não dá o instante)', '2026-11-20T10:00:00'],
    ['fuso escrito de um jeito que o app não lê (+00 sem os minutos)', '2026-11-20T10:00:00+00'],
    ['hora impossível', '2026-11-20T25:00:00+00:00'],
    ['dia que não existe', '2026-02-30T10:00:00+00:00'],
    ['depois de hoje (futuro não vale)', '2026-12-30T10:00:00+00:00'],
  ])('created_at inválido ou sem instante não vale como depois do corte: %s', (_nome, criadoEm) => {
    expect(criadaComADataExplicita(criadoEm, HOJE)).toBe(false);
  });
});

describe('dataDoDiagnosticoPodeSerDoSistema', () => {
  it('antes do corte, a data igual ao dia do cadastro pode ser do sistema (UTC e dia do Brasil)', () => {
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-02-03', '2026-02-03T15:00:00+00:00', HOJE)).toBe(true);
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-02-04', '2026-02-04T01:30:00+00:00', HOJE)).toBe(true);
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-02-03', '2026-02-04T01:30:00+00:00', HOJE)).toBe(true);
  });

  it('antes do corte, outra data não pode ser do sistema', () => {
    expect(dataDoDiagnosticoPodeSerDoSistema('2019-03-04', '2026-02-03T15:00:00+00:00', HOJE)).toBe(false);
    expect(dataDoDiagnosticoPodeSerDoSistema(null, '2026-02-03T15:00:00+00:00', HOJE)).toBe(false);
  });

  it('a partir do corte, a data é do profissional, mesmo igual ao dia do cadastro', () => {
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-11-20', '2026-11-20T15:00:00+00:00', HOJE)).toBe(false);
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-11-18', '2026-11-18T03:00:00+00:00', HOJE)).toBe(false);
  });

  it('um segundo antes do corte ainda vale a regra antiga', () => {
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-11-17', '2026-11-18T02:59:59+00:00', HOJE)).toBe(true);
    expect(dataDoDiagnosticoPodeSerDoSistema('2026-11-18', '2026-11-18T02:59:59+00:00', HOJE)).toBe(true);
  });

  it('created_at que não dá para ler: vale a regra antiga (que sem o dia do cadastro não descarta nada)', () => {
    for (const ruim of [null, undefined, '', 'ontem', 12345]) {
      expect(dataDoDiagnosticoPodeSerDoSistema('2026-11-20', ruim, HOJE), String(ruim)).toBe(false);
    }
  });
});

describe('erroDaDataDigitada (o que o profissional digita tem a mesma régua da linha do tempo)', () => {
  it.each(['2026-11-25', '2026-11-24', '2019-03-04', '1900-01-01', '2024-02-29'])('%s vale', (valor) => {
    expect(erroDaDataDigitada(valor, HOJE)).toBeNull();
  });

  it.each([
    ['amanhã', '2026-11-26'],
    ['ano 2099', '2099-01-01'],
    ['antes de 1900', '1899-12-31'],
    ['ano 0001', '0001-01-01'],
    ['dia que não existe', '2026-02-30'],
    ['29/02 de ano comum', '2025-02-29'],
    ['mês 13', '2026-13-01'],
    ['no formato brasileiro', '25/11/2026'],
    ['texto', 'ontem'],
    ['data com hora', '2026-11-24T10:00:00Z'],
    ['vazio', ''],
  ])('%s não vale', (_nome, valor) => {
    expect(erroDaDataDigitada(valor, HOJE)).toBe('Data inválida: não pode ser no futuro nem antes de 1900.');
  });
});

describe('linha do tempo: linha criada DEPOIS do corte (a data, ou o vazio, é do profissional)', () => {
  it('data igual ao dia do cadastro (diagnosticou e registrou no mesmo dia) é marco "fato" com a data real', () => {
    const r = montar(diag({ created_at: '2026-11-20T15:00:00+00:00', data_diagnostico: '2026-11-20' }));
    expect(r.semData).toEqual([]);
    expect(r.marcos).toHaveLength(1);
    expect(r.marcos[0]).toMatchObject({
      id: 'diagnostico:d', natureza: 'fato', origem: 'profissional', revisado: true, tipo: 'diagnostico',
      data: { iso: '2026-11-20', precisao: 'dia' },
    });
  });

  it('o mesmo vale para o diagnóstico secundário', () => {
    expect(diasDosMarcos(diag({ tipo: 'secundario', data_diagnostico: '2026-11-20' }))).toEqual(['2026-11-20']);
  });

  it('vale tanto o dia do Brasil quanto o dia em UTC do cadastro (22:00 do dia 19 no Brasil já é dia 20 em UTC)', () => {
    const criado = '2026-11-20T01:00:00+00:00';
    expect(diasDosMarcos(diag({ created_at: criado, data_diagnostico: '2026-11-19' }))).toEqual(['2026-11-19']);
    expect(diasDosMarcos(diag({ created_at: criado, data_diagnostico: '2026-11-20' }))).toEqual(['2026-11-20']);
  });

  it('data nula vai para "Sem data" com o aviso de que não foi informada (e não o de data do cadastro)', () => {
    const r = montar(diag({ data_diagnostico: null }));
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(0);
    expect(r.semData).toEqual([{
      id: 'diagnostico:d', titulo: '[M54.5] Dor lombar baixa', fonte: 'diagnostico', origem: 'profissional', revisado: true,
      detalhe: `Diagnóstico · ${NOTA_NAO_INFORMADA} · Registrado no app em 20/11/2026`,
    }]);
  });

  it('data vazia, só com espaços ou ausente também é "não informada"', () => {
    const semColuna = diag();
    delete semColuna.data_diagnostico;
    for (const vazio of ['', '   ', undefined]) {
      expect(detalhesSemData(diag({ data_diagnostico: vazio })), String(vazio)).toEqual([`Diagnóstico · ${NOTA_NAO_INFORMADA} · Registrado no app em 20/11/2026`]);
    }
    expect(detalhesSemData(semColuna)).toEqual([`Diagnóstico · ${NOTA_NAO_INFORMADA} · Registrado no app em 20/11/2026`]);
  });

  it('data antiga explícita continua marco', () => {
    expect(diasDosMarcos(diag({ data_diagnostico: '2019-03-04' }))).toEqual(['2019-03-04']);
  });

  it('data no futuro continua fora: "Sem data" com o aviso de data inválida', () => {
    for (const futuro of ['2026-11-26', '2099-01-01']) {
      const r = montar(diag({ data_diagnostico: futuro }));
      expect(r.marcos, futuro).toEqual([]);
      expect(r.semData.map((s) => s.detalhe), futuro).toEqual([`Diagnóstico · ${NOTA_INVALIDA} · Registrado no app em 20/11/2026`]);
    }
  });

  it('data que não existe ou anterior a 1900 continua "Sem data" com o aviso de data inválida', () => {
    for (const ruim of ['2026-02-30', '1899-12-31', 'ontem']) {
      const r = montar(diag({ data_diagnostico: ruim }));
      expect(r.marcos, ruim).toEqual([]);
      expect(r.semData.map((s) => s.detalhe), ruim).toEqual([`Diagnóstico · ${NOTA_INVALIDA} · Registrado no app em 20/11/2026`]);
    }
  });

  it('removido e suspeita continuam fora de tudo (nem marco nem "Sem data"), com ou sem data', () => {
    for (const extra of [{ ativo: false }, { tipo: 'suspeita' }]) {
      for (const data of ['2026-11-20', null]) {
        const r = montar(diag({ ...extra, data_diagnostico: data }));
        expect(r.marcos).toEqual([]);
        expect(r.semData).toEqual([]);
      }
    }
  });
});

describe('linha do tempo: na virada do corte', () => {
  it('criada na virada exata (03:00:00Z): a data igual ao dia do cadastro vale', () => {
    const r = montar(diag({ created_at: '2026-11-18T03:00:00+00:00', data_diagnostico: '2026-11-18' }));
    expect(r.semData).toEqual([]);
    expect(r.marcos.map((m) => m.data.iso)).toEqual(['2026-11-18']);
  });

  it('criada à meia-noite do Brasil (00:00:00-03:00): o mesmo instante, a mesma regra nova', () => {
    expect(diasDosMarcos(diag({ created_at: '2026-11-18T00:00:00-03:00', data_diagnostico: '2026-11-18' }))).toEqual(['2026-11-18']);
  });

  it('criada um segundo antes (02:59:59Z, ainda dia 17 no Brasil): vale a regra antiga e as duas datas coincidentes ficam em "Sem data"', () => {
    for (const dia of ['2026-11-17', '2026-11-18']) {
      const r = montar(diag({ created_at: '2026-11-18T02:59:59+00:00', data_diagnostico: dia }));
      expect(r.marcos, dia).toEqual([]);
      expect(r.semData.map((s) => s.detalhe), dia).toEqual([`Diagnóstico · ${NOTA_CADASTRO} · Registrado no app em 17/11/2026`]);
    }
  });

  it('criada um segundo antes (23:59:59-03:00 do dia 17): idem', () => {
    const r = montar(diag({ created_at: '2026-11-17T23:59:59-03:00', data_diagnostico: '2026-11-17' }));
    expect(r.marcos).toEqual([]);
    expect(r.semData).toHaveLength(1);
  });
});

describe('linha do tempo: linha criada ANTES do corte segue a regra antiga (limitação assumida)', () => {
  it('data igual ao dia do cadastro vai para "Sem data", mesmo que fosse real', () => {
    const r = montar(diag({ created_at: '2026-11-10T15:00:00+00:00', data_diagnostico: '2026-11-10' }));
    expect(r.marcos).toEqual([]);
    expect(r.semData.map((s) => s.detalhe)).toEqual([`Diagnóstico · ${NOTA_CADASTRO} · Registrado no app em 10/11/2026`]);
  });

  it('data diferente do dia do cadastro continua marco', () => {
    expect(diasDosMarcos(diag({ created_at: '2026-11-10T15:00:00+00:00', data_diagnostico: '2019-03-04' }))).toEqual(['2019-03-04']);
  });

  it('data nula continua "Sem data" com o aviso de não informada', () => {
    expect(detalhesSemData(diag({ created_at: '2026-11-10T15:00:00+00:00', data_diagnostico: null })))
      .toEqual([`Diagnóstico · ${NOTA_NAO_INFORMADA} · Registrado no app em 10/11/2026`]);
  });
});

describe('linha do tempo: created_at que não dá para ler (regra antiga, como antes do corte)', () => {
  it.each([null, undefined, '', 'ontem', 12345])('created_at %s: sem o dia do cadastro não há com o que comparar, e a data válida vira marco', (ruim) => {
    expect(diasDosMarcos(diag({ created_at: ruim, data_diagnostico: '2026-11-20' }))).toEqual(['2026-11-20']);
  });

  it('created_at ausente da linha: idem', () => {
    const linha = diag({ data_diagnostico: '2026-11-20' });
    delete linha.created_at;
    expect(diasDosMarcos(linha)).toEqual(['2026-11-20']);
  });

  it('created_at sem fuso, de depois do corte: o instante é desconhecido, então vale o lado cauteloso (regra antiga, "Sem data")', () => {
    const r = montar(diag({ created_at: '2026-11-20T10:00:00', data_diagnostico: '2026-11-20' }));
    expect(r.marcos).toEqual([]);
    expect(r.semData.map((s) => s.detalhe)).toEqual([`Diagnóstico · ${NOTA_CADASTRO} · Registrado no app em 20/11/2026`]);
  });

  it('created_at só com a data (sem hora), de depois do corte: também não dá o instante, vale a regra antiga', () => {
    const r = montar(diag({ created_at: '2026-11-20', data_diagnostico: '2026-11-20' }));
    expect(r.marcos).toEqual([]);
    expect(r.semData.map((s) => s.detalhe)).toEqual([`Diagnóstico · ${NOTA_CADASTRO} · Registrado no app em 20/11/2026`]);
  });

  it('created_at no futuro: não conta como depois do corte e a regra antiga não acha o dia do cadastro', () => {
    expect(diasDosMarcos(diag({ created_at: '2027-03-01T10:00:00+00:00', data_diagnostico: '2026-11-20' }))).toEqual(['2026-11-20']);
  });
});

describe('uma lista com linhas dos dois lados do corte', () => {
  it('cada linha segue a sua regra: a antiga com data do cadastro fica em "Sem data" e a nova vira marco', () => {
    const r = montar(
      diag({ id: 'antiga', cid_codigo: 'A00', cid_descricao: 'Antiga', created_at: '2026-11-10T15:00:00+00:00', data_diagnostico: '2026-11-10' }),
      diag({ id: 'nova', cid_codigo: 'N00', cid_descricao: 'Nova', created_at: '2026-11-21T15:00:00+00:00', data_diagnostico: '2026-11-21' }),
      diag({ id: 'nova-sem', cid_codigo: 'S00', cid_descricao: 'Nova sem data', created_at: '2026-11-22T15:00:00+00:00', data_diagnostico: null }),
    );
    expect(r.marcos.map((m) => m.id)).toEqual(['diagnostico:nova']);
    expect(r.semData.map((s) => s.id)).toEqual(['diagnostico:antiga', 'diagnostico:nova-sem']);
  });
});

describe('o aviso da tela e a linha do tempo concordam (a mesma função decide)', () => {
  const criacoes = [
    '2026-02-03T15:00:00+00:00', '2026-11-10T15:00:00+00:00', '2026-11-18T02:59:59+00:00', '2026-11-18T03:00:00+00:00',
    '2026-11-20T01:00:00+00:00', '2026-11-20T15:00:00+00:00', '2026-11-20T10:00:00', '2026-11-20', null, 'ontem',
  ];
  const datas = ['2026-02-03', '2026-11-10', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2019-03-04', null];

  it('a linha cai em "Sem data" pela nota do cadastro exatamente quando dataDoDiagnosticoPodeSerDoSistema diz que sim', () => {
    for (const criadoEm of criacoes) {
      for (const data of datas) {
        const r = montar(diag({ created_at: criadoEm, data_diagnostico: data }));
        const nota = r.semData.some((s) => s.detalhe.includes(NOTA_CADASTRO));
        expect(nota, `${String(criadoEm)} / ${String(data)}`).toBe(dataDoDiagnosticoPodeSerDoSistema(data, criadoEm, HOJE));
      }
    }
  });
});
