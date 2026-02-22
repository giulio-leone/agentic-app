/**
 * ABModelPicker — Modal for selecting 2+ models to compare in A/B testing.
 * Shows all configured AI Provider servers; user toggles which to include.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { YStack, XStack, Text } from 'tamagui';
import { CheckSquare, Square, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { ACPServerConfiguration } from '../../acp/models/types';
import { ServerType } from '../../acp/models/types';

interface Props {
  visible: boolean;
  servers: ACPServerConfiguration[];
  onStart: (serverIds: string[]) => void;
  onClose: () => void;
  colors: ThemeColors;
}

export function ABModelPicker({ visible, servers, onStart, onClose, colors }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const aiServers = servers.filter(
    s => s.serverType === ServerType.AIProvider && s.aiProviderConfig,
  );

  const toggle = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (selected.size < 2) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStart([...selected]);
    setSelected(new Set());
    onClose();
  }, [selected, onStart, onClose]);

  const renderItem = useCallback(({ item }: { item: ACPServerConfiguration }) => {
    const isSelected = selected.has(item.id);
    const Icon = isSelected ? CheckSquare : Square;
    return (
      <TouchableOpacity onPress={() => toggle(item.id)} activeOpacity={0.7}>
        <XStack
          paddingHorizontal={Spacing.lg}
          paddingVertical={Spacing.md}
          gap={Spacing.md}
          alignItems="center"
          backgroundColor={isSelected ? colors.primaryMuted : 'transparent'}
        >
          <Icon size={20} color={isSelected ? colors.primary : colors.textTertiary} />
          <YStack flex={1}>
            <Text fontSize={FontSize.body} fontWeight="500" color={colors.text}>
              {item.name}
            </Text>
            <Text fontSize={FontSize.caption} color={colors.textSecondary}>
              {item.aiProviderConfig?.providerType} • {item.aiProviderConfig?.modelId}
            </Text>
          </YStack>
        </XStack>
      </TouchableOpacity>
    );
  }, [selected, toggle, colors]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={[styles.sheet, { backgroundColor: colors.surface }]}
        >
          <YStack alignSelf="center" width={36} height={4} borderRadius={2} backgroundColor={colors.systemGray4} marginBottom={Spacing.sm} marginTop={Spacing.sm} />

          <XStack paddingHorizontal={Spacing.lg} marginBottom={Spacing.sm} justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
                A/B Compare
              </Text>
              <Text fontSize={FontSize.caption} color={colors.textSecondary}>
                Select 2+ models to compare
              </Text>
            </YStack>
            <TouchableOpacity
              onPress={handleStart}
              disabled={selected.size < 2}
              style={[styles.startBtn, { backgroundColor: selected.size >= 2 ? colors.primary : colors.systemGray4 }]}
            >
              <Play size={14} color="#FFF" />
              <Text fontSize={FontSize.caption} fontWeight="600" color="#FFF" marginLeft={4}>
                Compare ({selected.size})
              </Text>
            </TouchableOpacity>
          </XStack>

          {aiServers.length === 0 ? (
            <Text fontSize={FontSize.body} color={colors.textTertiary} padding={Spacing.lg} textAlign="center">
              No AI providers configured. Add servers in Settings first.
            </Text>
          ) : (
            <FlatList
              data={aiServers}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
});
