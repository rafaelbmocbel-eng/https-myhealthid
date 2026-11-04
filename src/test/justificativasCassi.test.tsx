import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  sucesso: vi.fn(),
  erro: vi.fn(),
  info: vi.fn(),
  copiar: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: h.invoke } } }));
vi.mock('sonner', () => ({ toast: { success: h.sucesso, error: h.erro, info: h.info } }));

import { JustificativasCassi, type TextosGerados } from '@/components/cassi/JustificativasCassi';

const ZWSP = '​';
const pronta = (texto: string, ajustado = false) => ({ texto, caracteres: texto.length, ajustado });

// O painel real guarda os textos fora do card; aqui o pai faz o mesmo e pode esconder/mostrar o card sem perder o que foi gerado.
function Montar({ codigos = ['301', '131'], diagnostico = 'Dorsalgia com hipercifose', musculos0 = 'trapézio superior, romboides', achados0 = '', onSalvarBase, textos0 = {} }: {
  codigos?: string[]; diagnostico?: string; musculos0?: string; achados0?: string; onSalvarBase?: () => Promise<boolean> | boolean; textos0?: TextosGerados;
}) {
  const [musculos, setMusculos] = useState(musculos0);
  const [achados, setAchados] = useState(achados0);
  const [textos, setTextos] = useState<TextosGerados>(textos0);
  const [visivel, setVisivel] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setVisivel((v) => !v)}>alternar card</button>
      {visivel && (
        <JustificativasCassi nome="Ana Souza" diagnostico={diagnostico} musculos={musculos} achados={achados} codigos={codigos}
          textos={textos} onTextos={setTextos} onMusculos={setMusculos} onAchados={setAchados} onSalvarBase={onSalvarBase} />
      )}
    </>
  );
}

const nomeDoCabecalho = /Justificativa \(301 e 131\) de Ana Souza/;
const abrir = () => fireEvent.click(screen.getByRole('button', { name: nomeDoCabecalho }));
const botaoGerar = () => screen.getByRole('button', { name: /Gerar (justificativas|de novo)/ }) as HTMLButtonElement;
const copiarDo = (cod: string) => screen.getByRole('button', { name: `Copiar justificativa do ${cod}` }) as HTMLButtonElement;
const campoDo = (cod: string) => screen.getByLabelText(`Justificativa do código ${cod} de Ana Souza`) as HTMLTextAreaElement;
const musculosInput = () => screen.getByLabelText('Músculos de Ana Souza') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: h.copiar.mockResolvedValue(undefined) }, configurable: true });
});

