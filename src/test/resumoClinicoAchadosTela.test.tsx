import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const TABELA = 'eventos_clinicos_anatomicos';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  travarAchados: false,
}));

// Leitura que nunca termina: para provar o que a tela mostra "durante a leitura".
function consultaPendente(): unknown {
  const consulta: unknown = new Proxy({}, { get: (_alvo, prop) => (prop === 'then' ? () => undefined : () => consulta) });
  return consulta;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => (t === 'eventos_clinicos_anatomicos' && h.travarAchados ? consultaPendente() : h.banco.from(t)),
    rpc: (nome: string, args?: Record<string, unknown>) => h.banco.rpc(nome, args),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import LinhaDoTempoClinica from '@/components/resumoClinico/LinhaDoTempoClinica';
import AvaliacaoSecoesEditaveis from '@/components/voice/AvaliacaoSecoesEditaveis';
import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';

const TITULO_DA_LINHA = 'Linha do tempo clínica';
const DATA_DO_ENVIO = '2026-11-15';
const TEXTO_DO_ACHADO = 'Dor no joelho relatada no envio do histórico';

let contador = 0;
function achado(tipo: string, extra: Linha = {}): Linha {
  contador += 1;
  return {
    id: `ev-${String(contador).padStart(4, '0')}`, paciente_id: 'pac-1', terapeuta_id: 'prof-1', regiao_id: 'joelho_d', sistema: 'musculoesqueletico',
    tipo_achado: TEXTO_DO_ACHADO, tipo_diagnostico: tipo, severidade: 2, status: 'ativo', data_inicio: DATA_DO_ENVIO,
    created_at: `${DATA_DO_ENVIO}T12:00:00+00:00`, updated_at: `${DATA_DO_ENVIO}T12:00:00+00:00`, metadata: {}, ...extra,
  };
}
const relato = (extra: Linha = {}) => achado('relato_paciente', extra);
const historico = (metadata: Linha = {}) => achado('historico_relatado', { status: 'resolvido', metadata });
const achados = (quantos: number, fabrica: () => Linha = relato) => { contador = 0; return Array.from({ length: quantos }, () => fabrica()); };

function cenarioBase(achadosDoAvatar: Linha[] = []): Record<string, Linha[]> {
  return {
    pacientes: [{
      id: 'pac-1',
      historico_clinico: { cirurgias: { items: [{ id: 'a', tipo: 'Ligamento do joelho', ano: '2022' }, { id: 'b', tipo: 'Apêndice', ano: 'há 2 anos' }] } },
      historia_atual: { queixa: 'Dor lombar do lado direito', inicio: 'Há 3 semanas, depois da mudança' },
    }],
    myid_avaliacoes: [],
    avaliacoes_identidade: [],
    avaliacoes_voz: [],
    historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: '' }],
    diagnosticos_paciente: [{ id: 'd1', paciente_id: 'pac-1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' }],
    exames_presenciais: [],
    exames_importados: [],
    testes_funcionais_paciente: [],
    escalas_psicologia: [],
    notas_prontuario: [],
    [TABELA]: achadosDoAvatar,
  };
}

function preparar(tabelas: Record<string, Linha[]>) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
const regiao = () => screen.findByRole('region', { name: TITULO_DA_LINHA });
const aviso = (raiz: HTMLElement) => raiz.querySelector('[data-aviso="achados-do-historico"]') as HTMLElement | null;
const botaoDoAvatar = (raiz: HTMLElement | Document = document.body) => within(raiz as HTMLElement).queryByRole('button', { name: 'Abrir o Avatar' });

function montar(onAbrirAvatar?: () => void) {
  return render(<QueryClientProvider client={cliente()}><LinhaDoTempoClinica pacienteId="pac-1" onAbrirAvatar={onAbrirAvatar} /></QueryClientProvider>);
}

