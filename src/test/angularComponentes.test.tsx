import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PainelEstilo from '../components/angular/PainelEstilo';
import { ItensSvg, MarcacaoAngulo, MarcacaoReta, Ponto, Rotulo } from '../components/angular/MarcacaoSvg';
import { ESTILO_INSTAGRAM, ESTILO_PADRAO, LIMITES_ESTILO } from '../lib/angular/estilo';

describe('painel do estilo das linhas', () => {
  it('as predefinições aplicam o estilo e marcam a ativa', () => {
    const aoMudar = vi.fn();
    render(<PainelEstilo estilo={ESTILO_PADRAO} aoMudar={aoMudar} aoFechar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Padrão' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Instagram' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    expect(aoMudar).toHaveBeenCalledWith(ESTILO_INSTAGRAM);
    for (const nome of ['Alto contraste', 'Fino']) expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
  });

  it('espessura, cor, arco, rótulo e casas mudam só o que foi tocado', () => {
    const aoMudar = vi.fn();
    render(<PainelEstilo estilo={ESTILO_INSTAGRAM} aoMudar={aoMudar} aoFechar={() => {}} />);
    const esp = screen.getByLabelText('Espessura das linhas') as HTMLInputElement;
    expect(esp.min).toBe(String(LIMITES_ESTILO.espessura.min));
    expect(esp.max).toBe(String(LIMITES_ESTILO.espessura.max));
    fireEvent.change(esp, { target: { value: '12' } });
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, espessura: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Cor #ef4444' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, cor: '#ef4444' });
    fireEvent.click(screen.getByRole('button', { name: 'Arco do ângulo' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, mostrarArco: false });
    fireEvent.click(screen.getByRole('button', { name: 'Rótulo do ângulo' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, mostrarRotulo: false });
    fireEvent.click(screen.getByRole('button', { name: '118,4°' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, casasRotulo: 1 });
  });

  it('sem arco e sem rótulo some o que depende deles', () => {
    render(<PainelEstilo estilo={{ ...ESTILO_INSTAGRAM, mostrarArco: false, mostrarRotulo: false }} aoMudar={() => {}} aoFechar={() => {}} />);
    expect(screen.queryByLabelText('Tamanho do arco')).toBeNull();
    expect(screen.queryByLabelText('Tamanho do rótulo')).toBeNull();
  });

  it('fecha', () => {
    const aoFechar = vi.fn();
    render(<PainelEstilo estilo={ESTILO_PADRAO} aoMudar={() => {}} aoFechar={aoFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o estilo das linhas' }));
    expect(aoFechar).toHaveBeenCalled();
  });
});

describe('marcações em SVG', () => {
  const base = { estilo: ESTILO_INSTAGRAM, escala: 1, limites: { w: 1000, h: 1000 } };
  const renderSvg = (el: React.ReactElement) => render(<svg>{el}</svg>).container.querySelector('svg')!;

  it('o ângulo traz braços, arco, três pontas e o rótulo "118°" em pílula', () => {
    const svg = renderSvg(<MarcacaoAngulo {...base} vertice={{ x: 500, y: 500 }} a={{ x: 900, y: 500 }} b={{ x: 500, y: 900 }} graus={118} />);
    expect(svg.querySelectorAll('line').length).toBeGreaterThanOrEqual(2);
    expect(svg.querySelectorAll('path').length).toBe(1);
    expect(svg.querySelectorAll('circle').length).toBe(3);
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(svg.querySelector('text')!.textContent).toBe('118°');
    const linha = svg.querySelector('line')!;
    expect(Number(linha.getAttribute('stroke-width'))).toBeCloseTo(9, 6);
    expect(linha.getAttribute('stroke')).toBe('#4caf50');
  });

  it('a espessura segue a escala', () => {
    const svg = renderSvg(<MarcacaoReta {...base} escala={3} a={{ x: 0, y: 0 }} b={{ x: 100, y: 100 }} />);
    expect(Number(svg.querySelector('line')!.getAttribute('stroke-width'))).toBeCloseTo(27, 6);
  });

  it('o estilo padrão escreve o rótulo com contorno, sem pílula', () => {
    const svg = renderSvg(<Rotulo {...base} estilo={ESTILO_PADRAO} texto="5,7°" x={300} y={300} />);
    expect(svg.querySelector('rect')).toBeNull();
    const t = svg.querySelector('text')!;
    expect(t.getAttribute('stroke')).toBe('#000000');
    expect(t.textContent).toBe('5,7°');
  });

  it('o ponto usa a cor do papel e o contorno do estilo de alto contraste desenha halo nas retas', () => {
    const svg = renderSvg(<Ponto {...base} x={10} y={20} papel="b" />);
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe(ESTILO_INSTAGRAM.corPontoB);
    const alto = renderSvg(<MarcacaoReta {...base} estilo={{ ...ESTILO_INSTAGRAM, contorno: '#000000', contornoLinhas: true }} a={{ x: 0, y: 0 }} b={{ x: 100, y: 0 }} />);
    expect(alto.querySelectorAll('line').length).toBe(2);
  });

  it('os itens do núcleo esmaecem por grupo', () => {
    const itens = [{ tipo: 'ponto' as const, x: 1, y: 2, raio: 3, cor: '#f00', anel: '#fff', larguraAnel: 1, grupo: 'ombros' }];
    const { container } = render(<svg><ItensSvg itens={itens} opacidadePorGrupo={{ ombros: 0.6 }} /></svg>);
    expect(container.querySelector('circle')!.getAttribute('opacity')).toBe('0.6');
  });
});
