import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';

interface GpsSample {
  id: string;
  index: number;
  time: string;
  latitude: number;
  longitude: number;
  accuracy: number | null; // em metros
  distanceFromOrigin: number; // em metros
  distanceFromPrevious: number; // em metros
  altitude: number | null;
  speed: number | null;
  note?: string;
}

// Fórmula de Haversine para cálculo de distância métrica exata na superfície terrestre
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function GpsScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  // Solicita permissões iniciais de localização
  const requestPermissions = useCallback(async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setErrorMessage(
          'O serviço de Localização (GPS) do sistema Android está desativado. Ative a localização nas configurações rápidas do aparelho.'
        );
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === Location.PermissionStatus.GRANTED;
      setHasPermission(granted);

      if (!granted) {
        setErrorMessage(
          'Permissão de Localização negada. Conceda acesso à Localização Precisa para testar o GPS.'
        );
      } else {
        fetchCurrentPosition();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Erro ao solicitar permissões: ${msg}`);
    }
  }, []);

  useEffect(() => {
    requestPermissions();

    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
        watchSubscription.current = null;
      }
    };
  }, [requestPermissions]);

  // Captura a posição atual uma vez
  const fetchCurrentPosition = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage('Buscando sinal de satélite / GNSS...');

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setCurrentLocation(loc);
      setStatusMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Falha ao obter posição GPS: ${msg}`);
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  // Alterna o rastreamento em tempo real contínuo
  const toggleWatch = async () => {
    if (isWatching) {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
        watchSubscription.current = null;
      }
      setIsWatching(false);
      setStatusMessage(null);
    } else {
      setErrorMessage(null);
      setStatusMessage('Iniciando rastreador GPS em tempo real...');

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          Alert.alert('Permissão necessária', 'Permita o acesso à localização precisa.');
          return;
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000, // Atualiza a cada 1 segundo
            distanceInterval: 0.1, // Notifica qualquer movimento mínimo (>10cm)
          },
          (newLocation) => {
            setCurrentLocation(newLocation);
            setStatusMessage('Rastreamento GPS ativo em alta precisão');
          }
        );

        watchSubscription.current = sub;
        setIsWatching(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Não foi possível iniciar monitoramento: ${msg}`);
        setIsWatching(false);
      }
    }
  };

  // Registra uma nova amostra no histórico
  const recordSample = () => {
    if (!currentLocation) {
      Alert.alert('Sem sinal GPS', 'Aguarde a obtenção de uma coordenada antes de registrar a amostra.');
      return;
    }

    const { latitude, longitude, accuracy, altitude, speed } = currentLocation.coords;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR');

    setSamples((prevSamples) => {
      const index = prevSamples.length;
      let distFromOrigin = 0;
      let distFromPrev = 0;

      if (prevSamples.length > 0) {
        const origin = prevSamples[0];
        distFromOrigin = calculateDistanceMeters(
          origin.latitude,
          origin.longitude,
          latitude,
          longitude
        );

        const last = prevSamples[prevSamples.length - 1];
        distFromPrev = calculateDistanceMeters(
          last.latitude,
          last.longitude,
          latitude,
          longitude
        );
      }

      const newSample: GpsSample = {
        id: `${Date.now()}-${index}`,
        index,
        time: timeStr,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        distanceFromOrigin: distFromOrigin,
        distanceFromPrevious: distFromPrev,
        altitude: altitude ?? null,
        speed: speed ?? null,
      };

      return [...prevSamples, newSample];
    });
  };

  // Limpa o histórico de amostras
  const clearSamples = () => {
    if (samples.length === 0) return;
    Alert.alert(
      'Redefinir Amostras',
      'Deseja apagar todos os pontos registrados e definir uma nova posição de origem?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redefinir',
          style: 'destructive',
          onPress: () => setSamples([]),
        },
      ]
    );
  };

  const coords = currentLocation?.coords;
  const currentAcc = coords?.accuracy ?? null;

  // Classificação visual de precisão do GPS
  const getAccuracyColor = (acc: number | null) => {
    if (acc === null) return '#94A3B8';
    if (acc <= 3) return '#10B981'; // Excelente (raro indoor, comum outdoor)
    if (acc <= 5) return '#06B6D4'; // Muito bom
    if (acc <= 10) return '#F59E0B'; // Razoável
    if (acc <= 20) return '#F97316'; // Baixo (comum em ambientes fechados)
    return '#EF4444'; // Muito baixo / ruído severo
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Bloco de Mensagens de Erro e Status */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxTitle}>Aviso de Localização</Text>
          <Text style={styles.errorBoxText}>{errorMessage}</Text>
        </View>
      )}

      {statusMessage && (
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 8 }} />
          <Text style={styles.statusBoxText}>{statusMessage}</Text>
        </View>
      )}

      {/* Cartão de Posição em Tempo Real */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🛰️ Sensor GPS (Tempo Real)</Text>
          <View
            style={[
              styles.liveBadge,
              { backgroundColor: isWatching ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)' },
            ]}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isWatching ? '#10B981' : '#94A3B8' },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                { color: isWatching ? '#10B981' : '#94A3B8' },
              ]}
            >
              {isWatching ? 'MONITORANDO' : 'PARADO'}
            </Text>
          </View>
        </View>

        {coords ? (
          <View style={styles.coordsGrid}>
            <View style={styles.coordCol}>
              <Text style={styles.coordLabel}>LATITUDE</Text>
              <Text style={styles.coordValue}>{coords.latitude.toFixed(7)}°</Text>
            </View>
            <View style={styles.coordCol}>
              <Text style={styles.coordLabel}>LONGITUDE</Text>
              <Text style={styles.coordValue}>{coords.longitude.toFixed(7)}°</Text>
            </View>
          </View>
        ) : (
          <View style={styles.waitingCoords}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.waitingText}>Aguardando leitura dos satélites...</Text>
          </View>
        )}

        {/* Precisão Estimada */}
        <View style={styles.accuracyContainer}>
          <View style={styles.accuracyRow}>
            <Text style={styles.accuracyLabel}>Precisão Estimada (Margem de Erro):</Text>
            <Text style={[styles.accuracyValue, { color: getAccuracyColor(currentAcc) }]}>
              {currentAcc !== null ? `± ${currentAcc.toFixed(1)} metros` : 'Calculando...'}
            </Text>
          </View>

          {/* Barra de sensibilidade de 3 a 5 metros */}
          <View style={styles.accuracyNoticeBox}>
            <Text style={styles.accuracyNoticeText}>
              {currentAcc === null
                ? 'Aguarde o cálculo de precisão.'
                : currentAcc <= 5
                ? '🟢 Precisão suficiente para detectar 3 a 5m.'
                : currentAcc <= 10
                ? '🟡 Incerteza (±5-10m) próxima do deslocamento de 3-5m.'
                : '🔴 Incerteza elevada (>10m). Típico de ambientes fechados sem visada de satélite.'}
            </Text>
          </View>
        </View>

        {/* Botões de Ação do Monitor */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btnSecondary, isWatching && styles.btnActive]}
            onPress={toggleWatch}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnSecondaryText, isWatching && styles.btnActiveText]}>
              {isWatching ? '⏹️ Parar Monitor' : '▶️ Acompanhar Live'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={fetchCurrentPosition}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Text style={styles.btnSecondaryText}>🔄 Atualizar Agora</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Cartão de Amostragem de Deslocamento */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Teste de Deslocamento (3 a 5m)</Text>
        <Text style={styles.sectionSubtitle}>
          Grave o ponto inicial (Origem) e depois caminhe de 3 a 5 metros para gravar novas amostras.
        </Text>

        <View style={styles.sampleActionRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, !currentLocation && styles.btnDisabled]}
            onPress={recordSample}
            disabled={!currentLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>
              {samples.length === 0
                ? '📌 REGISTRAR PONTO INICIAL (ORIGEM)'
                : `📍 REGISTRAR AMOSTRA #${samples.length}`}
            </Text>
          </TouchableOpacity>

          {samples.length > 0 && (
            <TouchableOpacity
              style={styles.btnDanger}
              onPress={clearSamples}
              activeOpacity={0.8}
            >
              <Text style={styles.btnDangerText}>🗑️ Limpar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resumo da Última Distância */}
        {samples.length > 1 && (
          <View style={styles.deltaBox}>
            <Text style={styles.deltaTitle}>Último Deslocamento Registrado:</Text>
            <Text style={styles.deltaValue}>
              {samples[samples.length - 1].distanceFromOrigin.toFixed(2)} m da Origem
            </Text>
            <Text style={styles.deltaSubtitle}>
              (+{samples[samples.length - 1].distanceFromPrevious.toFixed(2)} m em relação à amostra anterior)
            </Text>
          </View>
        )}
      </View>

      {/* Lista de Amostras */}
      <View style={styles.samplesSection}>
        <Text style={styles.samplesHeaderTitle}>
          Histórico de Amostras ({samples.length})
        </Text>

        {samples.length === 0 ? (
          <View style={styles.emptySamplesBox}>
            <Text style={styles.emptySamplesText}>Nenhuma amostra gravada ainda.</Text>
            <Text style={styles.emptySamplesSubtext}>
              1. Fique parado no local inicial e toque em "Registrar Ponto Inicial".{'\n'}
              2. Ande cerca de 3 a 5 metros.{'\n'}
              3. Toque novamente para registrar o ponto de destino.
            </Text>
          </View>
        ) : (
          samples.map((sample, idx) => {
            const isOrigin = idx === 0;
            return (
              <View key={sample.id} style={[styles.sampleCard, isOrigin && styles.originCard]}>
                <View style={styles.sampleCardHeader}>
                  <View style={styles.sampleTitleRow}>
                    <Text style={styles.sampleIndexText}>
                      {isOrigin ? 'PONTO 0 (ORIGEM)' : `AMOSTRA #${idx}`}
                    </Text>
                    {isOrigin && (
                      <View style={styles.originTag}>
                        <Text style={styles.originTagText}>REFERÊNCIA</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sampleTimeText}>{sample.time}</Text>
                </View>

                <View style={styles.sampleDetailsGrid}>
                  <View style={styles.sampleDetailItem}>
                    <Text style={styles.sampleDetailLabel}>Distância da Origem</Text>
                    <Text
                      style={[
                        styles.sampleDetailValue,
                        { color: isOrigin ? '#94A3B8' : '#38BDF8' },
                      ]}
                    >
                      {isOrigin ? '0.00 m (Origem)' : `${sample.distanceFromOrigin.toFixed(2)} m`}
                    </Text>
                  </View>

                  {!isOrigin && (
                    <View style={styles.sampleDetailItem}>
                      <Text style={styles.sampleDetailLabel}>Do Ponto Anterior</Text>
                      <Text style={[styles.sampleDetailValue, { color: '#06B6D4' }]}>
                        +{sample.distanceFromPrevious.toFixed(2)} m
                      </Text>
                    </View>
                  )}

                  <View style={styles.sampleDetailItem}>
                    <Text style={styles.sampleDetailLabel}>Precisão</Text>
                    <Text
                      style={[
                        styles.sampleDetailValue,
                        { color: getAccuracyColor(sample.accuracy) },
                      ]}
                    >
                      {sample.accuracy !== null ? `± ${sample.accuracy.toFixed(1)} m` : 'N/D'}
                    </Text>
                  </View>
                </View>

                {/* Coordenadas da amostra */}
                <Text style={styles.sampleCoordsText}>
                  Coord: {sample.latitude.toFixed(7)}, {sample.longitude.toFixed(7)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Orientações Técnicas sobre GPS Indoor no Galaxy A55 */}
      <View style={styles.guideCard}>
        <Text style={styles.guideTitle}>💡 O que esperar do teste indoor no A55 5G?</Text>
        <Text style={styles.guideText}>
          • <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Precisão Típica Indoor:</Text> Em ambientes fechados, os sinais de satélite (GPS/Galileo/GLONASS) sofrem atenuação e reflexão (multipath) pelas paredes e lajes. A precisão costuma variar entre ±10m a ±30m.
        </Text>
        <Text style={styles.guideText}>
          • <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Distinção de 3 a 5m:</Text> Para distinguir com clareza um deslocamento de 3 a 5m, a precisão estimada deve estar idealmente abaixo de ±5m. Se a margem for superior a 10m, o desvio (drift) natural do sensor pode ser maior que o próprio deslocamento físico.
        </Text>
        <Text style={styles.guideText}>
          • <Text style={{ fontWeight: '700', color: '#F8FAFC' }}>Dica:</Text> Ao caminhar de um cômodo para outro, aguarde 5 a 10 segundos antes de gravar para que o filtro de Kalman do Android estabilize a nova estimativa.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#131B2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 17,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  coordsGrid: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  coordCol: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  coordValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 2,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  waitingCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  waitingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  accuracyContainer: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  accuracyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  accuracyLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  accuracyValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  accuracyNoticeBox: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  accuracyNoticeText: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  btnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  btnActiveText: {
    color: '#10B981',
  },
  sampleActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#0B0F19',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.6,
  },
  btnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDangerText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  deltaBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  deltaTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deltaValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 2,
  },
  deltaSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  samplesSection: {
    marginBottom: 14,
  },
  samplesHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptySamplesBox: {
    backgroundColor: '#131B2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptySamplesText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 6,
  },
  emptySamplesSubtext: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  sampleCard: {
    backgroundColor: '#131B2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  originCard: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: '#101B30',
  },
  sampleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sampleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleIndexText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  originTag: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  originTagText: {
    color: '#0B0F19',
    fontSize: 9,
    fontWeight: '800',
  },
  sampleTimeText: {
    fontSize: 11,
    color: '#64748B',
  },
  sampleDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  sampleDetailItem: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 80,
  },
  sampleDetailLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  sampleDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  sampleCoordsText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginTop: 2,
  },
  guideCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 8,
  },
  guideText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 17,
    marginBottom: 6,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  statusBoxText: {
    color: '#38BDF8',
    fontSize: 12,
    flex: 1,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorBoxTitle: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  errorBoxText: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 16,
  },
});
