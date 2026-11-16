import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BuscaDeCliente } from '@/components/cassi/BuscaDeCliente';
import { ClientesDoMes } from '@/components/cassi/ClientesDoMes';
import { LancamentoDoCliente } from '@/components/cassi/LancamentoDoCliente';
import { mesclarCodigosComPadrao, ordenarParaLancamento, type GuiaLancada, type LinhaDoModelo } from '@/lib/cassiFaturamento';

const catalogo = ordenarParaLancamento(mesclarCodigosComPadrao([]));
const norm = (t: string | null | undefined) => (t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

// ── Editor: os códigos do modelo no topo e "Outros códigos" recolhido ─────────────────────────────────────────────
describe('LancamentoDoCliente: códigos do modelo no topo e "Outros códigos"', () => {
  const montar = (extra: Partial<React.ComponentProps<typeof LancamentoDoCliente>> = {}) => {
    const props = { nome: 'Ana Souza', catalogo, inicial: [] as GuiaLancada[], sessoesAgenda: 0, onSalvar: vi.fn(), onCancelar: vi.fn(), ...extra };
    const r = render(<LancamentoDoCliente {...props} />);
    return { ...r, props };
  };
  const qtd = (codigo: string, guia = 1) => screen.getByLabelText(`Quantidade do código ${codigo} na guia ${guia}`) as HTMLInputElement;
  const caixa = (codigo: string, guia = 1) => screen.getByRole('checkbox', { name: `Marcar o código ${codigo} na guia ${guia}`, hidden: true });
  const botaoOutros = (guia = 1) => within(screen.getByRole('region', { name: `Guia ${guia} de Ana Souza` })).getByRole('button', { name: /^Outros códigos/ }) as HTMLButtonElement;
  const listaDeOutros = (guia = 1) => document.getElementById(botaoOutros(guia).getAttribute('aria-controls')!) as HTMLElement;
  const topo = (guia = 1) => within(screen.getByRole('list', { name: `Códigos do modelo da guia ${guia}` })).getAllByRole('listitem').map((li) => norm(li.textContent).split(' ')[0]);

  it('no topo, destacados e na ordem do modelo: 144, 012 e 160', () => {
    montar();
    expect(topo()).toEqual(['144', '012', '160']);
    const itens = within(screen.getByRole('list', { name: 'Códigos do modelo da guia 1' })).getAllByRole('listitem');
    for (const li of itens) expect(li.className).toContain('border-l-4');
  });

  it('os demais ficam sob "Outros códigos (4)": recolhido por padrão, com aria-expanded e aria-controls, e o container sempre montado com hidden', () => {
    montar();
    const botao = botaoOutros();
    expect(botao.textContent).toContain('Outros códigos (4)');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    const lista = listaDeOutros();
    expect(lista).toBeTruthy();
    expect(lista.hasAttribute('hidden')).toBe(true);
    expect(within(lista).getAllByRole('listitem', { hidden: true }).map((li) => norm(li.textContent).split(' ')[0])).toEqual(['185', '131', '301', '020']);
    // recolhido de verdade para quem usa leitor de tela: os campos de dentro não são acessíveis
    expect(screen.queryByRole('checkbox', { name: 'Marcar o código 301 na guia 1' })).toBeNull();
  });

  it('tocar em "Outros códigos" abre; tocar de novo recolhe', () => {
    montar();
    fireEvent.click(botaoOutros());
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
    expect(listaDeOutros().hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Marcar o código 301 na guia 1' })).toBeTruthy();
    fireEvent.click(botaoOutros());
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('false');
    expect(listaDeOutros().hasAttribute('hidden')).toBe(true);
  });

  it('o botão tem alvo de toque de 44 px e nome para leitor de tela', () => {
    montar();
    expect(botaoOutros().className).toContain('min-h-11');
    expect(listaDeOutros().getAttribute('aria-label')).toBe('Outros códigos da guia 1');
  });

  it('abre sozinho quando um código fora do modelo já está marcado numa guia salva (301)', () => {
    montar({ inicial: [{ '012': 5, '301': 2 }] });
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
    expect(listaDeOutros().hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Marcar o código 301 na guia 1' }).getAttribute('data-state')).toBe('checked');
  });

  it('abre sozinho também quando o código fora do modelo está em OUTRA guia (em todas elas)', () => {
    montar({ inicial: [{ '012': 5 }, { '012': 3, '020': 4 }] });
    expect(botaoOutros(1).getAttribute('aria-expanded')).toBe('true');
    expect(botaoOutros(2).getAttribute('aria-expanded')).toBe('true');
  });

  it('não abre sozinho quando só há código do modelo marcado', () => {
    montar({ inicial: [{ '012': 5, '160': 2 }] });
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('false');
  });

  it('código fora da lista de códigos (vale R$ 0,00): aparece sob "Outros códigos", aberto, e dá para zerar; zerar não fecha a lista na sua cara', () => {
    const { props } = montar({ inicial: [{ '012': 2, '777': 3 }] });
    expect(botaoOutros().textContent).toContain('Outros códigos (5)'); // os quatro + o 777
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/fora da lista de códigos/)).toBeTruthy();
    fireEvent.change(qtd('777'), { target: { value: '0' } });
    expect(screen.queryByLabelText('Quantidade do código 777 na guia 1')).toBeNull();
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(props.onSalvar).toHaveBeenCalledWith([{ '012': 2 }]);
  });

  it('com algum código de "Outros" marcado a lista não recolhe (nada que vale some); sem nenhum, dá para recolher', () => {
    montar();
    fireEvent.click(botaoOutros());
    fireEvent.click(caixa('301'));
    expect(botaoOutros().disabled).toBe(true);
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(caixa('301')); // desmarcou: continua aberta, e agora dá para recolher
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
    expect(botaoOutros().disabled).toBe(false);
    fireEvent.click(botaoOutros());
    expect(botaoOutros().getAttribute('aria-expanded')).toBe('false');
  });

  it('o que está marcado em "Outros" conta no total mesmo recolhido (nada some da conta): agenda troca as guias e o total continua certo', () => {
    montar({ inicial: [{ '012': 1, '301': 2 }] });
    expect(norm(screen.getByText(/Total de Ana/).parentElement?.textContent)).toContain('R$ 128,80 · 3 sessões'); // 57,70 + 2 × 35,55
  });

  it('cada guia tem o seu botão, com ids próprios; abrir um abre os dois', () => {
    montar({ inicial: [{ '012': 5 }] });
    fireEvent.click(screen.getByRole('button', { name: /^Outra guia/ }));
    const um = botaoOutros(1); const dois = botaoOutros(2);
    expect(um.getAttribute('aria-controls')).not.toBe(dois.getAttribute('aria-controls'));
    fireEvent.click(um);
    expect(botaoOutros(2).getAttribute('aria-expanded')).toBe('true');
    expect(listaDeOutros(2).hasAttribute('hidden')).toBe(false);
  });

  it('um código marcado em "Outros" na segunda guia da guia nova mantém a regra: a guia nova abre com o modelo e "Outros" recolhido', () => {
    montar({ inicial: [{ '012': 5 }] });
    fireEvent.click(screen.getByRole('button', { name: /^Outra guia/ }));
    expect(topo(2)).toEqual(['144', '012', '160']);
    expect(botaoOutros(2).getAttribute('aria-expanded')).toBe('false');
  });

  describe('guia nova respeita o que ainda cabe no mês (131: 10 no mês)', () => {
    const com131: LinhaDoModelo[] = [
      { codigo: '144', quantidade: 1, marcado: true },
      { codigo: '131', quantidade: 10, marcado: true },
      { codigo: '012', quantidade: 10, marcado: false },
      { codigo: '160', quantidade: 10, marcado: false },
      { codigo: '185', quantidade: 10, marcado: false },
      { codigo: '301', quantidade: 10, marcado: false },
      { codigo: '020', quantidade: 10, marcado: false },
    ];
    const cat131 = ordenarParaLancamento(mesclarCodigosComPadrao([]), com131);

    it('"Outra guia" com o 131 × 10 no modelo: a segunda guia nasce SEM o 131 (o mês já está no limite), pode salvar e não aparece aviso de limite', () => {
      const { props } = montar({ catalogo: cat131, modelo: com131 });
      expect(qtd('131').value).toBe('10');
      fireEvent.click(screen.getByRole('button', { name: /^Outra guia/ }));
      expect(caixa('131', 2).getAttribute('data-state')).toBe('unchecked');
      expect((caixa('131', 2) as HTMLButtonElement).disabled).toBe(true);
      expect(caixa('144', 2).getAttribute('data-state')).toBe('checked');
      expect(screen.queryByRole('alert')).toBeNull();
      const salvar = screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement;
      expect(salvar.disabled).toBe(false);
      fireEvent.click(salvar);
      expect(props.onSalvar).toHaveBeenCalledWith([{ '144': 1, '131': 10 }, { '144': 1 }]);
    });

    it('cliente que já tem 131 × 4 salvo: a guia nova leva só o que cabe (6), não os 10 do modelo', () => {
      const { props } = montar({ catalogo: cat131, modelo: com131, inicial: [{ '131': 4, '012': 2 }] });
      fireEvent.click(screen.getByRole('button', { name: /^Outra guia/ }));
      expect(qtd('131', 2).value).toBe('6');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      expect(props.onSalvar).toHaveBeenCalledWith([{ '131': 4, '012': 2 }, { '144': 1, '131': 6 }]);
    });

    it('abrir com o pedido de outra guia (lista do mês) também respeita o mês: a guia a mais não leva o 131 de novo', () => {
      const { props } = montar({ catalogo: cat131, modelo: com131, inicial: [{ '131': 10 }], outraGuiaPedida: 1 });
      expect(caixa('131', 2).getAttribute('data-state')).toBe('unchecked');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      expect(props.onSalvar).toHaveBeenCalledWith([{ '131': 10 }, { '144': 1 }]);
    });

    it('pedido de outra guia feito com o editor já aberto também respeita o mês', () => {
      const { rerender, props } = montar({ catalogo: cat131, modelo: com131 });
      rerender(<LancamentoDoCliente {...props} catalogo={cat131} modelo={com131} outraGuiaPedida={1} />);
      expect(caixa('131', 2).getAttribute('data-state')).toBe('unchecked');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('trocar o modelo com o editor aberto (em "Códigos pré-preenchidos") não conta como algo digitado', () => {
    it('cliente sem lançamento: abrir, o modelo mudar e Cancelar não pergunta "Descartar o que você digitou?"', () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const outro: LinhaDoModelo[] = [
        { codigo: '131', quantidade: 3, marcado: true },
        { codigo: '144', quantidade: 1, marcado: true },
        { codigo: '012', quantidade: 10, marcado: false },
        { codigo: '160', quantidade: 10, marcado: false },
        { codigo: '185', quantidade: 10, marcado: false },
        { codigo: '301', quantidade: 10, marcado: false },
        { codigo: '020', quantidade: 10, marcado: false },
      ];
      const { rerender, props } = montar();
      expect(screen.getByRole('note')).toBeTruthy();
      rerender(<LancamentoDoCliente {...props} catalogo={ordenarParaLancamento(mesclarCodigosComPadrao([]), outro)} modelo={outro} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(confirmar).not.toHaveBeenCalled();
      expect(props.onCancelar).toHaveBeenCalledTimes(1);
      confirmar.mockRestore();
    });

    it('cliente com guia salva aberto já com "outra guia": a guia a mais é a de quando abriu; o modelo mudar depois não vira "digitado"', () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const outro: LinhaDoModelo[] = [{ codigo: '131', quantidade: 3, marcado: true }];
      const { rerender, props } = montar({ inicial: [{ '012': 5 }], outraGuiaPedida: 1 });
      expect(screen.getByRole('region', { name: 'Guia 2 de Ana Souza' })).toBeTruthy();
      rerender(<LancamentoDoCliente {...props} catalogo={ordenarParaLancamento(mesclarCodigosComPadrao([]), outro)} modelo={outro} outraGuiaPedida={1} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(confirmar).not.toHaveBeenCalled();
      expect(props.onCancelar).toHaveBeenCalledTimes(1);
      confirmar.mockRestore();
    });

    it('digitar de verdade continua perguntando ao cancelar, mesmo depois de o modelo mudar', () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const outro: LinhaDoModelo[] = [{ codigo: '144', quantidade: 1, marcado: true }];
      const { rerender, props } = montar();
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar o código 012 da guia 1' }));
      expect(qtd('012').value).toBe('10');
      fireEvent.change(qtd('012'), { target: { value: '4' } });
      rerender(<LancamentoDoCliente {...props} catalogo={ordenarParaLancamento(mesclarCodigosComPadrao([]), outro)} modelo={outro} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(confirmar).toHaveBeenCalledTimes(1);
      expect(props.onCancelar).not.toHaveBeenCalled();
      confirmar.mockRestore();
    });
  });

  describe('com o modelo que o profissional escolheu', () => {
    const meu: LinhaDoModelo[] = [
      { codigo: '301', quantidade: 3, marcado: true },
      { codigo: '144', quantidade: 1, marcado: true },
      { codigo: '012', quantidade: 10, marcado: false },
      { codigo: '160', quantidade: 10, marcado: false },
      { codigo: '185', quantidade: 10, marcado: false },
      { codigo: '131', quantidade: 10, marcado: false },
      { codigo: '020', quantidade: 10, marcado: false },
    ];
    const cat = ordenarParaLancamento(mesclarCodigosComPadrao([]), meu);

    it('o topo é o modelo dele, na ordem dele, e a guia nova já vem com as quantidades dele', () => {
      const { props } = montar({ catalogo: cat, modelo: meu });
      expect(topo()).toEqual(['301', '144']);
      expect(botaoOutros().textContent).toContain('Outros códigos (5)');
      expect(qtd('301').value).toBe('3');
      expect(qtd('144').value).toBe('1');
      expect(screen.getByRole('checkbox', { name: 'Marcar o código 012 na guia 1', hidden: true }).getAttribute('data-state')).toBe('unchecked');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      expect(props.onSalvar).toHaveBeenCalledWith([{ '301': 3, '144': 1 }]);
    });

    it('o aviso diz o modelo dele, na ordem dele', () => {
      montar({ catalogo: cat, modelo: meu });
      expect(screen.getByRole('note').textContent).toBe('Já vem marcado o modelo da guia (301 × 3 · 144 × 1). Confira e ajuste antes de salvar.');
    });

    it('a quantidade proposta ao marcar vem do modelo dele: o 301 do modelo (× 3) marcado num cliente que só tinha 012 entra com 3, não com 10', () => {
      montar({ catalogo: cat, modelo: meu, inicial: [{ '012': 5 }] });
      expect(qtd('301').placeholder).toBe('3');
      fireEvent.click(caixa('301'));
      expect(qtd('301').value).toBe('3');
    });

    it('um código desmarcado no modelo dele propõe a quantidade que o modelo guarda para ele (012 × 4)', () => {
      const comQuatro = meu.map((m) => (m.codigo === '012' ? { ...m, quantidade: 4 } : m));
      montar({ catalogo: ordenarParaLancamento(mesclarCodigosComPadrao([]), comQuatro), modelo: comQuatro });
      fireEvent.click(caixa('012'));
      expect(qtd('012').value).toBe('4');
    });

    it('modelo sem nenhum código marcado: sem topo, a guia nasce vazia e "Outros códigos" já vem aberto (senão não haveria o que marcar)', () => {
      const nenhum: LinhaDoModelo[] = meu.map((m) => ({ ...m, marcado: false }));
      montar({ catalogo: ordenarParaLancamento(mesclarCodigosComPadrao([]), nenhum), modelo: nenhum });
      expect(screen.queryByRole('list', { name: /Códigos do modelo/ })).toBeNull();
      expect(botaoOutros().getAttribute('aria-expanded')).toBe('true');
      expect(botaoOutros().textContent).toContain('Outros códigos (7)');
      expect(screen.queryByRole('note')).toBeNull();
      expect(screen.getByRole('checkbox', { name: 'Marcar o código 012 na guia 1' })).toBeTruthy();
    });
  });

  describe('a quantidade proposta ao marcar um código fora do modelo é 10, ou o limite do código', () => {
    const semConsulta: LinhaDoModelo[] = [{ codigo: '012', quantidade: 6, marcado: true }];
    const cat = ordenarParaLancamento(mesclarCodigosComPadrao([{ codigo: '777', descricao: 'Meu código', valor: 5 }]), semConsulta);

    it('144 fora do modelo propõe 1; 160 e o código criado por ele propõem 10; 131 respeita o que sobra do mês', () => {
      montar({ catalogo: cat, modelo: semConsulta, inicial: [{ '131': 6 }] });
      fireEvent.click(screen.getByRole('button', { name: /^Outra guia/ }));
      fireEvent.click(caixa('144', 1));
      fireEvent.click(caixa('160', 1));
      fireEvent.click(caixa('777', 1));
      expect([qtd('144').value, qtd('160').value, qtd('777').value]).toEqual(['1', '10', '10']);
      fireEvent.click(caixa('131', 2));
      expect(qtd('131', 2).value).toBe('4');
      expect(qtd('144').placeholder).toBe('1');
    });
  });

  describe('"outra guia" pedido pela lista do mês', () => {
    it('abrindo com o pedido, um cliente que já tem lançamento ganha uma guia a mais, com o modelo', () => {
      const { props } = montar({ inicial: [{ '012': 5, '301': 2 }], outraGuiaPedida: 1 });
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(2);
      expect(qtd('012', 1).value).toBe('5'); // a primeira é a que estava salva, intacta
      expect(qtd('144', 2).value).toBe('1');
      expect(qtd('012', 2).value).toBe('10');
      expect(qtd('160', 2).value).toBe('10');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      expect(props.onSalvar).toHaveBeenCalledWith([{ '012': 5, '301': 2 }, { '144': 1, '012': 10, '160': 10 }]);
    });

    it('abrir assim não é "algo digitado": cancelar não pergunta, e mexer na guia nova passa a ser', () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onAlterado = vi.fn();
      const { props } = montar({ inicial: [{ '012': 5 }], outraGuiaPedida: 1, onAlterado });
      expect(onAlterado).toHaveBeenLastCalledWith(false);
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(confirmar).not.toHaveBeenCalled();
      expect(props.onCancelar).toHaveBeenCalledTimes(1);
      fireEvent.change(qtd('012', 2), { target: { value: '3' } });
      expect(onAlterado).toHaveBeenLastCalledWith(true);
      confirmar.mockRestore();
    });

    it('cliente sem lançamento: o pedido só abre o editor (a guia do modelo já é a primeira)', () => {
      montar({ inicial: [], outraGuiaPedida: 1 });
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(1);
    });

    it('sem pedido, um cliente com lançamento abre só com as guias que tem', () => {
      montar({ inicial: [{ '012': 5 }], outraGuiaPedida: 0 });
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(1);
    });

    it('com 6 guias já salvas o pedido não passa do limite do mês', () => {
      montar({ inicial: Array.from({ length: 6 }, () => ({ '012': 1 })), outraGuiaPedida: 1 });
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(6);
    });

    it('pedido novo com o editor já aberto adiciona uma guia na hora, sem perder o que foi digitado; o mesmo pedido de novo não repete', () => {
      const { rerender, props } = montar({ inicial: [{ '012': 5 }], outraGuiaPedida: 0 });
      fireEvent.change(qtd('012', 1), { target: { value: '7' } });
      rerender(<LancamentoDoCliente {...props} outraGuiaPedida={1} />);
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(2);
      expect(qtd('012', 1).value).toBe('7');
      expect(qtd('160', 2).value).toBe('10');
      rerender(<LancamentoDoCliente {...props} outraGuiaPedida={1} />);
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(2);
      rerender(<LancamentoDoCliente {...props} outraGuiaPedida={2} />);
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(3);
    });

    it('cliente sem lançamento com o editor aberto: um pedido novo adiciona a segunda guia', () => {
      const { rerender, props } = montar({ inicial: [], outraGuiaPedida: 0 });
      rerender(<LancamentoDoCliente {...props} outraGuiaPedida={1} />);
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(2);
    });

    it('com o editor aberto e 6 guias, pedido novo não passa do limite', () => {
      const { rerender, props } = montar({ inicial: Array.from({ length: 6 }, () => ({ '012': 1 })), outraGuiaPedida: 0 });
      rerender(<LancamentoDoCliente {...props} outraGuiaPedida={1} />);
      expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(6);
    });
  });
});

// ── Lista do mês: "Outra guia" na linha e na busca ────────────────────────────────────────────────────────────────
describe('ClientesDoMes: o mesmo cliente de novo na fatura', () => {
  const clientes = [
    { id: 'a', nome: 'Ana Souza', carteirinha: '1001', sessoesAgenda: 8, guias: [{ '012': 10, '144': 1 }] },
    { id: 'b', nome: 'Bruno Lima', carteirinha: '2002', sessoesAgenda: 1, guias: [] },
    { id: 'c', nome: 'Carla Dias', carteirinha: '3003', sessoesAgenda: 0, guias: Array.from({ length: 6 }, () => ({ '012': 1 })) },
  ];
  const base = () => ({
    mesLabel: 'outubro de 2026', clientes, candidatos: [{ id: 'd', nome: 'Davi Rocha', carteirinha: '4004' }], comSessaoFora: 0, catalogo, quantosPreencheriaComAgenda: 0,
    onAdicionar: vi.fn(), onAdicionarComSessao: vi.fn(), onRemover: vi.fn(), onLimpar: vi.fn(),
    onSalvarLancamento: vi.fn().mockResolvedValue(true), onPreencherComAgenda: vi.fn(),
  });
  const outraGuia = (nome: string) => screen.getByRole('button', { name: `Outra guia para ${nome} neste mês` }) as HTMLButtonElement;
  const guiasAbertas = (nome: string) => within(screen.getByRole('group', { name: `Códigos e sessões de ${nome}` })).getAllByRole('region', { name: new RegExp(`^Guia \\d de ${nome}$`) });
  const abrir = (nome: string) => fireEvent.click(screen.getByRole('button', { name: `Lançar códigos e sessões de ${nome}` }));
  const buscar = (texto: string) => fireEvent.change(screen.getByLabelText('Adicionar cliente à lista do mês'), { target: { value: texto } });
  const opcaoDaBusca = (nome: RegExp) => within(screen.getByRole('list', { name: 'Resultados da busca' })).getByRole('button', { name: nome }) as HTMLButtonElement;

  it('cada cliente da lista tem um botão visível "Outra guia", com alvo de 44 px e nome com o cliente', () => {
    render(<ClientesDoMes {...base()} />);
    for (const c of clientes) {
      expect(outraGuia(c.nome).textContent).toContain('Outra guia');
      expect(outraGuia(c.nome).className).toContain('h-11');
    }
  });

  it('o texto da tela explica: o mesmo cliente pode ter mais de uma guia no mês, e cada guia vira uma linha no relatório', () => {
    render(<ClientesDoMes {...base()} />);
    expect(norm(document.body.textContent)).toContain('O mesmo cliente pode ter mais de uma guia no mês: cada guia vira uma linha no relatório.');
  });

  it('tocar em "Outra guia" abre o editor desse cliente já com uma guia nova a mais, com o modelo', () => {
    render(<ClientesDoMes {...base()} />);
    fireEvent.click(outraGuia('Ana Souza'));
    expect(guiasAbertas('Ana Souza')).toHaveLength(2);
    expect((screen.getByLabelText('Quantidade do código 012 na guia 1') as HTMLInputElement).value).toBe('10'); // a que estava salva
    expect((screen.getByLabelText('Quantidade do código 160 na guia 2') as HTMLInputElement).value).toBe('10');
  });

  it('cliente sem nenhuma guia lançada: "Outra guia" só abre o editor, com a guia do modelo', () => {
    render(<ClientesDoMes {...base()} />);
    fireEvent.click(outraGuia('Bruno Lima'));
    expect(guiasAbertas('Bruno Lima')).toHaveLength(1);
  });

  it('salvar sem mexer entrega as duas guias: a que existia e a do modelo', async () => {
    const props = base();
    render(<ClientesDoMes {...props} />);
    fireEvent.click(outraGuia('Ana Souza'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(props.onSalvarLancamento).toHaveBeenCalledWith('a', [{ '012': 10, '144': 1 }, { '144': 1, '012': 10, '160': 10 }]));
  });

  it('no limite de 6 guias o botão fica desligado e a linha explica', () => {
    render(<ClientesDoMes {...base()} />);
    expect(outraGuia('Carla Dias').disabled).toBe(true);
    expect(outraGuia('Carla Dias').title).toMatch(/6 guias neste mês/);
    expect(screen.getByText(/limite de 6 guias no mês/)).toBeTruthy();
    expect(outraGuia('Ana Souza').disabled).toBe(false);
    fireEvent.click(outraGuia('Carla Dias'));
    expect(screen.queryByRole('group', { name: /Códigos e sessões/ })).toBeNull();
  });

  it('ocupado ou gravando: o botão fica desligado e nada abre', () => {
    const { rerender } = render(<ClientesDoMes {...base()} ocupado />);
    expect(outraGuia('Ana Souza').disabled).toBe(true);
    rerender(<ClientesDoMes {...base()} salvandoId="b" />);
    expect(outraGuia('Ana Souza').disabled).toBe(true);
    fireEvent.click(outraGuia('Ana Souza'));
    expect(screen.queryByRole('group', { name: /Códigos e sessões/ })).toBeNull();
  });

  it('com algo digitado em OUTRO cliente pergunta antes de trocar; recusando, nada muda; aceitando, abre o novo', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ClientesDoMes {...base()} />);
    abrir('Bruno Lima');
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '4' } });
    fireEvent.click(outraGuia('Ana Souza'));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith('Descartar o que você digitou no lançamento aberto?');
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeTruthy();
    expect((screen.getByLabelText('Quantidade do código 012 na guia 1') as HTMLInputElement).value).toBe('4');
    confirmar.mockReturnValue(true);
    fireEvent.click(outraGuia('Ana Souza'));
    expect(screen.queryByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeNull();
    expect(guiasAbertas('Ana Souza')).toHaveLength(2);
    confirmar.mockRestore();
  });

  it('sem nada digitado no outro cliente troca sem perguntar', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ClientesDoMes {...base()} />);
    abrir('Bruno Lima');
    fireEvent.click(outraGuia('Ana Souza'));
    expect(confirmar).not.toHaveBeenCalled();
    expect(guiasAbertas('Ana Souza')).toHaveLength(2);
    confirmar.mockRestore();
  });

  it('com o editor DO MESMO cliente aberto e algo digitado, "Outra guia" adiciona uma guia ali mesmo, sem perguntar e sem perder o digitado', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ClientesDoMes {...base()} />);
    abrir('Ana Souza');
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '4' } });
    fireEvent.click(outraGuia('Ana Souza'));
    expect(confirmar).not.toHaveBeenCalled();
    expect(guiasAbertas('Ana Souza')).toHaveLength(2);
    expect((screen.getByLabelText('Quantidade do código 012 na guia 1') as HTMLInputElement).value).toBe('4');
    fireEvent.click(outraGuia('Ana Souza'));
    expect(guiasAbertas('Ana Souza')).toHaveLength(3);
    confirmar.mockRestore();
  });

  it('abrir o cliente pelo toque normal depois de "Outra guia" não repete a guia extra', () => {
    render(<ClientesDoMes {...base()} />);
    fireEvent.click(outraGuia('Ana Souza'));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Ana Souza' }));
    abrir('Ana Souza');
    expect(guiasAbertas('Ana Souza')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Ana Souza' }));
    fireEvent.click(outraGuia('Ana Souza'));
    expect(guiasAbertas('Ana Souza')).toHaveLength(2);
  });

  it('o modelo que o profissional escolheu chega ao editor (topo com o que ele marcou)', () => {
    const meu: LinhaDoModelo[] = [{ codigo: '301', quantidade: 3, marcado: true }, { codigo: '012', quantidade: 10, marcado: false }];
    render(<ClientesDoMes {...base()} modelo={meu} catalogo={ordenarParaLancamento(catalogo, meu)} />);
    fireEvent.click(outraGuia('Bruno Lima'));
    expect((screen.getByLabelText('Quantidade do código 301 na guia 1') as HTMLInputElement).value).toBe('3');
  });

  describe('na busca "Adicionar cliente"', () => {
    it('quem já está na lista também aparece, com a marca "já na lista" e a ação "adicionar outra guia"', () => {
      render(<ClientesDoMes {...base()} />);
      buscar('ana');
      const opcao = opcaoDaBusca(/Ana Souza/);
      expect(norm(opcao.textContent)).toContain('já na lista · adicionar outra guia');
      expect(opcao.className).toContain('min-h-11');
    });

    it('escolher quem já está na lista faz o mesmo que o botão da linha: abre o editor com uma guia a mais (e não adiciona de novo)', () => {
      const props = base();
      render(<ClientesDoMes {...props} />);
      buscar('ana');
      fireEvent.click(opcaoDaBusca(/Ana Souza/));
      expect(props.onAdicionar).not.toHaveBeenCalled();
      expect(guiasAbertas('Ana Souza')).toHaveLength(2);
      expect((screen.getByLabelText('Adicionar cliente à lista do mês') as HTMLInputElement).value).toBe('');
    });

    it('escolher quem já está na lista e não tem guia lançada só abre o editor', () => {
      render(<ClientesDoMes {...base()} />);
      buscar('bruno');
      fireEvent.click(opcaoDaBusca(/Bruno Lima/));
      expect(guiasAbertas('Bruno Lima')).toHaveLength(1);
    });

    it('quem não está na lista continua sendo adicionado, sem a marca', () => {
      const props = base();
      render(<ClientesDoMes {...props} />);
      buscar('davi');
      const opcao = opcaoDaBusca(/Davi Rocha/);
      expect(norm(opcao.textContent)).not.toContain('já na lista');
      fireEvent.click(opcao);
      expect(props.onAdicionar).toHaveBeenCalledWith('d');
    });

    it('acha quem já está na lista também pela carteirinha', () => {
      render(<ClientesDoMes {...base()} />);
      buscar('2002');
      expect(opcaoDaBusca(/Bruno Lima/)).toBeTruthy();
    });

    it('cliente no limite de 6 guias aparece, mas a opção fica desligada e diz por quê', () => {
      render(<ClientesDoMes {...base()} />);
      buscar('carla');
      const opcao = opcaoDaBusca(/Carla Dias/);
      expect(opcao.disabled).toBe(true);
      expect(norm(opcao.textContent)).toContain('já na lista · já tem 6 guias neste mês (o máximo)');
      fireEvent.click(opcao);
      expect(screen.queryByRole('group', { name: /Códigos e sessões/ })).toBeNull();
    });

    it('com algo digitado em outro cliente, escolher na busca também pergunta antes de descartar', () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<ClientesDoMes {...base()} />);
      abrir('Bruno Lima');
      fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '4' } });
      buscar('ana');
      fireEvent.click(opcaoDaBusca(/Ana Souza/));
      expect(confirmar).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeTruthy();
      confirmar.mockRestore();
    });

    it('o aviso de "nenhum cliente" não diz mais que quem já está na lista não aparece', () => {
      render(<ClientesDoMes {...base()} />);
      buscar('zzz');
      expect(screen.getByRole('status').textContent).toBe('Nenhum cliente encontrado. Confira o nome ou a carteirinha.');
    });

    it('enquanto grava, a busca fica desligada (ocupado)', () => {
      render(<ClientesDoMes {...base()} ocupado />);
      expect((screen.getByLabelText('Adicionar cliente à lista do mês') as HTMLInputElement).disabled).toBe(true);
    });

    it('com o filtro "Mostrar só quem falta" ligado, o cliente escolhido na busca aparece com o editor aberto', () => {
      render(<ClientesDoMes {...base()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar só quem falta' }));
      expect(screen.queryByText('Ana Souza')).toBeNull();
      buscar('ana');
      fireEvent.click(opcaoDaBusca(/Ana Souza/));
      expect(guiasAbertas('Ana Souza')).toHaveLength(2);
    });
  });
});