describe('JustificativasCassi — quando dá para gerar', () => {
  it('vem recolhida; abre ao clicar', () => {
    render(<Montar />);
    expect(screen.queryByLabelText('Músculos de Ana Souza')).toBeNull();
    abrir();
    expect(musculosInput()).toBeTruthy();
    expect(screen.getByLabelText('Achados do exame de Ana Souza')).toBeTruthy();
  });

  it('o nome acessível do cabeçalho contém o texto que se vê ("Justificativa (301 e 131)")', () => {
    render(<Montar />);
    const cabecalho = screen.getByRole('button', { name: nomeDoCabecalho });
    expect(cabecalho.getAttribute('aria-label')).toContain(cabecalho.textContent!.trim());
  });

  it('os campos têm o tamanho máximo do banco (400 e 600)', () => {
    render(<Montar />);
    abrir();
    expect(musculosInput().maxLength).toBe(400);
    expect((screen.getByLabelText('Achados do exame de Ana Souza') as HTMLTextAreaElement).maxLength).toBe(600);
  });

  it('sem o 301 nem o 131 marcados, não gera e diz o motivo, ligado ao botão', () => {
    render(<Montar codigos={['012', '144']} />);
    abrir();
    expect(botaoGerar().disabled).toBe(true);
    const motivo = screen.getByText(/Marque o código 301 ou o 131/);
    expect(botaoGerar().getAttribute('aria-describedby')).toBe(motivo.id);
  });

  it('o diagnóstico basta: 301 e 131, com ou sem músculos, geram; a tela explica que a IA sugere os músculos', () => {
    const { unmount } = render(<Montar codigos={['301']} musculos0="" />);
    abrir();
    expect(botaoGerar().disabled).toBe(false);
    expect(botaoGerar().getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByText(/Informe os músculos tratados/)).toBeNull();
    expect(screen.getByText(/Sem músculos informados, a IA sugere os do diagnóstico para o 301/)).toBeTruthy();
    unmount();
    render(<Montar codigos={['131']} musculos0="" />);
    abrir();
    expect(botaoGerar().disabled).toBe(false);
    expect(screen.queryByText(/a IA sugere os do diagnóstico/)).toBeNull(); // o 131 não depende de músculos
  });

  it('com músculos digitados some a dica de sugestão e aparece a contagem', () => {
    render(<Montar codigos={['301']} musculos0="trapézio superior" />);
    abrir();
    expect(screen.queryByText(/a IA sugere os do diagnóstico/)).toBeNull();
    expect(screen.getByText(/1 músculo\(s\) citado\(s\)/)).toBeTruthy();
  });

  it('sem diagnóstico não gera', () => {
    render(<Montar diagnostico="" />);
    abrir();
    expect(botaoGerar().disabled).toBe(true);
    expect(screen.getByText(/Preencha o diagnóstico/)).toBeTruthy();
  });

  it('o botão cita só os códigos marcados que têm justificativa', () => {
    render(<Montar codigos={['131', '012', '301']} />);
    abrir();
    expect(botaoGerar().textContent).toContain('(301, 131)');
  });

  it('avisa quantos músculos foram citados quando o 301 está marcado, e não quando não está', () => {
    const { unmount } = render(<Montar codigos={['301']} musculos0="trapézio superior, romboides e levantador da escápula" />);
    abrir();
    expect(screen.getByText(/3 músculo\(s\) citado\(s\)/)).toBeTruthy();
    unmount();
    render(<Montar codigos={['131']} musculos0="trapézio superior, romboides" />);
    abrir();
    expect(screen.queryByText(/músculo\(s\) citado\(s\)/)).toBeNull();
  });

  it('digitar músculos atualiza o campo e libera o botão', () => {
    render(<Montar musculos0="" codigos={['301']} />);
    abrir();
    fireEvent.change(musculosInput(), { target: { value: 'peitoral menor' } });
    expect(musculosInput().value).toBe('peitoral menor');
    expect(botaoGerar().disabled).toBe(false);
  });
});

