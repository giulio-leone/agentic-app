/**
 * Connection status badge component — themed.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ACPConnectionState } from '../acp/models/types';
import { useTheme, FontSize, Spacing, ThemeColors } from '../utils/theme';

interface Props {
  state: ACPConnectionState;
  isInitialized: boolean;
}

export function ConnectionBadge({ state, isInitialized }: Props) {
  const { colors } = useTheme();
  const { color, label } = getStatusInfo(state, isInitialized, colors);

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

function getStatusInfo(state: ACPConnectionState, isInitialized: boolean, colors: ThemeColors) {
  switch (state) {
    case ACPConnectionState.Connected:
      return {
        color: isInitialized ? colors.healthyGreen : colors.orange,
        label: isInitialized ? 'Ready' : 'Connected',
      };
    case ACPConnectionState.Connecting:
      return { color: colors.yellow, label: 'Connecting…' };
    case ACPConnectionState.Failed:
      return { color: colors.destructive, label: 'Failed' };
    case ACPConnectionState.Disconnected:
    default:
      return { color: colors.systemGray, label: 'Offline' };
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: '500',
  },
});
