import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CodigosPrePreenchidos } from '@/components/cassi/CodigosPrePreenchidos';
import { mesclarCodigosComPadrao, type CodigoFaturavel } from '@/lib/cassiFaturamento';
import { ConfiguracaoNaoSalva, type EscolhaDoModelo } from '@/lib/cassiModeloConfig';

const catalogoPadrao = mesclarCodigosComPadrao([]);
const norm = (t: string | null | undefined) => (t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

function montar(extra: Partial<React.ComponentProps<typeof CodigosPrePreenchidos>> = {}) {
  const onSalvar = vi.fn<(escolha: EscolhaDoModelo | null) => Promise<void>>().mockResolvedValue(undefined);
  const onAbrirConfiguracoes = vi.fn();
  const props = { catalogo: catalogoPadrao, salva: true, onSalvar, onAbrirConfiguracoes, ...extra };
  const r = render(<CodigosPrePreenchidos {...props} />);
  return { ...r, onSalvar: props.onSalvar as typeof onSalvar, onAbrirConfiguracoes: props.onAbrirConfiguracoes as typeof onAbrirConfiguracoes, props };
}
const botao = () => screen.getByRole('button', { name: 'Códigos pré-preenchidos' }) as HTMLButtonElement;
const abrir = () => { fireEvent.click(botao()); return screen.getByRole('dialog', { name: 'Códigos pré-preenchidos' }); };
const linha = (codigo: string) => screen.getByRole('checkbox', { name: `Já vem marcado: código ${codigo}` });
const marcado = (codigo: string) => linha(codigo).getAttribute('data-state') === 'checked';
const seletor = (codigo: string) => screen.getByLabelText(`Quantidade do código ${codigo}`) as HTMLSelectElement;
const salvar = () => screen.getByRole('button', { name: /^Salv(ar|ando…)$/ }) as HTMLButtonElement;
const codigosNaOrdem = () => within(screen.getByRole('list', { name: 'Códigos da lista' })).getAllByRole('listitem').map((li) => norm(li.textContent).split(' ')[0]);

describe('CodigosPrePreenchidos: a faixa da aba Faturamento', () => {
  it('mostra o que já vem marcado na guia nova: o modelo padrão enquanto ninguém escolheu', () => {
    montar();
    const faixa = screen.getByRole('region', { name: 'Códigos pré-preenchidos' });
    expect(norm(faixa.textContent)).toContain('Já vem marcado na guia nova');
    expect(norm(faixa.textContent)).toContain('144 × 1 · 012 × 10 · 160 × 10');
  });

  it('mostra a escolha dele quando existe, na ordem e com as quantidades dele', () => {
    const cat: CodigoFaturavel[] = catalogoPadrao.map((c) => ({ ...c, pre_preenchido: c.codigo === '301' ? { quantidade: 3 } : c.codigo === '160' ? { quantidade: 7 } : null }));
    montar({ catalogo: cat });
    expect(norm(screen.getByRole('region', { name: 'Códigos pré-preenchidos' }).textContent)).toContain('301 × 3 · 160 × 7'); // a ordem da lista de códigos
  });

  it('"nenhum código marcado" quando a escolha é não marcar nada', () => {
    montar({ catalogo: catalogoPadrao.map((c) => ({ ...c, pre_preenchido: null })) });
    expect(norm(screen.getByRole('region', { name: 'Códigos pré-preenchidos' }).textContent)).toContain('nenhum código marcado');
  });

  it('leitura da configuração falhando: o botão fica desligado e o aviso aparece', () => {
    montar({ indisponivel: true });
    expect(botao().disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Não consegui carregar suas configurações');
    fireEvent.click(botao());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sem erro de leitura não há aviso e o botão está ligado', () => {
    montar();
    expect(botao().disabled).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('CodigosPrePreenchidos: o diálogo', () => {
  it('lista TODOS os códigos do catálogo, com código, descrição, oficial, valor e limite', () => {
    montar();
    const dialogo = abrir();
    const itens = within(dialogo).getAllByRole('listitem');
    expect(itens).toHaveLength(7);
    expect(codigosNaOrdem()).toEqual(['144', '012', '160', '185', '131', '301', '020']);
    const texto = (codigo: string) => norm(itens.find((li) => norm(li.textContent).startsWith(codigo))!.textContent);
    expect(texto('160')).toContain('Atendimento fisioterapêutico ambulatorial ao paciente com disfunção decorrente de alterações do sistema músculo-esquelético');
    expect(texto('160')).toContain('5.00.00.160 · R$ 31,97 · máx. 10 por guia');
    expect(texto('144')).toContain('5.00.00.144 · R$ 65,62 · máx. 1 por guia');
    expect(texto('131')).toContain('2.01.03.131 · R$ 67,79 · máx. 10 no mês');
    expect(texto('185')).toContain('3.16.02.185 · R$ 108,44 · máx. 10 por guia');
  });

  it('usa o valor que o profissional configurou, e avisa quando um código está sem valor', () => {
    const cat = mesclarCodigosComPadrao([{ codigo: '012', descricao: 'Sessão', valor: 61.2 }, { codigo: '777', descricao: 'Meu código', valor: 0 }]);
    montar({ catalogo: cat });
    abrir();
    const itens = within(screen.getByRole('list', { name: 'Códigos da lista' })).getAllByRole('listitem').map((li) => norm(li.textContent));
    expect(itens.find((t) => t.startsWith('012'))).toContain('R$ 61,20');
    expect(itens.find((t) => t.startsWith('777'))).toContain('sem valor (defina em Configurações)');
    expect(itens.find((t) => t.startsWith('777'))).toContain('Meu código');
    expect(itens).toHaveLength(8); // os sete da tabela + o que ele criou
  });

  it('o padrão vem marcado: 144, 012 e 160; os outros quatro desmarcados', () => {
    montar();
    abrir();
    expect(['144', '012', '160'].map(marcado)).toEqual([true, true, true]);
    expect(['185', '131', '301', '020'].map(marcado)).toEqual([false, false, false, false]);
  });

  it('só os marcados têm quantidade e posição; a quantidade começa com a do modelo', () => {
    montar();
    abrir();
    expect(seletor('144').value).toBe('1');
    expect(seletor('012').value).toBe('10');
    expect(screen.queryByLabelText('Quantidade do código 185')).toBeNull();
    expect(screen.getByText('posição 1 de 3')).toBeTruthy();
    expect(screen.getByText('posição 3 de 3')).toBeTruthy();
  });

  it('marcar um código o coloca no fim dos marcados com a quantidade pronta; desmarcar o tira', () => {
    montar();
    abrir();
    fireEvent.click(linha('301'));
    expect(marcado('301')).toBe(true);
    expect(seletor('301').value).toBe('10');
    expect(codigosNaOrdem().slice(0, 4)).toEqual(['144', '012', '160', '301']);
    fireEvent.click(linha('012'));
    expect(marcado('012')).toBe(false);
    expect(screen.queryByLabelText('Quantidade do código 012')).toBeNull();
    expect(codigosNaOrdem().slice(0, 3)).toEqual(['144', '160', '301']);
    expect(screen.getByText('posição 3 de 3')).toBeTruthy();
  });

  it('a quantidade vai de 1 até o limite do código: 144 só 1; 131 até 10 no mês; 012 até 10', () => {
    montar();
    abrir();
    const opcoes = (codigo: string) => within(seletor(codigo)).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(opcoes('144')).toEqual(['1']);
    expect(opcoes('012')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    fireEvent.click(linha('131'));
    expect(opcoes('131')).toHaveLength(10);
    expect(seletor('131').value).toBe('10');
  });

  it('trocar a quantidade vale para o salvar', async () => {
    const { onSalvar } = montar();
    abrir();
    fireEvent.change(seletor('160'), { target: { value: '6' } });
    expect(seletor('160').value).toBe('6');
    await act(async () => { fireEvent.click(salvar()); });
    expect(onSalvar).toHaveBeenCalledWith([{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }, { codigo: '160', quantidade: 6 }]);
  });

  it('subir e descer mudam a ordem entre os marcados; o primeiro não sobe e o último não desce', async () => {
    const { onSalvar } = montar();
    abrir();
    const subir = (c: string) => screen.getByRole('button', { name: `Subir o código ${c}` }) as HTMLButtonElement;
    const descer = (c: string) => screen.getByRole('button', { name: `Descer o código ${c}` }) as HTMLButtonElement;
    expect(subir('144').disabled).toBe(true);
    expect(descer('160').disabled).toBe(true);
    expect(subir('012').disabled).toBe(false);
    fireEvent.click(subir('160'));
    expect(codigosNaOrdem().slice(0, 3)).toEqual(['144', '160', '012']);
    fireEvent.click(descer('144'));
    expect(codigosNaOrdem().slice(0, 3)).toEqual(['160', '144', '012']);
    await act(async () => { fireEvent.click(salvar()); });
    expect(onSalvar).toHaveBeenCalledWith([{ codigo: '160', quantidade: 10 }, { codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }]);
  });

  it('só os desmarcados não têm setas, e os desmarcados ficam depois dos marcados mesmo depois de mexer', () => {
    montar();
    abrir();
    fireEvent.click(linha('144'));
    expect(screen.queryByRole('button', { name: 'Subir o código 144' })).toBeNull();
    expect(codigosNaOrdem()).toEqual(['012', '160', '144', '185', '131', '301', '020']);
  });

  it('Salvar só liga quando algo mudou; voltar ao que era desliga de novo', () => {
    montar();
    abrir();
    expect(salvar().disabled).toBe(true);
    fireEvent.click(linha('301'));
    expect(salvar().disabled).toBe(false);
    fireEvent.click(linha('301'));
    expect(salvar().disabled).toBe(true);
  });

  it('"Voltar ao padrão (144, 012 e 160)" restaura os três e Salvar entrega exatamente o padrão', async () => {
    const cat: CodigoFaturavel[] = catalogoPadrao.map((c) => ({ ...c, pre_preenchido: c.codigo === '301' ? { quantidade: 3 } : null }));
    const { onSalvar } = montar({ catalogo: cat });
    abrir();
    expect(marcado('301')).toBe(true);
    expect(marcado('144')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão (144, 012 e 160)' }));
    expect(['144', '012', '160'].map(marcado)).toEqual([true, true, true]);
    expect(marcado('301')).toBe(false);
    expect(seletor('144').value).toBe('1');
    expect(codigosNaOrdem().slice(0, 3)).toEqual(['144', '012', '160']);
    await act(async () => { fireEvent.click(salvar()); });
    expect(onSalvar).toHaveBeenCalledWith([{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }, { codigo: '160', quantidade: 10 }]);
  });

  it('Cancelar fecha sem salvar e reabrir mostra de novo o que está valendo', () => {
    const { onSalvar } = montar();
    abrir();
    fireEvent.click(linha('301'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSalvar).not.toHaveBeenCalled();
    abrir();
    expect(marcado('301')).toBe(false);
  });

  it('Esc fecha o diálogo quando não está gravando', async () => {
    montar();
    const dialogo = abrir();
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('CodigosPrePreenchidos: salvar', () => {
  it('sucesso: fecha o diálogo', async () => {
    const { onSalvar } = montar();
    abrir();
    fireEvent.click(linha('301'));
    await act(async () => { fireEvent.click(salvar()); });
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(onSalvar).toHaveBeenCalledWith([
      { codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }, { codigo: '160', quantidade: 10 }, { codigo: '301', quantidade: 10 },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('durante a gravação os campos travam, o botão diz "Salvando…" e nem Esc nem Cancelar fecham', async () => {
    let concluir: () => void = () => {};
    const onSalvar = vi.fn(() => new Promise<void>((ok) => { concluir = ok; }));
    montar({ onSalvar });
    const dialogo = abrir();
    fireEvent.click(linha('301'));
    fireEvent.click(salvar());
    await waitFor(() => expect(salvar().textContent).toBe('Salvando…'));
    expect(salvar().disabled).toBe(true);
    expect((linha('144') as HTMLButtonElement).disabled).toBe(true);
    expect(seletor('012').disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Subir o código 012' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Descer o código 012' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Voltar ao padrão (144, 012 e 160)' }) as HTMLButtonElement).disabled).toBe(true);
    expect(dialogo.getAttribute('aria-busy')).toBe('true');
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => { concluir(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('erro: mostra uma mensagem simples, o diálogo continua aberto com o que foi escolhido e dá para tentar de novo', async () => {
    const onSalvar = vi.fn().mockRejectedValueOnce(new Error('sem permissão')).mockResolvedValueOnce(undefined);
    montar({ onSalvar });
    abrir();
    fireEvent.click(linha('301'));
    fireEvent.change(seletor('012'), { target: { value: '4' } });
    await act(async () => { fireEvent.click(salvar()); });
    expect(screen.getByRole('alert').textContent).toBe('Não consegui salvar: sem permissão');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(marcado('301')).toBe(true);
    expect(seletor('012').value).toBe('4');
    expect(salvar().disabled).toBe(false);
    await act(async () => { fireEvent.click(salvar()); });
    expect(onSalvar).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('um erro sem mensagem ainda diz que não conseguiu', async () => {
    montar({ onSalvar: vi.fn().mockRejectedValue({}) });
    abrir();
    fireEvent.click(linha('301'));
    await act(async () => { fireEvent.click(salvar()); });
    expect(screen.getByRole('alert').textContent).toBe('Não consegui salvar: erro');
  });

  it('o aviso de erro some quando tenta de novo', async () => {
    let falhar = true;
    const onSalvar = vi.fn(() => (falhar ? Promise.reject(new Error('x')) : new Promise<void>(() => {})));
    montar({ onSalvar });
    abrir();
    fireEvent.click(linha('301'));
    await act(async () => { fireEvent.click(salvar()); });
    expect(screen.getByRole('alert')).toBeTruthy();
    falhar = false;
    fireEvent.click(salvar());
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('CodigosPrePreenchidos: sem configuração salva', () => {
  it('avisa "Salve primeiro as Configurações CASSI", Salvar não grava e o atalho abre as Configurações (fechando o diálogo)', () => {
    const { onSalvar, onAbrirConfiguracoes } = montar({ salva: false });
    abrir();
    expect(screen.getByRole('alert').textContent).toContain('Salve primeiro as Configurações CASSI');
    fireEvent.click(linha('301'));
    expect(salvar().disabled).toBe(true);
    fireEvent.click(salvar());
    expect(onSalvar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Configurações CASSI' }));
    expect(onAbrirConfiguracoes).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com configuração salva não aparece o aviso nem o atalho', () => {
    montar();
    abrir();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir Configurações CASSI' })).toBeNull();
  });

  it('se o banco disser que não há configuração (outro aparelho a apagou), o diálogo mostra o aviso com o atalho, e não um erro genérico', async () => {
    const onSalvar = vi.fn().mockRejectedValue(new ConfiguracaoNaoSalva());
    const { onAbrirConfiguracoes } = montar({ onSalvar });
    abrir();
    fireEvent.click(linha('301'));
    await act(async () => { fireEvent.click(salvar()); });
    expect(screen.getByRole('alert').textContent).toContain('Salve primeiro as Configurações CASSI');
    expect(screen.queryByText(/Não consegui salvar/)).toBeNull();
    expect(salvar().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Configurações CASSI' }));
    expect(onAbrirConfiguracoes).toHaveBeenCalled();
  });
});

describe('CodigosPrePreenchidos: toque e leitor de tela', () => {
  it('todos os alvos de toque têm pelo menos 44 px (h-11 / w-11)', () => {
    montar();
    expect(botao().className).toContain('h-11');
    abrir();
    for (const c of ['144', '012', '160']) {
      expect(seletor(c).className).toContain('h-11');
      for (const verbo of ['Subir', 'Descer']) {
        const b = screen.getByRole('button', { name: `${verbo} o código ${c}` });
        expect(b.className).toContain('h-11');
        expect(b.className).toContain('w-11');
      }
    }
    for (const c of ['144', '185']) expect(linha(c).closest('span')!.className).toContain('h-11');
    for (const nome of ['Voltar ao padrão (144, 012 e 160)', 'Cancelar', 'Salvar']) expect(screen.getByRole('button', { name: nome }).className).toContain('h-11');
  });

  it('o diálogo tem nome e descrição; cada caixa e cada campo têm rótulo próprio', () => {
    montar();
    const dialogo = abrir();
    expect(dialogo.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(dialogo.getAttribute('aria-describedby')!)?.textContent).toMatch(/O que já foi lançado não muda/);
    for (const c of ['144', '012', '160', '185', '131', '301', '020']) expect(linha(c)).toBeTruthy();
    for (const c of ['144', '012', '160']) expect(seletor(c)).toBeTruthy();
  });

  it('a lista de códigos tem nome', () => {
    montar();
    abrir();
    expect(screen.getByRole('list', { name: 'Códigos da lista' })).toBeTruthy();
  });
});
