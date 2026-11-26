import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { colors, getSignalColor } from '../theme/colors';

interface SignalChartProps {
  samples: number[];
  type?: 'rssi' | 'latency';
  width?: number;
  height?: number;
  title?: string;
}

export function SignalChart({
  samples,
  type = 'rssi',
  width = 320,
  height = 110,
  title,
}: SignalChartProps) {
  if (!samples || samples.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width, height }]}>
        <Text style={styles.emptyText}>Sem amostras suficientes para gráfico</Text>
      </View>
    );
  }

  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Escalas
  let minY: number;
  let maxY: number;
  let unit: string;

  if (type === 'rssi') {
    // Escala RSSI de -95 a -35 dBm
    minY = -95;
    maxY = -35;
    unit = 'dBm';
  } else {
    // Escala Latência em ms
    const maxVal = Math.max(100, ...samples);
    minY = 0;
    maxY = Math.ceil(maxVal * 1.25);
    unit = 'ms';
  }

  const getYCoord = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    const ratio = (clamped - minY) / (maxY - minY);
    // Inverte o eixo Y pois SVG começa do topo (0)
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  const getXCoord = (index: number) => {
    if (samples.length === 1) return paddingLeft + chartWidth / 2;
    const step = chartWidth / (samples.length - 1);
    return paddingLeft + index * step;
  };

  // Linhas guia horizontais
  const gridLines = type === 'rssi' ? [-40, -60, -80] : [Math.round(maxY * 0.33), Math.round(maxY * 0.66)];

  // Constrói o caminho SVG da linha
  const pathD = samples
    .map((val, idx) => {
      const x = getXCoord(idx).toFixed(1);
      const y = getYCoord(val).toFixed(1);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const strokeColor = type === 'rssi' ? getSignalColor(samples[samples.length - 1]) : colors.accent;

  return (
    <View style={styles.wrapper}>
      {title ? <Text style={styles.chartTitle}>{title}</Text> : null}
      <Svg width={width} height={height}>
        {/* Linhas de Grade e Rótulos do Eixo Y */}
        {gridLines.map((val) => {
          const y = getYCoord(val);
          return (
            <React.Fragment key={`grid-${val}`}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke={colors.border}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 3}
                fill={colors.textTertiary}
                fontSize="9"
                textAnchor="end"
              >
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Linha de Traçado dos Dados */}
        <Path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos nas amostras */}
        {samples.map((val, idx) => {
          const cx = getXCoord(idx);
          const cy = getYCoord(val);
          return (
            <Circle
              key={`pt-${idx}`}
              cx={cx}
              cy={cy}
              r="3"
              fill={strokeColor}
              stroke={colors.backgroundSecondary}
              strokeWidth="1.5"
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceGlass,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
