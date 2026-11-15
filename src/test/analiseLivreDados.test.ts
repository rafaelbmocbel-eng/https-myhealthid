import { describe, expect, it } from 'vitest';
import { compararSessoes, POSICOES_DA_NOTA, type MedidaSalva } from '@/lib/angular/comparar';
import {
  agruparPorSessao, escolherAnterior, lerDadosExtras, limparNomeLivre, montarDadosExtras, NOME_LIVRE_MAX, previstasPadrao, sessoesComPosicao,
  tituloDaAnaliseLivre, tituloDaNota, type NotaDeAnalise,
} from '@/lib/angular/sessao';
import { ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, vistaBaseDaSessao, vistaDaSessao } from '@/lib/angular/tiposSessao';
import { MEDIDAS, medidasDaVista } from '@/lib/angular/medidas';
import { analiseDeJson, calcularResultados, nomeArquivoImagem, OPCOES_ANALISE_PADRAO } from '@/lib/angular/analise';

const m = (id: string, graus: number, extra: Partial<MedidaSalva> = {}): MedidaSalva => ({ id, graus, ...extra });
const OPCOES = { compassoRef: 'baixo', unidadePrumo: 'graus', olhaPara: 'direita' } as const;
const ID_LIVRE = '7a1c2e90-3b4d-4e5f-8a6b-1c2d3e4f5a6b';
const ID_POSTURA = '3f2b8c1e-5d4a-4b7e-9a10-6c2d8e4f1a77';
const INICIO = '2026-03-12T13:00:00.000Z';

const dadosLivre = (extra: Record<string, unknown> = {}) => montarDadosExtras({
  vista: 'livre', medidas: [m('cobb', 21.4, { texto: 'Ângulo entre as duas retas (tipo Cobb): 21,4°.' })], metodo: 'marcacao_manual', nivelGraus: null,
  escalaCmPorPx: null, opcoes: OPCOES, sessao: { id: ID_LIVRE, ordem: 1, previstas: ['livre'], iniciadaEm: INICIO }, nomeLivre: 'elevação do braço direito', ...extra,
});
const dadosFrente = () => montarDadosExtras({
  vista: 'frente', medidas: [m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' })], metodo: 'marcacao_manual', nivelGraus: null,
  escalaCmPorPx: null, opcoes: OPCOES, sessao: { id: ID_POSTURA, ordem: 1, previstas: previstasPadrao(), iniciadaEm: '2026-03-10T13:00:00.000Z' },
});
const nota = (id: string, created_at: string, dados_extras: unknown): NotaDeAnalise => ({ id, created_at, dados_extras });

describe('a vista "livre" nos tipos: existe, mas não é posição da postura', () => {
  it('tem rótulo próprio e fica fora das quatro posições da sessão postural', () => {
    expect(ROTULO_VISTA_SESSAO.livre).toBe('Análise livre');
    expect([...VISTAS_DA_SESSAO]).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(previstasPadrao()).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect([...POSICOES_DA_NOTA]).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas', 'perfil_sem_lado']);
  });

  it('vistaBaseDaSessao e vistaDaSessao são inversas também para a livre, e a livre nunca vira perfil por causa de um lado', () => {
    expect(vistaBaseDaSessao('livre')).toEqual({ vista: 'livre' });
    expect(vistaDaSessao('livre')).toBe('livre');
    expect(vistaDaSessao('livre', 'D')).toBe('livre');
    expect(vistaDaSessao('livre', 'E')).toBe('livre');
    expect(vistaDaSessao('perfil', 'D')).toBe('perfil_d');
    expect(vistaDaSessao('perfil')).toBeNull();
  });
});

describe('catálogo de medidas na vista livre', () => {
  it('só as seis ferramentas livres e as duas referências que servem a elas (nível e escala), nessa ordem', () => {
    expect(medidasDaVista('livre').map((x) => x.id)).toEqual(['livre', 'compasso', 'compasso-ref', 'reta', 'cobb', 'regua', 'nivel', 'escala']);
    expect(medidasDaVista('livre').filter((x) => x.grupo === 'ferramenta')).toHaveLength(6);
    expect(medidasDaVista('livre').filter((x) => x.grupo === 'referencia').map((x) => x.id)).toEqual(['nivel', 'escala']);
  });

  it('a referência de altura não vale na livre (só serve ao fio de prumo, que a livre não tem) e continua nas três vistas da postura', () => {
    expect(medidasDaVista('livre').some((x) => x.id === 'altura')).toBe(false);
    for (const v of ['frente', 'costas', 'perfil'] as const) expect(medidasDaVista(v).some((x) => x.id === 'altura')).toBe(true);
  });

  it('nenhuma medida de postura vale na livre, e as ferramentas continuam valendo nas três vistas da postura', () => {
    for (const x of MEDIDAS.filter((y) => y.grupo === 'postura')) expect(x.vistas, x.id).not.toContain('livre');
    for (const x of MEDIDAS.filter((y) => y.grupo !== 'postura' && y.id !== 'altura')) expect(x.vistas, x.id).toEqual(['frente', 'costas', 'perfil', 'livre']);
    expect(MEDIDAS.find((y) => y.id === 'altura')?.vistas).toEqual(['frente', 'costas', 'perfil']);
    for (const v of ['frente', 'costas', 'perfil'] as const) {
      expect(medidasDaVista(v).filter((x) => x.grupo !== 'postura')).toHaveLength(9);
    }
  });

  it('calcula as ferramentas livres como nas outras vistas: tipo Cobb, régua em cm e nível corrigindo a foto', () => {
    const base = { vista: 'livre' as const, largura: 1000, altura: 1500, giro: null, cmPorPx: null, opcoes: OPCOES_ANALISE_PADRAO };
    const cobb = calcularResultados({ ...base, pontos: { cobb: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 100 }] } });
    expect(cobb.map((r) => r.id)).toEqual(['cobb']);
    expect(cobb[0].valor).toBeCloseTo(45, 5);
    const regua = calcularResultados({ ...base, cmPorPx: 0.1, pontos: { regua: [{ x: 0, y: 0 }, { x: 300, y: 400 }] } });
    expect(regua[0].valor).toBeCloseTo(50, 5);
    expect(regua[0].unidade).toBe('cm');
    const sem = calcularResultados({ ...base, pontos: { ombros: [{ x: 400, y: 450 }, { x: 600, y: 480 }] } });
    expect(sem).toEqual([]);
  });

  it('o arquivo da imagem baixada se chama analise-angular-livre-<data>.png e a análise lida de JSON aceita a vista livre', () => {
    expect(nomeArquivoImagem('livre', new Date('2026-03-12T15:00:00Z'))).toBe('analise-angular-livre-2026-03-12.png');
    const lida = analiseDeJson({ vista: 'livre', lado: 'D', largura: 100, altura: 200, pontos: {}, giro: null, cmPorPx: null, opcoes: {} });
    expect(lida?.vista).toBe('livre');
    expect(lida).not.toHaveProperty('lado');
  });
});

