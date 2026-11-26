import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import {
  isWifiEnabled,
  requestWifiPermission,
  scanNetworks,
  getScanThrottleStatus,
  type WifiNetwork,
} from 'munim-wifi';

interface SignalClassification {
  label: string;
  color: string;
  badgeBg: string;
  percentage: number;
}

function classifySignal(rssi?: number): SignalClassification {
  if (rssi === undefined || rssi === null) {
    return {
      label: 'Indisponível',
      color: '#94A3B8',
      badgeBg: 'rgba(148, 163, 184, 0.15)',
      percentage: 0,
    };
  }

  // Mapeia RSSI de -100 dBm (0%) a -40 dBm (100%)
  const clamped = Math.max(-100, Math.min(-40, rssi));
  const percentage = Math.round(((clamped - -100) / (-40 - -100)) * 100);

  if (rssi >= -50) {
    return {
      label: 'Excelente',
      color: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.2)',
      percentage,
    };
  } else if (rssi >= -60) {
    return {
      label: 'Muito Bom',
      color: '#06B6D4',
      badgeBg: 'rgba(6, 182, 212, 0.2)',
      percentage,
    };
  } else if (rssi >= -70) {
    return {
      label: 'Razoável',
      color: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      percentage,
    };
  } else if (rssi >= -80) {
    return {
      label: 'Fraco',
      color: '#F97316',
      badgeBg: 'rgba(249, 115, 22, 0.2)',
      percentage,
    };
  } else {
    return {
      label: 'Muito Fraco',
      color: '#EF4444',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      percentage,
    };
  }
}

