/**
 * CopilotToolRequest — Inline chat component for Copilot tool requests.
 * Renders ask_user (input/choices) and approve_action (approve/reject) cards.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, TextInput, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { XStack, YStack, Text, ScrollView } from 'tamagui';
import {
  Bot,
  AlertTriangle,
  Check,
  X,
  Send,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';

export interface CopilotToolRequestProps {
  kind: 'ask_user' | 'approve_action';
  message: string;
  choices?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  toolCallId: string;
  sessionId: string;
  onRespond: (toolCallId: string, response: unknown, approved?: boolean) => void;
  responded?: boolean;
}

const RISK_CONFIG = {
  low: { color: '#22C55E', label: 'LOW', emoji: '🟢' },
  medium: { color: '#F59E0B', label: 'MEDIUM', emoji: '🟡' },
  high: { color: '#EF4444', label: 'HIGH', emoji: '🔴' },
} as const;

export const CopilotToolRequest = React.memo(function CopilotToolRequest({
  kind,
  message,
  choices,
  riskLevel = 'low',
  toolCallId,
  onRespond,
  responded = false,
}: CopilotToolRequestProps) {
  const { colors } = useDesignSystem();
  const [text, setText] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const isAskUser = kind === 'ask_user';
  const risk = RISK_CONFIG[riskLevel];

  const handleChoicePress = useCallback(
    (choice: string) => {
      if (responded) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedChoice(choice);
      onRespond(toolCallId, choice);
    },
    [responded, toolCallId, onRespond],
  );

  const handleSendText = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || responded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRespond(toolCallId, trimmed);
  }, [text, responded, toolCallId, onRespond]);

  const handleApprove = useCallback(() => {
    if (responded) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRespond(toolCallId, 'approved', true);
  }, [responded, toolCallId, onRespond]);

  const handleReject = useCallback(() => {
    if (responded) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRespond(toolCallId, 'rejected', false);
  }, [responded, toolCallId, onRespond]);

  const borderColor = isAskUser ? colors.primary : risk.color;

  return (
    <Animated.View entering={FadeInDown.duration(250).springify()}>
      <YStack
        marginVertical={Spacing.sm}
        borderWidth={1}
        borderColor={borderColor}
        borderRadius={Radius.md}
        backgroundColor={colors.cardBackground}
        overflow="hidden"
        opacity={responded ? 0.6 : 1}
      >
        {/* Header */}
        <XStack
          paddingHorizontal={Spacing.md}
          paddingVertical={Spacing.sm}
          alignItems="center"
          gap={Spacing.sm}
          backgroundColor={`${borderColor}15`}
        >
          {isAskUser ? (
            <Bot size={16} color={colors.primary} />
          ) : (
            <AlertTriangle size={16} color={risk.color} />
          )}
          <Text
            fontSize={FontSize.footnote}
            fontWeight="600"
            color={isAskUser ? colors.primary : risk.color}
            flex={1}
          >
            {isAskUser ? 'Copilot needs input' : 'Approval Required'}
          </Text>
        </XStack>

        {/* Body */}
        <YStack paddingHorizontal={Spacing.md} paddingVertical={Spacing.md} gap={Spacing.md}>
          {/* Message */}
          <Text fontSize={FontSize.body} color={colors.text}>
            {message}
          </Text>

          {/* Risk badge for approve_action */}
          {!isAskUser && (
            <XStack alignItems="center" gap={Spacing.xs}>
              <Text fontSize={FontSize.footnote} color={colors.textSecondary}>
                Risk:
              </Text>
              <Text fontSize={FontSize.footnote} fontWeight="700" color={risk.color}>
                {risk.emoji} {risk.label}
              </Text>
            </XStack>
          )}

          {/* Choice chips (ask_user) */}
          {isAskUser && choices && choices.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap={Spacing.sm} flexWrap="nowrap">
                {choices.map((choice) => {
                  const isSelected = selectedChoice === choice;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => handleChoicePress(choice)}
                      disabled={responded}
                    >
                      <XStack
                        paddingHorizontal={Spacing.md}
                        paddingVertical={Spacing.sm}
                        borderRadius={Radius.full}
                        borderWidth={1}
                        borderColor={isSelected ? colors.primary : colors.separator}
                        backgroundColor={isSelected ? colors.primary : 'transparent'}
                      >
                        <Text
                          fontSize={FontSize.footnote}
                          fontWeight="500"
                          color={isSelected ? colors.contrastText : colors.text}
                        >
                          {choice}
                        </Text>
                      </XStack>
                    </Pressable>
                  );
                })}
              </XStack>
            </ScrollView>
          )}

          {/* Free text input (ask_user) */}
          {isAskUser && !responded && (
            <YStack gap={Spacing.xs}>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>
                Or type your answer:
              </Text>
              <XStack
                borderWidth={1}
                borderColor={colors.inputBorder}
                borderRadius={Radius.sm}
                backgroundColor={colors.inputBackground}
                alignItems="center"
                paddingHorizontal={Spacing.sm}
              >
                <TextInput
                  style={[styles.input, { color: colors.text, flex: 1 }]}
                  value={text}
                  onChangeText={setText}
                  placeholder="Type here…"
                  placeholderTextColor={colors.systemGray2}
                  editable={!responded}
                  returnKeyType="send"
                  onSubmitEditing={handleSendText}
                />
                <Pressable
                  onPress={handleSendText}
                  disabled={!text.trim() || responded}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: text.trim()
                        ? colors.primary
                        : colors.sendButtonDisabledBg,
                    },
                  ]}
                >
                  <Send size={14} color={colors.contrastText} />
                </Pressable>
              </XStack>
            </YStack>
          )}

          {/* Approve / Reject buttons (approve_action) */}
          {!isAskUser && !responded && (
            <XStack gap={Spacing.md}>
              <Pressable onPress={handleApprove} style={{ flex: 1 }}>
                <XStack
                  paddingVertical={Spacing.md}
                  borderRadius={Radius.sm}
                  backgroundColor="#22C55E"
                  alignItems="center"
                  justifyContent="center"
                  gap={Spacing.xs}
                >
                  <Check size={16} color="#FFFFFF" />
                  <Text fontSize={FontSize.footnote} fontWeight="600" color="#FFFFFF">
                    Approve
                  </Text>
                </XStack>
              </Pressable>
              <Pressable onPress={handleReject} style={{ flex: 1 }}>
                <XStack
                  paddingVertical={Spacing.md}
                  borderRadius={Radius.sm}
                  backgroundColor={colors.destructive}
                  alignItems="center"
                  justifyContent="center"
                  gap={Spacing.xs}
                >
                  <X size={16} color="#FFFFFF" />
                  <Text fontSize={FontSize.footnote} fontWeight="600" color="#FFFFFF">
                    Reject
                  </Text>
                </XStack>
              </Pressable>
            </XStack>
          )}

          {/* Responded state */}
          {responded && (
            <Text fontSize={FontSize.caption} color={colors.textTertiary} fontStyle="italic">
              ✓ Response sent
            </Text>
          )}
        </YStack>
      </YStack>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  input: {
    fontSize: FontSize.body,
    paddingVertical: Spacing.sm,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
});
