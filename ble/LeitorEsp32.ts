/*
  A ligacao com o ESP32-C3 pelo Bluetooth do celular.

  E o LeitorBLE do backend (servicos/leitor.py) passado para o celular, com
  os mesmos quatro estados e a mesma regra: procura pelo nome, assina a
  caracteristica TX do Nordic UART e reconecta para sempre - perder o carro
  de vista e o caso comum.

  Fica fora do React de proposito: a tela so recebe estado e amostra pelos
  ouvintes, e esta classe nao sabe que existe tela.

  Biblioteca: react-native-ble-manager (TurboModule; precisa de development
  build, nao roda no Expo Go). Ver PESQUISA.md para o porque.
*/
import type { EventSubscription } from 'react-native';
import BleManager, {
  BleState,
  type BleManagerDidUpdateValueForCharacteristicEvent,
  type Peripheral,
} from 'react-native-ble-manager';

import { pedirPermissoesBluetooth } from './permissoes';
import { MontadorDeLinha, NOME_PADRAO, NUS_TX, decodificar, type Amostra } from './protocolo';

/** Os mesmos estados do EstadoLeitor do backend. */
export type EstadoLeitor = 'DESLIGADO' | 'PROCURANDO' | 'CONECTADO' | 'ERRO';

export type Ouvintes = {
  /** `ativo`: o leitor continua tentando (ERRO com ativo volta a procurar sozinho). */
  aoMudarEstado: (estado: EstadoLeitor, detalhe: string, ativo: boolean) => void;
  aoLer: (amostra: Amostra) => void;
  /** Linha completa que nao era JSON do firmware. */
  aoDescartar: (linha: string) => void;
};

const SEGUNDOS_DE_VARREDURA = 8; // o timeout do BleakScanner no backend
const ESPERA_SEM_MODULO_MS = 3000; // backend: "modulo nao apareceu" -> 3 s
const ESPERA_APOS_ERRO_MS = 2000; // backend: erro -> 2 s
const ESPERA_APOS_QUEDA_MS = 1000;
// No iOS o connect nunca expira sozinho (doc do react-native-ble-manager).
const PRAZO_CONEXAO_MS = 10_000;

const mesmaUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function comPrazo<T>(promessa: Promise<T>, ms: number, mensagem: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(mensagem)), ms);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(timer));
}

function textoDoErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'object' && erro !== null && 'message' in erro) return String(erro.message);
  return String(erro);
}

const SEM_BLUETOOTH: Partial<Record<BleState, { frase: string; definitivo: boolean }>> = {
  [BleState.Off]: { frase: 'Bluetooth desligado: ligue para continuar', definitivo: false },
  [BleState.TurningOff]: { frase: 'Bluetooth desligando', definitivo: false },
  [BleState.Unauthorized]: { frase: 'sem permissão de Bluetooth (Ajustes do iOS)', definitivo: true },
  [BleState.Unsupported]: { frase: 'este aparelho não tem Bluetooth Low Energy', definitivo: true },
};

