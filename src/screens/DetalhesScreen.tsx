import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { colors, getSignalColor } from '../theme/colors';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ConditionBadge } from '../components/ConditionBadge';
import { Accordion } from '../components/Accordion';
import { SignalChart } from '../components/SignalChart';
import {
  IconTrash,
  IconHeatmap,
  IconWifi,
  IconGlobe,
  IconRadio,
  IconActivity,
  IconAlertTriangle,
  IconCheck,
  IconShield,
} from '../components/Icons';
import type { DiagnosticRecord } from '../types/snow';

interface DetalhesScreenProps {
  diagnostic: DiagnosticRecord;
  heatmapPointsCount: number;
  onBack: () => void;
  onViewHeatmap: () => void;
  onDeleteDiagnostic?: (id: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function DetalhesScreen({
  diagnostic,
  heatmapPointsCount,
  onBack,
  onViewHeatmap,
  onDeleteDiagnostic,
}: DetalhesScreenProps) {
  const {
    isWifiConnected,
    connectedNetwork,
    wifiQuality,
    internetQuality,
    securityAudit,
    location,
    nearbyNetworks,
    issues,
    causes,
    recommendations,
    score,
    overallCondition,
    confidenceLevel,
    signalSamples,
    latencySamples,
    averageLatencyMs,
    jitterMs,
    packetLossPercent,
    dnsLatencyMs,
    httpLatencyMs,
    downloadMbps,
    coChannelInterferenceCount,
    signalVariation,
  } = diagnostic;

  const chartWidth = SCREEN_WIDTH - 64;
  const hasHeatmap = heatmapPointsCount > 0 && (diagnostic.heatmapPoints?.length ?? 0) > 0;

  const handleDelete = () => {
    Alert.alert(
      'Excluir Medição',
      'Tem certeza de que deseja remover este diagnóstico? Os pontos de Heatmap gerados por ele também serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            if (onDeleteDiagnostic) {
              onDeleteDiagnostic(diagnostic.id);
            }
            onBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Relatório Técnico"
        subtitle={`${diagnostic.dateFormatted} às ${diagnostic.timeFormatted}`}
        onBack={onBack}
        rightAction={{
          icon: <IconTrash size={16} color={colors.danger} />,
          onPress: handleDelete,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Card variant="glass" style={styles.overviewCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleCol}>
              <Text style={styles.ssidText} numberOfLines={1}>
                {isWifiConnected && connectedNetwork
                  ? connectedNetwork.ssid
                  : 'Wi-Fi Desconectado'}
              </Text>
              <Text style={styles.bssidText}>
                {connectedNetwork?.bssid ? `BSSID: ${connectedNetwork.bssid}` : 'Sem BSSID'}
              </Text>
            </View>
            <View style={styles.scoreBadgeCol}>
              <ConditionBadge condition={overallCondition} size="normal" />
              <Text style={styles.scoreText}>{score}/100</Text>
            </View>
          </View>

          <Text style={styles.summaryText}>{diagnostic.summary}</Text>

          {wifiQuality && internetQuality && (
            <View style={styles.splitRow}>
              <Text style={styles.splitTag}>Wi-Fi: {wifiQuality.score}/100</Text>
              <Text style={styles.splitTag}>Internet: {internetQuality.score}/100</Text>
            </View>
          )}
        </Card>

        {/* 1. Ficha Técnica da Conexão */}
        <Accordion
          title="Ficha Técnica da Conexão"
          subtitle={
            isWifiConnected && connectedNetwork
              ? `${connectedNetwork.rssi} dBm • CH ${connectedNetwork.channel ?? 'N/D'}`
              : 'Desconectado'
          }
          icon={<IconWifi size={16} color={colors.primary} />}
          defaultExpanded={true}
        >
          {isWifiConnected && connectedNetwork ? (
            <View style={styles.techGrid}>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>SSID</Text>
                <Text style={styles.techVal}>{connectedNetwork.ssid}</Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>BSSID (MAC do AP)</Text>
                <Text style={styles.techVal}>{connectedNetwork.bssid || 'N/D'}</Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Intensidade (RSSI)</Text>
                <Text style={[styles.techVal, { color: getSignalColor(connectedNetwork.rssi) }]}>
                  {connectedNetwork.rssi} dBm
                </Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Canal & Frequência</Text>
                <Text style={styles.techVal}>
                  {connectedNetwork.channel ? `Canal ${connectedNetwork.channel}` : 'N/D'} (
                  {connectedNetwork.frequency ? `${connectedNetwork.frequency} MHz` : 'N/D'})
                </Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Banda</Text>
                <Text style={styles.techVal}>
                  {connectedNetwork.bandGhz ? `${connectedNetwork.bandGhz} GHz` : 'N/D'}
                </Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Link Rate</Text>
                <Text style={styles.techVal}>
                  {connectedNetwork.linkSpeedMbps ? `${connectedNetwork.linkSpeedMbps} Mbps` : 'N/D'}
                </Text>
              </View>
              {connectedNetwork.ipAddress ? (
                <View style={styles.techRow}>
                  <Text style={styles.techLabel}>Endereço IP</Text>
                  <Text style={styles.techVal}>{connectedNetwork.ipAddress}</Text>
                </View>
              ) : null}
              {connectedNetwork.gateway ? (
                <View style={styles.techRow}>
                  <Text style={styles.techLabel}>Gateway</Text>
                  <Text style={styles.techVal}>{connectedNetwork.gateway}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyAccordionText}>
              O aparelho não estava associado a uma rede Wi-Fi no instante da análise.
            </Text>
          )}
        </Accordion>

        {/* 2. Auditoria de Segurança */}
        {securityAudit && (
          <Accordion
            title="Auditoria de Segurança Wi-Fi"
            subtitle={`${securityAudit.label} • ${securityAudit.protocol}`}
            icon={<IconShield size={16} color={colors.primary} />}
          >
            <View style={styles.techGrid}>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Classificação</Text>
                <Text style={styles.techVal}>{securityAudit.label}</Text>
              </View>
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Protocolo</Text>
                <Text style={styles.techVal}>{securityAudit.protocol}</Text>
              </View>
              {securityAudit.encryption && (
                <View style={styles.techRow}>
                  <Text style={styles.techLabel}>Criptografia</Text>
                  <Text style={styles.techVal}>{securityAudit.encryption}</Text>
                </View>
              )}
              {securityAudit.authentication && (
                <View style={styles.techRow}>
                  <Text style={styles.techLabel}>Autenticação</Text>
                  <Text style={styles.techVal}>{securityAudit.authentication}</Text>
                </View>
              )}
            </View>
            {securityAudit.warnings.map((w, i) => (
              <Text key={`w-${i}`} style={styles.bulletItem}>
                • {w}
              </Text>
            ))}
            {securityAudit.recommendations.map((r, i) => (
              <Text key={`r-${i}`} style={styles.bulletItem}>
                • {r}
              </Text>
            ))}
          </Accordion>
        )}

        {/* 3. Desempenho de Internet */}
        <Accordion
          title="Desempenho de Internet"
          subtitle={
            averageLatencyMs !== null
              ? `${averageLatencyMs} ms • Jitter ±${jitterMs ?? 0} ms`
              : 'Sem conexão externa'
          }
          icon={<IconGlobe size={16} color={colors.accent} />}
          defaultExpanded={true}
        >
          <View style={styles.techGrid}>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Latência Média (RTT)</Text>
              <Text style={styles.techVal}>
                {averageLatencyMs !== null ? `${averageLatencyMs} ms` : 'Indisponível'}
              </Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Jitter (RFC 3550)</Text>
              <Text style={styles.techVal}>
                {jitterMs !== null ? `±${jitterMs} ms` : 'N/D'}
              </Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Perda de Pacotes</Text>
              <Text
                style={[
                  styles.techVal,
                  { color: packetLossPercent > 0 ? colors.danger : colors.success },
                ]}
              >
                {packetLossPercent}%
              </Text>
            </View>
            {dnsLatencyMs !== null && (
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Resposta DNS</Text>
                <Text style={styles.techVal}>{dnsLatencyMs} ms</Text>
              </View>
            )}
            {httpLatencyMs !== null && (
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Resposta HTTP</Text>
                <Text style={styles.techVal}>{httpLatencyMs} ms</Text>
              </View>
            )}
            {downloadMbps !== null && (
              <View style={styles.techRow}>
                <Text style={styles.techLabel}>Velocidade Estimada</Text>
                <Text style={styles.techVal}>{downloadMbps} Mbps</Text>
              </View>
            )}
          </View>

          {latencySamples.length > 1 && (
            <View style={styles.chartWrapper}>
              <SignalChart
                samples={latencySamples}
                type="latency"
                width={chartWidth}
                height={95}
                title="Sondagem RTT ao longo do teste (ms)"
              />
            </View>
          )}
        </Accordion>

        {/* 4. Espectro RF & Concorrência */}
        <Accordion
          title="Espectro RF & Concorrência"
          subtitle={`${nearbyNetworks.length} redes vizinhas detectadas`}
          icon={<IconRadio size={16} color={colors.tealLight} />}
        >
          <View style={styles.techGrid}>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Concorrência Co-Canal</Text>
              <Text style={styles.techVal}>{coChannelInterferenceCount} rede(s) no mesmo canal</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Variação de RSSI</Text>
              <Text style={styles.techVal}>±{signalVariation.toFixed(1)} dBm</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Redes Próximas</Text>
              <Text style={styles.techVal}>{nearbyNetworks.length}</Text>
            </View>
          </View>

          {signalSamples.length > 1 && (
            <View style={styles.chartWrapper}>
              <SignalChart
                samples={signalSamples}
                type="rssi"
                width={chartWidth}
                height={95}
                title="Estabilidade de sinal Wi-Fi (dBm)"
              />
            </View>
          )}
        </Accordion>

        {/* 5. Diagnóstico e Recomendações */}
        <Accordion
          title="Diagnóstico & Recomendações"
          subtitle={`${issues.length} apontamento(s) • Confiança ${confidenceLevel}`}
          icon={<IconActivity size={16} color={colors.warning} />}
          defaultExpanded={true}
        >
          {issues.length === 0 ? (
            <View style={styles.noIssuesRow}>
              <IconCheck size={16} color={colors.success} />
              <Text style={styles.noIssuesText}>Conexão opera com excelentes parâmetros.</Text>
            </View>
          ) : (
            issues.map((issue) => (
              <View key={issue.id} style={styles.issueItem}>
                <View style={styles.issueHeader}>
                  <IconAlertTriangle
                    size={14}
                    color={issue.severity === 'alta' ? colors.danger : colors.warning}
                  />
                  <Text style={styles.issueTitleText}>{issue.title}</Text>
                </View>
                <Text style={styles.issueDescText}>{issue.description}</Text>
              </View>
            ))
          )}

          {causes.length > 0 && (
            <View style={styles.blockSection}>
              <Text style={styles.blockTitle}>Causas Prováveis:</Text>
              {causes.map((c, idx) => (
                <Text key={`c-${idx}`} style={styles.bulletItem}>
                  • {c}
                </Text>
              ))}
            </View>
          )}

          {recommendations.length > 0 && (
            <View style={styles.blockSection}>
              <Text style={styles.blockTitle}>Sugestões de Melhoria:</Text>
              {recommendations.map((r, idx) => (
                <Text key={`r-${idx}`} style={styles.bulletItem}>
                  • {r}
                </Text>
              ))}
            </View>
          )}
        </Accordion>

        {location && (
          <Card variant="glass" style={styles.locationCard}>
            <Text style={styles.locTitle}>Posição Espacial Estabilizada</Text>
            <Text style={styles.locMeta}>
              Lat {location.latitude.toFixed(6)}° • Long {location.longitude.toFixed(6)}°
              {location.accuracy !== null ? ` (precisão ±${location.accuracy}m)` : ''}
            </Text>
          </Card>
        )}

        <View style={styles.bottomActions}>
          {hasHeatmap && (
            <Button
              title="Ver Ponto no Heatmap"
              onPress={onViewHeatmap}
              variant="secondary"
              icon={<IconHeatmap size={16} color={colors.primary} />}
              style={styles.actionBtn}
            />
          )}

          <Button
            title="Voltar ao Histórico"
            onPress={onBack}
            variant="ghost"
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
    paddingTop: 14,
    paddingBottom: 32,
  },
  overviewCard: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  ssidText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  bssidText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  scoreBadgeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  splitTag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  techGrid: {
    gap: 8,
    paddingTop: 8,
    marginBottom: 6,
  },
  techRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  techLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  techVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyAccordionText: {
    fontSize: 12,
    color: colors.textTertiary,
    paddingVertical: 8,
  },
  chartWrapper: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  noIssuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  noIssuesText: {
    fontSize: 12,
    color: colors.success,
  },
  issueItem: {
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  issueTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  issueDescText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginLeft: 20,
  },
  blockSection: {
    marginTop: 10,
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bulletItem: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 2,
  },
  locationCard: {
    padding: 12,
    marginBottom: 16,
  },
  locTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  locMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomActions: {
    marginTop: 8,
    gap: 8,
  },
  actionBtn: {
    width: '100%',
  },
});
