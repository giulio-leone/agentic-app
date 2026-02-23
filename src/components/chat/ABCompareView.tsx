/**
 * ABCompareView — Split-view comparison of multi-model A/B test results.
 * Shows 2+ model responses side by side with streaming indicators.
 */

import React, { useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { X, Clock, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { ABTestState } from '../../hooks/useABTesting';
import { MarkdownContent } from './MarkdownContent';

interface Props {
  state: ABTestState;
  onClose: () => void;
  colors: ThemeColors;
}

export const ABCompareView = React.memo(function ABCompareView({ state, onClose, colors }: Props) {
  const { width } = useWindowDimensions();
  const columnWidth = useMemo(() => Math.max((width - Spacing.lg * 2 - Spacing.sm) / state.results.length, 200), [width, state.results.length]);

  const formatDuration = useCallback((result: typeof state.results[0]) => {
    if (!result.completedAt) return 'streaming…';
    return `${((result.completedAt - result.startedAt) / 1000).toFixed(1)}s`;
  }, []);

  if (!state.active && state.results.length === 0) return null;

  return (
    <YStack flex={1} backgroundColor={colors.background}>
      {/* Header */}
      <XStack
        paddingHorizontal={Spacing.lg}
        paddingVertical={Spacing.md}
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor={colors.separator}
      >
        <YStack flex={1}>
          <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
            A/B Comparison
          </Text>
          <Text fontSize={FontSize.caption} color={colors.textSecondary} numberOfLines={1}>
            {state.prompt.slice(0, 80)}{state.prompt.length > 80 ? '…' : ''}
          </Text>
        </YStack>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={22} color={colors.text} />
        </TouchableOpacity>
      </XStack>

      {/* Results columns */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnsContainer}>
        {state.results.map((result) => (
          <YStack
            key={result.id}
            width={columnWidth}
            borderRightWidth={StyleSheet.hairlineWidth}
            borderRightColor={colors.separator}
          >
            {/* Model header */}
            <XStack
              paddingHorizontal={Spacing.md}
              paddingVertical={Spacing.sm}
              backgroundColor={colors.cardBackground}
              alignItems="center"
              gap={Spacing.xs}
            >
              {result.isStreaming ? (
                <Clock size={14} color={colors.primary} />
              ) : result.error ? (
                <AlertTriangle size={14} color={colors.destructive} />
              ) : (
                <CheckCircle size={14} color={colors.primary} />
              )}
              <YStack flex={1}>
                <Text fontSize={FontSize.caption} fontWeight="600" color={colors.text} numberOfLines={1}>
                  {result.config.modelId}
                </Text>
                <Text fontSize={10} color={colors.textTertiary}>
                  {result.config.providerType} • {formatDuration(result)}
                </Text>
              </YStack>
            </XStack>

            {/* Response content */}
            <ScrollView style={styles.responseScroll} contentContainerStyle={styles.responseContent}>
              {result.error ? (
                <Text fontSize={FontSize.body} color={colors.destructive} padding={Spacing.md}>
                  ⚠️ {result.error}
                </Text>
              ) : result.content ? (
                <YStack padding={Spacing.md}>
                  <MarkdownContent content={result.content} colors={colors} />
                  {result.isStreaming && (
                    <Text fontSize={FontSize.caption} color={colors.primary} marginTop={Spacing.xs}>▊</Text>
                  )}
                </YStack>
              ) : result.isStreaming ? (
                <Text fontSize={FontSize.body} color={colors.textTertiary} padding={Spacing.md}>
                  Waiting for response…
                </Text>
              ) : null}
            </ScrollView>
          </YStack>
        ))}
      </ScrollView>
    </YStack>
  );
});

const styles = StyleSheet.create({
  columnsContainer: {
    flexGrow: 1,
  },
  responseScroll: {
    flex: 1,
  },
  responseContent: {
    paddingBottom: Spacing.xl,
  },
});
