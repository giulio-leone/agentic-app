/**
 * ConsensusConfigSheet — Bottom sheet for configuring consensus mode.
 * Accessible via long-press on the Scale (⚖️) icon in the header.
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Scale, Plus, Minus, X, ChevronDown } from 'lucide-react-native';
import { useAppStore } from '../stores/appStore';
import { FontSize, Spacing, Radius, useTheme, type ThemeColors } from '../utils/theme';
import type { ConsensusAgentConfig, ConsensusConfig } from '../ai/types';
import { DEFAULT_CONSENSUS_AGENTS } from '../ai/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  fetchedModels?: Array<{ id: string; name?: string }>;
}

function ModelPicker({ value, models, onChange, colors, label }: {
  value: string | undefined;
  models: Array<{ id: string; name?: string }>;
  onChange: (modelId: string | undefined) => void;
  colors: ThemeColors;
  label: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const displayName = value ? (value.split('/').pop() ?? value) : 'Default (server model)';

  return (
    <YStack>
      <Text fontSize={FontSize.caption} color={colors.textTertiary} marginBottom={2}>{label}</Text>
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1,
          borderColor: colors.separator, backgroundColor: colors.codeBackground,
        }}
        onPress={() => setShowPicker(!showPicker)}
      >
        <Text fontSize={FontSize.footnote} color={colors.text} flex={1} numberOfLines={1}>
          {displayName}
        </Text>
        <ChevronDown size={14} color={colors.textTertiary} />
      </TouchableOpacity>
      {showPicker && (
        <YStack borderWidth={1} borderColor={colors.separator} borderRadius={Radius.sm}
          backgroundColor={colors.cardBackground} marginTop={2} maxHeight={200}>
          <ScrollView>
            <TouchableOpacity
              style={{ padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.separator }}
              onPress={() => { onChange(undefined); setShowPicker(false); }}
            >
              <Text fontSize={FontSize.footnote} color={!value ? colors.primary : colors.text} fontWeight={!value ? '600' : '400'}>
                Default (server model)
              </Text>
            </TouchableOpacity>
            {models.map(m => (
              <TouchableOpacity
                key={m.id}
                style={{ padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.separator }}
                onPress={() => { onChange(m.id); setShowPicker(false); }}
              >
                <Text fontSize={FontSize.footnote} color={value === m.id ? colors.primary : colors.text}
                  fontWeight={value === m.id ? '600' : '400'} numberOfLines={1}>
                  {m.name ?? m.id.split('/').pop() ?? m.id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </YStack>
      )}
    </YStack>
  );
}

export function ConsensusConfigSheet({ visible, onClose, fetchedModels = [] }: Props) {
  const { colors } = useTheme();
  const { consensusConfig, updateConsensusConfig } = useAppStore();
  const [localConfig, setLocalConfig] = useState<ConsensusConfig>({ ...consensusConfig });

  const addAgent = useCallback(() => {
    const idx = localConfig.agents.length;
    const newAgent: ConsensusAgentConfig = {
      id: `agent-${idx}`,
      role: `Analyst ${idx + 1}`,
      instructions: 'Provide your unique perspective on the problem.',
    };
    setLocalConfig(c => ({ ...c, agents: [...c.agents, newAgent] }));
  }, [localConfig.agents.length]);

  const removeAgent = useCallback((id: string) => {
    if (localConfig.agents.length <= 2) return; // minimum 2
    setLocalConfig(c => ({ ...c, agents: c.agents.filter(a => a.id !== id) }));
  }, [localConfig.agents.length]);

  const updateAgent = useCallback((id: string, patch: Partial<ConsensusAgentConfig>) => {
    setLocalConfig(c => ({
      ...c,
      agents: c.agents.map(a => a.id === id ? { ...a, ...patch } : a),
    }));
  }, []);

  const save = useCallback(() => {
    updateConsensusConfig(localConfig);
    onClose();
  }, [localConfig, updateConsensusConfig, onClose]);

  const reset = useCallback(() => {
    const defaultCfg: ConsensusConfig = {
      agents: [...DEFAULT_CONSENSUS_AGENTS],
      useSharedModel: true,
    };
    setLocalConfig(defaultCfg);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <YStack
          backgroundColor={colors.cardBackground}
          borderTopLeftRadius={Radius.lg}
          borderTopRightRadius={Radius.lg}
          padding={Spacing.lg}
          maxHeight="80%"
        >
          {/* Header */}
          <XStack alignItems="center" justifyContent="space-between" marginBottom={Spacing.md}>
            <XStack alignItems="center" gap={Spacing.sm}>
              <Scale size={20} color={colors.primary} />
              <Text fontSize={FontSize.headline} fontWeight="700" color={colors.text}>
                Consensus Config
              </Text>
            </XStack>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {/* Shared model toggle */}
            <XStack alignItems="center" justifyContent="space-between" marginBottom={Spacing.md}>
              <Text fontSize={FontSize.subheadline} color={colors.text}>Same model for all</Text>
              <TouchableOpacity
                style={{
                  width: 50, height: 28, borderRadius: 14,
                  backgroundColor: localConfig.useSharedModel ? colors.primary : colors.systemGray4,
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}
                onPress={() => setLocalConfig(c => ({ ...c, useSharedModel: !c.useSharedModel }))}
              >
                <YStack
                  width={24} height={24} borderRadius={12}
                  backgroundColor="white"
                  alignSelf={localConfig.useSharedModel ? 'flex-end' : 'flex-start'}
                />
              </TouchableOpacity>
            </XStack>

            {/* Reviewer model (shown when not shared) */}
            {!localConfig.useSharedModel && (
              <YStack marginBottom={Spacing.md}>
                <ModelPicker
                  value={localConfig.reviewerModelId}
                  models={fetchedModels}
                  onChange={(v) => setLocalConfig(c => ({ ...c, reviewerModelId: v }))}
                  colors={colors}
                  label="Reviewer Model"
                />
              </YStack>
            )}

            {/* Agent count */}
            <XStack alignItems="center" justifyContent="space-between" marginBottom={Spacing.sm}>
              <Text fontSize={FontSize.subheadline} color={colors.text}>
                Analysts ({localConfig.agents.length})
              </Text>
              <XStack gap={Spacing.sm}>
                <TouchableOpacity
                  style={{
                    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: localConfig.agents.length <= 2 ? colors.systemGray5 : colors.destructive + '20',
                  }}
                  onPress={() => removeAgent(localConfig.agents[localConfig.agents.length - 1]?.id)}
                  disabled={localConfig.agents.length <= 2}
                >
                  <Minus size={16} color={localConfig.agents.length <= 2 ? colors.textTertiary : colors.destructive} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: localConfig.agents.length >= 7 ? colors.systemGray5 : colors.primary + '20',
                  }}
                  onPress={addAgent}
                  disabled={localConfig.agents.length >= 7}
                >
                  <Plus size={16} color={localConfig.agents.length >= 7 ? colors.textTertiary : colors.primary} />
                </TouchableOpacity>
              </XStack>
            </XStack>

            {/* Agent cards */}
            {localConfig.agents.map((agent, idx) => (
              <YStack
                key={agent.id}
                borderWidth={1} borderColor={colors.separator} borderRadius={Radius.sm}
                padding={Spacing.sm} marginBottom={Spacing.sm}
                backgroundColor={colors.codeBackground}
              >
                <XStack alignItems="center" gap={Spacing.sm} marginBottom={Spacing.xs}>
                  <TextInput
                    value={agent.role}
                    onChangeText={(t) => updateAgent(agent.id, { role: t })}
                    style={{
                      flex: 1, fontSize: FontSize.footnote, fontWeight: '600',
                      color: colors.text, padding: 0,
                    }}
                    placeholderTextColor={colors.textTertiary}
                    placeholder="Role name"
                  />
                  {localConfig.agents.length > 2 && (
                    <TouchableOpacity onPress={() => removeAgent(agent.id)}>
                      <X size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  )}
                </XStack>
                <TextInput
                  value={agent.instructions}
                  onChangeText={(t) => updateAgent(agent.id, { instructions: t })}
                  style={{
                    fontSize: FontSize.caption, color: colors.textSecondary,
                    padding: 0, minHeight: 40,
                  }}
                  multiline
                  placeholderTextColor={colors.textTertiary}
                  placeholder="Instructions for this analyst…"
                />
                {!localConfig.useSharedModel && (
                  <YStack marginTop={Spacing.xs}>
                    <ModelPicker
                      value={agent.modelId}
                      models={fetchedModels}
                      onChange={(v) => updateAgent(agent.id, { modelId: v })}
                      colors={colors}
                      label={`Model for ${agent.role}`}
                    />
                  </YStack>
                )}
              </YStack>
            ))}
          </ScrollView>

          {/* Actions */}
          <XStack gap={Spacing.sm} marginTop={Spacing.md}>
            <TouchableOpacity
              style={{
                flex: 1, padding: Spacing.md, borderRadius: Radius.sm, alignItems: 'center',
                borderWidth: 1, borderColor: colors.separator,
              }}
              onPress={reset}
            >
              <Text fontSize={FontSize.subheadline} color={colors.textSecondary}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 2, padding: Spacing.md, borderRadius: Radius.sm, alignItems: 'center',
                backgroundColor: colors.primary,
              }}
              onPress={save}
            >
              <Text fontSize={FontSize.subheadline} fontWeight="600" color="white">Save</Text>
            </TouchableOpacity>
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
    </Modal>
  );
}
