# Protocolo BLE — sensor EMG "RunE W2"

Extraído do `app-debug.apk` (app Flutter "runebeat"). Fontes originais em `runebeat/blue/`:
`ble_emg_device.dart` (driver), `runew2_cmd.dart` (comandos), `emg_filter.dart` + `iir_filter.dart` (filtros).

## 1. Descoberta e conexão

| Item | Valor |
|---|---|
| Nome anunciado | `RunE W2 <n>` (regex `^RunE W2 \d`; o dígito é o nº do sensor, permite vários) |
| Filtro de scan | service `0000fff0-0000-1000-8000-00805f9b34fb` |
| Service | `0000fff0-…` |
| Write (sem resposta) | `0000fff3-0000-1000-8000-00805f9b34fb` → `writeCharacteristicWithoutResponse` |
| Notify | `0000fff4-0000-1000-8000-00805f9b34fb` |
| MTU | pedir 247 |

Sequência que o app faz ao conectar:
1. Assinar notify `fff4`
2. `requestMtu(247)`
3. +1000 ms → pedir bateria
4. +1500 ms → pedir taxa de amostragem
5. +2000 ms → desligar filtro do hardware (`setFilterSwitch(false)`) — o filtro é feito no app

## 2. Comando (app → sensor)

```
AA | LEN | RW | ADDR | DATA... | XOR | BB
```
- `LEN` = len(DATA) + 3
- `RW` = `0x80` escrita, `0x81` leitura
- `XOR` = XOR de todos os bytes de `LEN` até o último byte de `DATA`
- Timestamps: 8 bytes, **big-endian**, ms epoch

| ADDR | Nome | Exemplo de comando completo |
|---|---|---|
| 0x01 | Versão de hardware (texto) | `AA 03 81 01 83 BB` |
| 0x02 | Versão de software (texto) | `AA 03 81 02 80 BB` |
| 0x03 | Nº do dispositivo (W: `'0'+n`) | |
| 0x04 | MAC (W: 6 bytes) | |
| 0x06 | Taxa de amostragem | `AA 03 81 06 84 BB` |
| 0x07 | Histórico RMS (R: ts[8] + len[2] BE) | |
| 0x09 | MOS de carga/isolação (W: 0/1) | |
| 0x0B | Bateria | `AA 03 81 0B 89 BB` |
| 0x0C | LED (W: 0/1) | |
| 0x0D | Sensor Hall | |
| 0x0F | Filtro HW (W: 0/1) | desligar: `AA 04 80 0F 00 8B BB` |
| 0x11 | **Iniciar/parar aquisição** (W: modo + ts[8]) | ver abaixo |
| 0x12 | Sleep | |
| 0x13 | Reset (W: 0x01) | |
| 0x14 | Desligar | |
| 0x17 | ID do chip analógico | |
| 0x18 | Modo teste de produção | |
| 0x19 | Registradores LH001 (W: pares addr,val) | |
| 0x1D | Tipo de hardware (resposta) | |

**0x11 — modo** (1º byte de DATA):
- `0x00` parar
- `0x01` RMS (1 valor a cada 50 ms, calculado no sensor)
- `0x02` EMG bruto float32 (antigo/comentado)
- `0x03` EMG bruto comprimido (EMG-Module / EMG-Pro)
- `0x04` EEG bruto comprimido (EEG-Module / EEG-Pro)

Ex.: iniciar EMG bruto → `AA 0C 80 11 03 <ts 8 bytes BE> XOR BB`

## 3. Resposta / dados (sensor → app)

```
A5 | LEN | ADDR | LEN^ADDR | PAYLOAD... | ?? | 5A        (tamanho total = LEN + 3)
```
Notificações podem chegar fragmentadas/juntas: acumular num buffer e procurar `A5`, validar
`buf[3] == buf[1]^buf[2]` e `buf[LEN+2] == 0x5A`; senão descartar 1 byte e tentar de novo.
Qualquer frame com `ADDR` X serve como ACK do comando X (o app espera até 1,5 s).

Índices abaixo são do frame inteiro (`f[0] = A5`).

| ADDR | Parsing |
|---|---|
| 0x01 / 0x02 | `utf8(f[4 .. LEN+1))` (exclui os 2 últimos bytes) |
| 0x06 | `f[4]`: 0 → 500 Hz, 1 → 1000 Hz |
| 0x0B | bateria % = `f[10]` |
| 0x17 | `f[4]`: 125 = LH001-91, 126 = LH001-99 |
| 0x1D | `f[4]`: 0 EMG-Module, 1 EEG-Module, 2 EMG-Pro, 3 EEG-Pro |
| 0x07 | histórico RMS: ts48 = `f[4..10)` BE + `1661961600000`; n = (LEN-8)/2 valores uint16 BE a partir de `f[10]` |
| 0x11 | dados, conforme `f[4]` ↓ |

**0x11 / modo 0x01 — RMS**
- ts48 = `f[5..11)` BE (ms) + `1661961600000` (offset de 2022-09-01) = epoch ms do **último** ponto
- n = (LEN − 9) / 2; valor i = `f[11+2i]*256 + f[12+2i]` (uint16 BE); intervalo 50 ms
- Perda de pacotes detectada pelo salto de timestamp → pede `0x07` para preencher

