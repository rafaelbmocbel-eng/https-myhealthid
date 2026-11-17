import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filaDeRevisao, totalAguardandoRevisao, REJEICOES_PARA_ARQUIVAR } from '@/lib/avatar/filaDeRevisao';

const RAIZ = join(__dirname, '..');
const EU = 'prof-1';

type Evento = { id: string; tipo_diagnostico?: unknown; status?: unknown; metadata?: unknown };
let n = 0;
const ev = (tipo: unknown, status: unknown, metadata: unknown): Evento => ({ id: `e${(n += 1)}`, tipo_diagnostico: tipo, status, metadata });
const relato = (status: unknown = 'ativo') => ev('relato_paciente', status, {});
const hist = (metadata: unknown) => ev('historico_relatado', 'resolvido', metadata);
const ids = (lista: Evento[]) => lista.map((e) => e.id);

const aguardandoComo = (e: Evento, quem: string | undefined) => {
  const f = filaDeRevisao([e], quem);
  return { relato: f.relatosDoPaciente.length === 1, historico: f.historicoRelatado.length === 1, descartado: f.descartadosPorConsenso.length === 1 };
};
const aguardando = (e: Evento) => aguardandoComo(e, EU);

const rejeicoes = (quantas: number) => Array.from({ length: quantas }, (_, i) => ({ terapeuta_id: `p${i}`, data: '2026-10-01T12:00:00Z' }));

describe('filaDeRevisao: relato do paciente', () => {
  it.each([
    ['ativo', true], ['em_tratamento', true], ['cronico', true], ['resolvido', false], [undefined, true], [null, true], ['Resolvido', true],
  ])('status %s: aguarda revisão = %s', (status, esperado) => {
    expect(aguardando(relato(status)).relato).toBe(esperado);
  });

  it('só o tipo "relato_paciente" entra nesta parte (outros tipos, tipo vazio ou de tipo errado, não)', () => {
    for (const tipo of ['achado_clinico', 'historico_confirmado', 'historico_relatado', 'diagnostico_medico', undefined, null, 5, '', 'RELATO_PACIENTE']) {
      expect(aguardando(ev(tipo, 'ativo', {})).relato, String(tipo)).toBe(false);
    }
  });

  it('o relato não depende do profissional nem do metadata (revisado, descartado ou rejeitado não o tira)', () => {
    const e = ev('relato_paciente', 'ativo', { revisado_por_ids: [EU], descartado: true, rejeicoes: rejeicoes(5) });
    expect(aguardandoComo(e, EU).relato).toBe(true);
    expect(aguardandoComo(e, undefined).relato).toBe(true);
    expect(aguardando(e).historico).toBe(false);
    expect(aguardando(e).descartado).toBe(false);
  });
});

