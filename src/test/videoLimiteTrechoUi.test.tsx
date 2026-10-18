import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import EscolherModelo from '../components/angular/video/EscolherModelo';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import type { IntervaloVideo } from '../lib/angular/analiseVideo/tempo';
import type { ModeloUi } from '../lib/angular/analiseVideo/tiposUi';
import { MAX_QUADROS_PADRAO, planejarQuadros } from '../lib/angular/video/rastrear';

afterEach(cleanup);

const video = (duracao = 40): VideoCarregado => ({ url: 'blob:x', arquivo: new File([''], 'v.webm'), nome: 'v.webm', tamanho: 1000, duracao, largura: 640, altura: 480 });
const modelos: ModeloUi[] = [{ id: 'marcha', nome: 'Marcha (caminhada)', vista: 'Vista lateral', descricao: 'd', itens: [], comEventos: true }];

const props = (o: { taxaFps: number; intervalo: IntervaloVideo; fpsVideo?: number; duracao?: number }) => ({
  video: video(o.duracao), modelos, modeloId: 'marcha', aoModelo: vi.fn(), fpsVideo: o.fpsVideo ?? 240, aoFpsVideo: vi.fn(), taxaFps: o.taxaFps, aoTaxa: vi.fn(),
  intervalo: o.intervalo, aoIntervalo: vi.fn(), avisos: [], aoRastrear: vi.fn(), aoSoMedir: vi.fn(), aoTrocarVideo: vi.fn(),
});

/** Tela com estado de verdade, como no app: o pai guarda a taxa e o trecho; `aoRastrear` registra o que o motor receberia. */
function Tela({ taxaInicial, intervaloInicial, aoRastrear, fpsVideo = 240 }: { taxaInicial: number; intervaloInicial: IntervaloVideo; aoRastrear: (taxa: number, i: IntervaloVideo) => void; fpsVideo?: number }) {
  const [taxa, setTaxa] = useState(taxaInicial);
  const [intervalo, setIntervalo] = useState(intervaloInicial);
  return (
    <EscolherModelo
      video={video()} modelos={modelos} modeloId="marcha" aoModelo={() => {}} fpsVideo={fpsVideo} aoFpsVideo={() => {}} taxaFps={taxa} aoTaxa={setTaxa}
      intervalo={intervalo} aoIntervalo={setIntervalo} avisos={[]} aoRastrear={() => aoRastrear(taxa, intervalo)} aoSoMedir={() => {}} aoTrocarVideo={() => {}}
    />
  );
}

describe('frase ao vivo do trecho máximo', () => {
  it('diz o máximo da taxa escolhida: 60 q/s, 20 s', () => {
    render(<EscolherModelo {...props({ taxaFps: 60, intervalo: { inicio: 0, fim: 15 } })} />);
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 60 q/s o trecho máximo é 20 s.');
  });

  it('muda junto com a taxa: 120 q/s, 10 s; 30 q/s, 30 s (limite do app)', () => {
    const { rerender } = render(<EscolherModelo {...props({ taxaFps: 120, intervalo: { inicio: 0, fim: 8 } })} />);
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 120 q/s o trecho máximo é 10 s.');
    rerender(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 8 } })} />);
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 30 q/s o trecho máximo é 30 s.');
  });

  it('aparece também em vídeo de 30 q/s, que só tem uma taxa', () => {
    render(<EscolherModelo {...props({ taxaFps: 30, fpsVideo: 30, intervalo: { inicio: 0, fim: 10 } })} />);
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 30 q/s o trecho máximo é 30 s.');
    expect(screen.queryByTestId('taxa-detalhada')).toBeNull();
  });

  it('cada taxa oferecida mostra, no próprio botão, o trecho até onde ela vai', () => {
    render(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 8 } })} />);
    expect(screen.getByTestId('taxa-rapida')).toHaveTextContent('30 q/s');
    expect(screen.getByTestId('taxa-rapida')).toHaveTextContent('trecho até 30 s');
    expect(screen.getByTestId('taxa-detalhada')).toHaveTextContent('trecho até 20 s');
    expect(screen.getByTestId('taxa-maxima')).toHaveTextContent('trecho até 10 s');
  });
});

