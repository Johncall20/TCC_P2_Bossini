This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Convenções deste projeto

- Não altere arquivos fora do escopo pedido. Explique cada alteração.
- Componentes ficam em `components/`, um arquivo por componente. A ligação Bluetooth fica em `ble/`.
- Estado nunca é modificado no lugar: sempre gere um novo valor.
- Valores que podem ser calculados a partir do estado não viram estado.
- Antes de usar um pacote, confirme na documentação se ele funciona no Expo Go. Este projeto já NÃO roda no Expo Go (usa `react-native-ble-manager`); teste numa development build.
- Rode `npm test`, `npx tsc --noEmit` e `npx expo lint` antes de dar uma tarefa por terminada.

## Contexto desta prova de conceito

- TCC: telemetria de baixo custo para BMW E36 — um ESP32-C3 lê a ECU Siemens MS41 pelo protocolo DS2 e transmite por Bluetooth Low Energy; hoje quem recebe é o backend Python (telemetria-desktop) num computador.
- Problema: dentro do carro não queremos depender do computador; o celular deve ler o ESP32 direto.
- Tecnologia investigada: `react-native-ble-manager` (TurboModule) numa development build do Expo.
- Protocolo: o ESP32 anuncia o nome `E36-DS2` e notifica pela característica TX do Nordic UART (`6e400003-b5a3-f393-e0a9-e50e24dcca9e`) linhas JSON terminadas em `\n`, cortadas em pedaços de 20 bytes. Campos: `t`, `rpm`, `ect`, `iat`, `vbat`, `tps`, `vanos`, `vss`, extras da MS41 e o bitmask `valid`. A referência é `backend/telemetria/servicos/leitor.py` do repositório do TCC; `ble/protocolo.ts` tem de continuar igual a ele (o teste com `ble/__fixtures__/vetores.json` confere).
- Uma tela só, em `App.tsx`: o usuário toca em Conectar e vê RPM, temperaturas, bateria e os extras ao vivo, com o estado da ligação.
- Não usar Expo Router (ignore a seção "Navigation & Routing" acima para este projeto): a navegação não é o que esta prova de conceito investiga.
- Fora de escopo: login, envio dos dados ao backend, gravação de sessão, design final e tudo que não demonstre a pergunta.
