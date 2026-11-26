import type { WifiNetwork, CurrentNetworkInfo } from 'munim-wifi';
import type {
  DiagnosticRecord,
  DiagnosticIssue,
  OverallCondition,
  ConfidenceLevel,
  QualityDimension,
  WifiSecurityAudit,
  HeatmapPoint,
} from '../types/snow';
import type { ProbeResult } from './networkProber';
import { auditWifiSecurity } from './securityAuditor';

export interface DiagnosticInput {
  connectedNetwork: CurrentNetworkInfo | null;
  nearbyNetworks: WifiNetwork[];
  signalSamples: number[];
  internetMetrics: ProbeResult;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    samplesCount?: number;
  } | null;
  minRssiThreshold?: number;
}

interface CollectedMetrics {
  id: string;
  timestamp: number;
  dateFormatted: string;
  timeFormatted: string;
  isWifiConnected: boolean;
  connectedNetwork: CurrentNetworkInfo | null;
  rssi: number | null;
  minSignal: number | null;
  maxSignal: number | null;
  signalVariation: number;
  coChannelInterferenceCount: number;
  nearbyNetworks: WifiNetwork[];
  signalSamples: number[];
  internetMetrics: ProbeResult;
  location: DiagnosticInput['location'];
  minRssiThreshold: number;
}

interface AnalysisResult {
  collected: CollectedMetrics;
  wifiQuality: QualityDimension;
  internetQuality: QualityDimension;
  securityAudit: WifiSecurityAudit;
  issues: DiagnosticIssue[];
  causes: string[];
  recommendations: string[];
}

interface ClassificationResult {
  overallScore: number;
  overallCondition: OverallCondition;
  summary: string;
  confidenceLevel: ConfidenceLevel;
}

function scoreToCondition(score: number): OverallCondition {
  if (score >= 85) return 'excelente';
  if (score >= 70) return 'estavel';
  if (score >= 45) return 'atencao';
  return 'critica';
}

// ==========================================
// ETAPA 1: COLETA E NORMALIZAÇÃO
// ==========================================
function collectNormalizedMetrics(input: DiagnosticInput): CollectedMetrics {
  const now = new Date();
  const timestamp = Date.now();
  const { connectedNetwork, nearbyNetworks, signalSamples, internetMetrics, location } = input;

  const isWifiConnected =
    !!connectedNetwork &&
    typeof connectedNetwork.ssid === 'string' &&
    connectedNetwork.ssid.trim().length > 0 &&
    connectedNetwork.ssid !== '<unknown ssid>';

  let rssi: number | null = null;
  let minSignal: number | null = null;
  let maxSignal: number | null = null;
  let signalVariation = 0;

  if (isWifiConnected && connectedNetwork) {
    const validSamples = signalSamples.filter((s) => typeof s === 'number' && !Number.isNaN(s));
    if (validSamples.length > 0) {
      minSignal = Math.min(...validSamples);
      maxSignal = Math.max(...validSamples);
      signalVariation = Math.abs(maxSignal - minSignal);
      rssi = connectedNetwork.rssi ?? validSamples[validSamples.length - 1];
    } else if (typeof connectedNetwork.rssi === 'number') {
      rssi = connectedNetwork.rssi;
      minSignal = rssi;
      maxSignal = rssi;
    }
  }

  let coChannelInterferenceCount = 0;
  if (isWifiConnected && connectedNetwork?.channel !== undefined) {
    coChannelInterferenceCount = nearbyNetworks.filter(
      (n) => n.bssid !== connectedNetwork.bssid && n.channel === connectedNetwork.channel
    ).length;
  }

  return {
    id: `diag-${timestamp}`,
    timestamp,
    dateFormatted: now.toLocaleDateString('pt-BR'),
    timeFormatted: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    isWifiConnected,
    connectedNetwork: isWifiConnected ? connectedNetwork : null,
    rssi,
    minSignal,
    maxSignal,
    signalVariation,
    coChannelInterferenceCount,
    nearbyNetworks,
    signalSamples,
    internetMetrics,
    location: location ?? null,
    minRssiThreshold: input.minRssiThreshold ?? -70,
  };
}