describe('o trecho trava no máximo da taxa', () => {
  it('arrastar o fim além do máximo não passa: fica no máximo e o início não se mexe', () => {
    const p = props({ taxaFps: 60, intervalo: { inicio: 2, fim: 20 } });
    render(<EscolherModelo {...p} />);
    fireEvent.change(screen.getByLabelText('Fim do trecho'), { target: { value: '30' } });
    expect(p.aoIntervalo).toHaveBeenLastCalledWith({ inicio: 2, fim: 22 });
  });

  it('arrastar o início para trás além do máximo também trava, sem empurrar o fim', () => {
    const p = props({ taxaFps: 120, intervalo: { inicio: 10, fim: 20 } });
    render(<EscolherModelo {...p} />);
    fireEvent.change(screen.getByLabelText('Início do trecho'), { target: { value: '4' } });
    expect(p.aoIntervalo).toHaveBeenLastCalledWith({ inicio: 10, fim: 20 });
  });

  it('dentro do máximo, os controles andam livres', () => {
    const p = props({ taxaFps: 60, intervalo: { inicio: 2, fim: 12 } });
    render(<EscolherModelo {...p} />);
    fireEvent.change(screen.getByLabelText('Fim do trecho'), { target: { value: '18' } });
    expect(p.aoIntervalo).toHaveBeenLastCalledWith({ inicio: 2, fim: 18 });
  });
});

describe('taxa e trecho que não cabem juntos: nada é reduzido em silêncio', () => {
  it('60 q/s com 30 s: diz o máximo, oferece as duas saídas e trava o rastreio', () => {
    const p = props({ taxaFps: 60, intervalo: { inicio: 0, fim: 30 } });
    render(<EscolherModelo {...p} />);
    expect(screen.getByTestId('aviso-limite-trecho')).toHaveTextContent('O trecho de 30,0 s não cabe a 60 q/s: o máximo é 20 s.');
    expect(screen.getByTestId('sugerir-taxa')).toHaveTextContent('Para 30 s use até 40 q/s');
    expect(screen.getByTestId('sugerir-taxa')).toHaveTextContent('Escolher 30 q/s');
    expect(screen.getByTestId('reduzir-trecho')).toHaveTextContent('Reduzir o trecho para 20 s');
    const rastrear = screen.getByTestId('botao-rastrear');
    expect(rastrear).toBeDisabled();
    fireEvent.click(rastrear);
    expect(p.aoRastrear).not.toHaveBeenCalled();
  });

  it('o botão da sugestão escolhe a maior taxa oferecida que comporta o trecho, e o de reduzir encurta pelo fim', () => {
    const p = props({ taxaFps: 120, intervalo: { inicio: 4, fim: 22 } });
    render(<EscolherModelo {...p} />);
    expect(screen.getByTestId('sugerir-taxa')).toHaveTextContent('Para 18 s use até 66 q/s');
    fireEvent.click(screen.getByTestId('sugerir-taxa'));
    expect(p.aoTaxa).toHaveBeenCalledExactlyOnceWith(60);
    fireEvent.click(screen.getByTestId('reduzir-trecho'));
    expect(p.aoIntervalo).toHaveBeenLastCalledWith({ inicio: 4, fim: 14 });
  });

  it('o "Só medir" e o "Voltar à análise" não dependem do limite do rastreio', () => {
    const p = { ...props({ taxaFps: 60, intervalo: { inicio: 0, fim: 30 } }), aoUsarRastreio: vi.fn() };
    render(<EscolherModelo {...p} />);
    expect(screen.getByTestId('botao-so-medir')).toBeEnabled();
    expect(screen.getByTestId('botao-usar-rastreio')).toBeEnabled();
    expect(screen.getByTestId('botao-rastrear')).toBeDisabled();
  });

  it('trecho que cabe: sem aviso e o rastreio liberado', () => {
    const p = props({ taxaFps: 60, intervalo: { inicio: 0, fim: 20 } });
    render(<EscolherModelo {...p} />);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    fireEvent.click(screen.getByTestId('botao-rastrear'));
    expect(p.aoRastrear).toHaveBeenCalledTimes(1);
  });

  it('a velha frase de "taxa reduzida" não existe mais', () => {
    render(<EscolherModelo {...props({ taxaFps: 60, intervalo: { inicio: 0, fim: 30 } })} />);
    expect(screen.queryByTestId('aviso-taxa-reduzida')).toBeNull();
    expect(document.body.textContent).not.toMatch(/seria analisado a/);
  });
});

