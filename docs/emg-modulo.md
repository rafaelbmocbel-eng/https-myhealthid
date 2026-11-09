# Eletromiografia (EMG) com o módulo "RunE W2"

Aplicação do **profissional** (plano pago, módulo `aplicacoes`), no mesmo lugar da dinamometria:
**Aplicações › Eletromiografia** (`/eletromiografia`, com o paciente opcional por `?paciente=<id>`).

> É uma **medida de apoio**. A tela mostra e guarda o sinal; **quem interpreta é o profissional**. Nada
> aqui diagnostica. Este módulo não mexe no fluxo do portal do cliente (`docs/fluxo-cliente-e-tiers.md`).

O protocolo Bluetooth do módulo está em `docs/emg-protocolo-runew2.md`. Este arquivo cobre a tela, o
que foi guardado, o que ainda **não foi confirmado com o aparelho real** e como conferir.

## Como usar (passo a passo curto)

1. Abra **Aplicações › Eletromiografia**. Se for medir para um paciente, escolha-o no alto da página
   (é ele que recebe o exame no prontuário; sem paciente você mede e baixa o CSV, mas não salva).
2. **Conectar módulo** e escolha o "RunE W2" na lista do Bluetooth. Funciona no Chrome (Android e
   computador) e no app nativo. No iPhone, o Safari e o Chrome não têm Bluetooth: use o app nativo ou o
   Bluefy (`docs/bluetooth-iphone.md`). Sem aparelho, **Modo demonstração (sem aparelho)** mostra a
   tela funcionando com um sinal simulado.
3. Quando aparecer **Lendo o sinal**, com taxa e bateria, o gráfico ao vivo já anda e o RMS dos últimos
   250 ms aparece em µV (e em % da CVM, depois que houver CVM).
4. Escreva o **músculo medido** (texto livre; há sugestões) e o **lado**. Coloque os eletrodos com a pele
   limpa e seca, conforme a recomendação SENIAM para o músculo.
5. **Protocolo guiado** (cada etapa tem contagem regressiva de 3 s antes de gravar):
   1. **Repouso**, 5 s com o músculo relaxado: dá o ruído basal e a linha de base para achar contrações.
   2. **CVM**, 3 tentativas de 5 s (a tela sugere 30 s de descanso entre elas): a CVM é o maior RMS em
      janela de 1 s entre as tentativas. É a referência para comparar o paciente com ele mesmo.
   3. **Tarefa livre**: toque em **Iniciar tarefa**, faça o movimento e toque em **Parar tarefa**.
   Cada etapa pode ser refeita (**Refazer**). Se a conexão cair no meio de uma etapa, ela é descartada
   com aviso e o módulo religa sozinho.
6. Veja o **Resultado**: CVM, ruído basal, nº de contrações, pico e RMS médio em % da CVM, a lista das
   contrações, o gráfico do envelope e os avisos do registro.
7. **Salvar no prontuário** (precisa de paciente). O interruptor **Mostrar ao cliente** vem **desligado**.
   **Baixar CSV do sinal** funciona sempre que houver uma etapa gravada. O arquivo é para o Excel em
   português: colunas separadas por `;`, vírgula como decimal, cabeçalho `etapa;tempo_s;sinal_uV`.
8. Para medir **outro músculo ou o outro lado**, toque em **Nova medida**: ela descarta as etapas
   gravadas (com uma confirmação) e limpa as observações. Com etapas gravadas, músculo e lado ficam
   travados, para o exame não receber o sinal de um lado com o rótulo do outro.

### O que vai para o prontuário

Uma linha em `exames_presenciais`, igual à da dinamometria: `tipo = 'eletromiografia'`, `data_exame` =
hoje no calendário **local**, `visivel_paciente = false` (salvo se você ligar o interruptor), `resumo` =
uma frase descritiva e `dados`:

| Campo de `dados` | Conteúdo |
|---|---|
| `resultado` | texto descritivo do laudo (`laudoTexto`), com a ressalva de que a interpretação é do profissional |
| `observacoes` | o que você escreveu (ou ausente) |
| `analise` | `DadosExameEmg` versão **1**: taxa, canal, parâmetros da análise, resumo e, por etapa, só o **envelope RMS de 50 ms a 20 Hz** |
| `versao_laudo` | `1` (suba em `Eletromiografia.tsx` quando mudar o texto do laudo ou o formato de `dados`) |

O **sinal bruto não é salvo** (pesado e dado biométrico bruto). Quem quiser o sinal baixa o CSV.

Regras da tela:
- **Demonstração não vai para o prontuário.** O sinal é simulado; o botão de salvar fica desligado com o
  motivo. Trocar da demonstração para o módulo real descarta as etapas simuladas.
- Depois de salvar, o botão vira "Salvo no prontuário". Mudar o paciente, o músculo, o lado ou as
  observações (ou gravar outra etapa) libera um novo salvamento.
