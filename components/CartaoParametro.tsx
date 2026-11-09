import { StyleSheet, Text, View } from 'react-native';

import { cores } from './cores';
import { formatar, type Parametro } from './parametros';

type Props = {
  parametro: Parametro;
  valor: number | null;
  /** O bit do campo em `valid` estava aceso nesta leitura. */
  respondeu: boolean;
};

/**
 * Um parametro. Sem resposta da central o card apaga e nao mostra numero:
 * o firmware repete o valor anterior quando falha, e dado velho nao pode
 * passar por medicao nova.
 */
export function CartaoParametro({ parametro, valor, respondeu }: Props) {
  const temValor = respondeu && valor !== null;
  return (
    <View
      style={[estilos.cartao, !temValor && estilos.apagado]}
      accessible
      accessibilityLabel={`${parametro.rotulo}: ${temValor ? `${formatar(valor, parametro.casas)} ${parametro.unidade}` : 'sem resposta'}`}
    >
      <Text style={estilos.rotulo} numberOfLines={1}>
        {parametro.rotulo}
      </Text>
      {temValor ? (
        <Text style={estilos.valor}>
          {formatar(valor, parametro.casas)}
          <Text style={estilos.unidade}> {parametro.unidade}</Text>
        </Text>
      ) : (
        <Text style={estilos.semResposta}>sem resposta</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: cores.cartao,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  apagado: { opacity: 0.45 },
  rotulo: { color: cores.textoFraco, fontSize: 13 },
  valor: { color: cores.texto, fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  unidade: { color: cores.textoFraco, fontSize: 14, fontWeight: '400' },
  semResposta: { color: cores.textoFraco, fontSize: 16, paddingVertical: 6 },
});
