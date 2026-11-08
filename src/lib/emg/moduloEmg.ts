// Serviço de conexão ao módulo EMG "RunE W2" (lado do profissional, módulo "aplicacoes").
// Protocolo: docs/emg-protocolo-runew2.md. Este arquivo só fala bytes pelo Bluetooth (tiposBle.ts),
// então roda igual no navegador, no plugin do app e no simulador (simulador.ts).
//
// O que ele faz ao conectar (spec, item 1): escolhe o módulo pelo nome, assina a fff4 e, contados
// a partir da assinatura, lê a bateria (~1000 ms), lê a taxa (~1500 ms) e desliga o filtro do
// hardware (~2000 ms), porque o filtro é feito aqui (filtros.ts, rede de 50 ou 60 Hz).
// Depois da 1ª conexão, lê as versões de hardware e de software (0x01 e 0x02, só diagnóstico).
//
// Decisões que a spec não tomava (e que o aparelho real pode desmentir):
// - conectar() resolve quando a taxa chega ou em 4 s; sem resposta assume 500 Hz e marca
//   `taxaAssumida` e uma linha "taxa assumida" no diagnóstico. Uma resposta tardia corrige isso.
// - iniciar() espera o comando do filtro do hardware ter saído (a fila é FIFO), para a aquisição
//   nunca começar antes de o filtro ser desligado. Manda 0x11 modo 3 direto, sem pedir o tipo 0x1D
//   (como o app original); perguntarTipoDeHardware() existe só para diagnóstico na tela.
// - O carimbo (`tsMs`) entregue em onAmostras é o do quadro, no relógio do módulo (a spec só o
//   descreve para o RMS: instante do último ponto). Por isso `lacunasSuspeitas` é só diagnóstico:
//   compara o salto entre carimbos com a duração das amostras recebidas e NUNCA altera o sinal.
// - parar() deixa de entregar amostras na hora: quadros que ainda estavam a caminho são contados, mas
//   não viram amostras.
// - Se a conexão cai, religa sozinho (espera de 0,5 s a 8 s, até 12 tentativas), refaz o aperto de mão,
//   zera o filtro e retoma a aquisição se estava adquirindo (se o usuário pediu parar() durante a queda,
//   manda parar ao voltar). Os quadros do intervalo se perdem: o salto do carimbo aparece em
//   `lacunasSuspeitas`, e o sinal não é preenchido.
// - desconectar() manda "parar" antes de soltar o Bluetooth quando estava adquirindo (melhor
//   esforço, não bloqueia) e não deixa ouvinte nenhum para trás. Os ouvintes de quem usa o serviço
//   (onAmostras etc.) ficam: quem se inscreveu é quem cancela.
// - Contadores e diagnóstico valem desde o último conectar() e atravessam as reconexões.
// - `brutas` e `filtradas` de onAmostras são entregues sem cópia a todos os inscritos: não alterar.
//
// Teste com o aparelho real (seção 6 da spec): "Ver dados recebidos" = ultimosQuadrosHex, os contadores
// e o diagnóstico. Sinais de que uma suposição falhou: `quadrosInvalidos` ou `bytesDescartados` subindo
// (moldura ou conteúdo diferentes da spec); "o carimbo ... não avançou", ou lacunas sem perda real
// (o carimbo do quadro bruto teria outro significado); um pequeno salto ou repetição a cada quadro no
// sinal (a 1ª amostra do quadro talvez não seja emitida pelo aparelho: opção incluirPrimeiraAmostra);
// "taxa assumida" (o módulo não respondeu à leitura da taxa).
//
// Nada lança dentro do callback do Bluetooth: o que der errado vira linha de diagnóstico e contador.

import { bluetoothNativo, rodandoNoAppNativo } from "../dinamometria/bleNativo";
import { ehIosNoNavegador } from "../dinamometria/celulaBle";
import { FiltroIIR, projetarFiltroEmg } from "./filtros";
import {
  AcumuladorDeQuadros,
  ENDERECO,
  MODO,
  PREFIXO_NOME,
  UUID_ESCRITA,
  UUID_NOTIFICACAO,
  UUID_SERVICO,
  cmd,
  interpretarQuadro,
  montarComando,
  type EventoModulo,
  type ModeloHardware,
  type Quadro,
} from "./protocolo";
import type { CaracteristicaBle, DispositivoBle, EventoValorBle, ServicoBle, TransporteBle } from "./tiposBle";

export { ehIosNoNavegador };

export const UUID_SERVICO_BATERIA = "0000180f-0000-1000-8000-00805f9b34fb";

/** Quantos quadros recentes (em hexadecimal) ficam guardados para "Ver dados recebidos". */
export const MAX_QUADROS_HEX = 20;

const ATRASO_BATERIA_MS = 1000;
const ATRASO_TAXA_MS = 1500;
const ATRASO_FILTRO_MS = 2000;
const ATRASO_VERSOES_MS = 500;
const ATRASO_ENTRE_VERSOES_MS = 250;
const LIMITE_TAXA_MS = 4000;
const TAXA_ASSUMIDA_HZ = 500;

const TENTATIVAS_ESCRITA = 3;
const LIMITE_ESCRITA_MS = 1500;
const LIMITE_ACK_MS = 1500;
const PAUSA_ENTRE_ESCRITAS_MS = 40;
const PAUSA_APOS_ERRO_ESCRITA_MS = 120;

const TENTATIVAS_RECONEXAO = 12;
const ESPERA_RECONEXAO_INICIAL_MS = 500;
const ESPERA_RECONEXAO_MAXIMA_MS = 8000;

/** Salto de carimbo maior que 1,5x a duração das amostras do quadro (mais 2 amostras) é lacuna suspeita. */
const FATOR_LACUNA = 1.5;
const AMOSTRAS_DE_FOLGA_LACUNA = 2;

const MAX_LINHAS_DIAGNOSTICO = 200;
const MAX_CHAVES_LIMITADAS = 200;
const BYTES_DE_AMOSTRA_NO_DIAGNOSTICO = 16;

const MSG_SEM_CONEXAO = "Sem conexão com o módulo.";
const MSG_EEG =
  "Este módulo é de EEG (ondas cerebrais), não de EMG. Conecte um módulo de EMG para medir a atividade do músculo.";

export type EstadoModulo = "desconectado" | "conectando" | "conectado" | "adquirindo" | "reconectando";

export interface StatusModulo {
  estado: EstadoModulo;
  nome?: string;
  erro?: string;
}

