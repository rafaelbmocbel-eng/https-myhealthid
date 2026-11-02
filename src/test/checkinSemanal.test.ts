import { describe, it, expect } from 'vitest';
import {
  ITENS_CHECKIN, ROTULOS_ITEM, ESCALA_URINA, MIN_RESPOSTAS_ALERTA, TAMANHO_BASELINE,
  interpretarRespostaCheckin, pareceTentativaDeCheckin, reconheceParar, reconheceVoltar,
  montarPedidoCheckin, montarConfirmacaoCheckin, montarAjudaCheckin,
  indiceBemEstar, paraEscala10, classeUrina, urinaParaMyID, rotuloPsr,
  inicioDaSemanaBR, diasEntre, dataCurta,
  sentidoDaVariacao, variacaoDoItem, calcularBaseline, calcularAlertas,
  type LinhaCheckin, type ResultadoLeitura,
} from '../../supabase/functions/_shared/checkin-semanal';

type Recusa = Extract<ResultadoLeitura, { ok: false }>;

const recusar = (texto: string): Recusa => {
  const r = interpretarRespostaCheckin(texto);
  expect(r.ok).toBe(false);
  return r as Recusa;
};

const linha = (semana: string, v: Partial<LinhaCheckin> = {}): LinhaCheckin => ({
  semana, fadiga: 4, sono: 4, dor_muscular: 4, estresse: 4, humor: 4, urina: 2, psr: null, ...v,
});

describe('interpretarRespostaCheckin', () => {
  const certo = { fadiga: 4, sono: 3, dor_muscular: 5, estresse: 4, humor: 4, urina: 2, psr: null };

  it.each([
    ['4 3 5 4 4 2'],
    ['4,3,5,4,4,2'],
    ['4, 3, 5, 4, 4, 2'],
    ['4;3;5;4;4;2'],
    ['4-3-5-4-4-2'],
    ['4/3/5/4/4/2'],
    ['435442'],
    ['  4  3  5  4  4  2  '],
    ['4 3 5 4 4 e 2'],
    ['4 3 5 4 4\n2'],
    ['04 03 05 04 04 02'],
  ])('lê "%s" como fadiga 4, sono 3, dor 5, estresse 4, humor 4, urina 2', (texto) => {
    expect(interpretarRespostaCheckin(texto)).toEqual({ ok: true, valores: certo });
  });

  it('5 números: urina e recuperação ficam vazias', () => {
    expect(interpretarRespostaCheckin('3 3 3 3 3')).toEqual({
      ok: true, valores: { fadiga: 3, sono: 3, dor_muscular: 3, estresse: 3, humor: 3, urina: null, psr: null },
    });
    expect(interpretarRespostaCheckin('33333')).toMatchObject({ ok: true });
  });

  it('7 números: o último é a recuperação do treino (0 a 10), inclusive o 10', () => {
    expect(interpretarRespostaCheckin('4 3 5 4 4 2 7')).toMatchObject({ ok: true, valores: { psr: 7, urina: 2 } });
    expect(interpretarRespostaCheckin('4 3 5 4 4 2 10')).toMatchObject({ ok: true, valores: { psr: 10 } });
    expect(interpretarRespostaCheckin('4 3 5 4 4 2 0')).toMatchObject({ ok: true, valores: { psr: 0 } });
    expect(interpretarRespostaCheckin('4354427')).toMatchObject({ ok: true, valores: { psr: 7 } });
  });

  it('recusa quantidade errada de números, dizendo quantos vieram', () => {
    for (const texto of ['4 3 5 4', '4 3 5 4 4 2 7 1', '1 2 3', '4 3 5 4 4 2 7 5 5']) {
      expect(recusar(texto).motivo).toBe('quantidade');
    }
    expect(recusar('4 3 5 4').detalhe).toContain('4 números');
  });

  it('recusa item de 1 a 5 fora da faixa e diz qual', () => {
    const casos: [string, string][] = [
      ['0 3 5 4 4 2', 'Fadiga'],
      ['4 6 5 4 4 2', 'Sono'],
      ['4 3 9 4 4 2', 'Dor muscular'],
      ['4 3 5 10 4 2', 'Estresse'],
      ['4 3 5 4 0 2', 'Humor'],
    ];
    for (const [texto, nome] of casos) {
      const r = recusar(texto);
      expect(r.motivo).toBe('fora_da_faixa');
      expect(r.detalhe).toContain(nome);
    }
  });

  it('recusa urina fora de 1 a 8 e recuperação fora de 0 a 10', () => {
    expect(interpretarRespostaCheckin('4 3 5 4 4 0')).toMatchObject({ ok: false, motivo: 'fora_da_faixa' });
    expect(interpretarRespostaCheckin('4 3 5 4 4 9')).toMatchObject({ ok: false, motivo: 'fora_da_faixa' });
    expect(interpretarRespostaCheckin('4 3 5 4 4 2 11')).toMatchObject({ ok: false, motivo: 'fora_da_faixa' });
  });

  it('recusa texto com letras ou símbolos', () => {
    for (const texto of ['oi tudo bem', '4 3 5 4 4 2 ok', 'quatro tres cinco', '4 3 5 4 4 2 😀', '']) {
      const r = interpretarRespostaCheckin(texto);
      expect(r.ok).toBe(false);
    }
  });
});

