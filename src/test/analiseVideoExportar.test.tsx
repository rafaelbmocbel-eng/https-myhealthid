import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PainelExportar from '../components/angular/video/PainelExportar';
import { carregarExportarVideoDialog, exportarVideoDisponivel } from '../components/angular/video/exportarVideoLigacao';

afterEach(cleanup);

const base = {
  temAnalise: true, gerandoPdf: false, registrando: false, temPaciente: true, correcoes: { quadros: 0, pontos: 0 },
  aoBaixarVideo: () => {}, aoQuadroInstagram: () => {}, aoPdf: () => {}, aoSalvar: () => {}, aoAbrir: () => {}, aoRegistrar: () => {}, aoCopiar: () => {},
};

describe('ligação com a exportação do vídeo analisado', () => {
  it('a disponibilidade e o carregamento concordam entre si', async () => {
    const componente = await carregarExportarVideoDialog();
    expect(exportarVideoDisponivel()).toBe(componente !== null);
  });

  it('com o módulo disponível o botão "Baixar vídeo analisado" abre a exportação', () => {
    const aoBaixarVideo = vi.fn();
    render(<PainelExportar {...base} videoDisponivel aoBaixarVideo={aoBaixarVideo} />);
    const botao = screen.getByTestId('baixar-video');
    expect(botao).toBeEnabled();
    fireEvent.click(botao);
    expect(aoBaixarVideo).toHaveBeenCalledTimes(1);
  });

  it('sem o módulo o botão fica desligado e diz por quê, sem quebrar o resto', () => {
    const aoBaixarVideo = vi.fn();
    render(<PainelExportar {...base} videoDisponivel={false} aoBaixarVideo={aoBaixarVideo} />);
    const botao = screen.getByTestId('baixar-video');
    expect(botao).toBeDisabled();
    expect(botao).toHaveTextContent('Indisponível nesta versão do app');
    fireEvent.click(botao);
    expect(aoBaixarVideo).not.toHaveBeenCalled();
    expect(screen.getByTestId('baixar-quadro')).toBeEnabled();
    expect(screen.getByTestId('gerar-pdf')).toBeEnabled();
  });

  it('enquanto o módulo carrega o botão mostra o estado ocupado', () => {
    render(<PainelExportar {...base} videoDisponivel preparandoVideo />);
    expect(screen.getByTestId('baixar-video')).toBeDisabled();
  });
});