describe('filaDeRevisao: histórico relatado (cada condição sozinha e juntas)', () => {
  it('sem nenhuma marca no metadata, aguarda revisão', () => {
    expect(aguardando(hist({}))).toEqual({ relato: false, historico: true, descartado: false });
  });

  it('só o histórico relatado entra nesta parte (outros tipos não, nem o confirmado)', () => {
    for (const tipo of ['relato_paciente', 'historico_confirmado', 'achado_clinico', undefined, null, 7, 'HISTORICO_RELATADO']) {
      expect(aguardando(ev(tipo, 'ativo', {})).historico, String(tipo)).toBe(false);
      expect(aguardando(ev(tipo, 'ativo', { descartado: true })).descartado, String(tipo)).toBe(false);
    }
  });

  describe('já revisado por este profissional', () => {
    it.each([
      ['lista com o meu id', [EU], 'prof-1', false],
      ['lista com o meu id entre outros', ['prof-2', EU, 'prof-3'], 'prof-1', false],
      ['lista só com outro profissional', ['prof-2'], 'prof-1', true],
      ['lista vazia', [], 'prof-1', true],
      ['lista com o meu id, visto por outro profissional', [EU], 'prof-2', true],
      ['sem profissional logado (id indefinido)', [EU], undefined, true],
    ])('%s', (_nome, revisados, quem, aguarda) => {
      expect(aguardandoComo(hist({ revisado_por_ids: revisados }), quem).historico).toBe(aguarda);
    });

    it('o id é comparado inteiro: "prof-10" não conta como "prof-1"', () => {
      expect(aguardando(hist({ revisado_por_ids: ['prof-10'] })).historico).toBe(true);
    });
  });

  describe('descartado', () => {
    it.each([
      [true, false], [false, true], [undefined, true], [null, true], [0, true], ['', true], [1, false], ['sim', false],
    ])('descartado = %j: aguarda revisão = %s', (descartado, aguarda) => {
      expect(aguardando(hist({ descartado })).historico).toBe(aguarda);
    });

    it('descartado vai para os descartados por consenso, não para a fila', () => {
      expect(aguardando(hist({ descartado: true }))).toEqual({ relato: false, historico: false, descartado: true });
    });
  });

  describe('rejeições', () => {
    it.each([
      [0, true], [1, true], [2, true], [3, false], [4, false], [10, false],
    ])('%i rejeições: aguarda revisão = %s (arquiva com %i ou mais)', (quantas, aguarda) => {
      expect(aguardando(hist({ rejeicoes: rejeicoes(quantas) })).historico).toBe(aguarda);
    });

    it('com 3 ou mais rejeições vai para os descartados; com 2, não', () => {
      expect(aguardando(hist({ rejeicoes: rejeicoes(2) })).descartado).toBe(false);
      expect(aguardando(hist({ rejeicoes: rejeicoes(3) })).descartado).toBe(true);
      expect(aguardando(hist({ rejeicoes: rejeicoes(4) })).descartado).toBe(true);
    });

    it('o limite para arquivar é 3', () => {
      expect(REJEICOES_PARA_ARQUIVAR).toBe(3);
    });
  });

  describe('as condições juntas', () => {
    it.each([
      ['revisado por mim + descartado', { revisado_por_ids: [EU], descartado: true }, { historico: false, descartado: true }],
      ['revisado por mim + 3 rejeições', { revisado_por_ids: [EU], rejeicoes: rejeicoes(3) }, { historico: false, descartado: true }],
      ['revisado por mim + 2 rejeições', { revisado_por_ids: [EU], rejeicoes: rejeicoes(2) }, { historico: false, descartado: false }],
      ['revisado por outro + 2 rejeições', { revisado_por_ids: ['prof-2'], rejeicoes: rejeicoes(2) }, { historico: true, descartado: false }],
      ['revisado por outro + descartado', { revisado_por_ids: ['prof-2'], descartado: true }, { historico: false, descartado: true }],
      ['descartado + 3 rejeições', { descartado: true, rejeicoes: rejeicoes(3) }, { historico: false, descartado: true }],
      ['descartado falso + 2 rejeições + revisado por outro', { descartado: false, rejeicoes: rejeicoes(2), revisado_por_ids: ['prof-2'] }, { historico: true, descartado: false }],
      ['tudo ao mesmo tempo', { revisado_por_ids: [EU], descartado: true, rejeicoes: rejeicoes(3) }, { historico: false, descartado: true }],
    ])('%s', (_nome, metadata, esperado) => {
      const r = aguardando(hist(metadata));
      expect({ historico: r.historico, descartado: r.descartado }).toEqual(esperado);
    });

    it('revisado por mim com 0 ou 2 rejeições não é descartado nem aguarda: só some da minha fila (outro profissional ainda o vê)', () => {
      expect(aguardando(hist({ revisado_por_ids: [EU] }))).toEqual({ relato: false, historico: false, descartado: false });
      expect(aguardandoComo(hist({ revisado_por_ids: [EU] }), 'prof-2').historico).toBe(true);
    });
  });

  describe('metadata ausente ou com tipo errado (nunca lança)', () => {
    it.each([
      ['undefined', undefined], ['null', null], ['texto', 'abc'], ['texto vazio', ''], ['número', 5], ['zero', 0], ['true', true], ['false', false], ['lista', []], ['lista com itens', [1, 2, 3]],
    ])('metadata %s: sem marca, aguarda revisão', (_nome, metadata) => {
      expect(aguardando(hist(metadata))).toEqual({ relato: false, historico: true, descartado: false });
    });

    it.each([
      ['revisado_por_ids número', { revisado_por_ids: 5 }],
      ['revisado_por_ids objeto', { revisado_por_ids: {} }],
      ['revisado_por_ids true', { revisado_por_ids: true }],
    ])('%s: o Avatar antigo quebrava com TypeError; agora conta como "não revisou" e o item fica na fila', (_nome, metadata) => {
      expect(() => filaDeRevisao([hist(metadata)], EU)).not.toThrow();
      expect(aguardando(hist(metadata)).historico).toBe(true);
    });

    it.each([
      ['revisado_por_ids vazio (falsy)', { revisado_por_ids: null }, true],
      ['revisado_por_ids texto que contém o meu id', { revisado_por_ids: 'xx-prof-1-xx' }, false],
      ['revisado_por_ids texto que não contém o meu id', { revisado_por_ids: 'prof-2' }, true],
    ])('%s', (_nome, metadata, aguarda) => {
      expect(aguardando(hist(metadata)).historico).toBe(aguarda);
    });

    it.each([
      ['rejeicoes texto de 3 letras (length 3)', { rejeicoes: 'abc' }, false],
      ['rejeicoes texto de 2 letras (length 2)', { rejeicoes: 'ab' }, true],
      ['rejeicoes número (sem length)', { rejeicoes: 9 }, true],
      ['rejeicoes objeto sem length', { rejeicoes: { a: 1 } }, true],
      ['rejeicoes objeto com length 3', { rejeicoes: { length: 3 } }, false],
      ['rejeicoes null', { rejeicoes: null }, true],
      ['rejeicoes true', { rejeicoes: true }, true],
      // Como o Avatar sempre fez: comparar texto não numérico com 3 dá falso nos dois lados, então não está na fila nem nos descartados.
      ['rejeicoes length não numérico', { rejeicoes: { length: 'muitas' } }, false],
    ])('%s', (_nome, metadata, aguarda) => {
      expect(aguardando(hist(metadata)).historico).toBe(aguarda);
    });

    it('evento sem os campos (vazio) não entra em nada e não lança', () => {
      expect(() => filaDeRevisao([{ id: 'x' }, {}] as Evento[], EU)).not.toThrow();
      expect(filaDeRevisao([{ id: 'x' }, {}] as Evento[], EU)).toEqual({ relatosDoPaciente: [], historicoRelatado: [], descartadosPorConsenso: [] });
    });
  });
});