describe('JustificativasCassi — gerar', () => {
  it('envia só diagnóstico, músculos, achados e os códigos marcados (nada que identifique o cliente)', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Texto 301.'), '131': pronta('Texto 131.') } }, error: null });
    render(<Montar achados0="bandas tensas palpáveis" />);
    abrir();
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    expect(h.invoke).toHaveBeenCalledWith('gerar-justificativa-cassi', {
      body: { diagnostico: 'Dorsalgia com hipercifose', musculos: 'trapézio superior, romboides', achados: 'bandas tensas palpáveis', codigos: ['301', '131'] },
    });
    expect(JSON.stringify(h.invoke.mock.calls[0])).not.toMatch(/Ana|Souza/);
  });

  it('mostra um quadro por código, com título, contador e botão de copiar; anuncia ao terminar', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Texto do trezentos e um.'), '131': pronta('Texto 131.') } }, error: null });
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    expect((await screen.findByLabelText('Justificativa do código 301 de Ana Souza') as HTMLTextAreaElement).value).toBe('Texto do trezentos e um.');
    expect(campoDo('131')).toBeTruthy();
    expect(screen.getByText(/Código 2\.01\.03\.301 \(Agulhamento seco\)/)).toBeTruthy();
    expect(screen.getByText(/Código 2\.01\.03\.131 \(EMG Biofeedback\)/)).toBeTruthy();
    expect(screen.getByText('24/500')).toBeTruthy();
    expect(screen.getByText('10/500')).toBeTruthy();
    expect(screen.getByText(/Rascunho gerado por IA/)).toBeTruthy();
    expect(botaoGerar().textContent).toContain('Gerar de novo');
    expect(screen.getByRole('status').textContent).toBe('Justificativas geradas.');
    expect(screen.getByText('24/500').getAttribute('aria-live')).toBeNull(); // o contador não reanuncia a cada tecla
  });

  it('só pede os códigos marcados (131 sozinho)', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '131': pronta('Texto 131.') } }, error: null });
    render(<Montar codigos={['131', '012']} />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 131 de Ana Souza');
    expect(h.invoke.mock.calls[0][1].body.codigos).toEqual(['131']);
    expect(screen.queryByLabelText('Justificativa do código 301 de Ana Souza')).toBeNull();
  });

  it('clique duplo em Gerar faz uma chamada só', async () => {
    let resolver: (v: unknown) => void = () => {};
    h.invoke.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(botaoGerar().disabled).toBe(true);
    resolver({ data: { justificativas: { '301': pronta('A.'), '131': pronta('B.') } }, error: null });
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
  });

  it('guarda os dados no cadastro ANTES de gerar, esperando terminar; se guardar falhar, gera mesmo assim', async () => {
    const ordem: string[] = [];
    let terminarSalvar: () => void = () => {};
    const onSalvarBase = vi.fn(() => new Promise<boolean>((r) => { ordem.push('salvando'); terminarSalvar = () => { ordem.push('salvou'); r(false); }; }));
    h.invoke.mockImplementation(async () => { ordem.push('gerou'); return { data: { justificativas: { '301': pronta('A.'), '131': pronta('B.') } }, error: null }; });
    render(<Montar onSalvarBase={onSalvarBase} />);
    abrir();
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(onSalvarBase).toHaveBeenCalled());
    expect(h.invoke).not.toHaveBeenCalled(); // ainda esperando o cadastro
    terminarSalvar();
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(ordem).toEqual(['salvando', 'salvou', 'gerou']);
  });

  it('se guardar lançar erro, gera mesmo assim', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('A.'), '131': pronta('B.') } }, error: null });
    render(<Montar onSalvarBase={async () => { throw new Error('rede'); }} />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
  });

  it('mostra o erro da função e não deixa texto na tela', async () => {
    h.invoke.mockResolvedValue({ data: { error: 'Limite de uso atingido. Tente em instantes.' }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Limite de uso atingido. Tente em instantes.'));
    expect(screen.queryByLabelText(/Justificativa do código/)).toBeNull();
    expect(botaoGerar().disabled).toBe(false);
  });

  it('falha de rede da chamada vira aviso e o botão volta a funcionar', async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request to the Edge Function') });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.erro).toHaveBeenCalled());
    expect(botaoGerar().disabled).toBe(false);
  });

  it('resposta sem nenhum texto é tratada como erro', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: {} }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('A IA não devolveu texto. Tente de novo.'));
  });

  it('avisa quando o texto foi encurtado para caber; o aviso some quando o profissional edita', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Texto.', true), '131': pronta('Outro.') } }, error: null });
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(screen.getAllByText(/Texto encurtado para caber em 500 caracteres/)).toHaveLength(1);
    fireEvent.change(campoDo('301'), { target: { value: 'Texto editado.' } });
    expect(screen.queryByText(/Texto encurtado para caber em 500 caracteres/)).toBeNull();
  });

  it('desmarcar um código tira o quadro dele da tela', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('A.'), '131': pronta('B.') } }, error: null });
    const { rerender } = render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 131 de Ana Souza');
    rerender(<Montar codigos={['301']} />);
    expect(screen.queryByLabelText('Justificativa do código 131 de Ana Souza')).toBeNull();
    expect(campoDo('301')).toBeTruthy();
  });

  it('o texto gerado e editado sobrevive a fechar e reabrir o card (os textos moram no painel)', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Texto do 301.'), '131': pronta('Texto do 131.') } }, error: null });
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    fireEvent.change(campoDo('301'), { target: { value: 'Texto do 301 editado à mão.' } });
    fireEvent.click(screen.getByRole('button', { name: 'alternar card' })); // some o card
    expect(screen.queryByRole('button', { name: nomeDoCabecalho })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'alternar card' })); // volta
    abrir();
    expect(campoDo('301').value).toBe('Texto do 301 editado à mão.');
    expect(campoDo('131').value).toBe('Texto do 131.');
  });
});

