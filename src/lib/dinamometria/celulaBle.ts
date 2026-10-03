// Conexão com a célula de carga Bluetooth (BLE) — ex.: "$FBLOCK-0068".
//
// FBLOCK (Queling / app FightTech) — protocolo binário no Nordic UART, lido do
// próprio app do fabricante. Comandos de 1 byte em 6E400002:
//   0x20 ao conectar · 0x30 iniciar · 0x31 parar · 0x40 zerar · 0x61 reset
//   (0x60 é calibração — nunca enviamos).
// Pacotes em 6E400003, pelo 1º byte:
//   0x21 bateria (bytes 2-3, LE) → o app responde zerando (0x40)
//   0x40 zero: inteiro de 24 bits com sinal (bytes 1-3, LE) = leitura bruta em repouso
//   0x10 dados: sequência de inteiros de 24 bits com sinal (LE), 250 Hz;
//        kg = (bruto − zero) × 800 / 8388608
//
// Outras células seriais: texto, uma leitura por linha (CR+LF).
//
// Usa Web Bluetooth: funciona no Chrome/Edge (Android e computador). Não existe
// no Safari/iPhone nem dentro do WebView do app nativo.

/* eslint-disable @typescript-eslint/no-explicit-any */

const SERVICOS_SERIAIS: string[] = [
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC254x
  '0000fff0-0000-1000-8000-00805f9b34fb', // genérico chinês
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000fee0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip / ISSC
  '0000abf0-0000-1000-8000-00805f9b34fb', // ESP32 SPP
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ffc0-0000-1000-8000-00805f9b34fb',
  '0000ffd0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000fefb-0000-1000-8000-00805f9b34fb', // Telit / Stollmann
  '2456e1b9-26e2-8f83-e744-f34f01e9d701', // u-blox
  '569a1101-b87f-490c-92cb-11ba5ea5167c', // Laird
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // clones HM-10 / BT05
  'f000c0e0-0451-4000-b000-000000000000', // TI CC26xx
  '0000180a-0000-1000-8000-00805f9b34fb', // informações do aparelho (diagnóstico)
];

// Bateria e similares mandam notificação mas não são a força.
const IGNORAR_CHARS = ['00002a19-0000-1000-8000-00805f9b34fb'];

export const bluetoothDisponivel = () => typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

export interface Leitura { valor: number; tMs: number }
type Ouvinte = (l: Leitura) => void;
type OuvinteLinha = (linha: string) => void;
type OuvinteStatus = (s: StatusCelula) => void;

// reconectando: a conexão caiu e o app está religando sozinho.
export type StatusCelula = { conectado: false; reconectando?: boolean; nome?: string } | { conectado: true; nome: string };

// Qual número da linha é a força: 'auto' = único número, ou o último quando há
// vários (ex.: "t;f"). Ajustável na tela se a célula mandar outro formato.
export type CampoValor = 'auto' | number;

const reNumero = /-?\d+(?:[.,]\d+)?/g;

export function valorDaLinha(linha: string, campo: CampoValor): number | null {
  const nums = (linha.match(reNumero) || []).map((s) => Number(s.replace(',', '.'))).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  if (campo === 'auto') return nums[nums.length - 1];
  return nums[campo] ?? null;
}