// ==========================================
// ETAPA 2: ANÁLISE SEPARADA (WI-FI vs INTERNET + SEGURANÇA)
// ==========================================
function analyzeMetrics(collected: CollectedMetrics): AnalysisResult {
  const {
    isWifiConnected,
    connectedNetwork,
    rssi,
    minSignal,
    maxSignal,
    signalVariation,
    coChannelInterferenceCount,
    internetMetrics,
    nearbyNetworks,
    minRssiThreshold,
  } = collected;

  const issues: DiagnosticIssue[] = [];
  const causes: string[] = [];
  const recommendations: string[] = [];

  const securityAudit = auditWifiSecurity(connectedNetwork, nearbyNetworks);

  // --- A) Análise da Qualidade do Wi-Fi ---
  let wifiScore = 100;
  let wifiSummary = 'Link sem fio estável e com boa intensidade.';

  if (!isWifiConnected || !connectedNetwork || rssi === null) {
    wifiScore = 0;
    wifiSummary = 'Sem conexão Wi-Fi ativa no aparelho.';
    issues.push({
      id: 'no-connection',
      title: 'Wi-Fi Desconectado',
      description:
        'O aparelho não está associado a nenhuma rede Wi-Fi. Redes próximas não são utilizadas como substitutas.',
      severity: 'alta',
    });
    causes.push('Wi-Fi desconectado ou fora da área de cobertura de redes salvas.');
    recommendations.push('Conecte o aparelho a uma rede Wi-Fi e repita o diagnóstico.');
  } else {
    if (rssi >= -55) {
      wifiSummary = 'Sinal Wi-Fi forte e próximo do ideal.';
    } else if (rssi >= minRssiThreshold) {
      wifiScore -= 12;
      wifiSummary = 'Sinal Wi-Fi adequado para uso cotidiano.';
    } else if (rssi >= -78) {
      wifiScore -= 30;
      wifiSummary = 'Sinal Wi-Fi atenuado neste ponto.';
      issues.push({
        id: 'weak-signal',
        title: 'Sinal Wi-Fi moderado/baixo',
        description: `Intensidade medida em ${rssi} dBm (abaixo do limite configurado de ${minRssiThreshold} dBm).`,
        severity: 'media',
      });
      causes.push('Distância até o roteador ou barreiras físicas (paredes/espelhos).');
      recommendations.push('Aproxime-se do ponto de acesso ou avalie posicionamento mais central.');
    } else {
      wifiScore -= 55;
      wifiSummary = 'Sinal Wi-Fi crítico na borda de cobertura.';
      issues.push({
        id: 'critical-signal',
        title: 'Sinal Wi-Fi muito fraco',
        description: `Intensidade crítica de ${rssi} dBm, com alto risco de queda de enlace.`,
        severity: 'alta',
      });
      causes.push('Aparelho operando no limite físico do alcance do roteador.');
      recommendations.push('Instale um nó Mesh ou ponto de acesso cabeado próximo a este cômodo.');
    }

    if (signalVariation >= 12) {
      wifiScore -= 15;
      issues.push({
        id: 'signal-instability',
        title: 'Oscilação significativa de sinal RF',
        description: `O sinal variou ${signalVariation} dBm (${minSignal} a ${maxSignal} dBm) durante a coleta.`,
        severity: 'media',
      });
      causes.push('Reflexões de sinal (multipath) ou interferência transitória no ambiente.');
      recommendations.push('Evite obstruções móveis próximas ao roteador ou teste na banda de 5 GHz.');
    }

    if (coChannelInterferenceCount >= 3) {
      wifiScore -= 18;
      issues.push({
        id: 'co-channel-high',
        title: `Congestionamento no canal ${connectedNetwork.channel}`,
        description: `${coChannelInterferenceCount} redes vizinhas detectadas operando no mesmo canal (${connectedNetwork.channel}).`,
        severity: 'alta',
      });
      causes.push('Muitos roteadores vizinhos compartilhando o mesmo canal de rádio.');
      recommendations.push('Selecione um canal menos congestionado no painel do roteador ou priorize 5 GHz.');
    } else if (coChannelInterferenceCount >= 1) {
      wifiScore -= 6;
      issues.push({
        id: 'co-channel-medium',
        title: `Sobreposição no canal ${connectedNetwork.channel}`,
        description: `${coChannelInterferenceCount} rede vizinha operando no mesmo canal.`,
        severity: 'baixa',
      });
    }

    if (connectedNetwork.linkSpeedMbps !== undefined && connectedNetwork.linkSpeedMbps < 30) {
      wifiScore -= 10;
      issues.push({
        id: 'low-link-speed',
        title: 'Taxa de enlace reduzida',
        description: `Link rate negociado em ${connectedNetwork.linkSpeedMbps} Mbps.`,
        severity: 'media',
      });
    }
  }

  wifiScore = Math.max(0, Math.min(100, wifiScore));
  const wifiQuality: QualityDimension = {
    score: wifiScore,
    condition: scoreToCondition(wifiScore),
    summary: wifiSummary,
  };

  // --- B) Análise da Qualidade da Internet ---
  let internetScore = 100;
  let internetSummary = 'Conectividade externa rápida e estável.';

  if (internetMetrics.status === 'offline' || internetMetrics.averageLatencyMs === null) {
    internetScore = 0;
    internetSummary = 'Sem resposta dos servidores externos de teste.';
    if (isWifiConnected) {
      issues.push({
        id: 'internet-offline',
        title: 'Wi-Fi conectado sem acesso à Internet',
        description: 'O roteador responde localmente, mas as sondagens HTTP/DNS externas falharam.',
        severity: 'alta',
      });
      causes.push('Queda no link da operadora (WAN) ou falha de resolução DNS/Gateway.');
      recommendations.push('Reinicie o modem da operadora e verifique se há falha externa.');
    }
  } else {
    const avgLat = internetMetrics.averageLatencyMs;
    const jitter = internetMetrics.jitterMs ?? 0;
    const loss = internetMetrics.packetLossPercent;

    if (loss > 0) {
      internetScore -= Math.min(50, loss * 1.2);
      issues.push({
        id: 'packet-loss',
        title: 'Perda de pacotes detectada',
        description: `${loss}% das sondagens externas falharam durante o teste.`,
        severity: loss >= 20 ? 'alta' : 'media',
      });
      causes.push('Instabilidade na rota do provedor ou saturação momentânea do enlace.');
      recommendations.push('Verifique se há downloads pesados na rede e monitore o comportamento.');
    }

    if (avgLat > 160) {
      internetScore -= 30;
      issues.push({
        id: 'high-latency',
        title: 'Latência externa elevada',
        description: `RTT médio de ${avgLat} ms (acima do esperado para aplicações interativas).`,
        severity: 'alta',
      });
    } else if (avgLat > 90) {
      internetScore -= 14;
    }

    if (jitter > 35) {
      internetScore -= 15;
      issues.push({
        id: 'high-jitter',
        title: 'Jitter elevado na conexão',
        description: `Variação de latência medida em ±${jitter} ms. Pode prejudicar chamadas e jogos.`,
        severity: 'media',
      });
      causes.push('Fila excessiva no roteador (bufferbloat) ou disputa de banda por outros aparelhos.');
      recommendations.push('Reduza uploads/downloads simultâneos durante chamadas ou jogos.');
    }

    if (internetMetrics.downloadMbps !== null && internetMetrics.downloadMbps < 5) {
      internetScore -= 15;
      issues.push({
        id: 'low-throughput',
        title: 'Velocidade de resposta reduzida',
        description: `Taxa estimada na sondagem de ${internetMetrics.downloadMbps} Mbps.`,
        severity: 'media',
      });
    }

    // Correlação explícita Wi-Fi vs Internet
    if (isWifiConnected && rssi !== null && rssi >= -65 && internetScore < 65) {
      internetSummary = 'Wi-Fi forte, porém internet lenta ou instável.';
      causes.push('Gargalo externo no provedor ou sobrecarga de banda, sem relação com o sinal Wi-Fi.');
    } else if (internetScore >= 85) {
      internetSummary = 'Internet com excelente latência e sem perdas.';
    } else if (internetScore >= 70) {
      internetSummary = 'Internet estável para streaming, chamadas e navegação.';
    } else {
      internetSummary = 'Internet com degradação perceptível de latência ou perda.';
    }
  }

  internetScore = Math.max(0, Math.min(100, Math.round(internetScore)));
  const internetQuality: QualityDimension = {
    score: internetScore,
    condition: scoreToCondition(internetScore),
    summary: internetSummary,
  };

  // --- C) Segurança Wi-Fi (alertas relevantes sem exagero) ---
  if (securityAudit.classification === 'fraca') {
    issues.push({
      id: 'weak-security',
      title: `Segurança da rede: ${securityAudit.protocol}`,
      description: securityAudit.warnings[0] ?? 'Padrão de criptografia fraco ou ausente.',
      severity: 'alta',
    });
    recommendations.push(...securityAudit.recommendations);
  }

  return {
    collected,
    wifiQuality,
    internetQuality,
    securityAudit,
    issues,
    causes: Array.from(new Set(causes)),
    recommendations: Array.from(new Set(recommendations)),
  };
}

