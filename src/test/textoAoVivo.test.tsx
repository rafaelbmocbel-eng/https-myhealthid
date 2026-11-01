import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextoAoVivo } from '@/components/voice/TextoAoVivo';

afterEach(() => {
  // jsdom não implementa scrollIntoView; os testes que o espiam definem e removem.
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe('TextoAoVivo', () => {
  it('fora de gravação e de finalização não mostra o painel (só a região muda de aviso, vazia)', () => {
    render(<TextoAoVivo ouvindo={false} transcrevendo={false} texto="dor no joelho" />);
    expect(screen.queryByText('dor no joelho')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('o leitor de tela só anuncia o estado ("Gravando"), não o texto que cresce a cada trecho; o texto fica visível no painel', () => {
    render(<TextoAoVivo ouvindo transcrevendo={false} texto="dor no joelho direito" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Gravando');
    expect(status.textContent).not.toContain('dor no joelho direito');
    expect(screen.getByText('dor no joelho direito')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('rótulos visuais: ouvindo ao vivo, ouvindo sem prévia (indisponível) e finalizando', () => {
    const { rerender } = render(<TextoAoVivo ouvindo transcrevendo={false} texto="" />);
    expect(screen.getByText(/o texto aparece conforme você fala/)).toBeTruthy();
    rerender(<TextoAoVivo ouvindo transcrevendo={false} texto="" indisponivel />);
    expect(screen.getByText(/o texto aparece ao parar/)).toBeTruthy();
    expect(screen.getByText(/A gravação continua normalmente/)).toBeTruthy();
    rerender(<TextoAoVivo ouvindo={false} transcrevendo texto="x" />);
    expect(screen.getByText('Finalizando a transcrição…')).toBeTruthy();
  });

  it('a região de aviso já existe antes da gravação e acompanha o fluxo: Gravando → Finalizando → Gravação finalizada', () => {
    const { rerender } = render(<TextoAoVivo ouvindo={false} transcrevendo={false} texto="" />);
    const regiao = screen.getByRole('status');
    expect(regiao.textContent).toBe('');
    rerender(<TextoAoVivo ouvindo transcrevendo={false} texto="" />);
    expect(screen.getByRole('status')).toBe(regiao); // o mesmo elemento: o leitor de tela anuncia a mudança de conteúdo
    expect(regiao.textContent).toBe('Gravando');
    rerender(<TextoAoVivo ouvindo={false} transcrevendo texto="" />);
    expect(regiao.textContent).toBe('Finalizando a transcrição');
    rerender(<TextoAoVivo ouvindo={false} transcrevendo={false} texto="" />);
    expect(regiao.textContent).toBe('Gravação finalizada');
  });

  it('ao começar a gravar traz o painel para a vista sem rolar a página se já estiver visível (block: nearest); finalizando não rola', () => {
    const rolar = vi.fn();
    (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = rolar;
    const { rerender } = render(<TextoAoVivo ouvindo={false} transcrevendo={false} texto="" />);
    expect(rolar).not.toHaveBeenCalled();
    rerender(<TextoAoVivo ouvindo transcrevendo={false} texto="" />);
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar).toHaveBeenCalledWith({ block: 'nearest' });
    rerender(<TextoAoVivo ouvindo transcrevendo={false} texto="mais um trecho" />);
    expect(rolar).toHaveBeenCalledTimes(1);
    rerender(<TextoAoVivo ouvindo={false} transcrevendo texto="mais um trecho" />);
    expect(rolar).toHaveBeenCalledTimes(1);
  });
});
