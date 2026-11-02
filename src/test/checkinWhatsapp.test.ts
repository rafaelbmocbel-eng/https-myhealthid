import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_URL } from '@/utils/linkUrls';
import {
  DIAS_PEDIDO_RECENTE,
  FALHAS_SEGUIDAS_PARA_PARAR,
  LIMITE_LOTE_POR_PROFISSIONAL,
  MAX_ERROS_POR_SEMANA,
  URL_BASE_APP,
  VALIDADE_PEDIDO_HORAS,
  cortarLote,
  decidirAcaoDaMensagem,
  dentroDaJanelaDeEnvio,
  deveInterromperLote,
  elegivelParaPedido,
  emBlocos,
  expiraEmDoPedido,
  filtrarElegiveis,
  inicioDaJanelaDeTreino,
  instanteDoInicioDaSemana,
  limiteDoPedidoRecente,
  linkMyIDDoCliente,
  linkMyIDSeFaltar,
  montarFalhaGravacao,
  pausaEntreEnvios,
  podeSerDoCheckin,
  selecionarLote,
  telefoneParaEnvio,
  telefoneValidoParaEnvio,
  type AcaoCheckin,
  type CandidatoCheckin,
  type EntradaDecisao,
} from '../../supabase/functions/_shared/checkin-whatsapp';
import { inicioDaSemanaBR } from '../../supabase/functions/_shared/checkin-semanal';
import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';

// Os arquivos das Edge Functions (Deno) são carregados de verdade, com o Deno, o Supabase e o envio trocados por
// dublês. O cliente falso grava cada consulta feita e devolve o que o cenário do teste mandar.
interface ConsultaFalsa {
  tabela: string;
  op: string;
  payload: unknown;
  chamadas: [string, unknown[]][];
  single: boolean;
}

interface EstadoFalso {
  responder: (q: ConsultaFalsa) => Record<string, unknown> | undefined;
  rpc: (nome: string, args: Record<string, unknown>) => unknown;
  consultas: ConsultaFalsa[];
  rpcs: { nome: string; args: Record<string, unknown> }[];
}

const h = vi.hoisted(() => {
  const criarCliente = (estado: EstadoFalso) => ({
    from(tabela: string) {
      const q: ConsultaFalsa = { tabela, op: 'select', payload: undefined, chamadas: [], single: false };
      let opFixada = false;
      const b: unknown = new Proxy({}, {
        get(_alvo, metodo: string) {
          if (metodo === 'then') {
            return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
              estado.consultas.push(q);
              const padrao = q.single ? { data: null, error: null } : { data: [], error: null, count: 0 };
              return Promise.resolve({ ...padrao, ...(estado.responder(q) || {}) }).then(ok, ko);
            };
          }
          return (...args: unknown[]) => {
            q.chamadas.push([metodo, args]);
            if (!opFixada && ['insert', 'upsert', 'update', 'delete'].includes(metodo)) {
              q.op = metodo;
              q.payload = args[0];
              opFixada = true;
            }
            if (metodo === 'maybeSingle' || metodo === 'single') q.single = true;
            return b;
          };
        },
      });
      return b;
    },
    rpc(nome: string, args: Record<string, unknown>) {
      estado.rpcs.push({ nome, args });
      return Promise.resolve(estado.rpc(nome, args));
    },
  });

  const novoEstado = (): EstadoFalso => ({ responder: () => undefined, rpc: () => ({ data: null, error: null }), consultas: [], rpcs: [] });

  const h = {
    criarCliente,
    novoEstado,
    estado: novoEstado(),
    tela: novoEstado(),
    handlers: {} as Record<string, (req: Request) => Promise<Response>>,
    ultimoHandler: null as null | ((req: Request) => Promise<Response>),
    env: {} as Record<string, string | undefined>,
    enviar: vi.fn(),
    registrar: vi.fn(),
    entregar: vi.fn(),
    fetch: vi.fn(),
    pausas: [] as number[],
    admin: null as unknown,
  };
  h.admin = {
    from: (t: string) => criarCliente(h.estado).from(t),
    rpc: (n: string, a: Record<string, unknown>) => criarCliente(h.estado).rpc(n, a),
  };
  return h;
});

vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => h.admin }));
vi.mock('../../supabase/functions/_shared/enviar-whatsapp.ts', () => ({
  enviarWhatsapp: (...a: unknown[]) => h.enviar(...a),
  entregarPendentes: (...a: unknown[]) => h.entregar(...a),
}));
vi.mock('../../supabase/functions/_shared/registrar-saida.ts', () => ({
  registrarMensagemSaida: (...a: unknown[]) => h.registrar(...a),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'T1' } } }) },
    from: (t: string) => h.criarCliente(h.tela).from(t),
    rpc: (n: string, a: Record<string, unknown>) => h.criarCliente(h.tela).rpc(n, a),
  },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

// ───────────── Decisão sobre a mensagem recebida ─────────────

const SEMANA_PEDIDO = '2026-10-26';

const entrada = (e: Partial<EntradaDecisao> = {}): EntradaDecisao => ({
  texto: '4 3 5 4 4 2',
  tipo: 'texto',
  fromMe: false,
  temPaciente: true,
  pedidoAberto: { semana: SEMANA_PEDIDO },
  recebeuPedidoRecente: true,
  whatsappDesligado: false,
  ...e,
});

const decidir = (e: Partial<EntradaDecisao> = {}): AcaoCheckin => decidirAcaoDaMensagem(entrada(e));
const IGNORAR: AcaoCheckin = { acao: 'ignorar' };

describe('decidirAcaoDaMensagem: o que nunca é do check-in', () => {
  it('ignora mensagem do próprio número da clínica, mesmo com números válidos', () => {
    expect(decidir({ fromMe: true })).toEqual(IGNORAR);
  });

  it('ignora quem não é cliente cadastrado, mesmo com pedido e números válidos', () => {
    expect(decidir({ temPaciente: false })).toEqual(IGNORAR);
    expect(decidir({ temPaciente: false, texto: 'PARAR' })).toEqual(IGNORAR);
  });

  it.each(['imagem', 'audio', 'video', 'documento'])('ignora mídia (%s), inclusive com legenda numérica', (tipo) => {
    expect(decidir({ tipo })).toEqual(IGNORAR);
    expect(decidir({ tipo, texto: 'PARAR' })).toEqual(IGNORAR);
  });

  it.each([null, undefined, '', '   ', '\n'])('ignora texto vazio (%j)', (texto) => {
    expect(decidir({ texto })).toEqual(IGNORAR);
  });

  it.each([
    'Oi, tudo bem?',
    'Quero remarcar minha sessão para quinta às 15h',
    'Dormi 4 horas e acordei 3 vezes',
    '4 3 5 4 4 2 mais ou menos',
    'sim',
  ])('conversa comum com pedido em aberto segue para o bot: %s', (texto) => {
    expect(decidir({ texto })).toEqual(IGNORAR);
  });

  it.each(['0', '7', '9', '10', ' 8 ', '10.'])('nota de NPS de um número só não é capturada (%s)', (texto) => {
    expect(decidir({ texto })).toEqual(IGNORAR);
    expect(decidir({ texto, pedidoAberto: null })).toEqual(IGNORAR);
  });

  it.each(['12', '4 5', '3,5', '4 e 5'])('número solto ou par de números não é tentativa de check-in (%s)', (texto) => {
    expect(decidir({ texto })).toEqual(IGNORAR);
  });
});