- No registro do paciente, o tipo "Eletromiografia" existe em `src/lib/examesPresenciais.ts` (com a nota
  "Pede interpretação por um profissional"), então o exame salvo aparece na lista.

## O que está confirmado e o que NÃO está

**Confirmado** (por cálculo, sem o aparelho; ver a seção 6 de `docs/emg-protocolo-runew2.md`):
- Checksum dos comandos: os 5 exemplos do protocolo batem com o XOR de `LEN` até o último byte de dado.
- Tamanho do comando de iniciar: `DATA` = modo (1) + carimbo (8) = 9, então `LEN = 0x0C`.
- Filtro passa-alta de 20 Hz (6ª ordem): os coeficientes de 500 Hz e de 1000 Hz coincidem com
  `scipy.signal.butter(6, 20, 'highpass', fs=fs)`; por isso o filtro é projetado por código.
- Offset de data `1661961600000` = 2022-08-31 16:00 UTC (meia-noite de 1/9/2022 na China).

**Pontos ainda NÃO confirmados** (dependem dos fontes `ble_emg_device.dart` / `runew2_cmd.dart` ou de uma captura real):
1. **Byte antes do `5A`.** As fórmulas de contagem (`n = (LEN-13)/2` no bruto e `n = (LEN-9)/2` no RMS) só são coerentes com um byte extra (provável checksum) se a divisão for inteira e `LEN` for par. Se o app original divide com `~/`, imitar a divisão inteira funciona nos dois casos.
2. **Amostras por quadro no bruto:** o documento diz que a 1ª amostra é o `float32` e depois vêm `n` deltas, isto é, `n + 1` amostras por quadro. Confirmar se o app emite a 1ª amostra.
3. **Unidade:** "µV provável" (divisor 3,1457). Sem confirmação do fabricante; para laudo usar medidas relativas (% da contração máxima).
4. **Carimbo de tempo do quadro bruto:** descrito só para o RMS (instante do último ponto).
5. **Tipo de hardware (`0x1D`)**: o app não pede; na dúvida enviar o modo `0x03` direto (item 5.2).
6. **Rede elétrica:** o comb de 50 Hz do fabricante não serve no Brasil; usar notch em 60/120/180 Hz (nosso filtro é projetado por código).

Até alguém testar com o aparelho, esses pontos são **suposições** (tabela abaixo). Os valores em µV são
"prováveis"; o laudo e a tela dizem isso e orientam comparar em **% da CVM**. A **taxa de amostragem**
vem do módulo; se ele não responder em 4 s, a tela **assume 500 Hz** e mostra o aviso **"Taxa assumida"**
(uma resposta que chegue depois corrige).

### O que a tela faz com cada dúvida (e como mudar sem publicar versão)

| Dúvida | O que a tela supõe | Como conferir ou mudar |
|---|---|---|
| 1. Byte antes do `5A` | o decodificador aceita com ou sem o byte extra | contadores "Quadros inválidos" e "Bytes descartados" em "Ver dados recebidos" |
| 2. 1ª amostra do quadro | emite a amostra-base (`n + 1` amostras) | **Ajustes para o teste › Quadro bruto traz a amostra-base** (desligue e conecte de novo) |
| 3. Unidade | µV; o laudo diz que µV absoluto depende de eletrodo, pele e posição | comparar em **% da CVM** do próprio paciente |
| 4. Carimbo do quadro | só diagnóstico: conta "lacunas suspeitas", **nunca** altera o sinal | contador "Lacunas suspeitas" e as linhas do diagnóstico |
| 5. Tipo `0x1D` | manda o modo `0x03` direto; se o módulo responder que é EEG, recusa | linha "Tipo do módulo (0x1D)" no diagnóstico |
| 6. Rede elétrica | 60 Hz (Brasil) | **Ajustes para o teste › Rede elétrica** (50 Hz); vale na próxima conexão |

Os ajustes ficam em "Ver dados recebidos" (recolhido por padrão), travam com o módulo conectado e voltam
ao padrão ao recarregar a página. O diagnóstico copiado diz quais ajustes a conexão usou.

## Como diagnosticar com "Ver dados recebidos"

Abra **Ver dados recebidos** (no fim da página, recolhido por padrão). Ele mostra, atualizando a cada segundo:

- **Quadros recebidos**: quadros com moldura válida (`A5 … 5A`). Tem de subir sem parar enquanto lê.
- **Quadros inválidos**: moldura válida, mas o conteúdo foi recusado pelo decodificador.
- **Bytes descartados**: lixo entre quadros jogado fora ao ressincronizar.
- **Lacunas suspeitas**: salto do carimbo maior que o esperado entre quadros brutos (provável perda de quadros).
- **Taxa** lida (ou assumida), **taxa medida** (amostras por segundo de relógio) e nº de lotes.
- Os **últimos 20 quadros em hexadecimal**, do mais antigo ao mais novo.
- As **linhas de diagnóstico do serviço** (serviços achados, falhas de escrita, taxa assumida, reconexões…).

