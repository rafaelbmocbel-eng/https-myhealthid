import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  chaveConfirmavel, chaveDaConfirmacao, ERRO_DO_ANO_CONFIRMADO, ERRO_ITEM_NAO_CONFIRMAVEL, ERRO_SEM_IDENTIFICACAO,
  ERRO_SEM_TIPO_ESCOLHIDO, erroDoTamanhoDoRelato, idDaConfirmacao, impressaoDe, impressaoDoRelato, lerConfirmacao,
  montarLinhaDaConfirmacao, sha256Hex, validarDataConfirmada,
} from '@/lib/resumoClinico/confirmacao';
import type { EntradaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import { dataDaHistoriaDeVida, lerPrecisao } from '@/lib/resumoClinico/datas';
import {
  COLUNAS_DA_CONFIRMACAO, FRASE_SO_O_ANO, LIMITE_DA_CHAVE_DE_CONFIRMACAO, LIMITE_DO_ANO_RELATADO, LIMITE_DO_RELATO_CONFIRMADO,
  ORIGEM_CONFIRMACAO, TIPOS_CONFIRMAVEIS,
} from '@/lib/resumoClinico/tipos';
import type { LinhaBruta } from '@/lib/resumoClinico/tipos';

// "Hoje" fixo: nada aqui pode depender do relógio nem do fuso da máquina (o arquivo roda também com TZ diferentes).
const HOJE = '2026-11-15';

const nodeSha = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

describe('sha256Hex (escrito à mão) confere com o SHA-256 de verdade', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    // Mensagem de 448 bits (NIST FIPS 180-2): obriga um segundo bloco só para o preenchimento.
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu', 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
  ])('vetor NIST %j', (entrada, esperado) => {
    expect(sha256Hex(entrada)).toBe(esperado);
  });

  it('um milhão de "a" (vetor longo do NIST)', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('todos os tamanhos de 0 a 200 letras, que passam por todos os casos de preenchimento (55, 56, 63, 64, 119, 120...)', () => {
    for (let n = 0; n <= 200; n += 1) {
      const texto = 'x'.repeat(n);
      expect(sha256Hex(texto), `${n} letras`).toBe(nodeSha(texto));
    }
  });

  it('500 entradas variadas (acentos, emoji, chinês, controle, letras soltas de emoji) dão o mesmo que o node:crypto', () => {
    const letras = ['a', 'Z', '0', ' ', '|', '"', '\\', '\n', '\t', '\u0000', 'á', 'ç', 'ã', 'Ô', 'ñ', '€', '漢', '字', '😀', '🧑‍⚕️', '\ud800', '\udfff'];
    let semente = 12345;
    const proximo = () => {
      semente = (Math.imul(semente, 1103515245) + 12345) >>> 0;
      return semente;
    };
    for (let i = 0; i < 500; i += 1) {
      const tamanho = proximo() % 300;
      let texto = '';
      for (let j = 0; j < tamanho; j += 1) texto += letras[proximo() % letras.length];
      expect(sha256Hex(texto), `entrada ${i}`).toBe(nodeSha(texto));
    }
  });

  it('devolve 64 letras hexadecimais minúsculas', () => {
    expect(sha256Hex('qualquer coisa')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('idDaConfirmacao', () => {
  const T = '11111111-1111-4111-8111-111111111111';
  const P = '22222222-2222-4222-8222-222222222222';
  const CHAVE = 'historico_clinico:cirurgia:id:k3j9x0ab';

  it('é sempre o mesmo para o mesmo profissional, paciente e chave', () => {
    expect(idDaConfirmacao(T, P, CHAVE)).toBe(idDaConfirmacao(T, P, CHAVE));
  });

  it('tem o formato 8-4-4-4-12 em hexadecimal minúsculo, versão 4 e variante 8, 9, a ou b', () => {
    expect(idDaConfirmacao(T, P, CHAVE)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    for (let i = 0; i < 300; i += 1) {
      expect(idDaConfirmacao(T, P, `chave-${i}`), `chave ${i}`).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('usa 128 bits do SHA-256 da junção: todas as letras, menos a da versão e a da variante, são as do hash', () => {
    const hash = nodeSha(JSON.stringify([ORIGEM_CONFIRMACAO, T, P, CHAVE]));
    const letras = idDaConfirmacao(T, P, CHAVE).replace(/-/g, '');
    expect(letras).toHaveLength(32);
    for (let i = 0; i < 32; i += 1) {
      if (i === 12 || i === 16) continue;
      expect(letras[i], `posição ${i}`).toBe(hash[i]);
    }
    expect(letras[12]).toBe('4');
    expect(letras[16]).toBe(((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16));
  });

  it('muda se mudar o profissional, o paciente ou a chave (um de cada vez)', () => {
    const base = idDaConfirmacao(T, P, CHAVE);
    expect(idDaConfirmacao('99999999-9999-4999-8999-999999999999', P, CHAVE)).not.toBe(base);
    expect(idDaConfirmacao(T, '99999999-9999-4999-8999-999999999999', CHAVE)).not.toBe(base);
    expect(idDaConfirmacao(T, P, `${CHAVE}x`)).not.toBe(base);
  });

  it('a junção não é ambígua: mover um "|" de um campo para outro dá outro id', () => {
    expect(idDaConfirmacao('a|b', 'c', 'd')).not.toBe(idDaConfirmacao('a', 'b|c', 'd'));
    expect(idDaConfirmacao('a', 'b', 'c|d')).not.toBe(idDaConfirmacao('a', 'b|c', 'd'));
  });

  it('2000 chaves diferentes dão 2000 ids diferentes', () => {
    const ids = new Set(Array.from({ length: 2000 }, (_, i) => idDaConfirmacao(T, P, `historico_clinico:cirurgia:pos:${i}:abc`)));
    expect(ids.size).toBe(2000);
  });
});

describe('impressaoDoRelato', () => {
  it('apara as pontas e trata número como texto: o que o cliente escreveu, sem enfeite', () => {
    expect(impressaoDoRelato('  Joelho ', 2022, undefined)).toBe(impressaoDoRelato('Joelho', '2022', ''));
    expect(impressaoDoRelato('Joelho', ' 2022\n', ' dor ')).toBe(impressaoDoRelato('Joelho', '2022', 'dor'));
    expect(impressaoDoRelato('Joelho', null, null)).toBe(impressaoDoRelato('Joelho', '', ''));
  });

  it('objeto, lista e verdadeiro/falso no lugar do texto valem como vazio (a leitura os trata assim)', () => {
    expect(impressaoDoRelato('Joelho', { ano: 2022 }, [1])).toBe(impressaoDoRelato('Joelho', '', ''));
    expect(impressaoDoRelato('Joelho', true, false)).toBe(impressaoDoRelato('Joelho', '', ''));
  });

  it('qualquer um dos três campos diferente dá outra impressão', () => {
    const base = impressaoDoRelato('Joelho', '2022', 'dor');
    expect(impressaoDoRelato('Joelhos', '2022', 'dor')).not.toBe(base);
    expect(impressaoDoRelato('Joelho', '2023', 'dor')).not.toBe(base);
    expect(impressaoDoRelato('Joelho', '2022', 'dor forte')).not.toBe(base);
    expect(impressaoDoRelato('Joelho', '2022', '')).not.toBe(base);
  });

  it('não confunde onde termina um campo e começa o outro', () => {
    expect(impressaoDoRelato('a', 'bc', '')).not.toBe(impressaoDoRelato('ab', 'c', ''));
    expect(impressaoDoRelato('a', '', 'bc')).not.toBe(impressaoDoRelato('a', 'b', 'c'));
    expect(impressaoDoRelato('a"', 'b', '')).not.toBe(impressaoDoRelato('a', '"b', ''));
  });

  it('é a mesma por impressaoDe(relato) e é diferente maiúscula de minúscula (o texto do cliente não é reescrito)', () => {
    expect(impressaoDe({ tipo: 'Joelho', ano: '2022', complicacoes: 'dor' })).toBe(impressaoDoRelato('Joelho', '2022', 'dor'));
    expect(impressaoDoRelato('joelho', '2022', '')).not.toBe(impressaoDoRelato('Joelho', '2022', ''));
  });
});

describe('chaveDaConfirmacao', () => {
  const item = (extra: Partial<{ indice: number; tipo: string; anoOriginal: unknown; complicacoes: string }> = {}) =>
    ({ indice: 0, tipo: 'Joelho', anoOriginal: '2022', complicacoes: '', ...extra });

  it('item com id (a chave do marco começa com "id:"): é a própria chave do marco, igual à de antes', () => {
    expect(chaveDaConfirmacao(item(), 'historico_clinico:cirurgia:id:k3j9x0ab')).toBe('historico_clinico:cirurgia:id:k3j9x0ab');
  });

  it('item sem id (chave do marco por posição): posição + 16 letras do SHA-256 da impressão', () => {
    const esperado = `historico_clinico:cirurgia:pos:3:${nodeSha(impressaoDoRelato('Joelho', '2022', 'dor')).slice(0, 16)}`;
    expect(chaveDaConfirmacao(item({ indice: 3, complicacoes: 'dor' }), 'historico_clinico:cirurgia:3')).toBe(esperado);
    expect(esperado).toMatch(/^historico_clinico:cirurgia:pos:3:[0-9a-f]{16}$/);
  });

  it('id repetido (o segundo cai na posição no marco): também usa posição + impressão', () => {
    expect(chaveDaConfirmacao(item({ indice: 1 }), 'historico_clinico:cirurgia:1')).toMatch(/^historico_clinico:cirurgia:pos:1:[0-9a-f]{16}$/);
  });

  it('mesma posição com texto diferente, ou mesmo texto em outra posição: outra chave (nunca bate com a confirmação de outro item)', () => {
    const a = chaveDaConfirmacao(item({ indice: 1, tipo: 'Joelho' }), 'historico_clinico:cirurgia:1');
    expect(chaveDaConfirmacao(item({ indice: 1, tipo: 'Ombro' }), 'historico_clinico:cirurgia:1')).not.toBe(a);
    expect(chaveDaConfirmacao(item({ indice: 0, tipo: 'Joelho' }), 'historico_clinico:cirurgia:0')).not.toBe(a);
    expect(chaveDaConfirmacao(item({ indice: 1, tipo: 'Joelho' }), 'historico_clinico:cirurgia:1')).toBe(a);
  });

  it('a chave de reserva por posição nunca começa com "id:" (um id só de números não colide com a posição)', () => {
    expect(chaveDaConfirmacao(item({ indice: 7 }), 'historico_clinico:cirurgia:7').startsWith('historico_clinico:cirurgia:id:')).toBe(false);
  });
});

describe('chaveConfirmavel', () => {
  it('vale de 1 a 200 caracteres', () => {
    expect(LIMITE_DA_CHAVE_DE_CONFIRMACAO).toBe(200);
    expect(chaveConfirmavel('a')).toBe(true);
    expect(chaveConfirmavel('a'.repeat(200))).toBe(true);
    expect(chaveConfirmavel('a'.repeat(201))).toBe(false);
    expect(chaveConfirmavel('')).toBe(false);
  });

  it.each([['\n'], ['\t'], ['\u0000'], ['\u001f'], ['\u007f'], ['\u0085'], ['\u009f'], ['\r\n']])('com caractere de controle %j não vale', (c) => {
    expect(chaveConfirmavel(`historico_clinico:cirurgia:id:ab${c}cd`)).toBe(false);
  });

  it('acento, emoji, espaço e dois-pontos valem', () => {
    expect(chaveConfirmavel('historico_clinico:cirurgia:id:coração 😀 ç')).toBe(true);
  });

  it.each([[null], [undefined], [5], [{}], [[]], [true]])('o que não é texto (%j) não vale', (v) => {
    expect(chaveConfirmavel(v)).toBe(false);
  });
});

describe('lerConfirmacao (leitura tolerante)', () => {
  const relato = { tipo: 'Joelho', ano: '2022', complicacoes: 'dor' };
  const lida = (extra: LinhaBruta = {}): LinhaBruta => ({
    id: 'c1', confirmacao_origem: 'confirmacao_de_marco', confirmacao_versao: '1', confirmacao_chave: 'historico_clinico:cirurgia:id:k1',
    confirmacao_precisao: 'ano', confirmacao_relato: relato, confirmacao_por: { nome: 'Ana Souza', registro: 'CREFITO 123-F' }, ...extra,
  });

  it('linha no formato certo: lê chave, precisão, relato e quem confirmou', () => {
    expect(lerConfirmacao(lida())).toEqual({
      idDaLinha: 'c1', chave: 'historico_clinico:cirurgia:id:k1', precisao: 'ano', relato, por: 'Ana Souza · CREFITO 123-F',
    });
  });

  it('a versão chega como texto "1" (->>) ou como o número 1; qualquer outra coisa vira linha comum', () => {
    expect(lerConfirmacao(lida({ confirmacao_versao: 1 }))).not.toBeNull();
    expect(lerConfirmacao(lida({ confirmacao_versao: '1' }))).not.toBeNull();
    for (const versao of ['2', 2, '01', ' 1', 'um', '', null, undefined, true, [1], {}, 0, 1.5]) {
      expect(lerConfirmacao(lida({ confirmacao_versao: versao })), JSON.stringify(versao)).toBeNull();
    }
  });

  it.each([['outra_origem'], [''], [null], [undefined], [1], ['Confirmacao_de_marco']])('origem %j não é confirmação', (origem) => {
    expect(lerConfirmacao(lida({ confirmacao_origem: origem }))).toBeNull();
  });

  it('sem o apelido da origem (linha comum, sem marca) não é confirmação', () => {
    expect(lerConfirmacao({ id: 'h1', data_evento: '2022-01-01', tipo: 'cirurgia', titulo: 'Joelho' })).toBeNull();
  });

  it('chave ausente, que não é texto, longa demais ou com controle: linha comum', () => {
    for (const chave of [undefined, null, '', 5, {}, 'a'.repeat(201), 'ab\ncd']) {
      expect(lerConfirmacao(lida({ confirmacao_chave: chave })), JSON.stringify(chave)).toBeNull();
    }
  });

  it('sem id da linha não dá para desfazer: não é confirmação', () => {
    expect(lerConfirmacao(lida({ id: undefined }))).toBeNull();
    expect(lerConfirmacao(lida({ id: '' }))).toBeNull();
    expect(lerConfirmacao(lida({ id: '   ' }))).toBeNull();
    expect(lerConfirmacao(lida({ id: 77 }))?.idDaLinha).toBe('77');
  });

  it('o relato também pode chegar como texto JSON (jsonb gravado duas vezes)', () => {
    expect(lerConfirmacao(lida({ confirmacao_relato: JSON.stringify(relato) }))?.relato).toEqual(relato);
  });

  it.each([
    ['nulo', null], ['ausente', undefined], ['texto que não é JSON', 'isto não é json'], ['lista', [relato]], ['número', 7], ['verdadeiro', true], ['JSON de lista', '[1]'],
    ['tipo que não é texto', { ...relato, tipo: 5 }], ['tipo vazio', { ...relato, tipo: '' }], ['tipo só com espaços', { ...relato, tipo: '   ' }],
    ['ano que não é texto', { ...relato, ano: 2022 }], ['ano ausente', { tipo: 'Joelho', complicacoes: 'dor' }],
    ['complicações que não são texto', { ...relato, complicacoes: null }], ['complicações ausentes', { tipo: 'Joelho', ano: '2022' }],
    ['objeto vazio', {}],
  ])('relato com problema (%s) é lixo: linha comum', (_nome, bruto) => {
    expect(lerConfirmacao(lida({ confirmacao_relato: bruto }))).toBeNull();
  });

  it('o texto guardado vem como está, sem ser reescrito', () => {
    const r = { tipo: ' Joelho ', ano: '2O22', complicacoes: '' };
    expect(lerConfirmacao(lida({ confirmacao_relato: r }))?.relato).toEqual(r);
  });

  it('precisão: só o texto exato "ano" vale; o resto é "dia"', () => {
    expect(lerConfirmacao(lida({ confirmacao_precisao: 'ano' }))?.precisao).toBe('ano');
    for (const p of ['dia', 'Ano', 'ANO', ' ano', 'mes', '', null, undefined, 5, {}]) {
      expect(lerConfirmacao(lida({ confirmacao_precisao: p }))?.precisao, JSON.stringify(p)).toBe('dia');
    }
  });

  it('quem confirmou: nome e registro, só um deles, texto JSON, ou nada', () => {
    expect(lerConfirmacao(lida({ confirmacao_por: { nome: 'Ana', registro: null } }))?.por).toBe('Ana');
    expect(lerConfirmacao(lida({ confirmacao_por: { nome: null, registro: 'CREFITO 1' } }))?.por).toBe('CREFITO 1');
    expect(lerConfirmacao(lida({ confirmacao_por: JSON.stringify({ nome: 'Bia', registro: 'CREFITO 2' }) }))?.por).toBe('Bia · CREFITO 2');
    for (const p of [null, undefined, 'lixo', [], {}, { nome: 5 }, 9]) expect(lerConfirmacao(lida({ confirmacao_por: p }))?.por, JSON.stringify(p)).toBeNull();
  });

  it('lixo na linha inteira não lança', () => {
    for (const bruta of [{}, { id: 'x' }, { confirmacao_origem: 'confirmacao_de_marco' }, { id: 5, confirmacao_origem: 5, confirmacao_relato: 'x' }]) {
      expect(() => lerConfirmacao(bruta as LinhaBruta)).not.toThrow();
      expect(lerConfirmacao(bruta as LinhaBruta)).toBeNull();
    }
  });
});

describe('validarDataConfirmada', () => {
  const dia = (texto: string, nascimento?: string | null) => validarDataConfirmada({ precisao: 'dia', texto, nascimento }, HOJE);
  const ano = (texto: string, nascimento?: string | null) => validarDataConfirmada({ precisao: 'ano', texto, nascimento }, HOJE);
  const ERRO_DA_DATA = 'Data inválida: não pode ser no futuro nem antes de 1900.';

  describe('data completa', () => {
    it.each([
      ['2022-06-10'], ['2026-11-15'], ['2026-11-14'], ['1900-01-01'], ['2024-02-29'], ['2000-02-29'], ['1904-02-29'], ['2022-12-31'],
    ])('%s vale e vai para o banco como texto "AAAA-MM-DD"', (texto) => {
      expect(dia(texto)).toEqual({ ok: true, dataEvento: texto, precisao: 'dia', ano: texto.slice(0, 4) });
    });

    it.each([
      ['2022-02-31'], ['2023-02-29'], ['1900-02-29'], ['2100-02-29'], ['2022-04-31'], ['2022-13-01'], ['2022-00-10'], ['2022-06-00'],
      ['2026-11-16'], ['2026-12-31'], ['2027-01-01'], ['9999-12-31'],
      ['1899-12-31'], ['0001-01-01'], ['0000-00-00'],
      [''], ['   '], ['abc'], ['10/06/2022'], ['2022-6-10'], ['22-06-10'], ['2022/06/10'], ['2022-06-10T10:00:00'], ['2022-06-10 '.concat('x')], ['há 2 anos'], ['2O22-06-10'],
    ])('%j fica de fora com a frase de data inválida', (texto) => {
      expect(dia(texto)).toEqual({ ok: false, erro: ERRO_DA_DATA });
    });

    it('espaços nas pontas não atrapalham', () => {
      expect(dia('  2022-06-10  ')).toMatchObject({ ok: true, dataEvento: '2022-06-10' });
    });

    it('o limite de cima é o "hoje" que entra como parâmetro', () => {
      expect(validarDataConfirmada({ precisao: 'dia', texto: '2025-06-01', nascimento: null }, '2025-05-31').ok).toBe(false);
      expect(validarDataConfirmada({ precisao: 'dia', texto: '2025-05-31', nascimento: null }, '2025-05-31').ok).toBe(true);
    });
  });

  describe('só o ano', () => {
    it.each([['2022'], ['2026'], ['1900'], ['1901'], ['  2022  ']])('%j vale e vai para o banco como o 1º de janeiro', (texto) => {
      const t = texto.trim();
      expect(ano(texto)).toEqual({ ok: true, dataEvento: `${t}-01-01`, precisao: 'ano', ano: t });
    });

    it.each([
      ['2027'], ['2099'], ['1899'], ['1000'], ['0000'],
      ['22'], ['202'], ['20'], ['2'], ['20222'], ['02022'], ['120222'],
      ['há 2 anos'], ['2O22'], ['dois mil'], ['2022a'], ['2022-06-10'], ['2022-06'], ['06/2022'], ['2022.5'], ['-2022'], ['+2022'], ['１９９９'],
      [''], ['   '],
    ])('%j fica de fora com a frase do ano', (texto) => {
      expect(ano(texto)).toEqual({ ok: false, erro: ERRO_DO_ANO_CONFIRMADO });
    });

    it('o limite de cima é o ano de "hoje", e o de baixo é 1900', () => {
      expect(validarDataConfirmada({ precisao: 'ano', texto: '2026', nascimento: null }, '2025-12-31').ok).toBe(false);
      expect(validarDataConfirmada({ precisao: 'ano', texto: '2025', nascimento: null }, '2025-12-31').ok).toBe(true);
      expect(validarDataConfirmada({ precisao: 'ano', texto: '2026', nascimento: null }, '2026-01-01').ok).toBe(true);
    });

    it('a frase do ano diz como escrever', () => {
      expect(ERRO_DO_ANO_CONFIRMADO).toBe('Ano inválido: use 4 números, de 1900 até o ano atual.');
    });
  });

  describe('nascimento do paciente', () => {
    it('dia antes do nascimento é erro com a data de nascimento na frase; no dia do nascimento e depois vale', () => {
      expect(dia('1980-05-09', '1980-05-10')).toEqual({ ok: false, erro: 'A data não pode ser antes do nascimento do cliente (10/05/1980).' });
      expect(dia('1980-05-10', '1980-05-10')).toMatchObject({ ok: true });
      expect(dia('1980-05-11', '1980-05-10')).toMatchObject({ ok: true });
    });

    it('ano antes do ano de nascimento é erro; no ano do nascimento vale (não dá para saber o dia)', () => {
      expect(ano('1979', '1980-05-10')).toEqual({ ok: false, erro: 'O ano não pode ser antes do nascimento do cliente (1980).' });
      expect(ano('1980', '1980-05-10')).toMatchObject({ ok: true, dataEvento: '1980-01-01' });
      expect(ano('1981', '1980-05-10')).toMatchObject({ ok: true });
    });

    it('nascimento desconhecido ou ilegível é ignorado (nem erro nem trava)', () => {
      for (const n of [null, undefined, '', 'abc', '1980-02-31', '2999-01-01', '1899-01-01', '10/05/1980']) {
        expect(dia('1950-01-01', n), JSON.stringify(n)).toMatchObject({ ok: true });
        expect(ano('1950', n), JSON.stringify(n)).toMatchObject({ ok: true });
      }
    });

    it('a data fora da régua (futuro) continua sendo erro de data, não de nascimento', () => {
      expect(dia('2027-01-01', '1980-05-10')).toEqual({ ok: false, erro: ERRO_DA_DATA });
    });
  });
});

describe('montarLinhaDaConfirmacao', () => {
  const T = '11111111-1111-4111-8111-111111111111';
  const P = '22222222-2222-4222-8222-222222222222';
  const CHAVE = 'historico_clinico:cirurgia:id:k3j9x0ab';
  const entrada = (extra: Partial<EntradaDaConfirmacao> = {}): EntradaDaConfirmacao => ({
    terapeutaId: T, pacienteId: P, chave: CHAVE, relato: { tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' },
    tipo: 'cirurgia', precisao: 'dia', texto: '2022-06-10', nascimento: '1985-03-02',
    profissional: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' }, ...extra,
  });
  const linhaDe = (extra: Partial<EntradaDaConfirmacao> = {}) => {
    const r = montarLinhaDaConfirmacao(entrada(extra), HOJE);
    if (!r.ok) throw new Error(`devia montar: ${r.erro}`);
    return r.linha;
  };
  const erroDe = (extra: Partial<EntradaDaConfirmacao> = {}) => {
    const r = montarLinhaDaConfirmacao(entrada(extra), HOJE);
    if (r.ok) throw new Error('devia recusar');
    return r.erro;
  };

  it('dia: a linha inteira, coluna por coluna', () => {
    expect(linhaDe()).toEqual({
      id: idDaConfirmacao(T, P, CHAVE),
      terapeuta_id: T,
      paciente_id: P,
      data_evento: '2022-06-10',
      tipo: 'cirurgia',
      titulo: 'Ligamento do joelho (LCA)',
      descricao: null,
      sistema_corporal: null,
      severidade: 0,
      resolvido: true,
      visivel_paciente: false,
      profissional_registro: 'Ana Souza · CREFITO 12345-F',
      metadata: {
        versao: 1,
        origem: 'confirmacao_de_marco',
        fonte: 'historico_clinico',
        chave_cliente: CHAVE,
        relato_cliente: { tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' },
        precisao: 'dia',
        confirmado_por: { nome: 'Ana Souza', registro: '12345-F' },
      },
    });
  });

  it('só o ano: data_evento é o 1º de janeiro, a descrição diz que só o ano é conhecido e a precisão vai no metadata', () => {
    const linha = linhaDe({ precisao: 'ano', texto: '2022' });
    expect(linha.data_evento).toBe('2022-01-01');
    expect(linha.descricao).toBe('Data aproximada: só o ano (2022).');
    expect(linha.descricao).toBe(FRASE_SO_O_ANO('2022'));
    expect(linha.metadata.precisao).toBe('ano');
  });

  it('o texto digitado com espaços nas pontas grava aparado', () => {
    expect(linhaDe({ precisao: 'ano', texto: ' 2021 ' }).data_evento).toBe('2021-01-01');
    expect(linhaDe({ texto: ' 2021-02-03 ' }).data_evento).toBe('2021-02-03');
  });

  it.each([['visivel_paciente', false], ['resolvido', true], ['severidade', 0], ['sistema_corporal', null]])('%s vai explícito como %j (não deixa o padrão da coluna decidir)', (coluna, valor) => {
    const linha = linhaDe() as unknown as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(linha, coluna)).toBe(true);
    expect(linha[coluna]).toBe(valor);
  });

  it('as complicações do cliente NÃO vão para a descrição (nem no dia, nem no ano): ficam só no metadata', () => {
    expect(linhaDe().descricao).toBeNull();
    expect(linhaDe({ precisao: 'ano', texto: '2022' }).descricao).not.toContain('dor ao agachar');
    expect(linhaDe().metadata.relato_cliente.complicacoes).toBe('dor ao agachar');
  });

  it('não manda created_at, updated_at nem confirmado_em (o servidor preenche e created_at é o "quando")', () => {
    const linha = linhaDe();
    expect(Object.keys(linha).sort()).toEqual([
      'data_evento', 'descricao', 'id', 'metadata', 'paciente_id', 'profissional_registro', 'resolvido', 'severidade', 'sistema_corporal',
      'terapeuta_id', 'tipo', 'titulo', 'visivel_paciente',
    ]);
    expect(Object.keys(linha.metadata).sort()).toEqual(['chave_cliente', 'confirmado_por', 'fonte', 'origem', 'precisao', 'relato_cliente', 'versao']);
    expect(JSON.stringify(linha)).not.toMatch(/created_at|updated_at|confirmado_em/);
  });

  it('o profissional escolhe: Internação grava como "internacao"', () => {
    expect(linhaDe({ tipo: 'internacao' }).tipo).toBe('internacao');
    expect(linhaDe({ tipo: 'cirurgia' }).tipo).toBe('cirurgia');
  });

  it.each([[''], ['outro'], ['Cirurgia'], ['nascimento'], ['  '], ['internação']])('tipo %j não é uma das duas escolhas: pede para escolher', (tipo) => {
    expect(erroDe({ tipo })).toBe(ERRO_SEM_TIPO_ESCOLHIDO);
    expect(ERRO_SEM_TIPO_ESCOLHIDO).toBe('Escolha se foi cirurgia ou internação.');
  });

  it('os tipos aceitos são só os dois que o CHECK da tabela aceita', () => {
    expect([...TIPOS_CONFIRMAVEIS]).toEqual(['cirurgia', 'internacao']);
  });

  it('o título é o texto do cliente aparado, sem o prefixo "Cirurgia ou internação: " (esse só existe na tela)', () => {
    const linha = linhaDe({ relato: { tipo: '  Menisco  ', ano: '2022', complicacoes: '' } });
    expect(linha.titulo).toBe('Menisco');
    expect(linha.metadata.relato_cliente.tipo).toBe('Menisco');
  });

  it('o relato guardado é o texto normalizado do jeito que a leitura faz (aparado), como texto; ano que não vale ("2O22") segue como veio', () => {
    expect(linhaDe({ relato: { tipo: 'Menisco', ano: ' 2O22 ', complicacoes: ' dor ' } }).metadata.relato_cliente).toEqual({ tipo: 'Menisco', ano: '2O22', complicacoes: 'dor' });
  });

  describe('quem confirmou (montado a partir do perfil, nunca digitado)', () => {
    it('nome, sobrenome e registro viram "Nome Sobrenome · CREFITO N"', () => {
      expect(linhaDe().profissional_registro).toBe('Ana Souza · CREFITO 12345-F');
    });

    it('sem sobrenome: só o nome', () => {
      expect(linhaDe({ profissional: { nome: 'Ana', sobrenome: '', crefito: '1-F' } }).profissional_registro).toBe('Ana · CREFITO 1-F');
      expect(linhaDe({ profissional: { nome: 'Ana', sobrenome: undefined, crefito: '1-F' } }).metadata.confirmado_por).toEqual({ nome: 'Ana', registro: '1-F' });
    });

    it('crefito que já começa com "CREFITO" não repete a palavra', () => {
      expect(linhaDe({ profissional: { nome: 'Ana', sobrenome: 'S', crefito: 'CREFITO 3/12345-F' } }).profissional_registro).toBe('Ana S · CREFITO 3/12345-F');
      expect(linhaDe({ profissional: { nome: 'Ana', sobrenome: 'S', crefito: 'crefito-3 123' } }).profissional_registro).toBe('Ana S · crefito-3 123');
    });

    it('sem registro profissional: profissional_registro fica nulo, mas o nome vai no metadata', () => {
      for (const crefito of [undefined, null, '', '   ']) {
        const linha = linhaDe({ profissional: { nome: 'Ana', sobrenome: 'Souza', crefito } });
        expect(linha.profissional_registro).toBeNull();
        expect(linha.metadata.confirmado_por).toEqual({ nome: 'Ana Souza', registro: null });
      }
    });

    it('sem perfil nenhum: tudo nulo, e a confirmação ainda é montada', () => {
      for (const profissional of [null, undefined, {}]) {
        const linha = linhaDe({ profissional });
        expect(linha.profissional_registro).toBeNull();
        expect(linha.metadata.confirmado_por).toEqual({ nome: null, registro: null });
      }
    });

    it('perfil com só o registro: "CREFITO N", sem nome', () => {
      expect(linhaDe({ profissional: { nome: '', crefito: '9-F' } }).profissional_registro).toBe('CREFITO 9-F');
    });
  });

  describe('o que recusa, com frase', () => {
    it('data inválida devolve a frase da data (a mesma da validação)', () => {
      expect(erroDe({ texto: '2022-02-31' })).toBe('Data inválida: não pode ser no futuro nem antes de 1900.');
      expect(erroDe({ texto: '2026-11-16' })).toBe('Data inválida: não pode ser no futuro nem antes de 1900.');
      expect(erroDe({ precisao: 'ano', texto: 'há 2 anos' })).toBe(ERRO_DO_ANO_CONFIRMADO);
      expect(erroDe({ precisao: 'ano', texto: '2O22' })).toBe(ERRO_DO_ANO_CONFIRMADO);
      expect(erroDe({ precisao: 'ano', texto: '22' })).toBe(ERRO_DO_ANO_CONFIRMADO);
      expect(erroDe({ precisao: 'ano', texto: '20222' })).toBe(ERRO_DO_ANO_CONFIRMADO);
    });

    it('data antes do nascimento do paciente', () => {
      expect(erroDe({ texto: '1985-03-01', nascimento: '1985-03-02' })).toMatch(/antes do nascimento/);
      expect(erroDe({ precisao: 'ano', texto: '1984', nascimento: '1985-03-02' })).toMatch(/antes do nascimento/);
      expect(linhaDe({ texto: '1985-03-02', nascimento: '1985-03-02' }).data_evento).toBe('1985-03-02');
    });

    it('sem profissional ou sem paciente: nada é montado', () => {
      for (const extra of [{ terapeutaId: '' }, { pacienteId: '' }, { terapeutaId: '  ' }, { pacienteId: '' , terapeutaId: '' }]) {
        expect(erroDe(extra)).toBe(ERRO_SEM_IDENTIFICACAO);
      }
    });

    it('chave que não pode ser guardada (longa, com controle, vazia) ou relato sem tipo: item não confirmável', () => {
      for (const chave of ['a'.repeat(201), 'ab\ncd', '']) expect(erroDe({ chave })).toBe(ERRO_ITEM_NAO_CONFIRMAVEL);
      expect(erroDe({ relato: { tipo: '  ', ano: '2022', complicacoes: '' } })).toBe(ERRO_ITEM_NAO_CONFIRMAVEL);
      expect(linhaDe({ chave: 'a'.repeat(200) }).metadata.chave_cliente).toHaveLength(200);
    });

    it('tipo mais complicações com mais de 2000 letras: recusa com frase que explica, sem cortar o texto', () => {
      expect(LIMITE_DO_RELATO_CONFIRMADO).toBe(2000);
      const exato = linhaDe({ relato: { tipo: 'a'.repeat(1000), ano: '2022', complicacoes: 'b'.repeat(1000) } });
      expect(exato.metadata.relato_cliente.complicacoes).toHaveLength(1000);
      const passou = erroDe({ relato: { tipo: 'a'.repeat(1000), ano: '2022', complicacoes: 'b'.repeat(1001) } });
      expect(passou).toMatch(/2000 letras/);
      expect(passou).toMatch(/resumir/);
      expect(erroDe({ relato: { tipo: 'a'.repeat(2001), ano: '2022', complicacoes: '' } })).toMatch(/2000 letras/);
    });

    it('as letras são contadas depois de aparar (espaços nas pontas não contam)', () => {
      expect(montarLinhaDaConfirmacao(entrada({ relato: { tipo: `  ${'a'.repeat(1000)}  `, ano: '2022', complicacoes: ` ${'b'.repeat(1000)} ` } }), HOJE).ok).toBe(true);
    });

    it('o texto do ano muito longo também é recusado (não é copiado sem limite)', () => {
      expect(LIMITE_DO_ANO_RELATADO).toBe(100);
      expect(montarLinhaDaConfirmacao(entrada({ relato: { tipo: 'Joelho', ano: 'x'.repeat(100), complicacoes: '' } }), HOJE).ok).toBe(true);
      expect(erroDe({ relato: { tipo: 'Joelho', ano: 'x'.repeat(101), complicacoes: '' } })).toMatch(/100 letras/);
    });

    it('erroDoTamanhoDoRelato: nulo quando cabe, frase quando não', () => {
      expect(erroDoTamanhoDoRelato({ tipo: 'Joelho', ano: '2022', complicacoes: '' })).toBeNull();
      expect(erroDoTamanhoDoRelato({ tipo: 'a'.repeat(2000), ano: '', complicacoes: '' })).toBeNull();
      expect(erroDoTamanhoDoRelato({ tipo: 'a'.repeat(1500), ano: '', complicacoes: 'b'.repeat(501) })).toMatch(/2000 letras/);
    });

    it('o relato grande demais é recusado antes de qualquer outra coisa do formulário (não adianta o profissional digitar a data)', () => {
      expect(erroDe({ relato: { tipo: 'a'.repeat(2001), ano: '2022', complicacoes: '' }, tipo: '', texto: 'lixo' })).toMatch(/2000 letras/);
    });
  });

  it('é determinística: a mesma entrada dá a mesma linha, e não depende do relógio da máquina', () => {
    expect(linhaDe()).toEqual(linhaDe());
    expect(linhaDe().id).toBe(idDaConfirmacao(T, P, CHAVE));
  });

  it('outro profissional ou outro paciente grava em outro id (não trava o do outro)', () => {
    const base = linhaDe().id;
    expect(linhaDe({ terapeutaId: '99999999-9999-4999-8999-999999999999' }).id).not.toBe(base);
    expect(linhaDe({ pacienteId: '99999999-9999-4999-8999-999999999999' }).id).not.toBe(base);
  });

  it('nunca guarda Date: data_evento é sempre o texto AAAA-MM-DD', () => {
    for (const l of [linhaDe(), linhaDe({ precisao: 'ano', texto: '2022' })]) {
      expect(typeof l.data_evento).toBe('string');
      expect(l.data_evento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// Contrato com o banco real: lê a migração que cria a tabela (sem alterá-la) e confere que o que a tela grava cabe nela. O
// banco falso aceita qualquer coluna e qualquer valor, então só este teste pega uma coluna que não existe ou um tipo fora do CHECK.
describe('contrato com a tabela historia_vida_paciente (lê a migração)', () => {
  const sql = readFileSync(join(__dirname, '..', '..', 'supabase', 'migrations', '20260614230000_historia_vida_paciente.sql'), 'utf8');
  const corpo = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.historia_vida_paciente ('), sql.indexOf('ALTER TABLE public.historia_vida_paciente ENABLE'));
  const colunas = [...corpo.matchAll(/^\s{2}(\w+)\s+(uuid|date|text|smallint|boolean|jsonb|timestamptz)\b([^\n]*)$/gm)].map((m) => ({ nome: m[1], tipo: m[2], resto: m[3] }));
  const nomes = colunas.map((c) => c.nome);
  const tiposDoCheck = [...(corpo.match(/CHECK \(tipo IN \(([\s\S]*?)\)\)/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);

  const linha = () => {
    const r = montarLinhaDaConfirmacao({
      terapeutaId: '11111111-1111-4111-8111-111111111111', pacienteId: '22222222-2222-4222-8222-222222222222', chave: 'historico_clinico:cirurgia:id:k1',
      relato: { tipo: 'Joelho', ano: '2022', complicacoes: '' }, tipo: 'cirurgia', precisao: 'ano', texto: '2022', profissional: { nome: 'Ana', crefito: '1-F' },
    }, HOJE);
    if (!r.ok) throw new Error(r.erro);
    return r.linha as unknown as Record<string, unknown>;
  };

  it('a leitura da migração achou as colunas e o CHECK (o teste não passa vazio)', () => {
    expect(nomes).toEqual(expect.arrayContaining(['id', 'terapeuta_id', 'paciente_id', 'data_evento', 'tipo', 'titulo', 'metadata', 'visivel_paciente', 'resolvido']));
    expect(nomes).toHaveLength(15);
    expect(tiposDoCheck).toContain('cirurgia');
    expect(tiposDoCheck.length).toBeGreaterThan(10);
  });

  it('toda chave da linha montada é uma coluna da tabela', () => {
    for (const chave of Object.keys(linha())) expect(nomes, chave).toContain(chave);
  });

  it('toda coluna obrigatória e sem valor padrão está na linha', () => {
    const obrigatorias = colunas.filter((c) => /NOT NULL/.test(c.resto) && !/DEFAULT/.test(c.resto) && !/PRIMARY KEY/.test(c.resto)).map((c) => c.nome);
    expect(obrigatorias).toEqual(['terapeuta_id', 'paciente_id', 'data_evento', 'titulo']);
    for (const nome of obrigatorias) expect(linha()[nome], nome).toBeTruthy();
  });

  it('os dois tipos que o profissional escolhe passam no CHECK de tipo', () => {
    for (const tipo of TIPOS_CONFIRMAVEIS) expect(tiposDoCheck).toContain(tipo);
  });

  it('o tipo de cada valor combina com o da coluna (data como texto de date, metadata como objeto para jsonb, id como uuid)', () => {
    const l = linha();
    const tipoDe = (nome: string) => colunas.find((c) => c.nome === nome)?.tipo;
    expect(tipoDe('data_evento')).toBe('date');
    expect(l.data_evento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tipoDe('metadata')).toBe('jsonb');
    expect(typeof l.metadata).toBe('object');
    expect(tipoDe('id')).toBe('uuid');
    expect(l.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(tipoDe('severidade')).toBe('smallint');
    expect(l.severidade).toBe(0);
    expect(tipoDe('resolvido')).toBe('boolean');
    expect(tipoDe('visivel_paciente')).toBe('boolean');
    expect(typeof l.resolvido).toBe('boolean');
    expect(typeof l.visivel_paciente).toBe('boolean');
  });

  it('severidade 0 cabe no CHECK da coluna (0 a 4)', () => {
    expect(corpo).toMatch(/severidade smallint DEFAULT 0 CHECK \(severidade BETWEEN 0 AND 4\)/);
  });

  it('o padrão de visivel_paciente na tabela é verdadeiro e o de resolvido é falso: por isso a linha manda os dois explícitos', () => {
    expect(corpo).toMatch(/visivel_paciente boolean DEFAULT true/);
    expect(corpo).toMatch(/resolvido boolean DEFAULT false/);
    expect(linha().visivel_paciente).toBe(false);
    expect(linha().resolvido).toBe(true);
  });

  it('o que a leitura pede do metadata existe no que a escrita grava (chaves do caminho JSON)', () => {
    const metadata = linha().metadata as Record<string, unknown>;
    const pedidas = [...COLUNAS_DA_CONFIRMACAO.matchAll(/metadata->>?(\w+)/g)].map((m) => m[1]);
    expect(pedidas).toEqual(['origem', 'versao', 'chave_cliente', 'precisao', 'relato_cliente', 'confirmado_por']);
    for (const chave of pedidas) expect(Object.keys(metadata), chave).toContain(chave);
  });
});

describe('lerPrecisao', () => {
  it('só o texto exato "ano" é ano', () => {
    expect(lerPrecisao('ano')).toBe('ano');
  });

  it.each([['dia'], ['Ano'], ['ANO'], [' ano'], ['ano '], ['mes'], [''], [null], [undefined], [5], [0], [true], [{}], [[]], [['ano']], [{ precisao: 'ano' }]])('%j é dia', (v) => {
    expect(lerPrecisao(v)).toBe('dia');
  });
});

describe('dataDaHistoriaDeVida', () => {
  it('sem precisão (linha comum) é o dia, como sempre foi: "2022-01-01" sem marca continua 1º de janeiro de verdade', () => {
    expect(dataDaHistoriaDeVida('2022-01-01', undefined, HOJE)).toEqual({ iso: '2022-01-01', precisao: 'dia' });
    expect(dataDaHistoriaDeVida('2022-06-10', undefined, HOJE)).toEqual({ iso: '2022-06-10', precisao: 'dia' });
  });

  it.each([['Ano'], [null], [5], ['dia'], [{}], ['']])('precisão %j: dia (01/01/2022 continua 01/01/2022)', (precisao) => {
    expect(dataDaHistoriaDeVida('2022-01-01', precisao, HOJE)).toEqual({ iso: '2022-01-01', precisao: 'dia' });
  });

  it('precisão "ano" corta para o ano, tenha ou não o dia na data (nunca mostra mais do que a precisão diz)', () => {
    expect(dataDaHistoriaDeVida('2022-01-01', 'ano', HOJE)).toEqual({ iso: '2022', precisao: 'ano' });
    expect(dataDaHistoriaDeVida('2022-06-10', 'ano', HOJE)).toEqual({ iso: '2022', precisao: 'ano' });
    expect(dataDaHistoriaDeVida('2022-12-31', 'ano', HOJE)).toEqual({ iso: '2022', precisao: 'ano' });
  });

  it('data inválida dá nulo nas duas precisões (a linha vai para "registros de fora")', () => {
    for (const precisao of ['ano', 'dia', undefined]) {
      for (const data of ['2022-02-31', '2027-01-01', '2026-11-16', '1899-12-31', '0001-01-01', '', null, undefined, 5, {}, 'abc', '2022']) {
        expect(dataDaHistoriaDeVida(data, precisao, HOJE), `${JSON.stringify(data)} / ${String(precisao)}`).toBeNull();
      }
    }
  });

  it('o 1º de janeiro do ano de hoje vale; o ano seguinte não', () => {
    expect(dataDaHistoriaDeVida('2026-01-01', 'ano', HOJE)).toEqual({ iso: '2026', precisao: 'ano' });
    expect(dataDaHistoriaDeVida('2027-01-01', 'ano', HOJE)).toBeNull();
  });

  it('instante com fuso vira o dia do Brasil antes de cortar para o ano (o resultado não muda com o fuso da máquina)', () => {
    expect(dataDaHistoriaDeVida('2023-01-01T02:00:00+00:00', 'ano', HOJE)).toEqual({ iso: '2022', precisao: 'ano' }); // 31/12/2022 no Brasil
    expect(dataDaHistoriaDeVida('2023-01-01T02:00:00+00:00', undefined, HOJE)).toEqual({ iso: '2022-12-31', precisao: 'dia' });
  });
});
