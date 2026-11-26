import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { PulseRadar } from '../components/PulseRadar';
import { Button } from '../components/Button';
import {
  isWifiEnabled,
  requestWifiPermission,
  scanNetworks,
  getCurrentNetwork,
  type CurrentNetworkInfo,
  type WifiNetwork,
} from 'munim-wifi';
import { runDiagnosticAnalysis } from '../services/diagnosticEngine';
import { probeInternetMetrics, type ProbeResult } from '../services/networkProber';
import { sampleStabilizedLocation, type StabilizedLocation } from '../services/gpsSampler';
import {
  saveStoredDiagnostic,
  getStoredHeatmapPoints,
  getStoredSettings,
} from '../services/storage';
import type { DiagnosticRecord } from '../types/snow';
import { IconAlertTriangle } from '../components/Icons';

type DiagnosticState = 'verificacao' | 'coleta' | 'processamento' | 'falha';

interface DiagnosticoScreenProps {
  onComplete: (record: DiagnosticRecord) => void;
  onCancel: () => void;
}

const TOTAL_COLLECTION_SECONDS = 30;
const SAMPLE_INTERVAL_MS = 2500;

export function DiagnosticoScreen({ onComplete, onCancel }: DiagnosticoScreenProps) {
  const [state, setState] = useState<DiagnosticState>('verificacao');
  const [statusText, setStatusText] = useState('Verificando rádios e permissões...');
  const [detailText, setDetailText] = useState('Consultando subsistema Wi-Fi do dispositivo');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentRssi, setCurrentRssi] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [livePing, setLivePing] = useState<number | null>(null);
  const [connectedSsid, setConnectedSsid] = useState<string | null>(null);

  const isCancelledRef = useRef(false);
  const isFinishingRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signalSamplesRef = useRef<number[]>([]);
  const latestConnectedRef = useRef<CurrentNetworkInfo | null>(null);
  const nearbyNetworksRef = useRef<WifiNetwork[]>([]);
  const internetMetricsRef = useRef<ProbeResult | null>(null);
  const locationPromiseRef = useRef<Promise<StabilizedLocation | null> | null>(null);

  const finishCollection = useCallback(async () => {
    if (isFinishingRef.current || isCancelledRef.current) return;
    isFinishingRef.current = true;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);

    setState('processamento');
    setStatusText('Processando correlação de RF, Internet e Segurança...');
    setDetailText('Consolidando amostras estabilizadas');

    try {
      const [internetMetrics, stabilizedLocation, existingPoints, settings] =
        await Promise.all([
          internetMetricsRef.current
            ? Promise.resolve(internetMetricsRef.current)
            : probeInternetMetrics(3).catch(() => ({
                latencySamples: [],
                averageLatencyMs: null,
                jitterMs: null,
                packetLossPercent: 100,
                dnsLatencyMs: null,
                httpLatencyMs: null,
                downloadMbps: null,
                status: 'indisponivel' as const,
              })),
          locationPromiseRef.current ?? Promise.resolve(null),
          getStoredHeatmapPoints(),
          getStoredSettings(),
        ]);

      const record = runDiagnosticAnalysis(
        {
          connectedNetwork: latestConnectedRef.current,
          nearbyNetworks: nearbyNetworksRef.current,
          signalSamples: signalSamplesRef.current,
          internetMetrics,
          location: stabilizedLocation,
          minRssiThreshold: settings.minRssiThreshold,
        },
        existingPoints.length
      );

      // Persistência única acoplada (o ponto de Heatmap pertence ao DiagnosticRecord)
      await saveStoredDiagnostic(record);

      setTimeout(() => {
        if (!isCancelledRef.current) {
          onComplete(record);
        }
      }, 450);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState('falha');
      setErrorMessage(msg);
      setStatusText('Erro ao consolidar diagnóstico');
      setDetailText('Houve uma falha durante o processamento das amostras');
    }
  }, [onComplete]);

  const startDiagnosticCycle = useCallback(async () => {
    setState('verificacao');
    setErrorMessage(null);
    setElapsedSeconds(0);
    setSampleCount(0);
    signalSamplesRef.current = [];
    isFinishingRef.current = false;
    isCancelledRef.current = false;

    try {
      const wifiOn = await isWifiEnabled();
      if (!wifiOn) {
        throw new Error(
          'O Wi-Fi está desativado. Ative o Wi-Fi nas configurações do sistema para iniciar o diagnóstico.'
        );
      }

      const hasPermission = await requestWifiPermission();
      if (!hasPermission) {
        throw new Error('Permissões de Wi-Fi e Localização não foram concedidas.');
      }

      const settings = await getStoredSettings();

      const initialNet = await getCurrentNetwork();
      latestConnectedRef.current = initialNet;

      if (initialNet && initialNet.ssid && initialNet.ssid !== '<unknown ssid>') {
        setConnectedSsid(initialNet.ssid);
        if (typeof initialNet.rssi === 'number') {
          setCurrentRssi(initialNet.rssi);
          signalSamplesRef.current.push(initialNet.rssi);
          setSampleCount(1);
        }
      }

      setState('coleta');
      setStatusText('Iniciando janela de amostragem RF...');
      setDetailText('Avaliando latência real, segurança e oscilação de sinal');

      // Sondagem real de internet (DNS, HTTP, RTT, Jitter e throughput leve)
      probeInternetMetrics(5)
        .then((result) => {
          internetMetricsRef.current = result;
          if (result.averageLatencyMs !== null) {
            setLivePing(Math.round(result.averageLatencyMs));
          }
        })
        .catch(() => {});

      // Varredura complementar de redes próximas (para canais e capabilities de segurança)
      scanNetworks({ allowCached: true, timeout: 8000 })
        .then((nets) => {
          nearbyNetworksRef.current = nets ?? [];
        })
        .catch(() => {});

      // Amostragem GPS de alta precisão com múltiplas leituras e filtro de acurácia
      if (settings.enableGpsOnScan) {
        locationPromiseRef.current = sampleStabilizedLocation({
          maxWaitMs: 9000,
          maxSamples: 5,
          maxAcceptableAccuracyMeters: 25,
        });
      } else {
        locationPromiseRef.current = Promise.resolve(null);
      }

      let seconds = 0;
      timerIntervalRef.current = setInterval(() => {
        seconds += 1;
        setElapsedSeconds(seconds);

        if (seconds < 8) {
          setStatusText('Sondando latência externa, DNS e HTTP...');
          setDetailText('Medindo tempo de resposta real e estabilizando GPS');
        } else if (seconds < 18) {
          setStatusText('Monitorando estabilidade do sinal Wi-Fi...');
          setDetailText('Calculando dispersão de dBm e link rate negociado');
        } else if (seconds < 28) {
          setStatusText('Analisando concorrência de canal e segurança...');
          setDetailText('Verificando criptografia, protocolo e redes vizinhas');
        } else {
          setStatusText('Consolidando diagnóstico...');
          setDetailText('Preparando índice de saúde Wi-Fi e Internet');
        }

        if (seconds >= TOTAL_COLLECTION_SECONDS) {
          finishCollection();
        }
      }, 1000);

      sampleIntervalRef.current = setInterval(async () => {
        try {
          const current = await getCurrentNetwork();
          if (current) {
            latestConnectedRef.current = current;
            if (current.ssid && current.ssid !== '<unknown ssid>') {
              setConnectedSsid(current.ssid);
            }
            if (typeof current.rssi === 'number') {
              setCurrentRssi(current.rssi);
              signalSamplesRef.current.push(current.rssi);
              setSampleCount(signalSamplesRef.current.length);
            }
          }
        } catch {
          // Ignora falha pontual na amostra
        }
      }, SAMPLE_INTERVAL_MS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState('falha');
      setErrorMessage(msg);
      setStatusText('Falha ao iniciar diagnóstico');
      setDetailText('Verifique se o Wi-Fi está ligado e conceda permissão');
    }
  }, [finishCollection]);

  useEffect(() => {
    startDiagnosticCycle();

    return () => {
      isCancelledRef.current = true;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
    };
  }, [startDiagnosticCycle]);

  const handleCancel = () => {
    isCancelledRef.current = true;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
    onCancel();
  };

  const canEarlyFinish = elapsedSeconds >= 8 && sampleCount >= 2;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Diagnóstico S-Now"
        subtitle="Medição de estabilidade em tempo real"
        onBack={handleCancel}
      />

      <View style={styles.container}>
        <View style={styles.radarContainer}>
          <PulseRadar
            size={200}
            active={state === 'coleta' || state === 'processamento'}
            color={state === 'falha' ? colors.danger : colors.primary}
          />

          {state === 'coleta' && (
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>
                {elapsedSeconds}s / {TOTAL_COLLECTION_SECONDS}s
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={[styles.statusText, state === 'falha' && styles.errorStatus]}>
            {statusText}
          </Text>
          <Text style={styles.detailText}>{detailText}</Text>

          {state === 'coleta' && (
            <View style={styles.liveMetricsCard}>
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Rede Conectada</Text>
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {connectedSsid ?? 'Consultando...'}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Sinal Atual</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: currentRssi ? colors.signalScale.good : colors.textSecondary },
                    ]}
                  >
                    {currentRssi !== null ? `${currentRssi} dBm` : '--'}
                  </Text>
                </View>
              </View>

              <View style={[styles.metricRow, { marginTop: 10 }]}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Amostras Coletadas</Text>
                  <Text style={styles.metricValue}>{sampleCount}</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Latência Média</Text>
                  <Text style={styles.metricValue}>
                    {livePing !== null ? `${livePing} ms` : 'Testando...'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {state === 'falha' && errorMessage && (
            <View style={styles.errorBox}>
              <IconAlertTriangle size={18} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionContainer}>
          {state === 'coleta' && (
            <Button
              title="Concluir Coleta Antecipadamente"
              onPress={finishCollection}
              variant="secondary"
              disabled={!canEarlyFinish}
              style={styles.actionBtn}
            />
          )}

          {state === 'falha' && (
            <Button
              title="Tentar Novamente"
              onPress={startDiagnosticCycle}
              variant="primary"
              style={styles.actionBtn}
            />
          )}

          <Button
            title="Cancelar"
            onPress={handleCancel}
            variant="ghost"
            style={styles.cancelBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    justifyContent: 'space-between',
  },
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    position: 'relative',
  },
  timeBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  timeBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  errorStatus: {
    color: colors.danger,
  },
  liveMetricsCard: {
    width: '100%',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
    lineHeight: 16,
  },
  actionContainer: {
    gap: 8,
  },
  actionBtn: {
    width: '100%',
  },
  cancelBtn: {
    paddingVertical: 10,
  },
});
