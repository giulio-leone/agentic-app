/**
 * MessageActionMenu — bottom sheet action menu shown on long-press of a message.
 * Options vary by message role.
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Pressable,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import type { ChatMessage } from '../../acp/models/types';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';

export interface MessageAction {
  key: string;
  icon: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  message: ChatMessage | null;
  onClose: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
}

export function MessageActionMenu({
  visible,
  message,
  onClose,
  onEdit,
  onCopy,
  onDelete,
  onRegenerate,
}: Props) {
  const { colors } = useDesignSystem();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!message) return null;

  const actions: MessageAction[] = [];

  if ((message.role === 'user' || message.role === 'assistant') && onEdit) {
    actions.push({ key: 'edit', icon: '✏️', label: 'Edit', onPress: onEdit });
  }
  if (onCopy) {
    actions.push({ key: 'copy', icon: '📋', label: 'Copy', onPress: onCopy });
  }
  if (message.role === 'assistant' && onRegenerate) {
    actions.push({ key: 'regenerate', icon: '🔄', label: 'Regenerate', onPress: onRegenerate });
  }
  if (onDelete) {
    actions.push({ key: 'delete', icon: '🗑️', label: 'Delete', destructive: true, onPress: onDelete });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <YStack
            borderRadius={Radius.lg}
            overflow="hidden"
            paddingVertical={Spacing.sm}
          >
            {/* Handle bar */}
            <YStack
              alignSelf="center"
              width={36}
              height={4}
              borderRadius={2}
              backgroundColor={colors.systemGray4}
              marginBottom={Spacing.sm}
            />

            {actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                onPress={() => {
                  onClose();
                  // Small delay so the modal closes before the action executes
                  setTimeout(action.onPress, 150);
                }}
                activeOpacity={0.6}
              >
                <XStack
                  paddingHorizontal={Spacing.xl}
                  paddingVertical={Spacing.md}
                  alignItems="center"
                  gap={Spacing.md}
                >
                  <Text fontSize={20}>{action.icon}</Text>
                  <Text
                    fontSize={FontSize.body}
                    color={action.destructive ? colors.destructive : colors.text}
                    fontWeight="500"
                  >
                    {action.label}
                  </Text>
                </XStack>
              </TouchableOpacity>
            ))}
          </YStack>
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
    paddingBottom: 34, // safe area
  },
});
