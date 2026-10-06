import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as jpegDecode } from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import meta from '../../assets/model/model_meta.json';
import hastaliklar from '../../assets/model/hastalik_bilgileri.json';

const ESIK = meta.confidence_threshold;
const BOYUT = meta.input_size;

type Sonuc =
  | { tur: 'tahmin'; sinif: string; guven: number }
  | { tur: 'emin_degil'; enYakin: string; guven: number };

export default function HomeScreen() {
  const [model, setModel] = useState<TensorflowModel | null>(null);
  const [modelHata, setModelHata] = useState('');
  const [goruntu, setGoruntu] = useState<string | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await loadTensorflowModel(
          require('../../assets/model/model_float32.tflite'), []
        );
        setModel(m);
      } catch (e) {
        setModelHata(String(e));
      }
    })();
  }, []);

  async function goruntuSec(kamera: boolean) {
    const izin = kamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) return;
    const r = kamera
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (r.canceled) return;
    const uri = r.assets[0].uri;
    setGoruntu(uri);
    setSonuc(null);
    await tahminYap(uri);
  }

  async function tahminYap(uri: string) {
    if (!model) return;
    setIsleniyor(true);
    try {
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: BOYUT, height: BOYUT } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );
      const bin = atob(manip.base64!);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const img = jpegDecode(bytes, { useTArray: true });
      const input = new Float32Array(BOYUT * BOYUT * 3);
      let j = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        input[j++] = img.data[i];
        input[j++] = img.data[i + 1];
        input[j++] = img.data[i + 2];
      }
      const output = await model.run([input]);
      const probs = output[0] as unknown as Float32Array;
      let maxI = 0;
      for (let i = 1; i < probs.length; i++) if (probs[i] > probs[maxI]) maxI = i;
      const guven = probs[maxI];
      const sinif = meta.classes[maxI];
      if (guven >= ESIK) setSonuc({ tur: 'tahmin', sinif, guven });
      else setSonuc({ tur: 'emin_degil', enYakin: sinif, guven });
    } catch (e) {
      setModelHata(String(e));
    } finally {
      setIsleniyor(false);
    }
  }

  function sifirla() {
    setGoruntu(null);
    setSonuc(null);
  }

  const h =
    sonuc && sonuc.tur === 'tahmin' ? (hastaliklar as any)[sonuc.sinif] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.baslik}>Domates Yaprak Hastalik Tespiti</Text>

        {modelHata ? (
          <View style={[styles.kutu, styles.hataKutu]}>
            <Text style={styles.hata}>Model hatasi: {modelHata}</Text>
          </View>
        ) : !model ? (
          <View style={styles.kutu}>
            <ActivityIndicator color="#2e7d32" />
            <Text style={styles.detay}>Model yukleniyor...</Text>
          </View>
        ) : (
          <>
            {!goruntu && (
              <View style={styles.kutu}>
                <Text style={styles.detay}>
                  Domates yapraginin net bir fotografini cekin ya da galeriden secin.
                </Text>
              </View>
            )}

            {goruntu && <Image source={{ uri: goruntu }} style={styles.onizleme} />}

            {isleniyor && (
              <View style={styles.kutu}>
                <ActivityIndicator color="#2e7d32" />
                <Text style={styles.detay}>Analiz ediliyor...</Text>
              </View>
            )}

            {sonuc?.tur === 'tahmin' && h && (
              <View style={styles.sonucKutu}>
                <Text style={styles.sonucAd}>{h.ad}</Text>
                <Text style={styles.guven}>Guven: %{Math.round(sonuc.guven * 100)}</Text>
                <Text style={styles.bolumBaslik}>Aciklama</Text>
                <Text style={styles.bolumMetin}>{h.aciklama}</Text>
                <Text style={styles.bolumBaslik}>Belirtiler</Text>
                <Text style={styles.bolumMetin}>{h.belirtiler}</Text>
                <Text style={styles.bolumBaslik}>Oneri</Text>
                <Text style={styles.bolumMetin}>{h.oneri}</Text>
              </View>
            )}

            {sonuc?.tur === 'emin_degil' && (
              <View style={[styles.sonucKutu, styles.eminDegilKutu]}>
                <Text style={styles.eminDegilBaslik}>Emin degilim</Text>
                <Text style={styles.bolumMetin}>
                  Model bu fotografta emin degil (en yakin: {(hastaliklar as any)[sonuc.enYakin]?.ad}, %{Math.round(sonuc.guven * 100)}). Daha net, iyi isiklandirilmis bir fotograf cekin ya da uzmana danisin.
                </Text>
              </View>
            )}

            <View style={styles.butonlar}>
              <Pressable style={styles.buton} onPress={() => goruntuSec(true)}>
                <Text style={styles.butonYazi}>Fotograf Cek</Text>
              </Pressable>
              <Pressable
                style={[styles.buton, styles.butonIkincil]}
                onPress={() => goruntuSec(false)}
              >
                <Text style={[styles.butonYazi, styles.butonYaziIkincil]}>
                  Galeriden Sec
                </Text>
              </Pressable>
            </View>

            {goruntu && (
              <Pressable style={styles.yeniButon} onPress={sifirla}>
                <Text style={styles.yeniYazi}>Yeni Fotograf</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f2' },
  container: { padding: 20, gap: 16 },
  baslik: { fontSize: 22, fontWeight: '700', color: '#2e4d1f', textAlign: 'center' },
  kutu: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8,
    borderWidth: 1, borderColor: '#e0e6d8', alignItems: 'center',
  },
  hataKutu: { borderColor: '#f0c0b0' },
  hata: { fontSize: 13, color: '#c0392b' },
  detay: { fontSize: 14, color: '#6b7d5e', textAlign: 'center' },
  onizleme: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#ddd' },
  sonucKutu: {
    backgroundColor: '#fff', borderRadius: 12, padding: 18, gap: 4,
    borderWidth: 1, borderColor: '#cde0bf',
  },
  eminDegilKutu: { borderColor: '#e8d59a', backgroundColor: '#fdf9ec' },
  sonucAd: { fontSize: 20, fontWeight: '700', color: '#2e7d32' },
  guven: { fontSize: 14, color: '#6b7d5e', marginBottom: 8 },
  eminDegilBaslik: { fontSize: 18, fontWeight: '700', color: '#b08900', marginBottom: 4 },
  bolumBaslik: { fontSize: 14, fontWeight: '700', color: '#2e4d1f', marginTop: 8 },
  bolumMetin: { fontSize: 14, color: '#444', lineHeight: 20 },
  butonlar: { gap: 10 },
  buton: { backgroundColor: '#2e7d32', borderRadius: 12, padding: 16, alignItems: 'center' },
  butonIkincil: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#2e7d32' },
  butonYazi: { color: '#fff', fontSize: 16, fontWeight: '600' },
  butonYaziIkincil: { color: '#2e7d32' },
  yeniButon: { padding: 12, alignItems: 'center' },
  yeniYazi: { color: '#6b7d5e', fontSize: 14, textDecorationLine: 'underline' },
});