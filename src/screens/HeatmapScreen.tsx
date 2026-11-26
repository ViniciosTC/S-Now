import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, getSignalColor } from '../theme/colors';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconWalk, IconTrash } from '../components/Icons';
import {
  getStoredHeatmapPoints,
  deleteStoredHeatmapPoint,
  updateStoredDiagnostic,
} from '../services/storage';
import { runDiagnosticAnalysis } from '../services/diagnosticEngine';
import { isWifiEnabled, getCurrentNetwork, scanNetworks } from 'munim-wifi';
import * as Location from 'expo-location';
import type { DiagnosticRecord, HeatmapPoint } from '../types/snow';

interface HeatmapScreenProps {
  onBack: () => void;
  onNewScan: () => void;
  onViewDiagnostic?: (diagnosticId: string) => void;
  onDataUpdated?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function HeatmapScreen({
  onBack,
  onNewScan,
  onViewDiagnostic,
  onDataUpdated,
}: HeatmapScreenProps) {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<HeatmapPoint | null>(null);

  const [isWalkingSession, setIsWalkingSession] = useState(false);
  const [walkingStatus, setWalkingStatus] = useState<
    'idle' | 'waiting_accuracy' | 'ready_walking' | 'registered'
  >('idle');
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastRegisteredCoords = useRef<{ lat: number; lon: number } | null>(null);
  const isScanningRef = useRef(false);
  const walkingDiagnosticRef = useRef<DiagnosticRecord | null>(null);

  const loadPoints = useCallback(async () => {
    const stored = await getStoredHeatmapPoints();
    setPoints(stored);
  }, []);

  useEffect(() => {
    loadPoints();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [loadPoints]);

  const registerPointInternal = async (
    lat: number,
    lon: number,
    acc: number | null,
    pointsCount: number
  ) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setWalkingStatus('registered');
    setFeedbackMessage('Estabilizado! Medindo sinal Wi-Fi real...');

    try {
      const connected = await getCurrentNetwork();
      const scanned = await scanNetworks({ allowCached: true, timeout: 4000 }).catch(() => []);

      const isConn =
        !!connected &&
        typeof connected.ssid === 'string' &&
        connected.ssid.trim().length > 0 &&
        connected.ssid !== '<unknown ssid>' &&
        typeof connected.rssi === 'number';

      const currentRssi = isConn ? connected!.rssi! : -75;
      const currentChannel = isConn ? connected!.channel : undefined;
      const currentFreq = isConn ? connected!.frequency : undefined;
      const labelName = pointsCount === 0 ? 'Ponto Central (AP)' : `Ponto ${pointsCount + 1}`;

      let canvasX = 50;
      let canvasY = 50;
      if (pointsCount > 0) {
        const angle = (pointsCount * 65 * Math.PI) / 180;
        const radius = 22 + (pointsCount % 4) * 8;
        canvasX = Math.max(12, Math.min(88, Math.round(50 + radius * Math.cos(angle))));
        canvasY = Math.max(12, Math.min(88, Math.round(50 + radius * Math.sin(angle))));
      }

      // Garante que a sessão de caminhada pertence a um DiagnosticRecord acoplado
      if (!walkingDiagnosticRef.current) {
        const baseRecord = runDiagnosticAnalysis(
          {
            connectedNetwork: connected,
            nearbyNetworks: scanned,
            signalSamples: isConn ? [currentRssi] : [],
            internetMetrics: {
              latencySamples: [],
              averageLatencyMs: null,
              jitterMs: null,
              packetLossPercent: 0,
              dnsLatencyMs: null,
              httpLatencyMs: null,
              downloadMbps: null,
              status: 'indisponivel',
            },
            location: { latitude: lat, longitude: lon, accuracy: acc },
          },
          pointsCount
        );
        baseRecord.isWalkingSession = true;
        baseRecord.summary = 'Sessão de mapeamento caminhando.';
        baseRecord.heatmapPoints = [];
        walkingDiagnosticRef.current = baseRecord;
      }

      const diagId = walkingDiagnosticRef.current.id;
      const newPoint: HeatmapPoint = {
        id: `walk-${Date.now()}`,
        diagnosticId: diagId,
        timestamp: Date.now(),
        label: labelName,
        rssi: currentRssi,
        channel: currentChannel,
        frequency: currentFreq,
        x: canvasX,
        y: canvasY,
        latitude: lat,
        longitude: lon,
        accuracy: acc,
      };

      const updatedPoints = [...(walkingDiagnosticRef.current.heatmapPoints ?? []), newPoint];
      walkingDiagnosticRef.current = {
        ...walkingDiagnosticRef.current,
        heatmapPoints: updatedPoints,
      };

      await updateStoredDiagnostic(walkingDiagnosticRef.current);
      setPoints((prev) => [...prev, newPoint]);
      setSelectedPoint(newPoint);
      lastRegisteredCoords.current = { lat, lon };
      onDataUpdated?.();

      setFeedbackMessage(`${labelName} registrado (${currentRssi} dBm)`);
      setTimeout(() => {
        setWalkingStatus('ready_walking');
        setFeedbackMessage('Caminhe 3 a 5 metros para novo ponto...');
      }, 2000);
    } catch (err) {
      console.warn('Erro ao registrar ponto caminhando:', err);
      setWalkingStatus('ready_walking');
    } finally {
      isScanningRef.current = false;
    }
  };

  const toggleWalkingSession = async () => {
    if (isWalkingSession) {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      walkingDiagnosticRef.current = null;
      setIsWalkingSession(false);
      setWalkingStatus('idle');
      setFeedbackMessage(null);
      Alert.alert('Sessão Concluída', 'Mapeamento caminhando finalizado e salvo.');
    } else {
      const wifiOn = await isWifiEnabled();
      if (!wifiOn) {
        Alert.alert('Wi-Fi desligado', 'Ative o Wi-Fi do aparelho antes de iniciar o mapeamento.');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Permissão necessária', 'Permita o acesso à localização precisa para mapear caminhando.');
        return;
      }

      walkingDiagnosticRef.current = null;
      setIsWalkingSession(true);
      setWalkingStatus('waiting_accuracy');
      setFeedbackMessage('Aguardando sinal GPS estabilizar...');
      lastRegisteredCoords.current = null;

      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1500,
            distanceInterval: 1,
          },
          (loc) => {
            const acc = loc.coords.accuracy ?? null;
            setCurrentAccuracy(acc);

            const isAccAcceptable = acc !== null && acc <= 18;
            if (!isAccAcceptable) {
              setWalkingStatus('waiting_accuracy');
              setFeedbackMessage(
                `Aguardando precisão aceitável (atual: ±${acc?.toFixed(0) ?? '?'}m)...`
              );
              return;
            }

            if (!lastRegisteredCoords.current) {
              setPoints((currentPoints) => {
                registerPointInternal(
                  loc.coords.latitude,
                  loc.coords.longitude,
                  acc,
                  currentPoints.length
                );
                return currentPoints;
              });
              return;
            }

            const dist = calculateDistanceMeters(
              lastRegisteredCoords.current.lat,
              lastRegisteredCoords.current.lon,
              loc.coords.latitude,
              loc.coords.longitude
            );

            if (dist >= 3.0 && !isScanningRef.current) {
              setPoints((currentPoints) => {
                registerPointInternal(
                  loc.coords.latitude,
                  loc.coords.longitude,
                  acc,
                  currentPoints.length
                );
                return currentPoints;
              });
            } else if (!isScanningRef.current) {
              setWalkingStatus('ready_walking');
              setFeedbackMessage(`Caminhando... Deslocamento: ${dist.toFixed(1)}m (mínimo 3m)`);
            }
          }
        );

        locationSubscription.current = sub;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Erro no GPS', msg);
        setIsWalkingSession(false);
      }
    }
  };

  const handleDeletePoint = (point: HeatmapPoint) => {
    Alert.alert(
      'Excluir Ponto',
      `Deseja excluir o "${point.label}" (${point.rssi} dBm)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteStoredHeatmapPoint(point.id);
            const remaining = points.filter((p) => p.id !== point.id);
            setPoints(remaining);
            if (selectedPoint?.id === point.id) {
              setSelectedPoint(null);
            }
            onDataUpdated?.();
            if (remaining.length === 0) {
              onBack();
            }
          },
        },
      ]
    );
  };

  const CANVAS_WIDTH = SCREEN_WIDTH - 44;
  const CANVAS_HEIGHT = 280;

  const calculateSelectedDistance = (): string | null => {
    if (!selectedPoint || !selectedPoint.latitude || !selectedPoint.longitude) return null;
    const firstPoint = points[0];
    if (
      firstPoint &&
      firstPoint.id !== selectedPoint.id &&
      firstPoint.latitude &&
      firstPoint.longitude
    ) {
      const d = calculateDistanceMeters(
        firstPoint.latitude,
        firstPoint.longitude,
        selectedPoint.latitude,
        selectedPoint.longitude
      );
      return `${d.toFixed(1)}m do AP`;
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Heatmap Conceitual"
        subtitle="Distribuição RF acoplada aos diagnósticos"
        onBack={onBack}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {isWalkingSession && (
          <View style={styles.sessionBanner}>
            <View style={styles.sessionHeaderRow}>
              <View style={styles.sessionIndicatorRow}>
                <View
                  style={[
                    styles.sessionDot,
                    {
                      backgroundColor:
                        walkingStatus === 'registered'
                          ? colors.primary
                          : walkingStatus === 'ready_walking'
                          ? colors.success
                          : colors.warning,
                    },
                  ]}
                />
                <Text style={styles.sessionTitle}>Mapeamento Caminhando Ativo</Text>
              </View>
              {currentAccuracy !== null && (
                <Text style={styles.sessionAccText}>Precisão: ±{Math.round(currentAccuracy)}m</Text>
              )}
            </View>
            <Text style={styles.sessionStatusText}>
              {feedbackMessage ?? 'Caminhe pelo ambiente para registrar medições continuadas.'}
            </Text>
          </View>
        )}

        <Card variant="glass" style={styles.canvasCard}>
          <View style={styles.canvasHeader}>
            <View>
              <Text style={styles.canvasTitle}>Espaço Conceitual RF</Text>
              <Text style={styles.canvasSubtitle}>Interpolação orgânica por proximidade espacial</Text>
            </View>
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>{points.length} pontos</Text>
            </View>
          </View>

          <View style={styles.svgWrapper}>
            <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={styles.svg}>
              <Defs>
                {points.map((p, i) => {
                  const color = getSignalColor(p.rssi);
                  return (
                    <RadialGradient
                      key={`grad-${p.id || i}`}
                      id={`heatGrad-${i}`}
                      cx="50%"
                      cy="50%"
                      r="50%"
                    >
                      <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
                      <Stop offset="50%" stopColor={color} stopOpacity="0.18" />
                      <Stop offset="100%" stopColor={color} stopOpacity="0" />
                    </RadialGradient>
                  );
                })}
              </Defs>

              <Rect
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill={colors.backgroundSecondary}
                rx="14"
              />

              {points.map((p1, idx1) => {
                const x1 = (p1.x / 100) * CANVAS_WIDTH;
                const y1 = (p1.y / 100) * CANVAS_HEIGHT;

                return points.slice(idx1 + 1).map((p2, idx2) => {
                  const x2 = (p2.x / 100) * CANVAS_WIDTH;
                  const y2 = (p2.y / 100) * CANVAS_HEIGHT;
                  const dist = Math.hypot(x2 - x1, y2 - y1);

                  if (dist < 140) {
                    const opacity = Math.max(0.12, (1 - dist / 140) * 0.45);
                    return (
                      <Line
                        key={`line-${idx1}-${idx2}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={colors.tealLight}
                        strokeWidth="1.5"
                        strokeOpacity={opacity}
                        strokeDasharray="4 3"
                      />
                    );
                  }
                  return null;
                });
              })}

              {points.map((p, i) => {
                const cx = (p.x / 100) * CANVAS_WIDTH;
                const cy = (p.y / 100) * CANVAS_HEIGHT;
                const uncertaintyRadius = Math.max(32, Math.min(68, (p.accuracy ?? 8) * 3));

                return (
                  <Circle
                    key={`halo-${p.id || i}`}
                    cx={cx}
                    cy={cy}
                    r={uncertaintyRadius}
                    fill={`url(#heatGrad-${i})`}
                  />
                );
              })}

              {points.map((p, i) => {
                const cx = (p.x / 100) * CANVAS_WIDTH;
                const cy = (p.y / 100) * CANVAS_HEIGHT;
                const isSelected = selectedPoint?.id === p.id;
                const markerColor = getSignalColor(p.rssi);
                const isAp = i === 0;

                return (
                  <G key={`marker-${p.id || i}`} onPress={() => setSelectedPoint(p)}>
                    {isSelected && (
                      <Circle
                        cx={cx}
                        cy={cy}
                        r="16"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        fill="none"
                        opacity={0.8}
                      />
                    )}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={isAp ? 11 : 9}
                      fill={markerColor}
                      stroke={colors.background}
                      strokeWidth="2"
                    />
                    <SvgText
                      x={cx}
                      y={cy + 19}
                      fontSize="9"
                      fill={colors.textSecondary}
                      textAnchor="middle"
                      fontWeight={isAp ? '700' : '500'}
                    >
                      {isAp ? 'AP' : `${p.rssi}`}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </View>
        </Card>

        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Escala Técnica RF (dBm)</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.signalScale.excellent }]} />
              <Text style={styles.legendLabel}>≥ -50</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.signalScale.good }]} />
              <Text style={styles.legendLabel}>-60</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.signalScale.fair }]} />
              <Text style={styles.legendLabel}>-70</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.signalScale.weak }]} />
              <Text style={styles.legendLabel}>-80</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.signalScale.critical }]} />
              <Text style={styles.legendLabel}>&lt; -80</Text>
            </View>
          </View>
        </View>

        {selectedPoint && (
          <Card variant="glass" style={styles.pointDetailCard}>
            <View style={styles.pointDetailHeader}>
              <View style={styles.pointDetailTitleRow}>
                <View
                  style={[
                    styles.pointDetailIndicator,
                    { backgroundColor: getSignalColor(selectedPoint.rssi) },
                  ]}
                />
                <Text style={styles.pointDetailLabel}>{selectedPoint.label}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedPoint(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.closeText}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pointDetailGrid}>
              <View style={styles.pointDetailItem}>
                <Text style={styles.detailItemLabel}>Sinal (RSSI)</Text>
                <Text
                  style={[
                    styles.detailItemValue,
                    { color: getSignalColor(selectedPoint.rssi) },
                  ]}
                >
                  {selectedPoint.rssi} dBm
                </Text>
              </View>

              <View style={styles.pointDetailItem}>
                <Text style={styles.detailItemLabel}>Canal & Freq</Text>
                <Text style={styles.detailItemValue}>
                  {selectedPoint.channel ? `CH ${selectedPoint.channel}` : 'N/D'} •{' '}
                  {selectedPoint.frequency ? `${selectedPoint.frequency} MHz` : '2.4G'}
                </Text>
              </View>

              <View style={styles.pointDetailItem}>
                <Text style={styles.detailItemLabel}>Distância Est.</Text>
                <Text style={styles.detailItemValue}>
                  {calculateSelectedDistance() ?? 'Ponto de Origem'}
                </Text>
              </View>
            </View>

            <View style={styles.pointActionsRow}>
              {selectedPoint.diagnosticId && onViewDiagnostic ? (
                <Button
                  title="Ver Diagnóstico Completo"
                  onPress={() => onViewDiagnostic(selectedPoint.diagnosticId)}
                  variant="secondary"
                  size="small"
                  style={styles.pointBtn}
                />
              ) : null}

              <Button
                title="Excluir Ponto"
                onPress={() => handleDeletePoint(selectedPoint)}
                variant="danger"
                size="small"
                icon={<IconTrash size={14} color={colors.danger} />}
                style={styles.deletePointBtn}
              />
            </View>
          </Card>
        )}

        <View style={styles.bottomActions}>
          <Button
            title={
              isWalkingSession
                ? 'Encerrar Mapeamento Caminhando'
                : 'Iniciar Mapeamento Caminhando'
            }
            onPress={toggleWalkingSession}
            variant={isWalkingSession ? 'accent' : 'primary'}
            icon={<IconWalk size={16} color="#FFFFFF" />}
            style={styles.actionBtn}
          />

          <Button
            title="Realizar Nova Medição Local"
            onPress={onNewScan}
            variant="secondary"
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
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
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sessionBanner: {
    backgroundColor: 'rgba(27, 56, 74, 0.45)',
    borderWidth: 1,
    borderColor: colors.tealLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sessionAccText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sessionStatusText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  canvasCard: {
    padding: 14,
    marginBottom: 12,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  canvasTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  canvasSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  pointsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pointsBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  svg: {
    borderRadius: 14,
  },
  legendContainer: {
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pointDetailCard: {
    padding: 14,
    marginBottom: 14,
  },
  pointDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pointDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointDetailIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointDetailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  pointDetailGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  pointDetailItem: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  detailItemValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pointActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  pointBtn: {
    flex: 1,
  },
  deletePointBtn: {
    paddingHorizontal: 12,
  },
  bottomActions: {
    gap: 8,
  },
  actionBtn: {
    width: '100%',
  },
});