describe('decidirAcaoDaMensagem: PARAR e VOLTAR', () => {
  it.each(['PARAR', 'parar', 'Parar.', ' parar! ', 'PARAR\n'])('%j com pedido recente desliga o lembrete', (texto) => {
    expect(decidir({ texto })).toEqual({ acao: 'parar' });
  });

  it('PARAR sem pedido nos últimos 30 dias é conversa normal', () => {
    expect(decidir({ texto: 'PARAR', recebeuPedidoRecente: false })).toEqual(IGNORAR);
    expect(decidir({ texto: 'PARAR', recebeuPedidoRecente: false, pedidoAberto: null })).toEqual(IGNORAR);
  });

  it('PARAR vale mesmo sem pedido em aberto (o pedido pode ter expirado)', () => {
    expect(decidir({ texto: 'PARAR', pedidoAberto: null })).toEqual({ acao: 'parar' });
  });

  it('só a palavra sozinha vale: frase com "parar" vai para o bot', () => {
    expect(decidir({ texto: 'quero parar de receber' })).toEqual(IGNORAR);
    expect(decidir({ texto: 'não vou parar de treinar' })).toEqual(IGNORAR);
  });

  it('VOLTAR só vale para quem desligou o lembrete', () => {
    expect(decidir({ texto: 'VOLTAR', whatsappDesligado: true })).toEqual({ acao: 'voltar' });
    expect(decidir({ texto: 'voltar!', whatsappDesligado: true, recebeuPedidoRecente: false })).toEqual({ acao: 'voltar' });
    expect(decidir({ texto: 'VOLTAR', whatsappDesligado: false })).toEqual(IGNORAR);
  });

  it('VOLTAR não depende de pedido recente nem em aberto', () => {
    expect(decidir({ texto: 'voltar', whatsappDesligado: true, pedidoAberto: null, recebeuPedidoRecente: false })).toEqual({ acao: 'voltar' });
  });
});

describe('decidirAcaoDaMensagem: resposta ao pedido', () => {
  it('grava com a semana do PEDIDO, não a da mensagem', () => {
    const r = decidir({ pedidoAberto: { semana: '2026-09-07' } });
    expect(r).toEqual({
      acao: 'gravar',
      semana: '2026-09-07',
      valores: { fadiga: 4, sono: 3, dor_muscular: 5, estresse: 4, humor: 4, urina: 2, psr: null },
    });
  });

  it('com 7 números, a sétima é a recuperação do treino', () => {
    const r = decidir({ texto: '4 3 5 4 4 2 7' }) as Extract<AcaoCheckin, { acao: 'gravar' }>;
    expect(r.acao).toBe('gravar');
    expect(r.valores.psr).toBe(7);
  });

  it('com 5 números, urina e recuperação ficam em branco', () => {
    const r = decidir({ texto: '4 3 5 4 4' }) as Extract<AcaoCheckin, { acao: 'gravar' }>;
    expect(r.acao).toBe('gravar');
    expect(r.valores.urina).toBeNull();
    expect(r.valores.psr).toBeNull();
  });

  it.each(['4,3,5,4,4,2', '4 - 3 - 5 - 4 - 4 - 2', '435442', '4 3 5 4 4 e 2', '4;3;5;4;4;2'])('aceita os formatos do WhatsApp (%s)', (texto) => {
    expect((decidir({ texto }) as AcaoCheckin).acao).toBe('gravar');
  });

  it('resposta válida SEM pedido em aberto é ignorada (vira conversa para o bot)', () => {
    expect(decidir({ pedidoAberto: null })).toEqual(IGNORAR);
  });

  it('quem desligou o lembrete ainda pode responder a um pedido em aberto', () => {
    expect((decidir({ whatsappDesligado: true }) as AcaoCheckin).acao).toBe('gravar');
  });

  it.each([
    ['4 3 5 4', 'quantidade', '4 números'],
    ['4 3 5 4 4 2 7 1', 'quantidade', '8 números'],
    ['4 3 5 4 9 2', 'fora_da_faixa', 'Humor'],
    ['0 3 5 4 4 2', 'fora_da_faixa', 'Fadiga'],
    ['4 3 5 4 4 9', 'fora_da_faixa', 'urina'],
    ['4 3 5 4 4 2 11', 'fora_da_faixa', 'recuperação'],
  ])('resposta mal formada com pedido em aberto pede ajuda: %s', (texto, motivo, trecho) => {
    const r = decidir({ texto }) as Extract<AcaoCheckin, { acao: 'ajuda' }>;
    expect(r.acao).toBe('ajuda');
    expect(r.motivo).toBe(motivo);
    expect(r.detalhe).toContain(trecho);
  });

  it('resposta mal formada SEM pedido em aberto não gera ajuda', () => {
    expect(decidir({ texto: '4 3 5', pedidoAberto: null })).toEqual(IGNORAR);
  });

  it('o ajuda de quantidade nunca vira gravação (4 números não são um check-in)', () => {
    expect((decidir({ texto: '5 5 5 5' }) as AcaoCheckin).acao).toBe('ajuda');
  });

  it.each(['4 3 5', '12/11/2026', '91 98765 4321', '123.456.789-09', '2026', '14h30', '12345678901'])(
    'com pedido em aberto, "%s" é conversa normal (data, telefone, CPF, ano ou poucos números) e vai para o bot',
    (texto) => {
      expect(decidir({ texto })).toEqual(IGNORAR);
    },
  );
});

describe('podeSerDoCheckin (filtro barato antes de consultar o banco)', () => {
  it.each(['PARAR', 'voltar', '4 3 5 4 4 2', '435442', '4 3 5 4', 'Parar.'])('%s pode ser do check-in', (t) => {
    expect(podeSerDoCheckin(t)).toBe(true);
  });

  it.each(['Oi', '8', '10', '12', '4 5', '4 3 5', '12/11/2026', '91 98765 4321', '', '   ', null, undefined, 'quero parar'])('%j é conversa comum', (t) => {
    expect(podeSerDoCheckin(t)).toBe(false);
  });

  it('é coerente com a decisão: o que o filtro barra a decisão também ignora', () => {
    for (const texto of ['Oi', '8', '10', '12', '4 5', 'quero parar', 'bom dia, tudo bem?']) {
      expect(podeSerDoCheckin(texto)).toBe(false);
      expect(decidir({ texto, whatsappDesligado: true })).toEqual(IGNORAR);
    }
  });
});

it('a mensagem de falha na gravação é a combinada', () => {
  expect(montarFalhaGravacao()).toBe('Não consegui registrar agora, tente de novo em instantes.');
});

// ───────────── Elegibilidade e lote ─────────────

const cand = (c: Partial<CandidatoCheckin & { id: string }> = {}): CandidatoCheckin & { id: string } => ({
  id: 'p1',
  ativo: true,
  telefone: '(91) 98765-4321',
  whatsappAtivo: null,
  pedidoNaSemana: false,
  respondeuNaSemana: false,
  errosNaSemana: 0,
  ...c,
});

describe('elegivelParaPedido', () => {
  it('cliente ativo, com telefone, sem opt-out, sem pedido e sem resposta na semana é elegível', () => {
    expect(elegivelParaPedido(cand())).toBe(true);
  });

  it('preferência explícita de manter o lembrete (true) também é elegível', () => {
    expect(elegivelParaPedido(cand({ whatsappAtivo: true }))).toBe(true);
  });

  it.each([
    ['inativo', { ativo: false }],
    ['ativo desconhecido', { ativo: null }],
    ['sem telefone', { telefone: null }],
    ['telefone vazio', { telefone: '' }],
    ['telefone curto', { telefone: '12345' }],
    ['telefone só com máscara', { telefone: '() -' }],
    ['opt-out (PARAR)', { whatsappAtivo: false }],
    ['já tem pedido nesta semana', { pedidoNaSemana: true }],
    ['já respondeu nesta semana', { respondeuNaSemana: true }],
    ['atingiu o limite de erros na semana', { errosNaSemana: MAX_ERROS_POR_SEMANA }],
  ])('não é elegível: %s', (_motivo, parcial) => {
    expect(elegivelParaPedido(cand(parcial as Partial<CandidatoCheckin>))).toBe(false);
  });

  it('um ou dois erros na semana ainda deixam tentar de novo na próxima rodada', () => {
    expect(elegivelParaPedido(cand({ errosNaSemana: 1 }))).toBe(true);
    expect(elegivelParaPedido(cand({ errosNaSemana: MAX_ERROS_POR_SEMANA - 1 }))).toBe(true);
  });

  it('errosNaSemana ausente conta como zero', () => {
    expect(elegivelParaPedido(cand({ errosNaSemana: undefined }))).toBe(true);
  });
});

