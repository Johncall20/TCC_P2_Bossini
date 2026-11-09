/*
  Rotulo, unidade e casas de cada parametro: copiados do painel desktop
  (telemetria-desktop/frontend/src/parametros.js), para os dois lados
  mostrarem o mesmo numero do mesmo jeito.
*/
import type { Campo } from '../ble/protocolo';

export type Parametro = { chave: Campo; rotulo: string; unidade: string; casas: number };

export const NUCLEO: Parametro[] = [
  { chave: 'vss', rotulo: 'Velocidade', unidade: 'km/h', casas: 0 },
  { chave: 'ect', rotulo: 'Temp. do motor', unidade: '°C', casas: 0 },
  { chave: 'tps', rotulo: 'TPS', unidade: '%', casas: 1 },
  { chave: 'vanos', rotulo: 'VANOS', unidade: '°CRK', casas: 1 },
  { chave: 'iat', rotulo: 'Temp. do ar', unidade: '°C', casas: 0 },
  { chave: 'vbat', rotulo: 'Bateria', unidade: 'V', casas: 2 },
];

export const EXTRAS: Parametro[] = [
  { chave: 'load', rotulo: 'Carga', unidade: 'mg/str', casas: 1 },
  { chave: 'maf', rotulo: 'Fluxo de ar (MAF)', unidade: 'kg/h', casas: 1 },
  { chave: 'mafv', rotulo: 'Tensão MAF', unidade: 'V', casas: 2 },
  { chave: 'iacv', rotulo: 'IACV (lenta)', unidade: '%', casas: 1 },
  { chave: 'ign', rotulo: 'Avanço de ignição', unidade: '°CRK', casas: 1 },
  { chave: 'knock', rotulo: 'Retardo de knock', unidade: '°CRK', casas: 1 },
  { chave: 'inj', rotulo: 'Tempo de injeção', unidade: 'ms', casas: 2 },
  { chave: 'lam1', rotulo: 'Sonda lambda 1', unidade: 'V', casas: 2 },
  { chave: 'lam2', rotulo: 'Sonda lambda 2', unidade: 'V', casas: 2 },
  { chave: 'lint1', rotulo: 'Lambda int. 1', unidade: '%', casas: 1 },
  { chave: 'lint2', rotulo: 'Lambda int. 2', unidade: '%', casas: 1 },
];

/** Numero no formato brasileiro, com as casas do parametro. */
export function formatar(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
