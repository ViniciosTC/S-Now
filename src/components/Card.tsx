import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'elevated' | 'glass' | 'muted' | 'outline';
}

export function Card({ children, style, onPress, variant = 'glass' }: CardProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'glass':
        return styles.glassCard;
      case 'muted':
        return styles.mutedCard;
      case 'outline':
        return styles.outlineCard;
      default:
        return styles.elevatedCard;
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.baseCard, getVariantStyle(), style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.baseCard, getVariantStyle(), style]}>{children}</View>;
}

const styles = StyleSheet.create({
  baseCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  glassCard: {
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  elevatedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mutedCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  outlineCard: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
