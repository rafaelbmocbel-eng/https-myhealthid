import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import EscolherModelo from '../components/angular/video/EscolherModelo';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import type { IntervaloVideo } from '../lib/angular/analiseVideo/tempo';
import type { ModeloUi } from '../lib/angular/analiseVideo/tiposUi';
import { MAX_QUADROS_PADRAO, planejarQuadros } from '../lib/angular/video/rastrear';

afterEach(cleanup);

const video = (duracao = 40): VideoCarregado => ({ url: 'blob:x', arquivo: new File([''], 'v.webm'), nome: 'v.webm', tamanho: 1000, duracao, largura: 640, altura: 480 });
const modelos: ModeloUi[] = [{ id: 'marcha', nome: 'Marcha (caminhada)', vista: 'Vista lateral', descricao: 'd', itens: [], comEventos: true }];

const props = (o: { taxaFps: number; intervalo: IntervaloVideo; fpsVideo?: number; duracao?: number; fpsSugerido?: number }) => ({
  video: video(o.duracao), modelos, modeloId: 'marcha', aoModelo: vi.fn(), fpsVideo: o.fpsVideo ?? 240, aoFpsVideo: vi.fn(), taxaFps: o.taxaFps, aoTaxa: vi.fn(),
  intervalo: o.intervalo, aoIntervalo: vi.fn(), avisos: [], aoRastrear: vi.fn(), aoSoMedir: vi.fn(), aoTrocarVideo: vi.fn(), fpsSugerido: o.fpsSugerido,
});

