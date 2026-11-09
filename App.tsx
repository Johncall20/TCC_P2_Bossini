/*
  A unica tela da prova de conceito: o celular le o ESP32-C3 do carro pelo
  Bluetooth, sem o computador com o backend no meio.
*/
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { respondeu } from './ble/protocolo';
import { taxaHz, useLeitorEsp32 } from './ble/useLeitorEsp32';
import { BarraDeEstado } from './components/BarraDeEstado';
import { CartaoParametro } from './components/CartaoParametro';
import { cores } from './components/cores';
import { EXTRAS, NUCLEO, formatar } from './components/parametros';

/** Sem amostra ha mais que isto, o numero na tela e velho e apaga. */
const IDADE_MAXIMA_S = 3;

/** O relogio da tela, para "ultima leitura ha X s" andar sem chegar amostra. */
function useAgora(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ligado) return;
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, [ligado]);
  return agora;
}

function Painel() {
  const leitor = useLeitorEsp32();
  const { amostra } = leitor;
  const ultima = leitor.chegadas[leitor.chegadas.length - 1];
  // O relogio anda enquanto houver numero na tela, mesmo desconectado:
  // e ele que mostra que o numero envelheceu.
  const agora = useAgora(leitor.ativo || ultima !== undefined);

  const idade = ultima === undefined ? null : Math.max(0, (agora - ultima) / 1000);
  const velha = idade !== null && idade > IDADE_MAXIMA_S;
  const hz = velha ? null : taxaHz(leitor.chegadas);
  const rpmValido = amostra !== null && respondeu(amostra, 'rpm');

  return (
    <SafeAreaView style={estilos.tela}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Text style={estilos.titulo}>Telemetria E36 · BLE direto</Text>

        <BarraDeEstado
          estado={leitor.estado}
          detalhe={leitor.detalhe}
          ligado={leitor.ativo}
          aoLigar={leitor.ligar}
          aoDesligar={leitor.desligar}
        />

        <View style={estilos.rpm} accessible accessibilityLabel={`RPM: ${rpmValido ? amostra.rpm : 'sem resposta'}`}>
          <Text style={estilos.rotuloRpm}>RPM</Text>
          <Text style={[estilos.valorRpm, (!rpmValido || velha) && estilos.apagado]}>
            {rpmValido ? formatar(amostra.rpm, 0) : '—'}
          </Text>
          <Text style={estilos.saude}>
            {hz === null ? '— Hz' : `${formatar(hz, 1)} Hz`} · {leitor.linhas} leituras · {leitor.descartadas}{' '}
            descartadas
          </Text>
          <Text style={[estilos.saude, velha && estilos.atrasada]}>
            {idade === null ? 'nenhuma leitura ainda' : `última leitura há ${formatar(idade, 1)} s`}
          </Text>
        </View>

        <View style={[estilos.grade, velha && estilos.apagado]}>
          {NUCLEO.map((p) => (
            <CartaoParametro
              key={p.chave}
              parametro={p}
              valor={amostra ? amostra[p.chave] : null}
              respondeu={amostra !== null && respondeu(amostra, p.chave)}
            />
          ))}
        </View>

        <Text style={estilos.secao}>Extras da MS41</Text>
        <View style={[estilos.grade, velha && estilos.apagado]}>
          {EXTRAS.map((p) => (
            <CartaoParametro
              key={p.chave}
              parametro={p}
              valor={amostra ? amostra[p.chave] : null}
              respondeu={amostra !== null && respondeu(amostra, p.chave)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Painel />
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, gap: 12 },
  titulo: { color: cores.textoFraco, fontSize: 14, letterSpacing: 0.5 },
  rpm: { backgroundColor: cores.cartao, borderRadius: 12, padding: 16, alignItems: 'center', gap: 2 },
  rotuloRpm: { color: cores.textoFraco, fontSize: 14 },
  valorRpm: { color: cores.texto, fontSize: 72, fontWeight: '700', fontVariant: ['tabular-nums'] },
  apagado: { opacity: 0.45 },
  saude: { color: cores.textoFraco, fontSize: 13, fontVariant: ['tabular-nums'] },
  atrasada: { color: cores.erro },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secao: { color: cores.textoFraco, fontSize: 14, marginTop: 8 },
});