describe('filaDeRevisao: a lista toda', () => {
  const lista = () => {
    n = 0;
    return [
      relato('ativo'),                                              // e1 relato
      relato('resolvido'),                                          // e2 fora
      hist({}),                                                     // e3 histórico
      hist({ revisado_por_ids: [EU] }),                             // e4 já revisei
      hist({ revisado_por_ids: ['prof-2'] }),                       // e5 histórico
      hist({ descartado: true }),                                   // e6 descartado
      hist({ rejeicoes: rejeicoes(2) }),                            // e7 histórico
      hist({ rejeicoes: rejeicoes(3) }),                            // e8 descartado
      ev('achado_clinico', 'ativo', {}),                            // e9 fora
      ev('historico_confirmado', 'cronico', { revisado_por_ids: [EU] }), // e10 fora
    ];
  };

  it('separa as três partes, na ordem em que os eventos vieram', () => {
    const f = filaDeRevisao(lista(), EU);
    expect(ids(f.relatosDoPaciente)).toEqual(['e1']);
    expect(ids(f.historicoRelatado)).toEqual(['e3', 'e5', 'e7']);
    expect(ids(f.descartadosPorConsenso)).toEqual(['e6', 'e8']);
  });

  it('o total que o aviso mostra é relatos + histórico (os descartados não contam)', () => {
    expect(totalAguardandoRevisao(filaDeRevisao(lista(), EU))).toBe(4);
    expect(totalAguardandoRevisao(filaDeRevisao([], EU))).toBe(0);
    expect(totalAguardandoRevisao({ relatosDoPaciente: [1, 2], historicoRelatado: [3] })).toBe(3);
  });

  it('para outro profissional o que eu já revisei volta (e1, e3, e4, e5, e7)', () => {
    const f = filaDeRevisao(lista(), 'prof-2');
    expect(ids(f.historicoRelatado)).toEqual(['e3', 'e4', 'e7']);
  });

  it('lista vazia: tudo vazio', () => {
    expect(filaDeRevisao([], EU)).toEqual({ relatosDoPaciente: [], historicoRelatado: [], descartadosPorConsenso: [] });
  });

  it('não muda a lista recebida nem os eventos, e devolve os próprios eventos (não cópias)', () => {
    const entrada = lista();
    const copia = JSON.stringify(entrada);
    const f = filaDeRevisao(entrada, EU);
    expect(JSON.stringify(entrada)).toBe(copia);
    expect(f.relatosDoPaciente[0]).toBe(entrada[0]);
    expect(f.historicoRelatado[0]).toBe(entrada[2]);
  });
});