**0x11 / modo 0x03 — EMG bruto** (0x04 = EEG, igual com divisor 12.5786)
```
v = float32 LE em f[11..15)            -> 1ª amostra
n = (LEN - 13) / 2
para i em 0..n-1:
    d = int16 LE em f[15 + 2i]
    v += d / 3.1457                     -> próxima amostra
```
Unidade provável: µV. Taxa: 500 ou 1000 Hz (resposta do 0x06).

## 4. Filtro aplicado no app (EMG)

Em cascata, por amostra (IIR forma direta I, `y = (Σ b·x − Σ a[1:]·y) / a0`):

**500 Hz**
- Passa-alta 20 Hz, 6ª ordem
  - b = `[0.614371537726035, -3.68622922635621, 9.21557306589052, -12.2874307545207, 9.21557306589052, -3.68622922635621, 0.614371537726035]`
  - a = `[1, -5.02943835142161, 10.6070421837797, -11.9993158162167, 7.67547454820020, -2.63105512847395, 0.377452386374089]`
- Comb notch 50 Hz: b = `0.925417400953572·(1 − z⁻¹⁰)`, a = `1 − 0.850834801907143·z⁻¹⁰`

**1000 Hz**
- Passa-alta 20 Hz: b = `[0.784297852893036, -4.70578711735822, 11.7644677933955, -15.6859570578607, 11.7644677933955, -4.70578711735822, 0.784297852893036]`,
  a = `[1, -5.51453512116617, 12.6891130565151, -15.5936352107041, 10.7932966704854, -3.98935940423088, 0.615123122052628]`
- Comb notch 50 Hz: mesmos coeficientes com atraso z⁻²⁰

> No Brasil a rede é **60 Hz**: o comb de 50 Hz não remove o ruído daqui. Para 60 Hz: atraso N = fs/60
> (500 Hz → 8,33, não inteiro; usar notch IIR biquad em 60/120/180 Hz).

## 5. Problemas encontrados no código original

1. `startRms()` faz `hwVersion as bool` com `hwVersion` String → **crash** em runtime; o modo RMS do app original não funciona. Correto: `enableRmsDataCmd(true, ts)`.
2. Não existe comando para pedir o `0x1D` (tipo de hardware); se o sensor não enviar sozinho, `hwVersion` fica `""` e `startEmg()` envia modo `0x00` (= parar). Verificar com o aparelho real; na dúvida, enviar `0x03` direto.
3. `if (emgRaw != [])` é sempre verdadeiro em Dart (compara referência) — inofensivo, mas dispara eventos vazios.
4. Byte antes do `5A` nas respostas não é validado (provável checksum).

## 6. Conferência independente (feita ao receber este documento)

Feita sem acesso ao aparelho e **sem os fontes `.dart`** (só o índice deles chegou). Conferido por cálculo:

- **Checksum dos comandos:** os 5 exemplos de comando de leitura/escrita do item 2 batem com `XOR(LEN, RW, ADDR, DATA…)`.
- **Tamanho do comando de iniciar:** `DATA = modo(1) + ts(8) = 9` → `LEN = 12 = 0x0C` (o resumo anterior dizia `0x0D`; está errado, este documento está certo).
- **Filtro passa-alta 20 Hz, 6ª ordem:** os coeficientes de 500 Hz e de 1000 Hz coincidem com `scipy.signal.butter(6, 20, 'highpass', fs=fs)` (erro máximo ≈ 4e-14). Podemos projetar o filtro por código para qualquer taxa.
- **Offset de data** `1661961600000` = 2022-08-31 16:00 UTC (meia-noite de 1/9/2022 no horário da China).

**Pontos ainda NÃO confirmados** (dependem dos fontes `ble_emg_device.dart` / `runew2_cmd.dart` ou de uma captura real):

1. **Byte antes do `5A`.** As fórmulas de contagem (`n = (LEN-13)/2` no bruto e `n = (LEN-9)/2` no RMS) só são coerentes com um byte extra (provável checksum) se a divisão for inteira e `LEN` for par. Se o app original divide com `~/`, imitar a divisão inteira funciona nos dois casos.
2. **Amostras por quadro no bruto:** o documento diz que a 1ª amostra é o `float32` e depois vêm `n` deltas — isto é, `n + 1` amostras por quadro. Confirmar se o app emite a 1ª amostra.
3. **Unidade:** "µV provável" (divisor 3,1457). Sem confirmação do fabricante; para laudo usar medidas relativas (% da contração máxima).
4. **Carimbo de tempo do quadro bruto:** descrito só para o RMS (instante do último ponto).
5. **Tipo de hardware (`0x1D`)**: o app não pede; na dúvida enviar o modo `0x03` direto (item 5.2).
6. **Rede elétrica:** o comb de 50 Hz do fabricante não serve no Brasil; usar notch em 60/120/180 Hz (nosso filtro é projetado por código).
