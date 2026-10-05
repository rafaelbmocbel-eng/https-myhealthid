// Bluetooth da célula de carga dentro do app nativo (iPhone e Android, via Capacitor).
//
// O Safari e o WebView do iPhone não têm Web Bluetooth. No app nativo usamos o plugin
// @capacitor-community/bluetooth-le e este arquivo o "veste" com a mesma cara do Web Bluetooth
// (requestDevice, GATT, serviços, características e notificações), para que a lógica da célula
// em celulaBle.ts seja a mesma nos dois caminhos.

import { Capacitor } from '@capacitor/core';
import { BleClient, type BleCharacteristic, type BleDevice, type BleService } from '@capacitor-community/bluetooth-le';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const rodandoNoAppNativo = () => {
  try { return Capacitor.isNativePlatform(); }
  catch { return false; }
};

const BASE = '-0000-1000-8000-00805f9b34fb';

/** UUID em minúsculas e sempre com 128 bits (o iPhone devolve os de 16 bits abreviados). */
export function uuid128(uuid: string): string {
  const u = String(uuid).toLowerCase();
  if (/^[0-9a-f]{4}$/.test(u)) return `0000${u}${BASE}`;
  if (/^[0-9a-f]{8}$/.test(u)) return `${u}${BASE}`;
  return u;
}

type Ouvinte = (ev: any) => void;

class CaracteristicaNativa {
  readonly uuid: string;
  readonly properties: { read: boolean; write: boolean; writeWithoutResponse: boolean; notify: boolean; indicate: boolean };
  value: DataView | undefined;
  private ouvintes = new Set<Ouvinte>();
  private assinada = false;

  constructor(private deviceId: string, private servico: string, private c: BleCharacteristic) {
    this.uuid = uuid128(c.uuid);
    this.properties = {
      read: !!c.properties.read, write: !!c.properties.write, writeWithoutResponse: !!c.properties.writeWithoutResponse,
      notify: !!c.properties.notify, indicate: !!c.properties.indicate,
    };
  }

  addEventListener(tipo: string, fn: Ouvinte) { if (tipo === 'characteristicvaluechanged') this.ouvintes.add(fn); }
  removeEventListener(tipo: string, fn: Ouvinte) { if (tipo === 'characteristicvaluechanged') this.ouvintes.delete(fn); }

  async startNotifications() {
    if (this.assinada) return this;
    await BleClient.startNotifications(this.deviceId, this.servico, this.c.uuid, (v: DataView) => {
      this.value = v;
      const ev = { target: this };
      this.ouvintes.forEach((fn) => fn(ev));
    });
    this.assinada = true;
    return this;
  }

  async writeValue(d: Uint8Array) { await BleClient.write(this.deviceId, this.servico, this.c.uuid, new DataView(d.buffer, d.byteOffset, d.byteLength)); }
  async writeValueWithoutResponse(d: Uint8Array) { await BleClient.writeWithoutResponse(this.deviceId, this.servico, this.c.uuid, new DataView(d.buffer, d.byteOffset, d.byteLength)); }
}

class ServicoNativo {
  readonly uuid: string;
  constructor(private deviceId: string, private s: BleService) { this.uuid = uuid128(s.uuid); }
  async getCharacteristics() { return this.s.characteristics.map((c) => new CaracteristicaNativa(this.deviceId, this.s.uuid, c)); }
}

class DispositivoNativo {
  name: string | undefined;
  private ouvintes = new Set<Ouvinte>();
  private estaConectado = false;
  readonly gatt: { connected: boolean; connect: () => Promise<any>; disconnect: () => void };

  constructor(private d: BleDevice) {
    this.name = d.name;
    const gatt = {
      connect: async () => {
        await BleClient.connect(this.d.deviceId, () => { this.estaConectado = false; this.ouvintes.forEach((fn) => fn({ target: this })); });
        this.estaConectado = true;
        return {
          getPrimaryServices: async () => (await BleClient.getServices(this.d.deviceId)).map((s) => new ServicoNativo(this.d.deviceId, s)),
        };
      },
      disconnect: () => { this.estaConectado = false; void BleClient.disconnect(this.d.deviceId).catch(() => undefined); },
    } as { connected: boolean; connect: () => Promise<any>; disconnect: () => void };
    Object.defineProperty(gatt, 'connected', { get: () => this.estaConectado });
    this.gatt = gatt;
  }

  addEventListener(tipo: string, fn: Ouvinte) { if (tipo === 'gattserverdisconnected') this.ouvintes.add(fn); }
  removeEventListener(tipo: string, fn: Ouvinte) { if (tipo === 'gattserverdisconnected') this.ouvintes.delete(fn); }
}

let iniciado = false;

/** Mesma assinatura usada de `navigator.bluetooth`, para o celulaBle.ts. */
export const bluetoothNativo = {
  async requestDevice(opts: { acceptAllDevices?: boolean; filters?: { namePrefix?: string }[]; optionalServices?: string[] }) {
    if (!iniciado) { await BleClient.initialize({ androidNeverForLocation: true }); iniciado = true; }
    const prefixos = (opts.filters ?? []).map((f) => f.namePrefix).filter((p): p is string => !!p);
    const base = { optionalServices: opts.optionalServices };
    // O plugin aceita um prefixo por busca: tenta cada um, na ordem, até a lista abrir com algum aparelho.
    if (opts.acceptAllDevices || !prefixos.length) return new DispositivoNativo(await BleClient.requestDevice(base));
    let ultimoErro: unknown = null;
    for (const namePrefix of prefixos) {
      try { return new DispositivoNativo(await BleClient.requestDevice({ ...base, namePrefix })); }
      catch (e) { ultimoErro = e; if (/cancel/i.test(String((e as Error)?.message ?? e))) throw e; }
    }
    throw ultimoErro;
  },
};
