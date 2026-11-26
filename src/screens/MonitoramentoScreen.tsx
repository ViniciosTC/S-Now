import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SignalChart } from '../components/SignalChart';
import { IconActivity, IconClock, IconWifi } from '../components/Icons';
import {
  ACTIVITY_LABELS,
  startActivityMonitoring,
  stopActivityMonitoring,
  getOngoingActivitySession,
  subscribeActivitySession,
  type ActiveMonitorSession,
} from '../services/activityMonitor';
import { saveStoredActivityReport } from '../services/storage';
import type { ActivityType, ActivityMonitorReport } from '../types/snow';

interface MonitoramentoScreenProps {
  reports: ActivityMonitorReport[];
  onReportSaved: (report: ActivityMonitorReport) => void;
  onBack: () => void;
}

const ACTIVITIES: { id: ActivityType; title: string; subtitle: string }[] = [
  { id: 'jogos', title: 'Jogos Online', subtitle: 'Foco em latência, jitter e micro-quedas' },
  { id: 'chamadas', title: 'Chamadas de Vídeo/Voz', subtitle: 'Estabilidade bidirecional e perda de pacotes' },
  { id: 'streaming', title: 'Streaming de Vídeo', subtitle: 'Continuidade de enlace e interrupções' },
  { id: 'navegacao', title: 'Navegação Geral', subtitle: 'Tempo de resposta HTTP e oscilação de sinal' },
  { id: 'outra', title: 'Outra Atividade', subtitle: 'Monitoramento contínuo genérico de rede' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function MonitoramentoScreen({
  reports,
  onReportSaved,
  onBack,
}: MonitoramentoScreenProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('jogos');
  const [activeSession, setActiveSession] = useState<ActiveMonitorSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latestReport, setLatestReport] = useState<ActivityMonitorReport | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    getOngoingActivitySession().then((session) => {
      if (session) {
        setActiveSession(session);
        setElapsedSeconds(Math.max(0, Math.round((Date.now() - session.startTime) / 1000)));
      }
    });

    const unsub = subscribeActivitySession((updated) => {
      setActiveSession(updated);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - activeSession.startTime) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const handleStart = async () => {
    setIsStarting(true);
    setLatestReport(null);
    try {
      const session = await startActivityMonitoring(selectedActivity);
      setActiveSession(session);
      setElapsedSeconds(0);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    const report = await stopActivityMonitoring();
    setActiveSession(null);
    setElapsedSeconds(0);
    if (report) {
      await saveStoredActivityReport(report);
      setLatestReport(report);
      onReportSaved(report);
    }
  };

  const chartWidth = SCREEN_WIDTH - 72;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Monitoramento por Atividade"
        subtitle="Coleta de rede em segundo plano"
        onBack={onBack}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Sessão Ativa */}
        {activeSession ? (
          <Card variant="glass" style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeTitle}>
                Monitorando: {activeSession.activityLabel}
              </Text>
            </View>

            <Text style={styles.timerText}>{formatDuration(elapsedSeconds)}</Text>

            <Text style={styles.bgNote}>
              {activeSession.backgroundModeUsed
                ? 'Serviço em segundo plano ativo (notificação persistente). Você pode abrir outros aplicativos normalmente.'
                : 'Coletando em primeiro plano. Mantenha o app aberto ou conceda localização "Sempre" para coleta em segundo plano.'}
            </Text>

            <View style={styles.liveGrid}>
              <View style={styles.liveItem}>
                <Text style={styles.liveLabel}>Rede</Text>
                <Text style={styles.liveValue} numberOfLines={1}>
                  {activeSession.ssid ?? 'Desconectado'}
                </Text>
              </View>
              <View style={styles.liveItem}>
                <Text style={styles.liveLabel}>Sondagens</Text>
                <Text style={styles.liveValue}>{activeSession.totalProbes}</Text>
              </View>
              <View style={styles.liveItem}>
                <Text style={styles.liveLabel}>Última Latência</Text>
                <Text style={styles.liveValue}>
                  {activeSession.latencySamples.length > 0
                    ? `${activeSession.latencySamples[activeSession.latencySamples.length - 1]} ms`
                    : '--'}
                </Text>
              </View>
              <View style={styles.liveItem}>
                <Text style={styles.liveLabel}>Interrupções</Text>
                <Text
                  style={[
                    styles.liveValue,
                    { color: activeSession.interruptionsCount > 0 ? colors.warning : colors.success },
                  ]}
                >
                  {activeSession.interruptionsCount}
                </Text>
              </View>
            </View>

            <Button
              title="Parar e Gerar Relatório"
              onPress={handleStop}
              variant="accent"
              style={styles.stopBtn}
            />
          </Card>
        ) : (
          <>
            {/* Seleção de Atividade */}
            <Text style={styles.sectionTitle}>ESCOLHA A ATIVIDADE</Text>
            <View style={styles.activityList}>
              {ACTIVITIES.map((act) => {
                const isSelected = selectedActivity === act.id;
                return (
                  <TouchableOpacity
                    key={act.id}
                    style={[styles.activityItem, isSelected && styles.activityItemSelected]}
                    onPress={() => setSelectedActivity(act.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.activityTextCol}>
                      <Text style={styles.activityTitle}>{act.title}</Text>
                      <Text style={styles.activitySubtitle}>{act.subtitle}</Text>
                    </View>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.disclaimerText}>
              O S-Now mede exclusivamente parâmetros da conexão (latência, jitter, perda e sinal) durante o uso de outros apps, sem acessar dados internos ou FPS de terceiros.
            </Text>

            <Button
              title="Iniciar Monitoramento"
              onPress={handleStart}
              loading={isStarting}
              variant="primary"
              icon={<IconActivity size={16} color="#FFFFFF" />}
              style={styles.startBtn}
            />
          </>
        )}

        {/* Relatório recém-gerado */}
        {latestReport && (
          <View style={styles.reportSection}>
            <Text style={styles.sectionTitle}>RELATÓRIO DA SESSÃO</Text>
            <Card variant="glass" style={styles.reportCard}>
              <View style={styles.reportTopRow}>
                <View>
                  <Text style={styles.reportTitle}>{latestReport.activityLabel}</Text>
                  <Text style={styles.reportMeta}>
                    Duração: {formatDuration(latestReport.durationSeconds)} •{' '}
                    {latestReport.ssid ?? 'Rede N/D'}
                  </Text>
                </View>
                <View style={styles.stabilityBadge}>
                  <Text style={styles.stabilityText}>
                    {latestReport.stabilityPercent}% estável
                  </Text>
                </View>
              </View>

              <Text style={styles.verdictText}>{latestReport.verdict}</Text>

              <View style={styles.reportGrid}>
                <View style={styles.reportMetric}>
                  <Text style={styles.liveLabel}>Latência Média</Text>
                  <Text style={styles.liveValue}>
                    {latestReport.averageLatencyMs !== null
                      ? `${latestReport.averageLatencyMs} ms`
                      : 'N/D'}
                  </Text>
                </View>
                <View style={styles.reportMetric}>
                  <Text style={styles.liveLabel}>Jitter</Text>
                  <Text style={styles.liveValue}>
                    {latestReport.jitterMs !== null ? `±${latestReport.jitterMs} ms` : 'N/D'}
                  </Text>
                </View>
                <View style={styles.reportMetric}>
                  <Text style={styles.liveLabel}>Perda</Text>
                  <Text style={styles.liveValue}>{latestReport.packetLossPercent}%</Text>
                </View>
                <View style={styles.reportMetric}>
                  <Text style={styles.liveLabel}>Interrupções</Text>
                  <Text style={styles.liveValue}>{latestReport.interruptionsCount}</Text>
                </View>
              </View>

              {latestReport.latencySamples.length > 1 && (
                <View style={styles.chartBox}>
                  <SignalChart
                    samples={latestReport.latencySamples}
                    type="latency"
                    width={chartWidth}
                    height={95}
                    title="Latência durante a atividade (ms)"
                  />
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Histórico de Sessões Anteriores */}
        {reports.length > 0 && !activeSession && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>SESSÕES ANTERIORES</Text>
            {reports.slice(0, 6).map((r) => (
              <Card key={r.id} variant="glass" style={styles.pastCard}>
                <View style={styles.pastRow}>
                  <View style={styles.pastLeft}>
                    <View style={styles.pastTitleRow}>
                      <IconClock size={13} color={colors.primary} />
                      <Text style={styles.pastTitle}>{r.activityLabel}</Text>
                    </View>
                    <Text style={styles.pastMeta}>
                      {new Date(r.startTime).toLocaleDateString('pt-BR')} •{' '}
                      {formatDuration(r.durationSeconds)} •{' '}
                      {r.averageLatencyMs !== null ? `${r.averageLatencyMs} ms` : 'N/D'} •{' '}
                      {r.packetLossPercent}% perda
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pastStability,
                      {
                        color:
                          r.stabilityPercent >= 80
                            ? colors.success
                            : r.stabilityPercent >= 60
                            ? colors.warning
                            : colors.danger,
                      },
                    ]}
                  >
                    {r.stabilityPercent}%
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
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
    paddingTop: 14,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },
  activityList: {
    gap: 8,
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  activityItemSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200, 98, 55, 0.12)',
  },
  activityTextCol: {
    flex: 1,
    marginRight: 10,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activitySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 16,
    marginBottom: 14,
  },
  startBtn: {
    width: '100%',
    marginBottom: 20,
  },
  activeCard: {
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  activeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
    marginVertical: 6,
  },
  bgNote: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingTop: 12,
    marginBottom: 16,
    gap: 10,
  },
  liveItem: {
    width: '47%',
  },
  liveLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  liveValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stopBtn: {
    width: '100%',
  },
  reportSection: {
    marginTop: 4,
    marginBottom: 18,
  },
  reportCard: {
    padding: 16,
  },
  reportTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportMeta: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  stabilityBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  stabilityText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  verdictText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  reportGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingTop: 10,
  },
  reportMetric: {
    flex: 1,
  },
  chartBox: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  historySection: {
    marginTop: 6,
  },
  pastCard: {
    padding: 12,
    marginBottom: 8,
  },
  pastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pastLeft: {
    flex: 1,
    marginRight: 10,
  },
  pastTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pastMeta: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 3,
  },
  pastStability: {
    fontSize: 14,
    fontWeight: '700',
  },
});
