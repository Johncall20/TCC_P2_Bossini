# Diário de pesquisa

## Contexto do TCC
Sistema de telemetria de baixo custo para o BMW E36: um ESP32-C3 lê a ECU Siemens MS41 pelo protocolo DS2 e transmite as leituras por Bluetooth Low Energy para o backend Python (telemetria-desktop), que grava sessões e mostra o painel ao vivo. Hoje, para ver os números dentro do carro, é preciso levar um computador rodando o backend.

## Pergunta de pesquisa
Como o `react-native-ble-manager`, numa development build do Expo, mostra no celular, em tempo real, a telemetria que o ESP32-C3 lê da MS41, sem o computador com o backend dentro do carro e com o link BLE caindo e voltando?

## Alternativas consideradas
| Opção | Serve para | Roda no Expo Go? | Decisão |
|---|---|---|---|
| `react-native-ble-plx` 3.5.1 | BLE central (scan, conexão, notificações); é a sugestão do blog da Expo e a primeira resposta da IA | Não ("cannot be used in the Expo Go app") | **Não.** Tabela de compatibilidade do README para em RN 0.74 / Expo 51 ("Tested against Expo SDK 49"); o `package.json` não tem `codegenConfig`, ou seja, não é TurboModule; o PR #1331 ("V4 turbomodule rewrite", rascunho) diz que a v3 não tinha caminho para a nova arquitetura. O projeto está no Expo SDK 58 / React Native 0.88. |
| `@sfourdrinier/react-native-ble-plx` 3.9.3 (fork) | Mesma API do ble-plx, atualizada para RN ≥ 0.86 e Expo 57+ | Não | **Não.** Funcionaria com o SDK 58, mas é o fork de uma pessoa, criado porque o original está "effectively unmaintained"; para o TCC, risco de ficar sem manutenção de novo. |
| `react-native-ble-manager` 13.0.0 | BLE central; TurboModule ("RN 0.76+ only the new architecture is supported"), com config plugin do Expo desde a 12.1 | Não; a doc indica development build | **Sim.** É a única das três que declara suporte à nova arquitetura no pacote oficial e está em manutenção (13.0.0 saiu em 05/11/2026). Risco anotado: o app de exemplo da biblioteca usa Expo 54 / RN 0.81, não o SDK 58. |
| Manter o computador e fazer o app consumir o `/ws` do backend | Mostrar no celular o que o backend já recebe (trilha Consumo de API) | Sim | **Não para esta pergunta.** Roda no Expo Go, mas continua exigindo o computador no carro, que é justamente o que queremos tirar. |

## Fontes oficiais lidas
Acesso em 09/11/2026.
- Expo — Introduction to development builds: https://docs.expo.dev/develop/development-builds/introduction/ (Expo Go só tem os módulos nativos dele; `npx expo install expo-dev-client`; `npx expo run:android` ou `eas build --profile development`).
- Expo — How to upgrade to SDK 58: https://expo.dev/blog/how-to-upgrade-to-sdk-58 (SDK 58 usa React Native 0.88).
- Expo — How to build a Bluetooth Low Energy powered Expo app: https://expo.dev/blog/how-to-build-a-bluetooth-low-energy-powered-expo-app (blog, não documentação: usa ble-plx e confirma que BLE não roda no Expo Go).
- Expo — Using Model Context Protocol (MCP) with Expo: https://docs.expo.dev/eas/ai/mcp/
- react-native-ble-manager — documentação: https://innoveit.github.io/react-native-ble-manager/ (páginas Install e Expo, e o README do pacote 13.0.0).
- react-native-ble-plx — README do pacote 3.5.1: https://github.com/dotintent/react-native-ble-plx e PR #1331: https://github.com/dotintent/react-native-ble-plx/pull/1331
- Notas do fork: https://cdn.jsdelivr.net/npm/@sfourdrinier/react-native-ble-plx@3.9.2/docs/FORK.md
- Android Developers — Bluetooth permissions: https://developer.android.com/develop/connectivity/bluetooth/bt-permissions (`BLUETOOTH_SCAN` e `BLUETOOTH_CONNECT` são permissões de tempo de execução no Android 12+; `neverForLocation` dispensa a localização).
- Código do próprio TCC — `telemetria-desktop/backend/telemetria/servicos/leitor.py` (nome `E36-DS2`, característica TX `6e400003-…`, linhas JSON em pedaços de 20 bytes) e `modelos/enums.py` (bits do `valid`).