/** Amostras de um quadro bruto, em µV (unidade provável, não confirmada). */
export interface LoteDeAmostras {
  brutas: Float64Array;
  filtradas: Float64Array;
  /** Carimbo do quadro no relógio do módulo (ms de época). */
  tsMs: number;
  fsHz: number;
}

export interface OpcoesModuloEmg {
  /**
   * Transporte Bluetooth. Omitido: o do ambiente (bluetoothDoAmbiente), escolhido ao conectar.
   * `null`: sem Bluetooth (conectar() recusa com a mensagem para o usuário).
   */
  bluetooth?: TransporteBle | null;
  /** Espera injetável (testes). Padrão: setTimeout. */
  esperar?: (ms: number) => Promise<void>;
  /** Relógio injetável (testes), em ms de época; vai no comando de iniciar e de parar. Padrão: Date.now. */
  agora?: () => number;
  /** Frequência da rede elétrica para o notch (padrão 60 Hz, como no Brasil). */
  redeHz?: 50 | 60;
  /** Se o quadro bruto também emite a amostra-base (padrão true). Ponto 2 não confirmado da spec, seção 6. */
  incluirPrimeiraAmostra?: boolean;
}

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

/** Plugin nativo no app, `navigator.bluetooth` no navegador, ou null quando não há Bluetooth. */
export function bluetoothDoAmbiente(): TransporteBle | null {
  if (rodandoNoAppNativo()) return bluetoothNativo;
  if (typeof navigator === "undefined") return null;
  const bluetooth = (navigator as unknown as { bluetooth?: TransporteBle }).bluetooth;
  return bluetooth ?? null;
}

/** Mensagem para a tela quando bluetoothDoAmbiente() é null (o iPhone no navegador tem a sua). */
export function mensagemSemBluetooth(): string {
  if (ehIosNoNavegador()) {
    return "O Safari e o Chrome do iPhone não têm Bluetooth. Abra o My Health ID no app Bluefy ou use o app nativo.";
  }
  return "Este navegador não tem Bluetooth. Use o Chrome no Android ou no computador.";
}

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------

/** Erro com texto já pronto para o usuário. */
class ErroDoModulo extends Error {}

/** A conexão foi cancelada por desconectar() enquanto conectava. */
class ConexaoCancelada extends Error {
  constructor() {
    super("Conexão cancelada.");
  }
}

interface Adiada<T> {
  promessa: Promise<T>;
  resolver: (valor: T) => void;
  rejeitar: (erro: unknown) => void;
}

