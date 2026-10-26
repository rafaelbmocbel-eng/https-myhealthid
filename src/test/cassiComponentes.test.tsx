import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BuscaDeCliente } from '@/components/cassi/BuscaDeCliente';
import { SugestoesDoPedido } from '@/components/cassi/SugestoesDoPedido';
import { ClientesDoMes } from '@/components/cassi/ClientesDoMes';
import { LancamentoDoCliente } from '@/components/cassi/LancamentoDoCliente';
import { mesclarCodigosComPadrao, ordenarParaLancamento } from '@/lib/cassiFaturamento';

const candidatos = [
  { id: 'a', nome: 'Álvaro Pinto', carteirinha: '1001' },
  { id: 'b', nome: 'Beatriz Souza', carteirinha: '2002' },
  { id: 'c', nome: 'Carla Souza', carteirinha: '3003', encerrado: true },
];

describe('BuscaDeCliente', () => {
  const montar = (onEscolher = vi.fn(), extra = {}) => {
    render(<BuscaDeCliente candidatos={candidatos} placeholder="Procurar" rotulo="Procurar cliente" onEscolher={onEscolher} {...extra} />);
    return { onEscolher, campo: screen.getByLabelText('Procurar cliente') };
  };

  it('não mostra ninguém antes de digitar', () => {
    montar();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('acha pelo nome sem diferenciar acento nem maiúscula', async () => {
    const { campo } = montar();
    fireEvent.change(campo, { target: { value: 'alvaro' } });
    expect(screen.getByRole('button', { name: /Álvaro Pinto/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Beatriz/ })).toBeNull();
  });

  it('acha pela carteirinha', async () => {
    const { campo } = montar();
    fireEvent.change(campo, { target: { value: '2002' } });
    expect(screen.getByRole('button', { name: /Beatriz Souza/ })).toBeTruthy();
  });

  it('escolher chama onEscolher com o id e limpa o campo', async () => {
    const { campo, onEscolher } = montar();
    fireEvent.change(campo, { target: { value: 'souza' } });
    fireEvent.click(screen.getByRole('button', { name: /Beatriz Souza/ }));
    expect(onEscolher).toHaveBeenCalledWith('b');
    expect((campo as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('avisa quando não há ninguém com o que foi digitado', async () => {
    const { campo } = montar();
    fireEvent.change(campo, { target: { value: 'zzz' } });
    expect(screen.getByRole('status').textContent).toMatch(/Nenhum cliente encontrado/);
  });

  it('o aviso de "nenhum cliente" explica quem não aparece, no texto que a tela pediu', async () => {
    montar(vi.fn(), { semResultado: 'Quem já teve o pedido feito não aparece aqui.' });
    fireEvent.change(screen.getByLabelText('Procurar cliente'), { target: { value: 'zzz' } });
    expect(screen.getByRole('status').textContent).toBe('Nenhum cliente encontrado. Quem já teve o pedido feito não aparece aqui.');
  });

  it('marca quem está encerrado com o rótulo pedido', async () => {
    const { campo } = montar(vi.fn(), { rotuloEncerrado: 'encerrada · reativar' });
    fireEvent.change(campo, { target: { value: 'carla' } });
    expect(screen.getByRole('button', { name: /Carla Souza/ }).textContent).toContain('encerrada · reativar');
  });

  it('mostra no máximo 8 resultados', async () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, nome: `Cliente ${i}` }));
    render(<BuscaDeCliente candidatos={muitos} placeholder="p" rotulo="Procurar muitos" onEscolher={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Procurar muitos'), { target: { value: 'cliente' } });
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(8);
  });
});

describe('SugestoesDoPedido', () => {
  const sugestoes = [
    { id: '1', nome: 'Ana Souza', motivo: 'Sem guia' },
    { id: '2', nome: 'Bruno Lima', motivo: 'Pedir nova guia' },
  ];

  it('não aparece sem sugestões', () => {
    const { container } = render(<SugestoesDoPedido sugestoes={[]} onAdicionar={vi.fn()} onAdicionarTodos={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('começa recolhido: só o título e a contagem; nada entra sozinho', () => {
    const onAdicionar = vi.fn();
    render(<SugestoesDoPedido sugestoes={sugestoes} onAdicionar={onAdicionar} onAdicionarTodos={vi.fn()} />);
    expect(screen.getByText('Sugeridos pelo sistema (2)')).toBeTruthy();
    expect(screen.queryByText('Ana Souza')).toBeNull();
    expect(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }).getAttribute('aria-expanded')).toBe('false');
    expect(onAdicionar).not.toHaveBeenCalled();
  });

  it('aberto, mostra o motivo e adiciona um a um', async () => {
    const onAdicionar = vi.fn();
    render(<SugestoesDoPedido sugestoes={sugestoes} onAdicionar={onAdicionar} onAdicionarTodos={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }));
    expect(screen.getByText('Sem guia')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Bruno Lima ao pedido' }));
    expect(onAdicionar).toHaveBeenCalledWith('2');
  });

  it('"adicionar todos" manda todos os ids de uma vez', async () => {
    const onAdicionarTodos = vi.fn();
    render(<SugestoesDoPedido sugestoes={sugestoes} onAdicionar={vi.fn()} onAdicionarTodos={onAdicionarTodos} />);
    fireEvent.click(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar todos os 2 ao pedido/ }));
    expect(onAdicionarTodos).toHaveBeenCalledWith(['1', '2']);
  });

  it('enquanto adiciona em lote, os botões ficam desligados', async () => {
    render(<SugestoesDoPedido sugestoes={sugestoes} ocupado onAdicionar={vi.fn()} onAdicionarTodos={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }));
    expect((screen.getByRole('button', { name: 'Adicionar Ana Souza ao pedido' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Adicionar todos/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

const catalogo = ordenarParaLancamento(mesclarCodigosComPadrao([]));
const brlTxt = (t: string | null | undefined) => (t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

describe('LancamentoDoCliente', () => {
  const montar = (extra: Partial<React.ComponentProps<typeof LancamentoDoCliente>> = {}) => {
    const onSalvar = vi.fn(); const onCancelar = vi.fn();
    render(<LancamentoDoCliente nome="Ana Souza" catalogo={catalogo} inicial={[]} sessoesAgenda={0} onSalvar={onSalvar} onCancelar={onCancelar} {...extra} />);
    return { onSalvar, onCancelar };
  };
  const qtd = (codigo: string, guia = 1) => screen.getByLabelText(`Quantidade do código ${codigo} na guia ${guia}`) as HTMLInputElement;
  const digitar = (codigo: string, v: string, guia = 1) => fireEvent.change(qtd(codigo, guia), { target: { value: v } });

  it('mostra os seis códigos da tabela com código oficial, valor e limite', () => {
    montar();
    const guia = within(screen.getByRole('region', { name: 'Guia 1 de Ana Souza' }));
    const linhas = guia.getAllByRole('listitem');
    expect(linhas.map((l) => brlTxt(l.textContent).split(' ')[0])).toEqual(['012', '020', '144', '301', '131', '185']);
    const txt = (i: number) => brlTxt(linhas[i].textContent);
    expect(txt(0)).toContain('5.00.00.012 · R$ 57,70 · máx. 10 por guia');
    expect(txt(1)).toContain('5.00.00.020 · R$ 57,70 · máx. 10 por guia');
    expect(txt(2)).toContain('5.00.00.144 · R$ 65,62 · máx. 1 por guia');
    expect(txt(3)).toContain('2.01.03.301 · R$ 35,55 · máx. 10 por guia');
    expect(txt(4)).toContain('2.01.03.131 · R$ 67,79 · máx. 10 no mês');
    expect(txt(5)).toContain('3.16.02.185 · R$ 108,44 · máx. 10 por guia');
  });

  it('começa vazio e o total acompanha o que é digitado (10 de 012 = R$ 577,00)', () => {
    montar();
    expect(brlTxt(screen.getByText(/Total de Ana/).parentElement?.textContent)).toContain('R$ 0,00 · 0 sessões');
    digitar('012', '10');
    expect(brlTxt(screen.getByText(/Total de Ana/).parentElement?.textContent)).toContain('R$ 577,00 · 10 sessões');
    digitar('144', '1');
    expect(brlTxt(screen.getByText(/Total de Ana/).parentElement?.textContent)).toContain('R$ 642,62 · 10 sessões'); // a consulta não é sessão
  });

  it('o campo não passa do limite: 012 até 10, 144 só 1', () => {
    montar();
    digitar('012', '12');
    expect(qtd('012').value).toBe('10');
    digitar('144', '5');
    expect(qtd('144').value).toBe('1');
    expect(screen.getAllByText('no limite').length).toBe(2);
  });

  it('só aceita números: letras e sinais não entram', () => {
    montar();
    digitar('301', 'a-3x');
    expect(qtd('301').value).toBe('3');
    digitar('301', '');
    expect(qtd('301').value).toBe('');
  });

  it('os botões − e + respeitam 0 e o limite', () => {
    montar();
    const menos = screen.getByRole('button', { name: 'Diminuir o código 144 da guia 1' }) as HTMLButtonElement;
    const mais = screen.getByRole('button', { name: 'Aumentar o código 144 da guia 1' }) as HTMLButtonElement;
    expect(menos.disabled).toBe(true);
    fireEvent.click(mais);
    expect(qtd('144').value).toBe('1');
    expect(mais.disabled).toBe(true); // 144: no máximo 1 por guia
    fireEvent.click(menos);
    expect(qtd('144').value).toBe('');
  });

  it('o limite de 131 é do MÊS: o que sobra depende do que as outras guias já usaram', () => {
    montar({ inicial: [{ '131': 6 }] });
    fireEvent.click(screen.getByRole('button', { name: /Outra guia/ }));
    digitar('131', '9', 2);
    expect(qtd('131', 2).value).toBe('4'); // 10 no mês − 6 já usados
    digitar('131', '0', 2);
    digitar('131', '10', 1); // a primeira guia pode subir até 10 porque a segunda está vazia
    expect(qtd('131', 1).value).toBe('10');
    expect(screen.getByText('limite do mês já usado nas outras guias')).toBeTruthy();
  });

  it('duas guias no mês: 012 pode chegar a 10 em cada uma; a segunda pode ser tirada', () => {
    montar();
    digitar('012', '10');
    fireEvent.click(screen.getByRole('button', { name: /Outra guia/ }));
    digitar('012', '10', 2);
    expect(brlTxt(screen.getByText(/Total de Ana/).parentElement?.textContent)).toContain('R$ 1.154,00 · 20 sessões');
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a guia 2' }));
    expect(screen.queryByRole('region', { name: 'Guia 2 de Ana Souza' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tirar a guia 1' })).toBeNull(); // com uma guia só, não há o que tirar
  });

  it('no máximo 6 guias no mês', () => {
    montar();
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: /Outra guia/ }));
    expect(screen.getAllByRole('region', { name: /^Guia \d de Ana Souza$/ })).toHaveLength(6);
    expect((screen.getByRole('button', { name: /Outra guia/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('"usar 012 × N da agenda" monta as guias de 10 em 10 no código 012', () => {
    montar({ sessoesAgenda: 14 });
    fireEvent.click(screen.getByRole('button', { name: 'Usar 012 × 14 da agenda' }));
    expect(qtd('012', 1).value).toBe('10');
    expect(qtd('012', 2).value).toBe('4');
  });

  it('sem sessão na agenda não oferece "usar a agenda"', () => {
    montar({ sessoesAgenda: 0 });
    expect(screen.queryByRole('button', { name: /da agenda/ })).toBeNull();
  });

  it('salvar entrega as guias sem as vazias e sem quantidade zero; cancelar não salva', () => {
    const { onSalvar, onCancelar } = montar({ inicial: [{ '012': 4, '020': 2 }] });
    digitar('020', '0');
    fireEvent.click(screen.getByRole('button', { name: /Outra guia/ })); // fica vazia
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSalvar).toHaveBeenCalledWith([{ '012': 4 }]);
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true); // há algo digitado: Cancelar pergunta antes de descartar
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(onCancelar).toHaveBeenCalledTimes(1);
    confirmar.mockRestore();
  });

  it('o limite por guia vale também no campo da segunda guia (012 até 10, 144 só 1)', () => {
    montar({ inicial: [{ '012': 5 }] });
    fireEvent.click(screen.getByRole('button', { name: /Outra guia/ }));
    fireEvent.change(qtd('012', 2), { target: { value: '12' } });
    expect(qtd('012', 2).value).toBe('10');
    fireEvent.change(qtd('144', 2), { target: { value: '3' } });
    expect(qtd('144', 2).value).toBe('1');
  });

  it('o que já estava lançado volta preenchido', () => {
    montar({ inicial: [{ '012': 7, '301': 2 }, { '012': 3 }] });
    expect(qtd('012', 1).value).toBe('7');
    expect(qtd('301', 1).value).toBe('2');
    expect(qtd('012', 2).value).toBe('3');
  });

  it('código sem valor cadastrado avisa para definir em Configurações', () => {
    montar({ catalogo: [{ codigo: '777', descricao: 'Novo', valor: 0 }] });
    expect(screen.getByText('sem valor (defina em Configurações)')).toBeTruthy();
  });

  it('enquanto salva, os botões ficam desligados', () => {
    montar({ salvando: true });
    expect((screen.getByRole('button', { name: 'Salvando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ClientesDoMes', () => {
  const clientes = [
    { id: 'a', nome: 'Ana Souza', sessoesAgenda: 8, guias: [{ '012': 10, '144': 1 }] },
    { id: 'b', nome: 'Bruno Lima', sessoesAgenda: 1, guias: [] },
    { id: 'c', nome: 'Carla Dias', sessoesAgenda: 0, guias: [], encerrado: true },
  ];
  const base = () => ({
    mesLabel: 'outubro de 2026',
    clientes,
    candidatos: [{ id: 'd', nome: 'Davi Rocha', carteirinha: '4004' }],
    comSessaoFora: 3,
    catalogo,
    quantosPreencheriaComAgenda: 1,
    onAdicionar: vi.fn(), onAdicionarComSessao: vi.fn(), onRemover: vi.fn(), onLimpar: vi.fn(),
    onSalvarLancamento: vi.fn().mockResolvedValue(true), onPreencherComAgenda: vi.fn(),
  });
  const lista = () => within(screen.getByRole('list', { name: 'Clientes na lista do mês' }));

  it('mostra o mês, quantos estão na lista e quantos já têm códigos', () => {
    render(<ClientesDoMes {...base()} />);
    expect(screen.getByRole('heading', { name: 'Clientes de outubro de 2026' })).toBeTruthy();
    expect(screen.getByText('3 na lista · 1 com códigos')).toBeTruthy();
  });

  it('cada cliente mostra o que foi lançado e o valor; quem não tem avisa; a agenda aparece só como referência', () => {
    render(<ClientesDoMes {...base()} />);
    expect(brlTxt(lista().getByText(/012 × 10 · 144 × 1/).parentElement?.textContent)).toContain('012 × 10 · 144 × 1 · R$ 642,62');
    expect(lista().getAllByText('Sem códigos lançados')).toHaveLength(2);
    expect(lista().getByText('agenda: 8 sessões')).toBeTruthy();
    expect(lista().getByText('agenda: 1 sessão')).toBeTruthy();
    expect(lista().getByText('agenda: sem sessão atendida')).toBeTruthy();
    expect(lista().getByText('encerrado')).toBeTruthy();
  });

  it('acima do limite da CASSI fica sinalizado', () => {
    render(<ClientesDoMes {...base()} clientes={[{ id: 'a', nome: 'Ana Souza', sessoesAgenda: 0, guias: [{ '012': 11 }] }]} />);
    expect(screen.getByText(/acima do limite da CASSI/)).toBeTruthy();
  });

  it('aviso de quem falta lançar: conta, filtra e oferece preencher com a agenda', () => {
    const props = base();
    render(<ClientesDoMes {...props} />);
    expect(screen.getByText('2 clientes sem códigos lançados.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar só quem falta' }));
    expect(lista().queryByText('Ana Souza')).toBeNull();
    expect(lista().getByText('Bruno Lima')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos' }));
    expect(lista().getByText('Ana Souza')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher 1 com a agenda (código 012)' }));
    expect(props.onPreencherComAgenda).toHaveBeenCalledTimes(1);
  });

  it('sem ninguém faltando, o aviso não aparece', () => {
    render(<ClientesDoMes {...base()} clientes={[clientes[0]]} />);
    expect(screen.queryByText(/sem códigos lançados\./)).toBeNull();
  });

  it('tocar no cliente abre o lançamento dele; só um aberto por vez; tocar de novo fecha', () => {
    render(<ClientesDoMes {...base()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lançar códigos e sessões de Bruno Lima' }));
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lançar códigos e sessões de Ana Souza' }));
    expect(screen.queryByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Ana Souza' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Ana Souza' }));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('salvar entrega o cliente e as guias; ao dar certo o lançamento fecha', async () => {
    const props = base();
    render(<ClientesDoMes {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lançar códigos e sessões de Bruno Lima' }));
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(props.onSalvarLancamento).toHaveBeenCalledWith('b', [{ '012': 3 }]));
    await waitFor(() => expect(screen.queryByRole('group')).toBeNull());
  });

  it('se salvar falhar, o lançamento continua aberto com o que foi digitado', async () => {
    const props = base();
    props.onSalvarLancamento.mockResolvedValue(false);
    render(<ClientesDoMes {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lançar códigos e sessões de Bruno Lima' }));
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(props.onSalvarLancamento).toHaveBeenCalled());
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeTruthy();
    expect((screen.getByLabelText('Quantidade do código 012 na guia 1') as HTMLInputElement).value).toBe('3');
  });

  it('adicionar pela busca chama onAdicionar com o id', () => {
    const props = base();
    render(<ClientesDoMes {...props} />);
    fireEvent.change(screen.getByLabelText('Adicionar cliente à lista do mês'), { target: { value: 'davi' } });
    fireEvent.click(screen.getByRole('button', { name: /Davi Rocha/ }));
    expect(props.onAdicionar).toHaveBeenCalledWith('d');
  });

  it('"adicionar quem teve sessão" mostra quantos faltam e dispara; fica desligado quando não falta ninguém', () => {
    const props = base();
    const { rerender } = render(<ClientesDoMes {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' }));
    expect(props.onAdicionarComSessao).toHaveBeenCalledTimes(1);
    rerender(<ClientesDoMes {...props} comSessaoFora={0} />);
    expect((screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('tirar um cliente e limpar a lista chamam os callbacks certos', () => {
    const props = base();
    render(<ClientesDoMes {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tirar Bruno Lima da lista' }));
    expect(props.onRemover).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar lista' }));
    expect(props.onLimpar).toHaveBeenCalledTimes(1);
  });

  it('lista vazia: explica o que fazer e não oferece "limpar"', () => {
    render(<ClientesDoMes {...base()} clientes={[]} />);
    expect(screen.getByText(/Nenhum cliente na lista de outubro de 2026/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpar lista' })).toBeNull();
    expect(screen.getByText('0 na lista')).toBeTruthy();
  });

  it('enquanto a lista carrega não diz que está vazia; com erro ao carregar também não', () => {
    const { rerender } = render(<ClientesDoMes {...base()} clientes={[]} carregando />);
    expect(screen.getByRole('status').textContent).toBe('Carregando a lista…');
    expect(screen.queryByText(/Nenhum cliente na lista/)).toBeNull();
    rerender(<ClientesDoMes {...base()} clientes={[]} erro />);
    expect(screen.queryByText(/Nenhum cliente na lista/)).toBeNull();
  });

  it('enquanto a agenda chega ninguém "não teve sessão"; se a agenda falhar, avisa; e não oferece usar a agenda', () => {
    const { rerender } = render(<ClientesDoMes {...base()} sessoesEstado="carregando" />);
    expect(lista().getAllByText('agenda: carregando…')).toHaveLength(3);
    expect(lista().queryByText('agenda: sem sessão atendida')).toBeNull();
    rerender(<ClientesDoMes {...base()} sessoesEstado="erro" />);
    expect(lista().getAllByText('agenda indisponível')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Lançar códigos e sessões de Bruno Lima' }));
    expect(screen.queryByRole('button', { name: /da agenda/ })).toBeNull();
  });

  it('ocupado desliga a busca, os botões e o remover', () => {
    render(<ClientesDoMes {...base()} ocupado />);
    expect((screen.getByLabelText('Adicionar cliente à lista do mês') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Tirar Ana Souza da lista' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Limpar lista' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('LancamentoDoCliente: dado acima do limite, código fora da lista, singular', () => {
  const montar = (extra: Partial<React.ComponentProps<typeof LancamentoDoCliente>> = {}) => {
    const onSalvar = vi.fn();
    render(<LancamentoDoCliente nome="Ana Souza" catalogo={catalogo} inicial={[]} sessoesAgenda={0} onSalvar={onSalvar} onCancelar={vi.fn()} {...extra} />);
    return { onSalvar };
  };
  const qtd = (codigo: string, guia = 1) => screen.getByLabelText(`Quantidade do código ${codigo} na guia ${guia}`) as HTMLInputElement;
  const salvar = () => screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement;

  it('quantidade antiga acima do limite aparece em vermelho, impede salvar e dá para descer um por vez', () => {
    // 131 vale 10 no mês e há 8 + 5 = 13 (por exemplo, depois de juntar dois cadastros)
    const { onSalvar } = montar({ inicial: [{ '131': 8 }, { '131': 5 }] });
    expect(screen.getAllByText('acima do limite da CASSI')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toMatch(/acima do limite da CASSI/);
    expect(salvar().disabled).toBe(true);
    fireEvent.click(salvar());
    expect(onSalvar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir o código 131 da guia 1' }));
    expect(qtd('131', 1).value).toBe('7'); // um por vez, sem pular para o limite
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir o código 131 da guia 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir o código 131 da guia 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir o código 131 da guia 1' }));
    expect(qtd('131', 1).value).toBe('4'); // 4 + 5 = 9
    expect(screen.queryByText('acima do limite da CASSI')).toBeNull();
    expect(salvar().disabled).toBe(false);
  });

  it('quem já está acima do limite não consegue aumentar mais', () => {
    montar({ inicial: [{ '012': 12 }] });
    expect((screen.getByRole('button', { name: 'Aumentar o código 012 da guia 1' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(qtd('012'), { target: { value: '15' } });
    expect(qtd('012').value).toBe('12');
  });

  it('código lançado que não está mais na lista de códigos continua à vista, vale zero e dá para zerar', () => {
    const { onSalvar } = montar({ inicial: [{ '012': 2, '777': 3 }] });
    expect(screen.getByText(/fora da lista de códigos/)).toBeTruthy();
    expect(qtd('777').value).toBe('3');
    fireEvent.change(qtd('777'), { target: { value: '0' } });
    expect(screen.queryByLabelText('Quantidade do código 777 na guia 1')).toBeNull();
    fireEvent.click(salvar());
    expect(onSalvar).toHaveBeenCalledWith([{ '012': 2 }]);
  });

  it('o botão da agenda diz o que vai lançar (012 × N); com 1 sessão é 012 × 1; passando de 60 mostra os 60 que cabem', () => {
    montar({ sessoesAgenda: 1 });
    expect(screen.getByRole('button', { name: 'Usar 012 × 1 da agenda' })).toBeTruthy();
    document.body.innerHTML = '';
    montar({ sessoesAgenda: 70 });
    expect(screen.getByRole('button', { name: 'Usar 012 × 60 da agenda' })).toBeTruthy();
  });

  it('"usar da agenda" com algo já digitado pergunta antes de trocar; sem nada digitado troca direto', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    montar({ sessoesAgenda: 14, inicial: [{ '301': 2 }] });
    fireEvent.click(screen.getByRole('button', { name: 'Usar 012 × 14 da agenda' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(qtd('301').value).toBe('2'); // recusou: o digitado fica
    confirmar.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Usar 012 × 14 da agenda' }));
    expect(qtd('012', 1).value).toBe('10');
    expect(screen.queryByLabelText('Quantidade do código 301 na guia 1')).not.toBeNull();
    expect(qtd('301', 1).value).toBe('');
    confirmar.mockRestore();
  });

  it('Cancelar com algo digitado pergunta antes de descartar; sem alteração cancela direto', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCancelar = vi.fn();
    montar({ onCancelar });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(confirmar).not.toHaveBeenCalled(); // nada digitado
    expect(onCancelar).toHaveBeenCalledTimes(1);
    fireEvent.change(qtd('012'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(onCancelar).toHaveBeenCalledTimes(1); // recusou
    confirmar.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(2);
    confirmar.mockRestore();
  });

  it('enquanto grava mostra "Salvando…" e trava os campos e botões', () => {
    montar({ inicial: [{ '012': 2 }], salvando: true });
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeTruthy();
    expect(qtd('012').disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Aumentar o código 012 da guia 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Outra guia/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Ana Souza' }).getAttribute('aria-busy')).toBe('true');
  });
});

describe('ClientesDoMes: estado do editor e do filtro', () => {
  const clientes = [
    { id: 'a', nome: 'Ana Souza', sessoesAgenda: 8, guias: [{ '012': 10 }] },
    { id: 'b', nome: 'Bruno Lima', sessoesAgenda: 1, guias: [] },
    { id: 'c', nome: 'Carla Dias', sessoesAgenda: 4, guias: [] },
  ];
  const base = () => ({
    mesLabel: 'outubro de 2026', clientes, candidatos: [], comSessaoFora: 0, catalogo, quantosPreencheriaComAgenda: 2,
    onAdicionar: vi.fn(), onAdicionarComSessao: vi.fn(), onRemover: vi.fn(), onLimpar: vi.fn(),
    onSalvarLancamento: vi.fn().mockResolvedValue(true), onPreencherComAgenda: vi.fn(),
  });
  const abrir = (nome: string) => fireEvent.click(screen.getByRole('button', { name: `Lançar códigos e sessões de ${nome}` }));

  it('trocar de cliente (ou fechar) com algo digitado e não salvo pergunta antes de descartar', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ClientesDoMes {...base()} />);
    abrir('Bruno Lima');
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '4' } });
    abrir('Carla Dias'); // outro cliente: pergunta
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeTruthy(); // recusou: continua no mesmo
    expect((screen.getByLabelText('Quantidade do código 012 na guia 1') as HTMLInputElement).value).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Bruno Lima' })); // fechar também pergunta
    expect(confirmar).toHaveBeenCalledTimes(2);
    confirmar.mockReturnValue(true);
    abrir('Carla Dias');
    expect(screen.queryByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Carla Dias' })).toBeTruthy();
    confirmar.mockClear();
    abrir('Ana Souza'); // Carla não foi alterada: troca sem perguntar
    expect(confirmar).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });

  it('"Mostrar só quem falta" não deixa a lista vazia quando o último cliente recebe lançamento', () => {
    const props = base();
    const { rerender } = render(<ClientesDoMes {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar só quem falta' }));
    expect(screen.queryByText('Ana Souza')).toBeNull();
    const todosLancados = clientes.map((c) => ({ ...c, guias: [{ '012': 1 }] }));
    rerender(<ClientesDoMes {...props} clientes={todosLancados} />);
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.getByText('Carla Dias')).toBeTruthy();
  });

  it('a gravação lenta de um cliente não fecha o lançamento que o profissional abriu depois', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true); // neste teste o rascunho de Bruno ainda conta como não salvo (a tela real passa `salvando`)
    const props = base();
    let concluir: (ok: boolean) => void = () => {};
    props.onSalvarLancamento.mockImplementation(() => new Promise<boolean>((r) => { concluir = r; }));
    render(<ClientesDoMes {...props} />);
    abrir('Bruno Lima');
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    abrir('Carla Dias'); // abre outro enquanto o primeiro ainda está gravando
    fireEvent.change(screen.getByLabelText('Quantidade do código 012 na guia 1'), { target: { value: '7' } });
    concluir(true);
    await waitFor(() => expect(props.onSalvarLancamento).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Carla Dias' })).toBeTruthy();
    expect((screen.getByLabelText('Quantidade do código 012 na guia 1') as HTMLInputElement).value).toBe('7');
    confirmar.mockRestore();
  });

  it('quem sai da lista não fica "aberto": se voltar, o lançamento não reabre sozinho', () => {
    const props = base();
    const { rerender } = render(<ClientesDoMes {...props} />);
    abrir('Bruno Lima');
    expect(screen.getByRole('group', { name: 'Códigos e sessões de Bruno Lima' })).toBeTruthy();
    rerender(<ClientesDoMes {...props} clientes={clientes.filter((c) => c.id !== 'b')} />);
    expect(screen.queryByRole('group')).toBeNull();
    rerender(<ClientesDoMes {...props} />);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('com um lançamento aberto, "preencher com a agenda" fica desligado (não troca por baixo do que está digitado)', () => {
    const props = base();
    render(<ClientesDoMes {...props} />);
    const preencher = () => screen.getByRole('button', { name: 'Preencher 2 com a agenda (código 012)' }) as HTMLButtonElement;
    expect(preencher().disabled).toBe(false);
    abrir('Bruno Lima');
    expect(preencher().disabled).toBe(true);
    expect(preencher().title).toMatch(/Feche o lançamento aberto/);
  });

  it('a linha do cliente aponta para o resumo (leitor de tela ouve códigos, valor e aviso)', () => {
    render(<ClientesDoMes {...base()} />);
    const botao = screen.getByRole('button', { name: 'Lançar códigos e sessões de Ana Souza' });
    const resumo = document.getElementById(botao.getAttribute('aria-describedby') || '');
    expect(resumo?.textContent).toContain('012 × 10');
  });
});
