import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { estadoInicial, itemVazio, type EstadoSessao, type ItemPosicao } from '@/hooks/useSessaoPostural';
import { avisosGeraisDoRelatorio, montarNotaDaPosicao, vistasDoRelatorio } from '@/hooks/useSessaoDoPaciente';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';
import { compararSessoes } from '@/lib/angular/comparar';
import { agruparPorSessao, type NotaDeAnalise, type SessaoAgrupada } from '@/lib/angular/sessao';
import type { VistaSessao } from '@/lib/angular/tiposSessao';

const P = (x: number, y: number) => ({ x, y });

// Pontos (em px) que dão resultado nas medidas: ombros e quadris têm 2 pontos; carregamento e punho, 3.
const OMBROS = [P(400, 450), P(600, 480)];
const QUADRIS = [P(440, 800), P(560, 800)];
const CARREGAMENTO_D = [P(400, 450), P(380, 700), P(360, 900)];
const PUNHO_D = [P(380, 700), P(360, 900), P(340, 1000)];

function estadoCom(posicao: VistaSessao, item: Partial<ItemPosicao>, id = 'sessao-1'): EstadoSessao {
  const e = estadoInicial(id, '2026-03-12T13:00:00.000Z');
  return { ...e, itens: { ...e.itens, [posicao]: { ...itemVazio(posicao), ...item } } };
}

/** Ombros e quadris sugeridos pelo modelo; carregamento e punho marcados à mão desde o início. */
const FRENTE_MISTA: Partial<ItemPosicao> = {
  pontos: { ombros: OMBROS, quadris: QUADRIS, 'carregamento-d': CARREGAMENTO_D, 'punho-d': PUNHO_D },
  sugeridas: ['ombros', 'quadris'],
};

const opcoes = (anterior: SessaoAgrupada | null = null) => ({ anterior, comFoto: false, estilo: ESTILO_PADRAO });

describe('método da posição: nota do prontuário e PDF dizem a mesma verdade', () => {
  it('ombros e quadris sugeridos e aceitos, carregamento e punho só à mão: a nota conta as duas coisas', () => {
    const nota = montarNotaDaPosicao(estadoCom('frente', FRENTE_MISTA), 'frente')!;
    expect(nota.descricao).toContain('Pontos sugeridos por detecção automática (confirmar na foto) em 2 medidas, nenhuma ajustada à mão; 2 medidas marcadas só à mão.');
    expect(nota.descricao).not.toMatch(/conferid|profissional/i);
    expect(nota.dados_extras.metodo).toBe('automatica_conferida');
    expect(nota.dados_extras.pontos_ajustados).toEqual([]);
  });

  it('medida sugerida e depois ajustada conta como ajustada (e continua sugerida); a lista gravada traz o id', () => {
    const nota = montarNotaDaPosicao(estadoCom('frente', { ...FRENTE_MISTA, ajustadas: ['ombros'] }), 'frente')!;
    expect(nota.descricao).toContain('em 2 medidas, 1 ajustada à mão; 2 medidas marcadas só à mão.');
    expect(nota.dados_extras.pontos_ajustados).toEqual(['ombros']);
  });

  it('o PDF recebe a mesma contagem, medida por medida', () => {
    const [v] = vistasDoRelatorio(estadoCom('frente', { ...FRENTE_MISTA, ajustadas: ['ombros'] }), opcoes());
    expect(v.metodo).toBe('automatica_conferida');
    expect(v.pontos).toEqual({ sugeridas: ['ombros', 'quadris'], ajustadas: ['ombros'], soMao: ['carregamento-d', 'punho-d'] });
  });

  it('a medida do fio de prumo (vários resultados) conta uma vez só', () => {
    const e = estadoCom('frente', {
      pontos: { ombros: OMBROS, 'prumo-frente': [P(500, 900), P(505, 100), P(510, 300), P(500, 550)] },
      sugeridas: ['ombros'],
    });
    const [v] = vistasDoRelatorio(e, opcoes());
    expect(v.medidas.filter((m) => m.id.startsWith('prumo-frente')).length).toBeGreaterThan(1);
    expect(v.pontos?.soMao).toEqual(['prumo-frente']);
  });

  it('tudo à mão: método manual, sem contagem de sugestão', () => {
    const e = estadoCom('frente', { pontos: { ombros: OMBROS, 'punho-d': PUNHO_D } });
    const nota = montarNotaDaPosicao(e, 'frente')!;
    expect(nota.dados_extras.metodo).toBe('marcacao_manual');
    expect(nota.dados_extras.pontos_ajustados).toBeUndefined();
    expect(nota.descricao).toContain('Pontos marcados manualmente.');
    const [v] = vistasDoRelatorio(e, opcoes());
    expect(v.metodo).toBe('marcacao_manual');
    expect(v.pontos).toBeUndefined();
  });

  it('sugestão deixada incompleta (sem resultado) não faz a posição virar "detecção automática": as medidas que sobraram foram feitas à mão', () => {
    const e = estadoCom('frente', { pontos: { ombros: OMBROS, quadris: [P(440, 800)] }, sugeridas: ['quadris'] });
    const nota = montarNotaDaPosicao(e, 'frente')!;
    expect(nota.dados_extras.metodo).toBe('marcacao_manual');
    expect(nota.descricao).toContain('Pontos marcados manualmente.');
    expect(nota.descricao).not.toContain('detecção automática');
    expect(vistasDoRelatorio(e, opcoes())[0].metodo).toBe('marcacao_manual');
  });
});