// ── Mesmo resultado que a regra tinha escrita dentro do AvatarClinicoCard ─────────────────────────────────────────────
// Cópia literal do trecho que existia no Avatar antes da extração. Para qualquer combinação de valores o resultado tem de
// ser igual; a única diferença é onde ele lançava TypeError (revisado_por_ids que não é lista nem texto), tratado abaixo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Qualquer = any;
function regraOriginalDoAvatar(eventos: Evento[], user: { id: string } | undefined) {
  const pendentes = eventos.filter(
    (e: Qualquer) => e.tipo_diagnostico === 'relato_paciente' && e.status !== 'resolvido',
  );
  const pendentesHistorico = eventos.filter(
    (e: Qualquer) => e.tipo_diagnostico === 'historico_relatado' &&
      !((e as Qualquer).metadata?.revisado_por_ids || []).includes(user?.id) &&
      !(e as Qualquer).metadata?.descartado &&
      ((e as Qualquer).metadata?.rejeicoes?.length || 0) < 3,
  );
  const descartadosConsenso = eventos.filter(
    (e: Qualquer) => e.tipo_diagnostico === 'historico_relatado' &&
      ((e as Qualquer).metadata?.descartado || ((e as Qualquer).metadata?.rejeicoes?.length || 0) >= 3),
  );
  return { pendentes, pendentesHistorico, descartadosConsenso };
}