describe('JustificativasCassi — músculos sugeridos pela IA (só o diagnóstico)', () => {
  const LISTA = 'trapézio superior, romboides, levantador da escápula';
  const respostaComLista = (extra: Record<string, unknown> = {}) => ({
    data: { justificativas: { '301': pronta('Texto do 301.'), '131': pronta('Texto do 131.') }, musculos_sugeridos: LISTA, ...extra },
    error: null,
  });
  const gerarSemMusculos = async (props: Parameters<typeof Montar>[0] = {}) => {
    h.invoke.mockResolvedValue(respostaComLista());
    const r = render(<Montar musculos0="" {...props} />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    return r;
  };

  it('envia músculos vazios; a lista sugerida entra no campo (editável) e o texto nasce em dia com ela', async () => {
    await gerarSemMusculos();
    expect(h.invoke.mock.calls[0][1].body).toMatchObject({ diagnostico: 'Dorsalgia com hipercifose', musculos: '', codigos: ['301', '131'] });
    expect(musculosInput().value).toBe(LISTA);
    expect(copiarDo('301').disabled).toBe(false);
    expect(copiarDo('131').disabled).toBe(false);
    expect(screen.queryByText(/mudaram depois que este texto foi gerado/)).toBeNull();
    expect(screen.getByText(/Músculos sugeridos pela IA a partir do diagnóstico: confira e ajuste/)).toBeTruthy();
    expect(screen.getByText(/3 músculo\(s\) citado\(s\)/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/A IA sugeriu os músculos; confira o campo de músculos/);
    expect(h.info).not.toHaveBeenCalled();
  });

  it('editar a lista sugerida tira o aviso de sugestão e deixa os textos desatualizados (gerar de novo usa a lista do profissional)', async () => {
    await gerarSemMusculos();
    fireEvent.change(musculosInput(), { target: { value: 'trapézio superior, peitoral menor' } });
    expect(screen.queryByText(/Músculos sugeridos pela IA/)).toBeNull();
    expect(screen.getAllByText(/mudaram depois que este texto foi gerado/)).toHaveLength(2);
    expect(copiarDo('301').disabled).toBe(true);
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Novo 301.'), '131': pronta('Novo 131.') } }, error: null });
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    expect(h.invoke.mock.calls[1][1].body.musculos).toBe('trapézio superior, peitoral menor');
    await waitFor(() => expect(copiarDo('301').disabled).toBe(false));
    expect(musculosInput().value).toBe('trapézio superior, peitoral menor'); // não volta para a sugestão
  });

  it('gerar de novo com a lista sugerida no campo manda a lista como informada (a IA não sugere de novo)', async () => {
    await gerarSemMusculos();
    h.invoke.mockResolvedValue(respostaComLista({ musculos_sugeridos: '' }));
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    expect(h.invoke.mock.calls[1][1].body.musculos).toBe(LISTA);
    await waitFor(() => expect(botaoGerar().disabled).toBe(false));
    expect(musculosInput().value).toBe(LISTA);
  });

  it('com músculos já digitados, uma lista sugerida que venha na resposta NÃO sobrescreve o campo', async () => {
    h.invoke.mockResolvedValue(respostaComLista());
    render(<Montar musculos0="peitoral menor" />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(musculosInput().value).toBe('peitoral menor');
    expect(screen.queryByText(/Músculos sugeridos pela IA/)).toBeNull();
    expect(copiarDo('301').disabled).toBe(false);
  });

  it('se o profissional digitar músculos enquanto a IA trabalha, o que ele digitou fica e o texto chega marcado como desatualizado', async () => {
    let resolver: (v: unknown) => void = () => {};
    h.invoke.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<Montar musculos0="" />);
    abrir();
    fireEvent.click(botaoGerar());
    fireEvent.change(musculosInput(), { target: { value: 'peitoral menor' } });
    resolver(respostaComLista());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(musculosInput().value).toBe('peitoral menor');
    expect(copiarDo('301').disabled).toBe(true);
    expect(screen.queryByText(/Músculos sugeridos pela IA/)).toBeNull();
  });

  it('a IA não conseguiu sugerir (diagnóstico genérico): o texto aparece, o campo fica vazio e um aviso pede os músculos', async () => {
    h.invoke.mockResolvedValue(respostaComLista({ musculos_sugeridos: '' }));
    render(<Montar musculos0="" diagnostico="Dor" />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(musculosInput().value).toBe('');
    expect(h.info).toHaveBeenCalledWith(expect.stringMatching(/não conseguiu sugerir músculos só pelo diagnóstico/));
    expect(copiarDo('301').disabled).toBe(false);
  });

  it('resposta antiga, sem o campo musculos_sugeridos, funciona igual a "não sugeriu"', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Texto do 301.'), '131': pronta('Outro.') } }, error: null });
    render(<Montar musculos0="" />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(musculosInput().value).toBe('');
    expect(h.info).toHaveBeenCalledTimes(1);
  });

  it('só o 131, sem músculos: não preenche o campo nem avisa de sugestão', async () => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '131': pronta('Texto do 131.') }, musculos_sugeridos: LISTA }, error: null });
    render(<Montar codigos={['131']} musculos0="" />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 131 de Ana Souza');
    expect(h.invoke.mock.calls[0][1].body.codigos).toEqual(['131']);
    expect(musculosInput().value).toBe(''); // a sugestão só vale quando o 301 foi pedido
    expect(screen.queryByText(/Músculos sugeridos pela IA/)).toBeNull();
    expect(h.info).not.toHaveBeenCalled();
  });

  it('gerar de novo com a lista sugerida intacta mantém a marca de sugestão; depois de editar a lista, ela some', async () => {
    await gerarSemMusculos();
    h.invoke.mockResolvedValue(respostaComLista({ musculos_sugeridos: '' }));
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(botaoGerar().disabled).toBe(false));
    expect(screen.getByText(/Músculos sugeridos pela IA a partir do diagnóstico/)).toBeTruthy();
    fireEvent.change(musculosInput(), { target: { value: 'romboides' } });
    expect(screen.queryByText(/Músculos sugeridos pela IA/)).toBeNull();
  });

  it('a sugestão e o aviso sobrevivem a fechar e reabrir o card (moram nos textos do painel)', async () => {
    await gerarSemMusculos();
    fireEvent.click(screen.getByRole('button', { name: 'alternar card' }));
    fireEvent.click(screen.getByRole('button', { name: 'alternar card' }));
    abrir();
    expect(musculosInput().value).toBe(LISTA);
    expect(screen.getByText(/Músculos sugeridos pela IA a partir do diagnóstico/)).toBeTruthy();
  });

  it('a lista sugerida é limpa (invisíveis) antes de entrar no campo', async () => {
    h.invoke.mockResolvedValue(respostaComLista({ musculos_sugeridos: `${ZWSP}trapézio superior,  romboides ` }));
    render(<Montar musculos0="" />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(musculosInput().value).toBe('trapézio superior, romboides');
  });
});

