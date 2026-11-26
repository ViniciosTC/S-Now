import React, { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { IconChevronLeft } from './Icons';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: {
    icon?: ReactNode;
    label?: string;
    onPress: () => void;
  };
}

const ANDROID_STATUS_BAR = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0;

export function Header({ title, subtitle, onBack, rightAction }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <IconChevronLeft size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        {rightAction ? (
          <TouchableOpacity
            style={styles.rightButton}
            onPress={rightAction.onPress}
            activeOpacity={0.7}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            {rightAction.icon ? (
              rightAction.icon
            ) : (
              <Text style={styles.rightActionText}>{rightAction.label}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: ANDROID_STATUS_BAR + (Platform.OS === 'android' ? 12 : 8),
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginLeft: 4,
  },
  rightButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  rightActionText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  placeholder: {
    width: 60,
  },
  titleContainer: {
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    letterSpacing: -0.1,
  },
});
