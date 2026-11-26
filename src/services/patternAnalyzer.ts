import type {
  DiagnosticRecord,
  ActivityMonitorReport,
  TimePatternInsight,
} from '../types/snow';

export interface PatternAnalysisResult {
  hasSufficientData: boolean;
  totalSamplesAnalyzed: number;
  distinctDaysCount: number;
  insights: TimePatternInsight[];
  summary: string;
}

interface NormalizedEvent {
  timestamp: number;
  latencyMs: number | null;
  packetLoss: number;
  isUnstable: boolean;
}

type PeriodId = 'madrugada' | 'manha' | 'tarde' | 'noite';

const PERIODS: Record<PeriodId, { label: string; hourRange: string }> = {
  madrugada: { label: 'Madrugada', hourRange: '00h – 06h' },
  manha: { label: 'Manhã', hourRange: '06h – 12h' },
  tarde: { label: 'Tarde', hourRange: '12h – 18h' },
  noite: { label: 'Noite', hourRange: '18h – 00h' },
};

function getPeriodForHour(hour: number): PeriodId {
  if (hour >= 0 && hour < 6) return 'madrugada';
  if (hour >= 6 && hour < 12) return 'manha';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Analisa automaticamente diagnósticos e relatórios de monitoramento existentes
 * para identificar padrões recorrentes de instabilidade por horário e comparar dias/períodos.
 * Só apresenta padrões quando há dados suficientes.
 */
export function analyzeTimeInstabilityPatterns(
  diagnostics: DiagnosticRecord[],
  activityReports: ActivityMonitorReport[]
): PatternAnalysisResult {
  const events: NormalizedEvent[] = [];

  for (const d of diagnostics) {
    if (d.isWalkingSession) continue;
    const isUnstable =
      d.overallCondition === 'atencao' ||
      d.overallCondition === 'critica' ||
      (d.averageLatencyMs !== null && d.averageLatencyMs > 120) ||
      d.packetLossPercent > 5;

    events.push({
      timestamp: d.timestamp,
      latencyMs: d.averageLatencyMs,
      packetLoss: d.packetLossPercent,
      isUnstable,
    });
  }

  for (const r of activityReports) {
    const isUnstable =
      r.stabilityPercent < 75 ||
      (r.averageLatencyMs !== null && r.averageLatencyMs > 120) ||
      r.packetLossPercent > 5 ||
      r.interruptionsCount >= 2;

    events.push({
      timestamp: r.startTime,
      latencyMs: r.averageLatencyMs,
      packetLoss: r.packetLossPercent,
      isUnstable,
    });
  }

  const distinctDays = new Set(events.map((e) => getDayKey(e.timestamp)));

  // Requisito: só apresentar padrões com dados suficientes (mínimo 4 medições)
  if (events.length < 4) {
    return {
      hasSufficientData: false,
      totalSamplesAnalyzed: events.length,
      distinctDaysCount: distinctDays.size,
      insights: [],
      summary: `Coletadas ${events.length} de 4 medições mínimas para identificar padrões por horário.`,
    };
  }

  const buckets: Record<PeriodId, NormalizedEvent[]> = {
    madrugada: [],
    manha: [],
    tarde: [],
    noite: [],
  };

  for (const ev of events) {
    const hour = new Date(ev.timestamp).getHours();
    buckets[getPeriodForHour(hour)].push(ev);
  }

  const insights: TimePatternInsight[] = [];
  const periodOrder: PeriodId[] = ['manha', 'tarde', 'noite', 'madrugada'];

  for (const pid of periodOrder) {
    const list = buckets[pid];
    // Exige pelo menos 2 medições no período para evitar conclusões precipitadas
    if (list.length < 2) continue;

    const periodDays = new Set(list.map((e) => getDayKey(e.timestamp))).size;
    const validLatencies = list
      .map((e) => e.latencyMs)
      .filter((l): l is number => l !== null);

    const avgLatencyMs =
      validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : null;

    const avgPacketLoss = Math.round(
      list.reduce((a, b) => a + b.packetLoss, 0) / list.length
    );

    const unstableCount = list.filter((e) => e.isUnstable).length;
    const instabilityRate = Math.round((unstableCount / list.length) * 100);

    let severity: 'normal' | 'atencao' | 'alta' = 'normal';
    let description = `Desempenho consistente nas ${list.length} medições deste período.`;

    if (instabilityRate >= 60 || (avgLatencyMs !== null && avgLatencyMs > 150) || avgPacketLoss >= 10) {
      severity = 'alta';
      description = `Instabilidade recorrente (${instabilityRate}% das medições degradadas${
        avgLatencyMs !== null ? `, latência média ${avgLatencyMs} ms` : ''
      }).`;
    } else if (instabilityRate >= 30 || (avgLatencyMs !== null && avgLatencyMs > 100)) {
      severity = 'atencao';
      description = `Oscilações ocasionais detectadas (${instabilityRate}% de registros instáveis).`;
    }

    insights.push({
      periodId: pid,
      periodLabel: PERIODS[pid].label,
      hourRange: PERIODS[pid].hourRange,
      sampleCount: list.length,
      daysCount: periodDays,
      avgLatencyMs,
      avgPacketLoss,
      instabilityRate,
      severity,
      description,
    });
  }

  if (insights.length === 0) {
    return {
      hasSufficientData: false,
      totalSamplesAnalyzed: events.length,
      distinctDaysCount: distinctDays.size,
      insights: [],
      summary: 'As medições ainda estão dispersas; realize ao menos 2 análises em um mesmo período do dia.',
    };
  }

  const worst = [...insights].sort((a, b) => b.instabilityRate - a.instabilityRate)[0];
  let summary = `Análise baseada em ${events.length} medições em ${distinctDays.size} dia(s): rede estável nos períodos observados.`;

  if (worst.severity === 'alta') {
    summary = `Padrão detectado: o período da ${worst.periodLabel.toLowerCase()} (${worst.hourRange}) concentra maior instabilidade (${worst.instabilityRate}%).`;
  } else if (worst.severity === 'atencao') {
    summary = `Tendência moderada de oscilação observada no período da ${worst.periodLabel.toLowerCase()} (${worst.hourRange}).`;
  }

  return {
    hasSufficientData: true,
    totalSamplesAnalyzed: events.length,
    distinctDaysCount: distinctDays.size,
    insights,
    summary,
  };
}
