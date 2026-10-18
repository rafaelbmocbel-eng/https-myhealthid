import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));

const escritas: string[] = [];
interface DocPdf { text: (txt: string | string[], x: number, y: number, op?: { align?: string }) => unknown }

// Anota cada texto escrito no PDF: o conteúdo do arquivo não é texto legível no teste.
vi.mock('jspdf', async (importarOriginal) => {
  const original = await importarOriginal<{ default: new (...args: unknown[]) => DocPdf }>();
  const Real = original.default;
  function Embrulhado(this: unknown, ...args: unknown[]) {
    const doc = new Real(...args);
    const text = doc.text.bind(doc);
    doc.text = (txt, x, y, op) => {
      for (const linha of Array.isArray(txt) ? txt : [txt]) escritas.push(String(linha));
      return text(txt, x, y, op);
    };
    return doc;
  }
  Object.assign(Embrulhado, Real);
  Embrulhado.prototype = Real.prototype;
  return { ...original, default: Embrulhado };
});

import ListaAchados from '../components/angular/video/laudo/ListaAchados';
import { BIBLIOTECA, montarLaudo, protocoloDo, type LaudoMovimento } from '../lib/angular/movimento';
import { TEXTO_METODO_FONTES } from '../lib/angular/movimento/frases';
import { gerarPdfLaudo } from '../lib/angular/movimento/laudoPdf';
import { achado, analiseFixa, BIBLIOTECA_FIXA, contexto } from './movimentoLaudoFixtures';

/*
 * Re-curadoria metodológica (agente R2): cada fonte exibida no laudo (tela e PDF) mostra a qualidade metodológica e a limitação principal, e o método
 * do laudo diz que as fontes foram escolhidas por critérios explícitos e a conferir pelo time científico.
 */

function laudoReal(): LaudoMovimento {
  const frontal = protocoloDo('agachamento_frontal');
  const lateral = protocoloDo('agachamento_lateral');
  return montarLaudo(analiseFixa('agachamento_frontal', [
    achado('valgo_dinamico', frontal, { gatilho: 'assimetria_entre_lados', lado: 'D', valoresPorLado: { D: 8, E: 4 } }),
    achado('inclinacao_tronco', lateral, { gatilho: 'variacao_entre_repeticoes', lado: null, medida: 'inclinacao_tronco_fundo' }),
  ]), contexto(), BIBLIOTECA);
}

describe('qualidade metodológica das fontes no laudo', () => {
  it('o método do laudo traz a frase das fontes escolhidas por critérios explícitos, com a conferência pelo time científico', () => {
    const laudo = laudoReal();
    expect(TEXTO_METODO_FONTES).toBe('Fontes escolhidas por critérios metodológicos explícitos; avaliação feita pelo MyHealthID a partir do resumo e do texto completo indexado, a ser conferida pelo time científico.');
    expect(laudo.metodo.paragrafos).toContain(TEXTO_METODO_FONTES);
    const semBiblioteca = montarLaudo(analiseFixa(), contexto(), BIBLIOTECA_FIXA);
    expect(semBiblioteca.metodo.paragrafos).toContain(TEXTO_METODO_FONTES);
  });

  it('toda referência do laudo com a biblioteca real traz qualidade alta ou moderada e a limitação principal', () => {
    const laudo = laudoReal();
    expect(laudo.referencias.length).toBeGreaterThan(3);
    for (const r of laudo.referencias) {
      expect(['alta', 'moderada'], `PMID ${r.fonte.pmid}`).toContain(r.fonte.qualidade);
      expect((r.fonte.limitacaoPrincipal ?? '').length, `PMID ${r.fonte.pmid}`).toBeGreaterThan(20);
    }
  });

  it('a tela mostra "Qualidade metodológica" e a limitação principal em cada fonte citada', () => {
    render(<ListaAchados laudo={laudoReal()} />);
    const cartoes = screen.getAllByTestId('achado');
    fireEvent.click(within(cartoes[0]).getByRole('button', { name: /Possíveis fatores contribuintes/ }));
    const fontes = within(cartoes[0]).getAllByTestId('fonte-do-achado');
    expect(fontes.length).toBeGreaterThan(2);
    for (const f of fontes) {
      const q = within(f).getByTestId('qualidade-da-fonte');
      expect(q.textContent).toMatch(/^Qualidade metodológica: (alta|moderada)\. Limitação principal: .+\.$/);
    }
  });

  it('o PDF escreve a qualidade metodológica e a limitação principal na lista de referências', async () => {
    escritas.length = 0;
    const laudo = laudoReal();
    // O jsdom não implementa canvas e reclama a cada chamada: sem contexto, o gráfico simplesmente fica de fora do PDF.
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof getContext;
    try {
      await gerarPdfLaudo(laudo);
    } finally {
      HTMLCanvasElement.prototype.getContext = getContext;
    }
    const todas = escritas.join(' ');
    for (const r of laudo.referencias) {
      const limitacao = (r.fonte.limitacaoPrincipal ?? '').slice(0, 30);
      expect(todas, `PMID ${r.fonte.pmid}`).toContain(`Qualidade metodológica: ${r.fonte.qualidade}`);
      expect(todas, `PMID ${r.fonte.pmid}`).toContain(limitacao);
    }
    expect(todas).toContain('Fontes escolhidas por critérios metodológicos explícitos');
  });
});
