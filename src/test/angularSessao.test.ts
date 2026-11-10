import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compararSessoes, explicacaoDaLinhaSessao, POSICOES_DA_NOTA, ROTULO_POSICAO_DA_NOTA, TEXTO_NAO_CLASSIFICA,
  type MedidaSalva, type SessaoParaComparar,
} from '@/lib/angular/comparar';
import {
  agruparPorSessao, dataDaSessao, descricaoDaNota, escolherAnterior, lerDadosExtras, montarDadosExtras, novaSessaoId,
  classificarPontos, posicoesDaSessao, previstasPadrao, rotuloDaSessao, sessoesComPosicao, tituloDaNota, type NotaDeAnalise,
} from '@/lib/angular/sessao';
import { VISTAS_DA_SESSAO, type SessaoGravada } from '@/lib/angular/tiposSessao';
import { ehMedidaParaConfirmar } from '@/components/angular/textosSessao';

const m = (id: string, graus: number, extra: Partial<MedidaSalva> = {}): MedidaSalva => ({ id, graus, ...extra });
const OMBROS_D = (g: string) => `Linha dos ombros: ${g}° com a horizontal, lado direito mais alto.`;
const OMBROS_E = (g: string) => `Linha dos ombros: ${g}° com a horizontal, lado esquerdo mais alto.`;
const PELVE_E = (g: string) => `Linha da pelve: ${g}° com a horizontal, lado esquerdo mais alto.`;
const PELVE_D = (g: string) => `Linha da pelve: ${g}° com a horizontal, lado direito mais alto.`;
const OPCOES = { compassoRef: 'baixo', unidadePrumo: 'graus', olhaPara: 'direita' } as const;
const ID_SESSAO = '3f2b8c1e-5d4a-4b7e-9a10-6c2d8e4f1a77';
const SESSAO: SessaoGravada = { id: ID_SESSAO, ordem: 2, previstas: ['frente', 'perfil_d', 'perfil_e', 'costas'], iniciadaEm: '2026-03-12T13:00:00.000Z' };

const DADOS_VAZIOS = {
  esquema: 1, vista: null, ladoPerfil: null, posicao: null, medidas: [], metodo: null, nivelGraus: null,
  escalaCmPorPx: null, opcoes: {}, sessao: null, pontosAjustados: null,
};

// ---------------------------------------------------------------------------
// novaSessaoId
// ---------------------------------------------------------------------------

