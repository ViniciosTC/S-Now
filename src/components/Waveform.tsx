import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, getSignalColor } from '../theme/colors';

interface WaveformProps {
  rssi?: number | null;
  variation?: number; // dBm variation
  width?: number;
  height?: number;
}

export function Waveform({
  rssi = -60,
  variation = 3,
  width = 300,
  height = 90,
}: WaveformProps) {
  const [phase, setPhase] = useState(0);
  const animRef = useRef<number | null>(null);

  // Normaliza amplitude baseada no sinal (dBm)
  // -30 dBm (muito forte) -> amplitude alta (26px)
  // -85 dBm (muito fraco) -> amplitude baixa (8px)
  const currentRssi = rssi ?? -70;
  const clampedRssi = Math.max(-90, Math.min(-35, currentRssi));
  const baseAmplitude = 8 + ((clampedRssi - (-90)) / 55) * 20;

  // Frequência baseada na estabilidade / variação
  const frequency = 0.02 + Math.min(0.02, (variation / 15) * 0.015);

  const signalColor = getSignalColor(currentRssi);

  useEffect(() => {
    let currentPhase = 0;
    const interval = setInterval(() => {
      currentPhase += 0.06;
      setPhase(currentPhase);
    }, 40);

    return () => clearInterval(interval);
  }, []);

  // Gera o caminho suave da onda (curva senoidal com harmônica)
  const generateWavePath = (offsetPhase: number, ampMultiplier: number = 1.0) => {
    const centerY = height / 2;
    const points: string[] = [];
    const steps = 40;
    const dx = width / steps;

    for (let i = 0; i <= steps; i++) {
      const x = i * dx;
      const y =
        centerY +
        Math.sin(x * frequency + phase + offsetPhase) * (baseAmplitude * ampMultiplier) +
        Math.cos(x * frequency * 0.5 + phase * 0.8) * (baseAmplitude * 0.3 * ampMultiplier);

      if (i === 0) {
        points.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
      } else {
        points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
    }
    return points.join(' ');
  };

  const mainPath = generateWavePath(0, 1.0);
  const secondaryPath = generateWavePath(Math.PI * 0.5, 0.65);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={signalColor} stopOpacity="0.1" />
            <Stop offset="30%" stopColor={signalColor} stopOpacity="0.8" />
            <Stop offset="70%" stopColor={colors.accent} stopOpacity="0.7" />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.2" />
          </LinearGradient>
          <LinearGradient id="secondaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.tealLight} stopOpacity="0.1" />
            <Stop offset="50%" stopColor={colors.tealLight} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={colors.tealLight} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>

        {/* Onda secundária difusa */}
        <Path
          d={secondaryPath}
          fill="none"
          stroke="url(#secondaryGrad)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Onda principal nítida */}
        <Path
          d={mainPath}
          fill="none"
          stroke="url(#waveGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