export function WifiScreen() {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [wifiActive, setWifiActive] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [throttleNotice, setThrottleNotice] = useState<string | null>(null);

  // Checa status inicial do rádio Wi-Fi
  const checkInitialStatus = useCallback(async () => {
    try {
      const enabled = await isWifiEnabled();
      setWifiActive(enabled);
    } catch {
      setWifiActive(null);
    }
  }, []);

  useEffect(() => {
    checkInitialStatus();
  }, [checkInitialStatus]);

  const handleScan = async () => {
    if (scanning) return;

    setErrorMessage(null);
    setThrottleNotice(null);
    setStatusMessage('Verificando status do Wi-Fi...');
    setScanning(true);

    try {
      // 1. Verifica se o Wi-Fi está ligado
      const enabled = await isWifiEnabled();
      setWifiActive(enabled);

      if (!enabled) {
        setScanning(false);
        setStatusMessage(null);
        setErrorMessage(
          'O Wi-Fi está desativado no aparelho. Por favor, ative o Wi-Fi nas configurações do sistema e tente novamente.'
        );
        Alert.alert(
          'Wi-Fi Desativado',
          'Ative a conexão Wi-Fi nas configurações do Android para escanear redes próximas.'
        );
        return;
      }

      // 2. Solicita permissões obrigatórias
      setStatusMessage('Solicitando permissões do Android...');
      const hasPermission = await requestWifiPermission();

      if (!hasPermission) {
        setScanning(false);
        setStatusMessage(null);
        setErrorMessage(
          'Permissão negada. No Android (One UI / Galaxy A55), o acesso a Dispositivos Próximos e Localização precisa ser concedido para visualizar redes Wi-Fi.'
        );
        Alert.alert(
          'Permissão Necessária',
          'Para escanear redes Wi-Fi, conceda permissão de Dispositivos Próximos e Localização ao aplicativo.'
        );
        return;
      }

      // 3. Executa varredura de redes próximas
      setStatusMessage('Executando varredura das redes próximas...');

      // allowCached: true permite usar resultados recentes do cache do sistema caso o Android aplique throttling
      const results = await scanNetworks({
        allowCached: true,
        timeout: 10000,
      });

      // Checa se o sistema indicou throttling no Android
      try {
        const throttle = await getScanThrottleStatus();
        if (throttle && throttle.maxScans > 0) {
          const remaining = throttle.maxScans - throttle.scansInWindow;
          if (remaining <= 0) {
            setThrottleNotice(
              'O Android limitou novas varreduras ativas (4 varreduras a cada 2 min). Resultados recentes em cache estão sendo exibidos.'
            );
          }
        }
      } catch {
        // Ignora caso getScanThrottleStatus não seja suportado na plataforma atual
      }

      // 4. Ordenar do sinal mais forte (maior dBm, ex: -35) para o mais fraco (ex: -88)
      const sorted = [...results].sort((a, b) => {
        const rssiA = a.rssi ?? -999;
        const rssiB = b.rssi ?? -999;
        return rssiB - rssiA;
      });

      setNetworks(sorted);
      setLastScanTime(new Date().toLocaleTimeString('pt-BR'));
      setStatusMessage(null);

      if (sorted.length === 0) {
        setErrorMessage(
          'Nenhuma rede encontrada. Lembre-se: no Android, o serviço de Localização (GPS) geral do sistema precisa estar ativado para que a busca retorne resultados.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Erro ao realizar varredura: ${msg}`);
      setStatusMessage(null);
    } finally {
      setScanning(false);
    }
  };

  const renderItem = ({ item }: { item: WifiNetwork }) => {
    const classification = classifySignal(item.rssi);
    const ssidDisplay = item.ssid && item.ssid.trim().length > 0 ? item.ssid : '[Rede Oculta]';
    const bssidDisplay = item.bssid && item.bssid.trim().length > 0 ? item.bssid : 'Não disponível';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.ssidContainer}>
            <Text style={styles.ssidText} numberOfLines={1}>
              {ssidDisplay}
            </Text>
            {item.securityType ? (
              <View style={styles.secBadge}>
                <Text style={styles.secBadgeText}>{item.securityType.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.classificationBadge, { backgroundColor: classification.badgeBg }]}>
            <Text style={[styles.classificationText, { color: classification.color }]}>
              {classification.label}
            </Text>
          </View>
        </View>

        {/* Barra visual de intensidade */}
        <View style={styles.signalBarContainer}>
          <View
            style={[
              styles.signalBarFill,
              {
                width: `${classification.percentage}%`,
                backgroundColor: classification.color,
              },
            ]}
          />
        </View>

        {/* Grade de métricas */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>RSSI</Text>
            <Text style={[styles.metricValue, { color: classification.color }]}>
              {item.rssi !== undefined ? `${item.rssi} dBm` : 'N/D'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Frequência</Text>
            <Text style={styles.metricValue}>
              {item.frequency !== undefined ? `${item.frequency} MHz` : 'N/D'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Canal</Text>
            <Text style={styles.metricValue}>
              {item.channel !== undefined ? `CH ${item.channel}` : 'N/D'}
            </Text>
          </View>

          {item.bandGhz ? (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Banda</Text>
              <Text style={styles.metricValue}>{item.bandGhz} GHz</Text>
            </View>
          ) : null}

          {item.wifiStandard && item.wifiStandard !== 'unknown' ? (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Padrão</Text>
              <Text style={styles.metricValue}>{item.wifiStandard.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        {/* Rodapé do Card com BSSID */}
        <View style={styles.bssidContainer}>
          <Text style={styles.bssidLabel}>BSSID:</Text>
          <Text style={styles.bssidValue} numberOfLines={1}>
            {bssidDisplay}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Indicador de Wi-Fi */}
      <View style={styles.statusRow}>
        <View style={styles.wifiStatusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: wifiActive ? '#10B981' : '#EF4444' },
            ]}
          />
          <Text style={styles.wifiStatusText}>
            {wifiActive === null ? 'Checando...' : wifiActive ? 'Wi-Fi Ativo' : 'Wi-Fi Desligado'}
          </Text>
        </View>
        <Text style={styles.infoText}>
          {lastScanTime
            ? `${lastScanTime} • ${networks.length} rede(s)`
            : 'Pronto para busca'}
        </Text>
      </View>

      {/* Botão de Ação */}
      <TouchableOpacity
        style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
        onPress={handleScan}
        disabled={scanning}
        activeOpacity={0.8}
      >
        {scanning ? (
          <ActivityIndicator color="#0B0F19" size="small" />
        ) : (
          <Text style={styles.scanButtonText}>🔍 VARRER REDES WI-FI</Text>
        )}
      </TouchableOpacity>

      {/* Mensagens de Carregamento e Notificações */}
      {statusMessage && (
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 8 }} />
          <Text style={styles.statusBoxText}>{statusMessage}</Text>
        </View>
      )}

      {throttleNotice && (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeBoxText}>⚠️ {throttleNotice}</Text>
        </View>
      )}

      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxTitle}>Aviso</Text>
          <Text style={styles.errorBoxText}>{errorMessage}</Text>
        </View>
      )}

      {/* Lista de Resultados */}
      <FlatList
        data={networks}
        keyExtractor={(item, index) =>
          item.bssid ? `${item.bssid}-${index}` : `${item.ssid}-${index}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={scanning}
            onRefresh={handleScan}
            tintColor="#38BDF8"
            colors={['#38BDF8']}
          />
        }
        ListEmptyComponent={
          !scanning ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={styles.emptyTitle}>Pronto para varredura</Text>
              <Text style={styles.emptyDescription}>
                Toque no botão acima para escanear as redes Wi-Fi disponíveis ao redor do seu aparelho.
              </Text>
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Dicas para Android 14 (Galaxy A55):</Text>
                <Text style={styles.tipsText}>• O Wi-Fi deve estar ligado.</Text>
                <Text style={styles.tipsText}>• A Localização (GPS) do sistema deve estar ativada.</Text>
                <Text style={styles.tipsText}>• Conceda permissão de Dispositivos Próximos se solicitado.</Text>
              </View>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  wifiStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  wifiStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  infoText: {
    color: '#64748B',
    fontSize: 12,
  },
  scanButton: {
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8,
  },
  scanButtonDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.8,
  },
  scanButtonText: {
    color: '#0B0F19',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  statusBoxText: {
    color: '#38BDF8',
    fontSize: 13,
    flex: 1,
  },
  noticeBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  noticeBoxText: {
    color: '#FBBF24',
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  errorBoxTitle: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  errorBoxText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
  },
  listContent: {
    paddingVertical: 6,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#131B2E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ssidContainer: {
    flex: 1,
    marginRight: 10,
  },
  ssidText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  secBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  secBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  classificationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  classificationText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  signalBarContainer: {
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  signalBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metricItem: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '700',
    marginTop: 1,
  },
  bssidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  bssidLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 6,
    fontWeight: '600',
  },
  bssidValue: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  tipsContainer: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 6,
  },
  tipsText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
});
