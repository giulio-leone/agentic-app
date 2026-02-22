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
import { Pencil, Copy, RefreshCw, Trash2, Bookmark } from 'lucide-react-native';
import type { ChatMessage } from '../../acp/models/types';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';

export interface MessageAction {
  key: string;
  icon: React.ReactNode;
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
  onBookmark?: () => void;
  isBookmarked?: boolean;
}

export function MessageActionMenu({
  visible,
  message,
  onClose,
  onEdit,
  onCopy,
  onDelete,
  onRegenerate,
  onBookmark,
  isBookmarked,
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
    actions.push({ key: 'edit', icon: <Pencil size={20} color={colors.text} />, label: 'Edit', onPress: onEdit });
  }
  if (onCopy) {
    actions.push({ key: 'copy', icon: <Copy size={20} color={colors.text} />, label: 'Copy', onPress: onCopy });
  }
  if (onBookmark) {
    actions.push({
      key: 'bookmark',
      icon: <Bookmark size={20} color={isBookmarked ? colors.primary : colors.text} fill={isBookmarked ? colors.primary : 'none'} />,
      label: isBookmarked ? 'Remove Bookmark' : 'Bookmark',
      onPress: onBookmark,
    });
  }
  if (message.role === 'assistant' && onRegenerate) {
    actions.push({ key: 'regenerate', icon: <RefreshCw size={20} color={colors.text} />, label: 'Regenerate', onPress: onRegenerate });
  }
  if (onDelete) {
    actions.push({ key: 'delete', icon: <Trash2 size={20} color={colors.destructive} />, label: 'Delete', destructive: true, onPress: onDelete });
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
                  {action.icon}
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
