import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, getSignalColor } from '../theme/colors';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { ConditionBadge } from '../components/ConditionBadge';
import { Button } from '../components/Button';
import {
  IconHistory,
  IconTrash,
  IconChevronRight,
  IconWifi,
  IconClock,
} from '../components/Icons';
import type { DiagnosticRecord, ActivityMonitorReport } from '../types/snow';
import { groupDiagnosticsByPeriod } from '../services/storage';
import { analyzeTimeInstabilityPatterns } from '../services/patternAnalyzer';

interface HistoricoScreenProps {
  diagnostics: DiagnosticRecord[];
  activityReports: ActivityMonitorReport[];
  enableTimePatterns: boolean;
  onSelectDiagnostic: (record: DiagnosticRecord) => void;
  onDeleteDiagnostic: (id: string) => void;
  onClearHistory: () => void;
  onBack: () => void;
  onNewScan: () => void;
}

export function HistoricoScreen({
  diagnostics,
  activityReports,
  enableTimePatterns,
  onSelectDiagnostic,
  onDeleteDiagnostic,
  onClearHistory,
  onBack,
  onNewScan,
}: HistoricoScreenProps) {
  const grouped = groupDiagnosticsByPeriod(diagnostics);
  const patternResult = enableTimePatterns
    ? analyzeTimeInstabilityPatterns(diagnostics, activityReports)
    : null;

  const handleDeleteItem = (record: DiagnosticRecord) => {
    const ssid = record.connectedNetwork?.ssid ?? 'Diagnóstico';
    Alert.alert(
      'Excluir Análise',
      `Deseja remover esta análise de "${ssid}" (${record.dateFormatted})? Os pontos de Heatmap associados a ela também serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => onDeleteDiagnostic(record.id),
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (diagnostics.length === 0) return;
    Alert.alert(
      'Limpar Todo o Histórico',
      'Deseja apagar todas as análises salvas? Isso também limpará todos os pontos do Heatmap.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar Tudo', style: 'destructive', onPress: onClearHistory },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Histórico"
        subtitle={`${diagnostics.length} mediç${diagnostics.length === 1 ? 'ão' : 'ões'} registradas`}
        onBack={onBack}
        rightAction={
          diagnostics.length > 0
            ? {
                icon: <IconTrash size={16} color={colors.textTertiary} />,
                onPress: handleClearAll,
              }
            : undefined
        }
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Padrões de Instabilidade por Horário (exibido apenas quando há dados suficientes) */}
        {patternResult && patternResult.hasSufficientData && (
          <Card variant="glass" style={styles.patternCard}>
            <View style={styles.patternHeader}>
              <IconClock size={16} color={colors.accent} />
              <Text style={styles.patternTitle}>Padrões por Horário</Text>
            </View>
            <Text style={styles.patternSummary}>{patternResult.summary}</Text>

            <View style={styles.patternList}>
              {patternResult.insights.map((ins) => {
                const sevColor =
                  ins.severity === 'alta'
                    ? colors.danger
                    : ins.severity === 'atencao'
                    ? colors.warning
                    : colors.success;
                return (
                  <View key={ins.periodId} style={styles.patternRow}>
                    <View style={styles.patternLeft}>
                      <Text style={styles.patternPeriod}>
                        {ins.periodLabel}{' '}
                        <Text style={styles.patternHours}>({ins.hourRange})</Text>
                      </Text>
                      <Text style={styles.patternDesc}>{ins.description}</Text>
                    </View>
                    <View style={[styles.patternRateBadge, { borderColor: sevColor }]}>
                      <Text style={[styles.patternRateText, { color: sevColor }]}>
                        {ins.sampleCount}x
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {diagnostics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <IconHistory size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma Análise Registrada</Text>
            <Text style={styles.emptyDesc}>
              Inicie um diagnóstico de rede para avaliar estabilidade, latência real e interferências.
            </Text>
            <Button
              title="Iniciar Primeiro Diagnóstico"
              onPress={onNewScan}
              variant="primary"
              style={styles.emptyBtn}
            />
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.period} style={styles.periodGroup}>
              <View style={styles.periodHeader}>
                <Text style={styles.periodTitle}>{group.period}</Text>
                <View style={styles.periodLine} />
              </View>

              {group.records.map((item) => {
                const isConnected = item.isWifiConnected && item.connectedNetwork;
                const ssid = isConnected ? item.connectedNetwork!.ssid : 'Wi-Fi Desconectado';
                const rssi = isConnected ? item.connectedNetwork!.rssi : null;
                const rssiColor = getSignalColor(rssi);
                const channel =
                  isConnected && item.connectedNetwork!.channel
                    ? `CH ${item.connectedNetwork!.channel}`
                    : null;
                const ping = item.averageLatencyMs !== null ? `${item.averageLatencyMs} ms` : null;

                return (
                  <Card
                    key={item.id}
                    variant="glass"
                    style={styles.historyCard}
                    onPress={() => onSelectDiagnostic(item)}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.networkInfo}>
                        <View style={styles.ssidRow}>
                          <IconWifi size={14} color={colors.primary} />
                          <Text style={styles.ssidText} numberOfLines={1}>
                            {item.isWalkingSession ? `${ssid} (Caminhada)` : ssid}
                          </Text>
                        </View>
                        <Text style={styles.dateTimeText}>
                          {item.dateFormatted} às {item.timeFormatted}
                        </Text>
                      </View>

                      <View style={styles.topRight}>
                        <ConditionBadge condition={item.overallCondition} size="small" />
                        <TouchableOpacity
                          style={styles.trashBtn}
                          onPress={() => handleDeleteItem(item)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <IconTrash size={14} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.cardBottomRow}>
                      <View style={styles.metricBadge}>
                        <Text style={styles.metricLabel}>Sinal</Text>
                        <Text style={[styles.metricValue, { color: rssiColor }]}>
                          {rssi !== null ? `${rssi} dBm` : 'N/D'}
                        </Text>
                      </View>

                      <View style={styles.metricBadge}>
                        <Text style={styles.metricLabel}>Canal</Text>
                        <Text style={styles.metricValue}>{channel ?? 'N/D'}</Text>
                      </View>

                      <View style={styles.metricBadge}>
                        <Text style={styles.metricLabel}>Latência</Text>
                        <Text style={styles.metricValue}>{ping ?? 'N/D'}</Text>
                      </View>

                      <View style={styles.metricBadge}>
                        <Text style={styles.metricLabel}>Score</Text>
                        <Text style={styles.metricValue}>{item.score}/100</Text>
                      </View>

                      <View style={styles.arrowContainer}>
                        <IconChevronRight size={14} color={colors.textTertiary} />
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))
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
    paddingBottom: 28,
  },
  patternCard: {
    padding: 14,
    marginBottom: 18,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  patternSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  patternList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingTop: 10,
  },
  patternRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  patternLeft: {
    flex: 1,
  },
  patternPeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  patternHours: {
    fontWeight: '400',
    color: colors.textTertiary,
  },
  patternDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  patternRateBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  patternRateText: {
    fontSize: 11,
    fontWeight: '700',
  },
  periodGroup: {
    marginBottom: 18,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  periodTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  periodLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderMuted,
  },
  historyCard: {
    padding: 14,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  networkInfo: {
    flex: 1,
    marginRight: 8,
  },
  ssidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ssidText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  dateTimeText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 3,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trashBtn: {
    padding: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingTop: 10,
  },
  metricBadge: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 1,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  arrowContainer: {
    paddingLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyBtn: {
    paddingHorizontal: 24,
  },
});
