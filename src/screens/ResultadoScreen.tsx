import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { colors, getSignalColor } from '../theme/colors';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ConditionBadge } from '../components/ConditionBadge';
import { SignalChart } from '../components/SignalChart';
import {
  IconRefresh,
  IconHistory,
  IconHeatmap,
  IconShield,
  IconAlertTriangle,
  IconCheck,
} from '../components/Icons';
import type { DiagnosticRecord, SecurityClassification } from '../types/snow';

interface ResultadoScreenProps {
  diagnostic: DiagnosticRecord;
  heatmapPointsCount: number;
  onRedo: () => void;
  onOpenHistory: () => void;
  onOpenHeatmap: () => void;
  onBackToHome: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getSecurityColor(cls: SecurityClassification): string {
  switch (cls) {
    case 'boa':
      return colors.success;
    case 'atencao':
      return colors.warning;
    case 'fraca':
      return colors.danger;
    default:
      return colors.textTertiary;
  }
}

export function ResultadoScreen({
  diagnostic,
  heatmapPointsCount,
  onRedo,
  onOpenHistory,
  onOpenHeatmap,
  onBackToHome,
}: ResultadoScreenProps) {
  const {
    isWifiConnected,
    connectedNetwork,
    wifiQuality,
    internetQuality,
    securityAudit,
    issues,
    causes,
    recommendations,
    score,
    overallCondition,
    confidenceLevel,
    signalSamples,
    averageLatencyMs,
    jitterMs,
    packetLossPercent,
    dnsLatencyMs,
    httpLatencyMs,
    downloadMbps,
    latencySamples,
  } = diagnostic;

  const chartWidth = SCREEN_WIDTH - 64;
  const hasHeatmap = heatmapPointsCount > 0;

  const getConfidenceBadgeColor = () => {
    switch (confidenceLevel) {
      case 'alta':
        return colors.success;
      case 'media':
        return colors.warning;
      default:
        return colors.textTertiary;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Resultado"
        subtitle={`${diagnostic.dateFormatted} às ${diagnostic.timeFormatted}`}
        onBack={onBackToHome}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Cartão de Condição Geral e Score */}
        <Card variant="glass" style={styles.mainScoreCard}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreInfo}>
              <Text style={styles.conditionSublabel}>CONDIÇÃO GERAL</Text>
              <Text style={styles.ssidTitle} numberOfLines={1}>
                {isWifiConnected && connectedNetwork
                  ? connectedNetwork.ssid
                  : 'Wi-Fi Desconectado'}
              </Text>
              <Text style={styles.summaryText}>{diagnostic.summary}</Text>
            </View>

            <View style={styles.badgeWrapper}>
              <ConditionBadge condition={overallCondition} size="large" />
              <Text style={styles.scoreNumber}>
                {score}
                <Text style={styles.scoreScale}>/100</Text>
              </Text>
            </View>
          </View>

          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Grau de Confiança:</Text>
            <View
              style={[
                styles.confidencePill,
                { borderColor: getConfidenceBadgeColor() },
              ]}
            >
              <Text style={[styles.confidenceText, { color: getConfidenceBadgeColor() }]}>
                {confidenceLevel.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Separação explícita: Qualidade do Wi-Fi vs Qualidade da Internet */}
          {wifiQuality && internetQuality && (
            <View style={styles.splitQualityRow}>
              <View style={styles.splitBox}>
                <Text style={styles.splitLabel}>Qualidade Wi-Fi</Text>
                <Text style={styles.splitScore}>{wifiQuality.score}/100</Text>
                <Text style={styles.splitSummary} numberOfLines={2}>
                  {wifiQuality.summary}
                </Text>
              </View>

              <View style={styles.splitBox}>
                <Text style={styles.splitLabel}>Qualidade Internet</Text>
                <Text style={styles.splitScore}>{internetQuality.score}/100</Text>
                <Text style={styles.splitSummary} numberOfLines={2}>
                  {internetQuality.summary}
                </Text>
              </View>
            </View>
          )}

          {/* Grid de Indicadores Técnicos Essenciais */}
          {isWifiConnected && connectedNetwork ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Sinal (RSSI)</Text>
                <Text style={[styles.metricValue, { color: getSignalColor(connectedNetwork.rssi) }]}>
                  {connectedNetwork.rssi} dBm
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Canal & Banda</Text>
                <Text style={styles.metricValue}>
                  {connectedNetwork.channel ? `CH ${connectedNetwork.channel}` : 'N/D'} •{' '}
                  {connectedNetwork.bandGhz ? `${connectedNetwork.bandGhz}G` : '2.4G'}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Link Rate</Text>
                <Text style={styles.metricValue}>
                  {connectedNetwork.linkSpeedMbps ? `${connectedNetwork.linkSpeedMbps} Mbps` : 'N/D'}
                </Text>
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.metricsGrid,
              {
                marginTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.borderMuted,
                paddingTop: 10,
              },
            ]}
          >
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Latência (RTT)</Text>
              <Text style={styles.metricValue}>
                {averageLatencyMs !== null ? `${averageLatencyMs} ms` : 'N/D'}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Jitter</Text>
              <Text style={styles.metricValue}>
                {jitterMs !== null ? `±${jitterMs} ms` : 'N/D'}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Perda</Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: packetLossPercent > 0 ? colors.danger : colors.success },
                ]}
              >
                {packetLossPercent}%
              </Text>
            </View>
          </View>

          {(dnsLatencyMs !== null || httpLatencyMs !== null || downloadMbps !== null) && (
            <View
              style={[
                styles.metricsGrid,
                {
                  marginTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderMuted,
                  paddingTop: 10,
                },
              ]}
            >
              {dnsLatencyMs !== null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>DNS</Text>
                  <Text style={styles.metricValue}>{dnsLatencyMs} ms</Text>
                </View>
              )}
              {httpLatencyMs !== null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>HTTP</Text>
                  <Text style={styles.metricValue}>{httpLatencyMs} ms</Text>
                </View>
              )}
              {downloadMbps !== null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Velocidade Est.</Text>
                  <Text style={styles.metricValue}>{downloadMbps} Mbps</Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Auditoria de Segurança Wi-Fi */}
        {securityAudit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Auditoria de Segurança Wi-Fi</Text>
            <Card variant="glass" style={styles.securityCard}>
              <View style={styles.securityHeader}>
                <View style={styles.securityTitleRow}>
                  <IconShield
                    size={18}
                    color={getSecurityColor(securityAudit.classification)}
                  />
                  <Text style={styles.securityProtocol}>{securityAudit.protocol}</Text>
                </View>
                <View
                  style={[
                    styles.securityBadge,
                    { borderColor: getSecurityColor(securityAudit.classification) },
                  ]}
                >
                  <Text
                    style={[
                      styles.securityBadgeText,
                      { color: getSecurityColor(securityAudit.classification) },
                    ]}
                  >
                    {securityAudit.label}
                  </Text>
                </View>
              </View>

              {(securityAudit.encryption || securityAudit.authentication) && (
                <Text style={styles.securityMeta}>
                  {securityAudit.encryption ? `Criptografia: ${securityAudit.encryption}` : ''}
                  {securityAudit.encryption && securityAudit.authentication ? ' • ' : ''}
                  {securityAudit.authentication ? `Autenticação: ${securityAudit.authentication}` : ''}
                </Text>
              )}

              {securityAudit.warnings.map((w, i) => (
                <Text key={`sec-w-${i}`} style={styles.securityWarning}>
                  • {w}
                </Text>
              ))}
              {securityAudit.recommendations.map((r, i) => (
                <Text key={`sec-r-${i}`} style={styles.securityRec}>
                  {r}
                </Text>
              ))}
            </Card>
          </View>
        )}

        {/* Gráficos de Comportamento */}
        {signalSamples.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comportamento do Sinal & Latência</Text>
            <Card variant="glass" style={styles.chartCard}>
              <SignalChart
                samples={signalSamples}
                type="rssi"
                width={chartWidth}
                height={100}
                title="Variação de RSSI (dBm) durante a coleta"
              />
              {latencySamples.length > 1 && (
                <View style={{ marginTop: 14 }}>
                  <SignalChart
                    samples={latencySamples}
                    type="latency"
                    width={chartWidth}
                    height={100}
                    title="Latência externa (ms)"
                  />
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Problemas Identificados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnóstico & Problemas</Text>
          {issues.length === 0 ? (
            <Card variant="glass" style={styles.noIssuesCard}>
              <IconCheck size={18} color={colors.success} />
              <Text style={styles.noIssuesText}>
                Nenhum gargalo significativo detectado nesta medição.
              </Text>
            </Card>
          ) : (
            issues.map((issue) => (
              <Card key={issue.id} variant="glass" style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <IconAlertTriangle
                    size={16}
                    color={issue.severity === 'alta' ? colors.danger : colors.warning}
                  />
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                </View>
                <Text style={styles.issueDesc}>{issue.description}</Text>
              </Card>
            ))
          )}
        </View>

        {causes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Possíveis Causas</Text>
            <Card variant="glass" style={styles.listCard}>
              {causes.map((cause, idx) => (
                <View key={`cause-${idx}`} style={styles.listItem}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.listText}>{cause}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recomendações Práticas</Text>
            <Card variant="glass" style={styles.listCard}>
              {recommendations.map((rec, idx) => (
                <View key={`rec-${idx}`} style={styles.listItem}>
                  <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.listText}>{rec}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <Button
            title="Refazer Diagnóstico"
            onPress={onRedo}
            variant="primary"
            icon={<IconRefresh size={16} color={colors.textPrimary} />}
            style={styles.actionBtn}
          />

          <View style={styles.actionRow}>
            <Button
              title="Ver Histórico"
              onPress={onOpenHistory}
              variant="secondary"
              icon={<IconHistory size={16} color={colors.tealLight} />}
              style={styles.halfBtn}
            />
            {hasHeatmap && (
              <Button
                title="Abrir Heatmap"
                onPress={onOpenHeatmap}
                variant="secondary"
                icon={<IconHeatmap size={16} color={colors.tealLight} />}
                style={styles.halfBtn}
              />
            )}
          </View>

          <Button
            title="Voltar ao Início"
            onPress={onBackToHome}
            variant="ghost"
            style={styles.homeBtn}
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
    paddingTop: 14,
    paddingBottom: Platform.OS === 'android' ? 32 : 24,
  },
  mainScoreCard: {
    padding: 16,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  scoreInfo: {
    flex: 1,
    paddingRight: 10,
  },
  conditionSublabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  ssidTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  badgeWrapper: {
    alignItems: 'flex-end',
    gap: 6,
  },
  scoreNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  scoreScale: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textTertiary,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confidenceLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  confidencePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  splitQualityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  splitBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 12,
    padding: 10,
  },
  splitLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  splitScore: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  splitSummary: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderMuted,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 2,
  },
  securityCard: {
    padding: 14,
  },
  securityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  securityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityProtocol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  securityBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  securityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  securityMeta: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 6,
  },
  securityWarning: {
    fontSize: 12,
    color: colors.warning,
    lineHeight: 16,
    marginTop: 4,
  },
  securityRec: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
  chartCard: {
    padding: 12,
  },
  noIssuesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  noIssuesText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
  issueCard: {
    padding: 14,
    marginBottom: 8,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  issueTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  issueDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginLeft: 24,
  },
  listCard: {
    padding: 14,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  listText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
    flex: 1,
  },
  actionsContainer: {
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfBtn: {
    flex: 1,
  },
  homeBtn: {
    paddingVertical: 10,
  },
});
