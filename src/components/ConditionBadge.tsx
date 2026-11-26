import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import type { OverallCondition } from '../types/snow';

interface ConditionBadgeProps {
  condition: OverallCondition;
  size?: 'small' | 'normal' | 'large';
}

export function ConditionBadge({ condition, size = 'normal' }: ConditionBadgeProps) {
  const getConfig = () => {
    switch (condition) {
      case 'excelente':
        return {
          label: 'Excelente',
          color: colors.signalScale.excellent,
          bg: 'rgba(16, 185, 129, 0.16)',
          border: 'rgba(16, 185, 129, 0.35)',
        };
      case 'estavel':
        return {
          label: 'Estável',
          color: colors.signalScale.good,
          bg: 'rgba(6, 182, 212, 0.16)',
          border: 'rgba(6, 182, 212, 0.35)',
        };
      case 'atencao':
        return {
          label: 'Atenção',
          color: colors.signalScale.fair,
          bg: 'rgba(234, 179, 8, 0.16)',
          border: 'rgba(234, 179, 8, 0.35)',
        };
      case 'critica':
        return {
          label: 'Crítica',
          color: colors.signalScale.critical,
          bg: 'rgba(239, 68, 68, 0.16)',
          border: 'rgba(239, 68, 68, 0.35)',
        };
      default:
        return {
          label: 'Indefinida',
          color: colors.textSecondary,
          bg: 'rgba(148, 163, 184, 0.12)',
          border: 'rgba(148, 163, 184, 0.25)',
        };
    }
  };

  const config = getConfig();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        size === 'small' && styles.smallBadge,
        size === 'large' && styles.largeBadge,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text
        style={[
          styles.text,
          { color: config.color },
          size === 'small' && styles.smallText,
          size === 'large' && styles.largeText,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  smallBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  largeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 22,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  smallText: {
    fontSize: 11,
  },
  largeText: {
    fontSize: 14,
  },
});
