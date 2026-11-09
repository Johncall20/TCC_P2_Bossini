# Critérios de aceitação

Pergunta: o celular consegue ler o ESP32-C3 do carro pelo Bluetooth, em tempo real, sem o computador com o backend?

Todos são conferidos **no aparelho físico** (emulador não tem Bluetooth), com a development build instalada e o ESP32 ligado no carro ou na bancada com a MS41. O computador com o backend fica **desligado** durante o teste.

- [ ] **Conecta sozinho.** Ao tocar em *Conectar* com o ESP32 ligado, em até 15 s a barra mostra *Conectado* com o id do módulo, e o RPM começa a mudar na tela sem nenhum outro toque.
- [ ] **O número é o do carro.** Em marcha lenta e depois a ~3000 rpm, o RPM do app acompanha o conta-giros do painel do carro (diferença de até ±100 rpm). Com o motor quente e parado, desconectando o celular e subindo o backend, a temperatura do motor no *Ao vivo* do telemetria-desktop fica a até ±2 °C da que o app mostrava.
- [ ] **O link é saudável.** Com o carro parado por 2 minutos, a taxa (Hz) fica estável e o contador de *descartadas* não passa de 1% das *leituras*.
- [ ] **Parâmetro sem resposta não engana.** Quando a central deixa de responder um campo (bit apagado em `valid`), o cartão dele mostra *sem resposta* em vez de repetir o número anterior.
- [ ] **Erro: módulo ausente.** Com o ESP32 desligado, a barra fica em *Procurando — módulo não apareceu, tentando de novo*, o app não trava nem fecha, e ao ligar o ESP32 ele conecta sozinho.
- [ ] **Erro: queda no meio.** Desligando o ESP32 com o app conectado, em até 3 s a linha *última leitura há X s* fica vermelha e os números apagam; ao religar, a barra volta a *Conectado* sem tocar em nada.
- [ ] **Erro: permissão negada (Android).** Negando *Dispositivos próximos* no primeiro *Conectar*, a barra mostra *Erro — permissão de "Dispositivos próximos" negada* e o app continua aberto.
- [ ] **Fechar e abrir.** Fechando o app e abrindo de novo, ele começa em *Desligado* e só procura o módulo depois de tocar em *Conectar*.

**Verificado em:** ( ) aparelho físico — modelo: ______ / Android ou iOS: ______ ( ) emulador
**Resultado:** ( ) passou ( ) reprovou

## Já verificado sem o aparelho (`npm test`)

Não substitui os critérios acima, mas tira do caminho os erros de lógica antes de ir para o carro:

- `ble/protocolo.test.ts`: 118 linhas geradas pelo `leitor.py` do backend (pedaços de 20 bytes, pedaços aleatórios, CRLF, lixo no meio, firmware antigo sem extras, conexão aberta no meio de uma linha) dão o mesmo resultado no app, campo a campo.
- `ble/LeitorEsp32.test.ts`: com um BleManager de mentira, a ordem *scan → connect → retrieveServices → startNotification*, a reconexão após queda, a nova procura quando o módulo não aparece, o prazo de 10 s do connect e o Bluetooth desligado.
