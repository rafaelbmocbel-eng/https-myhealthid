// Conexão com a célula de carga Bluetooth (BLE) — ex.: "$FBLOCK-0068".
// A célula fala "serial sobre BLE": manda texto, uma leitura por linha (CR+LF),
// como visto no Serial Bluetooth Terminal. Não sabemos de antemão qual serviço
// serial o fabricante usa, então procuramos os mais comuns e, na falta deles,
// qualquer característica com notificação.
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
  '0000180f-0000-1000-8000-00805f9b34fb', // bateria (só para listar)
];

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

class CelulaBle {
  private device: any = null;
  private notifChar: any = null;
  private writeChar: any = null;
  private buffer = '';
  private ouvintes = new Set<Ouvinte>();
  private ouvintesLinha = new Set<OuvinteLinha>();
  private ouvintesStatus = new Set<OuvinteStatus>();
  campo: CampoValor = 'auto';
  ultimasLinhas: string[] = [];

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

    let notif: any = null;
    let write: any = null;
    const servicos: any[] = await server.getPrimaryServices().catch(() => []);
    for (const sv of servicos) {
      const chars: any[] = await sv.getCharacteristics().catch(() => []);
      for (const c of chars) {
        if (!notif && (c.properties.notify || c.properties.indicate)) notif = c;
        if (!write && (c.properties.write || c.properties.writeWithoutResponse)) write = c;
      }
      if (notif) break;
    }
    if (!notif) {
      device.gatt.disconnect();
      throw new Error('Conectei, mas a célula não expõe um canal de dados conhecido. Me mande o nome do serviço (app nRF Connect).');
    }

    this.desligarNotificacao();
    this.device = device;
    this.notifChar = notif;
    this.writeChar = write;
    this.buffer = '';
    notif.addEventListener('characteristicvaluechanged', this.aoReceber);
    await notif.startNotifications();
    this.avisarStatus();
  }

  private aoReceber = (ev: any) => {
    const dv: DataView = ev.target.value;
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const agora = performance.now();
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

  async enviar(texto: string) {
    if (!this.writeChar) throw new Error('A célula não aceita comandos.');
    const dados = new TextEncoder().encode(texto.endsWith('\n') ? texto : `${texto}\r\n`);
    if (this.writeChar.properties.writeWithoutResponse) await this.writeChar.writeValueWithoutResponse(dados);
    else await this.writeChar.writeValue(dados);
  }

  private desligarNotificacao() {
    if (this.notifChar) {
      try { this.notifChar.removeEventListener('characteristicvaluechanged', this.aoReceber); } catch { /* já removido */ }
    }
  }

  desconectar() {
    this.desligarNotificacao();
    try { this.device?.gatt?.disconnect(); } catch { /* já desconectado */ }
    this.device = null;
    this.notifChar = null;
    this.writeChar = null;
    this.avisarStatus();
  }
}

// Uma conexão para a sessão inteira: conecta uma vez e captura músculo após músculo.
export const celula = new CelulaBle();