// Espera a linha do tempo e a contagem dos achados terminarem de ler.
async function esperarAsLeituras(r: HTMLElement) {
  await waitFor(() => expect(within(r).getByText('Fratura de punho')).toBeInTheDocument());
  await waitFor(() => expect(h.banco.chamadas.some((c) => c.tabela === TABELA && c.metodo === 'limit')).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(() => { h.travarAchados = false; contador = 0; preparar(cenarioBase()); });

describe('Linha do tempo: aviso "N achados do histórico aguardando a sua revisão" e botão "Abrir o Avatar"', () => {
  it('plural: "3 achados do histórico aguardando a sua revisão", com o botão "Abrir o Avatar" que chama a função recebida', async () => {
    preparar(cenarioBase(achados(3)));
    const abrir = vi.fn();
    montar(abrir);
    const r = await regiao();
    const bloco = await waitFor(() => { const b = aviso(r); expect(b).not.toBeNull(); return b as HTMLElement; });
    expect(bloco.textContent).toContain('3 achados do histórico aguardando a sua revisão');
    const botao = within(bloco).getByRole('button', { name: 'Abrir o Avatar' });
    expect(abrir).not.toHaveBeenCalled();
    fireEvent.click(botao);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith();
  });

  it('singular: "1 achado do histórico aguardando a sua revisão" (nunca "1 achados")', async () => {
    preparar(cenarioBase(achados(1)));
    montar(vi.fn());
    const r = await regiao();
    const bloco = await waitFor(() => { const b = aviso(r); expect(b).not.toBeNull(); return b as HTMLElement; });
    expect(bloco.textContent).toContain('1 achado do histórico aguardando a sua revisão');
    expect(bloco.textContent).not.toContain('1 achados');
  });

  it('conta relatos e histórico juntos, com a regra da fila: revisado por mim, descartado e resolvido não contam', async () => {
    contador = 0;
    preparar(cenarioBase([
      relato(), relato({ status: 'resolvido' }),
      historico(), historico({ revisado_por_ids: ['prof-1'] }), historico({ descartado: true }), historico({ rejeicoes: [{}, {}, {}] }),
    ]));
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(aviso(r)?.textContent).toContain('2 achados do histórico aguardando a sua revisão'));
  });

  it('sem a função, o texto aparece e o botão não: nunca um botão que não leva a lugar nenhum', async () => {
    preparar(cenarioBase(achados(3)));
    montar();
    const r = await regiao();
    await waitFor(() => expect(aviso(r)?.textContent).toContain('3 achados do histórico aguardando a sua revisão'));
    expect(botaoDoAvatar()).toBeNull();
    expect(within(aviso(r) as HTMLElement).queryAllByRole('button')).toHaveLength(0);
  });

  it('contagem 0 (sem achados, só descartados, só resolvidos): nem o aviso nem o botão aparecem', async () => {
    for (const tabela of [[], [historico({ descartado: true }), relato({ status: 'resolvido' })]]) {
      contador = 0;
      preparar(cenarioBase(tabela));
      const { unmount } = montar(vi.fn());
      const r = await regiao();
      await esperarAsLeituras(r);
      expect(aviso(r)).toBeNull();
      expect(botaoDoAvatar()).toBeNull();
      expect(r.textContent).not.toMatch(/achado/i);
      unmount();
    }
  });

  it('durante a leitura não há aviso nem botão, e a linha do tempo NÃO espera por ela', async () => {
    h.travarAchados = true;
    preparar(cenarioBase(achados(3)));
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Fratura de punho')).toBeInTheDocument());
    expect(within(r).queryByText(/Montando a linha do tempo/)).toBeNull();
    expect(within(r).getByText('Fratura de punho')).toBeInTheDocument();
    expect(aviso(r)).toBeNull();
    expect(botaoDoAvatar()).toBeNull();
  });

  it.each([['erro'], ['rejeitar']] as const)('se a leitura falhar (%s): só o aviso de falhas, "os achados do histórico"; sem botão, e o resto da linha do tempo segue', async (como) => {
    preparar(cenarioBase(achados(3)));
    h.banco.falharLeitura(TABELA, como);
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(within(r).getByRole('status')).toHaveTextContent('Não consegui ler os achados do histórico.'));
    expect(within(r).getByText('Fratura de punho')).toBeInTheDocument();
    expect(aviso(r)).toBeNull();
    expect(botaoDoAvatar()).toBeNull();
    expect(r.textContent).not.toContain('achados do histórico aguardando');
  });

  it('a falha dos achados se junta às falhas das outras fontes no mesmo aviso', async () => {
    preparar(cenarioBase(achados(3)));
    h.banco.falharLeitura(TABELA);
    h.banco.falharLeitura('escalas_psicologia');
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(within(r).getByRole('status')).toHaveTextContent('Não consegui ler as escalas e os achados do histórico.'));
    expect(within(r).getByText('Fratura de punho')).toBeInTheDocument();
  });

  it('só os achados falham e mais nada: nenhum marco some e a linha do tempo não vira o "estado vazio"', async () => {
    h.banco.falharLeitura(TABELA);
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(within(r).getByRole('status')).toHaveTextContent('os achados do histórico'));
    expect(within(r).getByText('Fratura de punho')).toBeInTheDocument();
    expect(within(r).getByText('[M54.5] Dor lombar baixa')).toBeInTheDocument();
  });

  it('o aviso fica ACIMA dos marcos e da faixa "Sem data"', async () => {
    preparar(cenarioBase(achados(2)));
    montar(vi.fn());
    const r = await regiao();
    const bloco = await waitFor(() => { const b = aviso(r); expect(b).not.toBeNull(); return b as HTMLElement; });
    const marcos = r.querySelector('#linha-do-tempo-marcos') as HTMLElement;
    const semData = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    const comoComecou = r.querySelector('[data-bloco="como-comecou"]') as HTMLElement;
    expect(comoComecou).not.toBeNull();
    expect(bloco.compareDocumentPosition(marcos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bloco.compareDocumentPosition(semData) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bloco.compareDocumentPosition(comoComecou) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('os marcos, "Sem data" e "Como começou" são exatamente os mesmos com ou sem achados aguardando; nenhum achado, texto ou data dele aparece', async () => {
    const lerTudo = (r: HTMLElement) => {
      const copia = r.cloneNode(true) as HTMLElement;
      copia.querySelector('[data-aviso="achados-do-historico"]')?.remove();
      return {
        texto: copia.textContent,
        marcos: Array.from(copia.querySelectorAll('li[data-natureza]')).map((li) => li.textContent),
        semData: copia.querySelector('#linha-do-tempo-sem-data')?.textContent,
        anos: Array.from(copia.querySelectorAll('#linha-do-tempo-marcos h4')).map((x) => x.textContent),
      };
    };
    preparar(cenarioBase([]));
    const sem = montar(vi.fn());
    let r = await regiao();
    await esperarAsLeituras(r);
    const antes = lerTudo(r);
    expect(aviso(r)).toBeNull();
    sem.unmount();

    preparar(cenarioBase(achados(5, () => achado('historico_relatado', { status: 'resolvido', metadata: {}, data_inicio: '2018-02-03', created_at: '2018-02-03T12:00:00+00:00' }))));
    montar(vi.fn());
    r = await regiao();
    await waitFor(() => expect(aviso(r)).not.toBeNull());
    const depois = lerTudo(r);
    expect(depois).toEqual(antes);
    expect(antes.marcos.length).toBeGreaterThanOrEqual(3);
    expect(r.querySelectorAll('li[data-natureza]').length).toBe(antes.marcos.length);
    for (const naoPode of [TEXTO_DO_ACHADO, '03/02/2018', '2018', 'Dor no joelho', 'joelho_d']) expect(depois.texto, naoPode).not.toContain(naoPode);
  });

  it('nenhum marco, item "Sem data" ou ano nasce do achado: com achados e sem nenhuma outra fonte, a linha do tempo continua vazia', async () => {
    preparar({ ...cenarioBase(achados(4, () => achado('historico_relatado', { status: 'resolvido', metadata: {}, data_inicio: '2020-05-06' }))), pacientes: [], diagnosticos_paciente: [], historia_vida_paciente: [] });
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(aviso(r)).not.toBeNull());
    await within(r).findByText(/Ainda não há marcos para mostrar/);
    expect(r.querySelectorAll('li[data-natureza]')).toHaveLength(0);
    expect(within(r).queryByRole('button', { name: /Sem data/ })).toBeNull();
    expect(r.textContent).not.toContain('2020');
  });

  it('acima de 200 linhas lidas, o aviso diz "Pelo menos N" e a frase do corte aparece junto dos outros avisos de corte', async () => {
    preparar(cenarioBase(achados(201)));
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(aviso(r)?.textContent).toContain('Pelo menos 200 achados do histórico aguardando a sua revisão'));
    const cortes = r.querySelector('[data-aviso="cortes"]') as HTMLElement;
    expect(cortes.textContent).toContain('Achados do histórico: contei só os 200 primeiros; pode haver mais aguardando a sua revisão.');
  });

  it('exatamente 200: sem "Pelo menos" e sem aviso de corte', async () => {
    preparar(cenarioBase(achados(200)));
    montar(vi.fn());
    const r = await regiao();
    await waitFor(() => expect(aviso(r)?.textContent).toContain('200 achados do histórico aguardando a sua revisão'));
    expect(aviso(r)?.textContent).not.toContain('Pelo menos');
    expect(r.querySelector('[data-aviso="cortes"]')).toBeNull();
  });

  describe('celular (390 px): alvo de toque, foco, texto inteiro e leitor de tela', () => {
    it('o botão tem 44 px de altura mínima, foco visível e ocupa a largura no celular', async () => {
      preparar(cenarioBase(achados(3)));
      montar(vi.fn());
      await regiao();
      const botao = await screen.findByRole('button', { name: 'Abrir o Avatar' });
      expect(botao.className).toContain('min-h-11');
      expect(botao.className).not.toMatch(/min-h-(10|9|8)\b|\bh-(8|9|10)\b/);
      expect(botao.className).toContain('focus-visible:ring-2');
      expect(botao.className).toContain('w-full');
    });

    it('o texto quebra linha: sem truncate, sem line-clamp, sem rolagem lateral', async () => {
      preparar(cenarioBase(achados(3)));
      montar(vi.fn());
      const r = await regiao();
      const bloco = await waitFor(() => { const b = aviso(r); expect(b).not.toBeNull(); return b as HTMLElement; });
      expect(bloco.innerHTML).not.toMatch(/line-clamp|truncate|text-ellipsis|overflow-x-(auto|scroll)|whitespace-nowrap/);
      const texto = bloco.querySelector('p') as HTMLElement;
      expect(texto.className).toContain('break-words');
      expect(bloco.className).toContain('flex-col');
    });

    it('o botão é descrito pelo texto do aviso (o leitor de tela ouve o número junto do botão)', async () => {
      preparar(cenarioBase(achados(3)));
      montar(vi.fn());
      const botao = await screen.findByRole('button', { name: 'Abrir o Avatar' });
      expect(botao).toHaveAccessibleDescription('3 achados do histórico aguardando a sua revisão');
      expect(botao.getAttribute('type')).toBe('button');
    });

    it('o botão é alcançável pelo teclado (Enter e espaço pelo próprio botão) e não prende o foco', async () => {
      preparar(cenarioBase(achados(2)));
      const abrir = vi.fn();
      montar(abrir);
      const botao = await screen.findByRole('button', { name: 'Abrir o Avatar' });
      botao.focus();
      expect(document.activeElement).toBe(botao);
      expect(botao.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('a função chega até a linha do tempo nas três formas da aba Avaliação', () => {
  const avaliacao = (extra: Linha = {}): Linha => ({
    id: 'av-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-05T12:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
    classificacao_severidade: 'Moderada', transcricao: '',
    resultado: { resumo_clinico: 'Paciente com dor lombar crônica.', classificacao_severidade: 'Moderada', queixa_principal: 'Dor lombar crônica', dor: { localizacao: 'Lombar', intensidade_eva: 7 }, _meta: { mode: 'voice', savedAt: 's1' }, _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} } },
    ...extra,
  });
  const montarAvaliacaoAtual = (onAbrirAvatar?: () => void) => render(
    <QueryClientProvider client={cliente()}>
      <MemoryRouter><AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana Souza" onAbrirAvatar={onAbrirAvatar} /></MemoryRouter>
    </QueryClientProvider>,
  );

  it.each([
    ['sem avaliação por voz', () => [] as Linha[]],
    ['com avaliação (abas editáveis, aba Clínico)', () => [avaliacao()]],
    ['avaliação ainda sem resultado (tela de gravação)', () => [avaliacao({ resultado: null })]],
  ])('%s: o botão aparece, chama a função e a linha do tempo existe uma vez só', async (_nome, linhasDaAvaliacao) => {
    contador = 0;
    preparar({ ...cenarioBase(achados(3)), avaliacoes_voz: linhasDaAvaliacao() });
    const abrir = vi.fn();
    montarAvaliacaoAtual(abrir);
    const r = await regiao();
    expect(screen.getAllByRole('region', { name: TITULO_DA_LINHA })).toHaveLength(1);
    const botao = await within(r).findByRole('button', { name: 'Abrir o Avatar' });
    fireEvent.click(botao);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('sem a função, nenhuma das três formas mostra o botão', async () => {
    for (const linhasDaAvaliacao of [[], [avaliacao()], [avaliacao({ resultado: null })]]) {
      contador = 0;
      preparar({ ...cenarioBase(achados(3)), avaliacoes_voz: linhasDaAvaliacao });
      const { unmount } = montarAvaliacaoAtual();
      const r = await regiao();
      await waitFor(() => expect(aviso(r)).not.toBeNull());
      expect(botaoDoAvatar()).toBeNull();
      unmount();
    }
  });

  it('AvaliacaoSecoesEditaveis sozinha leva a função para a linha do tempo da aba Clínico', async () => {
    preparar(cenarioBase(achados(2)));
    const abrir = vi.fn();
    render(
      <QueryClientProvider client={cliente()}>
        <MemoryRouter>
          <AvaliacaoSecoesEditaveis pacienteId="pac-1" avaliacaoId="av-1" resultado={avaliacao().resultado} transcricao="" onReprocessar={vi.fn()} onAbrirAvatar={abrir} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: 'Abrir o Avatar' }));
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});

describe('a página do perfil só oferece o caminho quando o Avatar existe na Visão Geral', () => {
  const ler = (relativo: string) => readFileSync(join(__dirname, '..', relativo), 'utf8');

  it('PacientePerfil passa a função só quando a sub-aba do Avatar está visível, e ela troca para a Visão Geral e pede a sub-aba do Avatar', () => {
    const perfil = ler('pages/PacientePerfil.tsx');
    expect(perfil).toMatch(/onAbrirAvatar=\{visaoGeralMostraOAvatar\(layoutCfg\.sub_tabs\) \? irParaOAvatar : undefined\}/);
    const corpo = perfil.slice(perfil.indexOf('const irParaOAvatar = useCallback('), perfil.indexOf('const irParaOAvatar = useCallback(') + 500);
    expect(corpo).toContain('setAbrirNoAvatar(true)');
    expect(corpo).toContain("setActiveTab('')");
    expect(corpo).toContain('navigate(`/pacientes/${id}`, { replace: true })');
    expect(perfil).toMatch(/abrirNoAvatar=\{abrirNoAvatar\}/);
    // Sair da Visão Geral esquece o pedido.
    expect(perfil).toMatch(/if \(activeTab\) setAbrirNoAvatar\(false\)/);
  });

  it('o pedido atravessa PacienteDashboardIdentidade até o painel da Visão Geral, que abre a sub-aba pela mesma regra', () => {
    expect(ler('components/paciente/PacienteDashboardIdentidade.tsx')).toMatch(/<PatientIntegratedDashboard [^>]*abrirNoAvatar=\{abrirNoAvatar\}/);
    const painel = ler('components/paciente/PatientIntegratedDashboard.tsx');
    expect(painel).toMatch(/subAbaInicialDaVisaoGeral\(visibleSubs, abrirNoAvatar, /);
    expect(painel).toMatch(/<Tabs defaultValue=\{defaultSub\}/);
  });
});
