import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform, PermissionsAndroid } from 'react-native';
import { getCurrentNetwork } from 'munim-wifi';
import { measureSingleProbe } from './networkProber';
import type { ActivityMonitorReport, ActivityType } from '../types/snow';

export const ACTIVITY_MONITOR_TASK = 'SNOW_ACTIVITY_MONITOR_TASK';
const ACTIVE_SESSION_KEY = '@snow_active_monitor_session_v1';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  jogos: 'Jogos Online',
  chamadas: 'Chamadas de Vídeo/Voz',
  streaming: 'Streaming de Vídeo',
  navegacao: 'Navegação Geral',
  outra: 'Outra Atividade',
};

export interface ActiveMonitorSession {
  id: string;
  activity: ActivityType;
  activityLabel: string;
  startTime: number;
  ssid: string | null;
  latencySamples: number[];
  rssiSamples: number[];
  failedProbes: number;
  totalProbes: number;
  interruptionsCount: number;
  lastSampleTime: number;
  backgroundModeUsed: boolean;
}

type SessionListener = (session: ActiveMonitorSession) => void;
const listeners = new Set<SessionListener>();
let foregroundTimer: ReturnType<typeof setInterval> | null = null;
let isSamplingNow = false;

export function subscribeActivitySession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(session: ActiveMonitorSession) {
  listeners.forEach((cb) => cb(session));
}

async function readActiveSession(): Promise<ActiveMonitorSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveMonitorSession;
  } catch {
    return null;
  }
}

async function writeActiveSession(session: ActiveMonitorSession): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    notifyListeners(session);
  } catch (err) {
    console.warn('Erro ao persistir sessão de monitoramento:', err);
  }
}

/**
 * Executa uma rodada de coleta (sinal Wi-Fi conectado + sonda RTT HTTP/DNS).
 * Chamada tanto pelo Foreground Service em segundo plano quanto pelo timer em primeiro plano.
 */
async function collectMonitorSample(): Promise<void> {
  if (isSamplingNow) return;
  isSamplingNow = true;

  try {
    const session = await readActiveSession();
    if (!session) return;

    // Evita amostragem duplicada em menos de 2.5s
    const now = Date.now();
    if (now - session.lastSampleTime < 2500) return;

    let currentRssi: number | null = null;
    let currentSsid = session.ssid;
    let wifiDropped = false;

    try {
      const net = await getCurrentNetwork();
      if (net && net.ssid && net.ssid !== '<unknown ssid>') {
        currentSsid = net.ssid;
        if (typeof net.rssi === 'number') {
          currentRssi = net.rssi;
        }
      } else {
        wifiDropped = true;
      }
    } catch {
      // Ignora erro pontual de leitura
    }

    const rtt = await measureSingleProbe('https://1.1.1.1/cdn-cgi/trace', 2500);

    const updated: ActiveMonitorSession = {
      ...session,
      ssid: currentSsid,
      lastSampleTime: now,
      totalProbes: session.totalProbes + 1,
      failedProbes: rtt === null ? session.failedProbes + 1 : session.failedProbes,
      latencySamples:
        rtt !== null ? [...session.latencySamples, rtt] : session.latencySamples,
      rssiSamples:
        currentRssi !== null ? [...session.rssiSamples, currentRssi] : session.rssiSamples,
      interruptionsCount:
        wifiDropped || rtt === null || (rtt !== null && rtt > 500)
          ? session.interruptionsCount + 1
          : session.interruptionsCount,
    };

    await writeActiveSession(updated);
  } finally {
    isSamplingNow = false;
  }
}

// Registra a tarefa em segundo plano do Expo TaskManager (executa fora da UI enquanto Foreground Service roda)
if (!TaskManager.isTaskDefined(ACTIVITY_MONITOR_TASK)) {
  TaskManager.defineTask(ACTIVITY_MONITOR_TASK, async ({ error }) => {
    if (error) {
      console.warn('Erro na task de monitoramento:', error.message);
      return;
    }
    await collectMonitorSample();
  });
}

async function requestNotificationPermissionAndroid(): Promise<void> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch {
      // Segue mesmo se usuário recusar; o sistema gerencia o fallback
    }
  }
}

export async function getOngoingActivitySession(): Promise<ActiveMonitorSession | null> {
  return await readActiveSession();
}

/**
 * Inicia o monitoramento contínuo para a atividade escolhida.
 * No Android, ativa o Foreground Service com notificação persistente via expo-location
 * para continuar coletando métricas de rede quando o usuário alternar para outros apps.
 */
