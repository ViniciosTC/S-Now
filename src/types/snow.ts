import type { WifiNetwork } from 'munim-wifi';

export type OverallCondition = 'excelente' | 'estavel' | 'atencao' | 'critica';
export type ConfidenceLevel = 'alta' | 'media' | 'baixa';
export type InternetStatus = 'excelente' | 'estavel' | 'degradada' | 'offline' | 'indisponivel';

export interface DiagnosticIssue {
  id: string;
  title: string;
  description: string;
  severity: 'baixa' | 'media' | 'alta';
}

export interface QualityDimension {
  score: number; // 0 a 100
  condition: OverallCondition;
  summary: string;
}

export type SecurityClassification = 'boa' | 'atencao' | 'fraca' | 'indisponivel';

export interface WifiSecurityAudit {
  classification: SecurityClassification;
  label: 'Boa proteção' | 'Atenção' | 'Proteção fraca' | 'Indisponível';
  isOpen: boolean;
  protocol: string;
  encryption: string | null;
  authentication: string | null;
  rawCapabilities?: string;
  warnings: string[];
  recommendations: string[];
}

export interface HeatmapPoint {
  id: string;
  diagnosticId: string;
  timestamp: number;
  label: string;
  rssi: number;
  channel?: number;
  frequency?: number;
  x: number; // 0 a 100 (% horizontal no canvas)
  y: number; // 0 a 100 (% vertical no canvas)
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
}

export interface DiagnosticRecord {
  id: string;
  timestamp: number;
  dateFormatted: string;
  timeFormatted: string;
  overallCondition: OverallCondition;
  score: number; // 0 a 100
  summary: string;
  confidenceLevel: ConfidenceLevel;
  isWalkingSession?: boolean;

  // Dimensões separadas (Wi-Fi vs Internet)
  wifiQuality: QualityDimension;
  internetQuality: QualityDimension;

  // Auditoria de Segurança Wi-Fi
  securityAudit: WifiSecurityAudit;

  // Informações da Rede Conectada Real
  isWifiConnected: boolean;
  connectedNetwork: {
    ssid: string;
    bssid: string;
    rssi: number;
    frequency?: number;
    channel?: number;
    bandGhz?: number;
    wifiStandard?: string;
    securityType?: string;
    linkSpeedMbps?: number;
    txLinkSpeedMbps?: number;
    rxLinkSpeedMbps?: number;
    ipAddress?: string;
    gateway?: string;
    dnsServers?: string[];
  } | null;

  // Dinâmica do Sinal durante a coleta
  signalSamples: number[];
  signalVariation: number; // Max - Min durante a janela

  // Métricas de Internet e Latência Reais
  internetStatus: InternetStatus;
  latencySamples: number[];
  averageLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
  dnsLatencyMs: number | null;
  httpLatencyMs: number | null;
  downloadMbps: number | null;

  // Redes Próximas (apenas como fonte complementar de análise de espectro)
  nearbyNetworksCount: number;
  nearbyNetworks: WifiNetwork[];
  coChannelInterferenceCount: number;

  // Localização Real (se disponível)
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    samplesCount?: number;
  } | null;

  // Pontos de Heatmap pertencentes a este diagnóstico
  heatmapPoints?: HeatmapPoint[];

  issues: DiagnosticIssue[];
  causes: string[];
  recommendations: string[];
}

export type ActivityType = 'jogos' | 'chamadas' | 'streaming' | 'navegacao' | 'outra';

export interface ActivityMonitorReport {
  id: string;
  activity: ActivityType;
  activityLabel: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  ssid: string | null;
  averageLatencyMs: number | null;
  maxLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
  interruptionsCount: number;
  stabilityPercent: number;
  averageRssi: number | null;
  latencySamples: number[];
  rssiSamples: number[];
  verdict: string;
  backgroundModeUsed: boolean;
}

export interface TimePatternInsight {
  periodId: 'madrugada' | 'manha' | 'tarde' | 'noite';
  periodLabel: string;
  hourRange: string;
  sampleCount: number;
  daysCount: number;
  avgLatencyMs: number | null;
  avgPacketLoss: number;
  instabilityRate: number; // 0 a 100%
  severity: 'normal' | 'atencao' | 'alta';
  description: string;
}

export type ScreenName =
  | 'home'
  | 'diagnostico'
  | 'resultado'
  | 'historico'
  | 'detalhes'
  | 'heatmap'
  | 'monitoramento'
  | 'configuracoes';

export type DiagnosticPeriod = 'Hoje' | 'Ontem' | 'Esta semana' | 'Anteriores';
