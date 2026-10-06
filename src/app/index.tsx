import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import { loadTensorflowModel } from 'react-native-fast-tflite';

import meta from '../../assets/model/model_meta.json';

export default function HomeScreen() {
  const [log, setLog] = useState<string[]>([]);
  const ekle = (s: string) => setLog((p) => [...p, s]);

  useEffect(() => {
    (async () => {
      try {
        const req = require('../../assets/model/model_float32.tflite');
        ekle('1) require tipi: ' + typeof req + ' | deger: ' + JSON.stringify(req));

        const asset = Asset.fromModule(req);
        ekle('2) asset.uri (indirmeden): ' + asset.uri);
        ekle('   asset.localUri (indirmeden): ' + String(asset.localUri));

        await asset.downloadAsync();
        ekle('3) indirme sonrasi localUri: ' + String(asset.localUri));
        ekle('   downloaded: ' + String(asset.downloaded));

        // Yontem A: dogrudan require
        try {
          const m1 = await loadTensorflowModel(req, []);
          ekle('A) require ile YUKLENDI. girdi: ' + JSON.stringify(m1.inputs[0]?.shape));
        } catch (e) {
          ekle('A) require ile HATA: ' + String(e));
        }

        // Yontem B: localUri ile
        try {
          const m2 = await loadTensorflowModel({ url: asset.localUri ?? asset.uri });
          ekle('B) url ile YUKLENDI. girdi: ' + JSON.stringify(m2.inputs[0]?.shape));
        } catch (e) {
          ekle('B) url ile HATA: ' + String(e));
        }
      } catch (e) {
        ekle('GENEL HATA: ' + String(e));
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.baslik}>Model teshis</Text>
        <Text style={styles.detay}>Girdi boyutu (meta): {meta.input_size}</Text>
        <View style={styles.kutu}>
          {log.map((l, i) => (
            <Text key={i} style={styles.log}>{l}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f2' },
  container: { padding: 20, gap: 12 },
  baslik: { fontSize: 20, fontWeight: '700', color: '#2e4d1f' },
  detay: { fontSize: 13, color: '#555' },
  kutu: { backgroundColor: '#fff', borderRadius: 10, padding: 14, gap: 8, borderWidth: 1, borderColor: '#e0e6d8' },
  log: { fontSize: 12, color: '#333', fontFamily: 'monospace' },
});