describe('fluxo completo na tela com estado (como no app)', () => {
  it('escolher uma taxa maior que o trecho comporta -> sugerir taxa -> a taxa volta e o trecho de 30 s se mantém', () => {
    const rastreios: [number, IntervaloVideo][] = [];
    render(<Tela taxaInicial={30} intervaloInicial={{ inicio: 0, fim: 30 }} aoRastrear={(t, i) => rastreios.push([t, i])} />);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    fireEvent.click(screen.getByTestId('taxa-detalhada'));
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 60 q/s o trecho máximo é 20 s.');
    expect(screen.getByTestId('aviso-limite-trecho')).toBeInTheDocument();
    expect(screen.getByTestId('botao-rastrear')).toBeDisabled();
    fireEvent.click(screen.getByTestId('sugerir-taxa'));
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    expect(screen.getByTestId('taxa-rapida')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('botao-rastrear')).toBeEnabled();
    fireEvent.click(screen.getByTestId('botao-rastrear'));
    expect(rastreios).toEqual([[30, { inicio: 0, fim: 30 }]]);
  });

  it('escolher uma taxa maior -> reduzir o trecho -> rastreia na taxa escolhida, com o trecho encurtado pelo profissional', () => {
    const rastreios: [number, IntervaloVideo][] = [];
    render(<Tela taxaInicial={30} intervaloInicial={{ inicio: 3, fim: 33 }} aoRastrear={(t, i) => rastreios.push([t, i])} />);
    fireEvent.click(screen.getByTestId('taxa-maxima'));
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 120 q/s o trecho máximo é 10 s.');
    fireEvent.click(screen.getByTestId('reduzir-trecho'));
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    fireEvent.click(screen.getByTestId('botao-rastrear'));
    expect(rastreios).toEqual([[120, { inicio: 3, fim: 13 }]]);
  });

  it('em nenhum caminho de cliques o rastreio libera uma combinação que o motor reduziria', () => {
    const caminhos: string[][] = [
      ['taxa-detalhada', 'sugerir-taxa'], ['taxa-maxima', 'reduzir-trecho'], ['taxa-detalhada', 'reduzir-trecho', 'taxa-maxima', 'sugerir-taxa'],
      ['taxa-maxima', 'taxa-detalhada', 'reduzir-trecho', 'taxa-rapida'], ['taxa-maxima', 'sugerir-taxa', 'taxa-detalhada', 'sugerir-taxa'],
    ];
    for (const caminho of caminhos) {
      const rastreios: [number, IntervaloVideo][] = [];
      const { unmount } = render(<Tela taxaInicial={30} intervaloInicial={{ inicio: 0, fim: 30 }} aoRastrear={(t, i) => rastreios.push([t, i])} />);
      for (const id of caminho) {
        fireEvent.click(screen.getByTestId(id));
        const rastrear = screen.getByTestId('botao-rastrear');
        if (!(rastrear as HTMLButtonElement).disabled) fireEvent.click(rastrear);
      }
      expect(rastreios.length, caminho.join(' > ')).toBeGreaterThan(0);
      for (const [taxa, i] of rastreios) {
        const plano = planejarQuadros(i.fim - i.inicio, taxa, MAX_QUADROS_PADRAO);
        expect(plano.fps, `${caminho.join(' > ')}: ${taxa} q/s em ${i.inicio}-${i.fim}`).toBe(taxa);
      }
      unmount();
    }
  });
});
