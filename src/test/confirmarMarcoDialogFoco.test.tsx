import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ConfirmarMarcoDialog from '@/components/resumoClinico/ConfirmarMarcoDialog';
import type { CirurgiaDoCliente } from '@/lib/resumoClinico/tipos';

// "Descartar o que digitei?" é um diálogo aninhado, sem gatilho: o Radix só sabe devolver o foco a um gatilho, então sem ajuda o foco
// ia para o body depois de "Continuar editando" (teclado do celular fechado, Tab voltando ao primeiro chip, leitor de tela perdido).

Element.prototype.scrollIntoView = vi.fn();

const CIRURGIA: CirurgiaDoCliente = { chave: 'historico_clinico:cirurgia:id:c1', tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: '' };

function montar() {
  return render(<ConfirmarMarcoDialog aberto cirurgia={CIRURGIA} salvando={false} erro={null} hoje="2026-11-15" onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
}

const dialogo = () => screen.getByRole('dialog', { name: 'Confirmar com a data real' });
const chip = (nome: string) => within(dialogo()).getByRole('button', { name: nome });
const campo = () => within(dialogo()).getByLabelText(/em que aconteceu/) as HTMLInputElement;
// Com a pergunta aberta o formulário fica escondido do leitor de tela (aria-hidden) mas continua na página.
const chipNaPagina = (nome: string) => Array.from(document.querySelectorAll('form button[aria-pressed]')).find((b) => b.textContent === nome) as HTMLElement;

function pedirParaFecharEContinuarEditando() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
}

describe('ConfirmarMarcoDialog: o foco depois de "Continuar editando"', () => {
  it('volta ao chip que tinha o foco (não fica no body)', async () => {
    montar();
    const cirurgia = chip('Cirurgia');
    cirurgia.focus();
    fireEvent.click(cirurgia);
    pedirParaFecharEContinuarEditando();
    await waitFor(() => expect(document.activeElement).toBe(chip('Cirurgia')));
  });

  it('volta ao campo de data em que o profissional estava digitando', async () => {
    montar();
    fireEvent.click(chip('Internação'));
    campo().focus();
    fireEvent.change(campo(), { target: { value: '2022-06-10' } });
    pedirParaFecharEContinuarEditando();
    await waitFor(() => expect(document.activeElement).toBe(campo()));
    expect(campo().value).toBe('2022-06-10');
  });

  it('se o campo que tinha o foco foi trocado enquanto a pergunta estava aberta, o foco vai ao primeiro campo do formulário', async () => {
    montar();
    campo().focus();
    fireEvent.change(campo(), { target: { value: '2022-06-10' } });
    fireEvent.keyDown(campo(), { key: 'Escape', code: 'Escape' });
    // Trocar a precisão refaz o campo (outro elemento): o guardado deixa de existir.
    fireEvent.click(chipNaPagina('Só sei o ano'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await waitFor(() => expect(document.activeElement).toBe(chipNaPagina('Cirurgia')));
  });

  it('se ninguém tinha o foco quando o profissional pediu para fechar, o foco também vai ao primeiro campo', async () => {
    montar();
    fireEvent.click(chip('Cirurgia'));
    // Toque fora do formulário (navegador que não foca o que se toca): no momento do pedido o foco está no body.
    const ativo = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body);
    fireEvent.keyDown(dialogo(), { key: 'Escape', code: 'Escape' });
    ativo.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await waitFor(() => expect(document.activeElement).toBe(chipNaPagina('Cirurgia')));
  });
});