function adiada<T>(): Adiada<T> {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

function hexDe(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function hexDoEndereco(endereco: number): string {
  return `0x${endereco.toString(16).padStart(2, "0").toUpperCase()}`;
}

function normalizarUuid(uuid: string): string {
  const u = String(uuid).toLowerCase();
  if (/^[0-9a-f]{4}$/.test(u)) return `0000${u}-0000-1000-8000-00805f9b34fb`;
  if (/^[0-9a-f]{8}$/.test(u)) return `${u}-0000-1000-8000-00805f9b34fb`;
  return u;
}

function mesmoUuid(a: string, b: string): boolean {
  return normalizarUuid(a) === normalizarUuid(b);
}

function uuidCurto(uuid: string): string {
  const m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/.exec(normalizarUuid(uuid));
  return m ? m[1] : uuid;
}

function propriedades(c: CaracteristicaBle): string {
  const p = c.properties;
  const nomes: [boolean | undefined, string][] = [
    [p.read, "read"],
    [p.write, "write"],
    [p.writeWithoutResponse, "writeWithoutResponse"],
    [p.notify, "notify"],
    [p.indicate, "indicate"],
  ];
  return nomes.filter(([ligada]) => ligada).map(([, nome]) => nome).join(",");
}

/** Texto do módulo sem o lixo de controle que o quadro pode trazer no fim. */
function limparTexto(texto: string): string {
  let fim = texto.length;
  while (fim > 0 && texto.charCodeAt(fim - 1) <= 0x20) fim--;
  return texto.slice(0, fim).trim();
}

function traduzirErroDoRequestDevice(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : "";
  const texto = mensagemDe(erro);
  if (nome === "NotFoundError" || /cancel/i.test(texto)) {
    return "Nenhum módulo foi escolhido. Ligue o RunE W2 perto do aparelho e tente de novo.";
  }
  if (nome === "SecurityError" || nome === "NotAllowedError") {
    return "O Bluetooth está bloqueado. Libere a permissão de Bluetooth para o My Health ID e tente de novo.";
  }
  return `Não consegui procurar o módulo: ${texto}`;
}

function esperaPadrao(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface TravaDeTela {
  release(): Promise<void>;
  addEventListener?(tipo: "release", ouvinte: () => void): void;
}

interface WakeLockSimples {
  request(tipo: "screen"): Promise<TravaDeTela>;
}

/** Uma conexão GATT já assinada. Só vale enquanto `ativa`; depois de cair, nada mais usa ela. */
interface Sessao {
  ativa: boolean;
  readonly escrita: CaracteristicaBle;
  readonly notificacao: CaracteristicaBle;
  readonly aoReceber: (ev: EventoValorBle) => void;
  /** Resolve quando o comando do filtro do hardware saiu (ou a sessão acabou): aí iniciar() pode mandar. */
  readonly pronta: Promise<void>;
  liberarPronta: () => void;
}

interface Envio {
  /** Resolve quando a escrita terminou; rejeita se falhou nas tentativas ou se não há conexão. */
  gravado: Promise<void>;
  /** Resolve true se chegou qualquer quadro com o ADDR do comando em até 1,5 s; nunca rejeita. */
  confirmado: Promise<boolean>;
}

interface EsperaDeAck {
  promessa: Promise<boolean>;
  cancelar(): void;
}

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

export class ModuloEmg {
  taxaHz: 500 | 1000 | null = null;
  /** Verdadeiro quando a taxa é suposição (o módulo não respondeu à leitura em 4 s). */
  taxaAssumida = false;
  bateriaPct: number | null = null;
  hardware: ModeloHardware | null = null;
  versaoHw: string | null = null;
  versaoSw: string | null = null;

  private readonly bluetooth: TransporteBle | null | undefined;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly agora: () => number;
  private readonly redeHz: 50 | 60;
  private readonly incluirPrimeiraAmostra: boolean;

  private estado: EstadoModulo = "desconectado";
  private erro: string | undefined;
  private dispositivo: DispositivoBle | null = null;
  private sessao: Sessao | null = null;
  /** Sobe a cada conexão nova e a cada desconectar(): quem ficou para trás percebe e desiste. */
  private geracao = 0;
  /** Sobe a cada iniciar() e parar(): um iniciar() que perdeu a vez não manda nada. */
  private ordemAquisicao = 0;
  private aquisicaoPedida = false;
  /** parar() foi pedido sem conexão, durante uma reconexão: o módulo pode ter seguido adquirindo, então manda parar ao voltar. */
  private pararAoReconectar = false;
  private conectandoAgora: Promise<void> | null = null;
  private iniciandoAgora: { ordem: number; promessa: Promise<void> } | null = null;
  private desligamentoPendente: Promise<void> = Promise.resolve();

  private fila: Promise<void> = Promise.resolve();
  private readonly acks = new Set<{ endereco: number; resolver: (chegou: boolean) => void }>();
  private readonly esperasDeTaxa = new Set<(chegou: boolean) => void>();

  private readonly acumulador = new AcumuladorDeQuadros();
  private filtro: FiltroIIR | null = null;
  private ultimoTsMs: number | null = null;

  private readonly contadores = { recebidos: 0, invalidos: 0, descartados: 0, lacunas: 0 };
  private readonly linhas: string[] = [];
  private readonly ultimosHex: string[] = [];
  private readonly ocorrencias = new Map<string, number>();

  private readonly ouvintesAmostras = new Set<(lote: LoteDeAmostras) => void>();
  private readonly ouvintesStatus = new Set<(status: StatusModulo) => void>();
  private readonly ouvintesBateria = new Set<(pct: number) => void>();
  private readonly ouvintesQuadro = new Set<(hex: string) => void>();
  private ultimaChaveStatus = "desconectado||";

  private querTela = false;
  private trava: TravaDeTela | null = null;
  private pedindoTrava = false;
  private ouvindoVisibilidade = false;

  constructor(opcoes: OpcoesModuloEmg = {}) {
    const { bluetooth, esperar = esperaPadrao, agora = Date.now, redeHz = 60, incluirPrimeiraAmostra = true } = opcoes;
    if (redeHz !== 50 && redeHz !== 60) throw new RangeError(`redeHz deve ser 50 ou 60 (recebido ${redeHz})`);
    this.bluetooth = bluetooth;
    this.esperar = esperar;
    this.agora = agora;
    this.redeHz = redeHz;
    this.incluirPrimeiraAmostra = incluirPrimeiraAmostra;
  }

  // -------------------------------------------------------------------------
  // Leitura do estado
  // -------------------------------------------------------------------------

  get status(): StatusModulo {
    const status: StatusModulo = { estado: this.estado };
    const nome = this.dispositivo?.name;
    if (nome) status.nome = nome;
    if (this.erro) status.erro = this.erro;
    return status;
  }

  /** Quadros com moldura válida (A5 ... 5A), inclusive os que depois se mostraram inválidos. */
  get quadrosRecebidos(): number {
    return this.contadores.recebidos;
  }

  /** Quadros com moldura válida que o decodificador recusou (conteúdo estranho). */
  get quadrosInvalidos(): number {
    return this.contadores.invalidos;
  }

  /** Bytes jogados fora na ressincronização (lixo entre quadros). */
  get bytesDescartados(): number {
    return this.contadores.descartados;
  }

  /** Saltos de carimbo maiores que o esperado entre quadros brutos. Só diagnóstico. */
  get lacunasSuspeitas(): number {
    return this.contadores.lacunas;
  }

  /** Os últimos quadros recebidos, em hexadecimal (A5 ... 5A), do mais antigo ao mais novo. */
  get ultimosQuadrosHex(): string[] {
    return this.ultimosHex.slice();
  }

  /** Linhas de diagnóstico (serviços achados, falhas de escrita, taxa assumida, reconexões...). */
  get diagnostico(): string[] {
    return this.linhas.slice();
  }

  // -------------------------------------------------------------------------
  // Inscrições
  // -------------------------------------------------------------------------

  onAmostras(cb: (lote: LoteDeAmostras) => void): () => void {
    this.ouvintesAmostras.add(cb);
    return () => {
      this.ouvintesAmostras.delete(cb);
    };
  }

  onStatus(cb: (status: StatusModulo) => void): () => void {
    this.ouvintesStatus.add(cb);
    return () => {
      this.ouvintesStatus.delete(cb);
    };
  }

  onBateria(cb: (pct: number) => void): () => void {
    this.ouvintesBateria.add(cb);
    return () => {
      this.ouvintesBateria.delete(cb);
    };
  }

  /** Cada quadro com moldura válida, em hexadecimal (diagnóstico). */
  onQuadro(cb: (hex: string) => void): () => void {
    this.ouvintesQuadro.add(cb);
    return () => {
      this.ouvintesQuadro.delete(cb);
    };
  }

  // -------------------------------------------------------------------------
  // Conexão
  // -------------------------------------------------------------------------

  /**
   * Abre a lista de módulos (precisa vir de um toque do usuário) e conecta. Resolve quando a taxa
   * chegou ou em 4 s. Já conectando: devolve a mesma promessa. Já conectado: não faz nada.
   * Reconectando sozinho: recusa (desconectar() e conectar() de novo, se quiser trocar de módulo).
   */
  conectar(): Promise<void> {
    // Depois de um desconectar() no meio de um conectar() antigo, o estado deixa de ser "conectando": vale uma conexão nova.
    if (this.conectandoAgora && this.estado === "conectando") return this.conectandoAgora;
    if (this.estado === "conectado" || this.estado === "adquirindo") return Promise.resolve();
    if (this.estado === "reconectando") {
      return Promise.reject(new Error("O módulo está reconectando sozinho. Espere ou desconecte antes de conectar de novo."));
    }
    const promessa: Promise<void> = this.executarConexao().finally(() => {
      if (this.conectandoAgora === promessa) this.conectandoAgora = null;
    });
    this.conectandoAgora = promessa;
    return promessa;
  }

  /**
   * Fecha a conexão a pedido do usuário: não reconecta. Se estava adquirindo, manda "parar" antes de
   * soltar (sem esperar) e tira todos os ouvintes do Bluetooth e da tela.
   */
  desconectar(): void {
    this.geracao++;
    this.ordemAquisicao++;
    const sessao = this.sessao;
    const dispositivo = this.dispositivo;
    const escrita = sessao?.ativa ? sessao.escrita : null;
    const pararAntes = this.aquisicaoPedida && escrita !== null;
    this.liberar(undefined);
    if (!dispositivo) return;
    if (pararAntes && escrita) {
      this.desligamentoPendente = this.pararEDesligar(dispositivo, escrita);
      return;
    }
    this.soltarBluetooth(dispositivo);
  }

  private async executarConexao(): Promise<void> {
    const g = ++this.geracao;
    this.reiniciarDadosDaConexao();
    const bluetooth = this.bluetooth === undefined ? bluetoothDoAmbiente() : this.bluetooth;
    if (!bluetooth) throw this.falharConexao(g, mensagemSemBluetooth());

    this.definirEstado("conectando");
    try {
      let dispositivo: DispositivoBle;
      try {
        dispositivo = await bluetooth.requestDevice({
          filters: [{ namePrefix: PREFIXO_NOME }],
          optionalServices: [UUID_SERVICO, UUID_SERVICO_BATERIA],
        });
      } catch (erro) {
        this.registrar(`requestDevice falhou: ${mensagemDe(erro)}`);
        throw new ErroDoModulo(traduzirErroDoRequestDevice(erro));
      }
      this.verificar(g);
      // Um desconectar() recente ainda pode estar soltando o Bluetooth: espera para não derrubar a conexão nova.
      await this.desligamentoPendente;
      this.verificar(g);

      this.dispositivo = dispositivo;
      dispositivo.removeEventListener("gattserverdisconnected", this.aoCair);
      dispositivo.addEventListener("gattserverdisconnected", this.aoCair);
      this.registrar(`módulo escolhido: ${dispositivo.name ?? "(sem nome)"}`);
      this.avisarStatus();

      const sessao = await this.abrirSessao(dispositivo, g);
      this.travarTela();
      this.iniciarHandshake(sessao);
      await this.aguardarTaxaOuLimite(sessao);
      this.verificar(g);
      if (!sessao.ativa) throw new ErroDoModulo("A conexão com o módulo caiu durante a configuração.");
      this.definirEstado("conectado");
    } catch (erro) {
      if (erro instanceof ConexaoCancelada || this.geracao !== g) throw new ConexaoCancelada();
      this.registrar(`falha ao conectar: ${mensagemDe(erro)}`);
      const mensagem = erro instanceof ErroDoModulo ? erro.message : `Não consegui conectar ao módulo: ${mensagemDe(erro)}`;
      throw this.falharConexao(g, mensagem);
    }
  }

  /** Solta tudo, grava o erro no status e devolve o erro para quem chamou lançar. */
  private falharConexao(g: number, mensagem: string): Error {
    if (this.geracao === g) {
      const dispositivo = this.dispositivo;
      this.liberar(mensagem);
      if (dispositivo) this.soltarBluetooth(dispositivo);
    }
    return new Error(mensagem);
  }

  private verificar(g: number): void {
    if (this.geracao !== g) throw new ConexaoCancelada();
  }

  /** Liga o GATT, acha fff0/fff3/fff4 e assina as notificações. Usado na 1ª conexão e em cada reconexão. */
  private async abrirSessao(dispositivo: DispositivoBle, g: number): Promise<Sessao> {
    const desistir = (): never => {
      this.soltarBluetooth(dispositivo);
      throw new ConexaoCancelada();
    };

    const servidor = await dispositivo.gatt.connect();
    if (this.geracao !== g) desistir();

    const servicos = await servidor.getPrimaryServices().catch((erro: unknown): ServicoBle[] => {
      this.registrar(`não consegui listar os serviços: ${mensagemDe(erro)}`);
      return [];
    });
    if (this.geracao !== g) desistir();
    this.registrar(
      servicos.length ? `serviços do módulo: ${servicos.map((s) => uuidCurto(s.uuid)).join(", ")}` : "nenhum serviço encontrado",
    );
    const servico = servicos.find((s) => mesmoUuid(s.uuid, UUID_SERVICO));
    if (!servico) {
      throw new ErroDoModulo(
        "O módulo conectou, mas não mostrou o canal de dados (serviço fff0). Desligue e ligue o módulo e tente de novo.",
      );
    }

    const caracteristicas = await servico.getCharacteristics();
    if (this.geracao !== g) desistir();
    for (const c of caracteristicas) this.registrar(`  fff0 > ${uuidCurto(c.uuid)} [${propriedades(c)}]`);
    const notificacao = caracteristicas.find((c) => mesmoUuid(c.uuid, UUID_NOTIFICACAO));
    const escrita = caracteristicas.find((c) => mesmoUuid(c.uuid, UUID_ESCRITA));
    if (!notificacao || !(notificacao.properties.notify || notificacao.properties.indicate)) {
      throw new ErroDoModulo("O módulo não tem o canal que envia os dados (fff4 com notificação).");
    }
    if (!escrita || !(escrita.properties.writeWithoutResponse || escrita.properties.write)) {
      throw new ErroDoModulo("O módulo não tem o canal que recebe comandos (fff3 com escrita).");
    }

    const pronta = adiada<void>();
    const sessao: Sessao = {
      ativa: true,
      escrita,
      notificacao,
      aoReceber: (ev) => this.aoNotificar(sessao, ev),
      pronta: pronta.promessa,
      liberarPronta: () => pronta.resolver(),
    };
    notificacao.addEventListener("characteristicvaluechanged", sessao.aoReceber);
    this.sessao = sessao;
    try {
      await notificacao.startNotifications();
    } catch (erro) {
      this.encerrarSessao(sessao);
      throw erro;
    }
    if (this.geracao !== g) {
      this.encerrarSessao(sessao);
      desistir();
    }
    return sessao;
  }

  /** Marca a sessão como morta, tira o ouvinte da fff4 e destrava quem estava esperando por ela. */
  private encerrarSessao(sessao: Sessao | null): void {
    if (!sessao) return;
    sessao.ativa = false;
    try {
      sessao.notificacao.removeEventListener("characteristicvaluechanged", sessao.aoReceber);
    } catch {
      // A conexão já caiu: o ouvinte some junto com a característica.
    }
    if (this.sessao === sessao) this.sessao = null;
    sessao.liberarPronta();
    this.resolverTaxa(false);
    this.cancelarAcks();
    this.acumulador.reset();
  }

  /** Tudo que "desconectado" significa: sessão, ouvintes, tela. O Bluetooth em si fica com quem chamou. */
  private liberar(erro: string | undefined): void {
    const dispositivo = this.dispositivo;
    this.aquisicaoPedida = false;
    this.pararAoReconectar = false;
    this.encerrarSessao(this.sessao);
    try {
      dispositivo?.removeEventListener("gattserverdisconnected", this.aoCair);
    } catch {
      // Sem ouvinte para tirar.
    }
    this.dispositivo = null;
    this.soltarTela();
    this.erro = erro;
    this.estado = "desconectado";
    this.avisarStatus();
  }

  private soltarBluetooth(dispositivo: DispositivoBle): void {
    try {
      dispositivo.gatt.disconnect();
    } catch {
      // Já estava desconectado.
    }
  }

  private async pararEDesligar(dispositivo: DispositivoBle, escrita: CaracteristicaBle): Promise<void> {
    try {
      const dados = cmd.parar(this.agora());
      const operacao = escrita.properties.writeWithoutResponse
        ? escrita.writeValueWithoutResponse(dados)
        : escrita.writeValue(dados);
      await Promise.race([operacao, this.esperar(LIMITE_ESCRITA_MS)]);
    } catch (erro) {
      this.registrar(`não consegui mandar parar ao desconectar: ${mensagemDe(erro)}`);
    }
    this.soltarBluetooth(dispositivo);
  }

  // -------------------------------------------------------------------------
  // Queda e reconexão
  // -------------------------------------------------------------------------

  private readonly aoCair = (): void => {
    const sessao = this.sessao;
    if (!sessao || !sessao.ativa) return;
    this.encerrarSessao(sessao);
    // Conectando: conectar() percebe a sessão morta e falha. Reconectando: o laço percebe.
    if (this.estado !== "conectado" && this.estado !== "adquirindo") return;
    void this.reconectar(this.geracao);
  };

  /** Espera crescente (0,5 s até 8 s), até 12 tentativas, retomando a aquisição se estava adquirindo. */
  private async reconectar(g: number): Promise<void> {
    const dispositivo = this.dispositivo;
    if (!dispositivo) return;
    this.registrar("a conexão caiu: religando sozinho");
    this.definirEstado("reconectando");

    for (let i = 0; i < TENTATIVAS_RECONEXAO; i++) {
      await this.esperar(Math.min(ESPERA_RECONEXAO_MAXIMA_MS, ESPERA_RECONEXAO_INICIAL_MS * 2 ** i));
      if (this.geracao !== g) return;
      try {
        const sessao = await this.abrirSessao(dispositivo, g);
        this.filtro?.resetar();
        await this.rodarHandshake(sessao);
        if (this.geracao !== g) return;
        if (!sessao.ativa) throw new Error("a conexão caiu de novo durante a configuração");
        if (this.aquisicaoPedida) {
          await this.enviarIniciar(sessao);
        } else if (this.pararAoReconectar) {
          await this.enviarParar(sessao);
          this.pararAoReconectar = false;
        }
        if (this.geracao !== g) return;
        this.registrar(`reconectado na tentativa ${i + 1}`);
        this.definirEstado(this.aquisicaoPedida ? "adquirindo" : "conectado");
        void this.lerVersoes(sessao);
        return;
      } catch (erro) {
        if (this.geracao !== g) return;
        this.registrar(`tentativa ${i + 1} de ${TENTATIVAS_RECONEXAO} falhou: ${mensagemDe(erro)}`);
        this.encerrarSessao(this.sessao);
        this.soltarBluetooth(dispositivo);
      }
    }

    if (this.geracao !== g) return;
    const mensagem = `Não consegui reconectar ao módulo depois de ${TENTATIVAS_RECONEXAO} tentativas.`;
    this.registrar(mensagem);
    this.liberar(mensagem);
    this.soltarBluetooth(dispositivo);
  }

  // -------------------------------------------------------------------------
  // Aperto de mão
  // -------------------------------------------------------------------------

  private iniciarHandshake(sessao: Sessao): void {
    void this.rodarHandshake(sessao).then(() => this.lerVersoes(sessao));
  }

  /** Bateria (+1000 ms), taxa (+1500 ms) e filtro do hardware desligado (+2000 ms). Nunca lança. */
  private async rodarHandshake(sessao: Sessao): Promise<void> {
    try {
      await this.esperar(ATRASO_BATERIA_MS);
      if (!sessao.ativa) return;
      this.dispararEnvio(sessao, cmd.bateria(), "a leitura da bateria");
      await this.esperar(ATRASO_TAXA_MS - ATRASO_BATERIA_MS);
      if (!sessao.ativa) return;
      this.dispararEnvio(sessao, cmd.taxaDeAmostragem(), "a leitura da taxa de amostragem");
      await this.esperar(ATRASO_FILTRO_MS - ATRASO_TAXA_MS);
      if (!sessao.ativa) return;
      await this.enviar(sessao, cmd.filtroHardware(false)).gravado;
    } catch (erro) {
      this.registrar(`não consegui desligar o filtro do hardware: ${mensagemDe(erro)}`);
    } finally {
      sessao.liberarPronta();
    }
  }

  /** Só diagnóstico: versões de hardware e de software, se ainda não se sabe. */
  private async lerVersoes(sessao: Sessao): Promise<void> {
    try {
      if (this.versaoHw === null) {
        await this.esperar(ATRASO_VERSOES_MS);
        if (!sessao.ativa) return;
        this.dispararEnvio(sessao, cmd.versaoHardware(), "a leitura da versão de hardware");
      }
      if (this.versaoSw === null) {
        await this.esperar(ATRASO_ENTRE_VERSOES_MS);
        if (!sessao.ativa) return;
        this.dispararEnvio(sessao, cmd.versaoSoftware(), "a leitura da versão de software");
      }
    } catch (erro) {
      this.registrar(`não consegui ler as versões: ${mensagemDe(erro)}`);
    }
  }

  private async aguardarTaxaOuLimite(sessao: Sessao): Promise<void> {
    if (this.taxaHz === null) {
      const chegou = adiada<boolean>();
      this.esperasDeTaxa.add(chegou.resolver);
      await Promise.race([chegou.promessa, this.esperar(LIMITE_TAXA_MS).then(() => false)]);
      this.esperasDeTaxa.delete(chegou.resolver);
    }
    if (this.taxaHz === null && sessao.ativa) {
      this.definirTaxa(TAXA_ASSUMIDA_HZ, true);
      this.registrar(
        `taxa assumida: ${TAXA_ASSUMIDA_HZ} Hz (o módulo não respondeu à leitura da taxa em ${LIMITE_TAXA_MS / 1000} s)`,
      );
    }
  }

  private resolverTaxa(chegou: boolean): void {
    for (const resolver of Array.from(this.esperasDeTaxa)) resolver(chegou);
    this.esperasDeTaxa.clear();
  }

  private definirTaxa(hz: 500 | 1000, assumida: boolean): void {
    const mudou = this.taxaHz !== hz;
    this.taxaHz = hz;
    this.taxaAssumida = assumida;
    if (mudou || !this.filtro) this.filtro = this.novoFiltro(hz);
  }

  private novoFiltro(fsHz: number): FiltroIIR {
    return new FiltroIIR(projetarFiltroEmg({ fsHz, redeHz: this.redeHz }));
  }

  // -------------------------------------------------------------------------
  // Aquisição
  // -------------------------------------------------------------------------

  /**
   * Começa a aquisição (0x11 modo 3, direto). Espera o filtro do hardware ter sido desligado e a
   * confirmação do módulo (até 1,5 s; sem ela segue, e o diagnóstico anota). Zera o filtro do app.
   */
  iniciar(): Promise<void> {
    const emAndamento = this.iniciandoAgora;
    if (emAndamento && emAndamento.ordem === this.ordemAquisicao) return emAndamento.promessa;
    const ordem = ++this.ordemAquisicao;
    const promessa: Promise<void> = this.executarInicio(ordem).finally(() => {
      if (this.iniciandoAgora?.promessa === promessa) this.iniciandoAgora = null;
    });
    this.iniciandoAgora = { ordem, promessa };
    return promessa;
  }

  private async executarInicio(ordem: number): Promise<void> {
    if (this.estado === "adquirindo") return;
    if (this.estado === "reconectando") {
      throw new Error("O módulo está reconectando. Espere a conexão voltar para iniciar.");
    }
    const sessao = this.sessao;
    if (this.estado !== "conectado" || !sessao || !sessao.ativa) {
      throw new Error("Conecte ao módulo antes de iniciar a captura.");
    }
    if (this.ehEeg()) throw new Error(MSG_EEG);

    await sessao.pronta;
    // parar() (ou outro iniciar()) chegou durante a espera: quem pediu depois manda.
    if (this.ordemAquisicao !== ordem) return;
    if (!sessao.ativa || this.sessao !== sessao) throw new Error(MSG_SEM_CONEXAO);
    if (this.ehEeg()) throw new Error(MSG_EEG);

    this.filtro?.resetar();
    this.ultimoTsMs = null;
    this.aquisicaoPedida = true;
    this.pararAoReconectar = false;
    this.definirEstado("adquirindo");
    try {
      await this.enviarIniciar(sessao);
    } catch (erro) {
      if (this.ordemAquisicao === ordem) {
        this.aquisicaoPedida = false;
        if (this.estaAdquirindo()) this.definirEstado("conectado");
      }
      throw erro;
    }
  }

  private async enviarIniciar(sessao: Sessao): Promise<void> {
    const envio = this.enviar(sessao, cmd.iniciar(MODO.EMG, this.agora()));
    await envio.gravado;
    await envio.confirmado;
  }

  /**
   * Para a aquisição: deixa de entregar amostras na hora e manda o comando de parar. Sem conexão
   * (reconectando, por exemplo) só cancela a retomada automática. Pode ser chamado a qualquer momento.
   */
  async parar(): Promise<void> {
    this.ordemAquisicao++;
    this.aquisicaoPedida = false;
    if (this.estado === "adquirindo") this.definirEstado("conectado");
    const sessao = this.sessao;
    if (!sessao || !sessao.ativa) {
      if (this.estado === "reconectando") this.pararAoReconectar = true;
      return;
    }
    try {
      await this.enviarParar(sessao);
    } catch (erro) {
      throw new Error(`Não consegui mandar o módulo parar: ${mensagemDe(erro)}`);
    }
  }

  private async enviarParar(sessao: Sessao): Promise<void> {
    const envio = this.enviar(sessao, cmd.parar(this.agora()));
    await envio.gravado;
    await envio.confirmado;
  }

  /**
   * Diagnóstico: pergunta o tipo do módulo (0x1D), que o app original nunca pergunta. Se o módulo
   * responder, `hardware` é preenchido; se for de EEG, iniciar() recusa. Devolve `hardware`.
   */
  async perguntarTipoDeHardware(): Promise<ModeloHardware | null> {
    const sessao = this.sessao;
    if ((this.estado !== "conectado" && this.estado !== "adquirindo") || !sessao || !sessao.ativa) {
      throw new Error("Conecte ao módulo antes de perguntar o tipo.");
    }
    const envio = this.enviar(sessao, montarComando(false, ENDERECO.TIPO_HARDWARE));
    await envio.gravado;
    await envio.confirmado;
    return this.hardware;
  }

  // Método à parte porque, depois de um await, o TypeScript ainda acha que `this.estado` não mudou.
  private estaAdquirindo(): boolean {
    return this.estado === "adquirindo";
  }

  private ehEeg(): boolean {
    return this.hardware === "EEG-Module" || this.hardware === "EEG-Pro";
  }

  // -------------------------------------------------------------------------
  // Escrita: fila serial, 3 tentativas, 1,5 s por escrita, ACK fora da fila
  // -------------------------------------------------------------------------

  /**
   * O Chrome recusa uma escrita GATT enquanto outra está em andamento: tudo passa por uma fila.
   * Esperar o ACK não trava a fila: a espera começa depois da escrita e corre por fora dela.
   */
  private enviar(sessao: Sessao, comando: Uint8Array): Envio {
    const endereco = comando[3];
    const gravacao = adiada<void>();
    const confirmacao = adiada<boolean>();
    gravacao.promessa.catch(() => undefined);

    this.fila = this.fila.then(async () => {
      let espera: EsperaDeAck | null = null;
      let gravou = false;
      try {
        if (!sessao.ativa) throw new Error(MSG_SEM_CONEXAO);
        // O ACK pode chegar antes de a promessa da escrita resolver: quem espera se registra antes de escrever.
        espera = this.esperarAck(endereco);
        await this.escreverComTentativas(sessao, comando);
        gravou = true;
        gravacao.resolver();
        void this.aguardarAck(sessao, espera, endereco).then(confirmacao.resolver);
        await this.esperar(PAUSA_ENTRE_ESCRITAS_MS);
      } catch (erro) {
        if (!gravou) espera?.cancelar();
        gravacao.rejeitar(erro);
        confirmacao.resolver(false);
      }
    });
    return { gravado: gravacao.promessa, confirmado: confirmacao.promessa };
  }

  private dispararEnvio(sessao: Sessao, comando: Uint8Array, rotulo: string): void {
    this.enviar(sessao, comando).gravado.catch((erro: unknown) => {
      this.registrar(`falha ao enviar ${rotulo}: ${mensagemDe(erro)}`);
    });
  }

  private async escreverComTentativas(sessao: Sessao, dados: Uint8Array): Promise<void> {
    let ultimoErro: unknown = null;
    for (let tentativa = 1; tentativa <= TENTATIVAS_ESCRITA; tentativa++) {
      if (!sessao.ativa) throw new Error(MSG_SEM_CONEXAO);
      try {
        const car = sessao.escrita;
        const operacao = car.properties.writeWithoutResponse ? car.writeValueWithoutResponse(dados) : car.writeValue(dados);
        // Uma escrita que nunca responde não pode travar a fila.
        await Promise.race([
          operacao,
          this.esperar(LIMITE_ESCRITA_MS).then(() => {
            throw new Error("a escrita não respondeu");
          }),
        ]);
        return;
      } catch (erro) {
        ultimoErro = erro;
        this.registrar(
          `comando ${hexDoEndereco(dados[3])} falhou (tentativa ${tentativa} de ${TENTATIVAS_ESCRITA}): ${mensagemDe(erro)}`,
        );
        if (tentativa < TENTATIVAS_ESCRITA) await this.esperar(PAUSA_APOS_ERRO_ESCRITA_MS);
      }
    }
    throw ultimoErro;
  }

  private esperarAck(endereco: number): EsperaDeAck {
    const chegou = adiada<boolean>();
    const item = { endereco, resolver: chegou.resolver };
    this.acks.add(item);
    return {
      promessa: chegou.promessa,
      cancelar: () => {
        this.acks.delete(item);
        chegou.resolver(false);
      },
    };
  }

  private async aguardarAck(sessao: Sessao, espera: EsperaDeAck, endereco: number): Promise<boolean> {
    const chegou = await Promise.race([espera.promessa, this.esperar(LIMITE_ACK_MS).then(() => false)]);
    if (!chegou) {
      espera.cancelar();
      if (sessao.ativa) {
        this.registrar(`o módulo não respondeu ao comando ${hexDoEndereco(endereco)} em ${LIMITE_ACK_MS / 1000} s`);
      }
    }
    return chegou;
  }

  private resolverAcks(endereco: number): void {
    for (const item of Array.from(this.acks)) {
      if (item.endereco !== endereco) continue;
      this.acks.delete(item);
      item.resolver(true);
    }
  }

  private cancelarAcks(): void {
    for (const item of Array.from(this.acks)) item.resolver(false);
    this.acks.clear();
  }

  // -------------------------------------------------------------------------
  // Recepção
  // -------------------------------------------------------------------------

  private aoNotificar(sessao: Sessao, ev: EventoValorBle): void {
    if (!sessao.ativa) return;
    try {
      const valor = ev.target.value;
      if (!valor) return;
      this.processarBytes(new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength));
    } catch (erro) {
      this.registrarLimitado("falha-interna", `erro ao processar uma notificação: ${mensagemDe(erro)}`, 5);
    }
  }

  private processarBytes(bytes: Uint8Array): void {
    const antes = this.acumulador.descartados;
    const quadros = this.acumulador.push(bytes);
    const novos = this.acumulador.descartados - antes;
    if (novos > 0) {
      this.contadores.descartados += novos;
      this.registrarLimitado(
        "lixo",
        `${novos} byte(s) fora de quadro descartado(s); início do pedaço recebido: ${hexDe(bytes.subarray(0, BYTES_DE_AMOSTRA_NO_DIAGNOSTICO))}`,
        5,
      );
    }
    for (const quadro of quadros) {
      try {
        this.processarQuadro(quadro);
      } catch (erro) {
        this.registrarLimitado("falha-interna", `erro ao processar um quadro: ${mensagemDe(erro)}`, 5);
      }
    }
  }

  private processarQuadro(quadro: Quadro): void {
    this.contadores.recebidos++;
    const hex = hexDe(quadro.bytes);
    this.ultimosHex.push(hex);
    if (this.ultimosHex.length > MAX_QUADROS_HEX) this.ultimosHex.shift();
    this.chamar(this.ouvintesQuadro, hex, "quadro");
    this.resolverAcks(quadro.endereco);
    this.tratarEvento(interpretarQuadro(quadro, { incluirPrimeiraAmostra: this.incluirPrimeiraAmostra }));
  }

  private tratarEvento(evento: EventoModulo): void {
    switch (evento.tipo) {
      case "bruto":
        this.tratarBruto(evento);
        return;
      case "taxa":
        this.registrar(`taxa de amostragem: ${evento.hz} Hz`);
        this.definirTaxa(evento.hz, false);
        this.resolverTaxa(true);
        return;
      case "bateria":
        this.bateriaPct = evento.pct;
        this.chamar(this.ouvintesBateria, evento.pct, "bateria");
        return;
      case "versao_hw":
        this.versaoHw = limparTexto(evento.texto) || null;
        return;
      case "versao_sw":
        this.versaoSw = limparTexto(evento.texto) || null;
        return;
      case "hardware":
        this.tratarHardware(evento.modelo);
        return;
      case "invalido":
        this.contadores.invalidos++;
        this.registrarLimitado(`invalido:${evento.motivo}`, `quadro inválido: ${evento.motivo}`, 3);
        return;
      case "ack":
        return;
      default:
        this.registrarLimitado(`ignorado:${evento.tipo}`, `evento "${evento.tipo}" recebido e ignorado`, 1);
    }
  }

  private tratarBruto(evento: Extract<EventoModulo, { tipo: "bruto" }>): void {
    if (evento.canal !== "emg") {
      this.registrarLimitado("bruto-eeg", "quadro bruto de EEG recebido: ignorado (o esperado é EMG)", 1);
      return;
    }
    if (!this.aquisicaoPedida || evento.amostras.length === 0) return;
    const fsHz = this.taxaHz ?? TAXA_ASSUMIDA_HZ;
    if (!this.filtro) this.filtro = this.novoFiltro(fsHz);
    this.detectarLacuna(evento.tsMs, evento.amostras.length, fsHz);
    const filtradas = this.filtro.processarBloco(evento.amostras);
    this.chamar(this.ouvintesAmostras, { brutas: evento.amostras, filtradas, tsMs: evento.tsMs, fsHz }, "amostras");
  }

  private tratarHardware(modelo: ModeloHardware): void {
    this.hardware = modelo;
    if (this.ehEeg()) {
      this.erro = MSG_EEG;
      this.registrar(`tipo do módulo: ${modelo}: recusado`);
      this.avisarStatus();
      if (this.aquisicaoPedida) {
        this.parar().catch((erro: unknown) => {
          this.registrar(`não consegui parar o módulo de EEG: ${mensagemDe(erro)}`);
        });
      }
      return;
    }
    this.registrar(`tipo do módulo: ${modelo}`);
    if (this.erro === MSG_EEG) {
      this.erro = undefined;
      this.avisarStatus();
    }
  }

  /**
   * Salto de carimbo maior que a duração das amostras do quadro: provável perda de quadros. Só conta e
   * anota. O significado do carimbo no quadro bruto é suposição (ver o cabeçalho), então o sinal fica como veio.
   */
  private detectarLacuna(tsMs: number, nAmostras: number, fsHz: number): void {
    const anterior = this.ultimoTsMs;
    this.ultimoTsMs = tsMs;
    if (anterior === null) return;
    const delta = tsMs - anterior;
    const periodoMs = 1000 / fsHz;
    if (delta <= 0) {
      this.registrarLimitado(
        "carimbo-parado",
        `o carimbo do quadro bruto não avançou (variação de ${delta} ms): o significado do carimbo pode ser outro`,
        3,
      );
      return;
    }
    const esperadoMs = nAmostras * periodoMs;
    if (delta > FATOR_LACUNA * esperadoMs + AMOSTRAS_DE_FOLGA_LACUNA * periodoMs) {
      this.contadores.lacunas++;
      this.registrarLimitado(
        "lacuna",
        `lacuna suspeita: o carimbo saltou ${Math.round(delta)} ms (esperado perto de ${Math.round(esperadoMs)} ms)`,
        10,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Estado, diagnóstico e ouvintes
  // -------------------------------------------------------------------------

  private reiniciarDadosDaConexao(): void {
    this.linhas.length = 0;
    this.ultimosHex.length = 0;
    this.ocorrencias.clear();
    this.contadores.recebidos = 0;
    this.contadores.invalidos = 0;
    this.contadores.descartados = 0;
    this.contadores.lacunas = 0;
    this.taxaHz = null;
    this.taxaAssumida = false;
    this.bateriaPct = null;
    this.hardware = null;
    this.versaoHw = null;
    this.versaoSw = null;
    this.erro = undefined;
    this.filtro = null;
    this.ultimoTsMs = null;
    this.pararAoReconectar = false;
    this.acumulador.reset();
  }

  private definirEstado(estado: EstadoModulo): void {
    this.estado = estado;
    this.avisarStatus();
  }

  private avisarStatus(): void {
    const status = this.status;
    const chave = `${status.estado}|${status.nome ?? ""}|${status.erro ?? ""}`;
    if (chave === this.ultimaChaveStatus) return;
    this.ultimaChaveStatus = chave;
    this.chamar(this.ouvintesStatus, status, "status");
  }

  private registrar(texto: string): void {
    this.linhas.push(texto);
    if (this.linhas.length > MAX_LINHAS_DIAGNOSTICO) this.linhas.splice(0, this.linhas.length - MAX_LINHAS_DIAGNOSTICO);
  }

  /** Anota só as primeiras `max` ocorrências de cada tipo, para um defeito repetido não encher o diagnóstico. */
  private registrarLimitado(chave: string, texto: string, max: number): void {
    const n = (this.ocorrencias.get(chave) ?? 0) + 1;
    if (n === 1 && this.ocorrencias.size >= MAX_CHAVES_LIMITADAS) return;
    this.ocorrencias.set(chave, n);
    if (n <= max) this.registrar(texto);
    else if (n === max + 1) this.registrar(`(mais ocorrências de "${chave}" não serão listadas)`);
  }

  /** Chama cada inscrito; um que lança vira linha de diagnóstico e não atrapalha os outros. */
  private chamar<T>(ouvintes: Set<(valor: T) => void>, valor: T, rotulo: string): void {
    for (const ouvinte of Array.from(ouvintes)) {
      try {
        ouvinte(valor);
      } catch (erro) {
        this.registrarLimitado(`ouvinte:${rotulo}`, `um ouvinte de ${rotulo} lançou um erro: ${mensagemDe(erro)}`, 3);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tela ligada enquanto conectado
  // -------------------------------------------------------------------------

  private readonly aoMudarVisibilidade = (): void => {
    if (typeof document === "undefined" || document.visibilityState !== "visible") return;
    // O navegador solta a trava quando a tela some; pede de novo ao voltar.
    if (this.querTela) void this.pedirTrava();
  };

  private travarTela(): void {
    this.querTela = true;
    if (typeof document !== "undefined" && !this.ouvindoVisibilidade) {
      document.addEventListener("visibilitychange", this.aoMudarVisibilidade);
      this.ouvindoVisibilidade = true;
    }
    void this.pedirTrava();
  }

  private async pedirTrava(): Promise<void> {
    if (this.trava || this.pedindoTrava) return;
    this.pedindoTrava = true;
    try {
      const wakeLock =
        typeof navigator === "undefined" ? undefined : (navigator as unknown as { wakeLock?: WakeLockSimples }).wakeLock;
      if (!wakeLock) return;
      const trava = await wakeLock.request("screen");
      if (!this.querTela) {
        await trava.release();
        return;
      }
      this.trava = trava;
      trava.addEventListener?.("release", () => {
        if (this.trava === trava) this.trava = null;
      });
    } catch {
      // Sem wake lock: segue normal, só não impede a tela de apagar.
    } finally {
      this.pedindoTrava = false;
    }
  }

  private soltarTela(): void {
    this.querTela = false;
    if (this.ouvindoVisibilidade && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.aoMudarVisibilidade);
    }
    this.ouvindoVisibilidade = false;
    const trava = this.trava;
    this.trava = null;
    if (!trava) return;
    try {
      Promise.resolve(trava.release()).catch(() => undefined);
    } catch {
      // Já liberada.
    }
  }
}
