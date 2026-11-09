/*
  O protocolo.ts tem de ler o ESP32 igual ao backend. Os vetores foram
  gerados passando os mesmos bytes pelo leitor.py do telemetria-desktop
  (ferramentas/gerar_vetores.py); aqui o resultado do app tem de bater
  linha a linha.
*/
import { describe, expect, test } from '@jest/globals';

import vetores from './__fixtures__/vetores.json';
import { BITS_EXTRAS, MontadorDeLinha, decodificar, respondeu, type Amostra } from './protocolo';

type Esperado = { linha: string; amostra: Amostra | null };
type Caso = { nome: string; pedacos: number[][]; esperado: Esperado[] };

function rodar(pedacos: number[][]) {
  const montador = new MontadorDeLinha();
  return pedacos.flatMap((p) => montador.alimentar(p)).map((linha) => ({ linha, amostra: decodificar(linha) }));
}

describe('igual ao backend (leitor.py)', () => {
  for (const caso of vetores.casos as Caso[]) {
    test(caso.nome, () => {
      expect(caso.esperado.length).toBeGreaterThan(0);
      expect(rodar(caso.pedacos)).toEqual(caso.esperado);
    });
  }
});

describe('MontadorDeLinha', () => {
  const bytes = (texto: string) => Array.from(texto, (c) => c.charCodeAt(0));

  test('linha cortada em varios pedacos so sai quando a quebra chega', () => {
    const m = new MontadorDeLinha();
    expect(m.alimentar(bytes('{"t":1,'))).toEqual([]);
    expect(m.alimentar(bytes('"rpm":900}'))).toEqual([]);
    expect(m.alimentar(bytes('\n{"t":2'))).toEqual(['{"t":1,"rpm":900}']);
  });

  test('buffer sem quebra de linha nao cresce sem limite', () => {
    const m = new MontadorDeLinha();
    m.alimentar(new Array(MontadorDeLinha.LIMITE_LIXO + 1).fill(0x41));
    // O lixo foi descartado: a proxima linha sai limpa, sem os 4097 "A".
    expect(m.alimentar(bytes('{"t":3}\n'))).toEqual(['{"t":3}']);
  });

  test('byte fora do ASCII nao derruba a leitura', () => {
    const m = new MontadorDeLinha();
    expect(m.alimentar([0xff, 0xfe, 0x0a])).toEqual(['��']);
  });
});

describe('decodificar', () => {
  test('lixo vira null', () => {
    for (const linha of ['', 'lixo', '[1,2]', 'null', '42', '{"rpm":800}', '{"t":1,']) {
      expect(decodificar(linha)).toBeNull();
    }
  });

  // Aqui o app difere do backend de proposito: la essas linhas levantam
  // excecao (ValueError / TypeError) e derrubam a conexao BLE.
  test('campo que nao e numero descarta so a linha', () => {
    expect(decodificar('{"t":1,"rpm":"abc"}')).toBeNull();
    expect(decodificar('{"t":1,"maf":"x"}')).toBeNull();
  });

  test('extra nulo vira null em vez de derrubar a leitura', () => {
    expect(decodificar('{"t":1,"load":null}')?.load).toBeNull();
  });

  test('respondeu() le o bit de cada campo', () => {
    const a = decodificar(`{"t":1,"rpm":900,"valid":${0x02 | BITS_EXTRAS.lam1}}`)!;
    expect(respondeu(a, 'rpm')).toBe(true);
    expect(respondeu(a, 'ect')).toBe(false);
    expect(respondeu(a, 'lam1')).toBe(true);
    expect(respondeu(a, 'lam2')).toBe(false);
  });
});