// Voltagem (V) → carga (%) pela curva típica de bateria de lítio de 1 célula.
// A célula desliga perto de 3,40 V (mesma faixa "vazia" do FightTech).
const CURVA_BATERIA: [number, number][] = [
  [3.40, 0], [3.55, 5], [3.65, 10], [3.70, 15], [3.73, 20], [3.75, 25], [3.77, 30], [3.79, 35], [3.80, 40],
  [3.82, 45], [3.84, 50], [3.85, 55], [3.87, 60], [3.91, 65], [3.95, 70], [3.98, 75], [4.02, 80], [4.08, 85],
  [4.11, 90], [4.15, 95], [4.20, 100],
];
export function pctBateria(v: number): number {
  if (v <= CURVA_BATERIA[0][0]) return 0;
  for (let i = 1; i < CURVA_BATERIA.length; i++) {
    const [v1, p1] = CURVA_BATERIA[i];
    if (v <= v1) { const [v0, p0] = CURVA_BATERIA[i - 1]; return Math.round(p0 + ((v - v0) / (v1 - v0)) * (p1 - p0)); }
  }
  return 100;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Inteiro de 24 bits com sinal, little-endian.
const s24 = (b: Uint8Array, i: number) => { const v = b[i] | (b[i + 1] << 8) | (b[i + 2] << 16); return v & 0x800000 ? v - 0x1000000 : v; };

const CHAVE_INICIO = 'mh.celula.comandoInicio';
// Sem "C"/"CAL": em várias células isso inicia calibração.
const COMANDOS_INICIO = ['', 'S', 's', 'START', 'start', '1', 'R', 'r', 'G', 'A', '$S', '$START', 'ON', 'AT+START'];

const curto = (uuid: string) => (/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i.test(uuid) ? uuid.slice(4, 8) : uuid);

class CelulaBle {
  private device: any = null;
  private notifChars: any[] = [];
  private writeChar: any = null;
  private buffer = '';
  private ouvintes = new Set<Ouvinte>();
  private ouvintesLinha = new Set<OuvinteLinha>();
  private ouvintesStatus = new Set<OuvinteStatus>();
  campo: CampoValor = 'auto';
  ultimasLinhas: string[] = [];
  // O que a célula expõe e de onde chegam dados — aparece em "Ver dados recebidos".
  diagnostico: string[] = [];
  pacotes = 0;
  fblock = false;
  bateria: number | null = null;
  /** Carga estimada (0–100%) e voltagem da bateria, lidas ao conectar. */
  bateriaPct: number | null = null;
  bateriaVolts: number | null = null;
  /** Leituras por segundo no último segundo (saúde da conexão). */
  taxa = 0;
  private zeroBruto: number | null = null;
  private zeroProvisorio: number[] = [];
  private transmitindo = false;
  private nAmostra = 0;
  private t0 = 0;
  private ultimoDado = 0;
  private contagemTaxa = 0;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private reconectando = false;
  private desligadoPeloUsuario = false;
  private filaEscrita: Promise<unknown> = Promise.resolve();
  private wakeLock: any = null;

  get status(): StatusCelula {
    if (this.device?.gatt?.connected) return { conectado: true, nome: this.device.name || 'Célula' };
    return { conectado: false, reconectando: this.reconectando, nome: this.device?.name };
  }

  onLeitura(cb: Ouvinte) { this.ouvintes.add(cb); return () => { this.ouvintes.delete(cb); }; }
  onLinha(cb: OuvinteLinha) { this.ouvintesLinha.add(cb); return () => { this.ouvintesLinha.delete(cb); }; }
  onStatus(cb: OuvinteStatus) { this.ouvintesStatus.add(cb); return () => { this.ouvintesStatus.delete(cb); }; }
  private avisarStatus() { const s = this.status; this.ouvintesStatus.forEach((cb) => cb(s)); }

  async conectar(qualquerAparelho = false) {
    if (!bluetoothDisponivel()) {
      throw new Error('Este navegador não tem Bluetooth. Use o Chrome no Android ou no computador.');
    }
    const bt = (navigator as any).bluetooth;
    const device = await bt.requestDevice(
      qualquerAparelho
        ? { acceptAllDevices: true, optionalServices: SERVICOS_SERIAIS }
        : { filters: [{ namePrefix: '$FBLOCK' }, { namePrefix: 'FBLOCK' }, { namePrefix: 'F-BLOCK' }], optionalServices: SERVICOS_SERIAIS },
    );
    if (this.device && this.device !== device) this.desconectar();
    this.desligadoPeloUsuario = false;
    device.removeEventListener?.('gattserverdisconnected', this.aoCair);
    device.addEventListener('gattserverdisconnected', this.aoCair);
    this.device = device;
    await this.configurar();
  }

  // Liga GATT, escolhe os canais, assina as notificações e faz o "aperto de mão".
  // Usado na 1ª conexão e em cada reconexão automática.
  private async configurar() {
    const device = this.device;
    const server = await device.gatt.connect();
    const notifs: any[] = [];
    let write: any = null, nusWrite: any = null, nusNotif: any = null;
    const diag: string[] = [];
    const servicos: any[] = await server.getPrimaryServices().catch(() => []);
    for (const sv of servicos) {
      const chars: any[] = await sv.getCharacteristics().catch(() => []);
      diag.push(`Serviço ${curto(sv.uuid)}`);
      for (const c of chars) {
        const props = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => c.properties[k]).join(',');
        diag.push(`  • ${curto(c.uuid)} [${props}]`);
        if (/^6e400002/i.test(c.uuid)) nusWrite = c;
        if (/^6e400003/i.test(c.uuid)) nusNotif = c;
        if ((c.properties.notify || c.properties.indicate) && !IGNORAR_CHARS.includes(c.uuid)) notifs.push(c);
        if (!write && (c.properties.write || c.properties.writeWithoutResponse)) write = c;
      }
    }
    if (!servicos.length) diag.push('Nenhum serviço conhecido encontrado.');
    this.diagnostico = diag;
    if (!notifs.length) {
      device.gatt.disconnect();
      throw new Error('Conectei, mas a célula não expõe um canal de dados conhecido. Abra o app nRF Connect, conecte na célula e me mande um print dos serviços.');
    }
    this.fblock = /^\$?F-?BLOCK/i.test(device.name || '') && !!nusNotif;
    this.desligarNotificacao();
    // No Nordic UART os comandos vão SEMPRE no 6E400002 (antes podia cair num
    // canal gravável de outro serviço e a célula nunca recebia o "iniciar").
    this.notifChars = this.fblock ? [nusNotif] : notifs;
    this.writeChar = nusWrite || write;
    this.buffer = '';
    this.zeroBruto = null;
    this.zeroProvisorio = [];
    this.transmitindo = false;
    this.ultimoDado = performance.now();
    for (const c of this.notifChars) {
      c.addEventListener('characteristicvaluechanged', this.aoReceber);
      try { await c.startNotifications(); } catch (e: any) { diag.push(`  ! não consegui escutar ${curto(c.uuid)}: ${e?.message || e}`); }
    }
    this.reconectando = false;
    this.avisarStatus();
    void this.manterTelaLigada();
    this.ligarRelogio();
    if (this.fblock) {
      // Mesma sequência do FightTech: 0x20 → (bateria) → 0x40 zera → 0x30 inicia.
      // As escritas vão por fila; se a bateria ou o zero não vierem, o relógio
      // de vigilância zera e inicia mesmo assim.
      await espera(150);
      await this.enviarBytes([0x20]).catch(() => undefined);
      return;
    }
    let salvo: string | null = null;
    try { salvo = localStorage.getItem(CHAVE_INICIO); } catch { /* sem armazenamento */ }
    if (salvo != null && this.writeChar) {
      try { await this.enviar(salvo); } catch { /* célula recusou — o usuário pode tentar de novo pelo painel */ }
    }
  }

  // Vigilância a cada 0,5 s: inicia se o aperto de mão não completou, reenvia
  // "iniciar" se os dados pararam e reconecta se a célula ficou muda.
  private ligarRelogio() {
    if (this.relogio) clearInterval(this.relogio);
    let tique = 0, desdeConexao = 0;
    this.relogio = setInterval(() => {
      tique++; desdeConexao += 500;
      if (tique % 2 === 0) { this.taxa = this.contagemTaxa; this.contagemTaxa = 0; }
      if (!this.status.conectado || !this.fblock) return;
      const parado = performance.now() - this.ultimoDado;
      if (!this.transmitindo) {
        if (desdeConexao === 1500 && this.zeroBruto == null) void this.enviarBytes([0x40]).catch(() => undefined);
        if (desdeConexao >= 2500) void this.iniciarTransmissao();
        return;
      }
      if (parado > 1500 && tique % 3 === 0) {
        this.registrar('sem dados — reenviando iniciar');
        void this.enviarBytes([0x30]).catch(() => undefined);
      }
      if (parado > 5000) {
        this.registrar('célula muda — reconectando');
        this.ultimoDado = performance.now();
        try { this.device?.gatt?.disconnect(); } catch { /* força a reconexão */ }
      }
    }, 500);
  }

  // Conexão caiu: religa sozinho, com espera crescente (0,5 s até 8 s).
  private aoCair = async () => {
    this.transmitindo = false;
    if (this.desligadoPeloUsuario || !this.device) { this.avisarStatus(); return; }
    this.reconectando = true;
    this.avisarStatus();
    this.registrar('conexão caiu — religando');
    for (let i = 0; i < 12 && !this.desligadoPeloUsuario; i++) {
      await espera(Math.min(8000, 500 * 2 ** i));
      if (this.desligadoPeloUsuario || !this.device) break;
      try {
        await this.configurar();
        this.registrar('reconectada');
        return;
      } catch { /* tenta de novo */ }
    }
    this.reconectando = false;
    this.avisarStatus();
  };

  private ouvindoVisibilidade = false;
  private async manterTelaLigada() {
    // O wake lock é solto quando a tela some; pede de novo ao voltar.
    if (!this.ouvindoVisibilidade && typeof document !== 'undefined') {
      this.ouvindoVisibilidade = true;
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.status.conectado) void this.manterTelaLigada(); });
    }
    try {
      if (this.wakeLock || !(navigator as any).wakeLock) return;
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      this.wakeLock.addEventListener?.('release', () => { this.wakeLock = null; });
    } catch { /* sem wake lock: segue normal, só não impede a tela de apagar */ }
  }

  private async iniciarTransmissao() {
    if (this.transmitindo) return;
    this.transmitindo = true;
    this.nAmostra = 0;
    this.t0 = performance.now();
    this.ultimoDado = performance.now();
    await this.enviarBytes([0x30]).catch(() => { this.transmitindo = false; });
  }

  /** Zera na própria célula (FBLOCK). Devolve false se esta célula não suporta. */
  async zerarNaCelula(): Promise<boolean> {
    if (!this.fblock) return false;
    await this.enviarBytes([0x40]);
    return true;
  }

  // O Chrome recusa uma escrita GATT enquanto outra está em andamento
  // ("GATT operation already in progress"): tudo passa por uma fila, com até 3 tentativas.
  private escrever(dados: Uint8Array) {
    const tarefa = this.filaEscrita.then(async () => {
      if (!this.writeChar) throw new Error('A célula não aceita comandos.');
      let ultimoErro: unknown = null;
      for (let t = 0; t < 3; t++) {
        try {
          const op = this.writeChar.properties.writeWithoutResponse ? this.writeChar.writeValueWithoutResponse(dados) : this.writeChar.writeValue(dados);
          // Uma escrita que nunca responde não pode travar a fila (e com ela o "iniciar").
          await Promise.race([op, espera(1500).then(() => { throw new Error('escrita sem resposta'); })]);
          await espera(40);
          return;
        } catch (e) { ultimoErro = e; this.registrar(`comando ${Array.from(dados.slice(0, 1), (x) => x.toString(16)).join('')} falhou: ${(e as Error)?.message || e}`); await espera(120); }
      }
      throw ultimoErro;
    });
    this.filaEscrita = tarefa.catch(() => undefined);
    return tarefa;
  }

  async enviarBytes(b: number[]) {
    await this.escrever(new Uint8Array(b));
  }

  private registrar(texto: string) {
    this.ultimasLinhas = [...this.ultimasLinhas.slice(-29), texto];
    this.ouvintesLinha.forEach((cb) => cb(texto));
  }

  private receberFblock(b: Uint8Array) {
    const tipo = b[0];
    if (tipo === 0x10) {
      this.ultimoDado = performance.now();
      if (!this.transmitindo) { this.transmitindo = true; this.nAmostra = 0; this.t0 = performance.now(); }
      for (let i = 1; i + 2 < b.length; i += 3) {
        const bruto = s24(b, i);
        // Sem a resposta do zero, usa a média das primeiras leituras (0,1 s) e
        // pede o zero de novo — antes todas as leituras eram descartadas.
        if (this.zeroBruto == null) {
          this.zeroProvisorio.push(bruto);
          if (this.zeroProvisorio.length < 25) continue;
          this.zeroBruto = Math.round(this.zeroProvisorio.reduce((a, x) => a + x, 0) / this.zeroProvisorio.length);
          this.registrar(`zero provisório: ${this.zeroBruto}`);
          void this.enviarBytes([0x40]).catch(() => undefined);
        }
        const kg = ((bruto - this.zeroBruto) * 800) / 8388608;
        const tMs = this.t0 + this.nAmostra * 4; // 250 Hz
        this.nAmostra++;
        this.contagemTaxa++;
        this.ouvintes.forEach((cb) => cb({ valor: kg, tMs }));
      }
      // Registro esparso para o diagnóstico (são ~250 leituras/s).
      if (this.pacotes % 50 === 1) this.registrar(`dados: ${Math.floor((b.length - 1) / 3)} leituras/pacote · ${this.taxa}/s`);
      return;
    }
    if (tipo === 0x21) {
      // Mesmas faixas do FightTech (centésimos de volt): >3,90 V cheia … ≤3,40 V vazia.
      const mv = b.length >= 4 ? b[2] + b[3] * 256 : null;
      this.bateria = mv == null ? null : mv > 390 ? 3 : mv > 365 ? 2 : mv > 340 ? 1 : 0;
      this.bateriaVolts = mv == null ? null : mv / 100;
      this.bateriaPct = this.bateriaVolts == null ? null : pctBateria(this.bateriaVolts);
      this.registrar(`bateria: ${this.bateriaVolts?.toFixed(2) ?? '?'} V · ${this.bateriaPct ?? '?'}%`);
      this.avisarStatus();
      if (this.zeroBruto == null) void this.enviarBytes([0x40]).catch(() => undefined);
      return;
    }
    if (tipo === 0x40 && b.length >= 4) {
      this.zeroBruto = s24(b, 1);
      this.registrar(`zero: ${this.zeroBruto}`);
      if (!this.transmitindo) void this.iniciarTransmissao();
      this.avisarStatus();
      return;
    }
    this.registrar(`hex: ${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ')}`);
  }

  private aoReceber = (ev: any) => {
    const dv: DataView = ev.target.value;
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const agora = performance.now();
    this.pacotes++;
    if (this.fblock) { this.receberFblock(bytes); return; }
    this.ultimoDado = agora;
    // Pacote binário (não é texto): mostra em hexadecimal para descobrirmos o formato.
    const imprimivel = bytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127));
    if (!imprimivel) {
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
      this.ultimasLinhas = [...this.ultimasLinhas.slice(-29), `[${curto(ev.target.uuid)}] hex: ${hex}`];
      this.ouvintesLinha.forEach((cb) => cb(hex));
      return;
    }
    this.buffer += new TextDecoder().decode(bytes);
    const partes = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = partes.pop() ?? '';
    // Sem quebra de linha há muito tempo: trata o pacote como uma leitura.
    if (this.buffer.length > 64) { partes.push(this.buffer); this.buffer = ''; }
    for (const linha of partes) {
      const l = linha.trim();
      if (!l) continue;
      this.ultimasLinhas = [...this.ultimasLinhas.slice(-29), l];
      this.ouvintesLinha.forEach((cb) => cb(l));
      const v = valorDaLinha(l, this.campo);
      if (v != null) { this.contagemTaxa++; this.ouvintes.forEach((cb) => cb({ valor: v, tMs: agora })); }
    }
  };

  async enviar(texto: string, comQuebra = true) {
    const dados = new TextEncoder().encode(comQuebra && !texto.endsWith('\n') ? `${texto}\r\n` : texto);
    if (!dados.length) return;
    await this.escrever(dados);
  }

  /**
   * Várias células seriais só transmitem depois de um comando de início. Testa
   * os mais comuns (evitando calibração) e para no primeiro que fizer chegar
   * dados; o que funcionou é lembrado e enviado sozinho nas próximas conexões.
   */
  async tentarComandosInicio(progresso?: (cmd: string) => void): Promise<string | null> {
    for (const cmd of COMANDOS_INICIO) {
      if (!this.status.conectado) return null;
      progresso?.(cmd === '' ? '(Enter)' : cmd);
      const antes = this.pacotes;
      try { await this.enviar(cmd); } catch { /* comando recusado — tenta o próximo */ }
      await new Promise((r) => setTimeout(r, 900));
      if (this.pacotes > antes) {
        try { localStorage.setItem(CHAVE_INICIO, cmd); } catch { /* sem armazenamento — só não lembra */ }
        return cmd === '' ? '(Enter)' : cmd;
      }
    }
    return null;
  }

  private desligarNotificacao() {
    for (const c of this.notifChars) {
      try { c.removeEventListener('characteristicvaluechanged', this.aoReceber); } catch { /* já removido */ }
    }
  }

  desconectar() {
    this.desligadoPeloUsuario = true;
    this.reconectando = false;
    if (this.fblock && this.transmitindo) void this.enviarBytes([0x31]).catch(() => undefined);
    this.transmitindo = false;
    if (this.relogio) { clearInterval(this.relogio); this.relogio = null; }
    try { this.wakeLock?.release?.(); } catch { /* já liberado */ }
    this.wakeLock = null;
    this.desligarNotificacao();
    try { this.device?.removeEventListener?.('gattserverdisconnected', this.aoCair); } catch { /* sem ouvinte */ }
    try { this.device?.gatt?.disconnect(); } catch { /* já desconectado */ }
    this.device = null;
    this.notifChars = [];
    this.writeChar = null;
    this.avisarStatus();
  }
}

// Uma conexão para a sessão inteira: conecta uma vez e captura músculo após músculo.
export const celula = new CelulaBle();