export async function startActivityMonitoring(
  activity: ActivityType
): Promise<ActiveMonitorSession> {
  // Limpa qualquer sessão residual
  await stopLocationServiceIfRunning();

  await requestNotificationPermissionAndroid();

  let currentSsid: string | null = null;
  try {
    const net = await getCurrentNetwork();
    if (net && net.ssid && net.ssid !== '<unknown ssid>') {
      currentSsid = net.ssid;
    }
  } catch {
    // Sem rede no início
  }

  let backgroundModeUsed = false;

  try {
    const fgPerm = await Location.requestForegroundPermissionsAsync();
    if (fgPerm.status === Location.PermissionStatus.GRANTED) {
      const bgPerm = await Location.requestBackgroundPermissionsAsync();
      if (bgPerm.status === Location.PermissionStatus.GRANTED) {
        await Location.startLocationUpdatesAsync(ACTIVITY_MONITOR_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3500,
          distanceInterval: 0,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: `S-Now • Monitorando (${ACTIVITY_LABELS[activity]})`,
            notificationBody:
              'Coletando latência, jitter e estabilidade de rede em segundo plano.',
            notificationColor: '#C86237',
            killServiceOnDestroy: true,
          },
        });
        backgroundModeUsed = true;
      }
    }
  } catch (err) {
    console.warn('Foreground service indisponível, operando em timer local:', err);
  }

  const session: ActiveMonitorSession = {
    id: `act-${Date.now()}`,
    activity,
    activityLabel: ACTIVITY_LABELS[activity],
    startTime: Date.now(),
    ssid: currentSsid,
    latencySamples: [],
    rssiSamples: [],
    failedProbes: 0,
    totalProbes: 0,
    interruptionsCount: 0,
    lastSampleTime: 0,
    backgroundModeUsed,
  };

  await writeActiveSession(session);

  // Coleta imediata e intervalo auxiliar enquanto o app está visível
  collectMonitorSample();
  if (foregroundTimer) clearInterval(foregroundTimer);
  foregroundTimer = setInterval(() => {
    collectMonitorSample();
  }, 3500);

  return session;
}

async function stopLocationServiceIfRunning(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(ACTIVITY_MONITOR_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(ACTIVITY_MONITOR_TASK);
    }
  } catch {
    // Ignora caso não estivesse rodando
  }
}

/**
 * Encerra o monitoramento, para o Foreground Service e gera o relatório final consolidado.
 */
export async function stopActivityMonitoring(): Promise<ActivityMonitorReport | null> {
  if (foregroundTimer) {
    clearInterval(foregroundTimer);
    foregroundTimer = null;
  }

  await stopLocationServiceIfRunning();

  const session = await readActiveSession();
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

  if (!session) return null;

  const endTime = Date.now();
  const durationSeconds = Math.max(1, Math.round((endTime - session.startTime) / 1000));

  const { latencySamples, rssiSamples, totalProbes, failedProbes, interruptionsCount } = session;

  const averageLatencyMs =
    latencySamples.length > 0
      ? Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length)
      : null;

  const maxLatencyMs =
    latencySamples.length > 0 ? Math.max(...latencySamples) : null;

  let jitterMs: number | null = null;
  if (latencySamples.length > 1) {
    let jSum = 0;
    for (let i = 1; i < latencySamples.length; i++) {
      jSum += Math.abs(latencySamples[i] - latencySamples[i - 1]);
    }
    jitterMs = Math.round(jSum / (latencySamples.length - 1));
  } else if (latencySamples.length === 1) {
    jitterMs = 0;
  }

  const packetLossPercent =
    totalProbes > 0 ? Math.round((failedProbes / totalProbes) * 100) : 0;

  const averageRssi =
    rssiSamples.length > 0
      ? Math.round(rssiSamples.reduce((a, b) => a + b, 0) / rssiSamples.length)
      : null;

  // Cálculo de estabilidade da rede (0 a 100%)
  let stabilityPercent = 100;
  stabilityPercent -= packetLossPercent * 1.4;
  if (jitterMs !== null && jitterMs > 25) {
    stabilityPercent -= Math.min(25, (jitterMs - 25) * 0.6);
  }
  if (averageLatencyMs !== null && averageLatencyMs > 120) {
    stabilityPercent -= Math.min(20, (averageLatencyMs - 120) * 0.15);
  }
  if (interruptionsCount > 0) {
    stabilityPercent -= Math.min(30, interruptionsCount * 6);
  }
  stabilityPercent = Math.max(0, Math.min(100, Math.round(stabilityPercent)));

  let verdict = `Rede estável durante ${session.activityLabel.toLowerCase()}.`;
  if (stabilityPercent >= 85 && packetLossPercent === 0) {
    verdict = `Excelente estabilidade de rede para ${session.activityLabel.toLowerCase()}, sem interrupções detectadas.`;
  } else if (stabilityPercent < 60 || packetLossPercent >= 10) {
    verdict = `Instabilidade relevante observada na rede durante ${session.activityLabel.toLowerCase()}, com picos ou perda de pacotes.`;
  } else if (jitterMs !== null && jitterMs > 30) {
    verdict = `Latência com variação (jitter ±${jitterMs} ms) que pode afetar a fluidez em ${session.activityLabel.toLowerCase()}.`;
  }

  return {
    id: session.id,
    activity: session.activity,
    activityLabel: session.activityLabel,
    startTime: session.startTime,
    endTime,
    durationSeconds,
    ssid: session.ssid,
    averageLatencyMs,
    maxLatencyMs,
    jitterMs,
    packetLossPercent,
    interruptionsCount,
    stabilityPercent,
    averageRssi,
    latencySamples,
    rssiSamples,
    verdict,
    backgroundModeUsed: session.backgroundModeUsed,
  };
}