describe('JustificativasCassi — o texto do 301 precisa citar os músculos do campo', () => {
  const gerarCom = async (texto301: string, musculos0 = 'trapézio superior, romboides') => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta(texto301), '131': pronta('Texto do 131 sem músculos.') } }, error: null });
    render(<Montar musculos0={musculos0} />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
  };

  it('texto que cita todos (sem diferenciar acento ou maiúscula) não leva aviso', async () => {
    await gerarCom('Indicado no Trapezio Superior e nos romboides.');
    expect(screen.queryByText(/O texto do 301 não cita/)).toBeNull();
  });

  it('texto que deixa músculo de fora avisa quais, só no quadro do 301, sem travar o Copiar', async () => {
    await gerarCom('Indicado no trapézio superior.');
    expect(screen.getAllByText(/O texto do 301 não cita: romboides\./)).toHaveLength(1);
    expect(screen.getByText(/ajuste o texto ou a lista de músculos antes de copiar/)).toBeTruthy();
    expect(copiarDo('301').disabled).toBe(false);
  });

  it('o aviso acompanha a edição: citar o músculo que faltava o faz sumir; trocar a lista o faz voltar', async () => {
    await gerarCom('Indicado no trapézio superior.');
    fireEvent.change(campoDo('301'), { target: { value: 'Indicado no trapézio superior e nos romboides.' } });
    expect(screen.queryByText(/O texto do 301 não cita/)).toBeNull();
    fireEvent.change(musculosInput(), { target: { value: 'trapézio superior, romboides, peitoral menor' } });
    expect(screen.getByText(/O texto do 301 não cita: peitoral menor\./)).toBeTruthy();
  });

  it('sem músculos no campo não há o que conferir', async () => {
    await gerarCom('Texto qualquer do 301.', '');
    expect(screen.queryByText(/O texto do 301 não cita/)).toBeNull();
  });
});

