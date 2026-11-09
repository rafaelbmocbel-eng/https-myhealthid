import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { MemoryRouter } from 'react-router-dom';
import AjustesDoTeste from '../components/emg/AjustesDoTeste';
import CartaoConexao from '../components/emg/CartaoConexao';
import GraficoAoVivo from '../components/emg/GraficoAoVivo';
import GraficoEnvelope from '../components/emg/GraficoEnvelope';
import IdentificacaoCanal from '../components/emg/IdentificacaoCanal';
import ProtocoloGuiado from '../components/emg/ProtocoloGuiado';
import ResultadoSessao from '../components/emg/ResultadoSessao';
import RmsAoVivo from '../components/emg/RmsAoVivo';
import SalvarExame from '../components/emg/SalvarExame';
import SeloQualidade from '../components/emg/SeloQualidade';
import SinalAoVivo from '../components/emg/SinalAoVivo';
import { PacienteSelect } from '../components/paciente/PacienteSelect';
import { MUSCULOS_SUGERIDOS, ROTULO_ESTADO } from '../components/emg/constantes';
import { ControladorEmg, MAX_TENTATIVAS_CVM } from '../components/emg/controlador';
import { BufferCircular } from '../lib/emg/bufferCircular';
import type { StatusModulo } from '../lib/emg/moduloEmg';
import type { ContracaoResumo, ResultadoEtapa, ResumoSessao, TipoEtapa } from '../lib/emg/sessao';

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

/** Gerador pseudoaleatório com semente fixa (mulberry32) e ruído gaussiano de desvio-padrão `sigma` (Box-Muller). */
function ruidoGaussiano(n: number, sigma: number, semente: number): Float64Array {
  let estado = semente >>> 0;
  const unif = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = Math.imul(estado ^ (estado >>> 15), estado | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297;
  };
  const x = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    const r = Math.sqrt(-2 * Math.log(unif()));
    const a = 2 * Math.PI * unif();
    x[i] = sigma * r * Math.cos(a);
    if (i + 1 < n) x[i + 1] = sigma * r * Math.sin(a);
  }
  return x;
}

function bufferCom(amostras: ArrayLike<number>, capacidade = 10_000): BufferCircular {
  const b = new BufferCircular(capacidade);
  b.empurrar(amostras);
  return b;
}

async function passar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Cartão de conexão
// ---------------------------------------------------------------------------

