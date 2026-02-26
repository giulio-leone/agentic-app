/**
 * CopilotStreamStatus — Shows current streaming status during a Copilot response.
 * Displays thinking pulse, tool call info, writing progress, and elapsed time.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
} from 'react-native-reanimated';
import { XStack, YStack, Text } from 'tamagui';
import {
  Brain,
  Wrench,
  Pencil,
} from 'lucide-react-native';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';

export interface CopilotStreamStatusProps {
  status: 'thinking' | 'tool_call' | 'writing' | 'idle';
  toolName?: string;
  toolArgs?: string;
  elapsedMs?: number;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

const STATUS_CONFIG = {
  thinking: { icon: Brain, label: '🧠 Thinking…', color: '#8B5CF6' },
  tool_call: { icon: Wrench, label: '🔧 Using tool', color: '#F59E0B' },
  writing: { icon: Pencil, label: '✏️ Writing response…', color: '#10A37F' },
  idle: { icon: Brain, label: '', color: '#6B7280' },
} as const;

/** Pulsing shimmer bar for thinking/writing states. */
const ShimmerProgress = React.memo(function ShimmerProgress({ color }: { color: string }) {
  const width = useSharedValue(0.2);

  useEffect(() => {
    width.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => { cancelAnimation(width); };
  }, [width]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%` as unknown as number,
  }));

  return (
    <Animated.View style={[styles.progressTrack, { backgroundColor: `${color}20` }]}>
      <Animated.View style={[styles.progressBar, { backgroundColor: color }, animStyle]} />
    </Animated.View>
  );
});

export const CopilotStreamStatus = React.memo(function CopilotStreamStatus({
  status,
  toolName,
  toolArgs,
  elapsedMs,
}: CopilotStreamStatusProps) {
  const { colors } = useDesignSystem();
  const [elapsed, setElapsed] = useState(elapsedMs ?? 0);

  // Tick elapsed timer when active
  useEffect(() => {
    if (status === 'idle') { setElapsed(0); return; }
    if (elapsedMs != null) { setElapsed(elapsedMs); return; }
    const interval = setInterval(() => setElapsed((e) => e + 1000), 1000);
    return () => clearInterval(interval);
  }, [status, elapsedMs]);

  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const showShimmer = status === 'thinking' || status === 'writing';

  // Pulse opacity for the icon
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    if (status === 'thinking') {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
    return () => { cancelAnimation(pulseOpacity); };
  }, [status, pulseOpacity]);

  const iconPulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
      <YStack
        marginVertical={Spacing.xs}
        borderRadius={Radius.sm}
        backgroundColor={colors.cardBackground}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor={colors.separator}
        overflow="hidden"
      >
        {/* Header row */}
        <XStack
          paddingHorizontal={Spacing.md}
          paddingVertical={Spacing.sm}
          alignItems="center"
          gap={Spacing.sm}
        >
          <Animated.View style={iconPulseStyle}>
            <Icon size={14} color={config.color} />
          </Animated.View>
          <Text fontSize={FontSize.footnote} fontWeight="600" color={config.color} flex={1}>
            {status === 'tool_call' && toolName
              ? `${config.label}: ${toolName}`
              : config.label}
          </Text>
          {elapsed > 0 && (
            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
              {formatElapsed(elapsed)}
            </Text>
          )}
        </XStack>

        {/* Tool args detail */}
        {status === 'tool_call' && toolArgs && (
          <XStack paddingHorizontal={Spacing.md} paddingBottom={Spacing.sm}>
            <Text
              fontSize={FontSize.caption}
              color={colors.textSecondary}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {toolArgs}
            </Text>
          </XStack>
        )}

        {/* Shimmer progress bar */}
        {showShimmer && <ShimmerProgress color={config.color} />}
      </YStack>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
  },
});
