/*
  O que o ESP32-C3 manda pelo BLE e como isso vira uma amostra.

  E a mesma regra do backend do telemetria-desktop
  (backend/telemetria/servicos/leitor.py: MontadorDeLinha e decodificar)
  e da tabela de bits (backend/telemetria/modelos/enums.py). Se o firmware
  mudar o formato, muda la e aqui.

  Nada aqui sabe de Bluetooth nem de React: entra byte, sai amostra. Por
  isso da para testar sem celular (protocolo.test.ts).
*/

/** Nome que o firmware anuncia. O backend procura por ele tambem. */
export const NOME_PADRAO = 'E36-DS2';

/**
 * Caracteristica TX do Nordic UART Service: o ESP32 notifica por ela.
 * O servico NAO e fixado aqui: quem o descobre e o retrieveServices,
 * procurando de qual servico esta caracteristica faz parte.
 */
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** Bits do campo `valid`: os sete do nucleo, que o firmware le desde o inicio. */
export const BITS_NUCLEO = {
  ect: 0x01,
  rpm: 0x02,
  tps: 0x04,
  vanos: 0x08,
  vbat: 0x10,
  iat: 0x20,
  vss: 0x40,
} as const;

/** Os extras da MS41 (bits 7 a 17). Firmware antigo nao manda nenhum. */
export const BITS_EXTRAS = {
  load: 1 << 7,
  maf: 1 << 8,
  mafv: 1 << 9,
  knock: 1 << 10,
  ign: 1 << 11,
  inj: 1 << 12,
  iacv: 1 << 13,
  lint1: 1 << 14,
  lint2: 1 << 15,
  lam1: 1 << 16,
  lam2: 1 << 17,
} as const;

export type CampoNucleo = keyof typeof BITS_NUCLEO;
export type CampoExtra = keyof typeof BITS_EXTRAS;
export type Campo = CampoNucleo | CampoExtra;

export const CAMPOS_EXTRAS = Object.keys(BITS_EXTRAS) as CampoExtra[];

export type Amostra = {
  /** Relogio do ESP32, em ms. Nao e o relogio do celular. */
  t_ms: number;
  rpm: number;
  ect: number;
  iat: number;
  vbat: number;
  tps: number;
  vanos: number;
  vss: number;
  valid: number;
} & Record<CampoExtra, number | null>;

/** O campo respondeu nesta leitura? O firmware repete o valor antigo quando falha. */
export function respondeu(amostra: Amostra, campo: Campo): boolean {
  const bit = campo in BITS_NUCLEO ? BITS_NUCLEO[campo as CampoNucleo] : BITS_EXTRAS[campo as CampoExtra];
  return (amostra.valid & bit) !== 0;
}

/**
 * Bytes de uma linha viram texto. O firmware so manda ASCII (JSON de
 * numeros); byte acima de 127 so aparece em lixo e vira U+FFFD, como o
 * `errors="replace"` do backend. Feito a mao para nao depender de
 * TextDecoder, que nem todo runtime do React Native expoe.
 */
function bytesParaTexto(bytes: readonly number[]): string {
  let texto = '';
  for (const b of bytes) texto += b < 0x80 ? String.fromCharCode(b) : '�';
  return texto;
}

const QUEBRA_DE_LINHA = 0x0a;

/**
 * Remonta as linhas JSON a partir dos pedacos do notify. Com MTU padrao o
 * ESP32 corta a linha a cada 20 bytes; o tamanho do pedaco nao importa
 * aqui, so a quebra de linha.
 */
export class MontadorDeLinha {
  static readonly LIMITE_LIXO = 4096;

  private buffer: number[] = [];

  /** Recebe um pedaco cru e devolve as linhas que fecharam com ele. */
  alimentar(pedaco: readonly number[]): string[] {
    const linhas: string[] = [];
    for (const byte of pedaco) {
      if (byte !== QUEBRA_DE_LINHA) {
        this.buffer.push(byte);
        continue;
      }
      const texto = bytesParaTexto(this.buffer).trim();
      this.buffer = [];
      if (texto) linhas.push(texto);
    }
    // Um link que manda bytes e nunca uma quebra de linha faria o buffer
    // crescer sem limite.
    if (this.buffer.length > MontadorDeLinha.LIMITE_LIXO) this.buffer = [];
    return linhas;
  }
}

function numero(valor: unknown, padrao: number): number {
  if (valor === undefined) return padrao;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Uma linha JSON do firmware vira a amostra; null para lixo.
 *
 * Diferenca proposital em relacao ao backend: la, um campo que nao e
 * numero levanta excecao e derruba a conexao BLE (o laco cai no ERRO e
 * reconecta). Aqui a linha e so descartada, como qualquer lixo.
 */
export function decodificar(linha: string): Amostra | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(linha);
  } catch {
    return null;
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null;
  const d = bruto as Record<string, unknown>;
  if (!('t' in d)) return null;

  const nucleo = {
    t_ms: Math.trunc(numero(d.t, 0)),
    rpm: Math.trunc(numero(d.rpm, 0)),
    ect: Math.trunc(numero(d.ect, 0)),
    iat: Math.trunc(numero(d.iat, 0)),
    vbat: numero(d.vbat, 0),
    tps: numero(d.tps, 0),
    vanos: numero(d.vanos, 0),
    vss: Math.trunc(numero(d.vss, 0)),
    valid: Math.trunc(numero(d.valid, 0)),
  };
  if (Object.values(nucleo).some(Number.isNaN)) return null;

  const extras = {} as Record<CampoExtra, number | null>;
  for (const campo of CAMPOS_EXTRAS) {
    const valor = d[campo];
    if (valor === undefined || valor === null) {
      extras[campo] = null;
      continue;
    }
    const n = numero(valor, NaN);
    if (Number.isNaN(n)) return null;
    extras[campo] = n;
  }

  return { ...nucleo, ...extras };
}