Observação sobre a página do MCP: a versão em Markdown (`/eas/ai/mcp.md`, que é a que agentes costumam ler) dizia "An EAS paid plan is required" e citava o SDK 55; a página HTML atual diz que basta uma conta Expo e que só a ferramenta `search_documentation` exige plano pago. A apostila diz "apenas uma conta Expo gratuita" — vale para as outras ferramentas, não para a busca na documentação.

## Onde a IA errou
- Pedido: qual biblioteca usar para ler BLE num app Expo.
- O que veio: a IA (Claude) foi direto para `react-native-ble-plx` com o config plugin — a primeira busca que ela fez foi "react-native-ble-plx Expo config plugin", a mesma escolha do blog da Expo.
- Como percebi: abrindo o pacote no npm e o README — compatibilidade testada só até Expo 51, sem `codegenConfig`, e o PR de reescrita para TurboModule ainda em rascunho, enquanto o projeto está no SDK 58 / RN 0.88.
- O certo: `react-native-ble-manager` ≥ 12, que é TurboModule e documenta uso no Expo por development build.

- Pedido: escrever os testes do decodificador com Jest.
- O que veio: testes usando `describe`/`test`/`expect` globais, contando que o `@types/jest` instalado seria carregado sozinho.
- Como percebi: `npx tsc --noEmit` falhou com "Cannot find name 'describe'".
- O certo: no TypeScript 6 (o do modelo do Expo SDK 58), `types` passou a ser `[]` por padrão e os `@types/*` não entram mais sozinhos; os testes importam de `@jest/globals`.

- Pedido: conectar ao ESP32 com prazo de 10 s (no iOS o `connect` nunca expira, segundo a doc da biblioteca).
- O que veio: o código guardava o id do módulo só *depois* de o `connect` responder.
- Como percebi: lendo o diff antes de aceitar — se o prazo vencesse, a conexão pendente ficaria sem dono e poderia abrir depois sem ninguém para fechá-la.
- O certo: guardar o id antes do `connect`, para o tratamento de erro cancelar a conexão pendente (`disconnect`). Há um teste para isso em `ble/LeitorEsp32.test.ts`.

- [Registre aqui os erros do Copilot quando rodar os prompts de verificação e de implementação da apostila.]

## Resultado e próximos passos no TCC
- O que já está demonstrado sem o aparelho: o app decodifica o fluxo do ESP32 exatamente como o backend (118 linhas geradas pelo `leitor.py`, incluindo pedaços de 20 bytes, lixo e CRLF) e a máquina de estados reconecta sozinha (25 testes em `npm test`).
- O que falta demonstrar no aparelho: os critérios do `CRITERIOS.md` com o ESP32 de verdade. [preencher depois do teste]
- Achado no backend durante a pesquisa: no `leitor.py`, o `decodificar` só trata `JSONDecodeError`. Uma linha com campo não numérico (`"rpm":"abc"`) ou extra nulo (`"load":null`) levanta `ValueError`/`TypeError`, cai no `except` do laço do `LeitorBLE` e derruba a conexão BLE. O app descarta só a linha.
- O que muda no TCC: se os critérios passarem, o celular pode ser a central dentro do carro, e o computador fica para a análise das sessões depois. Próximo passo natural: o celular guardar as amostras e enviá-las ao backend quando houver rede.
- A conferir no firmware: se o ESP32 aceita mais de uma central ao mesmo tempo (celular e backend juntos) ou só uma.