describe('data da avaliação anterior no PDF', () => {
  const nota = (id: string, created_at: string, iniciadaEm: string): NotaDeAnalise => ({
    id, created_at,
    dados_extras: {
      vista: 'frente', esquema: 2, medidas: [{ id: 'ombros', graus: 3.4, texto: 'Linha dos ombros: 3,4°, lado direito mais alto.' }], metodo: 'marcacao_manual',
      nivel_graus: null, escala_cm_por_px: null, opcoes: {}, sessao: { id: `s-${id}`, ordem: 1, previstas: ['frente'], iniciadaEm },
    },
  });
  const anterior = (n: NotaDeAnalise) => agruparPorSessao([n])[0];

  it('data conhecida vai em dd/mm/aaaa', () => {
    const [v] = vistasDoRelatorio(estadoCom('frente', FRENTE_MISTA), opcoes(anterior(nota('a', '2026-02-01T12:00:00Z', '2026-02-01T12:00:00.000Z'))));
    expect(v.anterior?.data).toBe('01/02/2026');
  });

  it('sem data válida, a data vai vazia (o PDF escreve "Antes" e a nota abaixo da tabela), nunca um texto comprido que passa da coluna', () => {
    const [v] = vistasDoRelatorio(estadoCom('frente', FRENTE_MISTA), opcoes(anterior(nota('b', 'não é data', 'também não'))));
    expect(v.anterior).not.toBeNull();
    expect(v.anterior?.data).toBe('');
  });
});