export class LeitorEsp32 {
  private estado: EstadoLeitor = 'DESLIGADO';
  private detalhe = '';
  private ativo = false;
  private ativoAvisado = false;
  private iniciado = false;
  private inscricoes: EventSubscription[] = [];
  /** Id do periferico: MAC no Android, UUID no iOS. */
  private alvo: string | null = null;
  private tx: { servico: string; caracteristica: string } | null = null;
  private achou = false;
  private montador = new MontadorDeLinha();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly ouvintes: Ouvintes,
    private readonly nome: string = NOME_PADRAO,
  ) {}

  /** Comeca a procurar e fica tentando ate `desligar()`. */
  async ligar(): Promise<void> {
    if (this.ativo) return;
    this.ativo = true;
    try {
      if (!(await pedirPermissoesBluetooth())) {
        this.parar('permissão de "Dispositivos próximos" negada');
        return;
      }
      if (!this.iniciado) {
        await BleManager.start({ showAlert: false });
        this.iniciado = true;
      }
      if (this.inscricoes.length === 0) this.inscrever();
    } catch (erro) {
      this.parar(`não foi possível iniciar o Bluetooth: ${textoDoErro(erro)}`);
      return;
    }
    await this.procurar();
  }

  /** Para de procurar e solta o modulo. */
  async desligar(): Promise<void> {
    this.ativo = false;
    this.cancelarEspera();
    await BleManager.stopScan().catch(() => undefined);
    await this.soltarAlvo();
    this.definir('DESLIGADO', '');
  }

  /** Para tudo e tira os ouvintes nativos. Para o desmontar da tela. */
  destruir(): void {
    void this.desligar();
    this.inscricoes.forEach((i) => i.remove());
    this.inscricoes = [];
  }

  private inscrever(): void {
    this.inscricoes = [
      BleManager.onDiscoverPeripheral((p) => this.aoDescobrir(p)),
      BleManager.onStopScan(() => this.aoTerminarVarredura()),
      BleManager.onDisconnectPeripheral((ev) => this.aoCair(ev.peripheral)),
      BleManager.onDidUpdateValueForCharacteristic((ev) => this.aoNotificar(ev)),
    ];
  }

  private async procurar(): Promise<void> {
    if (!this.ativo) return;
    this.achou = false;
    this.definir('PROCURANDO', `procurando "${this.nome}"`);

    const bluetooth = await this.estadoDoBluetooth();
    if (bluetooth !== BleState.On) {
      const motivo = SEM_BLUETOOTH[bluetooth] ?? { frase: `Bluetooth: ${bluetooth}`, definitivo: false };
      if (motivo.definitivo) this.parar(motivo.frase);
      else this.falhar(motivo.frase);
      return;
    }

    try {
      // Sem filtro de servico: o backend tambem so filtra pelo nome, e nao
      // ha garantia de que o firmware anuncie o UUID do servico.
      await BleManager.scan({ seconds: SEGUNDOS_DE_VARREDURA });
    } catch (erro) {
      this.falhar(`a varredura falhou: ${textoDoErro(erro)}`);
    }
  }

  /** O estado do adaptador, esperando o "unknown" do inicio passar (iOS). */
  private async estadoDoBluetooth(): Promise<BleState> {
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const estado = await BleManager.checkState();
      if (![BleState.Unknown, BleState.Resetting, BleState.TurningOn].includes(estado)) return estado;
      await new Promise((ok) => setTimeout(ok, 300));
    }
    return BleState.Unknown;
  }

  private aoDescobrir(p: Peripheral): void {
    if (!this.ativo || this.achou) return;
    const anunciado = p.advertising?.localName || p.name || '';
    // Mesmo criterio do backend: o nome contem o procurado, sem caixa.
    if (!anunciado.toLowerCase().includes(this.nome.toLowerCase())) return;
    this.achou = true;
    void BleManager.stopScan().catch(() => undefined);
    void this.conectarEm(p.id);
  }

  private aoTerminarVarredura(): void {
    // O stopScan() de quando o modulo aparece tambem cai aqui.
    if (!this.ativo || this.achou) return;
    this.definir('PROCURANDO', 'módulo não apareceu, tentando de novo');
    this.esperar(ESPERA_SEM_MODULO_MS, () => this.procurar());
  }

  private async conectarEm(id: string): Promise<void> {
    try {
      this.definir('PROCURANDO', `conectando em ${id}`);
      // Alvo antes do connect: se o prazo vencer, o falhar() abaixo cancela
      // a conexao pendente em vez de deixa-la abrir depois, sem dono.
      this.alvo = id;
      await comPrazo(BleManager.connect(id), PRAZO_CONEXAO_MS, 'o módulo não aceitou a conexão');
      if (!this.ativo) {
        await this.soltarAlvo();
        return;
      }
      const info = await BleManager.retrieveServices(id);
      const tx = info.characteristics?.find((c) => mesmaUuid(c.characteristic, NUS_TX));
      if (!tx) throw new Error('o módulo não tem a característica TX do Nordic UART');

      this.tx = { servico: tx.service, caracteristica: tx.characteristic };
      this.montador = new MontadorDeLinha();
      await BleManager.startNotification(id, tx.service, tx.characteristic);
      this.definir('CONECTADO', id);
    } catch (erro) {
      this.falhar(textoDoErro(erro));
    }
  }

  private aoNotificar(ev: BleManagerDidUpdateValueForCharacteristicEvent): void {
    if (ev.peripheral !== this.alvo || !this.tx || !mesmaUuid(ev.characteristic, this.tx.caracteristica)) return;
    for (const linha of this.montador.alimentar(ev.value)) {
      const amostra = decodificar(linha);
      if (amostra) this.ouvintes.aoLer(amostra);
      else this.ouvintes.aoDescartar(linha);
    }
  }

  private aoCair(id: string): void {
    if (id !== this.alvo) return;
    this.alvo = null;
    this.tx = null;
    if (!this.ativo) return;
    this.definir('PROCURANDO', 'a conexão caiu, procurando de novo');
    this.esperar(ESPERA_APOS_QUEDA_MS, () => this.procurar());
  }

  /** Erro que vale tentar de novo: ERRO agora, nova procura em 2 s. */
  private falhar(frase: string): void {
    void this.soltarAlvo();
    // Desligado no meio da tentativa: o DESLIGADO fica, nao vira ERRO.
    if (!this.ativo) return;
    this.definir('ERRO', frase);
    this.esperar(ESPERA_APOS_ERRO_MS, () => this.procurar());
  }

  /** Erro que tentar de novo nao resolve: fica em ERRO e para. */
  private parar(frase: string): void {
    this.ativo = false;
    this.definir('ERRO', frase);
  }

  private async soltarAlvo(): Promise<void> {
    const alvo = this.alvo;
    this.alvo = null;
    this.tx = null;
    if (alvo) await BleManager.disconnect(alvo).catch(() => undefined);
  }

  private esperar(ms: number, depois: () => void): void {
    this.cancelarEspera();
    this.timer = setTimeout(() => {
      this.timer = null;
      depois();
    }, ms);
  }

  private cancelarEspera(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Avisa so quando muda: a procura repete o mesmo estado a cada volta. */
  private definir(estado: EstadoLeitor, detalhe: string): void {
    if (estado === this.estado && detalhe === this.detalhe && this.ativo === this.ativoAvisado) return;
    this.estado = estado;
    this.detalhe = detalhe;
    this.ativoAvisado = this.ativo;
    this.ouvintes.aoMudarEstado(estado, detalhe, this.ativo);
  }
}