describe('CartaoConexao', () => {
  const calls = () => ({ onConectar: vi.fn(), onDemonstracao: vi.fn(), onDesconectar: vi.fn() });
  const base = (estado: StatusModulo['estado'], extra: Partial<React.ComponentProps<typeof CartaoConexao>> = {}) => ({
    status: { estado } as StatusModulo,
    modo: null,
    conectando: false,
    temBluetooth: true,
    mensagemSemBluetooth: 'Sem Bluetooth aqui.',
    taxaHz: null,
    taxaAssumida: false,
    bateriaPct: null,
    erro: null,
    buffer: new BufferCircular(10),
    ...calls(),
    ...extra,
  });

  it('desconectado: oferece conectar e a demonstração, sem desconectar e sem números do módulo', () => {
    const p = base('desconectado');
    render(<CartaoConexao {...p} />);
    expect(screen.getByRole('button', { name: 'Conectar módulo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Modo demonstração (sem aparelho)' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Desconectar|Cancelar/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('taxa-modulo')).not.toBeInTheDocument();
    expect(screen.getByTestId('estado-modulo').textContent).toBe('Desconectado');
    fireEvent.click(screen.getByRole('button', { name: 'Conectar módulo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modo demonstração (sem aparelho)' }));
    expect(p.onConectar).toHaveBeenCalledTimes(1);
    expect(p.onDemonstracao).toHaveBeenCalledTimes(1);
  });

  it('sem Bluetooth: só o botão de conectar fica desligado e a mensagem aparece', () => {
    render(<CartaoConexao {...base('desconectado', { temBluetooth: false })} />);
    expect(screen.getByRole('button', { name: 'Conectar módulo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Modo demonstração (sem aparelho)' })).toBeEnabled();
    expect(screen.getByTestId('sem-bluetooth').textContent).toBe('Sem Bluetooth aqui.');
  });

  it('a mensagem de "sem Bluetooth" some enquanto a demonstração está ligada (o aviso certo é o da demonstração)', () => {
    render(<CartaoConexao {...base('adquirindo', { temBluetooth: false, modo: 'demo', taxaHz: 1000 })} />);
    expect(screen.queryByTestId('sem-bluetooth')).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-demonstracao')).toBeInTheDocument();
  });

  it('conectando: tudo desligado, estado "Conectando…" e botão Cancelar', () => {
    const p = base('desconectado', { conectando: true, modo: 'real' });
    render(<CartaoConexao {...p} />);
    expect(screen.getByRole('button', { name: 'Conectar módulo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Modo demonstração (sem aparelho)' })).toBeDisabled();
    expect(screen.getByTestId('estado-modulo').textContent).toBe('Conectando…');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(p.onDesconectar).toHaveBeenCalledTimes(1);
  });

  it('lendo o sinal: mostra nome, taxa, bateria e deixa desconectar', () => {
    const p = base('adquirindo', { taxaHz: 1000, bateriaPct: 64, status: { estado: 'adquirindo', nome: 'RunE W2 1' }, modo: 'real' });
    render(<CartaoConexao {...p} />);
    expect(screen.getByTestId('estado-modulo').textContent).toBe('Lendo o sinal · RunE W2 1');
    expect(screen.getByTestId('taxa-modulo').textContent).toBe('Taxa: 1000 Hz');
    expect(screen.getByTestId('bateria-modulo').textContent).toBe('Bateria: 64 %');
    expect(screen.queryByTestId('aviso-taxa-assumida')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aviso-demonstracao')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
    expect(p.onDesconectar).toHaveBeenCalledTimes(1);
  });

  it('taxa ou bateria ainda desconhecidas aparecem como traço', () => {
    render(<CartaoConexao {...base('conectado')} />);
    expect(screen.getByTestId('taxa-modulo').textContent).toBe('Taxa: —');
    expect(screen.getByTestId('bateria-modulo').textContent).toBe('Bateria: —');
  });

  it('taxa assumida: aviso com o valor suposto e o caminho para conferir', () => {
    render(<CartaoConexao {...base('adquirindo', { taxaHz: 500, taxaAssumida: true })} />);
    const aviso = screen.getByTestId('aviso-taxa-assumida').textContent ?? '';
    expect(aviso).toMatch(/Taxa assumida/);
    expect(aviso).toMatch(/supondo 500 Hz/);
    expect(aviso).toMatch(/Ver dados recebidos/);
  });

  it('demonstração: avisa que o sinal é simulado; erro vira alerta', () => {
    const { rerender } = render(<CartaoConexao {...base('adquirindo', { modo: 'demo', taxaHz: 1000 })} />);
    expect(screen.getByTestId('aviso-demonstracao').textContent).toMatch(/simulado/);
    rerender(<CartaoConexao {...base('desconectado', { erro: 'Algo deu errado.' })} />);
    expect(screen.getByRole('alert').textContent).toBe('Algo deu errado.');
  });

  it('todos os estados do módulo têm rótulo em português', () => {
    expect(Object.keys(ROTULO_ESTADO).sort()).toEqual(['adquirindo', 'conectado', 'conectando', 'desconectado', 'reconectando']);
    for (const rotulo of Object.values(ROTULO_ESTADO)) expect(rotulo).toMatch(/^[A-ZÀ-Ú]/);
  });
});

// ---------------------------------------------------------------------------
// Salvar no prontuário
// ---------------------------------------------------------------------------

describe('SalvarExame', () => {
  const props = (extra: Partial<React.ComponentProps<typeof SalvarExame>> = {}) => ({
    pacienteId: 'p1',
    pacienteNome: 'Ana Souza' as string | null,
    temResultado: true,
    demonstracao: false,
    observacoes: '',
    onObservacoes: vi.fn(),
    visivelAoCliente: false,
    onVisivelAoCliente: vi.fn(),
    salvando: false,
    salvo: false,
    onSalvar: vi.fn(),
    onBaixarCsv: vi.fn(),
    ...extra,
  });
  const montar = (p: ReturnType<typeof props>) =>
    render(
      <MemoryRouter>
        <SalvarExame {...p} />
      </MemoryRouter>,
    );

  it('pronto para salvar: botão ligado, explica o que vai e o que não vai no exame', () => {
    const p = props();
    montar(p);
    const salvar = screen.getByRole('button', { name: 'Salvar no prontuário' });
    expect(salvar).toBeEnabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toBe(
      'O exame guarda o resumo, o envelope do sinal e os parâmetros da análise. O sinal bruto não é salvo.',
    );
    fireEvent.click(salvar);
    expect(p.onSalvar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV do sinal' }));
    expect(p.onBaixarCsv).toHaveBeenCalledTimes(1);
  });

  it('sem paciente: bloqueia e diz por quê; o CSV continua liberado', () => {
    const p = props({ pacienteId: '', pacienteNome: null });
    montar(p);
    expect(screen.getByRole('button', { name: 'Salvar no prontuário' })).toBeDisabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/Escolha um paciente no alto da página para salvar no prontuário/);
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/baixar o CSV do sinal/);
    expect(screen.getByRole('button', { name: 'Baixar CSV do sinal' })).toBeEnabled();
  });

  it('sem etapa gravada: nada para salvar nem para baixar', () => {
    montar(props({ temResultado: false }));
    expect(screen.getByRole('button', { name: 'Salvar no prontuário' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Baixar CSV do sinal' })).toBeDisabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toBe('Grave pelo menos uma etapa para poder salvar.');
  });

  it('demonstração: bloqueia com o motivo; sem paciente, os dois motivos aparecem juntos', () => {
    const { unmount } = montar(props({ demonstracao: true }));
    expect(screen.getByRole('button', { name: 'Salvar no prontuário' })).toBeDisabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/demonstração \(sinal simulado\) e não pode ser salvo no prontuário/);
    expect(screen.getByTestId('ajuda-salvar').textContent).not.toMatch(/Escolha um paciente/);
    unmount();
    montar(props({ demonstracao: true, pacienteId: '', pacienteNome: null }));
    const texto = screen.getByTestId('ajuda-salvar').textContent ?? '';
    expect(texto).toMatch(/Escolha um paciente/);
    expect(texto).toMatch(/demonstração/);
  });

  it('a demonstração só pesa quando há resultado: sem etapas vale o aviso comum', () => {
    montar(props({ demonstracao: true, temResultado: false }));
    expect(screen.getByTestId('ajuda-salvar').textContent).toBe('Grave pelo menos uma etapa para poder salvar.');
  });

  it('salvando: o botão fica desligado (sem toque duplo) e os campos que entram no exame ficam travados', () => {
    const { unmount } = montar(props({ salvando: true }));
    expect(screen.getByRole('button', { name: 'Salvar no prontuário' })).toBeDisabled();
    expect(screen.getByLabelText('Observações')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Mostrar ao cliente' })).toBeDisabled();
    unmount();
    montar(props());
    expect(screen.getByLabelText('Observações')).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Mostrar ao cliente' })).toBeEnabled();
  });

  it('lista de pacientes carregando: bloqueia e diz "Carregando pacientes…" (não pede para escolher ainda)', () => {
    montar(props({ pacienteId: '', pacienteNome: null, carregandoPacientes: true }));
    expect(screen.getByRole('button', { name: 'Salvar no prontuário' })).toBeDisabled();
    const ajuda = screen.getByTestId('ajuda-salvar').textContent ?? '';
    expect(ajuda).toMatch(/^Carregando pacientes…/);
    expect(ajuda).not.toMatch(/Escolha um paciente/);
    expect(screen.getByRole('button', { name: 'Baixar CSV do sinal' })).toBeEnabled();
  });

  it('carregou sem paciente: volta a pedir a escolha', () => {
    montar(props({ pacienteId: '', pacienteNome: null, carregandoPacientes: false }));
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/^Escolha um paciente no alto da página/);
  });

  it('erro ao carregar os pacientes: diz que não carregou e manda tentar de novo (não pede para escolher quem não existe)', () => {
    montar(props({ pacienteId: '', pacienteNome: null, erroPacientes: true }));
    expect(screen.getByRole('button', { name: 'Salvar no prontuário' })).toBeDisabled();
    const ajuda = screen.getByTestId('ajuda-salvar').textContent ?? '';
    expect(ajuda).toMatch(/^Não consegui carregar seus pacientes\. Toque em "Tentar de novo" no alto da página/);
    expect(ajuda).not.toMatch(/Escolha um paciente/);
    expect(screen.getByRole('button', { name: 'Baixar CSV do sinal' })).toBeEnabled();
  });

  it('já salvo e com observação ou visibilidade mudadas: o botão vira "Atualizar exame salvo" e a ajuda diz que não cria outro', () => {
    const p = props({ atualizando: true });
    montar(p);
    expect(screen.queryByRole('button', { name: 'Salvar no prontuário' })).not.toBeInTheDocument();
    const atualizar = screen.getByRole('button', { name: 'Atualizar exame salvo' });
    expect(atualizar).toBeEnabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toBe('Esta medida já está salva no prontuário. Atualizar muda esse mesmo exame, sem criar outro.');
    fireEvent.click(atualizar);
    expect(p.onSalvar).toHaveBeenCalledTimes(1);
  });

  it('com "salvo" o rótulo "Salvo no prontuário" vale mais que "atualizando"; sem paciente, o bloqueio vale mais que os dois', () => {
    const { unmount } = montar(props({ atualizando: true, salvo: true }));
    expect(screen.getByRole('button', { name: 'Salvo no prontuário' })).toBeDisabled();
    unmount();
    montar(props({ atualizando: true, pacienteId: '', pacienteNome: null }));
    expect(screen.getByRole('button', { name: 'Atualizar exame salvo' })).toBeDisabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/^Escolha um paciente/);
  });

  it('salvo: confirma com o nome do paciente, oferece o prontuário e não deixa salvar de novo', () => {
    montar(props({ salvo: true }));
    expect(screen.getByRole('button', { name: 'Salvo no prontuário' })).toBeDisabled();
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/Salvo no prontuário de Ana Souza\./);
    expect(screen.getByRole('link', { name: 'Abrir o prontuário' })).toHaveAttribute('href', '/pacientes/p1');
  });

  it('salvo sem o nome carregado ainda: a frase não fica com "de null"', () => {
    montar(props({ salvo: true, pacienteNome: null }));
    expect(screen.getByTestId('ajuda-salvar').textContent).toMatch(/^Salvo no prontuário\./);
    expect(screen.getByTestId('ajuda-salvar').textContent).not.toMatch(/null/);
  });

  it('"Mostrar ao cliente" vem desligado e avisa quem vê; as observações têm limite de 2000 caracteres', () => {
    const p = props();
    montar(p);
    const interruptor = screen.getByRole('switch', { name: 'Mostrar ao cliente' });
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Desligado: só você vê este exame/)).toBeInTheDocument();
    fireEvent.click(interruptor);
    expect(p.onVisivelAoCliente).toHaveBeenCalledWith(true);
    const caixa = screen.getByLabelText('Observações');
    expect(caixa).toHaveAttribute('maxlength', '2000');
    fireEvent.change(caixa, { target: { value: 'dor leve' } });
    expect(p.onObservacoes).toHaveBeenCalledWith('dor leve');
  });
});

// ---------------------------------------------------------------------------
// Identificação do canal
// ---------------------------------------------------------------------------