// ==========================================
// ETAPA 3: CLASSIFICAÇÃO GLOBAL & CONFIANÇA
// ==========================================
function classifyDiagnosis(analysis: AnalysisResult): ClassificationResult {
  const { collected, wifiQuality, internetQuality } = analysis;

  if (!collected.isWifiConnected) {
    return {
      overallScore: 0,
      overallCondition: 'critica',
      summary: 'O dispositivo não está conectado a nenhuma rede Wi-Fi no momento.',
      confidenceLevel: 'alta',
    };
  }

  // Peso equilibrado: 55% Wi-Fi, 45% Internet; limitado caso um dos lados esteja crítico
  let overallScore = Math.round(wifiQuality.score * 0.55 + internetQuality.score * 0.45);
  if (internetQuality.score === 0) {
    overallScore = Math.min(overallScore, 35);
  }

  const overallCondition = scoreToCondition(overallScore);

  let summary = 'Conexão equilibrada entre Wi-Fi e Internet.';
  if (overallCondition === 'excelente') {
    summary = 'Excelente: sinal Wi-Fi robusto e internet responsiva sem perdas.';
  } else if (overallCondition === 'estavel') {
    summary = 'Estável: rede apta para navegação, chamadas e streaming.';
  } else if (overallCondition === 'atencao') {
    if (wifiQuality.score >= 75 && internetQuality.score < 65) {
      summary = 'Atenção: sinal Wi-Fi forte no local, mas a internet externa apresenta lentidão ou instabilidade.';
    } else if (wifiQuality.score < 65 && internetQuality.score >= 75) {
      summary = 'Atenção: internet estável, porém o sinal Wi-Fi está atenuado neste ponto.';
    } else {
      summary = 'Atenção: há degradação parcial de sinal, interferência ou latência.';
    }
  } else {
    summary = 'Crítica: sinal Wi-Fi severamente fraco ou conexão externa indisponível.';
  }

  let confidenceLevel: ConfidenceLevel = 'alta';
  if (collected.signalSamples.length < 3 || collected.internetMetrics.latencySamples.length < 3) {
    confidenceLevel = 'media';
  }
  if (!collected.connectedNetwork?.frequency || !collected.connectedNetwork?.channel) {
    confidenceLevel = 'baixa';
  }

  return {
    overallScore,
    overallCondition,
    summary,
    confidenceLevel,
  };
}