describe('avisos de comparabilidade no PDF: os mesmos que a tela mostra (compararSessoes)', () => {
  const OMBROS_ANTES = { id: 'ombros', graus: 3.4, texto: 'Linha dos ombros: 3,4°, lado direito mais alto.' };
  const dadosExtras = (vista: string, extra: Record<string, unknown> = {}) => ({
    vista, esquema: 2, medidas: [OMBROS_ANTES], metodo: 'marcacao_manual', nivel_graus: null, escala_cm_por_px: null, opcoes: {}, ...extra,
  });
  const sessaoGravada = { id: 's-ant', ordem: 1, previstas: ['frente', 'perfil_d'], iniciadaEm: '2026-02-01T12:00:00.000Z' };
  const nota = (id: string, created_at: string, dados_extras: unknown): NotaDeAnalise => ({ id, created_at, dados_extras });
  const anteriorDe = (...notas: NotaDeAnalise[]) => agruparPorSessao(notas)[0];
  const FRENTE = estadoCom('frente', FRENTE_MISTA);

  /** O que a tela monta: as medidas e o nível de cada posição feita agora contra a avaliação anterior. */
  const comoATela = (anterior: SessaoAgrupada) => compararSessoes(
    { esquema: 2, posicoes: { frente: { medidas: vistasDoRelatorio(FRENTE, opcoes())[0].medidas, nivelGraus: null } } },
    anterior,
  );

  it('nível corrigido na avaliação anterior e não agora: o aviso da tela vai para a posição, palavra por palavra', () => {
    const anterior = anteriorDe(nota('a', '2026-02-01T12:00:00Z', dadosExtras('frente', { nivel_graus: 1.8, sessao: sessaoGravada })));
    const [v] = vistasDoRelatorio(FRENTE, opcoes(anterior));
    const daTela = comoATela(anterior).posicoes.find((c) => c.posicao === 'frente')!.avisos.map((a) => a.texto);
    expect(daTela).toEqual(['Frente: na avaliação anterior a foto foi nivelada (correção de 1,8°); nesta não consta correção de nível. Os ângulos podem não ser comparáveis.']);
    expect(v.avisos).toEqual(daTela);
    expect(avisosGeraisDoRelatorio(FRENTE, anterior)).toEqual([]);
  });

  it('nível corrigido agora e não na avaliação anterior: o aviso diz "nesta avaliação" com a correção desta foto', () => {
    const anterior = anteriorDe(nota('a', '2026-02-01T12:00:00Z', dadosExtras('frente', { sessao: sessaoGravada })));
    const nivelada = estadoCom('frente', { ...FRENTE_MISTA, inclinacaoCaptura: 2 });
    const [v] = vistasDoRelatorio(nivelada, opcoes(anterior));
    expect(v.avisos).toEqual(['Frente: nesta avaliação a foto foi nivelada (correção de 2,0°); na anterior não consta correção de nível. Os ângulos podem não ser comparáveis.']);
  });

  it('posições comparáveis (mesmo nível, posição nas duas): nenhum aviso', () => {
    const anterior = anteriorDe(nota('a', '2026-02-01T12:00:00Z', dadosExtras('frente', { sessao: sessaoGravada })));
    const [v] = vistasDoRelatorio(FRENTE, opcoes(anterior));
    expect(v.avisos).toBeUndefined();
    expect(avisosGeraisDoRelatorio(FRENTE, anterior)).toEqual([]);
    expect(comoATela(anterior).posicoes.flatMap((c) => c.avisos)).toEqual([]);
  });

  it('sem avaliação anterior: nenhum aviso', () => {
    expect(vistasDoRelatorio(FRENTE, opcoes(null))[0].avisos).toBeUndefined();
    expect(avisosGeraisDoRelatorio(FRENTE, null)).toEqual([]);
  });

  it('posição só desta avaliação vai para a posição; posição que só estava na anterior vai para os avisos gerais', () => {
    const anterior = anteriorDe(nota('p', '2026-02-01T12:00:00Z', dadosExtras('perfil', { lado_perfil: 'D', sessao: sessaoGravada })));
    const [v] = vistasDoRelatorio(FRENTE, opcoes(anterior));
    expect(v.anterior).toBeNull();
    expect(v.avisos).toEqual(['Frente: só nesta avaliação; a anterior não tem essa posição.']);
    expect(avisosGeraisDoRelatorio(FRENTE, anterior)).toEqual(['Perfil direito: estava na avaliação anterior e ainda não foi feita nesta.']);
  });

  it('perfil antigo sem lado: o aviso geral da tela também vai para o PDF', () => {
    const estado = estadoCom('perfil_d', { pontos: { 'tronco-perfil': [P(500, 300), P(505, 550)] }, sugeridas: ['tronco-perfil'] });
    const anterior = anteriorDe(nota('legado', '2026-01-10T12:00:00Z', { vista: 'perfil', medidas: [{ id: 'tronco-perfil', graus: 4, texto: 'Inclinação do tronco: 4,0°.' }], metodo: 'marcacao_manual' }));
    expect(vistasDoRelatorio(estado, opcoes(anterior)).length).toBe(1);
    const gerais = avisosGeraisDoRelatorio(estado, anterior);
    expect(gerais).toContain('Perfil sem lado informado (avaliação antiga) não é comparado com perfil direito ou esquerdo: não dá para saber de que lado foi a foto.');
    expect(gerais).toContain('Perfil (lado não informado): estava na avaliação anterior e ainda não foi feita nesta.');
  });

  it('formatos diferentes (esquema da avaliação anterior mais antigo): o aviso geral da tela vai para o PDF', () => {
    const anterior = anteriorDe(nota('v1', '2026-02-01T12:00:00Z', { ...dadosExtras('frente'), esquema: 1 }));
    expect(avisosGeraisDoRelatorio(FRENTE, anterior)).toEqual([expect.stringContaining('versões diferentes do aplicativo')]);
  });
});
