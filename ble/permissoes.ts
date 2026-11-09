/*
  Permissao de Bluetooth em tempo de execucao. So o Android pergunta por
  codigo; no iOS o sistema mostra o pedido sozinho na primeira varredura,
  com o texto do NSBluetoothAlwaysUsageDescription (app.json).

  Fontes:
  - https://developer.android.com/develop/connectivity/bluetooth/bt-permissions
  - https://innoveit.github.io/react-native-ble-manager/install/
*/
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

/** Pede o que falta e diz se tudo foi concedido. */
export async function pedirPermissoesBluetooth(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const versao = Number(Platform.Version);
  const pedidas: Permission[] =
    versao >= 31
      ? // Android 12+: "Dispositivos proximos". Sem localizacao, porque o
        // app.json declara o BLUETOOTH_SCAN com neverForLocation.
        [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : // Android 11 e anteriores: a varredura BLE exige localizacao.
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const resposta = await PermissionsAndroid.requestMultiple(pedidas);
  return pedidas.every((p) => resposta[p] === PermissionsAndroid.RESULTS.GRANTED);
}
