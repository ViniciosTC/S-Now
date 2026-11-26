import type { InternetStatus } from '../types/snow';

export interface ProbeResult {
  latencySamples: number[];
  averageLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
  dnsLatencyMs: number | null;
  httpLatencyMs: number | null;
  downloadMbps: number | null;
  status: InternetStatus;
}

const DNS_ENDPOINT = 'https://dns.google/resolve?name=example.com';
const HTTP_ENDPOINTS = [
  'https://1.1.1.1/cdn-cgi/trace',
  'https://www.cloudflare.com/cdn-cgi/trace',
];
const SPEED_PROBE_URL = 'https://speed.cloudflare.com/__down?bytes=200000';

export async function measureSingleProbe(
  url: string,
  timeoutMs: number = 2200
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const separator = url.includes('?') ? '&' : '?';
  const start = Date.now();
  try {
    const res = await fetch(`${url}${separator}_t=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);
    if (res.ok || res.status === 200 || res.status === 204) {
      return Math.max(1, Date.now() - start);
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function measureDownloadSpeedMbps(timeoutMs: number = 4000): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(`${SPEED_PROBE_URL}&_t=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      clearTimeout(timer);
      return null;
    }
    const text = await res.text();
    clearTimeout(timer);

    const elapsedSec = (Date.now() - start) / 1000;
    const bytes = text.length;
    if (elapsedSec <= 0 || bytes < 1000) return null;

    const mbps = (bytes * 8) / elapsedSec / 1_000_000;
    return Math.round(mbps * 10) / 10;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function probeInternetMetrics(
  sampleCount: number = 5,
  onSample?: (sample: number | null, index: number) => void
): Promise<ProbeResult> {
  const samples: number[] = [];
  const dnsSamples: number[] = [];
  const httpSamples: number[] = [];
  let failures = 0;

  for (let i = 0; i < sampleCount; i++) {
    const isDnsTurn = i % 2 === 1;
    const endpoint = isDnsTurn
      ? DNS_ENDPOINT
      : HTTP_ENDPOINTS[i % HTTP_ENDPOINTS.length];

    const rtt = await measureSingleProbe(endpoint, 2200);

    if (rtt !== null) {
      samples.push(rtt);
      if (isDnsTurn) dnsSamples.push(rtt);
      else httpSamples.push(rtt);
      onSample?.(rtt, i);
    } else {
      failures++;
      onSample?.(null, i);
    }

    if (i < sampleCount - 1) {
      await new Promise((res) => setTimeout(res, 350));
    }
  }

  const packetLossPercent = Math.round((failures / sampleCount) * 100);

  if (samples.length === 0) {
    return {
      latencySamples: [],
      averageLatencyMs: null,
      jitterMs: null,
      packetLossPercent: 100,
      dnsLatencyMs: null,
      httpLatencyMs: null,
      downloadMbps: null,
      status: 'offline',
    };
  }

  const averageLatencyMs = Math.round(
    samples.reduce((acc, val) => acc + val, 0) / samples.length
  );

  const dnsLatencyMs =
    dnsSamples.length > 0
      ? Math.round(dnsSamples.reduce((a, b) => a + b, 0) / dnsSamples.length)
      : null;

  const httpLatencyMs =
    httpSamples.length > 0
      ? Math.round(httpSamples.reduce((a, b) => a + b, 0) / httpSamples.length)
      : null;

  // Jitter RFC 3550 (variação média entre amostras sequenciais)
  let jitterSum = 0;
  for (let j = 1; j < samples.length; j++) {
    jitterSum += Math.abs(samples[j] - samples[j - 1]);
  }
  const jitterMs = samples.length > 1 ? Math.round(jitterSum / (samples.length - 1)) : 0;

  // Teste leve de throughput real (200 KB) — retorna null se falhar
  const downloadMbps = await measureDownloadSpeedMbps(4000);

  let status: InternetStatus = 'estavel';
  if (packetLossPercent > 40) {
    status = 'degradada';
  } else if (averageLatencyMs <= 60 && jitterMs <= 15 && packetLossPercent === 0) {
    status = 'excelente';
  } else if (averageLatencyMs <= 130 && jitterMs <= 35 && packetLossPercent <= 10) {
    status = 'estavel';
  } else {
    status = 'degradada';
  }

  return {
    latencySamples: samples,
    averageLatencyMs,
    jitterMs,
    packetLossPercent,
    dnsLatencyMs,
    httpLatencyMs,
    downloadMbps,
    status,
  };
}
