// Subconjunto do Web Bluetooth que o módulo EMG usa. O navegador (navigator.bluetooth), o plugin
// nativo (bleNativo.ts) e o simulador (simulador.ts) cumprem esta mesma forma, então o serviço
// do módulo (moduloEmg.ts) não sabe de qual deles está falando.

export interface PropriedadesBle {
  read?: boolean;
  write?: boolean;
  writeWithoutResponse?: boolean;
  notify?: boolean;
  indicate?: boolean;
}

export interface EventoValorBle {
  target: CaracteristicaBle;
}

export interface CaracteristicaBle {
  readonly uuid: string;
  readonly properties: PropriedadesBle;
  value?: DataView;
  addEventListener(tipo: 'characteristicvaluechanged', ouvinte: (ev: EventoValorBle) => void): void;
  removeEventListener(tipo: 'characteristicvaluechanged', ouvinte: (ev: EventoValorBle) => void): void;
  startNotifications(): Promise<unknown>;
  writeValue(dados: Uint8Array): Promise<void>;
  writeValueWithoutResponse(dados: Uint8Array): Promise<void>;
}

export interface ServicoBle {
  readonly uuid: string;
  getCharacteristics(): Promise<CaracteristicaBle[]>;
}

export interface ServidorGattBle {
  getPrimaryServices(): Promise<ServicoBle[]>;
}

export interface DispositivoBle {
  readonly name?: string;
  readonly gatt: {
    readonly connected: boolean;
    connect(): Promise<ServidorGattBle>;
    disconnect(): void;
  };
  addEventListener(tipo: 'gattserverdisconnected', ouvinte: (ev: unknown) => void): void;
  removeEventListener(tipo: 'gattserverdisconnected', ouvinte: (ev: unknown) => void): void;
}

export interface OpcoesRequestDevice {
  acceptAllDevices?: boolean;
  filters?: { namePrefix?: string; services?: string[] }[];
  optionalServices?: string[];
}

export interface TransporteBle {
  requestDevice(opcoes: OpcoesRequestDevice): Promise<DispositivoBle>;
}