describe('IdentificacaoCanal', () => {
  it('campo de músculo livre com sugestões, e lado D/E/sem lado como rádios', () => {
    const onMusculo = vi.fn();
    const onLado = vi.fn();
    const { container } = render(<IdentificacaoCanal musculo="Reto femoral" lado="E" onMusculo={onMusculo} onLado={onLado} />);
    const campo = screen.getByRole('combobox', { name: 'Músculo medido' });
    expect(campo).toHaveValue('Reto femoral');
    expect(campo).toHaveAttribute('maxlength', '80');
    fireEvent.change(campo, { target: { value: 'Músculo que não está na lista' } });
    expect(onMusculo).toHaveBeenCalledWith('Músculo que não está na lista');

    const opcoes = Array.from(container.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
    expect(opcoes).toEqual(MUSCULOS_SUGERIDOS);
    expect(new Set(MUSCULOS_SUGERIDOS).size).toBe(MUSCULOS_SUGERIDOS.length);
    expect(opcoes).toContain('Reto femoral');

    const rotulos = screen.getAllByRole('radio').map((r) => `${r.textContent}:${r.getAttribute('aria-checked')}`);
    expect(rotulos).toEqual(['Direito:false', 'Esquerdo:true', 'Sem lado:false']);
    fireEvent.click(screen.getByRole('radio', { name: 'Direito' }));
    expect(onLado).toHaveBeenCalledWith('D');
    fireEvent.click(screen.getByRole('radio', { name: 'Sem lado' }));
    expect(onLado).toHaveBeenLastCalledWith('-');
  });

  it('travado: músculo e lado desligados, com o motivo escrito; destravado, nada disso aparece', () => {
    const onMusculo = vi.fn();
    const onLado = vi.fn();
    const { rerender } = render(<IdentificacaoCanal musculo="Reto femoral" lado="D" onMusculo={onMusculo} onLado={onLado} />);
    expect(screen.queryByTestId('canal-travado')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Músculo medido' })).toBeEnabled();

    rerender(<IdentificacaoCanal musculo="Reto femoral" lado="D" onMusculo={onMusculo} onLado={onLado} travado />);
    expect(screen.getByRole('combobox', { name: 'Músculo medido' })).toBeDisabled();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByTestId('canal-travado').textContent).toBe(
      'Músculo e lado ficam travados enquanto houver etapas gravadas. Para medir o outro lado, comece uma nova medida.',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Esquerdo' }));
    expect(onLado).not.toHaveBeenCalled();
    // Sem quem trate o descarte, não há botão (só o motivo).
    expect(screen.queryByRole('button', { name: 'Nova medida' })).not.toBeInTheDocument();
  });

  it('"Nova medida" pede confirmação: só "Descartar e começar" chama quem descarta; "Não descartar" desiste', () => {
    const onNovaMedida = vi.fn();
    const { rerender } = render(
      <IdentificacaoCanal musculo="Reto femoral" lado="D" onMusculo={vi.fn()} onLado={vi.fn()} travado onNovaMedida={onNovaMedida} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nova medida' }));
    expect(onNovaMedida).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirmar-nova-medida').textContent).toMatch(/Descartar as etapas gravadas e as observações/);
    expect(screen.getByTestId('confirmar-nova-medida').textContent).toMatch(/O que já foi salvo no prontuário não muda/);
    fireEvent.click(screen.getByRole('button', { name: 'Não descartar' }));
    expect(onNovaMedida).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirmar-nova-medida')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nova medida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar e começar' }));
    expect(onNovaMedida).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('confirmar-nova-medida')).not.toBeInTheDocument();

    // Se o bloqueio acaba no meio da confirmação (as etapas saíram por outro caminho), a pergunta não fica para a próxima vez.
    fireEvent.click(screen.getByRole('button', { name: 'Nova medida' }));
    rerender(<IdentificacaoCanal musculo="Reto femoral" lado="D" onMusculo={vi.fn()} onLado={vi.fn()} onNovaMedida={onNovaMedida} />);
    rerender(<IdentificacaoCanal musculo="Reto femoral" lado="D" onMusculo={vi.fn()} onLado={vi.fn()} travado onNovaMedida={onNovaMedida} />);
    expect(screen.queryByTestId('confirmar-nova-medida')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova medida' })).toBeEnabled();
  });

  it('"Nova medida" fica desligado enquanto há salvamento em andamento, também dentro da confirmação', () => {
    const { rerender } = render(
      <IdentificacaoCanal musculo="" lado="-" onMusculo={vi.fn()} onLado={vi.fn()} travado onNovaMedida={vi.fn()} novaMedidaBloqueada />,
    );
    expect(screen.getByRole('button', { name: 'Nova medida' })).toBeDisabled();
    rerender(<IdentificacaoCanal musculo="" lado="-" onMusculo={vi.fn()} onLado={vi.fn()} travado onNovaMedida={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nova medida' }));
    rerender(<IdentificacaoCanal musculo="" lado="-" onMusculo={vi.fn()} onLado={vi.fn()} travado onNovaMedida={vi.fn()} novaMedidaBloqueada />);
    expect(screen.getByRole('button', { name: 'Descartar e começar' })).toBeDisabled();
  });

  it('foco: a confirmação recebe o foco ao abrir e "Nova medida" o recupera quando se desiste', () => {
    render(<IdentificacaoCanal musculo="Reto femoral" lado="D" onMusculo={vi.fn()} onLado={vi.fn()} travado onNovaMedida={vi.fn()} />);
    const abrir = screen.getByRole('button', { name: 'Nova medida' });
    abrir.focus();
    expect(abrir).toHaveFocus();

    fireEvent.click(abrir);
    // O foco abre na opção segura: um Enter ainda pressionado não pode descartar as etapas.
    expect(screen.getByRole('button', { name: 'Não descartar' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Não descartar' }));
    expect(screen.getByRole('button', { name: 'Nova medida' })).toHaveFocus();
  });

  it('o texto de posicionamento cita o SENIAM sem inventar medidas', () => {
    render(<IdentificacaoCanal musculo="" lado="-" onMusculo={vi.fn()} onLado={vi.fn()} />);
    const texto = screen.getByText(/SENIAM/).textContent ?? '';
    expect(texto).toBe('Pele limpa e seca; posicione os eletrodos conforme a recomendação SENIAM para o músculo.');
    expect(texto).not.toMatch(/\d/);
  });
});

// ---------------------------------------------------------------------------
// Seletor de paciente: nome acessível opcional
// ---------------------------------------------------------------------------

describe('PacienteSelect', () => {
  const pacientes = [{ id: 'p1', nome: 'Ana', sobrenome: 'Souza' }];

  it('com ariaLabelledBy o combobox ganha o nome do rótulo e continua mostrando o paciente escolhido', () => {
    render(
      <>
        <p id="rotulo-paciente">Paciente</p>
        <PacienteSelect pacientes={pacientes} value="p1" onValueChange={vi.fn()} ariaLabelledBy="rotulo-paciente" />
      </>,
    );
    const seletor = screen.getByRole('combobox', { name: 'Paciente' });
    expect(seletor).toHaveTextContent('Ana Souza');
    expect(seletor).toHaveAttribute('aria-labelledby', 'rotulo-paciente');
  });

  it('sem a prop nada muda para os outros usos: o botão não ganha aria-labelledby', () => {
    render(<PacienteSelect pacientes={pacientes} value="" onValueChange={vi.fn()} placeholder="Escolher…" />);
    const seletor = screen.getByRole('combobox');
    expect(seletor).not.toHaveAttribute('aria-labelledby');
    expect(seletor).toHaveTextContent('Escolher…');
  });
});

// ---------------------------------------------------------------------------
// Ajustes para o teste com o aparelho
// ---------------------------------------------------------------------------

describe('AjustesDoTeste', () => {
  it('mostra o padrão (60 Hz, amostra-base ligada) e troca cada ajuste sem mexer no outro', () => {
    const onChange = vi.fn();
    render(<AjustesDoTeste ajustes={{ redeHz: 60, incluirPrimeiraAmostra: true }} onChange={onChange} travados={false} />);
    expect(screen.getByRole('radio', { name: '60 Hz (Brasil)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '50 Hz' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Quadro bruto traz a amostra-base' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: '50 Hz' }));
    expect(onChange).toHaveBeenLastCalledWith({ redeHz: 50, incluirPrimeiraAmostra: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Quadro bruto traz a amostra-base' }));
    expect(onChange).toHaveBeenLastCalledWith({ redeHz: 60, incluirPrimeiraAmostra: false });
    expect(screen.getByTestId('ajustes-ajuda').textContent).toBe('Valem a partir da próxima vez que você tocar em “Conectar módulo”.');
  });

  it('com o módulo conectado os ajustes ficam travados e a ajuda diz como destravar', () => {
    const onChange = vi.fn();
    render(<AjustesDoTeste ajustes={{ redeHz: 50, incluirPrimeiraAmostra: false }} onChange={onChange} travados />);
    expect(screen.getByRole('radio', { name: '60 Hz (Brasil)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '50 Hz' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Quadro bruto traz a amostra-base' })).toBeDisabled();
    expect(screen.getByTestId('ajustes-ajuda').textContent).toMatch(/^Desconecte o módulo para mudar\. /);
    fireEvent.click(screen.getByRole('radio', { name: '60 Hz (Brasil)' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RMS ao vivo e selo de qualidade
// ---------------------------------------------------------------------------

describe('RmsAoVivo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('mostra o RMS dos últimos 250 ms: sinal constante de 100 µV dá 100', () => {
    render(<RmsAoVivo buffer={bufferCom(new Float64Array(1000).fill(100))} fsHz={1000} ativo cvmUv={null} />);
    expect(screen.getByTestId('rms-uv').textContent).toBe('100');
    expect(screen.queryByTestId('rms-pct-cvm')).not.toBeInTheDocument();
  });

  it('com CVM, mostra também em % da CVM (50 µV de 200 µV = 50 %)', () => {
    render(<RmsAoVivo buffer={bufferCom(new Float64Array(1000).fill(50))} fsHz={1000} ativo cvmUv={200} />);
    expect(screen.getByTestId('rms-uv').textContent).toBe('50,0');
    expect(screen.getByTestId('rms-pct-cvm').textContent).toBe('25 % da CVM');
  });

  it('atualiza 5 vezes por segundo: acompanha o buffer; sem amostras novas o valor vira traço (módulo parou)', async () => {
    const buffer = bufferCom(new Float64Array(1000).fill(10));
    render(<RmsAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} />);
    expect(screen.getByTestId('rms-uv').textContent).toBe('10,0');

    buffer.empurrar(new Float64Array(250).fill(30));
    await passar(199);
    expect(screen.getByTestId('rms-uv').textContent).toBe('10,0');
    await passar(2);
    expect(screen.getByTestId('rms-uv').textContent).toBe('30,0');

    await passar(200); // nada novo entrou
    expect(screen.getByTestId('rms-uv').textContent).toBe('—');
  });

  it('antes de haver 250 ms de sinal, ou com o módulo parado, mostra traço', () => {
    const { rerender } = render(<RmsAoVivo buffer={bufferCom(new Float64Array(100).fill(5))} fsHz={1000} ativo cvmUv={null} />);
    expect(screen.getByTestId('rms-uv').textContent).toBe('—');
    rerender(<RmsAoVivo buffer={bufferCom(new Float64Array(1000).fill(5))} fsHz={1000} ativo={false} cvmUv={null} />);
    expect(screen.getByTestId('rms-uv').textContent).toBe('—');
    rerender(<RmsAoVivo buffer={bufferCom(new Float64Array(1000).fill(5))} fsHz={null} ativo cvmUv={null} />);
    expect(screen.getByTestId('rms-uv').textContent).toBe('—');
  });

  it('desmontar para o relógio', () => {
    const { unmount } = render(<RmsAoVivo buffer={bufferCom(new Float64Array(1000).fill(5))} fsHz={1000} ativo cvmUv={null} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('SeloQualidade', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('não aparece com o módulo parado', () => {
    const { container } = render(<SeloQualidade buffer={bufferCom(ruidoGaussiano(8000, 2, 1))} fsHz={1000} ativo={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('com menos de 3 s de sinal diz "Medindo o sinal…"', () => {
    render(<SeloQualidade buffer={bufferCom(ruidoGaussiano(2900, 2, 1))} fsHz={1000} ativo />);
    expect(screen.getByTestId('selo-qualidade').textContent).toMatch(/Medindo o sinal/);
  });

  it('ruído de repouso de uns 2 µV (abaixo do limite de 5 µV): sinal bom', () => {
    render(<SeloQualidade buffer={bufferCom(ruidoGaussiano(8000, 2, 20261108))} fsHz={1000} ativo />);
    expect(screen.getByTestId('selo-qualidade').textContent).toMatch(/Sinal bom/);
  });

  it('ruído de repouso de uns 40 µV (acima do limite de 15 µV): sinal ruim, com o motivo', () => {
    render(<SeloQualidade buffer={bufferCom(ruidoGaussiano(8000, 40, 7))} fsHz={1000} ativo />);
    expect(screen.getByTestId('selo-qualidade').textContent).toMatch(/Sinal ruim/);
    expect(screen.getByText(/ruído/i, { selector: 'span.text-muted-foreground' })).toBeInTheDocument();
  });

  it('reavalia a cada segundo conforme o sinal muda', async () => {
    const buffer = bufferCom(ruidoGaussiano(8000, 2, 3));
    render(<SeloQualidade buffer={buffer} fsHz={1000} ativo />);
    expect(screen.getByTestId('selo-qualidade').textContent).toMatch(/Sinal bom/);
    buffer.empurrar(ruidoGaussiano(8000, 40, 4));
    await passar(1100);
    expect(screen.getByTestId('selo-qualidade').textContent).toMatch(/Sinal ruim/);
  });
});

// ---------------------------------------------------------------------------
// Gráfico ao vivo (canvas, requestAnimationFrame, sem estado por amostra)
// ---------------------------------------------------------------------------

describe('GraficoAoVivo', () => {
  interface Registro {
    clearRect: number;
    traco: Array<{ x: number; y: number }>;
    estilosDoTraco: string[];
  }
  let reg: Registro;
  let ctxFalso: unknown;
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  let originais: Record<string, PropertyDescriptor | undefined>;

  function prepararCanvas(): void {
    reg = { clearRect: 0, traco: [], estilosDoTraco: [] };
    const estado = { strokeStyle: '' };
    ctxFalso = {
      get strokeStyle() {
        return estado.strokeStyle;
      },
      set strokeStyle(v: string) {
        estado.strokeStyle = v;
      },
      lineWidth: 1,
      setTransform: () => undefined,
      clearRect: () => {
        reg.clearRect++;
        reg.traco = [];
      },
      beginPath: () => undefined,
      moveTo: (x: number, y: number) => {
        if (estado.strokeStyle !== '' && ['#1e3a5f', '#f5b82e'].includes(estado.strokeStyle)) reg.traco.push({ x, y });
      },
      lineTo: () => undefined,
      stroke: () => {
        if (['#1e3a5f', '#f5b82e'].includes(estado.strokeStyle)) reg.estilosDoTraco.push(estado.strokeStyle);
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctxFalso) as never);
    originais = {
      clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
      clientHeight: Object.getOwnPropertyDescriptor(proto, 'clientHeight'),
    };
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 100 });
  }

  function mediaQuery(reduzido: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (consulta: string) => ({
        matches: reduzido && consulta.includes('prefers-reduced-motion'),
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    prepararCanvas();
    mediaQuery(false);
  });

  afterEach(() => {
    for (const [nome, descritor] of Object.entries(originais)) {
      if (descritor) Object.defineProperty(proto, nome, descritor);
      else Reflect.deleteProperty(proto, nome);
    }
    document.documentElement.classList.remove('dark');
    mediaQuery(false);
  });

  it('desenha a cada quadro com sinal novo, uma coluna por pixel, e não redesenha se nada mudou', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    render(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(40);
    expect(reg.clearRect).toBe(1);
    expect(reg.traco).toHaveLength(200); // largura de 200 px
    // 5 µV com escala de ±10 µV na altura de 100 px: y = 50 - 0,5 x 48 = 26 (com meio pixel de espessura).
    expect(reg.traco[0].y).toBeCloseTo(25.5, 9);
    await passar(500);
    expect(reg.clearRect).toBe(1);

    buffer.empurrar([5]);
    await passar(40);
    expect(reg.clearRect).toBe(2);
  });

  it('amostras novas NÃO renderizam o React: só o desenho acontece (nada de estado por amostra)', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    let commits = 0;
    render(
      <Profiler id="g" onRender={() => void commits++}>
        <GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />
      </Profiler>,
    );
    await passar(40);
    const antes = commits;
    const desenhosAntes = reg.clearRect;
    for (let i = 0; i < 100; i++) {
      buffer.empurrar(new Float64Array(10).fill(5));
      await passar(17);
    }
    expect(reg.clearRect - desenhosAntes).toBeGreaterThanOrEqual(90);
    expect(commits).toBe(antes);
  });

  it('autoescala: sinal de 300 µV leva a escala para ±500 µV e a legenda acompanha', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(300));
    render(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(40);
    // 300 x 1,1 = 330 -> menor degrau redondo que cabe: 500.
    expect(screen.getByTestId('grafico-legenda').textContent).toMatch(/Últimos 5 s · escala de ±500 µV \(ajusta sozinha\)/);
    expect(reg.traco[0].y).toBeCloseTo(50 - (300 / 500) * 48 - 0.5, 9);
  });

  it('congelar guarda uma cópia da janela: o sinal novo não mexe no gráfico; descongelar volta a acompanhar', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const { rerender } = render(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(40);
    const y5 = reg.traco[0].y;

    rerender(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado />);
    buffer.empurrar(new Float64Array(5000).fill(8));
    await passar(40);
    expect(reg.traco[0].y).toBeCloseTo(y5, 9);
    expect(screen.getByTestId('grafico-legenda').textContent).toMatch(/gráfico congelado/);

    rerender(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(40);
    // Agora 8 µV na escala de ±10: y = 50 - 0,8 x 48 = 11,6 (menos meio pixel).
    expect(reg.traco[0].y).toBeCloseTo(11.1, 9);
    expect(screen.getByTestId('grafico-legenda').textContent).not.toMatch(/congelado/);
  });

  it('com "reduzir movimento" no sistema, redesenha no máximo 2 vezes por segundo e avisa na legenda', async () => {
    mediaQuery(true);
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    render(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(20);
    const antes = reg.clearRect;
    for (let i = 0; i < 120; i++) {
      buffer.empurrar([5, 5, 5]);
      await passar(17); // ~2 s de quadros
    }
    const desenhos = reg.clearRect - antes;
    expect(desenhos).toBeLessThanOrEqual(5);
    expect(desenhos).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('grafico-legenda').textContent).toMatch(/movimento reduzido: atualiza 2 vezes por segundo/);
  });

  it('tema escuro: ao mudar a classe do <html>, o próximo quadro usa as cores do escuro', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    render(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(40);
    expect(reg.estilosDoTraco.at(-1)).toBe('#1e3a5f');
    act(() => {
      document.documentElement.classList.add('dark');
    });
    await passar(40);
    expect(reg.estilosDoTraco.at(-1)).toBe('#f5b82e');
  });

  it('desmontar cancela o laço de desenho: nada mais é desenhado e não sobra quadro agendado', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const cancelar = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(<GraficoAoVivo buffer={buffer} fsHz={1000} congelado={false} />);
    await passar(40);
    unmount();
    expect(cancelar).toHaveBeenCalled();
    const desenhos = reg.clearRect;
    buffer.empurrar([1, 2, 3]);
    await passar(200);
    expect(reg.clearRect).toBe(desenhos);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sem taxa conhecida (módulo ainda mudo) não desenha traço e não lança', async () => {
    render(<GraficoAoVivo buffer={new BufferCircular(100)} fsHz={null} congelado={false} />);
    await passar(100);
    expect(reg.traco).toHaveLength(0);
  });

  it('o canvas é acessível: tem descrição e a legenda diz a janela e a escala', () => {
    render(<GraficoAoVivo buffer={new BufferCircular(100)} fsHz={null} congelado={false} />);
    expect(screen.getByRole('img', { name: /Sinal do músculo ao vivo/ })).toBeInTheDocument();
    expect(screen.getByTestId('grafico-legenda').textContent).toMatch(/Últimos 5 s · escala de ±10 µV/);
  });

  it('SinalAoVivo: Congelar liga o congelamento; sem sinal o botão fica desligado e o aviso aparece', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const { rerender } = render(<SinalAoVivo buffer={buffer} fsHz={1000} ativo={false} cvmUv={null} />);
    expect(screen.getByRole('button', { name: /Congelar/ })).toBeDisabled();
    expect(screen.getByText(/Sem sinal\. Conecte o módulo ou use o modo demonstração\./)).toBeInTheDocument();

    rerender(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} />);
    const botao = screen.getByRole('button', { name: /Congelar/ });
    expect(botao).toBeEnabled();
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: /Descongelar/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Sem sinal\./)).not.toBeInTheDocument();
    // Congelado, o botão continua ligado mesmo que o módulo pare (para poder descongelar).
    rerender(<SinalAoVivo buffer={buffer} fsHz={1000} ativo={false} cvmUv={null} />);
    expect(screen.getByRole('button', { name: /Descongelar/ })).toBeEnabled();
  });

  it('SinalAoVivo sem sinal: o aviso diz o estado certo (religando, aguardando ou conectar) e o traço antigo some', async () => {
    // O buffer guarda o último sinal até a próxima conexão: ele não pode aparecer por baixo do aviso.
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const aviso = (): string | null => screen.queryByTestId('aviso-sem-sinal')?.textContent ?? null;
    const { rerender } = render(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} estado="adquirindo" />);
    await passar(40);
    expect(reg.traco).toHaveLength(200); // lendo: uma coluna de traço por pixel
    expect(aviso()).toBeNull();

    const semSinal = async (estado: React.ComponentProps<typeof SinalAoVivo>['estado'], conectando = false): Promise<void> => {
      rerender(<SinalAoVivo buffer={buffer} fsHz={1000} ativo={false} cvmUv={null} estado={estado} conectando={conectando} />);
      await passar(40);
    };

    await semSinal('reconectando');
    expect(aviso()).toBe('Religando o módulo…');
    expect(reg.traco).toHaveLength(0);

    await semSinal('conectado');
    expect(aviso()).toBe('Aguardando o sinal…');
    expect(reg.traco).toHaveLength(0);
    await semSinal('conectando');
    expect(aviso()).toBe('Aguardando o sinal…');

    // Ainda "desconectado" no módulo, mas a pessoa já tocou em conectar (a demonstração está carregando).
    await semSinal('desconectado', true);
    expect(aviso()).toBe('Aguardando o sinal…');

    await semSinal('desconectado');
    expect(aviso()).toBe('Sem sinal. Conecte o módulo ou use o modo demonstração.');
    expect(reg.traco).toHaveLength(0);

    // Voltou a ler: o traço volta e o aviso some.
    rerender(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} estado="adquirindo" />);
    await passar(40);
    expect(reg.traco).toHaveLength(200);
    expect(aviso()).toBeNull();
  });

  it('SinalAoVivo congelado: mesmo com o módulo parado o traço congelado continua na tela e não há aviso por cima', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const { rerender } = render(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} estado="adquirindo" />);
    await passar(40);
    fireEvent.click(screen.getByRole('button', { name: /Congelar/ }));
    rerender(<SinalAoVivo buffer={buffer} fsHz={1000} ativo={false} cvmUv={null} estado="reconectando" />);
    await passar(40);
    expect(screen.queryByTestId('aviso-sem-sinal')).not.toBeInTheDocument();
    expect(reg.traco).toHaveLength(200);

    // Descongelou sem sinal: agora sim, aviso e sem traço.
    fireEvent.click(screen.getByRole('button', { name: /Descongelar/ }));
    await passar(40);
    expect(screen.getByTestId('aviso-sem-sinal').textContent).toBe('Religando o módulo…');
    expect(reg.traco).toHaveLength(0);
  });

  it('SinalAoVivo congelado e desconectado (taxa zerada pela tela): o traço congelado continua, a legenda é verdadeira e descongelar mostra o aviso', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const { rerender } = render(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} estado="adquirindo" />);
    await passar(40);
    fireEvent.click(screen.getByRole('button', { name: /Congelar/ }));
    await passar(40);

    // Desconectar: a tela zera a taxa (o módulo não existe mais) e o estado vira "desconectado".
    rerender(<SinalAoVivo buffer={buffer} fsHz={null} ativo={false} cvmUv={null} estado="desconectado" />);
    await passar(40);
    expect(reg.traco).toHaveLength(200);
    // 5 µV na escala de ±10 µV, altura de 100 px: y = 50 - 0,5 x 48 = 26, menos meio pixel de espessura.
    expect(reg.traco[0].y).toBeCloseTo(25.5, 9);
    expect(screen.queryByTestId('aviso-sem-sinal')).not.toBeInTheDocument();
    expect(screen.getByTestId('grafico-legenda').textContent).toMatch(/gráfico congelado/);
    expect(screen.getByRole('button', { name: /Descongelar/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Descongelar/ }));
    await passar(40);
    expect(screen.getByTestId('aviso-sem-sinal').textContent).toBe('Sem sinal. Conecte o módulo ou use o modo demonstração.');
    expect(reg.traco).toHaveLength(0);
    expect(screen.getByTestId('grafico-legenda').textContent).not.toMatch(/congelado/);
  });

  it('SinalAoVivo: o sinal voltando (conexão nova) desfaz o congelamento e o traço novo acompanha o buffer', async () => {
    const buffer = bufferCom(new Float64Array(5000).fill(5));
    const { rerender } = render(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} estado="adquirindo" />);
    await passar(40);
    fireEvent.click(screen.getByRole('button', { name: /Congelar/ }));
    rerender(<SinalAoVivo buffer={buffer} fsHz={null} ativo={false} cvmUv={null} estado="desconectado" />);
    await passar(40);
    expect(screen.getByRole('button', { name: /Descongelar/ })).toHaveAttribute('aria-pressed', 'true');

    buffer.empurrar(new Float64Array(5000).fill(8));
    rerender(<SinalAoVivo buffer={buffer} fsHz={1000} ativo cvmUv={null} estado="adquirindo" />);
    await passar(40);
    expect(screen.getByRole('button', { name: /Congelar/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('grafico-legenda').textContent).not.toMatch(/congelado/);
    // Ao vivo outra vez: 8 µV na escala de ±10 µV dá y = 50 - 0,8 x 48 = 11,6, menos meio pixel (não os 25,5 dos 5 µV congelados).
    expect(reg.traco).toHaveLength(200);
    expect(reg.traco[0].y).toBeCloseTo(11.1, 9);
  });
});

// ---------------------------------------------------------------------------
// Gráfico do envelope e resultado
// ---------------------------------------------------------------------------

function contracao(extra: Partial<ContracaoResumo> = {}): ContracaoResumo {
  return { inicioS: 1, fimS: 2.5, duracaoS: 1.5, picoUv: 60, rmsMedioUv: 40, picoPctCvm: 60, rmsMedioPctCvm: 40, ...extra };
}

describe('GraficoEnvelope', () => {
  const sinal = (n = 2000) => Float64Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 50 : -50));

  it('com CVM o eixo é % da CVM, com a linha de 100 %, o limiar e uma faixa por contração', () => {
    const { container } = render(
      <GraficoEnvelope amostras={sinal()} fsHz={1000} contracoes={[contracao(), contracao({ inicioS: 1.5, fimS: 1.9 })]} limiarUv={10} cvmUv={100} />,
    );
    const svg = screen.getByTestId('grafico-envelope');
    expect(svg.getAttribute('aria-label')).toBe('Envelope do sinal na tarefa, de 0 a 2,0 s. 2 contrações detectadas.');
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    expect(svg.textContent).toContain('100 % da CVM');
    expect(svg.textContent).toContain('limiar de detecção');
    expect(container.querySelector('figcaption')?.textContent).toMatch(/\(% da CVM\)/);
    expect(container.querySelector('polyline')?.getAttribute('points')?.split(' ').length).toBeGreaterThan(50);
  });

  it('sem CVM o eixo é µV e não há linha de 100 %', () => {
    const { container } = render(<GraficoEnvelope amostras={sinal()} fsHz={1000} contracoes={[]} limiarUv={null} cvmUv={null} />);
    const svg = screen.getByTestId('grafico-envelope');
    expect(svg.textContent).not.toContain('100 % da CVM');
    expect(svg.textContent).not.toContain('limiar de detecção');
    expect(svg.getAttribute('aria-label')).toMatch(/Nenhuma contração detectada\.$/);
    expect(container.querySelector('figcaption')?.textContent).toMatch(/\(µV\)/);
  });

  it('descrição no singular para uma contração', () => {
    render(<GraficoEnvelope amostras={sinal()} fsHz={1000} contracoes={[contracao()]} limiarUv={null} cvmUv={null} />);
    expect(screen.getByTestId('grafico-envelope').getAttribute('aria-label')).toMatch(/1 contração detectada\.$/);
  });

  it('o gráfico não passa da altura: nenhum ponto do envelope sai da área do desenho', () => {
    const { container } = render(<GraficoEnvelope amostras={sinal()} fsHz={1000} contracoes={[]} limiarUv={null} cvmUv={10} />);
    const pontos = (container.querySelector('polyline')?.getAttribute('points') ?? '').split(' ').map((p) => Number(p.split(',')[1]));
    for (const y of pontos) {
      expect(y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(y).toBeLessThanOrEqual(170 - 24 + 1e-6);
    }
  });

  it('sem amostras não desenha nada', () => {
    const { container } = render(<GraficoEnvelope amostras={[]} fsHz={1000} contracoes={[]} limiarUv={null} cvmUv={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function resumo(extra: Partial<ResumoSessao> = {}): ResumoSessao {
  return {
    canal: { id: '1', musculo: 'Reto femoral', lado: 'D' },
    duracaoRepousoS: 5,
    duracaoTarefaS: 12,
    ruidoBasalRmsUv: 2,
    repousoRmsUv: 2.2,
    qualidade: { nivel: 'bom', motivos: [], ruidoBasalRms: 2, contaminacaoRede: 0.01 } as unknown as ResumoSessao['qualidade'],
    linhaDeBase: { mediaUv: 2, desvioUv: 0.3, limiarUv: 3.5, pisoPicoUv: 7 },
    tentativasCvm: 3,
    cvmPorTentativaUv: [95, 100, 98],
    cvmUv: 100,
    contracoes: [contracao(), contracao({ inicioS: 4, fimS: 5.2, duracaoS: 1.2, picoUv: 80, rmsMedioUv: 50, picoPctCvm: 80, rmsMedioPctCvm: 50 })],
    picoPctCvmMax: 80,
    avisos: [],
    ...extra,
  };
}

function etapaTarefa(n: number): ResultadoEtapa {
  return {
    tipo: 'tarefa',
    amostras: Float64Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 40 : -40)),
    truncada: false,
    numero: 1,
    duracaoS: n / 1000,
    rmsUv: 40,
    picoRms1sUv: 40,
  };
}

describe('ResultadoSessao', () => {
  it('cartões: CVM, ruído basal, contrações, pico e RMS médio em % da CVM (média das contrações)', () => {
    render(<ResultadoSessao resumo={resumo()} etapas={[etapaTarefa(2000)]} fsHz={1000} />);
    expect(screen.getByTestId('cartao-cvm').textContent).toMatch(/CVM100 µV3 tentativas: 95,0 · 100 · 98,0 µV/);
    expect(screen.getByTestId('cartao-ruido').textContent).toMatch(/Ruído basal2,0 µV.*Qualidade: boa/);
    expect(screen.getByTestId('cartao-contracoes').textContent).toMatch(/Contrações2em 12,0 s de tarefa/);
    expect(screen.getByTestId('cartao-pico').textContent).toMatch(/Pico80 % da CVMMaior pico entre as contrações/);
    // Média de 40 % e 50 %.
    expect(screen.getByTestId('cartao-rms-medio').textContent).toMatch(/RMS médio45 % da CVM/);
  });

  it('lista cada contração com início, fim, duração, pico e RMS médio', () => {
    render(<ResultadoSessao resumo={resumo()} etapas={[etapaTarefa(2000)]} fsHz={1000} />);
    const itens = screen.getAllByTestId('contracao');
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toBe('1. de 1,0 s a 2,5 s (1,5 s)Pico 60 % da CVM (60,0 µV) · RMS médio 40 % da CVM (40,0 µV)');
    expect(itens[1].textContent).toMatch(/^2\. de 4,0 s a 5,2 s \(1,2 s\)Pico 80 % da CVM \(80,0 µV\)/);
    expect(screen.getByTestId('grafico-envelope')).toBeInTheDocument();
  });

  it('sem CVM tudo fica em µV, sem inventar percentuais', () => {
    const r = resumo({
      cvmUv: null,
      tentativasCvm: 0,
      cvmPorTentativaUv: [],
      picoPctCvmMax: null,
      contracoes: [contracao({ picoPctCvm: null, rmsMedioPctCvm: null })],
    });
    render(<ResultadoSessao resumo={r} etapas={[etapaTarefa(2000)]} fsHz={1000} />);
    expect(screen.getByTestId('cartao-cvm').textContent).toMatch(/CVM—Não gravada/);
    expect(screen.getByTestId('cartao-pico').textContent).toMatch(/Pico60,0 µVSem CVM para normalizar/);
    expect(screen.getByTestId('cartao-rms-medio').textContent).toMatch(/RMS médio40,0 µV/);
    expect(screen.getByTestId('contracao').textContent).toMatch(/Pico 60,0 µV · RMS médio 40,0 µV$/);
    expect(screen.getByTestId('contracao').textContent).not.toMatch(/%/);
  });

  it('só repouso gravado: contrações e pico sem valor, e o texto manda gravar a tarefa', () => {
    const r = resumo({ duracaoTarefaS: 0, contracoes: [], picoPctCvmMax: null, cvmUv: null, tentativasCvm: 0, cvmPorTentativaUv: [] });
    render(<ResultadoSessao resumo={r} etapas={[]} fsHz={1000} />);
    expect(screen.getByTestId('cartao-contracoes').textContent).toMatch(/Contrações—Tarefa não gravada/);
    expect(screen.getByTestId('sem-contracoes').textContent).toBe('Grave a tarefa para detectar contrações.');
    expect(screen.queryByTestId('grafico-envelope')).not.toBeInTheDocument();
  });

  it('tarefa sem nenhuma contração detectada diz isso com todas as letras', () => {
    render(<ResultadoSessao resumo={resumo({ contracoes: [], picoPctCvmMax: null })} etapas={[etapaTarefa(2000)]} fsHz={1000} />);
    expect(screen.getByTestId('cartao-contracoes').textContent).toMatch(/Contrações0em 12,0 s de tarefa/);
    expect(screen.getByTestId('sem-contracoes').textContent).toBe('Nenhuma contração detectada na tarefa.');
    expect(screen.getByTestId('cartao-pico').textContent).toMatch(/Pico—Sem contrações/);
  });

  it('sem repouso utilizável: ruído e contrações ficam em traço, com o motivo', () => {
    const r = resumo({ qualidade: null, ruidoBasalRmsUv: null, repousoRmsUv: null, linhaDeBase: null, contracoes: [], picoPctCvmMax: null, duracaoRepousoS: 0 });
    render(<ResultadoSessao resumo={r} etapas={[etapaTarefa(2000)]} fsHz={1000} />);
    expect(screen.getByTestId('cartao-ruido').textContent).toMatch(/Ruído basal—Sem repouso gravado/);
    expect(screen.getByTestId('cartao-contracoes').textContent).toMatch(/Contrações—Sem repouso utilizável/);
  });

  it('avisos do resumo aparecem numa lista; sem avisos o quadro não existe', () => {
    const { rerender } = render(<ResultadoSessao resumo={resumo({ avisos: ['Só 2 tentativas de CVM (o protocolo prevê 3).', 'Outro aviso.'] })} etapas={[]} fsHz={1000} />);
    const itens = within(screen.getByTestId('avisos-resumo')).getAllByRole('listitem');
    expect(itens.map((i) => i.textContent)).toEqual(['Só 2 tentativas de CVM (o protocolo prevê 3).', 'Outro aviso.']);
    rerender(<ResultadoSessao resumo={resumo()} etapas={[]} fsHz={1000} />);
    expect(screen.queryByTestId('avisos-resumo')).not.toBeInTheDocument();
  });

  it('várias gravações de tarefa são emendadas no gráfico, como a análise faz (2 x 1 s = 2 s)', () => {
    render(<ResultadoSessao resumo={resumo()} etapas={[etapaTarefa(1000), etapaTarefa(1000)]} fsHz={1000} />);
    expect(screen.getByTestId('grafico-envelope').getAttribute('aria-label')).toMatch(/de 0 a 2,0 s/);
  });

  it('a nota diz que a interpretação é do profissional', () => {
    render(<ResultadoSessao resumo={resumo()} etapas={[]} fsHz={1000} />);
    expect(screen.getByText('Medida de apoio; a interpretação é sua.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Protocolo guiado
// ---------------------------------------------------------------------------

function etapa(tipo: TipoEtapa, numero: number, extra: Partial<ResultadoEtapa> = {}): ResultadoEtapa {
  return { tipo, amostras: new Float64Array(10), truncada: false, numero, duracaoS: 5, rmsUv: 2.5, picoRms1sUv: 100 + numero, ...extra };
}

describe('ProtocoloGuiado', () => {
  let agoraMs = 0;
  let controlador: ControladorEmg;

  const alimentar = (n: number, fsHz = 500): void =>
    controlador.aoAmostras({ brutas: new Float64Array(n), filtradas: new Float64Array(n), tsMs: 0, fsHz });

  const montar = (extra: Partial<React.ComponentProps<typeof ProtocoloGuiado>> = {}) => {
    const p = {
      onIniciar: vi.fn<(tipo: TipoEtapa) => void>(),
      onRefazer: vi.fn<(tipo: TipoEtapa) => void>(),
      onParar: vi.fn<() => void>(),
      onCancelar: vi.fn<() => void>(),
    };
    const resultado = render(
      <ProtocoloGuiado controlador={controlador} etapas={[]} pronto aviso={null} {...p} {...extra} />,
    );
    return { p, ...resultado };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    agoraMs = 1_000_000;
    controlador = new ControladorEmg({ agora: () => agoraMs, preparoS: 3, repousoS: 5, cvmS: 5 });
  });

  it('sem sinal: botões desligados e explicação', () => {
    montar({ pronto: false });
    expect(screen.getByTestId('protocolo-sem-sinal').textContent).toMatch(/Conecte o módulo \(ou use o modo demonstração\)/);
    expect(screen.getByRole('button', { name: 'Iniciar repouso' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Iniciar tentativa 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Iniciar tarefa' })).toBeDisabled();
  });

  it('com sinal: iniciar chama o pai com o tipo certo de etapa', () => {
    const { p } = montar();
    expect(screen.queryByTestId('protocolo-sem-sinal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar repouso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tentativa 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tarefa' }));
    expect(p.onIniciar.mock.calls.map((c) => c[0])).toEqual(['repouso', 'cvm', 'tarefa']);
  });

  it('descreve cada etapa com o tempo previsto (5 s, 3 tentativas de 5 s)', () => {
    montar();
    expect(screen.getByText('5 s com o músculo relaxado e imóvel.')).toBeInTheDocument();
    expect(screen.getByText(/3 tentativas de 5 s\. Contraia o mais forte que conseguir, sem mexer o eletrodo, e interrompa se houver dor\./)).toBeInTheDocument();
  });

  it('contagem regressiva do preparo, depois gravação, com o texto e o anúncio de cada fase', async () => {
    const { p } = montar();
    alimentar(10);
    act(() => controlador.iniciarEtapa('repouso'));
    expect(screen.getByTestId('etapa-ativa').textContent).toMatch(/Prepare-se: relaxe o músculo\. A gravação começa em/);
    expect(screen.getByTestId('contagem').textContent).toBe('3s');
    expect(screen.getByTestId('anuncio-etapa').textContent).toMatch(/Prepare-se: relaxe o músculo/);
    // As etapas em andamento travam as outras.
    expect(screen.getByRole('button', { name: 'Iniciar tentativa 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Iniciar tarefa' })).toBeDisabled();

    act(() => alimentar(500)); // 1 s de preparo (a 500 Hz)
    await passar(250);
    expect(screen.getByTestId('contagem').textContent).toBe('2s');
    act(() => alimentar(999));
    await passar(250);
    expect(screen.getByTestId('contagem').textContent).toBe('1s');
    // A 1500ª amostra fecha os 3 s: começa a gravar, com os 5 s da etapa pela frente.
    act(() => alimentar(1));
    await passar(250);
    expect(screen.getByTestId('etapa-ativa').textContent).toMatch(/Gravando o repouso: fique relaxado e imóvel\./);
    expect(screen.getByTestId('contagem').textContent).toBe('5s');
    expect(screen.getByTestId('anuncio-etapa').textContent).toMatch(/Gravando o repouso/);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar etapa' }));
    expect(p.onCancelar).toHaveBeenCalledTimes(1);
  });

  it('CVM em andamento mostra o número da tentativa', () => {
    montar({ etapas: [etapa('repouso', 1), etapa('cvm', 1)] });
    alimentar(10);
    act(() => controlador.iniciarEtapa('cvm'));
    expect(controlador.estado().numero).toBe(1);
    // O controlador conta as tentativas que ele mesmo gravou; como aqui só o pai tem as etapas, o número é 1.
    expect(screen.getByTestId('etapa-ativa').textContent).toMatch(/\(tentativa 1\)/);
  });

  it('tarefa gravando: contador em minutos e segundos e botão "Parar tarefa" (sem barra de andamento)', async () => {
    const { p } = montar();
    alimentar(10);
    act(() => controlador.iniciarEtapa('tarefa'));
    act(() => alimentar(1500 + 500 * 65)); // 3 s de preparo + 65 s de tarefa a 500 Hz
    await passar(250);
    expect(screen.getByTestId('contagem').textContent).toBe('01:05');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Parar tarefa' }));
    expect(p.onParar).toHaveBeenCalledTimes(1);
  });

  it('etapas gravadas: mostra o resumo de cada uma e troca "Iniciar" por "Refazer"', () => {
    const { p } = montar({
      etapas: [etapa('repouso', 1, { duracaoS: 5, rmsUv: 2.25 }), etapa('cvm', 1), etapa('cvm', 2, { picoRms1sUv: 0 }), etapa('tarefa', 1, { duracaoS: 9.46 })],
    });
    expect(screen.getByTestId('repouso-feito').textContent).toBe('Gravado: 5,0 s · RMS 2,3 µV');
    const cvm = within(screen.getByTestId('lista-cvm')).getAllByRole('listitem');
    expect(cvm.map((i) => i.textContent)).toEqual(['Tentativa 1101 µV', 'Tentativa 2curta demais']);
    expect(screen.getByTestId('tarefa-feita').textContent).toBe('Gravada: 9,5 s');

    fireEvent.click(screen.getByRole('button', { name: 'Refazer repouso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refazer tarefa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refazer a última' }));
    expect(p.onRefazer.mock.calls.map((c) => c[0])).toEqual(['repouso', 'tarefa', 'cvm']);
    expect(p.onIniciar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Iniciar tentativa 3' })).toBeEnabled();
  });

  it('com as 3 tentativas de CVM, oferece "Mais uma tentativa" e explica que vale a maior; no limite de 6, some', () => {
    const tres = [etapa('cvm', 1), etapa('cvm', 2), etapa('cvm', 3)];
    const { unmount } = montar({ etapas: tres });
    expect(screen.getByRole('button', { name: 'Mais uma tentativa' })).toBeEnabled();
    expect(screen.getByText('A CVM é a maior das tentativas.')).toBeInTheDocument();
    unmount();
    montar({ etapas: Array.from({ length: MAX_TENTATIVAS_CVM }, (_, i) => etapa('cvm', i + 1)) });
    expect(screen.queryByRole('button', { name: /Mais uma tentativa|Iniciar tentativa/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refazer a última' })).toBeInTheDocument();
  });

  it('descanso sugerido entre tentativas de CVM: mostra os segundos que faltam dos 30', async () => {
    montar({ etapas: [etapa('cvm', 1)] });
    alimentar(10);
    act(() => controlador.iniciarEtapa('cvm'));
    act(() => alimentar(1500 + 2500)); // preparo e gravação de 5 s: fecha a tentativa
    expect(controlador.quantas('cvm')).toBe(1);
    agoraMs += 12_000;
    await passar(250);
    expect(screen.getByTestId('descanso-cvm').textContent).toMatch(/Descanso sugerido: 18 s antes da próxima tentativa\./);
  });

  it('aviso do pai (conexão caiu etc.) aparece como alerta', () => {
    montar({ aviso: 'A conexão com o módulo caiu durante a etapa.' });
    expect(screen.getByTestId('aviso-etapa').textContent).toBe('A conexão com o módulo caiu durante a etapa.');
    expect(screen.getByTestId('aviso-etapa')).toHaveAttribute('role', 'alert');
  });

  it('foco: ao entrar o painel da etapa o foco vai para "Cancelar etapa" e, na tarefa em gravação, fica em "Parar tarefa"', async () => {
    montar();
    alimentar(10);
    const iniciar = screen.getByRole('button', { name: 'Iniciar repouso' });
    iniciar.focus();
    expect(iniciar).toHaveFocus();
    act(() => controlador.iniciarEtapa('repouso'));
    expect(screen.queryByRole('button', { name: 'Iniciar repouso' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar etapa' })).toHaveFocus();
    act(() => controlador.cancelarEtapa());
    await passar(250);
    expect(screen.queryByTestId('etapa-ativa')).not.toBeInTheDocument();

    act(() => controlador.iniciarEtapa('tarefa'));
    expect(screen.getByRole('button', { name: 'Cancelar etapa' })).toHaveFocus();
    act(() => alimentar(1500 + 500)); // 3 s de preparo e 1 s de tarefa a 500 Hz
    await passar(250);
    expect(screen.getByRole('button', { name: 'Parar tarefa' })).toHaveFocus();
  });

  it('desmontar solta o relógio e o ouvinte do controlador', () => {
    const { unmount } = montar();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    // Evento depois de desmontar não faz nada (e não lança).
    alimentar(10);
    expect(() => controlador.iniciarEtapa('repouso')).not.toThrow();
  });
});