describe('novaSessaoId', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('usa crypto.randomUUID quando existe', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-4333-8444-555555555555' });
    expect(novaSessaoId()).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('sem randomUUID, monta um uuid v4 com getRandomValues (versão 4 e variante 10)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.fill(0xff); return b; } });
    expect(novaSessaoId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.fill(0); return b; } });
    expect(novaSessaoId()).toBe('00000000-0000-4000-8000-000000000000');
    // bytes 00 01 02 ... 0f: o byte 6 (06) vira 46 e o byte 8 (08) vira 88
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.forEach((_, i) => { b[i] = i; }); return b; } });
    expect(novaSessaoId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });

  it('se randomUUID existir mas lançar erro, usa a alternativa', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => { throw new Error('contexto não seguro'); },
      getRandomValues: (b: Uint8Array) => { b.fill(0); return b; },
    });
    expect(novaSessaoId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('sem crypto nenhuma, cai no Math.random e ainda dá um uuid v4 válido', () => {
    vi.stubGlobal('crypto', undefined);
    const sorteio = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // 0.5 × 256 = 128 = 0x80 em todos os bytes; o byte 6 vira 40 e o byte 8 fica 80
    expect(novaSessaoId()).toBe('80808080-8080-4080-8080-808080808080');
    sorteio.mockRestore();
    const a = novaSessaoId(), b = novaSessaoId();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  it('no ambiente de teste (crypto real) devolve um uuid v4', () => {
    expect(novaSessaoId()).toMatch(UUID_V4);
  });
});

describe('previstasPadrao', () => {
  it('são as quatro posições na ordem de fotografar, em cópia nova', () => {
    expect(previstasPadrao()).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    const a = previstasPadrao();
    a.pop();
    expect(previstasPadrao()).toHaveLength(4);
    expect(VISTAS_DA_SESSAO).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// montarDadosExtras
// ---------------------------------------------------------------------------

describe('montarDadosExtras (esquema 2)', () => {
  const medidas = [m('cva', 50.2, { texto: 'Ângulo craniovertebral: 50,2°.' }), m('regua', 12, { unidade: 'cm' })];

  it('perfil direito de uma sessão: campos antigos, esquema 2, lado, sessão e pontos ajustados', () => {
    const d = montarDadosExtras({
      vista: 'perfil', lado: 'D', medidas, metodo: 'automatica_conferida', nivelGraus: 1.8, escalaCmPorPx: 0.21,
      opcoes: OPCOES, sessao: SESSAO, pontosAjustados: ['cva'],
    });
    expect(d).toStrictEqual({
      vista: 'perfil',
      lado_perfil: 'D',
      medidas: [{ id: 'cva', graus: 50.2, texto: 'Ângulo craniovertebral: 50,2°.' }, { id: 'regua', graus: 12, unidade: 'cm' }],
      metodo: 'automatica_conferida',
      nivel_graus: 1.8,
      escala_cm_por_px: 0.21,
      opcoes: { compassoRef: 'baixo', unidadePrumo: 'graus', olhaPara: 'direita' },
      esquema: 2,
      sessao: { id: ID_SESSAO, ordem: 2, previstas: ['frente', 'perfil_d', 'perfil_e', 'costas'], iniciadaEm: '2026-03-12T13:00:00.000Z' },
      pontos_ajustados: ['cva'],
    });
  });

  it('a vista continua frente, perfil ou costas (o filtro do histórico antigo compara com essa palavra)', () => {
    const d = montarDadosExtras({ vista: 'perfil', lado: 'E', medidas, metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES, sessao: SESSAO });
    expect(d.vista).toBe('perfil');
    expect(d.lado_perfil).toBe('E');
  });

  it('sem sessão, sem lado e sem pontos ajustados, essas chaves nem existem', () => {
    const d = montarDadosExtras({ vista: 'frente', medidas, metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES });
    expect(d).toStrictEqual({
      vista: 'frente', medidas, metodo: 'marcacao_manual', nivel_graus: null, escala_cm_por_px: null, opcoes: OPCOES, esquema: 2,
    });
    expect(Object.keys(d)).not.toContain('sessao');
    expect(Object.keys(d)).not.toContain('lado_perfil');
    expect(Object.keys(d)).not.toContain('pontos_ajustados');
  });

  it('o lado só vale no perfil: frente e costas ignoram o que vier', () => {
    const base = { medidas, metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES } as const;
    expect('lado_perfil' in montarDadosExtras({ ...base, vista: 'frente', lado: 'E' })).toBe(false);
    expect('lado_perfil' in montarDadosExtras({ ...base, vista: 'costas', lado: 'D' })).toBe(false);
  });

  it('perfil sem lado (null ou ausente) não ganha lado_perfil: fica "lado não informado"', () => {
    const base = { vista: 'perfil', medidas, metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES } as const;
    expect('lado_perfil' in montarDadosExtras({ ...base, lado: null })).toBe(false);
    expect('lado_perfil' in montarDadosExtras(base)).toBe(false);
  });

  it('lista vazia de pontos ajustados é gravada (nenhum ajustado); null e ausente não gravam', () => {
    const base = { vista: 'frente', medidas, metodo: 'automatica_conferida', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES } as const;
    expect(montarDadosExtras({ ...base, pontosAjustados: [] }).pontos_ajustados).toStrictEqual([]);
    expect('pontos_ajustados' in montarDadosExtras({ ...base, pontosAjustados: null })).toBe(false);
    expect('pontos_ajustados' in montarDadosExtras(base)).toBe(false);
  });

  it('não guarda referência às listas de quem chamou', () => {
    const previstas = previstasPadrao();
    const ajustados = ['cva'];
    const d = montarDadosExtras({
      vista: 'frente', medidas, metodo: 'automatica_conferida', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES,
      sessao: { ...SESSAO, previstas }, pontosAjustados: ajustados,
    });
    previstas.pop();
    ajustados.push('outra');
    expect(d.sessao?.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(d.pontos_ajustados).toEqual(['cva']);
  });

  it('vai e volta pelo JSON do banco sem perder nada: montar → lerDadosExtras', () => {
    const d = montarDadosExtras({
      vista: 'perfil', lado: 'E', medidas: [m('pelve-perfil', 4.3, { sentido: 'anterior' }), ...medidas], metodo: 'automatica_conferida',
      nivelGraus: -2.5, escalaCmPorPx: 0.2, opcoes: { compassoRef: 'cima', unidadePrumo: 'cm', olhaPara: 'esquerda' },
      sessao: SESSAO, pontosAjustados: ['pelve-perfil', 'cva'],
    });
    const doBanco: unknown = JSON.parse(JSON.stringify(d));
    expect(lerDadosExtras(doBanco)).toStrictEqual({
      esquema: 2,
      vista: 'perfil',
      ladoPerfil: 'E',
      posicao: 'perfil_e',
      medidas: [
        { id: 'pelve-perfil', graus: 4.3, sentido: 'anterior' },
        { id: 'cva', graus: 50.2, texto: 'Ângulo craniovertebral: 50,2°.' },
        { id: 'regua', graus: 12, unidade: 'cm' },
      ],
      metodo: 'automatica_conferida',
      nivelGraus: -2.5,
      escalaCmPorPx: 0.2,
      opcoes: { compassoRef: 'cima', unidadePrumo: 'cm', olhaPara: 'esquerda' },
      sessao: { id: ID_SESSAO, ordem: 2, previstas: ['frente', 'perfil_d', 'perfil_e', 'costas'], iniciadaEm: '2026-03-12T13:00:00.000Z' },
      pontosAjustados: ['pelve-perfil', 'cva'],
    });
  });

  it('as quatro posições da sessão voltam com a posição certa', () => {
    const lerPosicao = (vista: 'frente' | 'perfil' | 'costas', lado?: 'D' | 'E') =>
      lerDadosExtras(JSON.parse(JSON.stringify(montarDadosExtras({ vista, lado, medidas, metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES })))).posicao;
    expect(lerPosicao('frente')).toBe('frente');
    expect(lerPosicao('perfil', 'D')).toBe('perfil_d');
    expect(lerPosicao('perfil', 'E')).toBe('perfil_e');
    expect(lerPosicao('costas')).toBe('costas');
  });
});

// ---------------------------------------------------------------------------
// lerDadosExtras: tolerante
// ---------------------------------------------------------------------------

describe('lerDadosExtras (tolerante)', () => {
  it('nunca lança e devolve tudo vazio para o que não é objeto', () => {
    for (const x of [null, undefined, 'texto', 42, true, [], [1, 2], () => 1]) {
      expect(lerDadosExtras(x)).toStrictEqual(DADOS_VAZIOS);
    }
    expect(lerDadosExtras({})).toStrictEqual(DADOS_VAZIOS);
  });

  it('nota esquema 1, como o app gravava antes da sessão: sem sessão, esquema 1, posição pela vista', () => {
    const d = lerDadosExtras({
      vista: 'frente',
      medidas: [{ id: 'ombros', graus: 3, texto: OMBROS_D('3,0') }],
      metodo: 'automatica_conferida',
      nivel_graus: null,
      escala_cm_por_px: null,
      opcoes: { compassoRef: 'baixo', unidadePrumo: 'graus', olhaPara: 'direita' },
    });
    expect(d).toStrictEqual({
      esquema: 1, vista: 'frente', ladoPerfil: null, posicao: 'frente',
      medidas: [{ id: 'ombros', graus: 3, texto: OMBROS_D('3,0') }],
      metodo: 'automatica_conferida', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES, sessao: null, pontosAjustados: null,
    });
  });

  it('perfil sem lado vira "perfil_sem_lado", nunca perfil_d nem perfil_e', () => {
    expect(lerDadosExtras({ vista: 'perfil', medidas: [{ id: 'cva', graus: 48 }] }).posicao).toBe('perfil_sem_lado');
    expect(lerDadosExtras({ vista: 'perfil', lado_perfil: 'X' }).posicao).toBe('perfil_sem_lado');
    expect(lerDadosExtras({ vista: 'perfil', lado_perfil: 'd' }).posicao).toBe('perfil_sem_lado');
    expect(lerDadosExtras({ vista: 'perfil', lado_perfil: null }).ladoPerfil).toBeNull();
    expect(lerDadosExtras({ vista: 'perfil', lado_perfil: 'D' }).posicao).toBe('perfil_d');
    expect(lerDadosExtras({ vista: 'perfil', lado_perfil: 'E' }).posicao).toBe('perfil_e');
  });

  it('lado_perfil solto numa frente ou costas é ignorado', () => {
    const d = lerDadosExtras({ vista: 'frente', lado_perfil: 'D' });
    expect(d.ladoPerfil).toBeNull();
    expect(d.posicao).toBe('frente');
    expect(lerDadosExtras({ vista: 'costas', lado_perfil: 'E' }).posicao).toBe('costas');
  });

  it('vista desconhecida ou ausente não tem posição (nota de vídeo, por exemplo)', () => {
    expect(lerDadosExtras({ vista: 'lateral' }).posicao).toBeNull();
    expect(lerDadosExtras({ vista: 'perfil_d' }).posicao).toBeNull();
    const video = lerDadosExtras({ metodo: 'video_gesto', gesto: 'ombro', capturas: [{ id: 'a', t: 1, quadro: 3, valor: 80 }] });
    expect(video.posicao).toBeNull();
    expect(video.vista).toBeNull();
    expect(video.metodo).toBeNull();
    expect(video.medidas).toEqual([]);
  });

  it('descarta só as medidas malformadas e mantém as boas, sem inventar campos', () => {
    const d = lerDadosExtras({
      vista: 'frente',
      medidas: [
        { id: 'ombros', graus: 2, texto: 'ok' },
        { id: 'pelve', graus: '1.5' },
        { graus: 3 },
        { id: '', graus: 3 },
        { id: 'cabeca', graus: null },
        { id: 'tronco', graus: Infinity },
        { id: 'prumo', graus: Number.NaN },
        null, 'texto', 7, [],
        { id: 'regua', graus: 12, unidade: 'cm' },
        { id: 'cva', graus: 48, unidade: 'graus', sentido: '', texto: 5 },
        { id: 'pelve-perfil', graus: 4.3, sentido: 'anterior', extra: 'x' },
        { id: 'joelho', graus: 0, unidade: '%' },
      ],
    });
    expect(d.medidas).toStrictEqual([
      { id: 'ombros', graus: 2, texto: 'ok' },
      { id: 'regua', graus: 12, unidade: 'cm' },
      { id: 'cva', graus: 48 },
      { id: 'pelve-perfil', graus: 4.3, sentido: 'anterior' },
      { id: 'joelho', graus: 0, unidade: '%' },
    ]);
  });

  it('medidas ausentes ou que não são lista dão lista vazia', () => {
    expect(lerDadosExtras({ vista: 'frente' }).medidas).toEqual([]);
    expect(lerDadosExtras({ vista: 'frente', medidas: null }).medidas).toEqual([]);
    expect(lerDadosExtras({ vista: 'frente', medidas: 'ombros' }).medidas).toEqual([]);
    expect(lerDadosExtras({ vista: 'frente', medidas: { id: 'ombros', graus: 1 } }).medidas).toEqual([]);
  });

  it('campos numéricos de tipo errado viram null; esquema inválido vira 1', () => {
    const d = lerDadosExtras({ vista: 'frente', nivel_graus: '2', escala_cm_por_px: 0, esquema: '2' });
    expect(d.nivelGraus).toBeNull();
    expect(d.escalaCmPorPx).toBeNull();
    expect(d.esquema).toBe(1);
    expect(lerDadosExtras({ escala_cm_por_px: -1 }).escalaCmPorPx).toBeNull();
    expect(lerDadosExtras({ escala_cm_por_px: 0.2 }).escalaCmPorPx).toBe(0.2);
    expect(lerDadosExtras({ nivel_graus: -2.5 }).nivelGraus).toBe(-2.5);
    expect(lerDadosExtras({ nivel_graus: 0 }).nivelGraus).toBe(0);
    expect(lerDadosExtras({ esquema: 2 }).esquema).toBe(2);
    expect(lerDadosExtras({ esquema: 2.7 }).esquema).toBe(2);
    expect(lerDadosExtras({ esquema: 0 }).esquema).toBe(1);
  });

  it('método desconhecido vira null', () => {
    expect(lerDadosExtras({ metodo: 'marcacao_manual' }).metodo).toBe('marcacao_manual');
    expect(lerDadosExtras({ metodo: 'automatica_conferida' }).metodo).toBe('automatica_conferida');
    expect(lerDadosExtras({ metodo: 'outro' }).metodo).toBeNull();
  });

  it('opções: só os valores conhecidos', () => {
    expect(lerDadosExtras({ opcoes: { compassoRef: 'cima', unidadePrumo: 'xx', olhaPara: 'esquerda', futuro: 1 } }).opcoes)
      .toStrictEqual({ compassoRef: 'cima', olhaPara: 'esquerda' });
    expect(lerDadosExtras({ opcoes: 'baixo' }).opcoes).toStrictEqual({});
  });

  it('bloco da sessão malformado: sem id vale como nota sem sessão; o resto ganha valores seguros', () => {
    expect(lerDadosExtras({ vista: 'frente', sessao: { id: 123 } }).sessao).toBeNull();
    expect(lerDadosExtras({ vista: 'frente', sessao: { id: '  ' } }).sessao).toBeNull();
    expect(lerDadosExtras({ vista: 'frente', sessao: 'abc' }).sessao).toBeNull();
    expect(lerDadosExtras({ vista: 'frente', sessao: { id: 's', ordem: '2', previstas: ['frente', 'lateral', 'frente', 'costas', 3], iniciadaEm: 99 } }).sessao)
      .toStrictEqual({ id: 's', ordem: 1, previstas: ['frente', 'costas'], iniciadaEm: '' });
    expect(lerDadosExtras({ sessao: { id: 's', ordem: 2.9, previstas: 'frente' } }).sessao?.ordem).toBe(2);
    expect(lerDadosExtras({ sessao: { id: 's', ordem: 0 } }).sessao?.ordem).toBe(1);
    expect(lerDadosExtras({ sessao: { id: 's', ordem: -3 } }).sessao?.previstas).toEqual([]);
  });

  it('pontos_ajustados: só textos; ausente é "não informado" e lista vazia é "nenhum"', () => {
    expect(lerDadosExtras({ pontos_ajustados: ['a', 2, null, 'b'] }).pontosAjustados).toEqual(['a', 'b']);
    expect(lerDadosExtras({ pontos_ajustados: 'a' }).pontosAjustados).toBeNull();
    expect(lerDadosExtras({}).pontosAjustados).toBeNull();
    expect(lerDadosExtras({ pontos_ajustados: [] }).pontosAjustados).toEqual([]);
  });

  it('campos desconhecidos não atrapalham nem aparecem no resultado', () => {
    const d = lerDadosExtras({ vista: 'costas', medidas: [{ id: 'ombros', graus: 1 }], futuro: { a: 1 }, esquema: 3 });
    expect(Object.keys(d).sort()).toEqual(Object.keys(DADOS_VAZIOS).sort());
    expect(d.posicao).toBe('costas');
    expect(d.esquema).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Texto da nota
// ---------------------------------------------------------------------------

describe('tituloDaNota', () => {
  it('"Análise angular — vista <posição>" para as quatro posições, sem "(n de total)"', () => {
    expect(tituloDaNota('frente')).toBe('Análise angular — vista frente');
    expect(tituloDaNota('perfil_d')).toBe('Análise angular — vista perfil direito');
    expect(tituloDaNota('perfil_e')).toBe('Análise angular — vista perfil esquerdo');
    expect(tituloDaNota('costas')).toBe('Análise angular — vista costas');
  });

  it('só recebe a posição: a ordem e as previstas ficam em dados_extras.sessao, e o título nunca fica com um total que o tempo desatualiza', () => {
    expect(tituloDaNota.length).toBe(1);
    for (const p of previstasPadrao()) expect(tituloDaNota(p)).not.toMatch(/\(\d+ de \d+\)|\d/);
  });
});

describe('ehMedidaParaConfirmar: quais medidas saem com "estimativa: confirme"', () => {
  it('cotovelo, braço, carregamento, punho e escápula (como antes)', () => {
    for (const id of ['cotovelos', 'cotovelo-perfil', 'cotovelo-perfil-d', 'braco-d', 'braco-e', 'carregamento-d', 'carregamento-e', 'punho-d', 'punho-e', 'escapulas']) {
      expect(ehMedidaParaConfirmar(id), id).toBe(true);
    }
  });

  it('também quadris, pelve, linha dos joelhos e joelho de perfil (o que docs/analise-angular-medidas.md manda confirmar)', () => {
    for (const id of ['quadris', 'pelve', 'linha-joelhos', 'joelho']) expect(ehMedidaParaConfirmar(id), id).toBe(true);
  });

  it('as demais não ganham a marca: o joelho de frente e de costas (valgo e varo), a pelve de perfil, ombros, cabeça, tronco, CVA e fio de prumo', () => {
    for (const id of ['joelho-d', 'joelho-e', 'pelve-perfil', 'ombros', 'ombros-cm', 'cabeca', 'tronco', 'tronco-perfil', 'cva', 'linha-tornozelos', 'perna-vertical', 'prumo-perfil-quadril-cm', 'prumo-frente-ombro-graus', 'livre', 'regua', '']) {
      expect(ehMedidaParaConfirmar(id), id).toBe(false);
    }
  });
});

describe('classificarPontos', () => {
  it('separa as medidas da posição em sugeridas pelo modelo, ajustadas à mão e marcadas só à mão', () => {
    expect(classificarPontos(['ombros', 'quadris', 'braco-d', 'carregamento-d', 'punho-d'], ['ombros', 'quadris', 'braco-d'], ['ombros']))
      .toEqual({ sugeridas: ['ombros', 'quadris', 'braco-d'], ajustadas: ['ombros'], soMao: ['carregamento-d', 'punho-d'] });
  });

  it('só conta medidas que têm resultado na posição, sem repetir: sugerida que ficou incompleta e ajustada que sumiu não entram', () => {
    // 'cotovelos' foi sugerida mas está incompleta (sem resultado); 'prumo-frente' dá vários resultados e conta uma vez.
    expect(classificarPontos(['ombros', 'prumo-frente', 'prumo-frente', 'punho-d'], ['ombros', 'cotovelos', 'prumo-frente'], ['cotovelos', 'prumo-frente']))
      .toEqual({ sugeridas: ['ombros', 'prumo-frente'], ajustadas: ['prumo-frente'], soMao: ['punho-d'] });
  });

  it('ajustada só vale se também foi sugerida: medida marcada à mão desde o início nunca vira "ajustada"', () => {
    expect(classificarPontos(['punho-d'], [], ['punho-d'])).toEqual({ sugeridas: [], ajustadas: [], soMao: ['punho-d'] });
  });

  it('sem medidas, tudo vazio', () => {
    expect(classificarPontos([], ['ombros'], ['ombros'])).toEqual({ sugeridas: [], ajustadas: [], soMao: [] });
  });
});

describe('descricaoDaNota', () => {
  const medidasTexto = 'Linha dos ombros: 2,0° com a horizontal, lado direito mais alto.\nLinha da pelve: 1,0° com a horizontal, lado esquerdo mais alto.';
  const REF = 'Os ângulos usam a horizontal e a vertical da imagem como referência.';

  it('marcação manual: "Pontos marcados manualmente" e termina com "A foto não é armazenada."', () => {
    expect(descricaoDaNota({ medidasTexto, metodo: 'marcacao_manual' }))
      .toBe(`${medidasTexto}\nPontos marcados manualmente. ${REF} A foto não é armazenada.`);
  });

  const pontos = (sugeridas: string[], ajustadas: string[], soMao: string[]) => ({ sugeridas, ajustadas, soMao });
  const PREFIXO = 'Pontos sugeridos por detecção automática (confirmar na foto)';

  it('detecção automática: diz em quantas medidas, quantas foram ajustadas à mão e quantas foram marcadas só à mão (singular e plural)', () => {
    const nota = (p: ReturnType<typeof pontos>) => descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida', pontos: p });
    expect(nota(pontos(['ombros', 'braco-d', 'quadris'], ['ombros'], ['carregamento-d', 'punho-d'])))
      .toBe(`${medidasTexto}\n${PREFIXO} em 3 medidas, 1 ajustada à mão; 2 medidas marcadas só à mão. ${REF} A foto não é armazenada.`);
    expect(nota(pontos(['ombros', 'quadris'], ['ombros', 'quadris'], ['punho-d'])))
      .toContain(`${PREFIXO} em 2 medidas, 2 ajustadas à mão; 1 medida marcada só à mão. `);
    expect(nota(pontos(['ombros'], [], [])))
      .toContain(`${PREFIXO} em 1 medida, nenhuma ajustada à mão. `);
  });

  it('sem medida marcada só à mão, a frase não fala em marcação à mão além dos ajustes (não afirma nada que não aconteceu)', () => {
    const d = descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida', pontos: pontos(['ombros', 'quadris'], [], []) });
    expect(d).toContain(`${PREFIXO} em 2 medidas, nenhuma ajustada à mão. `);
    expect(d).not.toContain('só à mão');
  });

  it('sem a contagem (a tela não sabe), não afirma nada sobre ajuste nem sobre marcação à mão', () => {
    const semLista = descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida' });
    expect(semLista).toContain(`${PREFIXO}. `);
    expect(semLista).not.toMatch(/ajustad|só à mão/);
    expect(descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida', pontos: null })).toBe(semLista);
  });

  it('nunca diz que o profissional conferiu os pontos (o app não verifica isso)', () => {
    const variantes = [
      descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida' }),
      descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida', pontos: pontos(['a'], [], []) }),
      descricaoDaNota({ medidasTexto, metodo: 'automatica_conferida', pontos: pontos(['a', 'b'], ['a'], ['c']) }),
      descricaoDaNota({ medidasTexto, metodo: 'marcacao_manual' }),
    ];
    for (const v of variantes) {
      expect(v).not.toMatch(/conferid|profissional/i);
      expect(v.endsWith('A foto não é armazenada.')).toBe(true);
    }
  });

  it('a frase do nível substitui a frase padrão; em branco volta à padrão', () => {
    const nota = 'Foto nivelada pelo sensor do celular (correção de 2,0°); os ângulos valem para acompanhar a evolução entre fotos feitas do mesmo jeito.';
    expect(descricaoDaNota({ medidasTexto, metodo: 'marcacao_manual', nivelNota: nota }))
      .toBe(`${medidasTexto}\nPontos marcados manualmente. ${nota} A foto não é armazenada.`);
    expect(descricaoDaNota({ medidasTexto, metodo: 'marcacao_manual', nivelNota: '  ' })).toContain(REF);
    expect(descricaoDaNota({ medidasTexto, metodo: 'marcacao_manual', nivelNota: null })).toContain(REF);
  });

  it('sem texto de medidas não abre com linha em branco', () => {
    expect(descricaoDaNota({ medidasTexto: '  ', metodo: 'marcacao_manual' }))
      .toBe(`Pontos marcados manualmente. ${REF} A foto não é armazenada.`);
  });
});

// ---------------------------------------------------------------------------
// agruparPorSessao, escolherAnterior, rótulos
// ---------------------------------------------------------------------------

const nota = (id: string, created_at: string, dados_extras: unknown): NotaDeAnalise => ({ id, created_at, dados_extras });
const da = (extra: Record<string, unknown>) => ({ metodo: 'automatica_conferida', nivel_graus: null, escala_cm_por_px: null, opcoes: OPCOES, ...extra });
const sessao = (ordem: number, id = ID_SESSAO, iniciadaEm = '2026-03-12T13:00:00.000Z') => ({
  id, ordem, previstas: ['frente', 'perfil_d', 'perfil_e', 'costas'], iniciadaEm,
});

// Sessão de 4 posições, de 12/03/2026 (10h no horário de Brasília), notas gravadas em ordem.
const S_FRENTE = nota('n-frente', '2026-03-12T13:02:00.000Z', da({
  esquema: 2, vista: 'frente', sessao: sessao(1),
  medidas: [m('ombros', 2, { texto: OMBROS_D('2,0') }), m('pelve', 1, { texto: PELVE_E('1,0') })],
}));
const S_PERFIL_D = nota('n-perfil-d', '2026-03-12T13:06:00.000Z', da({
  esquema: 2, vista: 'perfil', lado_perfil: 'D', sessao: sessao(2), nivel_graus: 1.8,
  medidas: [m('cva', 50), m('pelve-perfil', 4, { sentido: 'anterior' })],
}));
const S_PERFIL_E = nota('n-perfil-e', '2026-03-12T13:10:00.000Z', da({
  esquema: 2, vista: 'perfil', lado_perfil: 'E', sessao: sessao(3),
  medidas: [m('cva', 47)],
}));
const S_COSTAS = nota('n-costas', '2026-03-12T13:15:00.000Z', da({
  esquema: 2, vista: 'costas', sessao: sessao(4), pontos_ajustados: ['ombros'],
  medidas: [m('ombros', 1.5, { texto: OMBROS_E('1,5') })],
}));
// Notas do esquema 1, anteriores à sessão.
const L_FRENTE = nota('n-legada-frente', '2026-02-01T13:00:00.000Z', da({
  vista: 'frente',
  medidas: [m('ombros', 3, { texto: OMBROS_D('3,0') }), m('pelve', 1.5, { texto: PELVE_E('1,5') })],
}));
const L_PERFIL = nota('n-legada-perfil', '2026-01-15T12:00:00.000Z', da({
  vista: 'perfil', nivel_graus: 1.8, metodo: 'marcacao_manual',
  medidas: [m('cva', 48), m('pelve-perfil', 6, { sentido: 'anterior' })],
}));
// Notas que não entram: vídeo, dados vazios, sem medidas e só com medidas inválidas.
const RUIDO = [
  nota('n-video', '2026-03-20T12:00:00.000Z', { metodo: 'video_gesto', gesto: 'ombro', capturas: [] }),
  nota('n-null', '2026-03-21T12:00:00.000Z', null),
  nota('n-sem-vista', '2026-03-21T13:00:00.000Z', da({ medidas: [m('ombros', 2)] })),
  nota('n-sem-medidas', '2026-03-22T12:00:00.000Z', da({ vista: 'frente', medidas: [] })),
  nota('n-medidas-ruins', '2026-03-23T12:00:00.000Z', da({ vista: 'frente', medidas: [{ id: 'ombros' }, 'x'] })),
];

describe('agruparPorSessao', () => {
  const todas = [L_PERFIL, ...RUIDO, S_COSTAS, L_FRENTE, S_PERFIL_E, S_FRENTE, S_PERFIL_D];

  it('junta as quatro notas pelo id da sessão e põe a sessão mais recente primeiro', () => {
    const sessoes = agruparPorSessao(todas);
    expect(sessoes.map((s) => s.id)).toEqual([ID_SESSAO, 'n-legada-frente', 'n-legada-perfil']);
    const s = sessoes[0];
    expect(s.legada).toBe(false);
    expect(s.esquema).toBe(2);
    expect(s.iniciadaEm).toBe('2026-03-12T13:00:00.000Z');
    expect(s.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(posicoesDaSessao(s).map((p) => p.posicao)).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(posicoesDaSessao(s).map((p) => p.notaId)).toEqual(['n-frente', 'n-perfil-d', 'n-perfil-e', 'n-costas']);
    expect(posicoesDaSessao(s).map((p) => p.ordem)).toEqual([1, 2, 3, 4]);
  });

  it('cada posição guarda as medidas, o nível, o método e os pontos ajustados da sua nota', () => {
    const [s] = agruparPorSessao(todas);
    expect(s.posicoes.perfil_d).toStrictEqual({
      posicao: 'perfil_d', notaId: 'n-perfil-d', criadaEm: '2026-03-12T13:06:00.000Z', medidas: [m('cva', 50), m('pelve-perfil', 4, { sentido: 'anterior' })],
      nivelGraus: 1.8, metodo: 'automatica_conferida', pontosAjustados: null, ordem: 2,
    });
    expect(s.posicoes.costas?.pontosAjustados).toEqual(['ombros']);
    expect(s.posicoes.frente?.nivelGraus).toBeNull();
  });

  it('nota sem sessão é uma sessão de uma posição, com o id da própria nota; perfil antigo fica sem lado', () => {
    const sessoes = agruparPorSessao(todas);
    const frente = sessoes[1], perfil = sessoes[2];
    expect(frente.legada).toBe(true);
    expect(frente.esquema).toBe(1);
    expect(frente.iniciadaEm).toBe('2026-02-01T13:00:00.000Z');
    expect(frente.previstas).toEqual([]);
    expect(posicoesDaSessao(frente).map((p) => p.posicao)).toEqual(['frente']);
    expect(posicoesDaSessao(frente)[0].ordem).toBeNull();
    expect(posicoesDaSessao(perfil).map((p) => p.posicao)).toEqual(['perfil_sem_lado']);
    expect(perfil.posicoes.perfil_d).toBeUndefined();
    expect(perfil.posicoes.perfil_e).toBeUndefined();
  });

  it('duas notas antigas do mesmo dia continuam sendo duas sessões', () => {
    const outra = nota('n-legada-costas', '2026-02-01T13:20:00.000Z', da({ vista: 'costas', medidas: [m('ombros', 1)] }));
    const sessoes = agruparPorSessao([L_FRENTE, outra]);
    expect(sessoes.map((s) => s.id)).toEqual(['n-legada-costas', 'n-legada-frente']);
  });

  it('ignora vídeo, dados vazios, nota sem medida e nota só com medidas inválidas', () => {
    expect(agruparPorSessao(RUIDO)).toEqual([]);
    expect(agruparPorSessao([])).toEqual([]);
    const ids = agruparPorSessao(todas).flatMap((s) => posicoesDaSessao(s).map((p) => p.notaId));
    expect(ids).not.toContain('n-video');
    expect(ids).not.toContain('n-sem-vista');
    expect(ids).not.toContain('n-sem-medidas');
    expect(ids).not.toContain('n-medidas-ruins');
  });

  it('se a mesma posição aparece duas vezes na sessão, vale a nota mais recente (não duplica)', () => {
    const refeita = nota('n-frente-2', '2026-03-12T14:00:00.000Z', da({
      esquema: 2, vista: 'frente', sessao: sessao(1), medidas: [m('ombros', 0.5)],
    }));
    const [s] = agruparPorSessao([refeita, S_FRENTE]);
    expect(posicoesDaSessao(s)).toHaveLength(1);
    expect(s.posicoes.frente?.notaId).toBe('n-frente-2');
    expect(s.posicoes.frente?.medidas).toEqual([m('ombros', 0.5)]);
  });

  it('as posições saem na ordem frente, perfil D, perfil E, costas mesmo se foram feitas fora dessa ordem', () => {
    const costasPrimeiro = nota('n-c', '2026-03-12T13:02:00.000Z', da({ esquema: 2, vista: 'costas', sessao: sessao(4), medidas: [m('ombros', 1)] }));
    const perfilEDepois = nota('n-pe', '2026-03-12T13:05:00.000Z', da({ esquema: 2, vista: 'perfil', lado_perfil: 'E', sessao: sessao(3), medidas: [m('cva', 47)] }));
    const frentePorUltimo = nota('n-f', '2026-03-12T13:09:00.000Z', da({ esquema: 2, vista: 'frente', sessao: sessao(1), medidas: [m('ombros', 2)] }));
    const [s] = agruparPorSessao([costasPrimeiro, perfilEDepois, frentePorUltimo]);
    expect(posicoesDaSessao(s).map((p) => p.posicao)).toEqual(['frente', 'perfil_e', 'costas']);
  });

  it('o resultado não depende da ordem em que as notas chegam', () => {
    const a = agruparPorSessao(todas);
    const b = agruparPorSessao([...todas].reverse());
    expect(b).toEqual(a);
  });

  it('sessões diferentes não se misturam, mesmo com a mesma posição', () => {
    const outraSessao = nota('n-frente-b', '2026-04-02T13:00:00.000Z', da({
      esquema: 2, vista: 'frente', sessao: sessao(1, 'aaaaaaaa-0000-4000-8000-000000000001', '2026-04-02T12:55:00.000Z'), medidas: [m('ombros', 1)],
    }));
    const sessoes = agruparPorSessao([S_FRENTE, S_COSTAS, outraSessao]);
    expect(sessoes.map((s) => s.id)).toEqual(['aaaaaaaa-0000-4000-8000-000000000001', ID_SESSAO]);
    expect(posicoesDaSessao(sessoes[0])).toHaveLength(1);
    expect(posicoesDaSessao(sessoes[1])).toHaveLength(2);
  });

  it('data inválida não quebra: a sessão fica sem data e por último', () => {
    const semData = nota('n-sem-data', 'não é data', da({ vista: 'frente', medidas: [m('ombros', 1)] }));
    const sessoes = agruparPorSessao([semData, L_PERFIL]);
    expect(sessoes.map((s) => s.id)).toEqual(['n-legada-perfil', 'n-sem-data']);
    expect(sessoes[1].iniciadaEm).toBe('');
    expect(rotuloDaSessao(sessoes[1])).toBe('Data não informada · 1 posição');
  });

  it('o início da sessão vem do bloco da sessão, não do momento em que a nota foi gravada', () => {
    const tarde = nota('n-t', '2026-03-12T18:00:00.000Z', da({ esquema: 2, vista: 'frente', sessao: sessao(1), medidas: [m('ombros', 1)] }));
    expect(agruparPorSessao([tarde])[0].iniciadaEm).toBe('2026-03-12T13:00:00.000Z');
  });
});

describe('rótulos da sessão', () => {
  it('"12/03/2026 · 4 posições" e "01/02/2026 · 1 posição"', () => {
    const [nova, antiga] = agruparPorSessao([S_FRENTE, S_PERFIL_D, S_PERFIL_E, S_COSTAS, L_FRENTE]);
    expect(rotuloDaSessao(nova)).toBe('12/03/2026 · 4 posições');
    expect(rotuloDaSessao(antiga)).toBe('01/02/2026 · 1 posição');
  });

  it('conta só as posições feitas (3 de 4 previstas)', () => {
    const [s] = agruparPorSessao([S_FRENTE, S_PERFIL_D, S_COSTAS]);
    expect(rotuloDaSessao(s)).toBe('12/03/2026 · 3 posições');
  });

  it('a data é a do horário de Brasília, não a do UTC', () => {
    expect(dataDaSessao('2026-03-12T02:30:00.000Z')).toBe('11/03/2026');
    expect(dataDaSessao('2026-03-12T03:00:00.000Z')).toBe('12/03/2026');
    expect(dataDaSessao('2026-12-31T23:30:00.000Z')).toBe('31/12/2026');
    expect(dataDaSessao('')).toBe('');
    expect(dataDaSessao('ontem')).toBe('');
  });
});

describe('escolherAnterior', () => {
  const sessoes = agruparPorSessao([S_FRENTE, S_PERFIL_D, S_PERFIL_E, S_COSTAS, L_FRENTE, L_PERFIL]);

  it('é a sessão mais recente que tenha a posição, não só a mais recente de todas', () => {
    expect(escolherAnterior(sessoes, 'frente')?.id).toBe(ID_SESSAO);
    expect(escolherAnterior(sessoes, 'perfil_d')?.id).toBe(ID_SESSAO);
    const soAntigas = agruparPorSessao([L_FRENTE, nota('n-nova-costas', '2026-05-01T12:00:00.000Z', da({ vista: 'costas', medidas: [m('ombros', 1)] }))]);
    expect(escolherAnterior(soAntigas, 'frente')?.id).toBe('n-legada-frente');
  });

  it('exclui a sessão em andamento e cai na anterior', () => {
    expect(escolherAnterior(sessoes, 'frente', ID_SESSAO)?.id).toBe('n-legada-frente');
    expect(escolherAnterior(sessoes, 'costas', ID_SESSAO)).toBeNull();
  });

  it('perfil sem lado (nota antiga) nunca serve de anterior para perfil direito ou esquerdo, e vice-versa', () => {
    expect(escolherAnterior(sessoes, 'perfil_d', ID_SESSAO)).toBeNull();
    expect(escolherAnterior(sessoes, 'perfil_e', ID_SESSAO)).toBeNull();
    expect(escolherAnterior(sessoes, 'perfil_sem_lado')?.id).toBe('n-legada-perfil');
    expect(escolherAnterior(agruparPorSessao([L_PERFIL]), 'perfil_d')).toBeNull();
  });

  it('devolve null sem sessões ou sem a posição', () => {
    expect(escolherAnterior([], 'frente')).toBeNull();
    expect(escolherAnterior(agruparPorSessao([S_COSTAS]), 'frente')).toBeNull();
  });

  it('não depende da ordem da lista recebida', () => {
    const embaralhada = [...sessoes].reverse();
    expect(escolherAnterior(embaralhada, 'frente')?.id).toBe(ID_SESSAO);
    expect(sessoesComPosicao(embaralhada, 'frente').map((s) => s.id)).toEqual([ID_SESSAO, 'n-legada-frente']);
  });

  it('com duas sessões no mesmo dia, a que começou mais tarde vem primeiro', () => {
    const manha = nota('n-manha', '2026-04-10T12:00:00.000Z', da({ vista: 'frente', medidas: [m('ombros', 1)] }));
    const tarde = nota('n-tarde', '2026-04-10T19:00:00.000Z', da({ vista: 'frente', medidas: [m('ombros', 2)] }));
    const ss = agruparPorSessao([manha, tarde]);
    expect(escolherAnterior(ss, 'frente')?.id).toBe('n-tarde');
    expect(ss.map(rotuloDaSessao)).toEqual(['10/04/2026 · 1 posição', '10/04/2026 · 1 posição']);
  });
});

// ---------------------------------------------------------------------------
// compararSessoes
// ---------------------------------------------------------------------------

const sess = (posicoes: SessaoParaComparar['posicoes'], esquema?: number): SessaoParaComparar => ({ esquema, posicoes });
const achar = <T extends { id: string }>(linhas: T[], id: string): T => {
  const l = linhas.find((x) => x.id === id);
  if (!l) throw new Error(`linha ${id} não encontrada`);
  return l;
};

describe('compararSessoes', () => {
  it('posição presente nas duas: variação atual − anterior, lado trocado, medida nova e medida que falta agora', () => {
    const anterior = sess({
      frente: {
        medidas: [
          m('ombros', 3, { texto: OMBROS_D('3,0') }),
          m('pelve', 2, { texto: PELVE_E('2,0') }),
          m('regua', 20, { unidade: 'cm' }),
          m('xtest-d', 50),
          m('xtest-e', 60),
        ],
      },
    });
    const atual = sess({
      frente: {
        medidas: [
          m('ombros', 1.2, { texto: OMBROS_D('1,2') }),
          m('pelve', 1, { texto: PELVE_D('1,0') }),
          m('regua', 18.5, { unidade: 'cm' }),
          m('xtest-d', 55.5),
          m('cabeca', 2),
        ],
      },
    });
    const r = compararSessoes(atual, anterior);
    expect(r.posicoes).toHaveLength(1);
    const frente = r.posicoes[0];
    expect(frente.posicao).toBe('frente');
    expect(frente.rotulo).toBe('Frente');
    expect(frente.situacao).toBe('ambas');
    expect(frente.linhas.map((l) => l.id).sort()).toEqual(['cabeca', 'ombros', 'pelve', 'regua', 'xtest-d', 'xtest-e']);

    const ombros = achar(frente.linhas, 'ombros');
    expect(ombros.diferenca).toBe(-1.8);
    expect(ombros.motivo).toBeUndefined();
    expect(ombros.explicacao).toBeNull();
    expect(ombros.antes?.graus).toBe(3);
    expect(ombros.depois?.graus).toBe(1.2);

    const pelve = achar(frente.linhas, 'pelve');
    expect(pelve.diferenca).toBeNull();
    expect(pelve.motivo).toBe('lado-trocado');
    expect(pelve.explicacao).toBe('O lado mudou (esquerdo mais alto para direito mais alto): subtrair os números seria enganoso.');

    const regua = achar(frente.linhas, 'regua');
    expect(regua.diferenca).toBe(-1.5);
    expect(regua.unidade).toBe('cm');

    expect(achar(frente.linhas, 'xtest-d').diferenca).toBe(5.5);

    const falta = achar(frente.linhas, 'xtest-e');
    expect(falta.diferenca).toBeNull();
    expect(falta.motivo).toBe('falta-depois');
    expect(falta.depois).toBeNull();
    expect(falta.explicacao).toBe('Estava marcada na avaliação anterior; falta marcar agora.');

    const nova = achar(frente.linhas, 'cabeca');
    expect(nova.diferenca).toBeNull();
    expect(nova.motivo).toBe('falta-antes');
    expect(nova.explicacao).toBe('Não estava marcada na avaliação anterior.');
  });

  it('o que existia só antes aparece (a tela antiga escondia) e unidades diferentes não se subtraem', () => {
    const r = compararSessoes(
      sess({ frente: { medidas: [m('ombros', 1)] } }),
      sess({ frente: { medidas: [m('ombros', 2), m('pelve', 3), m('regua', 20, { unidade: 'cm' })] } }),
    );
    const linhas = r.posicoes[0].linhas;
    expect(linhas.map((l) => l.id).sort()).toEqual(['ombros', 'pelve', 'regua']);
    expect(achar(linhas, 'pelve').explicacao).toContain('falta marcar agora');
    const r2 = compararSessoes(
      sess({ frente: { medidas: [m('regua', 12)] } }),
      sess({ frente: { medidas: [m('regua', 20, { unidade: 'cm' })] } }),
    );
    const regua = r2.posicoes[0].linhas[0];
    expect(regua.diferenca).toBeNull();
    expect(regua.motivo).toBe('unidades-diferentes');
    expect(regua.explicacao).toBe('As duas avaliações têm unidades diferentes (° e cm): não dá para subtrair.');
  });

  it('as quatro posições, com perfil esquerdo só na avaliação atual', () => {
    const atual = sess({
      frente: { medidas: [m('ombros', 1)] },
      perfil_d: { medidas: [m('cva', 50)] },
      perfil_e: { medidas: [m('cva', 47)] },
      costas: { medidas: [m('ombros', 2)] },
    }, 2);
    const anterior = sess({
      frente: { medidas: [m('ombros', 3)] },
      perfil_d: { medidas: [m('cva', 52)] },
      costas: { medidas: [m('ombros', 2.5)] },
    }, 2);
    const r = compararSessoes(atual, anterior);
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([
      ['frente', 'ambas'], ['perfil_d', 'ambas'], ['perfil_e', 'so_atual'], ['costas', 'ambas'],
    ]);
    expect(r.posicoes[1].linhas[0].diferenca).toBe(-2);
    expect(r.posicoes[3].linhas[0].diferenca).toBe(-0.5);
    const esq = r.posicoes[2];
    expect(esq.linhas).toEqual([]);
    expect(esq.avisos).toEqual([{ tipo: 'posicao_ausente', posicao: 'perfil_e', texto: 'Perfil esquerdo: só nesta avaliação; a anterior não tem essa posição.' }]);
    expect(r.avisos).toEqual([]);
  });

  it('posição que só existia na avaliação anterior (ainda não feita agora)', () => {
    const r = compararSessoes(
      sess({ frente: { medidas: [m('ombros', 1)] } }),
      sess({ frente: { medidas: [m('ombros', 2)] }, costas: { medidas: [m('ombros', 2)] } }),
    );
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([['frente', 'ambas'], ['costas', 'so_anterior']]);
    expect(r.posicoes[1].linhas).toEqual([]);
    expect(r.posicoes[1].avisos[0]).toEqual({ tipo: 'posicao_ausente', posicao: 'costas', texto: 'Costas: estava na avaliação anterior e ainda não foi feita nesta.' });
  });

  it('perfil direito de um lado e perfil esquerdo do outro nunca se comparam entre si', () => {
    const r = compararSessoes(
      sess({ perfil_d: { medidas: [m('cva', 50)] } }),
      sess({ perfil_e: { medidas: [m('cva', 47)] } }),
    );
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([['perfil_d', 'so_atual'], ['perfil_e', 'so_anterior']]);
    expect(r.posicoes.every((p) => p.linhas.length === 0)).toBe(true);
  });

  it('perfil de nota antiga (sem lado) não pareia com perfil direito ou esquerdo e vira posição à parte', () => {
    const r = compararSessoes(
      sess({ perfil_d: { medidas: [m('cva', 50)] }, perfil_e: { medidas: [m('cva', 47)] } }, 2),
      sess({ perfil_sem_lado: { medidas: [m('cva', 48)] } }, 1),
    );
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([
      ['perfil_d', 'so_atual'], ['perfil_e', 'so_atual'], ['perfil_sem_lado', 'so_anterior'],
    ]);
    expect(r.posicoes[2].rotulo).toBe('Perfil (lado não informado)');
    expect(r.posicoes.flatMap((p) => p.linhas)).toEqual([]);
    expect(r.avisos.map((a) => a.tipo)).toEqual(['esquemas_diferentes', 'perfil_sem_lado']);
    expect(r.avisos[1].texto).toBe('Perfil sem lado informado (avaliação antiga) não é comparado com perfil direito ou esquerdo: não dá para saber de que lado foi a foto.');
  });

  it('o mesmo vale quando o perfil sem lado é o da avaliação atual', () => {
    const r = compararSessoes(
      sess({ perfil_sem_lado: { medidas: [m('cva', 48)] } }),
      sess({ perfil_d: { medidas: [m('cva', 50)] } }),
    );
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([['perfil_d', 'so_anterior'], ['perfil_sem_lado', 'so_atual']]);
    expect(r.avisos.map((a) => a.tipo)).toEqual(['perfil_sem_lado']);
  });

  it('dois perfis sem lado se comparam, com o aviso de confirmar o lado', () => {
    const r = compararSessoes(
      sess({ perfil_sem_lado: { medidas: [m('cva', 48)] } }, 1),
      sess({ perfil_sem_lado: { medidas: [m('cva', 50)] } }, 1),
    );
    const p = r.posicoes[0];
    expect(p.situacao).toBe('ambas');
    expect(p.linhas[0].diferenca).toBe(-2);
    expect(p.avisos).toEqual([{ tipo: 'perfil_sem_lado', posicao: 'perfil_sem_lado', texto: 'Perfil sem lado informado nas duas avaliações: confirme que é o mesmo lado antes de comparar.' }]);
    expect(r.avisos).toEqual([]);
  });

  it('avisa quando o nível foi corrigido em uma avaliação e não na outra (qualquer lado, sinal ignorado)', () => {
    const med = [m('ombros', 1)];
    const so = (atual: number | null | undefined, anterior: number | null | undefined) =>
      compararSessoes(sess({ frente: { medidas: med, nivelGraus: atual } }), sess({ frente: { medidas: med, nivelGraus: anterior } })).posicoes[0].avisos;
    expect(so(-2.34, null)).toEqual([{
      tipo: 'nivel_diferente', posicao: 'frente',
      texto: 'Frente: nesta avaliação a foto foi nivelada (correção de 2,3°); na anterior não consta correção de nível. Os ângulos podem não ser comparáveis.',
    }]);
    expect(so(null, 4)).toEqual([{
      tipo: 'nivel_diferente', posicao: 'frente',
      texto: 'Frente: na avaliação anterior a foto foi nivelada (correção de 4,0°); nesta não consta correção de nível. Os ângulos podem não ser comparáveis.',
    }]);
    expect(so(1, undefined)).toHaveLength(1);
  });

  it('não avisa de nível quando as duas foram corrigidas, nenhuma foi, ou uma tem zero (sem correção)', () => {
    const med = [m('ombros', 1)];
    const so = (atual: number | null | undefined, anterior: number | null | undefined) =>
      compararSessoes(sess({ frente: { medidas: med, nivelGraus: atual } }), sess({ frente: { medidas: med, nivelGraus: anterior } })).posicoes[0].avisos;
    expect(so(2, 3)).toEqual([]);
    expect(so(null, null)).toEqual([]);
    expect(so(undefined, null)).toEqual([]);
    expect(so(0, null)).toEqual([]);
    expect(so(null, 0)).toEqual([]);
  });

  it('esquemas diferentes geram um aviso neutro; iguais ou desconhecidos não', () => {
    const p = { frente: { medidas: [m('ombros', 1)] } };
    expect(compararSessoes(sess(p, 2), sess(p, 1)).avisos).toEqual([{
      tipo: 'esquemas_diferentes',
      texto: 'As avaliações foram salvas em versões diferentes do aplicativo (formato 2 e formato 1): algumas medidas podem existir só em uma delas.',
    }]);
    expect(compararSessoes(sess(p, 2), sess(p, 2)).avisos).toEqual([]);
    expect(compararSessoes(sess(p, 2), sess(p)).avisos).toEqual([]);
  });

  it('posição sem medidas conta como não feita; sem nada dos dois lados não há posições', () => {
    const r = compararSessoes(sess({ frente: { medidas: [] }, costas: { medidas: [m('ombros', 1)] } }), sess({ frente: { medidas: [m('ombros', 1)] } }));
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([['frente', 'so_anterior'], ['costas', 'so_atual']]);
    expect(compararSessoes(sess({}), sess({})).posicoes).toEqual([]);
    expect(compararSessoes(sess({ frente: { medidas: [] } }), sess({ frente: { medidas: [] } })).posicoes).toEqual([]);
  });

  it('as posições saem na ordem de POSICOES_DA_NOTA, qualquer que seja a ordem em que foram gravadas', () => {
    const med = [m('ombros', 1)];
    const r = compararSessoes(
      sess({ costas: { medidas: med }, perfil_sem_lado: { medidas: med }, perfil_e: { medidas: med }, frente: { medidas: med }, perfil_d: { medidas: med } }),
      sess({}),
    );
    expect(r.posicoes.map((p) => p.posicao)).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas', 'perfil_sem_lado']);
    expect(POSICOES_DA_NOTA).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas', 'perfil_sem_lado']);
    expect(ROTULO_POSICAO_DA_NOTA.perfil_d).toBe('Perfil direito');
  });

  it('não classifica: só números e a frase de que a diferença não indica melhora ou piora', () => {
    const r = compararSessoes(
      sess({ frente: { medidas: [m('ombros', 1, { texto: OMBROS_D('1,0') }), m('pelve', 4), m('xtest-d', 1)], nivelGraus: 3 }, costas: { medidas: [m('ombros', 1)] } }, 2),
      sess({ frente: { medidas: [m('ombros', 3, { texto: OMBROS_E('3,0') }), m('pelve', 1), m('xtest-e', 1)] }, perfil_sem_lado: { medidas: [m('cva', 1)] } }, 1),
    );
    expect(r.textoNaoClassifica).toBe(TEXTO_NAO_CLASSIFICA);
    expect(r.textoNaoClassifica).toContain('não indica melhora ou piora');
    const textos = [
      ...r.avisos.map((a) => a.texto),
      ...r.posicoes.flatMap((p) => [...p.avisos.map((a) => a.texto), ...p.linhas.map((l) => l.explicacao ?? '')]),
    ];
    expect(textos.length).toBeGreaterThan(5);
    for (const t of textos) expect(t).not.toMatch(/melhor|pior|normal|alterad|ideal|ruim|bom\b|boa\b|mais alto que o esperado/i);
    for (const l of r.posicoes.flatMap((p) => p.linhas)) {
      expect(Object.keys(l)).not.toContain('classificacao');
      expect(Object.keys(l)).not.toContain('nota');
    }
  });

  it('explicacaoDaLinhaSessao: sem motivo não há explicação', () => {
    expect(explicacaoDaLinhaSessao({ sentidoAntes: null, sentidoDepois: null })).toBeNull();
  });
});

describe('agruparPorSessao + compararSessoes (da nota do banco até a comparação)', () => {
  const sessoes = agruparPorSessao([S_FRENTE, S_PERFIL_D, S_PERFIL_E, S_COSTAS, L_FRENTE, L_PERFIL]);
  const [nova, antigaFrente, antigaPerfil] = sessoes;

  it('sessão de 4 posições contra nota antiga só de frente: compara a frente e deixa o resto como só na atual', () => {
    const r = compararSessoes(nova, antigaFrente);
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([
      ['frente', 'ambas'], ['perfil_d', 'so_atual'], ['perfil_e', 'so_atual'], ['costas', 'so_atual'],
    ]);
    const frente = r.posicoes[0];
    // ombros: 2,0 (direito mais alto) contra 3,0 (direito mais alto); pelve: 1,0 contra 1,5, os dois com esquerdo mais alto
    expect(achar(frente.linhas, 'ombros').diferenca).toBe(-1);
    expect(achar(frente.linhas, 'pelve').diferenca).toBe(-0.5);
    expect(r.avisos.map((a) => a.tipo)).toEqual(['esquemas_diferentes']);
  });

  it('sessão nova contra a nota antiga de perfil sem lado: perfil D e E ficam sem par e o aviso aparece', () => {
    const r = compararSessoes(nova, antigaPerfil);
    expect(r.posicoes.map((p) => [p.posicao, p.situacao])).toEqual([
      ['frente', 'so_atual'], ['perfil_d', 'so_atual'], ['perfil_e', 'so_atual'], ['costas', 'so_atual'], ['perfil_sem_lado', 'so_anterior'],
    ]);
    expect(r.avisos.map((a) => a.tipo)).toEqual(['esquemas_diferentes', 'perfil_sem_lado']);
  });

  it('o nível gravado na nota chega ao aviso: perfil direito nivelado (1,8°) contra o antigo sem correção', () => {
    const antigoComPerfilD = agruparPorSessao([nota('n-ant', '2026-02-10T12:00:00.000Z', da({
      esquema: 2, vista: 'perfil', lado_perfil: 'D', sessao: sessao(1, 'bbbbbbbb-0000-4000-8000-000000000002', '2026-02-10T12:00:00.000Z'),
      medidas: [m('cva', 52)],
    }))])[0];
    const r = compararSessoes(nova, antigoComPerfilD);
    const perfilD = r.posicoes.find((p) => p.posicao === 'perfil_d');
    expect(perfilD?.situacao).toBe('ambas');
    expect(achar(perfilD?.linhas ?? [], 'cva').diferenca).toBe(-2);
    expect(perfilD?.avisos.map((a) => a.tipo)).toEqual(['nivel_diferente']);
    expect(perfilD?.avisos[0].texto).toContain('correção de 1,8°');
  });
});