describe('filaDeRevisao: igual à regra que o Avatar tinha escrita dentro dele', () => {
  const REVISADOS: unknown[] = [undefined, null, [], [EU], ['prof-2'], ['prof-2', EU], [null], 'prof-1', 'xx-prof-1', 'prof-2', '', 0, false];
  const REVISADOS_QUE_QUEBRAVAM: unknown[] = [5, {}, true, { includes: 1 }];
  const DESCARTADOS: unknown[] = [undefined, null, true, false, 0, 1, 'sim', ''];
  const REJEICOES: unknown[] = [undefined, null, [], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4], 'ab', 'abc', 5, { length: 2 }, { length: 3 }, { length: '3' }, { length: 'x' }, true, [5]];
  const METADATAS_SOLTOS: unknown[] = [undefined, null, 'texto', '', 5, 0, true, false, [], [1, 2, 3]];
  const TIPOS: unknown[] = ['relato_paciente', 'historico_relatado', 'historico_confirmado', 'achado_clinico', undefined, null, 5];
  const STATUS: unknown[] = ['ativo', 'resolvido', 'cronico', undefined, null];
  const USUARIOS: Array<{ id: string } | undefined> = [{ id: 'prof-1' }, { id: 'prof-2' }, { id: 'prof-9' }, undefined];

  function metadatas(revisados: unknown[]): unknown[] {
    const todas: unknown[] = [...METADATAS_SOLTOS];
    for (const r of revisados) for (const d of DESCARTADOS) for (const j of REJEICOES) todas.push({ revisado_por_ids: r, descartado: d, rejeicoes: j });
    return todas;
  }

  it('mesmas três listas, para cada combinação de tipo, status, metadata e profissional (muitos milhares de casos)', () => {
    let casos = 0;
    const diferencas: string[] = [];
    const mds = metadatas(REVISADOS);
    for (const user of USUARIOS) {
      for (const tipo of TIPOS) {
        for (const status of STATUS) {
          n = 0;
          const eventos = mds.map((md) => ev(tipo, status, md));
          const antes = regraOriginalDoAvatar(eventos, user);
          const depois = filaDeRevisao(eventos, user?.id);
          casos += eventos.length;
          const comparar = (nome: string, a: Evento[], b: Evento[]) => {
            if (ids(a).join() !== ids(b).join()) diferencas.push(`${nome} tipo=${String(tipo)} status=${String(status)} user=${user?.id}`);
          };
          comparar('pendentes', antes.pendentes, depois.relatosDoPaciente);
          comparar('pendentesHistorico', antes.pendentesHistorico, depois.historicoRelatado);
          comparar('descartadosConsenso', antes.descartadosConsenso, depois.descartadosPorConsenso);
        }
      }
    }
    expect(casos).toBeGreaterThan(30000);
    expect(diferencas.slice(0, 5)).toEqual([]);
  });

  const casosQueQuebravam = (): unknown[] => {
    const casos: unknown[] = [];
    for (const r of REVISADOS_QUE_QUEBRAVAM) for (const d of DESCARTADOS) for (const j of [undefined, [], [1, 2, 3]]) casos.push({ revisado_por_ids: r, descartado: d, rejeicoes: j });
    return casos;
  };

  it('onde o Avatar antigo quebrava (revisado_por_ids sem includes de lista nem de texto), o resultado é o de "ninguém revisou"', () => {
    const casos = casosQueQuebravam();
    expect(casos.length).toBeGreaterThan(90);
    for (const quebra of casos) {
      n = 0;
      const comLixo = ev('historico_relatado', 'ativo', quebra);
      expect(() => regraOriginalDoAvatar([comLixo], { id: EU }), JSON.stringify(quebra)).toThrow(TypeError);
      const semLixo = ev('historico_relatado', 'ativo', { ...(quebra as object), revisado_por_ids: [] });
      const esperado = regraOriginalDoAvatar([semLixo], { id: EU });
      const f = filaDeRevisao([comLixo], EU);
      expect(f.historicoRelatado.length, JSON.stringify(quebra)).toBe(esperado.pendentesHistorico.length);
      expect(f.descartadosPorConsenso.length, JSON.stringify(quebra)).toBe(esperado.descartadosConsenso.length);
    }
  });
});

describe('filaDeRevisao: é uma só regra, usada pelo Avatar e pela linha do tempo', () => {
  const ler = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');

  it('o AvatarClinicoCard usa a função e não repete a regra por dentro', () => {
    const avatar = ler('components/avatar/AvatarClinicoCard.tsx');
    expect(avatar).toMatch(/import \{ filaDeRevisao \} from '@\/lib\/avatar\/filaDeRevisao';/);
    expect(avatar).toMatch(/filaDeRevisao\(eventos, user\?\.id\)/);
    expect(avatar).not.toMatch(/\.includes\(\s*user\?\.id\s*\)/);
    expect(avatar).not.toMatch(/rejeicoes\?\.length\s*\|\|\s*0\)\s*(<|>=)\s*3/);
    expect(avatar).not.toMatch(/tipo_diagnostico === 'relato_paciente' && e\.status !== 'resolvido'/);
  });

  it('a leitura da linha do tempo usa a mesma função', () => {
    const hook = ler('hooks/useFontesClinicas.ts');
    expect(hook).toMatch(/from '@\/lib\/avatar\/filaDeRevisao'/);
    expect(hook).toMatch(/filaDeRevisao\(/);
  });

  it('o arquivo da regra é puro: não importa nada (nem o banco, nem React) e não grava', () => {
    const fonte = ler('lib/avatar/filaDeRevisao.ts');
    expect(fonte).not.toMatch(/^\s*import\s/m);
    expect(fonte).not.toMatch(/supabase|fetch\s*\(|\.insert\s*\(|\.update\s*\(|\.rpc\s*\(|localStorage/);
  });
});
