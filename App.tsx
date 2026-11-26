import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import {
  getStoredDiagnostics,
  clearStoredDiagnostics,
  deleteStoredDiagnostic,
  extractHeatmapPointsFromDiagnostics,
  getStoredActivityReports,
  getStoredSettings,
  defaultSettings,
  type AppSettings,
} from './src/services/storage';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiagnosticoScreen } from './src/screens/DiagnosticoScreen';
import { ResultadoScreen } from './src/screens/ResultadoScreen';
import { HistoricoScreen } from './src/screens/HistoricoScreen';
import { DetalhesScreen } from './src/screens/DetalhesScreen';
import { HeatmapScreen } from './src/screens/HeatmapScreen';
import { MonitoramentoScreen } from './src/screens/MonitoramentoScreen';
import { ConfiguracoesScreen } from './src/screens/ConfiguracoesScreen';
import type { ScreenName, DiagnosticRecord, ActivityMonitorReport } from './src/types/snow';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [diagnostics, setDiagnostics] = useState<DiagnosticRecord[]>([]);
  const [activityReports, setActivityReports] = useState<ActivityMonitorReport[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeDiagnostic, setActiveDiagnostic] = useState<DiagnosticRecord | null>(null);

  const loadData = useCallback(async () => {
    const [diagList, actList, appSettings] = await Promise.all([
      getStoredDiagnostics(),
      getStoredActivityReports(),
      getStoredSettings(),
    ]);
    setDiagnostics(diagList);
    setActivityReports(actList);
    setSettings(appSettings);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const backAction = () => {
      if (currentScreen !== 'home') {
        if (currentScreen === 'detalhes') {
          setCurrentScreen('historico');
        } else {
          setCurrentScreen('home');
        }
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [currentScreen]);

  const latestDiagnostic = diagnostics.length > 0 ? diagnostics[0] : null;
  const heatmapPointsCount = extractHeatmapPointsFromDiagnostics(diagnostics).length;

  const handleDiagnosticComplete = (record: DiagnosticRecord) => {
    setDiagnostics((prev) => [record, ...prev]);
    setActiveDiagnostic(record);
    setCurrentScreen('resultado');
  };

  const handleSelectDiagnostic = (record: DiagnosticRecord) => {
    setActiveDiagnostic(record);
    setCurrentScreen('detalhes');
  };

  const handleDeleteDiagnostic = async (id: string) => {
    await deleteStoredDiagnostic(id);
    setDiagnostics((prev) => prev.filter((d) => d.id !== id));
    if (activeDiagnostic?.id === id) {
      setActiveDiagnostic(null);
    }
  };

  const handleClearHistory = async () => {
    await clearStoredDiagnostics();
    setDiagnostics([]);
    setActiveDiagnostic(null);
  };

  const handleViewDiagnosticFromHeatmap = (diagnosticId: string) => {
    const found = diagnostics.find((d) => d.id === diagnosticId);
    if (found) {
      setActiveDiagnostic(found);
      setCurrentScreen('detalhes');
    }
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            latestDiagnostic={latestDiagnostic}
            diagnosticCount={diagnostics.length}
            heatmapPointsCount={heatmapPointsCount}
            onStartDiagnostic={() => setCurrentScreen('diagnostico')}
            onOpenHistory={() => setCurrentScreen('historico')}
            onOpenHeatmap={() => setCurrentScreen('heatmap')}
            onOpenMonitor={() => setCurrentScreen('monitoramento')}
            onOpenSettings={() => setCurrentScreen('configuracoes')}
            onOpenLatest={() => {
              if (latestDiagnostic) {
                setActiveDiagnostic(latestDiagnostic);
                setCurrentScreen('detalhes');
              }
            }}
          />
        );

      case 'diagnostico':
        return (
          <DiagnosticoScreen
            onComplete={handleDiagnosticComplete}
            onCancel={() => setCurrentScreen('home')}
          />
        );

      case 'resultado':
        return activeDiagnostic ? (
          <ResultadoScreen
            diagnostic={activeDiagnostic}
            heatmapPointsCount={heatmapPointsCount}
            onRedo={() => setCurrentScreen('diagnostico')}
            onOpenHistory={() => setCurrentScreen('historico')}
            onOpenHeatmap={() => setCurrentScreen('heatmap')}
            onBackToHome={() => setCurrentScreen('home')}
          />
        ) : (
          <HomeScreen
            latestDiagnostic={latestDiagnostic}
            diagnosticCount={diagnostics.length}
            heatmapPointsCount={heatmapPointsCount}
            onStartDiagnostic={() => setCurrentScreen('diagnostico')}
            onOpenHistory={() => setCurrentScreen('historico')}
            onOpenHeatmap={() => setCurrentScreen('heatmap')}
            onOpenMonitor={() => setCurrentScreen('monitoramento')}
            onOpenSettings={() => setCurrentScreen('configuracoes')}
          />
        );

      case 'historico':
        return (
          <HistoricoScreen
            diagnostics={diagnostics}
            activityReports={activityReports}
            enableTimePatterns={settings.enableTimePatterns}
            onSelectDiagnostic={handleSelectDiagnostic}
            onDeleteDiagnostic={handleDeleteDiagnostic}
            onClearHistory={handleClearHistory}
            onBack={() => setCurrentScreen('home')}
            onNewScan={() => setCurrentScreen('diagnostico')}
          />
        );

      case 'detalhes':
        return activeDiagnostic ? (
          <DetalhesScreen
            diagnostic={activeDiagnostic}
            heatmapPointsCount={heatmapPointsCount}
            onBack={() => setCurrentScreen('historico')}
            onViewHeatmap={() => setCurrentScreen('heatmap')}
            onDeleteDiagnostic={handleDeleteDiagnostic}
          />
        ) : (
          <HistoricoScreen
            diagnostics={diagnostics}
            activityReports={activityReports}
            enableTimePatterns={settings.enableTimePatterns}
            onSelectDiagnostic={handleSelectDiagnostic}
            onDeleteDiagnostic={handleDeleteDiagnostic}
            onClearHistory={handleClearHistory}
            onBack={() => setCurrentScreen('home')}
            onNewScan={() => setCurrentScreen('diagnostico')}
          />
        );

      case 'heatmap':
        return (
          <HeatmapScreen
            onBack={() => setCurrentScreen('home')}
            onNewScan={() => setCurrentScreen('diagnostico')}
            onViewDiagnostic={handleViewDiagnosticFromHeatmap}
            onDataUpdated={loadData}
          />
        );

      case 'monitoramento':
        return (
          <MonitoramentoScreen
            reports={activityReports}
            onReportSaved={(report) => setActivityReports((prev) => [report, ...prev])}
            onBack={() => setCurrentScreen('home')}
          />
        );

      case 'configuracoes':
        return (
          <ConfiguracoesScreen
            onBack={() => {
              loadData();
              setCurrentScreen('home');
            }}
            onDataReset={() => {
              setDiagnostics([]);
              setActivityReports([]);
              setActiveDiagnostic(null);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderCurrentScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
