import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Erro = { code?: string; message?: string };
type Chamada = {
  tabela: string;
  colunas?: string;
  filtros: [string, unknown][];
  ordem?: [string, { ascending: boolean }];
  limite?: number;
};

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  erro: null as Erro | null,
  chamadas: [] as Chamada[],
  segurar: null as Promise<void> | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      const c: Chamada = { tabela, filtros: [] };
      h.chamadas.push(c);
      const resultado = () => {
        if (h.erro) return { data: null, error: h.erro };
        let linhas = [...h.rows];
        if (c.ordem) {
          const [col, { ascending }] = c.ordem;
          linhas.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (ascending ? 1 : -1));
        }
        if (c.limite !== undefined) linhas = linhas.slice(0, c.limite);
        return { data: linhas, error: null };
      };
      const b: Record<string, unknown> = {};
      b.select = (colunas: string) => { c.colunas = colunas; return b; };
      b.eq = (col: string, v: unknown) => { c.filtros.push([col, v]); return b; };
      b.order = (col: string, o: { ascending: boolean }) => { c.ordem = [col, o]; return b; };
      b.limit = (n: number) => { c.limite = n; return b; };
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(h.segurar).then(resultado).then(ok, ko);
      return b;
    },
  },
}));

// jsdom não tem layout: o gráfico vira um marcador que expõe quantos pontos, quais linhas e a altura pedida.
vi.mock('recharts', async () => {
  const React = await import('react');
  const Line = () => null;
  const Nada = () => null;
  return {
    Line,
    XAxis: Nada,
    YAxis: Nada,
    CartesianGrid: Nada,
    Tooltip: Nada,
    Legend: Nada,
    ResponsiveContainer: ({ height, children }: { height: number; children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'area-grafico', 'data-altura': height }, children),
    LineChart: ({ data, children }: { data: { x: string }[]; children: React.ReactNode }) => {
      const linhas = React.Children.toArray(children)
        .filter((el) => React.isValidElement(el) && el.type === Line)
        .map((el) => (el as React.ReactElement<{ dataKey: string }>).props.dataKey);
      return React.createElement('div', {
        'data-testid': 'grafico',
        'data-pontos': data.length,
        'data-linhas': linhas.join(','),
        'data-semanas': data.map((d) => d.x).join(','),
      });
    },
  };
});

import CheckinSemanalCard from '@/components/paciente/CheckinSemanalCard';

const SEG_BASE = Date.UTC(2026, 7, 3); // segunda-feira 03/08/2026

function semanaN(n: number): string {
  return new Date(SEG_BASE + n * 7 * 86400000).toISOString().slice(0, 10);
}

function linha(n: number, v: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    semana: semanaN(n), origem: 'portal',
    fadiga: 4, sono: 4, dor_muscular: 4, estresse: 4, humor: 4, urina: null, psr: null,
    ...v,
  };
}

// 4 respostas iguais (linha de base = 4 em tudo), n = 0 a 3
const BASE_DE_4 = [0, 1, 2, 3].map((n) => linha(n));

function abrir(variante: 'avaliacao' | 'evolucao' = 'avaliacao') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <CheckinSemanalCard pacienteId="pac-1" variante={variante} />
    </QueryClientProvider>,
  );
}

async function abrirComDados(rows: Record<string, unknown>[], variante: 'avaliacao' | 'evolucao' = 'avaliacao') {
  h.rows = rows;
  const r = abrir(variante);
  await screen.findByTestId('checkin-semanal-card');
  return r;
}

const linhaDoItem = (item: string) => screen.getByTestId(`item-${item}`);
const variacao = (chave: string) => screen.queryByTestId(`variacao-${chave}`);