describe('nome da análise livre', () => {
  it('o limite é de 80 caracteres', () => {
    expect(NOME_LIVRE_MAX).toBe(80);
  });

  it('limparNomeLivre tira as pontas, junta espaços repetidos, tira controles e corta em 80', () => {
    expect(limparNomeLivre('  elevação   do\tbraço\n direito ')).toBe('elevação do braço direito');
    expect(limparNomeLivre('a\u0000b\u0007c')).toBe('abc');
    expect(limparNomeLivre('x'.repeat(100))).toBe('x'.repeat(80));
    expect(limparNomeLivre(`${'y'.repeat(79)} zzz`)).toBe(`${'y'.repeat(79)}`);
    expect(limparNomeLivre('   ')).toBe('');
    expect(limparNomeLivre(null)).toBe('');
    expect(limparNomeLivre(undefined)).toBe('');
  });

  it('caracteres invisíveis (largura zero, direção do texto, hífen condicional, BOM) saem; nome só com eles vira vazio', () => {
    expect(limparNomeLivre('\u200b')).toBe('');
    expect(limparNomeLivre('\u200b \u200d\u2060\ufeff\u00ad')).toBe('');
    expect(limparNomeLivre('\u202eflexão\u200b do\u200f joelho\u2066')).toBe('flexão do joelho');
    expect(limparNomeLivre('flexão \u200b do joelho')).toBe('flexão do joelho');
  });

  it('o corte em 80 conta caracteres inteiros e nunca parte um emoji ao meio', () => {
    const cortado = limparNomeLivre(`${'a'.repeat(79)}😀😀😀`);
    expect(Array.from(cortado)).toHaveLength(80);
    expect(cortado.endsWith('😀')).toBe(true);
    expect(cortado).not.toMatch(/[\ud800-\udbff]$/);
    expect(limparNomeLivre(`${'a'.repeat(79)}\u{1F3CB}\ufe0f\u200d`)).not.toMatch(/\u200d$/);
  });
});

