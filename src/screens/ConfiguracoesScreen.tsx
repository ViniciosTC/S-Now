import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import {
  getStoredSettings,
  saveStoredSettings,
  clearStoredDiagnostics,
  clearStoredActivityReports,
  defaultSettings,
  type AppSettings,
} from '../services/storage';

interface ConfiguracoesScreenProps {
  onBack: () => void;
  onDataReset: () => void;
}

export function ConfiguracoesScreen({ onBack, onDataReset }: ConfiguracoesScreenProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    getStoredSettings().then(setSettings);
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveStoredSettings(updated);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Redefinir Dados',
      'Tem certeza de que deseja apagar todo o histórico de análises e os pontos do heatmap?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            await clearStoredDiagnostics();
            await clearStoredActivityReports();
            onDataReset();
            Alert.alert('Sucesso', 'Todos os dados locais foram apagados.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Configurações" subtitle="Preferências do motor analítico" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Parâmetros de Diagnóstico */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PARÂMETROS DE DIAGNÓSTICO</Text>
          <Card variant="glass" style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Amostragem de GPS na Análise</Text>
                <Text style={styles.settingDesc}>
                  Registra coordenadas estabilizadas e precisão métrica junto com a medição de sinal.
                </Text>
              </View>
              <Switch
                value={settings.enableGpsOnScan}
                onValueChange={(val) => updateSetting('enableGpsOnScan', val)}
                trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.primary }}
                thumbColor={colors.textPrimary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Padrões de Instabilidade por Horário</Text>
                <Text style={styles.settingDesc}>
                  Identifica automaticamente horários recorrentes de latência alta no histórico.
                </Text>
              </View>
              <Switch
                value={settings.enableTimePatterns}
                onValueChange={(val) => updateSetting('enableTimePatterns', val)}
                trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.primary }}
                thumbColor={colors.textPrimary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingCol}>
              <Text style={styles.settingLabel}>Limite Mínimo para Alerta de Sinal</Text>
              <Text style={styles.settingDesc}>
                Define em qual nível de RSSI o motor emitirá advertência de cobertura fraca.
              </Text>
              <View style={styles.segmentedRow}>
                {[-65, -70, -75, -80].map((threshold) => {
                  const isSelected = settings.minRssiThreshold === threshold;
                  return (
                    <TouchableOpacity
                      key={threshold}
                      style={[styles.segmentBtn, isSelected && styles.segmentBtnActive]}
                      onPress={() => updateSetting('minRssiThreshold', threshold)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          isSelected && styles.segmentBtnTextActive,
                        ]}
                      >
                        {threshold} dBm
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>
        </View>

        {/* Gerenciamento de Armazenamento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ARMAZENAMENTO LOCAL</Text>
          <Card variant="glass" style={styles.card}>
            <View style={styles.settingCol}>
              <Text style={styles.settingLabel}>Limpar Dados Salvos</Text>
              <Text style={styles.settingDesc}>
                Remove permanentemente todos os registros de análises e pontos de cobertura salvos no Samsung Galaxy A55.
              </Text>
              <Button
                title="Apagar Histórico e Heatmap"
                onPress={handleClearAllData}
                variant="danger"
                style={styles.dangerBtn}
              />
            </View>
          </Card>
        </View>

        {/* Informações do Dispositivo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SOBRE O DISPOSITIVO & S-NOW</Text>
          <Card variant="glass" style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dispositivo Alvo</Text>
              <Text style={styles.infoVal}>Samsung Galaxy A55 5G</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sistema Operacional</Text>
              <Text style={styles.infoVal}>Android (One UI 6)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Motor Wi-Fi</Text>
              <Text style={styles.infoVal}>munim-wifi + Nitro Modules</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Arquitetura</Text>
              <Text style={styles.infoVal}>React Native New Architecture</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Versão</Text>
              <Text style={styles.infoVal}>S-Now v2.0 (Night Edition)</Text>
            </View>
          </Card>
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingCol: {
    paddingVertical: 4,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderMuted,
    marginVertical: 14,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  dangerBtn: {
    marginTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