describe('pareceTentativaDeCheckin: só números e separadores, em quantidade que sugere o check-in', () => {
  it('reconhece tentativas, mesmo erradas (4 a 8 números, ou 5 a 7 dígitos colados)', () => {
    for (const t of ['4 3 5 4 4 2', '4 3 5 4', '435442', '43544', '4354427', '4,3,5,4,4,2,7,1', '4 3 5 4 4 2 7 1']) expect(pareceTentativaDeCheckin(t)).toBe(true);
  });

  it('não pega conversa normal: nota de NPS, número solto, ano, data, hora, telefone, CPF, endereço', () => {
    for (const t of [
      '8', '10', '4 3', '4 3 5', '999', '2026', '120', '12/11/2026', '14h30', '14:30', '91 98765 4321', '91987654321',
      '123.456.789-09', '12345678901', 'quero remarcar para as 14h', 'sim', 'ok 5', 'rua 25 de março, 120', '4 3 5 4 4 2 7 1 9', '',
    ]) {
      expect(pareceTentativaDeCheckin(t)).toBe(false);
    }
  });
});

describe('PARAR e VOLTAR', () => {
  it('PARAR vale com caixa, ponto, espaço e acento, mas só sozinho', () => {
    for (const t of ['PARAR', 'parar', 'Parar.', ' parar ', 'PARAR!']) expect(reconheceParar(t)).toBe(true);
    for (const t of ['não quero parar de treinar', 'parar de receber', 'para', 'pará', '', 'parar tudo']) expect(reconheceParar(t)).toBe(false);
  });

  it('VOLTAR vale só sozinho', () => {
    for (const t of ['VOLTAR', 'voltar', 'Voltar!']) expect(reconheceVoltar(t)).toBe(true);
    for (const t of ['quero voltar a treinar', 'voltar amanhã']) expect(reconheceVoltar(t)).toBe(false);
  });
});

describe('textos do WhatsApp', () => {
  it('o pedido explica a escala, dá exemplo, avisa que não é urgência e como parar', () => {
    const t = montarPedidoCheckin({ nome: 'Maria da Silva' });
    expect(t).toContain('Oi Maria!');
    expect(t).toContain('6 números');
    expect(t).toContain('quanto MAIOR, melhor');
    for (const item of ['Fadiga', 'Sono', 'Dor muscular', 'Estresse', 'Humor', 'Cor da urina']) expect(t).toContain(item);
    expect(t).toContain('Exemplo: 4 3 5 4 4 2');
    expect(t).toContain('PARAR');
    expect(t).toContain('urgente');
    expect(t).not.toContain('MyID');
  });

  it('sem nome, o cumprimento não fica com espaço sobrando', () => {
    expect(montarPedidoCheckin({ nome: '  ' })).toMatch(/^Oi! /);
    expect(montarPedidoCheckin()).toMatch(/^Oi! /);
  });

  it('com treino, pede o sétimo número opcional', () => {
    const t = montarPedidoCheckin({ comPsr: true });
    expect(t).toContain('até 7 números');
    expect(t).toContain('7) Opcional');
    expect(t).toContain('Exemplo: 4 3 5 4 4 2 7');
  });

  it('quem ainda não fez o MyID recebe o pedido de começar por ele, com o link', () => {
    const t = montarPedidoCheckin({ linkMyID: 'https://exemplo.invalid/paciente/login' });
    expect(t).toContain('primeiro passo continua sendo o MyID');
    expect(t).toContain('https://exemplo.invalid/paciente/login');
    const valores = { fadiga: 4, sono: 3, dor_muscular: 5, estresse: 4, humor: 4, urina: 2, psr: null };
    expect(montarConfirmacaoCheckin(valores, 'https://x.invalid/l')).toContain('Falta o seu MyID');
  });

  it('a confirmação devolve o que foi lido e diz como corrigir', () => {
    const t = montarConfirmacaoCheckin({ fadiga: 4, sono: 3, dor_muscular: 5, estresse: 4, humor: 4, urina: 2, psr: 8 });
    expect(t).toContain('Fadiga 4 · Sono 3 · Dor muscular 5 · Estresse 4 · Humor 4 · Urina 2 · Recuperação 8');
    expect(t).toContain('mandar os números de novo');
    expect(t).not.toContain('MyID');
  });

  it('a ajuda mostra o exemplo e o motivo', () => {
    expect(montarAjudaCheckin('quantidade', '4 números em vez de 5 a 7')).toContain('4 números');
    expect(montarAjudaCheckin('fora_da_faixa', 'Sono precisa ser de 1 a 5 (veio 6)')).toContain('Sono precisa');
    expect(montarAjudaCheckin('nao_numerico', 'x')).toContain('só números');
  });
});

