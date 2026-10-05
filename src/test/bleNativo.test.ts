import { beforeEach, describe, expect, it, vi } from 'vitest';

const ble = vi.hoisted(() => ({
  initialize: vi.fn(async () => undefined),
  requestDevice: vi.fn(async (o?: { namePrefix?: string }) => ({ deviceId: 'ABC-123', name: `${o?.namePrefix ?? ''}-0068` })),
  connect: vi.fn(async (_id: string, _onDisconnect?: (id: string) => void) => undefined),
  disconnect: vi.fn(async () => undefined),
  getServices: vi.fn(async () => [
    { uuid: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E', characteristics: [
      { uuid: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E', properties: { write: true, writeWithoutResponse: true, read: false, notify: false, indicate: false }, descriptors: [] },
      { uuid: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E', properties: { notify: true, write: false, writeWithoutResponse: false, read: false, indicate: false }, descriptors: [] },
    ] },
    { uuid: '180F', characteristics: [{ uuid: '2A19', properties: { read: true, notify: true, write: false, writeWithoutResponse: false, indicate: false }, descriptors: [] }] },
  ]),
  startNotifications: vi.fn(async (_d: string, _s: string, _c: string, cb: (v: DataView) => void) => { ble.callback = cb; }),
  write: vi.fn(async () => undefined),
  writeWithoutResponse: vi.fn(async () => undefined),
  callback: null as null | ((v: DataView) => void),
}));
vi.mock('@capacitor-community/bluetooth-le', () => ({ BleClient: ble }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));

import { bluetoothNativo, rodandoNoAppNativo, uuid128 } from '../lib/dinamometria/bleNativo';

describe('Bluetooth nativo (iPhone e Android)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('detecta o app nativo e normaliza os UUIDs', () => {
    expect(rodandoNoAppNativo()).toBe(true);
    expect(uuid128('180F')).toBe('0000180f-0000-1000-8000-00805f9b34fb');
    expect(uuid128('6E400003-B5A3-F393-E0A9-E50E24DCCA9E')).toBe('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
  });

  it('expõe serviços e características com a mesma forma do Web Bluetooth', async () => {
    const dev: any = await bluetoothNativo.requestDevice({ filters: [{ namePrefix: '$FBLOCK' }], optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] });
    expect(ble.initialize).toHaveBeenCalledWith({ androidNeverForLocation: true });
    expect(dev.name).toBe('$FBLOCK-0068');
    expect(dev.gatt.connected).toBe(false);
    const server = await dev.gatt.connect();
    expect(dev.gatt.connected).toBe(true);
    const servicos = await server.getPrimaryServices();
    expect(servicos.map((s: any) => s.uuid)).toEqual(['6e400001-b5a3-f393-e0a9-e50e24dcca9e', '0000180f-0000-1000-8000-00805f9b34fb']);
    const chars = await servicos[0].getCharacteristics();
    expect(chars.map((c: any) => c.uuid)).toEqual(['6e400002-b5a3-f393-e0a9-e50e24dcca9e', '6e400003-b5a3-f393-e0a9-e50e24dcca9e']);
    expect(chars[0].properties.writeWithoutResponse).toBe(true);
    expect(chars[1].properties.notify).toBe(true);
  });

  it('entrega as notificações como evento com target.value e envia comandos', async () => {
    const dev: any = await bluetoothNativo.requestDevice({ filters: [{ namePrefix: '$FBLOCK' }] });
    const server = await dev.gatt.connect();
    const [nus] = await server.getPrimaryServices();
    const [escrita, notif] = await nus.getCharacteristics();
    const recebidos: number[][] = [];
    notif.addEventListener('characteristicvaluechanged', (ev: any) => { recebidos.push(Array.from(new Uint8Array(ev.target.value.buffer))); });
    await notif.startNotifications();
    ble.callback!(new DataView(new Uint8Array([0x10, 1, 2, 3]).buffer));
    expect(recebidos).toEqual([[0x10, 1, 2, 3]]);
    await escrita.writeValueWithoutResponse(new Uint8Array([0x30]));
    expect(ble.writeWithoutResponse).toHaveBeenCalledTimes(1);
    expect((ble.writeWithoutResponse.mock.calls[0] as unknown[])[2]).toBe('6E400002-B5A3-F393-E0A9-E50E24DCCA9E');
  });

  it('avisa quando a conexão cai', async () => {
    const dev: any = await bluetoothNativo.requestDevice({ acceptAllDevices: true });
    const caiu = vi.fn();
    dev.addEventListener('gattserverdisconnected', caiu);
    await dev.gatt.connect();
    const onDisconnect = ble.connect.mock.calls[0][1] as (id: string) => void;
    onDisconnect('ABC-123');
    expect(caiu).toHaveBeenCalledTimes(1);
    expect(dev.gatt.connected).toBe(false);
  });

  it('tenta o próximo prefixo de nome quando o primeiro não acha aparelho', async () => {
    ble.requestDevice.mockRejectedValueOnce(new Error('No device found'));
    const dev: any = await bluetoothNativo.requestDevice({ filters: [{ namePrefix: '$FBLOCK' }, { namePrefix: 'FBLOCK' }] });
    expect(ble.requestDevice).toHaveBeenCalledTimes(2);
    expect(dev.name).toBe('FBLOCK-0068');
  });
});