Sinais de que uma suposição falhou:

| O que aparece | O que provavelmente é |
|---|---|
| "Quadros inválidos" ou "Bytes descartados" subindo | moldura ou conteúdo diferentes da especificação (pontos 1 e 5) |
| "o carimbo do quadro bruto não avançou", ou lacunas sem perda real | o carimbo do quadro bruto tem outro significado (ponto 4) |
| um pequeno salto ou repetição a cada quadro no sinal | a 1ª amostra do quadro talvez não seja emitida pelo aparelho (ponto 2): desligue a amostra-base |
| "Taxa assumida" | o módulo não respondeu à leitura da taxa; confira a "taxa medida" |
| "taxa medida" bem diferente da "taxa" | a taxa lida ou assumida está errada (o tempo do gráfico e das etapas ficaria errado) |
| sinal bruto sempre na casa de milhares, ou valores sem sentido em µV | a unidade ou o divisor (ponto 3); use % da CVM |
| ruído alto com pico em 60 Hz, selo "Sinal ruim" | rede elétrica, eletrodo mal colado ou cabo; confira o posicionamento antes de duvidar do protocolo |
| "Este módulo é de EEG…" | foi ligado um módulo de ondas cerebrais, não de EMG |

O botão **Copiar** monta o texto abaixo; se o navegador não deixar copiar, o texto aparece numa caixa
para você selecionar e copiar à mão.

## O que mandar ao desenvolvedor

Se algo não bater com o aparelho real, mande **o texto do botão Copiar** (de "Ver dados recebidos") logo
depois de ler o sinal por uns 20 segundos, **de preferência duas vezes**: uma com o músculo relaxado e
outra com ele contraído. O texto já leva: modo (módulo real ou demonstração), aparelho e navegador,
estado, nome do módulo, taxa (lida ou assumida) e taxa medida, bateria, tipo e versões do módulo, os
contadores, estatísticas do sinal filtrado e do bruto dos últimos 2 s, os **ajustes de teste** em uso,
os parâmetros da análise, os **últimos 20 quadros em hexadecimal** e as linhas de diagnóstico do serviço.

Conte também, em uma frase: o modelo do módulo (a etiqueta), o aparelho (celular ou computador), se foi
no navegador ou no app e **o que você esperava ver**. Se puder, anexe o CSV baixado de uma etapa de
repouso e de uma CVM.

## Onde está o código

| Parte | Arquivo |
|---|---|
| Página, salvamento, CSV | `src/pages/Eletromiografia.tsx` |
| Componentes da tela | `src/components/emg/*` (cartão de conexão, gráficos, protocolo, resultado, salvar, dados recebidos, ajustes) |
| Controle da sessão (sinal recente, etapas pelas amostras, vigia de sinal) | `src/components/emg/controlador.ts` |
| Como a tela obtém o módulo (real, demonstração, ajustes) | `src/components/emg/fabrica.ts`, `demonstracao.ts` |
| Serviço Bluetooth, buffer, sessão, simulador | `src/lib/emg/moduloEmg.ts`, `bufferCircular.ts`, `sessao.ts`, `simulador.ts` |
| Protocolo, filtros e métricas | `src/lib/emg/protocolo.ts`, `filtros.ts`, `metricas.ts` |
| Tipo de exame no prontuário | `src/lib/examesPresenciais.ts` |
| Card no hub e rota | `src/pages/Aplicacoes.tsx`, `src/App.tsx` |
| Testes | `src/test/eletromiografiaPagina.test.tsx`, `emgComponentes.test.tsx`, `emgControlador.test.ts`, `emgDesenho.test.ts` (e os do serviço: `emgModuloEmg`, `emgSessao`, `emgSimulador`, `emgBufferCircular`) |

Decisões de projeto que valem saber:
- O filtro passa-alta de 20 Hz e o notch de rede rodam **continuamente** no serviço (`ModuloEmg`), desde
  o início da aquisição: não reiniciam a cada etapa. O serviço entrega à tela as amostras já filtradas, e
  é só essas que o gravador de sessão usa.
- O tempo de cada etapa é contado pelas **amostras recebidas**, não pelo relógio: a etapa tem exatamente
  a duração em sinal e, se o módulo parar de mandar dados por mais de 2,5 s, a etapa é cancelada.
- O gráfico ao vivo é um canvas desenhado em `requestAnimationFrame` direto do buffer circular
  (decimação mínimo/máximo por coluna de pixel). Chegar amostra **não** renderiza o React. Respeita
  "reduzir movimento" (atualiza 2 vezes por segundo) e o tema escuro.
- A página cria o módulo ao conectar e o solta ao desmontar (desconecta, manda parar o aparelho, cancela
  o desenho e os relógios).
