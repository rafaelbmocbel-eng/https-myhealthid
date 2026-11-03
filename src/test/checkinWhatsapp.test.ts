import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_URL } from '@/utils/linkUrls';
import {
  DIAS_PEDIDO_RECENTE,
  FALHAS_SEGUIDAS_PARA_PARAR,
  JANELA_ENVIO_BR,
  LIMITE_LOTE_POR_PROFISSIONAL,
  MAX_ERROS_POR_SEMANA,
  URL_BASE_APP,
  VALIDADE_PEDIDO_HORAS,
  chaveDoTelefone,
  chavesDeTelefoneCompartilhado,
  contarPuladosPorTelefoneCompartilhado,
  cortarLote,
  decidirAcaoDaMensagem,
  dentroDaJanelaDeEnvio,
  deveInterromperLote,
  ehConflitoDeReserva,
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
import { inicioDaSemanaBR, montarAjudaCheckin } from '../../supabase/functions/_shared/checkin-semanal';
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
    'Marcado para o dia 12 às 14h e 30 min',
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

  it.each([
    'pare', 'Pare!', 'sair', 'SAIR', 'stop', 'Stop.', 'descadastrar', 'Descadastrar!',
    'não quero mais receber', 'Nao quero mais receber', 'não quero mais receber mensagens',
    'parar por favor', 'Por favor, parar', 'pare pfv', 'parar 🙏', '🛑 PARAR', 'sair, obrigado',
  ])('variação de saída %j com pedido recente também desliga o lembrete', (texto) => {
    expect(decidir({ texto })).toEqual({ acao: 'parar' });
    expect(podeSerDoCheckin(texto)).toBe(true);
  });

  it.each(['pare', 'sair', 'stop', 'descadastrar', 'não quero mais receber', 'parar por favor', 'PARAR'])(
    'variação de saída %j SEM pedido nos últimos 30 dias é conversa normal (vai ao bot)',
    (texto) => {
      expect(decidir({ texto, recebeuPedidoRecente: false })).toEqual(IGNORAR);
      expect(decidir({ texto, recebeuPedidoRecente: false, pedidoAberto: null })).toEqual(IGNORAR);
    },
  );

  it.each(['quero sair mais cedo hoje', 'não quero mais receber essa cobrança', 'vou parar de fumar', 'pare de me ligar'])(
    'frase maior que contém a palavra de saída (%j) continua sendo conversa',
    (texto) => {
      expect(decidir({ texto })).toEqual(IGNORAR);
    },
  );

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

  it.each(['👍 4 3 5 4 4 2', '4 3 5 4 4 2 😊', '4 😴 3 😬 5 4 4 2 🙏', '🌿4 3 5 4 4 2🌿'])('emoji junto dos números não atrapalha: %s', (texto) => {
    expect(decidir({ texto })).toEqual({
      acao: 'gravar',
      semana: SEMANA_PEDIDO,
      valores: { fadiga: 4, sono: 3, dor_muscular: 5, estresse: 4, humor: 4, urina: 2, psr: null },
    });
  });

  it.each(['4,5 3 5 4 4 2', '4 3,5 5 4 4 2', '4 3 5 4 4 2.5', '3.5 4 4 4 4 2'])(
    'decimal ambíguo (%s) com pedido em aberto pede ajuda e NUNCA grava',
    (texto) => {
      const r = decidir({ texto }) as Extract<AcaoCheckin, { acao: 'ajuda' }>;
      expect(r.acao).toBe('ajuda');
      expect(r.motivo).toBe('ambiguo');
      expect(podeSerDoCheckin(texto)).toBe(true);
    },
  );

  it.each(['Oi! 4 3 5 4 4 2', '4 3 5 4 4 2 mais ou menos', 'Bom dia, 1) 4 2) 3 3) 5 4) 4 5) 4 6) 2', 'minha semana: 4 3 5 4 4 2 obrigada'])(
    'texto misturado que começa com 5 números de 1 a 5 (%j) pede ajuda com pedido em aberto',
    (texto) => {
      const r = decidir({ texto }) as Extract<AcaoCheckin, { acao: 'ajuda' }>;
      expect(r.acao).toBe('ajuda');
      expect(r.motivo).toBe('nao_numerico');
      expect(podeSerDoCheckin(texto)).toBe(true);
    },
  );

  it.each(['4,5 3 5 4 4 2', 'Oi! 4 3 5 4 4 2', '4 3 5 4 4 2 mais ou menos', '3.5 4 4 4 4 2'])(
    'SEM pedido em aberto, ambíguo e texto misturado (%j) não são tratados: vão para o bot',
    (texto) => {
      expect(decidir({ texto, pedidoAberto: null })).toEqual(IGNORAR);
      expect(decidir({ texto, pedidoAberto: null, recebeuPedidoRecente: false })).toEqual(IGNORAR);
    },
  );

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
  it.each([
    'PARAR', 'voltar', '4 3 5 4 4 2', '435442', '4 3 5 4', 'Parar.',
    'pare', 'sair', 'stop', 'descadastrar', 'não quero mais receber', 'parar por favor',
    '👍 4 3 5 4 4 2', '4,5 3 5 4 4 2', 'Oi! 4 3 5 4 4 2',
  ])('%s pode ser do check-in', (t) => {
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
    ['telefone fixo', { telefone: '(91) 3333-4444' }],
    ['celular de 9 dígitos que não começa com 9', { telefone: '(91) 88765-4321' }],
    ['conta excluída pelo cliente (vinculo_encerrado_em)', { vinculoEncerradoEm: '2026-10-30T12:00:00.000Z' }],
    ['telefone compartilhado com outra ficha ativa', { telefoneCompartilhado: true }],
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

  it('vínculo ainda ativo (null ou ausente) e telefone não compartilhado continuam elegíveis', () => {
    expect(elegivelParaPedido(cand({ vinculoEncerradoEm: null }))).toBe(true);
    expect(elegivelParaPedido(cand({ vinculoEncerradoEm: undefined }))).toBe(true);
    expect(elegivelParaPedido(cand({ telefoneCompartilhado: false }))).toBe(true);
    expect(elegivelParaPedido(cand({ telefoneCompartilhado: undefined }))).toBe(true);
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
    ['+55 91 98765-4321', true],
    ['(55) 99123-4567', true],
    ['(91) 8765-4321', true],
    ['(91) 3333-4444', false],
    ['(91) 2333-4444', false],
    ['(91) 4333-4444', false],
    ['(91) 5333-4444', false],
    ['9133334444', false],
    ['559133334444', false],
    ['+55 (91) 3333-4444', false],
    ['(55) 3123-4567', false],
    ['(91) 88765-4321', false],
    ['(91) 38765-4321', false],
    ['5591887654321', false],
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

describe('telefone compartilhado', () => {
  it('a chave são os últimos 10 dígitos, com ou sem máscara e código do país', () => {
    for (const t of ['(91) 98765-4321', '91987654321', '5591987654321', '+55 91 98765-4321', '  91 9 8765 4321 ']) {
      expect(chaveDoTelefone(t)).toBe('1987654321');
    }
    expect(chaveDoTelefone(null)).toBe('');
    expect(chaveDoTelefone(undefined)).toBe('');
    expect(chaveDoTelefone('() -')).toBe('');
  });

  it('só marca o número que aparece em 2 ou mais fichas, em qualquer formato', () => {
    const marcados = chavesDeTelefoneCompartilhado([
      { telefone: '(91) 98765-4321' },
      { telefone: '5591987654321' },
      { telefone: '(91) 98888-0000' },
      { telefone: '(91) 97777-1111' },
      { telefone: '91977771111' },
      { telefone: '+55 91 97777-1111' },
    ]);
    expect([...marcados].sort()).toEqual(['1977771111', '1987654321']);
  });

  it('ficha sem telefone nunca forma grupo', () => {
    expect(chavesDeTelefoneCompartilhado([{ telefone: null }, { telefone: '' }, { telefone: '() -' }, { telefone: undefined }]).size).toBe(0);
    expect(chavesDeTelefoneCompartilhado([]).size).toBe(0);
  });

  it('conta só quem ficou de fora POR causa do telefone compartilhado', () => {
    const lista = [
      cand({ id: 'a', telefoneCompartilhado: true }),
      cand({ id: 'b', telefoneCompartilhado: true }),
      cand({ id: 'c', telefoneCompartilhado: true, whatsappAtivo: false }),
      cand({ id: 'd', telefoneCompartilhado: true, respondeuNaSemana: true }),
      cand({ id: 'e', telefoneCompartilhado: true, vinculoEncerradoEm: '2026-10-30T12:00:00.000Z' }),
      cand({ id: 'f', telefoneCompartilhado: true, ativo: false }),
      cand({ id: 'g' }),
      cand({ id: 'h', pedidoNaSemana: true }),
    ];
    expect(contarPuladosPorTelefoneCompartilhado(lista)).toBe(2);
    expect(contarPuladosPorTelefoneCompartilhado([])).toBe(0);
    expect(filtrarElegiveis(lista).map((c) => c.id)).toEqual(['g']);
  });
});

describe('reserva do pedido', () => {
  it.each([
    [{ code: '23505', message: 'qualquer texto' }, true],
    [{ message: 'duplicate key value violates unique constraint "checkin_pedidos_paciente_id_semana_key"' }, true],
    [{ message: 'duplicate key' }, true],
    [{ code: '42501', message: 'permission denied for table checkin_pedidos' }, false],
    [{ code: '42P01', message: 'relation "checkin_pedidos" does not exist' }, false],
    [{ message: '' }, false],
    [null, false],
    [undefined, false],
  ])('ehConflitoDeReserva(%j) = %s', (erro, esperado) => {
    expect(ehConflitoDeReserva(erro)).toBe(esperado);
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

// ───────────── Janela de envio (domingo, 18h30 às 21h de Brasília) ─────────────

describe('dentroDaJanelaDeEnvio', () => {
  // 08/11/2026 é domingo. Brasília = UTC−3, então 18h30 BRT = 21h30 UTC.
  const em = (iso: string, opcoes?: { forcar?: boolean }) => dentroDaJanelaDeEnvio(new Date(iso), opcoes);

  it('a janela é de domingo, das 18h30 (inclusive) às 21h00 (exclusive) de Brasília', () => {
    expect(JANELA_ENVIO_BR).toEqual({ diaSemana: 0, inicioMinutos: 18 * 60 + 30, fimMinutos: 21 * 60 });
  });

  it('domingo 18h00, o horário do progresso semanal, está fora', () => {
    expect(em('2026-11-08T21:00:00Z')).toBe(false);
    expect(em('2026-11-08T21:15:00Z')).toBe(false);
  });

  it('domingo 18h29 está fora e 18h30 está dentro', () => {
    expect(em('2026-11-08T21:29:59Z')).toBe(false);
    expect(em('2026-11-08T21:30:00Z')).toBe(true);
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
    expect(inicioDaSemanaBR(new Date('2026-11-08T21:30:00Z'))).toBe('2026-11-02');
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
  const progresso = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260713050000_cron_progresso_semanal.sql'),
    'utf8',
  );

  // Expande um campo simples do cron (lista "30,40,50", intervalo "22-23", passo "*/10") nos valores que ele dispara.
  const expandir = (campo: string, limite: number): number[] => {
    if (campo.startsWith('*/')) {
      const passo = Number(campo.slice(2));
      return Array.from({ length: Math.ceil(limite / passo) }, (_, i) => i * passo);
    }
    return campo.split(',').flatMap((parte) => {
      const [de, ate] = parte.split('-').map(Number);
      return ate === undefined ? [de] : Array.from({ length: ate - de + 1 }, (_, i) => de + i);
    });
  };

  const agendas = [...sql.matchAll(/cron\.schedule\(\s*'([^']+)',\s*'([^']+)'/g)].map((m) => ({ job: m[1], expressao: m[2] }));

  // Todos os instantes de UTC em que a expressão dispara no domingo 08/11/2026.
  const disparosNoDomingo = (expressao: string): Date[] => {
    const [minutos, horas, diaMes, mes, diaSemana] = expressao.split(' ');
    expect([diaMes, mes, diaSemana]).toEqual(['*', '*', '0']);
    return expandir(horas, 24).flatMap((hora) => expandir(minutos, 60).map((min) => new Date(Date.UTC(2026, 10, 8, hora, min))));
  };

  it('só age quando o schema cron existe e desagenda os jobs de mesmo nome antes de agendar', () => {
    expect(sql).toMatch(/to_regnamespace\('cron'\) IS NOT NULL/i);
    const iUnschedule = sql.indexOf('cron.unschedule(jobname)');
    const iSchedule = sql.indexOf('cron.schedule(');
    expect(iUnschedule).toBeGreaterThan(-1);
    expect(iSchedule).toBeGreaterThan(iUnschedule);
    expect(sql).toMatch(/WHERE jobname IN \('zap-checkin-semanal', 'zap-checkin-semanal-noite'\)/);
    expect(sql.indexOf('to_regnamespace')).toBeLessThan(iUnschedule);
  });

  it('chama a função certa com o segredo do cron', () => {
    expect(sql).toContain('/functions/v1/zap-checkin-semanal');
    expect(sql).toContain("name = 'cron_secret'");
  });

  it('o net.http_post espera até 120 s (o padrão de 5 s estoura em rodadas com várias mensagens)', () => {
    expect(sql).toMatch(/net\.http_post\([\s\S]*timeout_milliseconds := 120000\s*\)/);
    expect(sql).not.toMatch(/timeout_milliseconds := (?!120000)\d+/);
  });

  it('são dois jobs de domingo: 21:30, 21:40 e 21:50 UTC, e a cada 10 minutos de 22:00 a 23:50 UTC', () => {
    expect(agendas).toEqual([
      { job: 'zap-checkin-semanal', expressao: '30,40,50 21 * * 0' },
      { job: 'zap-checkin-semanal-noite', expressao: '*/10 22-23 * * 0' },
    ]);
    expect(sql.match(/cron\.schedule\(/g)).toHaveLength(2);
  });

  it('todo disparo cai dentro da janela de envio, são 15 rodadas e a última é às 20h50 de Brasília', () => {
    const disparos = agendas.flatMap((a) => disparosNoDomingo(a.expressao)).sort((x, y) => x.getTime() - y.getTime());
    expect(disparos).toHaveLength(15);
    expect(disparos.length * LIMITE_LOTE_POR_PROFISSIONAL).toBe(75);
    for (const d of disparos) expect(dentroDaJanelaDeEnvio(d)).toBe(true);
    expect(disparos[0].toISOString()).toBe('2026-11-08T21:30:00.000Z');
    expect(disparos[disparos.length - 1].toISOString()).toBe('2026-11-08T23:50:00.000Z');
    const emDezMinutos = disparos.slice(1).map((d, i) => d.getTime() - disparos[i].getTime());
    expect(new Set(emDezMinutos)).toEqual(new Set([10 * 60000]));
    expect(dentroDaJanelaDeEnvio(new Date(disparos[0].getTime() - 10 * 60000))).toBe(false);
    expect(dentroDaJanelaDeEnvio(new Date(disparos[disparos.length - 1].getTime() + 10 * 60000))).toBe(false);
  });

  it('nenhum disparo cai no mesmo minuto do progresso semanal (domingo 21:00 UTC)', () => {
    expect(progresso).toContain("'0 21 * * 0'");
    const minutoDoProgresso = Date.UTC(2026, 10, 8, 21, 0);
    for (const a of agendas) {
      for (const d of disparosNoDomingo(a.expressao)) expect(d.getTime()).toBeGreaterThanOrEqual(minutoDoProgresso + 30 * 60000);
    }
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
      terapeuta_id: 'T1', paciente_id: 'P1', telefone: '5591987654321', origem: 'checkin_semanal', bot: true,
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
    expect(h.registrar.mock.calls[0][1]).toMatchObject({ origem: 'checkin_semanal', bot: true });
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
    expect(h.registrar.mock.calls[0][1]).toMatchObject({ origem: 'checkin_semanal', bot: true });
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

  it.each([
    ['confirmação da resposta', '4 3 5 4 4 2', () => undefined],
    ['ajuda por quantidade', '4 3 5 4', () => undefined],
    ['ajuda por faixa', '4 3 5 4 9 2', () => undefined],
    ['ajuda por decimal ambíguo', '4,5 3 5 4 4 2', () => undefined],
    ['ajuda por texto misturado', 'Oi! 4 3 5 4 4 2', () => undefined],
    ['confirmação do PARAR', 'PARAR', () => undefined],
    ['confirmação do VOLTAR', 'VOLTAR', () => { c.pref = { whatsapp_ativo: false }; }],
    ['falha ao gravar a resposta', '4 3 5 4 4 2', () => { c.rpcErro = 'checkin_valor_invalido'; }],
    ['falha ao gravar o PARAR', 'PARAR', () => { c.erroUpsert = true; }],
    ['exceção ao gravar a resposta', '4 3 5 4 4 2', () => { c.rpcLanca = true; }],
  ])('toda saída do check-in leva bot: true, para o bot de IA não ficar mudo por 30 min (%s)', async (_nome, texto, preparar) => {
    preparar();
    const r = await receber(texto);
    expect(r.corpo.checkin).toBe(true);
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(h.registrar).toHaveBeenCalledTimes(1);
    expect(h.registrar.mock.calls[0][1]).toMatchObject({ origem: 'checkin_semanal', bot: true, paciente_id: 'P1', conteudo: textosEnviados()[0] });
  });

  it.each(['👍 4 3 5 4 4 2', '4 3 5 4 4 2 😊', '4 😴 3 😬 5 4 4 2 🙏'])('emoji junto dos números (%s): grava e confirma sem chamar o bot', async (texto) => {
    const r = await receber(texto);
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
    expect(botChamado()).toBe(0);
    expect(h.estado.rpcs.filter((x) => x.nome === 'checkin_gravar')).toHaveLength(1);
    expect(textosEnviados()[0]).toContain('Anotei sua semana');
  });

  it.each(['4,5 3 5 4 4 2', '3.5 4 4 4 4 2'])('decimal ambíguo (%s) com pedido vigente: manda a ajuda, não grava e NÃO chama o bot', async (texto) => {
    const r = await receber(texto);
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
    expect(botChamado()).toBe(0);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
    expect(textosEnviados()).toEqual([montarAjudaCheckin('ambiguo', 'vírgula ou ponto junto dos números pode ser meio ponto')]);
    expect(textosEnviados()[0]).toContain('meio ponto');
  });

  it.each(['Oi! 4 3 5 4 4 2', '4 3 5 4 4 2 mais ou menos'])('texto misturado (%s) com pedido vigente: manda a ajuda, não grava e NÃO chama o bot', async (texto) => {
    const r = await receber(texto);
    expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
    expect(botChamado()).toBe(0);
    expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
    expect(textosEnviados()).toEqual([montarAjudaCheckin('nao_numerico', 'a resposta tem letras ou símbolos')]);
  });

  it.each(['4,5 3 5 4 4 2', 'Oi! 4 3 5 4 4 2', '4 3 5 4 4 2 mais ou menos', '4 3 5 4 4 2'])(
    'SEM pedido vigente, %j não é tratado pelo check-in: vai para o bot, sem ajuda nem gravação',
    async (texto) => {
      c.pedido = null;
      const r = await receber(texto);
      expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1' });
      expect(botChamado()).toBe(1);
      expect(h.enviar).not.toHaveBeenCalled();
      expect(h.registrar).not.toHaveBeenCalled();
      expect(h.estado.rpcs.some((x) => x.nome === 'checkin_gravar')).toBe(false);
    },
  );

  it.each(['pare', 'Sair', 'STOP', 'descadastrar', 'não quero mais receber', 'Parar por favor', 'parar 🙏'])(
    'saída por %j com pedido recente: desliga o lembrete do check-in, confirma e NÃO chama o bot',
    async (texto) => {
      const r = await receber(texto);
      expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1', checkin: true });
      expect(botChamado()).toBe(0);
      const up = consultasDe('checkin_preferencias', 'upsert');
      expect(up).toHaveLength(1);
      expect(up[0].payload).toMatchObject({ paciente_id: 'P1', whatsapp_ativo: false });
      expect(textosEnviados()[0]).toContain('não vai mais receber o check-in semanal');
    },
  );

  it.each(['pare', 'Sair', 'STOP', 'descadastrar', 'não quero mais receber', 'Parar por favor'])(
    'saída por %j SEM pedido nos últimos 30 dias é conversa normal: vai para o bot e não grava preferência',
    async (texto) => {
      c.recentes = 0;
      c.pedido = null;
      const r = await receber(texto);
      expect(r.corpo).toEqual({ ok: true, conversa_id: 'C1' });
      expect(botChamado()).toBe(1);
      expect(consultasDe('checkin_preferencias', 'upsert')).toHaveLength(0);
      expect(h.enviar).not.toHaveBeenCalled();
    },
  );

  it('a confirmação do PARAR diz com clareza que desligou o lembrete DO CHECK-IN e como voltar', async () => {
    await receber('PARAR');
    expect(textosEnviados()[0]).toContain('não vai mais receber o check-in semanal');
    expect(textosEnviados()[0]).toContain('VOLTAR');
  });

  it('o bot de IA só fica mudo para saída SEM metadata.bot: a regra continua no whatsapp-bot-reply', () => {
    const bot = readFileSync(resolve(__dirname, '../../supabase/functions/whatsapp-bot-reply/index.ts'), 'utf8');
    expect(bot).toContain('!ultSaida.metadata?.bot');
    expect(bot).toContain('30 * 60 * 1000');
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
    /** Erro do insert da reserva que NÃO é conflito (permissão, tabela ausente). */
    erroInsertPedido: boolean;
    erroDeletePedido: boolean;
    erroInsertDisparo: boolean;
    /** Clientes que outra execução reservou entre a leitura e a reserva. */
    conflitos: Set<string>;
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
      erroTabela: null, erroInsertPedido: false, erroDeletePedido: false, erroInsertDisparo: false, conflitos: new Set(), envio: () => true,
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
            const linha = q.payload as Linha;
            if (z.erroInsertPedido) return { error: { code: '42501', message: 'permission denied for table checkin_pedidos' } };
            const repetida = z.conflitos.has(String(linha.paciente_id))
              || z.pedidos.some((p) => p.paciente_id === linha.paciente_id && p.semana === linha.semana);
            if (repetida) {
              return { error: { code: '23505', message: 'duplicate key value violates unique constraint "checkin_pedidos_paciente_id_semana_key"' } };
            }
            z.pedidos.push({ ...linha });
            return { error: null };
          }
          if (q.op === 'delete') {
            if (z.erroDeletePedido) return { error: { message: 'falhou ao apagar' } };
            const alvo = (coluna: string) => q.chamadas.find(([m, a]) => m === 'eq' && a[0] === coluna)?.[1][1];
            z.pedidos = z.pedidos.filter((p) => !(p.paciente_id === alvo('paciente_id') && p.semana === alvo('semana')));
            return { error: null };
          }
          return { data: aplicar(z.pedidos) };
        case 'checkins_semanais':
          return { data: aplicar(z.respostas) };
        case 'checkin_preferencias':
          return { data: aplicar(z.prefs) };
        case 'agente_disparos':
          if (q.op === 'insert') {
            if (z.erroInsertDisparo) return { error: { message: 'falhou ao gravar' } };
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
  const reservasRemovidas = () => consultasDe('checkin_pedidos', 'delete');
  const disparosInseridos = () => consultasDe('agente_disparos', 'insert').map((q) => q.payload as Linha);
  const idDoTelefone = (telefone: unknown) => `c${Number(String(telefone).slice(-2))}`;

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

  it('domingo às 18h00 (hora do progresso semanal) e às 18h29 estão fora; às 18h30 já envia', async () => {
    vi.setSystemTime(new Date('2026-11-08T21:00:00Z'));
    expect((await rodar()).corpo.fora_da_janela).toBe(true);
    vi.setSystemTime(new Date('2026-11-08T21:29:59Z'));
    expect((await rodar()).corpo.fora_da_janela).toBe(true);
    expect(h.enviar).not.toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-11-08T21:30:00Z'));
    const r = await rodar();
    expect(r.corpo.fora_da_janela).toBeUndefined();
    expect(r.corpo.enviados).toBe(5);
  });

  it('domingo às 20h59 ainda envia e às 21h00 já está fora', async () => {
    vi.setSystemTime(new Date('2026-11-09T00:00:00Z'));
    expect((await rodar()).corpo.fora_da_janela).toBe(true);
    vi.setSystemTime(new Date('2026-11-08T23:59:00Z'));
    expect((await rodar()).corpo.enviados).toBe(5);
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
    expect(r.corpo).toMatchObject({
      ok: true, semana: SEMANA, profissionais: 1, candidatos: 7, elegiveis: 7, enviados: 5, falhas: 0, adiados: 2,
      pulados_telefone_compartilhado: 0, ja_reservados: 0, erros_de_reserva: 0,
    });
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
      expect(cl[1]).toMatchObject({ terapeuta_id: 'T1', origem: 'checkin_semanal', bot: true });
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

  it('quem excluiu a própria conta (vinculo_encerrado_em) continua ativo na ficha, mas NÃO recebe', async () => {
    z.pacientes = [
      cliente(1, { vinculo_encerrado_em: '2026-10-30T12:00:00.000Z', user_id: null, portal_token: null }),
      cliente(2, { vinculo_encerrado_em: null }),
      cliente(3),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ candidatos: 3, elegiveis: 2, enviados: 2 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c2', 'c3']);
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c2', 'c3']);
    expect(disparosInseridos().map((d) => d.paciente_id)).toEqual(['c2', 'c3']);
  });

  it('a consulta das fichas pede a coluna vinculo_encerrado_em e não depende do filtro do banco para excluí-las', async () => {
    await rodar();
    const consulta = consultasDe('pacientes')[0];
    const colunas = String(consulta.chamadas.find(([m]) => m === 'select')![1][0]);
    expect(colunas).toContain('vinculo_encerrado_em');
    expect(colunas).toContain('portal_token');
    expect(consulta.chamadas.some(([m, a]) => m === 'is' && a[0] === 'vinculo_encerrado_em')).toBe(false);
  });

  it('conta excluída não ocupa vaga no lote de 5', async () => {
    z.pacientes = [
      ...Array.from({ length: 3 }, (_, i) => cliente(i + 1, { vinculo_encerrado_em: '2026-10-30T12:00:00.000Z' })),
      ...Array.from({ length: 5 }, (_, i) => cliente(i + 4)),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ elegiveis: 5, enviados: 5, adiados: 0 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c4', 'c5', 'c6', 'c7', 'c8']);
  });

  it('telefone compartilhado (mãe e filho): nenhuma das fichas ativas com o mesmo número recebe, e o retorno conta quantos foram pulados', async () => {
    z.pacientes = [
      cliente(1, { telefone: '(91) 98765-4321' }),
      cliente(2, { telefone: '91987654321' }),
      cliente(3, { telefone: '+55 91 98765-4321' }),
      cliente(4, { telefone: '(91) 98888-0004' }),
      cliente(5, { telefone: '(91) 97777-0005' }),
      cliente(6, { telefone: '(91) 97777-0005' }),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ candidatos: 6, elegiveis: 1, enviados: 1, pulados_telefone_compartilhado: 5 });
    expect(h.enviar.mock.calls.map((cl) => cl[2])).toEqual(['5591988880004']);
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c4']);
    expect(z.pedidos.map((p) => p.paciente_id)).toEqual(['c4']);
  });

  it('o telefone compartilhado é comparado pelos últimos 10 dígitos, em qualquer formato do cadastro', async () => {
    z.pacientes = [
      cliente(1, { telefone: '(91) 98765-4321' }),
      cliente(2, { telefone: '5591987654321' }),
      cliente(3),
    ];
    z.pacientes[2].telefone = '(91) 98111-2222';
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 1, pulados_telefone_compartilhado: 2 });
    expect(h.enviar.mock.calls.map((cl) => cl[2])).toEqual(['5591981112222']);
  });

  it('o compartilhamento é a cada rodada: nenhum dos dois é tentado nem na rodada seguinte', async () => {
    z.pacientes = [cliente(1, { telefone: '(91) 98765-4321' }), cliente(2, { telefone: '(91) 98765-4321' })];
    await rodar();
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 0, pulados_telefone_compartilhado: 2 });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(pedidosInseridos()).toHaveLength(0);
  });

  it('só conta o compartilhamento entre fichas ATIVAS: a ficha inativa com o mesmo número não bloqueia', async () => {
    z.pacientes = [
      cliente(1, { telefone: '(91) 98765-4321', ativo: false }),
      cliente(2, { telefone: '(91) 98765-4321' }),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ candidatos: 1, enviados: 1, pulados_telefone_compartilhado: 0 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c2']);
  });

  it('a ficha de conta excluída com o mesmo número também conta como compartilhada (a resposta poderia cair nela)', async () => {
    z.pacientes = [
      cliente(1, { telefone: '(91) 98765-4321', vinculo_encerrado_em: '2026-10-30T12:00:00.000Z' }),
      cliente(2, { telefone: '(91) 98765-4321' }),
      cliente(3),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 1, pulados_telefone_compartilhado: 1 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c3']);
  });

  it('dois profissionais podem ter o mesmo número em fichas diferentes: o compartilhamento é por profissional', async () => {
    z.automacoes = [ligado('T1'), ligado('T2')];
    z.pacientes = [
      cliente(1, { telefone: '(91) 98765-4321' }),
      cliente(2, { telefone: '(91) 98765-4321', terapeuta_id: 'T2' }),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ profissionais: 2, enviados: 2, pulados_telefone_compartilhado: 0 });
  });

  it('número compartilhado fica de fora e não ocupa vaga: os 5 do lote são de números só de uma ficha', async () => {
    z.pacientes = [
      cliente(1, { telefone: '(91) 98765-4321' }),
      cliente(2, { telefone: '(91) 98765-4321' }),
      cliente(3, { telefone: '(91) 98765-4333' }),
      cliente(4, { telefone: '(91) 98765-4333' }),
      ...Array.from({ length: 6 }, (_, i) => cliente(i + 5)),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ elegiveis: 6, enviados: 5, adiados: 1, pulados_telefone_compartilhado: 4 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c5', 'c6', 'c7', 'c8', 'c9']);
  });

  it('telefone fixo e celular de 9 dígitos que não começa com 9 não recebem (nem gastam vaga)', async () => {
    z.pacientes = [
      cliente(1, { telefone: '(91) 3333-4444' }),
      cliente(2, { telefone: '(91) 88765-4321' }),
      cliente(3),
    ];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ candidatos: 3, elegiveis: 1, enviados: 1 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c3']);
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

  it('falha de envio: a reserva é removida, registra erro e NÃO cria mensagem na conversa', async () => {
    z.envio = () => false;
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 0, falhas: 2 });
    expect(pedidosInseridos().map((p) => p.paciente_id)).toEqual(['c1', 'c2']);
    expect(z.pedidos).toEqual([]);
    expect(reservasRemovidas()).toHaveLength(2);
    expect(h.registrar).not.toHaveBeenCalled();
    expect(disparosInseridos().map((d) => d.status)).toEqual(['erro', 'erro']);
  });

  it('a reserva removida é só a do cliente que falhou, daquela semana e ainda sem resposta', async () => {
    z.envio = (tel) => !tel.endsWith('02');
    z.pacientes = [cliente(1), cliente(2), cliente(3)];
    await rodar();
    const [remocao] = reservasRemovidas();
    expect(reservasRemovidas()).toHaveLength(1);
    expect(chamada(remocao, 'eq', 'paciente_id')).toBe('c2');
    expect(chamada(remocao, 'eq', 'semana')).toBe(SEMANA);
    expect(remocao.chamadas.some(([m, a]) => m === 'is' && a[0] === 'respondido_em' && a[1] === null)).toBe(true);
    expect(z.pedidos.map((p) => p.paciente_id)).toEqual(['c1', 'c3']);
  });

  it('falha em um só não impede os outros', async () => {
    z.envio = (tel) => !tel.endsWith('02');
    z.pacientes = [cliente(1), cliente(2), cliente(3)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 2, falhas: 1 });
    expect(z.pedidos.map((p) => p.paciente_id)).toEqual(['c1', 'c3']);
    expect(disparosInseridos().map((d) => d.status)).toEqual(['enviado', 'erro', 'enviado']);
  });

  it('quem falhou volta a ser tentado na rodada seguinte (e a reserva é refeita)', async () => {
    z.envio = () => false;
    z.pacientes = [cliente(1)];
    await rodar();
    expect(z.pedidos).toEqual([]);
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    z.envio = () => true;
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 1, falhas: 0 });
    expect(z.pedidos.map((p) => p.paciente_id)).toEqual(['c1']);
    expect(disparosInseridos().map((d) => d.status)).toEqual(['erro', 'enviado']);
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
    expect(z.pedidos.map((p) => p.paciente_id)).toEqual(['c4', 'c5', 'c6', 'c7', 'c1']);
  });

  it('exceção no envio conta como falha e não derruba a rodada', async () => {
    h.enviar.mockImplementationOnce(async () => { throw new Error('rede'); });
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ enviados: 1, falhas: 1 });
  });

  it('reserva o cliente ANTES de enviar: na hora do envio a reserva já existe', async () => {
    const reservadoNoEnvio: boolean[] = [];
    h.enviar.mockImplementation(async (_admin: unknown, _t: unknown, telefone: unknown) => {
      const id = idDoTelefone(telefone);
      reservadoNoEnvio.push(z.pedidos.some((p) => p.paciente_id === id && p.semana === SEMANA));
      return true;
    });
    await rodar();
    expect(reservadoNoEnvio).toEqual([true, true, true, true, true]);
  });

  it('reserva que não grava (erro que não é conflito): NÃO envia, conta o erro e o cliente fica para a próxima rodada', async () => {
    z.erroInsertPedido = true;
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 0, falhas: 0, erros_de_reserva: 2, ja_reservados: 0 });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.registrar).not.toHaveBeenCalled();
    expect(disparosInseridos()).toHaveLength(0);
    expect(h.pausas).toHaveLength(0);
    z.erroInsertPedido = false;
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    expect((await rodar()).corpo).toMatchObject({ enviados: 2, erros_de_reserva: 0 });
  });

  it('exceção ao reservar também não envia e não derruba a rodada', async () => {
    const consultaOriginal = h.estado.responder;
    h.estado.responder = (q) => {
      if (q.tabela === 'checkin_pedidos' && q.op === 'insert') throw new Error('rede caiu');
      return consultaOriginal(q);
    };
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ enviados: 0, erros_de_reserva: 2 });
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('conflito na reserva (outra execução já reservou): pula o cliente, sem enviar, sem mensagem e sem disparo', async () => {
    z.conflitos = new Set(['c2']);
    z.pacientes = [cliente(1), cliente(2), cliente(3)];
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 2, falhas: 0, ja_reservados: 1, erros_de_reserva: 0 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c1', 'c3']);
    expect(h.registrar.mock.calls.map((cl) => cl[1].paciente_id)).toEqual(['c1', 'c3']);
    expect(disparosInseridos().map((d) => d.paciente_id)).toEqual(['c1', 'c3']);
    expect(reservasRemovidas()).toHaveLength(0);
  });

  it('conflito não conta como falha de envio: três conflitos seguidos não interrompem o lote', async () => {
    z.conflitos = new Set(['c1', 'c2', 'c3']);
    const r = await rodar();
    expect(r.corpo).toMatchObject({ enviados: 2, falhas: 0, ja_reservados: 3 });
    expect(h.enviar.mock.calls.map((cl) => idDoTelefone(cl[2]))).toEqual(['c4', 'c5']);
  });

  it('não há pausa antes do primeiro envio de verdade, mesmo que os primeiros clientes tenham conflito', async () => {
    z.conflitos = new Set(['c1', 'c2']);
    z.pacientes = [cliente(1), cliente(2), cliente(3)];
    await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(h.pausas).toHaveLength(0);
  });

  it('duas execuções em paralelo (cron sobreposto): cada cliente recebe UM pedido só', async () => {
    const [a, b] = await Promise.all([rodar(), rodar()]);
    const telefones = h.enviar.mock.calls.map((cl) => String(cl[2]));
    expect(telefones).toHaveLength(5);
    expect(new Set(telefones).size).toBe(5);
    expect(z.pedidos.map((p) => p.paciente_id).sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    expect(Number(a.corpo.enviados) + Number(b.corpo.enviados)).toBe(5);
    expect(Number(a.corpo.ja_reservados) + Number(b.corpo.ja_reservados)).toBe(5);
    expect(z.disparos.filter((d) => d.status === 'enviado')).toHaveLength(5);
  });

  it('envio feito mas disparo não registrado (a execução caiu depois de enviar): a reserva impede o reenvio', async () => {
    z.erroInsertDisparo = true;
    z.pacientes = [cliente(1), cliente(2)];
    await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(2);
    h.enviar.mockClear();
    vi.setSystemTime(new Date('2026-11-08T21:40:00Z'));
    z.erroInsertDisparo = false;
    const r = await rodar();
    expect(r.corpo).toMatchObject({ elegiveis: 0, enviados: 0 });
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('se a reserva de um envio que falhou não puder ser removida, o disparo de erro ainda é registrado e a rodada segue', async () => {
    z.erroDeletePedido = true;
    z.envio = (tel) => !tel.endsWith('01');
    z.pacientes = [cliente(1), cliente(2)];
    const r = await rodar();
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ enviados: 1, falhas: 1 });
    expect(disparosInseridos().map((d) => d.status)).toEqual(['erro', 'enviado']);
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

// ───────────── Marca de bot na mensagem de saída ─────────────

describe('registrarMensagemSaida: bot só quando pedido', () => {
  type RegistrarSaida = (admin: unknown, opts: Record<string, unknown>) => Promise<void>;

  async function gravar(extra: Record<string, unknown>) {
    const { registrarMensagemSaida } = await vi.importActual<{ registrarMensagemSaida: RegistrarSaida }>(
      '../../supabase/functions/_shared/registrar-saida.ts',
    );
    const estado = h.novoEstado();
    estado.responder = (q) => (q.tabela === 'whatsapp_conversas' && q.op === 'select' ? { data: { id: 'C1', paciente_id: 'P1' } } : undefined);
    const admin = { from: (t: string) => h.criarCliente(estado).from(t) };
    await registrarMensagemSaida(admin, { terapeuta_id: 'T1', paciente_id: 'P1', telefone: '5591987654321', conteudo: 'oi', origem: 'checkin_semanal', ...extra });
    const insercao = estado.consultas.find((q) => q.tabela === 'whatsapp_mensagens_inbox' && q.op === 'insert')!;
    return insercao.payload as Record<string, unknown>;
  }

  it('com bot: true grava metadata { origem, bot: true } (o bot de IA não fica mudo por 30 min)', async () => {
    const linha = await gravar({ bot: true });
    expect(linha.metadata).toEqual({ origem: 'checkin_semanal', bot: true });
    expect(linha).toMatchObject({ direcao: 'saida', tipo: 'texto', status: 'enviada', conversa_id: 'C1', terapeuta_id: 'T1', conteudo: 'oi' });
  });

  it('sem o parâmetro (as outras automações) o comportamento é o de sempre: metadata { origem }', async () => {
    expect((await gravar({})).metadata).toEqual({ origem: 'checkin_semanal' });
  });

  it.each([false, undefined, null, 'true', 1])('só o booleano true marca o bot (%j)', async (bot) => {
    expect((await gravar({ bot })).metadata).toEqual({ origem: 'checkin_semanal' });
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
