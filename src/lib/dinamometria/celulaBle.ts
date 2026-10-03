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

export type StatusCelula = { conectado: false } | { conectado: true; nome: string };

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
  private zeroBruto: number | null = null;
  private transmitindo = false;
  private nAmostra = 0;
  private t0 = 0;

  get status(): StatusCelula {
    return this.device?.gatt?.connected ? { conectado: true, nome: this.device.name || 'Célula' } : { conectado: false };
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
    device.addEventListener('gattserverdisconnected', () => this.avisarStatus());
    const server = await device.gatt.connect();

    // Escuta TODOS os canais com notificação (não sabemos qual é o da força) e
    // registra o mapa de serviços para diagnóstico.
    const notifs: any[] = [];
    let write: any = null;
    const diag: string[] = [];
    const servicos: any[] = await server.getPrimaryServices().catch(() => []);
    for (const sv of servicos) {
      const chars: any[] = await sv.getCharacteristics().catch(() => []);
      diag.push(`Serviço ${curto(sv.uuid)}`);
      for (const c of chars) {
        const props = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => c.properties[k]).join(',');
        diag.push(`  • ${curto(c.uuid)} [${props}]`);
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

    this.desligarNotificacao();
    this.device = device;
    this.notifChars = notifs;
    this.writeChar = write;
    this.buffer = '';
    this.pacotes = 0;
    for (const c of notifs) {
      c.addEventListener('characteristicvaluechanged', this.aoReceber);
      try { await c.startNotifications(); } catch (e: any) { diag.push(`  ! não consegui escutar ${curto(c.uuid)}: ${e?.message || e}`); }
    }
    this.fblock = /^\$?F-?BLOCK/i.test(device.name || '') && notifs.some((c) => /^6e400003/i.test(c.uuid));
    this.zeroBruto = null;
    this.transmitindo = false;
    this.bateria = null;
    this.avisarStatus();
    if (this.fblock) {
      // Mesma sequência do FightTech: 0x20 → (bateria) → 0x40 zera → 0x30 inicia.
      await espera(100);
      await this.enviarBytes([0x20]).catch(() => undefined);
      // Se a bateria não chegar, zera e inicia mesmo assim.
      setTimeout(() => { if (this.zeroBruto == null && this.status.conectado) void this.enviarBytes([0x40]).catch(() => undefined); }, 1200);
      setTimeout(() => { if (!this.transmitindo && this.status.conectado) void this.iniciarTransmissao(); }, 2500);
      return;
    }
    let salvo: string | null = null;
    try { salvo = localStorage.getItem(CHAVE_INICIO); } catch { /* sem armazenamento */ }
    if (salvo != null && write) {
      try { await this.enviar(salvo); } catch { /* célula recusou — o usuário pode tentar de novo pelo painel */ }
    }
  }

  private async iniciarTransmissao() {
    this.transmitindo = true;
    this.nAmostra = 0;
    this.t0 = performance.now();
    await this.enviarBytes([0x30]).catch(() => { this.transmitindo = false; });
  }

  /** Zera na própria célula (FBLOCK). Devolve false se esta célula não suporta. */
  async zerarNaCelula(): Promise<boolean> {
    if (!this.fblock) return false;
    await this.enviarBytes([0x40]);
    return true;
  }

  async enviarBytes(b: number[]) {
    if (!this.writeChar) throw new Error('A célula não aceita comandos.');
    const dados = new Uint8Array(b);
    if (this.writeChar.properties.writeWithoutResponse) await this.writeChar.writeValueWithoutResponse(dados);
    else await this.writeChar.writeValue(dados);
  }

  private registrar(texto: string) {
    this.ultimasLinhas = [...this.ultimasLinhas.slice(-29), texto];
    this.ouvintesLinha.forEach((cb) => cb(texto));
  }

  private receberFblock(b: Uint8Array) {
    const tipo = b[0];
    if (tipo === 0x10) {
      if (this.zeroBruto == null) return;
      for (let i = 1; i + 2 < b.length; i += 3) {
        const kg = ((s24(b, i) - this.zeroBruto) * 800) / 8388608;
        const tMs = this.t0 + this.nAmostra * 4; // 250 Hz
        this.nAmostra++;
        this.ouvintes.forEach((cb) => cb({ valor: kg, tMs }));
      }
      // Registro esparso para o diagnóstico (são ~250 leituras/s).
      if (this.pacotes % 25 === 1) this.registrar(`dados: ${Math.floor((b.length - 1) / 3)} leituras/pacote`);
      return;
    }
    if (tipo === 0x21) {
      // Mesmas faixas do FightTech (centésimos de volt): >3,90 V cheia … ≤3,40 V vazia.
      const mv = b.length >= 4 ? b[2] + b[3] * 256 : null;
      this.bateria = mv == null ? null : mv > 390 ? 3 : mv > 365 ? 2 : mv > 340 ? 1 : 0;
      this.registrar(`bateria: ${mv ?? '?'} (${this.bateria ?? '?'}/3)`);
      void this.enviarBytes([0x40]).catch(() => undefined);
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
      if (v != null) this.ouvintes.forEach((cb) => cb({ valor: v, tMs: agora }));
    }
  };

  async enviar(texto: string, comQuebra = true) {
    if (!this.writeChar) throw new Error('A célula não aceita comandos.');
    const dados = new TextEncoder().encode(comQuebra && !texto.endsWith('\n') ? `${texto}\r\n` : texto);
    if (!dados.length) return;
    if (this.writeChar.properties.writeWithoutResponse) await this.writeChar.writeValueWithoutResponse(dados);
    else await this.writeChar.writeValue(dados);
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
    if (this.fblock && this.transmitindo) void this.enviarBytes([0x31]).catch(() => undefined);
    this.transmitindo = false;
    this.desligarNotificacao();
    try { this.device?.gatt?.disconnect(); } catch { /* já desconectado */ }
    this.device = null;
    this.notifChars = [];
    this.writeChar = null;
    this.avisarStatus();
  }
}

// Uma conexão para a sessão inteira: conecta uma vez e captura músculo após músculo.
export const celula = new CelulaBle();