describe('CheckinSemanalCard', () => {
  beforeEach(() => {
    h.rows = [];
    h.erro = null;
    h.chamadas = [];
    h.segurar = null;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('consulta', () => {
    it('lê só a tabela do cliente, as 52 semanas mais recentes, e mostra a série do mais antigo ao mais novo', async () => {
      const muitas = Array.from({ length: 60 }, (_, n) => linha(n, { fadiga: n === 59 ? 2 : 4 }));
      await abrirComDados(muitas);
      expect(h.chamadas).toHaveLength(1);
      const c = h.chamadas[0];
      expect(c.tabela).toBe('checkins_semanais');
      expect(c.filtros).toEqual([['paciente_id', 'pac-1']]);
      expect(c.limite).toBe(52);
      expect(c.ordem).toEqual(['semana', { ascending: false }]);
      expect(screen.getByTestId('ultima-resposta')).toHaveTextContent(`semana de ${semanaN(59).slice(8, 10)}/${semanaN(59).slice(5, 7)}`);
      expect(within(linhaDoItem('fadiga')).getByText('2')).toBeInTheDocument();
      expect(screen.getByText(/52 respostas registradas/)).toBeInTheDocument();
    });
  });

  describe('estados', () => {
    it('sem nenhuma resposta: explica como o cliente responde e como ligar o WhatsApp', async () => {
      h.rows = [];
      abrir();
      expect(
        await screen.findByText('Nenhum check-in ainda. O cliente responde pelo portal e, se você ligar em WhatsApp > Automações, também pelo WhatsApp.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Check-in semanal')).toBeInTheDocument();
      expect(screen.getByText('Autorrelato do cliente')).toBeInTheDocument();
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
      expect(screen.queryByTestId('grafico')).toBeNull();
    });

    it('enquanto carrega, mostra um estado de carregamento acessível e depois o conteúdo', async () => {
      let liberar: () => void = () => {};
      h.segurar = new Promise<void>((ok) => { liberar = ok; });
      h.rows = [linha(12)];
      abrir();
      expect(screen.getByRole('status', { name: /carregando o check-in semanal/i })).toBeInTheDocument();
      expect(screen.queryByTestId('checkin-semanal-card')).toBeNull();
      liberar();
      await screen.findByTestId('checkin-semanal-card');
      expect(screen.queryByTestId('checkin-carregando')).toBeNull();
    });

    it.each([
      ['código 42P01', { code: '42P01', message: 'x' }],
      ['código PGRST205', { code: 'PGRST205', message: 'x' }],
      ['mensagem "does not exist"', { message: 'relation "public.checkins_semanais" does not exist' }],
      ['mensagem "schema cache"', { message: "Could not find the table 'public.checkins_semanais' in the schema cache" }],
    ])('tabela ainda não existe (%s): não renderiza nada e não faz barulho no console', async (_nome, erro) => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleAviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
      h.erro = erro;
      const { container } = abrir();
      await waitFor(() => expect(h.chamadas).toHaveLength(1));
      await waitFor(() => expect(screen.queryByTestId('checkin-carregando')).toBeNull());
      expect(container).toBeEmptyDOMElement();
      expect(consoleErro).not.toHaveBeenCalled();
      expect(consoleAviso).not.toHaveBeenCalled();
    });

    it('outro erro (ex.: sem permissão) não some em silêncio: avisa que não carregou', async () => {
      h.erro = { code: '42501', message: 'permission denied' };
      abrir();
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o check-in semanal');
    });
  });

  describe('uma resposta', () => {
    const uma = () => [linha(12, {
      origem: 'whatsapp', fadiga: 4, sono: 3, dor_muscular: 5, estresse: 2, humor: 1, urina: 6, psr: 7,
    })];

    it('mostra valor e rótulo de cada item, sem setas, sem média inicial e sem gráfico', async () => {
      await abrirComDados(uma());
      const fadiga = linhaDoItem('fadiga');
      expect(within(fadiga).getByText('Fadiga')).toBeInTheDocument();
      expect(within(fadiga).getByText('4')).toBeInTheDocument();
      expect(within(fadiga).getByText('Descansado(a)')).toBeInTheDocument();
      expect(within(linhaDoItem('sono')).getByText('Demorei para pegar no sono')).toBeInTheDocument();
      expect(within(linhaDoItem('dor_muscular')).getByText('Sem dor, me sentindo ótimo(a)')).toBeInTheDocument();
      expect(within(linhaDoItem('estresse')).getByText('Estressado(a)')).toBeInTheDocument();
      expect(within(linhaDoItem('humor')).getByText('Muito triste, irritado(a) ou aborrecido(a)')).toBeInTheDocument();

      expect(document.querySelectorAll('[data-testid^="variacao-"]')).toHaveLength(0);
      expect(screen.queryByText(/média inicial/)).toBeNull();
      expect(screen.queryByTestId('grafico')).toBeNull();
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
      expect(screen.getByText(/1 resposta registrada\./)).toBeInTheDocument();
    });

    it('mostra a data da última resposta com a origem e o índice de bem-estar', async () => {
      await abrirComDados(uma());
      expect(screen.getByTestId('ultima-resposta')).toHaveTextContent('Última resposta: semana de 26/10 · WhatsApp');
      expect(screen.getByTestId('indice-bem-estar')).toHaveTextContent('Índice de bem-estar: 15 de 25');
    });

    it('origem portal aparece como "portal"', async () => {
      await abrirComDados([linha(12, { origem: 'portal' })]);
      expect(screen.getByTestId('ultima-resposta')).toHaveTextContent('semana de 26/10 · portal');
    });

    it('urina com a cor da escala e a classe em texto; recuperação do treino com o rótulo', async () => {
      await abrirComDados(uma());
      const urina = screen.getByTestId('chip-urina');
      expect(urina).toHaveTextContent('Urina 6 de 8: Âmbar');
      expect(urina).toHaveTextContent('sinal de pouca água');
      const cor = urina.querySelector('[aria-hidden="true"][style]') as HTMLElement;
      expect(cor.style.backgroundColor).toBe('rgb(229, 163, 35)');
      expect(screen.getByTestId('chip-psr')).toHaveTextContent('Recuperação do treino 7 de 10: Bem recuperado(a)');
    });

    it('urina boa e urina de atenção têm texto próprio', async () => {
      await abrirComDados([linha(12, { urina: 2 })]);
      expect(screen.getByTestId('chip-urina')).toHaveTextContent('Urina 2 de 8: Amarelo muito claro');
      expect(screen.getByTestId('chip-urina')).toHaveTextContent('hidratação boa');
      cleanup();
      await abrirComDados([linha(12, { urina: 4 })]);
      expect(screen.getByTestId('chip-urina')).toHaveTextContent('Urina 4 de 8: Amarelo');
      expect(screen.getByTestId('chip-urina')).toHaveTextContent('atenção');
    });

    it('sem urina nem recuperação, não mostra os chips', async () => {
      await abrirComDados([linha(12)]);
      expect(screen.queryByTestId('chip-urina')).toBeNull();
      expect(screen.queryByTestId('chip-psr')).toBeNull();
    });

    it('lembra a conversa com as dimensões do MyID e que o check-in não mexe na nota', async () => {
      await abrirComDados(uma());
      expect(screen.getByText(/Conversa com as dimensões R \(regulação\), D \(dor\) e HID \(hidratação\) do MyID\./)).toBeInTheDocument();
      expect(screen.getByText(/não altera a nota do MyID/)).toBeInTheDocument();
    });
  });

  describe('duas respostas: setas contra a semana anterior', () => {
    const anterior = linha(11, { fadiga: 3, sono: 4, dor_muscular: 4, estresse: 2, humor: 5, urina: 2, psr: 5 });
    const atual = linha(12, { fadiga: 4, sono: 3, dor_muscular: 4, estresse: 2, humor: 3, urina: 4, psr: 7 });

    it('item sobe = melhorou; item cai = piorou; igual = igual; texto acessível em todos', async () => {
      await abrirComDados([anterior, atual]);
      const fadiga = variacao('fadiga')!;
      expect(fadiga).toHaveTextContent('subiu 1');
      expect(fadiga).toHaveAttribute('data-sentido', 'melhorou');
      expect(fadiga).toHaveTextContent('melhorou');

      const sono = variacao('sono')!;
      expect(sono).toHaveTextContent('caiu 1');
      expect(sono).toHaveAttribute('data-sentido', 'piorou');

      const humor = variacao('humor')!;
      expect(humor).toHaveTextContent('caiu 2');
      expect(humor).toHaveAttribute('data-sentido', 'piorou');

      const dor = variacao('dor_muscular')!;
      expect(dor).toHaveTextContent('igual');
      expect(dor).toHaveAttribute('data-sentido', 'igual');
      expect(variacao('estresse')).toHaveAttribute('data-sentido', 'igual');
    });

    it('urina: o número SUBIR é PIOR (e dizer isso em texto visível)', async () => {
      await abrirComDados([anterior, atual]);
      const urina = variacao('urina')!;
      expect(urina).toHaveTextContent('subiu 2');
      expect(urina).toHaveAttribute('data-sentido', 'piorou');
      expect(urina).toHaveTextContent('(pior)');
    });

    it('urina: o número CAIR é MELHOR', async () => {
      await abrirComDados([linha(11, { urina: 6 }), linha(12, { urina: 3 })]);
      const urina = variacao('urina')!;
      expect(urina).toHaveTextContent('caiu 3');
      expect(urina).toHaveAttribute('data-sentido', 'melhorou');
      expect(urina).toHaveTextContent('(melhor)');
    });

    it('recuperação do treino: subir é melhor', async () => {
      await abrirComDados([anterior, atual]);
      const psr = variacao('psr')!;
      expect(psr).toHaveTextContent('subiu 2');
      expect(psr).toHaveAttribute('data-sentido', 'melhorou');
    });

    it('urina só em uma das semanas: sem seta de urina (não inventa comparação)', async () => {
      await abrirComDados([linha(11, { urina: null }), linha(12, { urina: 3 })]);
      expect(screen.getByTestId('chip-urina')).toBeInTheDocument();
      expect(variacao('urina')).toBeNull();
    });

    it('índice de bem-estar com a variação, e diz a semana usada na comparação', async () => {
      await abrirComDados([anterior, atual]);
      // anterior: 3+4+4+2+5 = 18; atual: 4+3+4+2+3 = 16
      const indice = screen.getByTestId('indice-bem-estar');
      expect(indice).toHaveTextContent('Índice de bem-estar: 16 de 25');
      expect(within(indice).getByTestId('variacao-indice')).toHaveTextContent('caiu 2');
      expect(within(indice).getByTestId('variacao-indice')).toHaveAttribute('data-sentido', 'piorou');
      expect(screen.getByText(/comparação com a resposta da semana de 19\/10/)).toBeInTheDocument();
    });

    it('com duas respostas ainda não há média inicial nem faixa de atenção, mas já há gráfico', async () => {
      await abrirComDados([anterior, atual]);
      expect(screen.queryByText(/média inicial/)).toBeNull();
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
      expect(screen.getByTestId('grafico')).toHaveAttribute('data-pontos', '2');
    });
  });

  describe('linha de base (média inicial)', () => {
    it('com 3 respostas não mostra a média inicial', async () => {
      await abrirComDados([0, 1, 2].map((n) => linha(n)));
      expect(screen.queryByText(/média inicial/)).toBeNull();
    });

    it('com 4 respostas mostra a média das 4 primeiras, com vírgula e uma casa, entre parênteses', async () => {
      await abrirComDados([
        linha(0, { fadiga: 3, humor: 5 }), linha(1), linha(2), linha(3, { humor: 4 }),
      ]);
      expect(within(linhaDoItem('fadiga')).getByText('(média inicial 3,8)')).toBeInTheDocument();
      expect(within(linhaDoItem('humor')).getByText('(média inicial 4,3)')).toBeInTheDocument();
      expect(within(linhaDoItem('sono')).getByText('(média inicial 4,0)')).toBeInTheDocument();
      expect(screen.getAllByText(/média inicial/)).toHaveLength(5);
    });

    it('a média inicial são as 4 PRIMEIRAS respostas, não as mais recentes', async () => {
      const rows = [
        ...[0, 1, 2, 3].map((n) => linha(n, { sono: 2 })),
        ...[4, 5, 6].map((n) => linha(n, { sono: 5 })),
      ];
      await abrirComDados(rows);
      expect(within(linhaDoItem('sono')).getByText('(média inicial 2,0)')).toBeInTheDocument();
    });
  });

  describe('faixa de atenção', () => {
    const baixa = (n: number, v: Record<string, unknown>) => linha(n, v);

    it('6 respostas, duas últimas semanas seguidas 1 ponto abaixo da média inicial: avisa os itens certos, sem diagnosticar', async () => {
      await abrirComDados([...BASE_DE_4, baixa(4, { fadiga: 3, sono: 3 }), baixa(5, { fadiga: 3, sono: 2 })]);
      const faixa = screen.getByTestId('faixa-atencao');
      expect(faixa).toHaveTextContent(
        'Atenção: fadiga e sono ficaram 1 ponto ou mais abaixo da própria média inicial do cliente por 2 semanas seguidas. Vale conversar com o cliente e rever o MyID.',
      );
      expect(faixa).not.toHaveTextContent(/humor|estresse|dor muscular/);
      expect(faixa).not.toHaveTextContent(/depress|ansied|diagn/i);
      expect(faixa).toHaveAttribute('role', 'status');
    });

    it('um item só: verbo no singular', async () => {
      await abrirComDados([...BASE_DE_4, baixa(4, { humor: 3 }), baixa(5, { humor: 3 })]);
      expect(screen.getByTestId('faixa-atencao')).toHaveTextContent('Atenção: humor ficou 1 ponto ou mais abaixo');
    });

    it('três itens: lista com vírgula e "e"', async () => {
      await abrirComDados([...BASE_DE_4, baixa(4, { fadiga: 3, sono: 3, dor_muscular: 3 }), baixa(5, { fadiga: 3, sono: 3, dor_muscular: 3 })]);
      expect(screen.getByTestId('faixa-atencao')).toHaveTextContent('Atenção: fadiga, sono e dor muscular ficaram 1 ponto');
    });

    it('com só 5 respostas não avisa, mesmo com as duas últimas baixas', async () => {
      await abrirComDados([linha(0), linha(1), linha(2), linha(3, { fadiga: 2 }), linha(4, { fadiga: 2 })]);
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
    });

    it('queda de uma semana só não avisa', async () => {
      await abrirComDados([...BASE_DE_4, baixa(4, { fadiga: 2 }), baixa(5, { fadiga: 4 })]);
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
    });

    it('semanas não seguidas (faltou uma semana) não avisa', async () => {
      await abrirComDados([...BASE_DE_4, baixa(4, { fadiga: 2 }), baixa(6, { fadiga: 2 })]);
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
    });

    it('queda menor que 1 ponto sobre a média não avisa', async () => {
      const base = [0, 1, 2, 3].map((n) => linha(n, { fadiga: n === 0 ? 5 : 4 })); // média 4,25
      await abrirComDados([...base, baixa(4, { fadiga: 4 }), baixa(5, { fadiga: 4 })]);
      expect(screen.queryByTestId('faixa-atencao')).toBeNull();
    });

    it('a faixa aparece também na variante de evolução', async () => {
      await abrirComDados([...BASE_DE_4, baixa(4, { estresse: 3 }), baixa(5, { estresse: 2 })], 'evolucao');
      expect(screen.getByTestId('faixa-atencao')).toHaveTextContent('Atenção: estresse ficou');
    });
  });

  describe('gráfico', () => {
    const quinze = () => Array.from({ length: 15 }, (_, n) => linha(n));

    it('mostra só as últimas 12 semanas, com os 5 itens', async () => {
      await abrirComDados(quinze());
      const g = screen.getByTestId('grafico');
      expect(g).toHaveAttribute('data-pontos', '12');
      expect(g).toHaveAttribute('data-linhas', 'fadiga,sono,dor_muscular,estresse,humor');
      expect(g.getAttribute('data-semanas')!.split(',')[11]).toBe('09/11');
    });

    it('a primeira semana do gráfico é a de número 3 (das semanas 0 a 14, as 12 últimas)', async () => {
      await abrirComDados(quinze());
      const primeira = semanaN(3);
      expect(screen.getByTestId('grafico').getAttribute('data-semanas')!.split(',')[0]).toBe(`${primeira.slice(8, 10)}/${primeira.slice(5, 7)}`);
    });

    it('o botão "Índice de bem-estar" troca para uma linha só; os botões dizem qual está ativo', async () => {
      await abrirComDados(quinze());
      const itens = screen.getByRole('button', { name: 'Cinco itens' });
      const indice = screen.getByRole('button', { name: 'Índice de bem-estar' });
      expect(itens).toHaveAttribute('aria-pressed', 'true');
      expect(indice).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(indice);
      expect(screen.getByTestId('grafico')).toHaveAttribute('data-linhas', 'indice');
      expect(indice).toHaveAttribute('aria-pressed', 'true');
      expect(itens).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(itens);
      expect(screen.getByTestId('grafico')).toHaveAttribute('data-linhas', 'fadiga,sono,dor_muscular,estresse,humor');
    });

    it('na variante de evolução o gráfico é maior que na de avaliação', async () => {
      await abrirComDados(quinze(), 'avaliacao');
      const a = Number(screen.getByTestId('area-grafico').getAttribute('data-altura'));
      expect(screen.getByTestId('checkin-semanal-card')).toHaveAttribute('data-variante', 'avaliacao');
      cleanup();
      await abrirComDados(quinze(), 'evolucao');
      const e = Number(screen.getByTestId('area-grafico').getAttribute('data-altura'));
      expect(screen.getByTestId('checkin-semanal-card')).toHaveAttribute('data-variante', 'evolucao');
      expect(e).toBeGreaterThan(a);
    });

    it('o gráfico tem descrição em texto para leitor de tela', async () => {
      await abrirComDados(quinze());
      expect(screen.getByRole('img', { name: /Gráfico de linhas dos cinco itens/ })).toBeInTheDocument();
    });
  });

  describe('dados fora do esperado', () => {
    it('ignora linhas sem os cinco itens em vez de quebrar', async () => {
      await abrirComDados([linha(10, { fadiga: null }), linha(11, { sono: 'x' }), linha(12)]);
      expect(screen.getByText(/1 resposta registrada\./)).toBeInTheDocument();
    });

    it('aceita números que chegam como texto', async () => {
      await abrirComDados([linha(12, { fadiga: '5', urina: '3' })]);
      expect(within(linhaDoItem('fadiga')).getByText('Muito descansado(a)')).toBeInTheDocument();
      expect(screen.getByTestId('chip-urina')).toHaveTextContent('Urina 3 de 8: Amarelo claro');
    });
  });
});
