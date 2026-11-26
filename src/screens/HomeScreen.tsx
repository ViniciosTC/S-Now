import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
  Dimensions,
} from 'react-native';
import { colors } from '../theme/colors';
import { Waveform } from '../components/Waveform';
import { ConditionBadge } from '../components/ConditionBadge';
import {
  IconSettings,
  IconHistory,
  IconHeatmap,
  IconChevronRight,
  IconWifi,
  IconActivity,
} from '../components/Icons';
import type { DiagnosticRecord } from '../types/snow';

interface HomeScreenProps {
  latestDiagnostic: DiagnosticRecord | null;
  diagnosticCount: number;
  heatmapPointsCount: number;
  onStartDiagnostic: () => void;
  onOpenHistory: () => void;
  onOpenHeatmap: () => void;
  onOpenMonitor: () => void;
  onOpenSettings: () => void;
  onOpenLatest?: () => void;
}

const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function HomeScreen({
  latestDiagnostic,
  diagnosticCount,
  heatmapPointsCount,
  onStartDiagnostic,
  onOpenHistory,
  onOpenHeatmap,
  onOpenMonitor,
  onOpenSettings,
  onOpenLatest,
}: HomeScreenProps) {
  const hasHistory = !!latestDiagnostic;
  const hasHeatmapPoints = heatmapPointsCount > 0;

  const connectedSsid = latestDiagnostic?.connectedNetwork?.ssid ?? 'Rede Wi-Fi';
  const currentRssi = latestDiagnostic?.connectedNetwork?.rssi ?? -65;
  const signalVariation = latestDiagnostic?.signalVariation ?? 2;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Topo S-Now */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>S-Now</Text>
            <Text style={styles.brandSubtitle}>Diagnóstico de Rede & RF</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={onOpenSettings}
            activeOpacity={0.7}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <IconSettings size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Seção Central */}
        <View style={styles.centerSection}>
          <View style={styles.waveContainer}>
            <Waveform
              rssi={hasHistory ? currentRssi : -60}
              variation={hasHistory ? signalVariation : 3}
              width={SCREEN_WIDTH - 48}
              height={105}
            />
            {hasHistory && (
              <View style={styles.waveLegend}>
                <View style={styles.waveDot} />
                <Text style={styles.waveLegendText}>
                  {currentRssi} dBm • oscilação ±{signalVariation.toFixed(1)} dB
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.mainStartButton}
            onPress={onStartDiagnostic}
            activeOpacity={0.85}
          >
            <Text style={styles.mainStartButtonText}>
              {hasHistory ? 'Iniciar Nova Análise' : 'Iniciar Diagnóstico'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.tapInstruction}>
            {hasHistory
              ? 'Mede Wi-Fi, Internet, segurança e cobertura espacial'
              : 'Varredura profunda de 30s para análise de rede, latência e segurança'}
          </Text>
        </View>

        {/* Seção Inferior */}
        <View style={styles.bottomSection}>
          {hasHistory && (
            <TouchableOpacity
              style={styles.lastScanCard}
              onPress={onOpenLatest ?? onOpenHistory}
              activeOpacity={0.75}
            >
              <View style={styles.lastScanLeft}>
                <IconWifi size={16} color={colors.primary} />
                <View style={styles.lastScanInfo}>
                  <Text style={styles.lastScanSsid} numberOfLines={1}>
                    {connectedSsid}
                  </Text>
                  <Text style={styles.lastScanMeta}>
                    Última análise • {latestDiagnostic.timeFormatted}
                  </Text>
                </View>
              </View>
              <View style={styles.lastScanRight}>
                <ConditionBadge condition={latestDiagnostic.overallCondition} size="small" />
                <IconChevronRight size={14} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.optionsRow}>
            {hasHistory && (
              <TouchableOpacity
                style={styles.essentialOption}
                onPress={onOpenHistory}
                activeOpacity={0.75}
              >
                <View style={styles.optionLeft}>
                  <IconHistory size={16} color={colors.tealLight} />
                  <Text style={styles.optionTitle}>Histórico</Text>
                  <Text style={styles.optionCount}>{diagnosticCount}</Text>
                </View>
                <IconChevronRight size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* Regra: Sem pontos, ocultar o acesso ao Heatmap */}
            {hasHeatmapPoints && (
              <TouchableOpacity
                style={styles.essentialOption}
                onPress={onOpenHeatmap}
                activeOpacity={0.75}
              >
                <View style={styles.optionLeft}>
                  <IconHeatmap size={16} color={colors.tealLight} />
                  <Text style={styles.optionTitle}>Heatmap</Text>
                  <Text style={styles.optionCount}>{heatmapPointsCount}</Text>
                </View>
                <IconChevronRight size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* Nova Feature: Monitoramento por Atividade */}
            <TouchableOpacity
              style={styles.essentialOption}
              onPress={onOpenMonitor}
              activeOpacity={0.75}
            >
              <View style={styles.optionLeft}>
                <IconActivity size={16} color={colors.accent} />
                <Text style={styles.optionTitle}>Monitorar Atividade</Text>
              </View>
              <IconChevronRight size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 22,
    paddingTop: ANDROID_STATUS_BAR + (Platform.OS === 'android' ? 12 : 8),
    paddingBottom: Platform.OS === 'android' ? 20 : 16,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  brandSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    letterSpacing: -0.1,
  },
  settingsBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  waveContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  waveLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  waveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  waveLegendText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  mainStartButton: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: 16,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 10,
  },
  mainStartButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tapInstruction: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
  },
  bottomSection: {
    marginTop: 8,
    gap: 8,
  },
  lastScanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  lastScanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  lastScanInfo: {
    marginLeft: 10,
    flex: 1,
  },
  lastScanSsid: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lastScanMeta: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  lastScanRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionsRow: {
    gap: 8,
  },
  essentialOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  optionCount: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
