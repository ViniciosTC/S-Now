import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';

interface PulseRadarProps {
  size?: number;
  active?: boolean;
  color?: string;
}

export function PulseRadar({ size = 180, active = true, color = colors.primary }: PulseRadarProps) {
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);
      rotateAnim.setValue(0);
      return;
    }

    // Ondas expansivas
    const loop1 = Animated.loop(
      Animated.timing(pulseAnim1, {
        toValue: 1,
        duration: 2800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(pulseAnim2, {
          toValue: 1,
          duration: 2800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Varredura circular rotativa 360 graus
    const loopRotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop1.start();
    loop2.start();
    loopRotate.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loopRotate.stop();
    };
  }, [active, pulseAnim1, pulseAnim2, rotateAnim]);

  const scale1 = pulseAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.2],
  });

  const opacity1 = pulseAnim1.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.6, 0.3, 0],
  });

  const scale2 = pulseAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.2],
  });

  const opacity2 = pulseAnim2.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.6, 0.3, 0],
  });

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Círculos de grade do Radar */}
      <View style={[styles.staticGrid, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={size * 0.45}
            stroke={colors.border}
            strokeWidth="1"
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={size * 0.3}
            stroke={colors.borderMuted}
            strokeWidth="1"
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={size * 0.15}
            stroke={colors.borderMuted}
            strokeWidth="1"
            fill="none"
          />
          {/* Eixos cruzados discretos */}
          <Line
            x1={center}
            y1={size * 0.05}
            x2={center}
            y2={size * 0.95}
            stroke={colors.borderMuted}
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <Line
            x1={size * 0.05}
            y1={center}
            x2={size * 0.95}
            y2={center}
            stroke={colors.borderMuted}
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        </Svg>
      </View>

      {/* Pulso 1 */}
      {active && (
        <Animated.View
          style={[
            styles.waveRing,
            {
              width: size * 0.85,
              height: size * 0.85,
              borderRadius: (size * 0.85) / 2,
              borderColor: color,
              transform: [{ scale: scale1 }],
              opacity: opacity1,
            },
          ]}
        />
      )}

      {/* Pulso 2 */}
      {active && (
        <Animated.View
          style={[
            styles.waveRing,
            {
              width: size * 0.85,
              height: size * 0.85,
              borderRadius: (size * 0.85) / 2,
              borderColor: color,
              transform: [{ scale: scale2 }],
              opacity: opacity2,
            },
          ]}
        />
      )}

      {/* Linha de Varredura Circular Giratória (Sweep) */}
      {active && (
        <Animated.View
          style={[
            styles.sweepContainer,
            {
              width: size,
              height: size,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <View
            style={[
              styles.sweepLine,
              {
                height: size / 2,
                backgroundColor: color,
              },
            ]}
          />
        </Animated.View>
      )}

      {/* Núcleo Central */}
      <View
        style={[
          styles.core,
          {
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  staticGrid: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  sweepContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sweepLine: {
    width: 2,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    opacity: 0.85,
  },
  core: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
});