/** Tela com estado de verdade, como no app: o pai guarda a taxa e o trecho; `aoRastrear` registra o que o motor receberia. */
function Tela({ taxaInicial, intervaloInicial, aoRastrear, fpsVideo = 240, fpsSugerido }: { taxaInicial: number; intervaloInicial: IntervaloVideo; aoRastrear: (taxa: number, i: IntervaloVideo) => void; fpsVideo?: number; fpsSugerido?: number }) {
  const [taxa, setTaxa] = useState(taxaInicial);
  const [intervalo, setIntervalo] = useState(intervaloInicial);
  return (
    <EscolherModelo
      video={video()} modelos={modelos} modeloId="marcha" aoModelo={() => {}} fpsVideo={fpsVideo} aoFpsVideo={() => {}} taxaFps={taxa} aoTaxa={setTaxa}
      intervalo={intervalo} aoIntervalo={setIntervalo} avisos={[]} aoRastrear={() => aoRastrear(taxa, intervalo)} aoSoMedir={() => {}} aoTrocarVideo={() => {}} fpsSugerido={fpsSugerido}
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

describe('foco depois de resolver o aviso de limite (teclado e leitor de tela)', () => {
  const tela = () => render(<Tela taxaInicial={30} intervaloInicial={{ inicio: 3, fim: 33 }} aoRastrear={() => {}} />);

  it('"Reduzir o trecho" some com o aviso e o foco vai para o botão de rastrear, já liberado', () => {
    tela();
    fireEvent.click(screen.getByTestId('taxa-maxima'));
    const reduzir = screen.getByTestId('reduzir-trecho');
    act(() => reduzir.focus());
    expect(document.activeElement).toBe(reduzir);
    fireEvent.click(reduzir);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    expect(screen.getByTestId('botao-rastrear')).toBeEnabled();
    expect(document.activeElement).toBe(screen.getByTestId('botao-rastrear'));
  });

  it('"Escolher N q/s" também leva o foco para o botão de rastrear', () => {
    tela();
    fireEvent.click(screen.getByTestId('taxa-detalhada'));
    const sugerir = screen.getByTestId('sugerir-taxa');
    act(() => sugerir.focus());
    fireEvent.click(sugerir);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('botao-rastrear'));
  });

  it('resolver o limite por outro botão (a taxa rápida) não rouba o foco de quem está nele', () => {
    tela();
    fireEvent.click(screen.getByTestId('taxa-maxima'));
    const rapida = screen.getByTestId('taxa-rapida');
    act(() => rapida.focus());
    fireEvent.click(rapida);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    expect(document.activeElement).toBe(rapida);
  });

  it('o foco que sobrou de um clique de aviso não vira salto de foco depois: o botão de rastrear só o recebe uma vez', () => {
    tela();
    fireEvent.click(screen.getByTestId('taxa-maxima'));
    fireEvent.click(screen.getByTestId('reduzir-trecho'));
    const rastrear = screen.getByTestId('botao-rastrear');
    expect(document.activeElement).toBe(rastrear);
    const rapida = screen.getByTestId('taxa-rapida');
    act(() => rapida.focus());
    fireEvent.click(rapida);
    expect(document.activeElement).toBe(rapida);
  });
});

describe('a taxa que o gesto pede e não coube no trecho não é rebaixada em silêncio', () => {
  const corrida = { fpsVideo: 60, fpsSugerido: 60 };

  it('corrida (60 q/s) num vídeo de 60 q/s com trecho de 30 s: a tela diz a sugestão, o máximo do trecho e a taxa em que ficou', () => {
    render(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 30 }, ...corrida })} />);
    const aviso = screen.getByTestId('aviso-taxa-do-gesto');
    expect(aviso).toHaveTextContent('A sugestão para Marcha (caminhada) é 60 q/s');
    expect(aviso).toHaveTextContent('um trecho de 30,0 s comporta até 40 q/s');
    expect(aviso).toHaveTextContent('a análise ficou em 30 q/s');
    expect(aviso).toHaveTextContent('O trecho não foi encurtado.');
    expect(screen.getByTestId('usar-taxa-do-gesto')).toHaveTextContent('Usar 60 q/s e reduzir o trecho para 20 s');
    expect(aviso).toHaveAttribute('role', 'status');
    // o rastreio continua liberado: é só informação, a decisão é do profissional
    expect(screen.getByTestId('botao-rastrear')).toBeEnabled();
  });

  it('o botão encurta o trecho só quando tocado e escolhe a taxa do gesto', () => {
    const p = props({ taxaFps: 30, intervalo: { inicio: 2, fim: 32 }, ...corrida });
    render(<EscolherModelo {...p} />);
    expect(p.aoIntervalo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('usar-taxa-do-gesto'));
    expect(p.aoTaxa).toHaveBeenCalledWith(60);
    expect(p.aoIntervalo).toHaveBeenLastCalledWith({ inicio: 2, fim: 22 });
  });

  it('com estado de verdade: toca no botão, a taxa vira 60, o trecho 20 s, o aviso some e o foco vai para o botão de rastrear', () => {
    const rastreios: [number, IntervaloVideo][] = [];
    render(<Tela taxaInicial={30} intervaloInicial={{ inicio: 0, fim: 30 }} fpsVideo={60} fpsSugerido={60} aoRastrear={(t, i) => rastreios.push([t, i])} />);
    const botao = screen.getByTestId('usar-taxa-do-gesto');
    act(() => botao.focus());
    fireEvent.click(botao);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
    expect(screen.getByTestId('taxa-detalhada')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('limite-trecho')).toHaveTextContent('A 60 q/s o trecho máximo é 20 s.');
    expect(document.activeElement).toBe(screen.getByTestId('botao-rastrear'));
    fireEvent.click(screen.getByTestId('botao-rastrear'));
    expect(rastreios).toEqual([[60, { inicio: 0, fim: 20 }]]);
  });

  it('não aparece quando a taxa do gesto cabe no trecho, mesmo com o profissional numa taxa menor de propósito', () => {
    render(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 15 }, ...corrida })} />);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
  });

  it('não aparece quando a análise já está na taxa do gesto, nem quando o gesto pede 30 q/s ou menos', () => {
    const { rerender } = render(<EscolherModelo {...props({ taxaFps: 60, intervalo: { inicio: 0, fim: 15 }, ...corrida })} />);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
    rerender(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 30 }, fpsVideo: 60, fpsSugerido: 30 })} />);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
    rerender(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 30 }, fpsVideo: 60, fpsSugerido: 15 })} />);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
    rerender(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 30 }, fpsVideo: 60 })} />);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
  });

  it('vídeo de 30 q/s não tem taxa maior para oferecer: sem aviso', () => {
    render(<EscolherModelo {...props({ taxaFps: 30, intervalo: { inicio: 0, fim: 30 }, fpsVideo: 30, fpsSugerido: 60 })} />);
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
  });

  it('com o aviso de limite aberto (a taxa escolhida não cabe) só ele fala: os dois não aparecem juntos', () => {
    render(<EscolherModelo {...props({ taxaFps: 120, intervalo: { inicio: 0, fim: 30 }, fpsVideo: 240, fpsSugerido: 60 })} />);
    expect(screen.getByTestId('aviso-limite-trecho')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-taxa-do-gesto')).toBeNull();
  });
});
