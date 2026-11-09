/*
  A maquina de estados do LeitorEsp32 com um BleManager de mentira: prova
  a ordem das chamadas e a reconexao sem celular nem ESP32. O que so o
  aparelho prova (radio, permissao, MTU) esta no CRITERIOS.md.
*/
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import BleManager from 'react-native-ble-manager';

import { LeitorEsp32, type EstadoLeitor } from './LeitorEsp32';
import type { Amostra } from './protocolo';

jest.mock('react-native-ble-manager', () => {
  const ouvintes: Record<string, ((dado: unknown) => void)[]> = {};
  const on = (nome: string) => (cb: (dado: unknown) => void) => {
    (ouvintes[nome] ??= []).push(cb);
    return { remove: () => (ouvintes[nome] = ouvintes[nome].filter((x) => x !== cb)) };
  };
  const emitir = (nome: string, dado: unknown) => ouvintes[nome]?.forEach((cb) => cb(dado));
  const fake = {
    __emitir: emitir,
    __limpar: () => Object.keys(ouvintes).forEach((k) => delete ouvintes[k]),
    start: jest.fn(async () => undefined),
    checkState: jest.fn(async () => 'on'),
    scan: jest.fn(async () => undefined),
    stopScan: jest.fn(async () => emitir('stopScan', {})),
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    // UUID em maiusculas, como o iOS costuma devolver.
    retrieveServices: jest.fn(async (id: string) => ({
      id,
      characteristics: [
        { service: '1800', characteristic: '2A00', properties: {} },
        {
          service: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
          characteristic: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E',
          properties: { Notify: 'Notify' },
        },
      ],
    })),
    startNotification: jest.fn(async () => undefined),
    onDiscoverPeripheral: on('discover'),
    onStopScan: on('stopScan'),
    onDisconnectPeripheral: on('disconnect'),
    onDidUpdateValueForCharacteristic: on('valor'),
  };
  return {
    __esModule: true,
    default: fake,
    BleState: {
      Unknown: 'unknown',
      Resetting: 'resetting',
      Unsupported: 'unsupported',
      Unauthorized: 'unauthorized',
      On: 'on',
      Off: 'off',
      TurningOn: 'turning_on',
      TurningOff: 'turning_off',
    },
  };
});

type Fake = typeof BleManager & { __emitir: (nome: string, dado: unknown) => void; __limpar: () => void };
const ble = BleManager as unknown as Fake;
const mock = (nome: string) => (ble as unknown as Record<string, jest.Mock<(...a: unknown[]) => Promise<unknown>>>)[nome];

const ID = 'AA:BB:CC:DD:EE:FF';
const SERVICO = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const TX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

function pedacos(texto: string, tamanho = 20): number[][] {
  const bytes = Array.from(texto, (c) => c.charCodeAt(0));
  const saida: number[][] = [];
  for (let i = 0; i < bytes.length; i += tamanho) saida.push(bytes.slice(i, i + tamanho));
  return saida;
}

function montar() {
  const estados: [EstadoLeitor, string, boolean][] = [];
  const amostras: Amostra[] = [];
  const descartes: string[] = [];
  const leitor = new LeitorEsp32({
    aoMudarEstado: (e, d, a) => estados.push([e, d, a]),
    aoLer: (a) => amostras.push(a),
    aoDescartar: (l) => descartes.push(l),
  });
  const ultimo = () => estados[estados.length - 1];
  return { leitor, estados, amostras, descartes, ultimo };
}