describe('dados_extras da nota livre', () => {
  it('traz vista "livre", o nome limpo, esquema 2 e a sessão de uma posição só, sem lado do perfil nem pontos ajustados', () => {
    const d = dadosLivre({ nomeLivre: '  elevação  do braço direito ' });
    expect(d).toMatchObject({
      vista: 'livre', nome_livre: 'elevação do braço direito', esquema: 2, metodo: 'marcacao_manual',
      sessao: { id: ID_LIVRE, ordem: 1, previstas: ['livre'], iniciadaEm: INICIO },
    });
    expect(d).not.toHaveProperty('lado_perfil');
    expect(d).not.toHaveProperty('pontos_ajustados');
  });

  it('sem nome (ou só espaços) o campo nome_livre nem existe; com nome grande, grava só 80 caracteres', () => {
    expect(dadosLivre({ nomeLivre: '' })).not.toHaveProperty('nome_livre');
    expect(dadosLivre({ nomeLivre: '   ' })).not.toHaveProperty('nome_livre');
    expect(dadosLivre({ nomeLivre: undefined })).not.toHaveProperty('nome_livre');
    expect(dadosLivre({ nomeLivre: 'n'.repeat(120) }).nome_livre).toBe('n'.repeat(80));
  });

  it('um lado informado por engano não vira lado_perfil, e o nome nunca entra em nota de postura', () => {
    expect(dadosLivre({ lado: 'D' })).not.toHaveProperty('lado_perfil');
    const frente = montarDadosExtras({
      vista: 'frente', medidas: [m('ombros', 2)], metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES, nomeLivre: 'não deveria entrar',
    });
    expect(frente).not.toHaveProperty('nome_livre');
    const perfil = montarDadosExtras({
      vista: 'perfil', lado: 'D', medidas: [m('cva', 50)], metodo: 'marcacao_manual', nivelGraus: null, escalaCmPorPx: null, opcoes: OPCOES,
    });
    expect(perfil.lado_perfil).toBe('D');
  });
});

describe('título da nota', () => {
  it('"Análise angular — análise livre: <nome>" com nome e "Análise angular — análise livre" sem nome', () => {
    expect(tituloDaAnaliseLivre('elevação do braço direito')).toBe('Análise angular — análise livre: elevação do braço direito');
    expect(tituloDaAnaliseLivre()).toBe('Análise angular — análise livre');
    expect(tituloDaAnaliseLivre('')).toBe('Análise angular — análise livre');
    expect(tituloDaAnaliseLivre('   ')).toBe('Análise angular — análise livre');
    expect(tituloDaAnaliseLivre('  um   nome  ')).toBe('Análise angular — análise livre: um nome');
    expect(tituloDaAnaliseLivre('z'.repeat(200))).toBe(`Análise angular — análise livre: ${'z'.repeat(80)}`);
  });

  it('pedir o título da posição "livre" não inventa uma vista: dá o título sem nome', () => {
    expect(tituloDaNota('livre')).toBe('Análise angular — análise livre');
  });

  it('o título das quatro posições da postura continua o mesmo', () => {
    expect(tituloDaNota('frente')).toBe('Análise angular — vista frente');
    expect(tituloDaNota('perfil_d')).toBe('Análise angular — vista perfil direito');
    expect(tituloDaNota('perfil_e')).toBe('Análise angular — vista perfil esquerdo');
    expect(tituloDaNota('costas')).toBe('Análise angular — vista costas');
    expect(tituloDaNota.length).toBe(1);
  });
});