describe('JustificativasCassi — erro da função com a mensagem do servidor', () => {
  const abrirEGerar = async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
  };
  const erroHttp = (corpo: BodyInit, status: number) =>
    Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: new Response(corpo, { status }) });

  it('429 da função: o aviso mostra o texto do servidor, não a mensagem genérica do client', async () => {
    h.invoke.mockResolvedValue({ data: null, error: erroHttp(JSON.stringify({ error: 'Limite de uso atingido. Tente em instantes.' }), 429) });
    await abrirEGerar();
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Limite de uso atingido. Tente em instantes.'));
  });

  it('corpo que não é JSON ou sem campo error: cai na mensagem do erro', async () => {
    h.invoke.mockResolvedValue({ data: null, error: erroHttp('<html>bad gateway</html>', 502) });
    await abrirEGerar();
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Edge Function returned a non-2xx status code'));
  });

  it('erro sem contexto e sem mensagem: aviso padrão', async () => {
    h.invoke.mockResolvedValue({ data: null, error: {} });
    await abrirEGerar();
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Não consegui gerar a justificativa agora. Tente de novo.'));
  });
});

describe('JustificativasCassi — texto desatualizado', () => {
  const gerarComSucesso = async (props: Parameters<typeof Montar>[0] = {}) => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta('Texto do 301.'), '131': pronta('Texto do 131.') } }, error: null });
    const r = render(<Montar {...props} />);
    abrir();
    fireEvent.click(botaoGerar());
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    return r;
  };

  it('logo depois de gerar não há aviso e copiar está liberado', async () => {
    await gerarComSucesso();
    expect(screen.queryByText(/mudaram depois que este texto foi gerado/)).toBeNull();
    expect(copiarDo('301').disabled).toBe(false);
  });

  it('mudar os músculos depois de gerar avisa e trava o copiar dos dois textos', async () => {
    await gerarComSucesso();
    fireEvent.change(musculosInput(), { target: { value: 'peitoral menor' } });
    expect(screen.getAllByText(/mudaram depois que este texto foi gerado/)).toHaveLength(2);
    expect(copiarDo('301').disabled).toBe(true);
    expect(copiarDo('131').disabled).toBe(true);
  });

  it('mudar os achados ou o diagnóstico também avisa', async () => {
    const { rerender } = await gerarComSucesso();
    fireEvent.change(screen.getByLabelText('Achados do exame de Ana Souza'), { target: { value: 'dor à palpação' } });
    expect(copiarDo('301').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Achados do exame de Ana Souza'), { target: { value: '' } });
    expect(copiarDo('301').disabled).toBe(false); // voltou ao que era
    rerender(<Montar diagnostico="Cervicalgia" />);
    expect(copiarDo('301').disabled).toBe(true);
  });

  it('se o profissional editou o texto à mão, ele assume o conteúdo: sem aviso e copiar liberado', async () => {
    await gerarComSucesso();
    fireEvent.change(campoDo('301'), { target: { value: 'Texto do 301 ajustado por mim.' } });
    fireEvent.change(musculosInput(), { target: { value: 'peitoral menor' } });
    expect(copiarDo('301').disabled).toBe(false);
    expect(copiarDo('131').disabled).toBe(true); // o 131 não foi editado
  });

  it('mudar os dados ENQUANTO gera: o resultado chega já marcado como desatualizado', async () => {
    let resolver: (v: unknown) => void = () => {};
    h.invoke.mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    fireEvent.change(musculosInput(), { target: { value: 'peitoral menor' } });
    resolver({ data: { justificativas: { '301': pronta('Texto dos músculos antigos.'), '131': pronta('B.') } }, error: null });
    await screen.findByLabelText('Justificativa do código 301 de Ana Souza');
    expect(copiarDo('301').disabled).toBe(true);
    expect(screen.getAllByText(/mudaram depois que este texto foi gerado/).length).toBeGreaterThan(0);
  });

  it('gerar de novo com os dados novos libera tudo', async () => {
    await gerarComSucesso();
    fireEvent.change(musculosInput(), { target: { value: 'peitoral menor' } });
    expect(copiarDo('301').disabled).toBe(true);
    fireEvent.click(botaoGerar());
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(copiarDo('301').disabled).toBe(false));
    expect(screen.queryByText(/mudaram depois que este texto foi gerado/)).toBeNull();
  });
});