describe('BuscaDeCliente: a marca "já na lista" é só de quem pede (a busca de Pedir guias não muda)', () => {
  const candidatos = [
    { id: 'a', nome: 'Álvaro Pinto', carteirinha: '1001' },
    { id: 'b', nome: 'Beatriz Souza', carteirinha: '2002', jaNaLista: true },
  ];

  it('sem candidato "já na lista", a opção é a de sempre: sem marca e com onEscolher', () => {
    const onEscolher = vi.fn();
    render(<BuscaDeCliente candidatos={[candidatos[0]]} placeholder="p" rotulo="Procurar" onEscolher={onEscolher} />);
    fireEvent.change(screen.getByLabelText('Procurar'), { target: { value: 'alvaro' } });
    const opcao = screen.getByRole('button', { name: /Álvaro/ });
    expect(norm(opcao.textContent)).not.toContain('já na lista');
    expect((opcao as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(opcao);
    expect(onEscolher).toHaveBeenCalledWith('a');
  });

  it('candidato "já na lista" chama aoEscolherJaNaLista, não onEscolher', () => {
    const onEscolher = vi.fn(); const aoEscolherJaNaLista = vi.fn();
    render(<BuscaDeCliente candidatos={candidatos} placeholder="p" rotulo="Procurar" onEscolher={onEscolher} aoEscolherJaNaLista={aoEscolherJaNaLista} />);
    fireEvent.change(screen.getByLabelText('Procurar'), { target: { value: 'souza' } });
    fireEvent.click(screen.getByRole('button', { name: /Beatriz/ }));
    expect(aoEscolherJaNaLista).toHaveBeenCalledWith('b');
    expect(onEscolher).not.toHaveBeenCalled();
  });

  it('sem aoEscolherJaNaLista, quem está "já na lista" cai em onEscolher', () => {
    const onEscolher = vi.fn();
    render(<BuscaDeCliente candidatos={candidatos} placeholder="p" rotulo="Procurar" onEscolher={onEscolher} />);
    fireEvent.change(screen.getByLabelText('Procurar'), { target: { value: 'souza' } });
    fireEvent.click(screen.getByRole('button', { name: /Beatriz/ }));
    expect(onEscolher).toHaveBeenCalledWith('b');
  });

  it('o texto padrão do "nenhum cliente" continua o de antes (a busca de Pedir guias passa o dela)', () => {
    render(<BuscaDeCliente candidatos={[]} placeholder="p" rotulo="Procurar" onEscolher={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Procurar'), { target: { value: 'zzz' } });
    expect(screen.getByRole('status').textContent).toBe('Nenhum cliente encontrado. Quem já está na lista não aparece aqui.');
  });
});
