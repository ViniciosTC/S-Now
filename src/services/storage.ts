import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DiagnosticRecord,
  HeatmapPoint,
  DiagnosticPeriod,
  ActivityMonitorReport,
} from '../types/snow';

const STORAGE_KEYS = {
  DIAGNOSTICS: '@snow_diagnostics_v1',
  LEGACY_HEATMAP: '@snow_heatmap_points_v1', // Apenas para limpeza de legado
  ACTIVITY_REPORTS: '@snow_activity_reports_v1',
  SETTINGS: '@snow_settings_v1',
};

export interface AppSettings {
  preferredBand: 'auto' | '5ghz' | '2.4ghz';
  minRssiThreshold: number; // default -70 dBm
  enableGpsOnScan: boolean;
  enableTimePatterns: boolean; // Análise opcional de padrões por horário
}

export const defaultSettings: AppSettings = {
  preferredBand: 'auto',
  minRssiThreshold: -70,
  enableGpsOnScan: true,
  enableTimePatterns: true,
};

// ==========================================
// DIAGNÓSTICOS & HEATMAP ACOPLADO
// ==========================================

export async function getStoredDiagnostics(): Promise<DiagnosticRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTICS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiagnosticRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveStoredDiagnostic(record: DiagnosticRecord): Promise<void> {
  try {
    const list = await getStoredDiagnostics();
    const updated = [record, ...list];
    await AsyncStorage.setItem(STORAGE_KEYS.DIAGNOSTICS, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar diagnóstico:', err);
  }
}

export async function updateStoredDiagnostic(record: DiagnosticRecord): Promise<void> {
  try {
    const list = await getStoredDiagnostics();
    const exists = list.some((item) => item.id === record.id);
    const updated = exists
      ? list.map((item) => (item.id === record.id ? record : item))
      : [record, ...list];
    await AsyncStorage.setItem(STORAGE_KEYS.DIAGNOSTICS, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao atualizar diagnóstico:', err);
  }
}

/**
 * Exclui um diagnóstico e automaticamente remove todos os pontos de Heatmap
 * pertencentes a ele (armazenamento único acoplado).
 */
export async function deleteStoredDiagnostic(id: string): Promise<void> {
  try {
    const list = await getStoredDiagnostics();
    const filtered = list.filter((item) => item.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.DIAGNOSTICS, JSON.stringify(filtered));
  } catch (err) {
    console.error('Erro ao excluir diagnóstico:', err);
  }
}

/**
 * Limpa todos os diagnósticos e, por consequência, todo o Heatmap.
 */
export async function clearStoredDiagnostics(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.DIAGNOSTICS);
    await AsyncStorage.removeItem(STORAGE_KEYS.LEGACY_HEATMAP);
  } catch (err) {
    console.error('Erro ao limpar diagnósticos:', err);
  }
}

/**
 * Deriva todos os pontos de Heatmap diretamente dos diagnósticos armazenados.
 * Não mantém armazenamento independente.
 */
export function extractHeatmapPointsFromDiagnostics(
  diagnostics: DiagnosticRecord[]
): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];
  for (const diag of diagnostics) {
    if (diag.heatmapPoints && diag.heatmapPoints.length > 0) {
      points.push(...diag.heatmapPoints);
    }
  }
  return points.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getStoredHeatmapPoints(): Promise<HeatmapPoint[]> {
  const diagnostics = await getStoredDiagnostics();
  return extractHeatmapPointsFromDiagnostics(diagnostics);
}

/**
 * Remove um ponto individual do diagnóstico que o gerou.
 * Se for uma sessão de caminhada sem outros pontos, remove também o registro da sessão vazia.
 */
export async function deleteStoredHeatmapPoint(pointId: string): Promise<DiagnosticRecord[]> {
  try {
    const list = await getStoredDiagnostics();
    const updated: DiagnosticRecord[] = [];

    for (const diag of list) {
      if (!diag.heatmapPoints || diag.heatmapPoints.length === 0) {
        updated.push(diag);
        continue;
      }

      const remainingPoints = diag.heatmapPoints.filter((p) => p.id !== pointId);
      if (diag.isWalkingSession && remainingPoints.length === 0) {
        // Sessão de caminhada ficou sem pontos: remove o registro
        continue;
      }

      updated.push({
        ...diag,
        heatmapPoints: remainingPoints,
      });
    }

    await AsyncStorage.setItem(STORAGE_KEYS.DIAGNOSTICS, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Erro ao excluir ponto do heatmap:', err);
    return await getStoredDiagnostics();
  }
}

// ==========================================
// RELATÓRIOS DE MONITORAMENTO POR ATIVIDADE
// ==========================================

export async function getStoredActivityReports(): Promise<ActivityMonitorReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVITY_REPORTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityMonitorReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveStoredActivityReport(report: ActivityMonitorReport): Promise<void> {
  try {
    const list = await getStoredActivityReports();
    const updated = [report, ...list].slice(0, 50); // Mantém últimos 50
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVITY_REPORTS, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar relatório de monitoramento:', err);
  }
}

export async function clearStoredActivityReports(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVITY_REPORTS);
  } catch (err) {
    console.error('Erro ao limpar relatórios de atividade:', err);
  }
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================

export async function getStoredSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export async function saveStoredSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
  }
}

/**
 * Agrupa diagnósticos cronologicamente em períodos amigáveis:
 * Hoje, Ontem, Esta semana, Anteriores
 */
export function groupDiagnosticsByPeriod(
  records: DiagnosticRecord[]
): { period: DiagnosticPeriod; records: DiagnosticRecord[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

  const groups: Record<DiagnosticPeriod, DiagnosticRecord[]> = {
    Hoje: [],
    Ontem: [],
    'Esta semana': [],
    Anteriores: [],
  };

  const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);

  for (const r of sorted) {
    if (r.timestamp >= startOfToday) {
      groups['Hoje'].push(r);
    } else if (r.timestamp >= startOfYesterday) {
      groups['Ontem'].push(r);
    } else if (r.timestamp >= startOfWeek) {
      groups['Esta semana'].push(r);
    } else {
      groups['Anteriores'].push(r);
    }
  }

  const result: { period: DiagnosticPeriod; records: DiagnosticRecord[] }[] = [];
  const periods: DiagnosticPeriod[] = ['Hoje', 'Ontem', 'Esta semana', 'Anteriores'];
  for (const p of periods) {
    if (groups[p].length > 0) {
      result.push({ period: p, records: groups[p] });
    }
  }

  return result;
}
