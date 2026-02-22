/**
 * AdvancedModelSettings — System prompt, temperature, reasoning toggle for QuickSetup.
 */
import React from 'react';
import { TouchableOpacity, TextInput, StyleSheet, Platform, View } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Sliders, MessageSquare, Brain, ChevronUp, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';

const TEMP_VALUES = [0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0] as const;

interface Props {
  showAdvanced: boolean;
  onToggle: () => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  temperature: number | undefined;
  setTemperature: (v: number | undefined) => void;
  reasoningEnabled: boolean;
  setReasoningEnabled: (v: boolean) => void;
  supportsReasoning: boolean;
  colors: ThemeColors;
}

export function AdvancedModelSettings({
  showAdvanced, onToggle,
  systemPrompt, setSystemPrompt,
  temperature, setTemperature,
  reasoningEnabled, setReasoningEnabled,
  supportsReasoning, colors,
}: Props) {
  return (
    <>
      <TouchableOpacity
        style={[styles.advancedToggle, { borderColor: colors.separator }]}
        onPress={() => { Haptics.selectionAsync(); onToggle(); }}
        activeOpacity={0.7}
      >
        <XStack alignItems="center" gap={Spacing.xs} flex={1}>
          <Sliders size={16} color={colors.textTertiary} />
          <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.textSecondary}>
            Impostazioni avanzate
          </Text>
        </XStack>
        {showAdvanced
          ? <ChevronUp size={16} color={colors.textTertiary} />
          : <ChevronDown size={16} color={colors.textTertiary} />
        }
      </TouchableOpacity>

      {showAdvanced && (
        <YStack gap={Spacing.md} paddingHorizontal={Spacing.xs}>
          {/* System Prompt */}
          <YStack gap={Spacing.xs}>
            <XStack alignItems="center" gap={Spacing.xs}>
              <MessageSquare size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>System Prompt</Text>
            </XStack>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator },
              ]}
              placeholder="Sei un assistente utile..."
              placeholderTextColor={colors.textTertiary}
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </YStack>

          {/* Temperature */}
          <YStack gap={Spacing.xs}>
            <XStack alignItems="center" gap={Spacing.xs}>
              <Sliders size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>
                Temperature: {temperature !== undefined ? temperature.toFixed(1) : 'Default'}
              </Text>
            </XStack>
            <XStack alignItems="center" gap={Spacing.sm}>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>0</Text>
              <View style={{ flex: 1 }}>
                <XStack alignItems="center">
                  {TEMP_VALUES.map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.tempChip,
                        {
                          backgroundColor: temperature === val ? colors.primary : colors.cardBackground,
                          borderColor: temperature === val ? colors.primary : colors.separator,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTemperature(temperature === val ? undefined : val);
                      }}
                    >
                      <Text
                        fontSize={11}
                        fontWeight="600"
                        color={temperature === val ? colors.contrastText : colors.textTertiary}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </View>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>2</Text>
            </XStack>
          </YStack>

          {/* Reasoning */}
          {supportsReasoning && (
            <TouchableOpacity
              style={[
                styles.reasoningToggle,
                {
                  backgroundColor: reasoningEnabled ? colors.primaryMuted : colors.cardBackground,
                  borderColor: reasoningEnabled ? colors.primary : colors.separator,
                },
              ]}
              onPress={() => { Haptics.selectionAsync(); setReasoningEnabled(!reasoningEnabled); }}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" gap={Spacing.sm} flex={1}>
                <Brain size={18} color={reasoningEnabled ? colors.primary : colors.textTertiary} />
                <YStack>
                  <Text fontSize={FontSize.body} fontWeight="500" color={colors.text}>Extended Thinking</Text>
                  <Text fontSize={FontSize.caption} color={colors.textTertiary}>Ragionamento step-by-step</Text>
                </YStack>
              </XStack>
              <View style={[
                styles.toggleTrack,
                { backgroundColor: reasoningEnabled ? colors.primary : colors.systemGray4 },
              ]}>
                <View style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: reasoningEnabled ? 20 : 2 }] },
                ]} />
              </View>
            </TouchableOpacity>
          )}
        </YStack>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: undefined,
  },
  tempChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 1,
  },
  reasoningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
});
