/*
  A janela da tela para o LeitorEsp32: estado da ligacao, ultima amostra e
  as contagens que mostram se o link esta saudavel.
*/
import { useEffect, useRef, useState } from 'react';

import { LeitorEsp32, type EstadoLeitor } from './LeitorEsp32';
import type { Amostra } from './protocolo';

/** Quantas chegadas guardar para calcular a taxa (Hz). */
const JANELA_TAXA = 10;

export type Leitura = {
  amostra: Amostra | null;
  /** Date.now() das ultimas chegadas, pelo relogio do celular. */
  chegadas: number[];
  linhas: number;
  descartadas: number;
};

const LEITURA_VAZIA: Leitura = { amostra: null, chegadas: [], linhas: 0, descartadas: 0 };

export function useLeitorEsp32() {
  const [ligacao, setLigacao] = useState<{ estado: EstadoLeitor; detalhe: string; ativo: boolean }>({
    estado: 'DESLIGADO',
    detalhe: '',
    ativo: false,
  });
  const [leitura, setLeitura] = useState<Leitura>(LEITURA_VAZIA);
  const leitor = useRef<LeitorEsp32 | null>(null);

  if (leitor.current === null) {
    leitor.current = new LeitorEsp32({
      aoMudarEstado: (estado, detalhe, ativo) => setLigacao({ estado, detalhe, ativo }),
      aoLer: (amostra) =>
        setLeitura((antes) => ({
          amostra,
          chegadas: [...antes.chegadas, Date.now()].slice(-JANELA_TAXA),
          linhas: antes.linhas + 1,
          descartadas: antes.descartadas,
        })),
      aoDescartar: () => setLeitura((antes) => ({ ...antes, descartadas: antes.descartadas + 1 })),
    });
  }

  useEffect(() => () => leitor.current?.destruir(), []);

  return {
    ...ligacao,
    ...leitura,
    ligar: () => {
      setLeitura(LEITURA_VAZIA);
      void leitor.current?.ligar();
    },
    desligar: () => void leitor.current?.desligar(),
  };
}

/** Amostras por segundo nas ultimas chegadas; null sem chegadas suficientes. */
export function taxaHz(chegadas: number[]): number | null {
  if (chegadas.length < 2) return null;
  const intervalo = chegadas[chegadas.length - 1] - chegadas[0];
  return intervalo > 0 ? ((chegadas.length - 1) * 1000) / intervalo : null;
}