// ==========================================
// ORQUESTRADOR DO PIPELINE MODULAR
// ==========================================
export function runDiagnosticAnalysis(
  input: DiagnosticInput,
  existingHeatmapPointsCount: number = 0
): DiagnosticRecord {
  const collected = collectNormalizedMetrics(input);
  const analysis = analyzeMetrics(collected);
  const classification = classifyDiagnosis(analysis);

  const {
    id,
    timestamp,
    dateFormatted,
    timeFormatted,
    isWifiConnected,
    connectedNetwork,
    signalSamples,
    signalVariation,
    internetMetrics,
    nearbyNetworks,
    coChannelInterferenceCount,
    location,
  } = collected;

  // Ponto de Heatmap acoplado ao diagnóstico (somente se houver localização válida e rede conectada)
  let heatmapPoints: HeatmapPoint[] | undefined;
  if (location && isWifiConnected && connectedNetwork && collected.rssi !== null) {
    const angle = (existingHeatmapPointsCount * 60 * Math.PI) / 180;
    const radius = existingHeatmapPointsCount === 0 ? 0 : 20 + (existingHeatmapPointsCount % 4) * 10;
    const x = Math.max(12, Math.min(88, Math.round(50 + radius * Math.cos(angle))));
    const y = Math.max(12, Math.min(88, Math.round(50 + radius * Math.sin(angle))));

    heatmapPoints = [
      {
        id: `pt-${id}`,
        diagnosticId: id,
        timestamp,
        label:
          existingHeatmapPointsCount === 0
            ? `Origem (${timeFormatted})`
            : `${connectedNetwork.ssid} (${timeFormatted})`,
        rssi: collected.rssi,
        channel: connectedNetwork.channel,
        frequency: connectedNetwork.frequency,
        x,
        y,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      },
    ];
  }

  return {
    id,
    timestamp,
    dateFormatted,
    timeFormatted,
    overallCondition: classification.overallCondition,
    score: classification.overallScore,
    summary: classification.summary,
    confidenceLevel: classification.confidenceLevel,
    wifiQuality: analysis.wifiQuality,
    internetQuality: analysis.internetQuality,
    securityAudit: analysis.securityAudit,
    isWifiConnected,
    connectedNetwork:
      isWifiConnected && connectedNetwork && collected.rssi !== null
        ? {
            ssid: connectedNetwork.ssid,
            bssid: connectedNetwork.bssid,
            rssi: collected.rssi,
            frequency: connectedNetwork.frequency,
            channel: connectedNetwork.channel,
            bandGhz: connectedNetwork.bandGhz,
            wifiStandard: connectedNetwork.wifiStandard,
            securityType: connectedNetwork.securityType,
            linkSpeedMbps: connectedNetwork.linkSpeedMbps,
            txLinkSpeedMbps: connectedNetwork.txLinkSpeedMbps,
            rxLinkSpeedMbps: connectedNetwork.rxLinkSpeedMbps,
            ipAddress: connectedNetwork.ipAddress,
            gateway: connectedNetwork.gateway,
            dnsServers: connectedNetwork.dnsServers,
          }
        : null,
    signalSamples,
    signalVariation,
    internetStatus: internetMetrics.status,
    latencySamples: internetMetrics.latencySamples,
    averageLatencyMs: internetMetrics.averageLatencyMs,
    jitterMs: internetMetrics.jitterMs,
    packetLossPercent: internetMetrics.packetLossPercent,
    dnsLatencyMs: internetMetrics.dnsLatencyMs,
    httpLatencyMs: internetMetrics.httpLatencyMs,
    downloadMbps: internetMetrics.downloadMbps,
    nearbyNetworksCount: nearbyNetworks.length,
    nearbyNetworks,
    coChannelInterferenceCount,
    location: location ?? null,
    heatmapPoints,
    issues: analysis.issues,
    causes: analysis.causes,
    recommendations: analysis.recommendations,
  };
}
