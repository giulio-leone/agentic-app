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
import { useServers, useSelectedServerId, useServerActions } from '../stores/selectors';
import { FontSize, Spacing, Radius, useTheme } from '../utils/theme';
import type { ConsensusAgentConfig, ConsensusConfig, ProviderModelSelection } from '../ai/types';
import { DEFAULT_CONSENSUS_AGENTS } from '../ai/types';
import { ServerType } from '../acp/models/types';
import { getProviderInfo } from '../ai/providers';
import { ProviderModelPicker } from './chat/ProviderModelPicker';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ConsensusConfigSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const consensusConfig = useAppStore(s => s.consensusConfig);
  const updateConsensusConfig = useAppStore(s => s.updateConsensusConfig);
  const servers = useServers();
  const selectedServerId = useSelectedServerId();
  const { selectServer, updateServer } = useServerActions();
  const [localConfig, setLocalConfig] = useState<ConsensusConfig>({ ...consensusConfig });
  const [pickerTarget, setPickerTarget] = useState<string | null>(null); // agent id or '__reviewer__'

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

  // Build a display label for a ProviderModelSelection
  const providerLabel = useCallback((sel?: ProviderModelSelection) => {
    if (!sel) return 'Default (server model)';
    const info = getProviderInfo(sel.providerType);
    const modelShort = sel.modelId.split('/').pop() ?? sel.modelId;
    return `${info.name} • ${modelShort}`;
  }, []);

  // When the ProviderModelPicker selects a model, we intercept onSelectServer/onUpdateServer
  // to capture the selection into localConfig instead of changing the global state.
  const handlePickerSelect = useCallback((serverId: string) => {
    // Find the server to get providerType + modelId
    const srv = servers.find(s => s.id === serverId);
    if (!srv?.aiProviderConfig) return;
    const selection: ProviderModelSelection = {
      serverId,
      providerType: srv.aiProviderConfig.providerType,
      modelId: srv.aiProviderConfig.modelId,
    };
    if (pickerTarget === '__reviewer__') {
      setLocalConfig(c => ({ ...c, reviewerProvider: selection, reviewerModelId: selection.modelId }));
    } else if (pickerTarget) {
      setLocalConfig(c => ({
        ...c,
        agents: c.agents.map(a => a.id === pickerTarget ? { ...a, provider: selection, modelId: selection.modelId } : a),
      }));
    }
    setPickerTarget(null);
  }, [servers, pickerTarget]);

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
                <Text fontSize={FontSize.caption} color={colors.textTertiary} marginBottom={2}>Reviewer Model</Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1,
                    borderColor: colors.separator, backgroundColor: colors.codeBackground,
                  }}
                  onPress={() => setPickerTarget('__reviewer__')}
                >
                  <Text fontSize={FontSize.footnote} color={colors.text} flex={1} numberOfLines={1}>
                    {providerLabel(localConfig.reviewerProvider)}
                  </Text>
                  <ChevronDown size={14} color={colors.textTertiary} />
                </TouchableOpacity>
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
                    <Text fontSize={FontSize.caption} color={colors.textTertiary} marginBottom={2}>
                      Model for {agent.role}
                    </Text>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1,
                        borderColor: colors.separator, backgroundColor: colors.surface,
                      }}
                      onPress={() => setPickerTarget(agent.id)}
                    >
                      <Text fontSize={FontSize.footnote} color={colors.text} flex={1} numberOfLines={1}>
                        {providerLabel(agent.provider)}
                      </Text>
                      <ChevronDown size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
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

      {/* Cross-provider model picker — opens on top of consensus sheet */}
      <ProviderModelPicker
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectServer={handlePickerSelect}
        onUpdateServer={updateServer}
        colors={colors}
      />
    </Modal>
  );
}