describe('JustificativasCassi — limite de 500 e cópia', () => {
  const gerarUma = async (texto: string) => {
    h.invoke.mockResolvedValue({ data: { justificativas: { '301': pronta(texto), '131': pronta('Texto 131.') } }, error: null });
    render(<Montar />);
    abrir();
    fireEvent.click(botaoGerar());
    return await screen.findByLabelText('Justificativa do código 301 de Ana Souza') as HTMLTextAreaElement;
  };

  it('copia o texto limpo (sem caractere invisível nem espaço sobrando)', async () => {
    await gerarUma('Texto do 301.');
    fireEvent.change(campoDo('301'), { target: { value: `${ZWSP}Texto editado.  ` } });
    fireEvent.click(copiarDo('301'));
    await waitFor(() => expect(h.copiar).toHaveBeenCalledWith('Texto editado.'));
    expect(h.sucesso).toHaveBeenCalledWith('Justificativa do 301 copiada');
  });

  it('editar acima de 500 marca o contador, avisa e NÃO copia', async () => {
    await gerarUma('Texto curto.');
    fireEvent.change(campoDo('301'), { target: { value: 'x'.repeat(501) } });
    expect(screen.getByText('501/500').className).toContain('text-rose-600');
    expect(screen.getByText(/Passou de 500 caracteres/)).toBeTruthy();
    fireEvent.click(copiarDo('301'));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('O texto do 301 passa de 500 caracteres. Encurte antes de copiar.'));
    expect(h.copiar).not.toHaveBeenCalled();
  });

  it('exatamente 500 ainda copia', async () => {
    await gerarUma('Texto curto.');
    fireEvent.change(campoDo('301'), { target: { value: 'y'.repeat(500) } });
    expect(screen.getByText('500/500').className).not.toContain('text-rose-600');
    fireEvent.click(copiarDo('301'));
    await waitFor(() => expect(h.copiar).toHaveBeenCalledWith('y'.repeat(500)));
  });

  it('o contador conta de forma conservadora: emoji vale 2 (cabe em qualquer critério da CASSI)', async () => {
    await gerarUma('Texto curto.');
    fireEvent.change(campoDo('301'), { target: { value: '😀😀😀' } });
    expect(screen.getByText('6/500')).toBeTruthy();
  });

  it('se o navegador não deixa copiar, avisa para copiar na mão', async () => {
    await gerarUma('Texto curto.');
    h.copiar.mockRejectedValueOnce(new Error('negado'));
    fireEvent.click(copiarDo('301'));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Não consegui copiar. Selecione o texto e copie manualmente.'));
  });

  it('o botão de copiar tem área de toque confortável (altura h-9)', async () => {
    await gerarUma('Texto curto.');
    expect(copiarDo('301').className).toContain('h-9');
  });
});
