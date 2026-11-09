import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EstadoLeitor } from '../ble/LeitorEsp32';
import { cores } from './cores';

const COR: Record<EstadoLeitor, string> = {
  DESLIGADO: cores.desligado,
  PROCURANDO: cores.procurando,
  CONECTADO: cores.conectado,
  ERRO: cores.erro,
};

const NOME: Record<EstadoLeitor, string> = {
  DESLIGADO: 'Desligado',
  PROCURANDO: 'Procurando',
  CONECTADO: 'Conectado',
  ERRO: 'Erro',
};

type Props = {
  estado: EstadoLeitor;
  detalhe: string;
  /** O leitor esta tentando (procurando, conectado ou esperando para tentar de novo). */
  ligado: boolean;
  aoLigar: () => void;
  aoDesligar: () => void;
};

/** Estado da ligacao BLE e o botao que liga e desliga a procura. */
export function BarraDeEstado({ estado, detalhe, ligado, aoLigar, aoDesligar }: Props) {
  return (
    <View style={estilos.barra}>
      <View style={estilos.texto} accessible accessibilityLiveRegion="polite">
        <View style={estilos.linha}>
          <View style={[estilos.ponto, { backgroundColor: COR[estado] }]} />
          <Text style={estilos.estado}>{NOME[estado]}</Text>
        </View>
        {detalhe ? (
          <Text style={estilos.detalhe} numberOfLines={2}>
            {detalhe}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={ligado ? aoDesligar : aoLigar}
        style={({ pressed }) => [estilos.botao, ligado && estilos.botaoParar, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        <Text style={estilos.textoBotao}>{ligado ? 'Desconectar' : 'Conectar'}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 14,
  },
  texto: { flex: 1, gap: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ponto: { width: 10, height: 10, borderRadius: 5 },
  estado: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  detalhe: { color: cores.textoFraco, fontSize: 13 },
  botao: { backgroundColor: cores.acento, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  botaoParar: { backgroundColor: cores.borda },
  textoBotao: { color: cores.texto, fontSize: 15, fontWeight: '600' },
});
