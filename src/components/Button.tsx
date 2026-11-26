import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  size?: 'normal' | 'large' | 'small';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryBtn;
      case 'secondary':
        return styles.secondaryBtn;
      case 'accent':
        return styles.accentBtn;
      case 'danger':
        return styles.dangerBtn;
      case 'ghost':
        return styles.ghostBtn;
      default:
        return styles.primaryBtn;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'accent':
        return styles.accentText;
      case 'danger':
        return styles.dangerText;
      case 'ghost':
        return styles.ghostText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallBtn;
      case 'large':
        return styles.largeBtn;
      default:
        return styles.normalBtn;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.baseBtn,
        getButtonStyle(),
        getSizeStyle(),
        disabled && styles.disabledBtn,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.textPrimary}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={[getTextStyle(), disabled && styles.disabledText, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseBtn: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  // Tamanhos
  smallBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  normalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  largeBtn: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  // Cores
  primaryBtn: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.surfaceGlassBorder,
  },
  accentBtn: {
    backgroundColor: colors.accent,
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  ghostBtn: {
    backgroundColor: 'transparent',
  },
  disabledBtn: {
    opacity: 0.45,
  },
  // Textos
  primaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  accentText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dangerText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  ghostText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  disabledText: {
    color: colors.textTertiary,
  },
});