async function conectado() {
  const t = montar();
  await t.leitor.ligar();
  ble.__emitir('discover', { id: ID, rssi: -60, advertising: { localName: 'E36-DS2' } });
  await jest.advanceTimersByTimeAsync(0);
  return t;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  ble.__limpar();
  mock('checkState').mockImplementation(async () => 'on');
  mock('connect').mockImplementation(async () => undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('procurar e conectar', () => {
  test('acha pelo nome, assina a TX descoberta e fica CONECTADO', async () => {
    const t = montar();
    await t.leitor.ligar();
    expect(mock('scan')).toHaveBeenCalledWith({ seconds: 8 });

    ble.__emitir('discover', { id: 'outro', rssi: -50, advertising: { localName: 'Fone JBL' } });
    expect(mock('connect')).not.toHaveBeenCalled();

    ble.__emitir('discover', { id: ID, rssi: -60, name: 'esp', advertising: { localName: 'E36-DS2' } });
    await jest.advanceTimersByTimeAsync(0);

    expect(mock('stopScan')).toHaveBeenCalled();
    expect(mock('connect')).toHaveBeenCalledWith(ID);
    // O servico veio do retrieveServices, nao de uma constante.
    expect(mock('startNotification')).toHaveBeenCalledWith(ID, SERVICO, TX);
    expect(t.ultimo()).toEqual(['CONECTADO', ID, true]);
  });

  test('sem localName no anuncio, usa o nome do periferico', async () => {
    const t = montar();
    await t.leitor.ligar();
    ble.__emitir('discover', { id: ID, rssi: -60, name: 'e36-ds2', advertising: {} });
    await jest.advanceTimersByTimeAsync(0);
    expect(t.ultimo()[0]).toBe('CONECTADO');
  });

  test('varredura sem o modulo tenta de novo em 3 s', async () => {
    const t = montar();
    await t.leitor.ligar();
    ble.__emitir('stopScan', {});
    expect(t.ultimo()).toEqual(['PROCURANDO', 'módulo não apareceu, tentando de novo', true]);
    expect(mock('scan')).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(3000);
    expect(mock('scan')).toHaveBeenCalledTimes(2);
  });

  test('modulo sem a caracteristica TX vira ERRO e tenta de novo', async () => {
    mock('retrieveServices').mockImplementationOnce(async () => ({ id: ID, characteristics: [] }));
    const t = await conectado();
    expect(t.ultimo()).toEqual(['ERRO', 'o módulo não tem a característica TX do Nordic UART', true]);
    expect(mock('disconnect')).toHaveBeenCalledWith(ID);
    await jest.advanceTimersByTimeAsync(2000);
    expect(mock('scan')).toHaveBeenCalledTimes(2);
  });

  test('connect que nao responde expira em 10 s e cancela a conexao pendente', async () => {
    mock('connect').mockImplementation(() => new Promise(() => undefined));
    const t = await conectado();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(t.ultimo()).toEqual(['ERRO', 'o módulo não aceitou a conexão', true]);
    expect(mock('disconnect')).toHaveBeenCalledWith(ID);
  });
});

describe('dados', () => {
  test('linhas cortadas em 20 bytes viram amostras; lixo e contado', async () => {
    const t = await conectado();
    const fluxo = '{"t":100,"rpm":812,"ect":88,"valid":127}\nlixo\n{"t":300,"rpm":2350,"valid":127}\n';
    for (const p of pedacos(fluxo)) {
      ble.__emitir('valor', { peripheral: ID, service: SERVICO, characteristic: TX.toLowerCase(), value: p });
    }
    expect(t.amostras.map((a) => [a.t_ms, a.rpm])).toEqual([
      [100, 812],
      [300, 2350],
    ]);
    expect(t.descartes).toEqual(['lixo']);
  });

  test('notificacao de outro periferico e ignorada', async () => {
    const t = await conectado();
    ble.__emitir('valor', { peripheral: 'outro', service: SERVICO, characteristic: TX, value: pedacos('{"t":1}\n')[0] });
    expect(t.amostras).toEqual([]);
  });
});

describe('quedas e Bluetooth', () => {
  test('conexao que cai volta a procurar sozinha', async () => {
    const t = await conectado();
    ble.__emitir('disconnect', { peripheral: ID });
    expect(t.ultimo()).toEqual(['PROCURANDO', 'a conexão caiu, procurando de novo', true]);
    await jest.advanceTimersByTimeAsync(1000);
    expect(mock('scan')).toHaveBeenCalledTimes(2);
  });

  test('a linha pela metade de antes da queda nao gruda na primeira depois', async () => {
    const t = await conectado();
    ble.__emitir('valor', { peripheral: ID, service: SERVICO, characteristic: TX, value: pedacos('{"t":5,"rpm":9')[0] });
    ble.__emitir('disconnect', { peripheral: ID });
    await jest.advanceTimersByTimeAsync(1000);
    ble.__emitir('discover', { id: ID, rssi: -60, advertising: { localName: 'E36-DS2' } });
    await jest.advanceTimersByTimeAsync(0);
    for (const p of pedacos('{"t":6,"rpm":900,"valid":127}\n')) {
      ble.__emitir('valor', { peripheral: ID, service: SERVICO, characteristic: TX, value: p });
    }
    expect(t.amostras.map((a) => a.t_ms)).toEqual([6]);
    expect(t.descartes).toEqual([]);
  });

  test('Bluetooth desligado: ERRO e nova tentativa em 2 s', async () => {
    mock('checkState').mockImplementation(async () => 'off');
    const t = montar();
    await t.leitor.ligar();
    expect(t.ultimo()).toEqual(['ERRO', 'Bluetooth desligado: ligue para continuar', true]);
    mock('checkState').mockImplementation(async () => 'on');
    await jest.advanceTimersByTimeAsync(2000);
    expect(mock('scan')).toHaveBeenCalledTimes(1);
  });

  test('sem permissao no iOS: ERRO e para de tentar', async () => {
    mock('checkState').mockImplementation(async () => 'unauthorized');
    const t = montar();
    await t.leitor.ligar();
    expect(t.ultimo()).toEqual(['ERRO', 'sem permissão de Bluetooth (Ajustes do iOS)', false]);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(mock('scan')).not.toHaveBeenCalled();
  });

  test('desligar solta o modulo e nao reconecta', async () => {
    const t = await conectado();
    await t.leitor.desligar();
    expect(mock('disconnect')).toHaveBeenCalledWith(ID);
    expect(t.ultimo()).toEqual(['DESLIGADO', '', false]);
    ble.__emitir('disconnect', { peripheral: ID });
    await jest.advanceTimersByTimeAsync(5000);
    expect(mock('scan')).toHaveBeenCalledTimes(1);
  });
});
