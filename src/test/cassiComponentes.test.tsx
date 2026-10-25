import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BuscaDeCliente } from '@/components/cassi/BuscaDeCliente';
import { SugestoesDoPedido } from '@/components/cassi/SugestoesDoPedido';
import { ClientesDoMes } from '@/components/cassi/ClientesDoMes';

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

describe('ClientesDoMes', () => {
  const base = {
    mesLabel: 'outubro de 2026',
    clientes: [
      { id: 'a', nome: 'Ana Souza', sessoes: 8 },
      { id: 'b', nome: 'Bruno Lima', sessoes: 1 },
      { id: 'c', nome: 'Carla Dias', sessoes: 0, encerrado: true },
    ],
    candidatos: [{ id: 'd', nome: 'Davi Rocha', carteirinha: '4004' }],
    comSessaoFora: 3,
    onAdicionar: vi.fn(), onAdicionarComSessao: vi.fn(), onRemover: vi.fn(), onLimpar: vi.fn(),
  };

  it('mostra o mês, a contagem e as sessões de cada cliente (singular, plural e sem sessão)', () => {
    render(<ClientesDoMes {...base} />);
    expect(screen.getByRole('heading', { name: 'Clientes de outubro de 2026' })).toBeTruthy();
    expect(screen.getByText('3 na lista')).toBeTruthy();
    const lista = within(screen.getByRole('list', { name: 'Clientes na lista do mês' }));
    expect(lista.getByText('8 sessões')).toBeTruthy();
    expect(lista.getByText('1 sessão')).toBeTruthy();
    expect(lista.getByText('sem sessão atendida')).toBeTruthy();
    expect(lista.getByText('encerrado')).toBeTruthy();
  });

  it('adicionar pela busca chama onAdicionar com o id', async () => {
    const onAdicionar = vi.fn();
    render(<ClientesDoMes {...base} onAdicionar={onAdicionar} />);
    fireEvent.change(screen.getByLabelText('Adicionar cliente à lista do mês'), { target: { value: 'davi' } });
    fireEvent.click(screen.getByRole('button', { name: /Davi Rocha/ }));
    expect(onAdicionar).toHaveBeenCalledWith('d');
  });

  it('"adicionar quem teve sessão" mostra quantos faltam e dispara; fica desligado quando não falta ninguém', async () => {
    const onAdicionarComSessao = vi.fn();
    const { rerender } = render(<ClientesDoMes {...base} onAdicionarComSessao={onAdicionarComSessao} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' }));
    expect(onAdicionarComSessao).toHaveBeenCalledTimes(1);
    rerender(<ClientesDoMes {...base} comSessaoFora={0} onAdicionarComSessao={onAdicionarComSessao} />);
    const botao = screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });

  it('tirar um cliente e limpar a lista chamam os callbacks certos', async () => {
    const onRemover = vi.fn(); const onLimpar = vi.fn();
    render(<ClientesDoMes {...base} onRemover={onRemover} onLimpar={onLimpar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tirar Bruno Lima da lista' }));
    expect(onRemover).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar lista' }));
    expect(onLimpar).toHaveBeenCalledTimes(1);
  });

  it('lista vazia: explica o que fazer e não oferece "limpar"', () => {
    render(<ClientesDoMes {...base} clientes={[]} />);
    expect(screen.getByText(/Nenhum cliente na lista de outubro de 2026/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpar lista' })).toBeNull();
    expect(screen.getByText('0 na lista')).toBeTruthy();
  });

  it('enquanto a lista carrega não diz que está vazia', () => {
    render(<ClientesDoMes {...base} clientes={[]} carregando />);
    expect(screen.getByRole('status').textContent).toBe('Carregando a lista…');
    expect(screen.queryByText(/Nenhum cliente na lista/)).toBeNull();
  });

  it('com erro ao carregar também não diz que está vazia (a tela mostra o aviso)', () => {
    render(<ClientesDoMes {...base} clientes={[]} erro />);
    expect(screen.queryByText(/Nenhum cliente na lista/)).toBeNull();
  });

  it('ocupado desliga a busca, os botões e o remover', () => {
    render(<ClientesDoMes {...base} ocupado />);
    expect((screen.getByLabelText('Adicionar cliente à lista do mês') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Tirar Ana Souza da lista' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Limpar lista' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
