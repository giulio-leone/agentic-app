/**
 * Step2ChatBridgeModels — Chat Bridge CLI agent selection + save.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Sparkles, Brain, Code, Terminal, Check } from 'lucide-react-native';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Props {
  w: WizardState;
  colors: ThemeColors;
}

const AGENTS = [
  { id: 'claude', label: 'Claude Code', desc: 'Anthropic Claude con stream-json', icon: Brain },
  { id: 'copilot', label: 'Copilot CLI', desc: 'GitHub Copilot in terminale', icon: Code },
  { id: 'codex', label: 'Codex CLI', desc: 'OpenAI Codex in terminale', icon: Terminal },
];

export function Step2ChatBridgeModels({ w, colors }: Props) {
  return (
    <YStack flex={1} padding={Spacing.lg} gap={Spacing.md}>
      <YStack gap={Spacing.xs}>
        <XStack alignItems="center" gap={Spacing.sm}>
          <Sparkles size={24} color={colors.primary} />
          <Text fontSize={FontSize.title2} fontWeight="700" color="$color">CLI Agent</Text>
        </XStack>
        <Text fontSize={FontSize.footnote} color="$textSecondary">
          Scegli quale agent CLI il bridge utilizzerà. Puoi cambiarlo per ogni sessione.
        </Text>
      </YStack>

      {/* Agent cards */}
      {AGENTS.map(agent => {
        const selected = w.bridgeModelId === agent.id;
        return (
          <TouchableOpacity
            key={agent.id}
            onPress={() => w.setBridgeModelId(agent.id)}
            activeOpacity={0.7}
            style={[
              styles.agentCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: selected ? colors.primary : colors.separator,
                borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <XStack alignItems="center" gap={Spacing.sm}>
              <agent.icon size={22} color={selected ? colors.primary : colors.textTertiary} />
              <YStack flex={1}>
                <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>
                  {agent.label}
                </Text>
                <Text fontSize={FontSize.caption} color={colors.textTertiary}>
                  {agent.desc}
                </Text>
              </YStack>
              {selected && <Check size={18} color={colors.primary} />}
            </XStack>
          </TouchableOpacity>
        );
      })}

      {/* Connection summary */}
      <YStack
        padding={Spacing.sm}
        borderRadius={Radius.sm}
        backgroundColor={colors.cardBackground}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor={colors.separator}
        gap={2}
      >
        <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary}>RIEPILOGO</Text>
        <Text fontSize={FontSize.footnote} color={colors.text}>
          {w.bridgeTls ? 'wss' : 'ws'}://{w.bridgeUrl || '...'}
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.text}>
          Agent: {AGENTS.find(a => a.id === w.bridgeModelId)?.label || '—'}
        </Text>
        {w.bridgeToken ? (
          <Text fontSize={FontSize.footnote} color={colors.text}>Token: ••••••</Text>
        ) : null}
      </YStack>

      {/* Save button */}
      <TouchableOpacity
        onPress={() => w.handleSaveChatBridge()}
        disabled={w.saving}
        style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: w.saving ? 0.6 : 1 }]}
      >
        <XStack alignItems="center" gap={Spacing.xs}>
          {w.saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text color="#fff" fontWeight="700" fontSize={FontSize.body}>Salva e Connetti</Text>
          )}
        </XStack>
      </TouchableOpacity>
    </YStack>
  );
}

const styles = StyleSheet.create({
  agentCard: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  saveBtn: {
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
});

export default Step2ChatBridgeModels;