describe('leitura de uma nota livre', () => {
  it('lê a vista livre, o nome, as medidas e a sessão de uma posição, e não a trata como posição da postura', () => {
    const lido = lerDadosExtras(dadosLivre());
    expect(lido.vista).toBe('livre');
    expect(lido.posicao).toBeNull();
    expect(lido.ladoPerfil).toBeNull();
    expect(lido.nomeLivre).toBe('elevação do braço direito');
    expect(lido.medidas.map((x) => x.id)).toEqual(['cobb']);
    expect(lido.esquema).toBe(2);
    expect(lido.metodo).toBe('marcacao_manual');
    expect(lido.sessao).toEqual({ id: ID_LIVRE, ordem: 1, previstas: ['livre'], iniciadaEm: INICIO });
  });

  it('um lado_perfil solto numa nota livre é ignorado, e um nome com sujeira volta limpo e no máximo com 80 caracteres', () => {
    const lido = lerDadosExtras({ ...dadosLivre(), lado_perfil: 'D', nome_livre: `  ${'a'.repeat(100)}  ` });
    expect(lido.ladoPerfil).toBeNull();
    expect(lido.posicao).toBeNull();
    expect(lido.nomeLivre).toBe('a'.repeat(80));
    expect(lerDadosExtras({ ...dadosLivre(), nome_livre: 42 }).nomeLivre).toBeUndefined();
    expect(lerDadosExtras({ ...dadosLivre(), nome_livre: '   ' }).nomeLivre).toBeUndefined();
  });

  it('a leitura das notas da postura não ganha campo novo e a de vista desconhecida continua sem vista', () => {
    expect(lerDadosExtras(dadosFrente())).not.toHaveProperty('nomeLivre');
    expect(lerDadosExtras({ ...dadosFrente(), nome_livre: 'solto numa nota da postura' })).not.toHaveProperty('nomeLivre');
    expect(lerDadosExtras({ vista: 'outra', medidas: [m('ombros', 2)] }).vista).toBeNull();
    expect(lerDadosExtras({ vista: 'perfil', lado_perfil: 'D', medidas: [m('cva', 50)] }).posicao).toBe('perfil_d');
  });
});

describe('o histórico da postura não vê as notas livres', () => {
  const notas: NotaDeAnalise[] = [
    nota('n-frente', '2026-03-10T13:05:00.000Z', dadosFrente()),
    nota('n-livre', '2026-03-12T13:05:00.000Z', dadosLivre()),
  ];

  it('agruparPorSessao descarta a nota livre e mantém a sessão da postura intacta', () => {
    const sessoes = agruparPorSessao(notas);
    expect(sessoes.map((s) => s.id)).toEqual([ID_POSTURA]);
    expect(Object.keys(sessoes[0].posicoes)).toEqual(['frente']);
    expect(sessoes[0].previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
  });

  it('a nota livre, mesmo a mais recente, não é "a avaliação anterior" de nenhuma posição', () => {
    const sessoes = agruparPorSessao(notas);
    for (const p of POSICOES_DA_NOTA) expect(escolherAnterior(sessoes, p)?.id ?? null, p).toBe(p === 'frente' ? ID_POSTURA : null);
    expect(sessoesComPosicao(sessoes, 'livre')).toEqual([]);
    expect(escolherAnterior(sessoes, 'livre')).toBeNull();
  });

  it('uma nota livre que, por erro, repete o id de uma sessão da postura não muda as posições nem a data dessa sessão', () => {
    const repetida = nota('n-livre-2', '2026-03-12T13:05:00.000Z', dadosLivre({ sessao: { id: ID_POSTURA, ordem: 1, previstas: ['livre'], iniciadaEm: '2026-03-12T13:00:00.000Z' } }));
    const [sessao] = agruparPorSessao([notas[0], repetida]);
    expect(Object.keys(sessao.posicoes)).toEqual(['frente']);
    expect(sessao.posicoes.frente?.notaId).toBe('n-frente');
    expect(sessao.iniciadaEm).toBe('2026-03-10T13:00:00.000Z');
    expect(sessao.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
  });

  it('só notas livres e de vídeo: o histórico da postura fica vazio e nada quebra', () => {
    expect(agruparPorSessao([notas[1], nota('n-video', '2026-03-11T10:00:00.000Z', { modelo: 'x' })])).toEqual([]);
    expect(agruparPorSessao([nota('n-livre-ruim', '2026-03-12T10:00:00.000Z', { vista: 'livre', medidas: 'lixo', sessao: 7 })])).toEqual([]);
  });

  it('compararSessoes ignora uma posição "livre" que vier por engano em qualquer das avaliações', () => {
    const livre = { medidas: [m('cobb', 20)], nivelGraus: null };
    const frente = { medidas: [m('ombros', 2)], nivelGraus: null };
    const c = compararSessoes({ esquema: 2, posicoes: { frente, livre } }, { esquema: 2, posicoes: { frente, livre } });
    expect(c.posicoes.map((p) => p.posicao)).toEqual(['frente']);
    const soLivre = compararSessoes({ esquema: 2, posicoes: { livre } }, { esquema: 2, posicoes: { livre } });
    expect(soLivre.posicoes).toEqual([]);
    expect(soLivre.avisos).toEqual([]);
  });
});