describe('escalas e rótulos', () => {
  it('cada item tem 5 níveis rotulados e a escala da urina tem 8', () => {
    for (const item of ITENS_CHECKIN) {
      expect(Object.keys(ROTULOS_ITEM[item].niveis)).toHaveLength(5);
      for (const n of [1, 2, 3, 4, 5] as const) expect(ROTULOS_ITEM[item].niveis[n].length).toBeGreaterThan(2);
    }
    expect(ESCALA_URINA.map((u) => u.nivel)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('classes da urina e ligação com as 4 opções do MyID', () => {
    expect([1, 3, 4, 5, 6, 8].map(classeUrina)).toEqual(['boa', 'boa', 'atencao', 'atencao', 'desidratacao', 'desidratacao']);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(urinaParaMyID)).toEqual([
      'clear', 'clear', 'yellow_clear', 'yellow_clear', 'dark', 'dark', 'very_dark', 'very_dark',
    ]);
  });

  it('índice de bem-estar (5 a 25) e conversão para a escala 0 a 10 do MyID', () => {
    expect(indiceBemEstar({ fadiga: 1, sono: 1, dor_muscular: 1, estresse: 1, humor: 1 })).toBe(5);
    expect(indiceBemEstar({ fadiga: 5, sono: 5, dor_muscular: 5, estresse: 5, humor: 5 })).toBe(25);
    expect(indiceBemEstar({ fadiga: 4, sono: 3, dor_muscular: 5, estresse: 4, humor: 4 })).toBe(20);
    expect([1, 2, 3, 4, 5].map(paraEscala10)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('rótulo da recuperação cobre 0 a 10', () => {
    for (let n = 0; n <= 10; n++) expect(rotuloPsr(n).length).toBeGreaterThan(3);
    expect(rotuloPsr(0)).toMatch(/Nada/);
    expect(rotuloPsr(10)).toMatch(/Totalmente/);
  });
});

describe('semana (segunda a domingo, horário de Brasília)', () => {
  it.each([
    ['2026-10-26T12:00:00Z', '2026-10-26'], // segunda
    ['2026-11-01T14:00:00Z', '2026-10-26'], // domingo à tarde
    ['2026-11-01T21:30:00Z', '2026-10-26'], // domingo 18h30 em Brasília
    ['2026-11-02T02:59:00Z', '2026-10-26'], // domingo 23h59 em Brasília
    ['2026-11-02T03:00:00Z', '2026-11-02'], // segunda 00h00 em Brasília
    ['2026-10-28T10:00:00Z', '2026-10-26'], // quarta
  ])('%s cai na semana que começa em %s', (instante, segunda) => {
    expect(inicioDaSemanaBR(new Date(instante))).toBe(segunda);
  });

  it('diasEntre e dataCurta', () => {
    expect(diasEntre('2026-10-26', '2026-11-02')).toBe(7);
    expect(diasEntre('2026-12-28', '2027-01-04')).toBe(7);
    expect(dataCurta('2026-10-26')).toBe('26/10');
  });
});

describe('comparação com a semana anterior', () => {
  it('nos itens e na recuperação, subir é melhorar; na urina, subir é piorar', () => {
    expect(sentidoDaVariacao(1)).toBe('melhorou');
    expect(sentidoDaVariacao(-2)).toBe('piorou');
    expect(sentidoDaVariacao(0)).toBe('igual');
    expect(sentidoDaVariacao(1, true)).toBe('piorou');
    expect(sentidoDaVariacao(-1, true)).toBe('melhorou');
  });

  it('variacaoDoItem usa a linha anterior e some sem dado dos dois lados', () => {
    const antes = linha('2026-10-19', { fadiga: 3, urina: 5 });
    const agora = linha('2026-10-26', { fadiga: 4, urina: 3, psr: 7 });
    expect(variacaoDoItem('fadiga', agora, antes)).toEqual({ delta: 1, sentido: 'melhorou' });
    expect(variacaoDoItem('urina', agora, antes)).toEqual({ delta: -2, sentido: 'melhorou' });
    expect(variacaoDoItem('psr', agora, antes)).toBeNull();
    expect(variacaoDoItem('sono', agora, null)).toBeNull();
  });
});

describe('linha de base e alertas (mesmos casos do teste do banco 07_checkin_semanal)', () => {
  const semanas = (n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 7 + i * 7));
    return d.toISOString().slice(0, 10);
  });

  it('a linha de base é a média das 4 primeiras respostas, só quando já há 4', () => {
    expect(calcularBaseline([linha('2026-09-07'), linha('2026-09-14'), linha('2026-09-21')])).toBeNull();
    const s = semanas(5).map((w, i) => linha(w, { fadiga: [5, 4, 3, 4, 1][i] }));
    expect(calcularBaseline(s)?.fadiga).toBe(4);
    expect(TAMANHO_BASELINE).toBe(4);
    expect(MIN_RESPOSTAS_ALERTA).toBe(6);
  });

  it('a linha de base ignora a ordem em que as linhas chegam', () => {
    const w = semanas(4);
    const s = [linha(w[3], { sono: 1 }), linha(w[0], { sono: 5 }), linha(w[2], { sono: 3 }), linha(w[1], { sono: 4 })];
    expect(calcularBaseline(s)?.sono).toBe(3.3);
  });

  it('A1: 6 respostas, as duas últimas 1 ponto abaixo da média das 4 primeiras em fadiga: alerta só em fadiga', () => {
    const w = semanas(6);
    const s = w.map((semana, i) => linha(semana, { fadiga: i < 4 ? 4 : 3 }));
    expect(calcularAlertas(s)).toEqual(['fadiga']);
  });

  it('A2: só a última cai: sem alerta', () => {
    const w = semanas(6);
    const s = w.map((semana, i) => linha(semana, { fadiga: i === 5 ? 3 : 4 }));
    expect(calcularAlertas(s)).toEqual([]);
  });

  it('A3: menos de 6 respostas: sem alerta, mesmo com queda forte', () => {
    const w = semanas(5);
    const s = w.map((semana, i) => linha(semana, { humor: i < 3 ? 5 : 1 }));
    expect(calcularAlertas(s)).toEqual([]);
  });

  it('A4: duas últimas respostas não são de semanas seguidas: sem alerta', () => {
    const w = semanas(7);
    const s = [...w.slice(0, 5), w[6]].map((semana, i) => linha(semana, { estresse: i < 4 ? 4 : 2 }));
    expect(calcularAlertas(s)).toEqual([]);
  });

  it('A5: queda de menos de 1 ponto em relação à média não alerta; de exatamente 1 alerta', () => {
    const w = semanas(6);
    const media43 = w.map((semana, i) => linha(semana, { dor_muscular: i === 0 ? 5 : i < 4 ? 4 : 4 }));
    expect(calcularAlertas(media43)).toEqual([]);
    const exato = w.map((semana, i) => linha(semana, { dor_muscular: i < 4 ? 4 : 3 }));
    expect(calcularAlertas(exato)).toEqual(['dor_muscular']);
  });

  it('A6: vários itens caindo alertam juntos, na ordem dos itens', () => {
    const w = semanas(6);
    const s = w.map((semana, i) => linha(semana, i < 4 ? {} : { fadiga: 2, sono: 3, humor: 1 }));
    expect(calcularAlertas(s)).toEqual(['fadiga', 'sono', 'humor']);
  });

  it('A8: a 4ª resposta entra na linha de base (média 3,25): sem alerta', () => {
    const w = semanas(6);
    const s = w.map((semana, i) => linha(semana, { fadiga: [4, 4, 4, 2, 3, 3][i] }));
    expect(calcularAlertas(s)).toEqual([]);
  });

  it('A7: melhora não alerta', () => {
    const w = semanas(8);
    const s = w.map((semana, i) => linha(semana, { humor: i < 4 ? 3 : 5 }));
    expect(calcularAlertas(s)).toEqual([]);
  });
});
