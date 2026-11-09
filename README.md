# poc-tcc — o celular lê o ESP32 do E36 por Bluetooth

Prova de conceito da disciplina de Desenvolvimento de Aplicativos Híbridos. Pergunta, alternativas e fontes em [PESQUISA.md](PESQUISA.md); critérios em [CRITERIOS.md](CRITERIOS.md).

> **Não roda no Expo Go.** O `react-native-ble-manager` tem código nativo, então o app precisa de uma *development build* instalada num aparelho físico (emulador não tem Bluetooth).

## Rodar

```bash
npm install
npm test                 # 25 testes: decodificador igual ao backend + máquina de estados
```

Gerar e instalar a development build (escolha um):

```bash
# Na nuvem, sem Android Studio (precisa de conta Expo):
npx eas-cli@latest build --platform android --profile development
# instale o .apk pelo link/QR Code que o EAS mostra no fim

# Ou localmente, com Android Studio e o celular no USB (depuração ativada):
npx expo run:android --device
```

Depois, com o app instalado, suba o servidor de desenvolvimento e abra o projeto pelo app:

```bash
npx expo start --dev-client
```

No iOS é o mesmo caminho (`eas build --platform ios --profile development` ou `npx expo run:ios --device` num Mac com Xcode).

## Onde está cada coisa

| Arquivo | O que faz |
|---|---|
| `App.tsx` | A tela: estado da ligação, RPM grande e os cartões dos parâmetros |
| `ble/protocolo.ts` | Remonta as linhas JSON dos pedaços de 20 bytes e decodifica a amostra — mesma regra do `leitor.py` do backend |
| `ble/LeitorEsp32.ts` | Procura `E36-DS2`, conecta, assina a TX do Nordic UART e reconecta sozinho |
| `ble/permissoes.ts` | Pede "Dispositivos próximos" no Android 12+ (ou localização no 11 e anteriores) |
| `ferramentas/gerar_vetores.py` | Gera os vetores de teste passando bytes pelo decodificador do backend |
