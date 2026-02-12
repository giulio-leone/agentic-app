/**
 * Connection status badge — small dot indicator for header/sidebar use.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ACPConnectionState } from '../acp/models/types';
import { useTheme, ThemeColors } from '../utils/theme';

interface Props {
  state: ACPConnectionState;
  isInitialized: boolean;
}

export const ConnectionBadge = React.memo(function ConnectionBadge({ state, isInitialized }: Props) {
  const { colors } = useTheme();
  const color = getDotColor(state, isInitialized, colors);

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
});

function getDotColor(state: ACPConnectionState, isInitialized: boolean, colors: ThemeColors): string {
  switch (state) {
    case ACPConnectionState.Connected:
      return isInitialized ? colors.healthyGreen : colors.orange;
    case ACPConnectionState.Connecting:
      return colors.yellow;
    case ACPConnectionState.Failed:
      return '#F87171';
    case ACPConnectionState.Disconnected:
    default:
      return colors.systemGray3;
  }
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