describe('telefones', () => {
  it.each([
    ['(91) 98765-4321', true],
    ['91987654321', true],
    ['5591987654321', true],
    ['(91) 3333-4444', true],
    ['9198765', false],
    ['', false],
    [null, false],
    ['559198765432100000', false],
  ])('telefoneValidoParaEnvio(%j) = %s', (tel, esperado) => {
    expect(telefoneValidoParaEnvio(tel as string | null)).toBe(esperado);
  });

  it('acrescenta o 55 só quando o cadastro não tem código do país', () => {
    expect(telefoneParaEnvio('(91) 98765-4321')).toBe('5591987654321');
    expect(telefoneParaEnvio('(91) 3333-4444')).toBe('559133334444');
    expect(telefoneParaEnvio('+55 91 98765-4321')).toBe('5591987654321');
    expect(telefoneParaEnvio('5591987654321')).toBe('5591987654321');
  });
});

describe('lote por profissional', () => {
  const muitos = (n: number) => Array.from({ length: n }, (_, i) => cand({ id: `p${i + 1}` }));

  it('o limite é 5 por profissional por rodada', () => {
    expect(LIMITE_LOTE_POR_PROFISSIONAL).toBe(5);
    expect(selecionarLote(muitos(12)).map((c) => c.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('com menos de 5 elegíveis, envia todos', () => {
    expect(selecionarLote(muitos(3))).toHaveLength(3);
    expect(selecionarLote([])).toEqual([]);
  });

  it('filtra antes de cortar: quem não é elegível não ocupa vaga no lote', () => {
    const lista = [
      cand({ id: 'a', ativo: false }),
      cand({ id: 'b', whatsappAtivo: false }),
      cand({ id: 'c', pedidoNaSemana: true }),
      cand({ id: 'd', respondeuNaSemana: true }),
      cand({ id: 'e', telefone: null }),
      ...muitos(6).map((c) => ({ ...c, id: `ok${c.id}` })),
    ];
    expect(filtrarElegiveis(lista)).toHaveLength(6);
    expect(selecionarLote(lista).map((c) => c.id)).toEqual(['okp1', 'okp2', 'okp3', 'okp4', 'okp5']);
  });

  it('quem já falhou vai para o fim da fila, para um número ruim não travar o lote', () => {
    const lista = [cand({ id: 'x', errosNaSemana: 2 }), cand({ id: 'y', errosNaSemana: 1 }), ...muitos(5)];
    const lote = selecionarLote(lista).map((c) => c.id);
    expect(lote).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(selecionarLote(lista, 7).map((c) => c.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'y', 'x']);
  });

  it('cortarLote não altera a lista original e respeita o máximo informado', () => {
    const lista = muitos(4);
    expect(cortarLote(lista, 2).map((c) => c.id)).toEqual(['p1', 'p2']);
    expect(cortarLote(lista, 0)).toEqual([]);
    expect(cortarLote(lista, -3)).toEqual([]);
    expect(lista.map((c) => c.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('três falhas seguidas interrompem o lote', () => {
    expect(FALHAS_SEGUIDAS_PARA_PARAR).toBe(3);
    expect(deveInterromperLote(0)).toBe(false);
    expect(deveInterromperLote(2)).toBe(false);
    expect(deveInterromperLote(3)).toBe(true);
    expect(deveInterromperLote(5)).toBe(true);
  });

  it('emBlocos divide listas grandes sem perder nem repetir ids', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    const blocos = emBlocos(ids, 100);
    expect(blocos.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(blocos.flat()).toEqual(ids);
    expect(emBlocos([], 100)).toEqual([]);
    expect(emBlocos(['a', 'b', 'c'], 0)).toEqual([['a'], ['b'], ['c']]);
  });
});

// ───────────── Janela de envio (domingo, 18h às 21h de Brasília) ─────────────

describe('dentroDaJanelaDeEnvio', () => {
  // 08/11/2026 é domingo. Brasília = UTC−3, então 18h BRT = 21h UTC.
  const em = (iso: string, opcoes?: { forcar?: boolean }) => dentroDaJanelaDeEnvio(new Date(iso), opcoes);

  it('domingo 17h59 está fora', () => {
    expect(em('2026-11-08T20:59:00Z')).toBe(false);
  });

  it('domingo 18h00 está dentro', () => {
    expect(em('2026-11-08T21:00:00Z')).toBe(true);
  });

  it('domingo 20h59 está dentro', () => {
    expect(em('2026-11-08T23:59:59Z')).toBe(true);
  });

  it('domingo 21h00 está fora (já é segunda em UTC)', () => {
    expect(em('2026-11-09T00:00:00Z')).toBe(false);
    expect(em('2026-11-09T00:30:00Z')).toBe(false);
  });

  it('segunda e sábado no mesmo horário estão fora', () => {
    expect(em('2026-11-09T21:30:00Z')).toBe(false);
    expect(em('2026-11-07T21:30:00Z')).toBe(false);
  });

  it('domingo de manhã e de madrugada estão fora', () => {
    expect(em('2026-11-08T11:00:00Z')).toBe(false);
    expect(em('2026-11-08T03:00:00Z')).toBe(false);
    expect(em('2026-11-08T00:30:00Z')).toBe(false);
  });

  it('forcar: true vence qualquer horário; outros valores não', () => {
    expect(em('2026-11-10T14:00:00Z', { forcar: true })).toBe(true);
    expect(em('2026-11-10T14:00:00Z', { forcar: false })).toBe(false);
    expect(em('2026-11-10T14:00:00Z', {})).toBe(false);
    expect(em('2026-11-10T14:00:00Z', { forcar: 'true' as unknown as boolean })).toBe(false);
  });

  it('sem argumentos usa a hora atual', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-08T22:00:00Z'));
      expect(dentroDaJanelaDeEnvio()).toBe(true);
      vi.setSystemTime(new Date('2026-11-09T22:00:00Z'));
      expect(dentroDaJanelaDeEnvio()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('o pedido enviado no domingo à noite pertence à semana que começou na segunda anterior', () => {
    expect(inicioDaSemanaBR(new Date('2026-11-08T21:00:00Z'))).toBe('2026-11-02');
    expect(inicioDaSemanaBR(new Date('2026-11-08T23:50:00Z'))).toBe('2026-11-02');
  });
});

describe('prazos e pausa', () => {
  it('a pausa entre envios fica entre 4 e 9 segundos', () => {
    expect(pausaEntreEnvios(() => 0)).toBe(4000);
    expect(pausaEntreEnvios(() => 1)).toBe(9000);
    expect(pausaEntreEnvios(() => 0.5)).toBe(6500);
    expect(pausaEntreEnvios(() => -2)).toBe(4000);
    expect(pausaEntreEnvios(() => 7)).toBe(9000);
    for (let i = 0; i < 200; i++) {
      const p = pausaEntreEnvios();
      expect(p).toBeGreaterThanOrEqual(4000);
      expect(p).toBeLessThanOrEqual(9000);
    }
  });

  it('o pedido vale 48 horas', () => {
    expect(VALIDADE_PEDIDO_HORAS).toBe(48);
    expect(expiraEmDoPedido(new Date('2026-11-08T21:00:00Z'))).toBe('2026-11-10T21:00:00.000Z');
  });

  it('PARAR olha os últimos 30 dias de pedidos; a pergunta de treino olha 3 semanas', () => {
    expect(DIAS_PEDIDO_RECENTE).toBe(30);
    expect(limiteDoPedidoRecente(new Date('2026-11-08T21:00:00Z'))).toBe('2026-10-09T21:00:00.000Z');
    expect(inicioDaJanelaDeTreino(new Date('2026-11-08T21:00:00Z'))).toBe('2026-10-18T21:00:00.000Z');
  });

  it('o início da semana vira segunda 00:00 de Brasília (03:00 UTC)', () => {
    expect(instanteDoInicioDaSemana('2026-11-02')).toBe('2026-11-02T03:00:00.000Z');
  });
});

describe('link do MyID', () => {
  it('o domínio é o mesmo dos links públicos do app', () => {
    expect(URL_BASE_APP).toBe(CANONICAL_URL);
  });

  it('usa o link pessoal do portal do cliente', () => {
    expect(linkMyIDDoCliente('abc123')).toBe(`${CANONICAL_URL}/portaldocliente/abc123`);
    expect(linkMyIDDoCliente('  abc123  ')).toBe(`${CANONICAL_URL}/portaldocliente/abc123`);
    expect(linkMyIDDoCliente('a b/c')).toBe(`${CANONICAL_URL}/portaldocliente/a%20b%2Fc`);
  });

  it('sem token cai no site: o pedido do MyID nunca some', () => {
    expect(linkMyIDDoCliente(null)).toBe(CANONICAL_URL);
    expect(linkMyIDDoCliente('')).toBe(CANONICAL_URL);
    expect(linkMyIDDoCliente('   ')).toBe(CANONICAL_URL);
  });

  it('quem já concluiu o MyID não recebe o link; quem não concluiu sempre recebe', () => {
    expect(linkMyIDSeFaltar(true, 'abc')).toBeNull();
    expect(linkMyIDSeFaltar(false, 'abc')).toBe(`${CANONICAL_URL}/portaldocliente/abc`);
    expect(linkMyIDSeFaltar(false, null)).toBe(CANONICAL_URL);
  });

  it('a rota do portal existe no app', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    expect(app).toContain('path="/portaldocliente/:token"');
  });
});

// ───────────── Migração do agendamento ─────────────

describe('migração do cron', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20261102150100_cron_checkin_semanal.sql'),
    'utf8',
  );

  it('só age quando o schema cron existe e desagenda o job de mesmo nome antes de agendar', () => {
    expect(sql).toMatch(/to_regnamespace\('cron'\) IS NOT NULL/i);
    const iUnschedule = sql.indexOf("cron.unschedule(jobname)");
    const iSchedule = sql.indexOf("cron.schedule(");
    expect(iUnschedule).toBeGreaterThan(-1);
    expect(iSchedule).toBeGreaterThan(iUnschedule);
    expect(sql).toMatch(/WHERE jobname = 'zap-checkin-semanal'/);
    expect(sql).toMatch(/cron\.schedule\(\s*'zap-checkin-semanal'/);
    expect(sql.indexOf("to_regnamespace")).toBeLessThan(iUnschedule);
  });

  it('chama a função certa com o segredo do cron', () => {
    expect(sql).toContain('/functions/v1/zap-checkin-semanal');
    expect(sql).toContain("name = 'cron_secret'");
  });

  it('roda aos domingos, a cada 10 minutos, e cada disparo cai dentro da janela de envio', () => {
    const m = sql.match(/'(\*\/10 21-23 \* \* 0)'/);
    expect(m).not.toBeNull();
    const [minutos, horas, , , diaSemana] = m![1].split(' ');
    expect(minutos).toBe('*/10');
    expect(diaSemana).toBe('0');
    const [h0, h1] = horas.split('-').map(Number);
    for (let hora = h0; hora <= h1; hora++) {
      for (let min = 0; min < 60; min += 10) {
        const instante = new Date(Date.UTC(2026, 10, 8, hora, min));
        expect(dentroDaJanelaDeEnvio(instante)).toBe(true);
      }
    }
    expect(dentroDaJanelaDeEnvio(new Date(Date.UTC(2026, 10, 8, h0 - 1, 50)))).toBe(false);
    expect(dentroDaJanelaDeEnvio(new Date(Date.UTC(2026, 10, 9, 0, 0)))).toBe(false);
  });

  it('é posterior à migração do banco do check-in', () => {
    expect('20261102150100' > '20261102150000').toBe(true);
  });
});

// ───────────── Edge Functions de verdade, com dublês ─────────────

const caminhoWebhook = '../../supabase/functions/whatsapp-webhook/index.ts';
const caminhoEnvio = '../../supabase/functions/zap-checkin-semanal/index.ts';

const consultasDe = (tabela: string, op?: string) =>
  h.estado.consultas.filter((q) => q.tabela === tabela && (op === undefined || q.op === op));

const chamada = (q: ConsultaFalsa, metodo: string, coluna: string) =>
  q.chamadas.find(([m, a]) => m === metodo && a[0] === coluna)?.[1][1];

const textosEnviados = () => h.enviar.mock.calls.map((c) => String(c[3]));

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.ultimoHandler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  vi.stubGlobal('fetch', h.fetch);
  await import(/* @vite-ignore */ caminhoWebhook);
  h.handlers.webhook = h.ultimoHandler!;
  await import(/* @vite-ignore */ caminhoEnvio);
  h.handlers.envio = h.ultimoHandler!;
});

beforeEach(() => {
  h.env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico' };
  h.enviar.mockReset();
  h.enviar.mockImplementation(async () => true);
  h.registrar.mockReset();
  h.registrar.mockImplementation(async () => undefined);
  h.entregar.mockReset();
  h.fetch.mockReset();
  h.fetch.mockImplementation(() => Promise.resolve(new Response('{}')));
  h.estado = h.novoEstado();
  h.pausas = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('whatsapp-webhook: interceptação do check-in', () => {
  interface Cenario {
    paciente: { id: string; nome: string } | null;
    pedido: { semana: string } | null;
    recentes: number;
    pref: { whatsapp_ativo: boolean } | null;
    concluidos: number;
    portalToken: string | null;
    erroTabela: string | null;
    erroUpsert: boolean;
    rpcErro: string | null;
    rpcLanca: boolean;
  }

  let c: Cenario;
  let seq = 0;

  beforeEach(() => {
    c = {
      paciente: { id: 'P1', nome: 'Ana' },
      pedido: { semana: '2026-11-02' },
      recentes: 1,
      pref: null,
      concluidos: 0,
      portalToken: 'tok-ana',
      erroTabela: null,
      erroUpsert: false,
      rpcErro: null,
      rpcLanca: false,
    };
    h.estado.responder = (q) => {
      if (c.erroTabela === q.tabela) return { data: null, error: { message: 'relation does not exist' }, count: null };
      switch (q.tabela) {
        case 'config_clinica':
          return { data: { terapeuta_id: 'T1' } };
        case 'whatsapp_conversas':
          return q.op === 'select' ? { data: { id: 'C1' } } : undefined;
        case 'whatsapp_mensagens_inbox':
          if (q.op !== 'select') return undefined;
          return chamada(q, 'eq', 'conversa_id') ? { data: { id: 'M1' } } : undefined;
        case 'checkin_pedidos': {
          const contagem = q.chamadas.some(([m, a]) => m === 'select' && (a[1] as { head?: boolean } | undefined)?.head);
          return contagem ? { count: c.recentes } : { data: c.pedido };
        }
        case 'checkin_preferencias':
          if (q.op === 'upsert') return { error: c.erroUpsert ? { message: 'sem permissao' } : null };
          return { data: c.pref };
        case 'myid_avaliacoes':
          return { count: c.concluidos };
        case 'pacientes':
          return { data: { portal_token: c.portalToken } };
        default:
          return undefined;
      }
    };
    h.estado.rpc = (nome, args) => {
      if (nome === 'paciente_por_telefone_norm') return { data: c.paciente ? [c.paciente] : [], error: null };
      if (nome === 'checkin_gravar') {
        if (c.rpcLanca) return Promise.reject(new Error('rede caiu'));
        return c.rpcErro ? { data: null, error: { message: c.rpcErro } } : { data: { semana: args.p_semana }, error: null };
      }
      return { data: null, error: null };
    };
  });

  async function receber(texto: string | null, extra: Record<string, unknown> = {}) {
    seq++;
    const corpo: Record<string, unknown> = { phone: '5591987654321', fromMe: false, messageId: `msg-${seq}`, ...extra };
    if (texto !== null) corpo.text = { message: texto };
    const res = await h.handlers.webhook(
      new Request('https://x.supabase.co/functions/v1/whatsapp-webhook?instanceId=INST', { method: 'POST', body: JSON.stringify(corpo) }),
    );
    return { status: res.status, corpo: (await res.json()) as Record<string, unknown> };
  }

  const botChamado = () => h.fetch.mock.calls.filter((cl) => String(cl[0]).includes('whatsapp-bot-reply')).length;
  const consultasDoCheckin = () =>
    h.estado.consultas.filter((q) => ['checkin_pedidos', 'checkin_preferencias'].includes(q.tabela)).length;

  it('resposta válida ao pedido: grava com a semana do pedido, confirma e NÃO chama o bot', async () => {
    const r = await receber('4 3 5 4 4 2');
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
    expect(botChamado()).toBe(0);
    expect(h.estado.rpcs.filter((x) => x.nome === 'checkin_gravar')).toEqual([{
      nome: 'checkin_gravar',
      args: {
        p_paciente: 'P1', p_semana: '2026-11-02', p_origem: 'whatsapp',
        p_fadiga: 4, p_sono: 3, p_dor_muscular: 5, p_estresse: 4, p_humor: 4, p_urina: 2, p_psr: null,
      },
    }]);
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(h.enviar.mock.calls[0].slice(1, 3)).toEqual(['T1', '5591987654321']);
    expect(textosEnviados()[0]).toContain('Anotei sua semana');
    expect(h.registrar).toHaveBeenCalledTimes(1);
    expect(h.registrar.mock.calls[0][1]).toMatchObject({
      terapeuta_id: 'T1', paciente_id: 'P1', telefone: '5591987654321', origem: 'checkin_semanal',
    });
  });

  it('7 números levam a recuperação do treino', async () => {
    await receber('4 3 5 4 4 2 8');
    const args = h.estado.rpcs.find((x) => x.nome === 'checkin_gravar')!.args;
    expect(args.p_psr).toBe(8);
  });

  it('cliente que ainda não concluiu o MyID recebe o link pessoal junto da confirmação', async () => {
    await receber('4 3 5 4 4 2');
    expect(textosEnviados()[0]).toContain(`${CANONICAL_URL}/portaldocliente/tok-ana`);
    expect(textosEnviados()[0]).toContain('MyID');
  });

  it('quem já concluiu o MyID não recebe o link', async () => {
    c.concluidos = 1;
    await receber('4 3 5 4 4 2');
    expect(textosEnviados()[0]).toContain('Anotei sua semana');
    expect(textosEnviados()[0]).not.toContain('myhealthid.com.br');
  });

  it('se a consulta do MyID falhar, o pedido do MyID continua na mensagem', async () => {
    c.erroTabela = 'myid_avaliacoes';
    await receber('4 3 5 4 4 2');
    expect(textosEnviados()[0]).toContain('portaldocliente/tok-ana');
  });

  it('pedido já respondido ainda vale: reenviar os números corrige a resposta', async () => {
    await receber('4 3 5 4 4 2');
    await receber('5 3 5 4 4 2');
    const gravacoes = h.estado.rpcs.filter((x) => x.nome === 'checkin_gravar');
    expect(gravacoes).toHaveLength(2);
    expect(gravacoes[1].args.p_fadiga).toBe(5);
    const consulta = consultasDe('checkin_pedidos').find((q) => !q.chamadas.some(([m, a]) => m === 'select' && (a[1] as { head?: boolean } | undefined)?.head))!;
    expect(chamada(consulta, 'gt', 'expira_em')).toBeDefined();
    expect(consulta.chamadas.some(([m, a]) => m === 'is' && a[0] === 'respondido_em')).toBe(false);
  });

  it('resposta mal formada: manda a ajuda e não chama o bot nem grava', async () => {
    const r = await receber('4 3 5 4');
    expect(r.corpo.checkin).toBe(true);
    expect(botChamado()).toBe(0);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
    expect(textosEnviados()[0]).toContain('Não consegui ler sua resposta do check-in');
    expect(h.registrar.mock.calls[0][1]).toMatchObject({ origem: 'checkin_semanal' });
  });

  it('falha ao gravar: avisa o cliente e considera tratada (o bot não interpreta os números)', async () => {
    c.rpcErro = 'checkin_valor_invalido';
    const r = await receber('4 3 5 4 4 2');
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
    expect(botChamado()).toBe(0);
    expect(textosEnviados()).toEqual([montarFalhaGravacao()]);
  });

  it('exceção ao gravar (rede) também avisa o cliente e não derruba o webhook', async () => {
    c.rpcLanca = true;
    const r = await receber('4 3 5 4 4 2');
    expect(r.status).toBe(200);
    expect(r.corpo.checkin).toBe(true);
    expect(botChamado()).toBe(0);
    expect(textosEnviados()).toEqual([montarFalhaGravacao()]);
  });

  it('se o envio da confirmação falhar, a resposta já está gravada e o webhook segue de pé', async () => {
    h.enviar.mockImplementation(async () => false);
    const r = await receber('4 3 5 4 4 2');
    expect(r.status).toBe(200);
    expect(r.corpo.checkin).toBe(true);
    expect(h.estado.rpcs.filter((x) => x.nome === 'checkin_gravar')).toHaveLength(1);
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it('resposta numérica SEM pedido em aberto segue para o bot', async () => {
    c.pedido = null;
    const r = await receber('4 3 5 4 4 2');
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1' });
    expect(botChamado()).toBe(1);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('conversa comum não consulta as tabelas do check-in e segue para o bot', async () => {
    const r = await receber('Oi, quero remarcar minha sessão');
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1' });
    expect(botChamado()).toBe(1);
    expect(consultasDoCheckin()).toBe(0);
  });

  it.each(['9', '10', '0'])('nota de NPS (%s) não é capturada pelo check-in', async (nota) => {
    const r = await receber(nota);
    expect(r.corpo.checkin).toBeUndefined();
    expect(botChamado()).toBe(1);
    expect(consultasDoCheckin()).toBe(0);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
  });

  it('PARAR com pedido recente: desliga o lembrete, confirma e não chama o bot', async () => {
    const r = await receber('PARAR');
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
    expect(botChamado()).toBe(0);
    const up = consultasDe('checkin_preferencias', 'upsert');
    expect(up).toHaveLength(1);
    expect(up[0].payload).toMatchObject({ paciente_id: 'P1', whatsapp_ativo: false });
    expect(textosEnviados()[0]).toContain('não vai mais receber o check-in');
    expect(h.registrar.mock.calls[0][1]).toMatchObject({ origem: 'checkin_semanal' });
  });

  it('PARAR sem pedido nos últimos 30 dias é conversa normal: vai para o bot e não grava preferência', async () => {
    c.recentes = 0;
    c.pedido = null;
    const r = await receber('PARAR');
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1' });
    expect(botChamado()).toBe(1);
    expect(consultasDe('checkin_preferencias', 'upsert')).toHaveLength(0);
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('o pedido vale até expirar e o PARAR olha 30 dias: os dois limites são consultados com a hora atual', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
      await receber('PARAR');
    } finally {
      vi.useRealTimers();
    }
    const consultas = consultasDe('checkin_pedidos');
    const contagem = consultas.find((q) => q.chamadas.some(([m, a]) => m === 'select' && (a[1] as { head?: boolean } | undefined)?.head))!;
    expect(chamada(contagem, 'gte', 'enviado_em')).toBe('2026-10-10T12:00:00.000Z');
    const vigente = consultas.find((q) => q !== contagem)!;
    expect(chamada(vigente, 'gt', 'expira_em')).toBe('2026-11-09T12:00:00.000Z');
    expect(chamada(vigente, 'eq', 'paciente_id')).toBe('P1');
  });

  it('sem a tabela de preferências, a resposta ao pedido ainda é gravada (a preferência só decide o VOLTAR)', async () => {
    c.erroTabela = 'checkin_preferencias';
    const r = await receber('4 3 5 4 4 2');
    expect(r.corpo.checkin).toBe(true);
    expect(h.estado.rpcs.filter((x) => x.nome === 'checkin_gravar')).toHaveLength(1);
    expect(botChamado()).toBe(0);
  });

  it('VOLTAR com o lembrete desligado: liga de novo e confirma', async () => {
    c.pref = { whatsapp_ativo: false };
    const r = await receber('voltar');
    expect(r.corpo.checkin).toBe(true);
    expect(botChamado()).toBe(0);
    const up = consultasDe('checkin_preferencias', 'upsert');
    expect(up[0].payload).toMatchObject({ paciente_id: 'P1', whatsapp_ativo: true });
    expect(textosEnviados()[0]).toContain('volta a receber o check-in');
  });

  it('VOLTAR com o lembrete ligado é conversa normal', async () => {
    c.pref = { whatsapp_ativo: true };
    const r = await receber('voltar');
    expect(r.corpo.checkin).toBeUndefined();
    expect(botChamado()).toBe(1);
    expect(consultasDe('checkin_preferencias', 'upsert')).toHaveLength(0);
  });

  it('PARAR: se a preferência não for gravada, o cliente é avisado em vez de receber uma confirmação falsa', async () => {
    c.erroUpsert = true;
    await receber('PARAR');
    expect(textosEnviados()).toEqual([montarFalhaGravacao()]);
  });

  it('cliente não cadastrado nunca passa pelo check-in', async () => {
    c.paciente = null;
    const r = await receber('4 3 5 4 4 2');
    expect(r.corpo.checkin).toBeUndefined();
    expect(botChamado()).toBe(1);
    expect(consultasDoCheckin()).toBe(0);
  });

  it('mensagem do próprio número (fromMe) nunca passa pelo check-in', async () => {
    const r = await receber('4 3 5 4 4 2', { fromMe: true });
    expect(r.corpo.checkin).toBeUndefined();
    expect(consultasDoCheckin()).toBe(0);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
  });

  it('áudio e imagem nunca passam pelo check-in', async () => {
    const audio = await receber(null, { audio: { audioUrl: 'https://x/a.ogg' } });
    expect(audio.corpo.checkin).toBeUndefined();
    const imagem = await receber(null, { image: { imageUrl: 'https://x/i.jpg', caption: '4 3 5 4 4 2' } });
    expect(imagem.corpo.checkin).toBeUndefined();
    expect(consultasDoCheckin()).toBe(0);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
  });

  it('banco sem as tabelas do check-in (migração ainda não aplicada): tudo segue como conversa normal', async () => {
    c.erroTabela = 'checkin_pedidos';
    const r = await receber('4 3 5 4 4 2');
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1' });
    expect(botChamado()).toBe(1);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
  });

  it('mensagem duplicada (mesmo messageId) é encerrada antes de qualquer tratamento', async () => {
    h.estado.responder = ((anterior) => (q: ConsultaFalsa) => {
      if (q.tabela === 'whatsapp_mensagens_inbox' && q.op === 'select' && !chamada(q, 'eq', 'conversa_id')) return { data: { id: 'ja' } };
      return anterior(q);
    })(h.estado.responder);
    const r = await receber('4 3 5 4 4 2');
    expect(r.corpo).toEqual({ ok: true, duplicado: true });
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
  });
});

describe('zap-checkin-semanal: envio de domingo à noite', () => {
  type Linha = Record<string, unknown>;

  interface CenarioEnvio {
    automacoes: Linha[];
    pacientes: Linha[];
    pedidos: Linha[];
    respostas: Linha[];
    prefs: Linha[];
    disparos: Linha[];
    treinos: Linha[];
    concluidos: Linha[];
    erroTabela: string | null;
    erroInsertPedido: boolean;
    envio: (telefone: string) => boolean;
  }

  let z: CenarioEnvio;
  let setTimeoutOriginal: typeof setTimeout;

  const cliente = (n: number, extra: Linha = {}): Linha => ({
    id: `c${n}`, nome: `Cliente ${n}`, telefone: `(91) 98765-43${String(n).padStart(2, '0')}`,
    portal_token: `tok-c${n}`, terapeuta_id: 'T1', ativo: true, ...extra,
  });

  const ligado = (id: string, extra: Linha = {}): Linha => ({
    terapeuta_id: id, gatilhos_ativos: { checkin_semanal: true }, automacoes_pausadas: false, ...extra,
  });

  const SEMANA = '2026-11-02';
  const DOMINGO_18H30 = new Date('2026-11-08T21:30:00Z');

  beforeEach(() => {
    z = {
      automacoes: [ligado('T1')],
      pacientes: Array.from({ length: 7 }, (_, i) => cliente(i + 1)),
      pedidos: [], respostas: [], prefs: [], disparos: [], treinos: [], concluidos: [],
      erroTabela: null, erroInsertPedido: false, envio: () => true,
    };
    h.estado.responder = (q) => {
      if (z.erroTabela === q.tabela) return { data: null, error: { message: 'falhou' } };
      const aplicar = (linhas: Linha[]) => {
        let r = linhas;
        for (const [m, a] of q.chamadas) {
          if (m === 'eq') r = r.filter((l) => !(String(a[0]) in l) || l[String(a[0])] === a[1]);
          if (m === 'in') r = r.filter((l) => (a[1] as unknown[]).includes(l[String(a[0])]));
          if (m === 'not' && a[1] === 'is' && a[2] === null) r = r.filter((l) => l[String(a[0])] != null);
        }
        return r;
      };
      switch (q.tabela) {
        case 'whatsapp_automacoes':
          return { data: z.automacoes };
        case 'pacientes': {
          const [de, ate] = (q.chamadas.find(([m]) => m === 'range')?.[1] as number[] | undefined) || [0, 99999];
          return { data: aplicar(z.pacientes).slice(de, ate + 1) };
        }
        case 'checkin_pedidos':
          if (q.op === 'insert') {
            if (z.erroInsertPedido) return { error: { message: 'duplicate key' } };
            z.pedidos.push({ ...(q.payload as Linha) });
            return { error: null };
          }
          return { data: aplicar(z.pedidos) };
        case 'checkins_semanais':
          return { data: aplicar(z.respostas) };
        case 'checkin_preferencias':
          return { data: aplicar(z.prefs) };
        case 'agente_disparos':
          if (q.op === 'insert') {
            z.disparos.push({ ...(q.payload as Linha) });
            return { error: null };
          }
          return { data: aplicar(z.disparos) };
        case 'studio_execucoes':
          return { data: aplicar(z.treinos) };
        case 'myid_avaliacoes':
          return { data: aplicar(z.concluidos) };
        default:
          return undefined;
      }
    };
    h.enviar.mockImplementation(async (_admin: unknown, _t: unknown, telefone: string) => z.envio(String(telefone)));
    setTimeoutOriginal = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void, ms?: number) => {
      h.pausas.push(Number(ms));
      fn();
      return 0;
    }) as unknown as typeof setTimeout;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(DOMINGO_18H30);
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.setTimeout = setTimeoutOriginal;
  });

  async function rodar(corpo: unknown = {}, headers: Record<string, string> = { Authorization: 'Bearer chave-de-servico' }) {
    const res = await h.handlers.envio(
      new Request('https://x.supabase.co/functions/v1/zap-checkin-semanal', {
        method: 'POST', headers, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
      }),
    );
    return { status: res.status, corpo: (await res.json()) as Record<string, unknown> };
  }

  const pedidosInseridos = () => consultasDe('checkin_pedidos', 'insert').map((q) => q.payload as Linha);
  const disparosInseridos = () => consultasDe('agente_disparos', 'insert').map((q) => q.payload as Linha);

  it('exige chamada interna (cron ou service role)', async () => {
    const r = await rodar({}, {});
    expect(r.status).toBe(403);
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('fora da janela não faz nada e nem consulta o banco', async () => {
    vi.setSystemTime(new Date('2026-11-09T14:00:00Z'));
    const r = await rodar();
    expect(r.corpo).toEqual({ ok: true, fora_da_janela: true });
    expect(h.estado.consultas).toHaveLength(0);
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('domingo às 17h59 ainda está fora; às 18h00 já envia', async () => {
    vi.setSystemTime(new Date('2026-11-08T20:59:00Z'));
    expect((await rodar()).corpo.fora_da_janela).toBe(true);
    vi.setSystemTime(new Date('2026-11-08T21:00:00Z'));
    const r = await rodar();
    expect(r.corpo.fora_da_janela).toBeUndefined();
    expect(r.corpo.enviados).toBe(5);
  });

  it('{ forcar: true } envia fora da janela; corpo inválido não derruba', async () => {
    vi.setSystemTime(new Date('2026-11-10T14:00:00Z'));
    const r = await rodar({ forcar: true });
    expect(r.corpo.enviados).toBe(5);
    expect(pedidosInseridos()[0].semana).toBe('2026-11-09');
    expect((await rodar('isto não é json')).corpo.fora_da_janela).toBe(true);
  });

  it('envia no máximo 5 por profissional e registra pedido, conversa e disparo de cada envio', async () => {
    const r = await rodar();
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: true, semana: SEMANA, profissionais: 1, candidatos: 7, elegiveis: 7, enviados: 5, falhas: 0, adiados: 2 });
    expect(h.enviar).toHaveBeenCalledTimes(5);
    expect(h.enviar.mock.calls.map((cl) => cl[2])).toEqual([
      '5591987654301', '5591987654302', '5591987654303', '5591987654304', '5591987654305',
    ]);

    const pedidos = pedidosInseridos();
    expect(pedidos).toHaveLength(5);
    for (const p of pedidos) {
      expect(p.semana).toBe(SEMANA);
      expect(p.expira_em).toBe('2026-11-10T21:30:00.000Z');
    }
    expect(pedidos.map((p) => p.paciente_id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);

    expect(h.registrar).toHaveBeenCalledTimes(5);
    for (const cl of h.registrar.mock.calls) {
      expect(cl[1]).toMatchObject({ terapeuta_id: 'T1', origem: 'checkin_semanal' });
    }

    const disparos = disparosInseridos();
    expect(disparos).toHaveLength(5);
    for (const d of disparos) expect(d).toMatchObject({ terapeuta_id: 'T1', gatilho: 'checkin_semanal', status: 'enviado', ref_id: null });
  });

  it('pausa de 4 a 9 segundos entre os envios, nunca antes do primeiro', async () => {
    await rodar();
    expect(h.pausas).toHaveLength(4);
    for (const p of h.pausas) {
      expect(p).toBeGreaterThanOrEqual(4000);
      expect(p).toBeLessThanOrEqual(9000);
    }
  });

  it('próxima rodada (10 minutos depois) manda para os que ficaram de fora e depois não manda mais nada', async () => {
    await rodar();
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    const segunda = await rodar();
    expect(segunda.corpo).toMatchObject({ enviados: 2, elegiveis: 2, adiados: 0 });
    expect(z.pedidos.map((p) => p.paciente_id).sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
    vi.setSystemTime(new Date('2026-11-08T21:50:00Z'));
    const terceira = await rodar();
    expect(terceira.corpo).toMatchObject({ enviados: 0, elegiveis: 0 });
    expect(h.enviar).toHaveBeenCalledTimes(7);
  });

  it('não pede a quem não é elegível', async () => {
    z.pacientes = [
      cliente(1, { ativo: false }),
      cliente(2, { telefone: null }),
      cliente(3),
      cliente(4),
      cliente(5),
      cliente(6),
      cliente(7, { terapeuta_id: 'T2' }),
    ];
    z.prefs = [{ paciente_id: 'c3', whatsapp_ativo: false }];
    z.pedidos = [{ paciente_id: 'c4', semana: SEMANA }, { paciente_id: 'c6', semana: '2026-10-26' }];
    z.respostas = [{ paciente_id: 'c5', semana: SEMANA }];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ candidatos: 4, elegiveis: 1, enviados: 1 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c6']);
  });

  it('envio registrado sem pedido (a gravação do pedido falhou) não é repetido', async () => {
    z.disparos = [{ terapeuta_id: 'T1', paciente_id: 'c1', gatilho: 'checkin_semanal', status: 'enviado' }];
    z.pacientes = [cliente(1)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ elegiveis: 0, enviados: 0 });
  });

  it('cliente com 3 erros na semana sai da fila e não trava os demais', async () => {
    z.disparos = Array.from({ length: 3 }, () => ({ terapeuta_id: 'T1', paciente_id: 'c1', gatilho: 'checkin_semanal', status: 'erro' }));
    z.pacientes = Array.from({ length: 6 }, (_, i) => cliente(i + 1));
    const r = await rodar();
    expect(r.corpo).toMatchObject({ candidatos: 6, elegiveis: 5, enviados: 5 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).not.toContain('c1');
  });

  it('só ligam o gatilho os profissionais que escolheram; pausa geral também vale', async () => {
    z.automacoes = [
      ligado('T1'),
      { terapeuta_id: 'T2', gatilhos_ativos: { checkin_semanal: false }, automacoes_pausadas: false },
      { terapeuta_id: 'T3', gatilhos_ativos: { progresso_semanal: true }, automacoes_pausadas: false },
      { terapeuta_id: 'T4', gatilhos_ativos: {}, automacoes_pausadas: false },
      { terapeuta_id: 'T5', gatilhos_ativos: { checkin_semanal: 'true' }, automacoes_pausadas: false },
      ligado('T6', { automacoes_pausadas: true }),
    ];
    z.pacientes = [
      cliente(1), cliente(2, { terapeuta_id: 'T2' }), cliente(3, { terapeuta_id: 'T3' }),
      cliente(4, { terapeuta_id: 'T4' }), cliente(5, { terapeuta_id: 'T5' }), cliente(6, { terapeuta_id: 'T6' }),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ profissionais: 2, enviados: 1, pausados: 1 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c1']);
  });

  it('o limite de 5 é por profissional', async () => {
    z.automacoes = [ligado('T1'), ligado('T2')];
    z.pacientes = [
      ...Array.from({ length: 6 }, (_, i) => cliente(i + 1)),
      ...Array.from({ length: 6 }, (_, i) => cliente(i + 11, { terapeuta_id: 'T2' })),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ profissionais: 2, enviados: 10, adiados: 2 });
    const porProfissional = h.enviar.mock.calls.reduce<Record<string, number>>((acc, cl) => {
      acc[String(cl[1])] = (acc[String(cl[1])] || 0) + 1;
      return acc;
    }, {});
    expect(porProfissional).toEqual({ T1: 5, T2: 5 });
  });

  it('texto do pedido: nome, pergunta de recuperação só para quem treinou e link do MyID só para quem não concluiu', async () => {
    z.pacientes = [cliente(1), cliente(2), cliente(3)];
    z.treinos = [{ paciente_id: 'c1' }];
    z.concluidos = [{ paciente_id: 'c2', status: 'concluido' }];
    await rodar();
    const [m1, m2, m3] = textosEnviados();
    expect(m1).toContain('Oi Cliente!');
    expect(m1).toContain('até 7 números');
    expect(m1).toContain('7) Opcional: recuperação do treino');
    expect(m2).toContain('Responda com 6 números');
    expect(m2).not.toContain('7)');
    expect(m3).toContain('Responda com 6 números');
    expect(m1).toContain(`${CANONICAL_URL}/portaldocliente/tok-c1`);
    expect(m2).not.toContain('myhealthid.com.br');
    expect(m3).toContain(`${CANONICAL_URL}/portaldocliente/tok-c3`);
    for (const m of [m1, m2, m3]) expect(m).toContain('PARAR');
  });

  it('a consulta de treino olha 3 semanas e só dos clientes do lote', async () => {
    await rodar();
    const q = consultasDe('studio_execucoes')[0];
    expect(chamada(q, 'gte', 'data_execucao')).toBe('2026-10-18T21:30:00.000Z');
    expect(chamada(q, 'in', 'paciente_id')).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('sem a tabela de treino ou do MyID, o envio segue com o texto padrão (e o link do MyID)', async () => {
    z.erroTabela = 'studio_execucoes';
    z.pacientes = [cliente(1)];
    const r = await rodar();
    expect(r.corpo.enviados).toBe(1);
    expect(textosEnviados()[0]).toContain('Responda com 6 números');
    expect(textosEnviados()[0]).toContain('portaldocliente/tok-c1');
  });

  it('falha de envio: registra erro, NÃO cria pedido nem mensagem na conversa', async () => {
    z.envio = () => false;
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 0, falhas: 2 });
    expect(pedidosInseridos()).toHaveLength(0);
    expect(h.registrar).not.toHaveBeenCalled();
    expect(disparosInseridos().map((d) => d.status)).toEqual(['erro', 'erro']);
  });

  it('falha em um só não impede os outros', async () => {
    z.envio = (tel) => !tel.endsWith('02');
    z.pacientes = [cliente(1), cliente(2), cliente(3)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 2, falhas: 1 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c1', 'c3']);
    expect(disparosInseridos().map((d) => d.status)).toEqual(['enviado', 'erro', 'enviado']);
  });

  it('três falhas seguidas (WhatsApp desconectado) interrompem o lote e o resto fica para a próxima rodada', async () => {
    z.envio = () => false;
    const r = await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(3);
    expect(r.corpo).toMatchObject({ enviados: 0, falhas: 3, elegiveis: 7, adiados: 4 });
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    z.envio = () => true;
    const segunda = await rodar();
    expect(segunda.corpo).toMatchObject({ enviados: 5 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c4', 'c5', 'c6', 'c7', 'c1']);
  });

  it('exceção no envio conta como falha e não derruba a rodada', async () => {
    h.enviar.mockImplementationOnce(async () => { throw new Error('rede'); });
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ enviados: 1, falhas: 1 });
  });

  it('pedido que não grava não impede a mensagem na conversa nem o disparo (e o envio não se repete)', async () => {
    z.erroInsertPedido = true;
    z.pacientes = [cliente(1)];
    const r = await rodar();
    expect(r.corpo.enviados).toBe(1);
    expect(h.registrar).toHaveBeenCalledTimes(1);
    expect(disparosInseridos()[0].status).toBe('enviado');
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    expect((await rodar()).corpo.enviados).toBe(0);
  });

  it('consulta de controle indisponível (migração não aplicada): ninguém recebe, para não repetir a cada rodada', async () => {
    for (const tabela of ['checkin_pedidos', 'checkins_semanais', 'checkin_preferencias', 'agente_disparos']) {
      h.enviar.mockClear();
      z.erroTabela = tabela;
      const r = await rodar();
      expect(r.status).toBe(200);
      expect(r.corpo).toMatchObject({ enviados: 0, com_erro_de_consulta: 1 });
      expect(h.enviar).not.toHaveBeenCalled();
    }
  });

  it('listas grandes de clientes são consultadas em blocos de 100 ids', async () => {
    z.pacientes = Array.from({ length: 230 }, (_, i) => cliente(i + 1, { telefone: `(91) 98${String(10000 + i)}` }));
    await rodar();
    const consultasPedidos = consultasDe('checkin_pedidos', 'select');
    expect(consultasPedidos.map((q) => (chamada(q, 'in', 'paciente_id') as string[]).length)).toEqual([100, 100, 30]);
  });

  it('falha ao ler a configuração devolve erro 500 sem enviar nada', async () => {
    z.erroTabela = 'whatsapp_automacoes';
    const r = await rodar();
    expect(r.status).toBe(500);
    expect(r.corpo.ok).toBe(false);
    expect(h.enviar).not.toHaveBeenCalled();
  });
});

// ───────────── Tela de automações ─────────────

describe('WhatsappAutomacoes: gatilho do check-in semanal', () => {
  const configuracao = (gatilhos: Record<string, boolean>) => ({
    terapeuta_id: 'T1',
    automacoes_pausadas: false,
    bot_ativo: false,
    dias_semana: ['seg'],
    gatilhos_ativos: gatilhos,
    palavras_escalonamento: [],
  });

  const padrao = { confirmacao_24h: true, lembrete_2h: true, pos_sessao: true, aniversario: true };

  async function abrirGatilhos(gatilhos: Record<string, boolean>) {
    h.tela = h.novoEstado();
    h.tela.responder = (q) => {
      if (q.tabela === 'whatsapp_automacoes' && q.op === 'select') return { data: configuracao(gatilhos) };
      return undefined;
    };
    render(createElement(WhatsappAutomacoes, { embedded: true }));
    const aba = await screen.findByRole('tab', { name: 'Gatilhos' });
    fireEvent.mouseDown(aba, { button: 0, ctrlKey: false });
    return screen.findByText('Check-in semanal 🌿');
  }

  const interruptorDe = (rotulo: HTMLElement) => within(rotulo.parentElement!.parentElement as HTMLElement).getByRole('switch');

  afterEach(() => cleanup());

  it('aparece na lista com a descrição combinada', async () => {
    const rotulo = await abrirGatilhos(padrao);
    expect(rotulo.parentElement).toHaveTextContent(
      'Domingo à noite: pede 6 números (fadiga, sono, dor muscular, estresse, humor e urina) e mostra a evolução no perfil do cliente.',
    );
  });

  it('nasce DESLIGADO por padrão, como os outros gatilhos de adesão (opt-in)', async () => {
    const rotulo = await abrirGatilhos(padrao);
    expect(interruptorDe(rotulo)).toHaveAttribute('aria-checked', 'false');
    expect(interruptorDe(screen.getByText('Progresso semanal 🏆'))).toHaveAttribute('aria-checked', 'false');
    expect(interruptorDe(screen.getByText('Confirmação 24h antes'))).toHaveAttribute('aria-checked', 'true');
  });

  it('só liga com true explícito', async () => {
    const rotulo = await abrirGatilhos({ ...padrao, checkin_semanal: true });
    expect(interruptorDe(rotulo)).toHaveAttribute('aria-checked', 'true');
  });

  it('ligar e salvar grava checkin_semanal: true junto dos demais gatilhos', async () => {
    const rotulo = await abrirGatilhos(padrao);
    fireEvent.click(interruptorDe(rotulo));
    expect(interruptorDe(rotulo)).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar automações' }));
    await waitFor(() => expect(h.tela.consultas.some((q) => q.tabela === 'whatsapp_automacoes' && q.op === 'upsert')).toBe(true));
    const gravado = h.tela.consultas.find((q) => q.tabela === 'whatsapp_automacoes' && q.op === 'upsert')!.payload as {
      gatilhos_ativos: Record<string, boolean>;
    };
    expect(gravado.gatilhos_ativos).toEqual({ ...padrao, checkin_semanal: true });
  });
});
