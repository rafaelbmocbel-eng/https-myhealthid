# Bluetooth da célula no iPhone

## Por que não funciona no navegador
O Safari do iPhone (e o Chrome do iPhone, que usa o motor do Safari) não tem Web Bluetooth. A página abre, mas o navegador não deixa falar com a célula `$FBLOCK`. Isso é uma limitação da Apple, não do app.

## Duas saídas
1. **Agora, sem instalar nada do nosso lado:** abrir `myhealthid.com.br` no app **Bluefy** (grátis na App Store), um navegador que libera o Web Bluetooth. A célula conecta pelo mesmo caminho do Chrome do Android.
2. **App nativo (recomendado para o dia a dia):** o app Capacitor passa a usar o plugin `@capacitor-community/bluetooth-le`. O código da célula (`src/lib/dinamometria/celulaBle.ts`) escolhe sozinho: Web Bluetooth no Chrome, plugin nativo dentro do app (`src/lib/dinamometria/bleNativo.ts`).

## O que precisa ser feito uma vez no app nativo
O app carrega o site ao vivo (`server.url` em `capacitor.config.ts`), então o código novo chega sozinho. O que muda é a parte nativa, que precisa de um novo build:

```bash
npm install
npx cap add ios        # só se a pasta ios/ ainda não existir
npx cap sync ios
```

Em `ios/App/App/Info.plist`, dentro de `<dict>`, acrescente (sem isso o app fecha ao usar Bluetooth):

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>O My Health ID usa o Bluetooth para conectar à célula de carga nos testes de força.</string>
```

Depois gere o build no Xcode (Product › Archive) e envie ao TestFlight/App Store.

**Android (se também for reconstruir):** `npx cap sync android`. O plugin já declara as permissões de Bluetooth; para Android 12 ou mais novo, a busca usa `androidNeverForLocation`.

## Como conferir
1. Instale o build no iPhone e abra Dinamometria › Início.
2. Toque em **Parear célula**: o iOS pede permissão de Bluetooth e mostra a lista com `$FBLOCK-xxxx`.
3. Se conectar mas não chegar leitura, abra "Ver dados recebidos" e veja o diagnóstico (serviços e canais). A célula FBLOCK usa o Nordic UART (`6E400002` para comandos e `6E400003` para dados).

## Observações
- O plugin aceita um prefixo de nome por busca. O app tenta `$FBLOCK`, `FBLOCK` e `F-BLOCK`, nessa ordem.
- Não foi possível testar em iPhone real nem no Xcode durante o desenvolvimento: a lógica foi coberta por testes com o plugin simulado (`src/test/bleNativo.test.ts`).
