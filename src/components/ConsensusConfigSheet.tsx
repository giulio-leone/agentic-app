/**
 * ConsensusConfigSheet — Bottom sheet for configuring consensus mode.
 * Accessible via long-press on the Scale (⚖️) icon in the toolbar.
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Switch,
  StyleSheet,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Scale, Plus, Minus, X, ChevronDown } from 'lucide-react-native';
import { useAppStore } from '../stores/appStore';
import { useServers, useSelectedServerId, useServerActions } from '../stores/selectors';
import { FontSize, Spacing, Radius, useTheme } from '../utils/theme';
import type { ConsensusAgentConfig, ConsensusConfig, ProviderModelSelection } from '../ai/types';
import { DEFAULT_CONSENSUS_AGENTS } from '../ai/types';
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
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);

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
    if (localConfig.agents.length <= 2) return;
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
    setLocalConfig({
      agents: [...DEFAULT_CONSENSUS_AGENTS],
      useSharedModel: true,
    });
  }, []);

  const providerLabel = useCallback((sel?: ProviderModelSelection) => {
    if (!sel) return 'Default (server model)';
    const info = getProviderInfo(sel.providerType);
    const modelShort = sel.modelId.split('/').pop() ?? sel.modelId;
    return `${info.name} • ${modelShort}`;
  }, []);

  const handlePickerSelect = useCallback((serverId: string) => {
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

  const canRemove = localConfig.agents.length > 2;
  const canAdd = localConfig.agents.length < 7;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
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
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {/* Shared model toggle — native Switch */}
            <XStack alignItems="center" justifyContent="space-between" marginBottom={Spacing.md}>
              <Text fontSize={FontSize.subheadline} color={colors.text}>Same model for all</Text>
              <Switch
                value={localConfig.useSharedModel}
                onValueChange={(v) => setLocalConfig(c => ({ ...c, useSharedModel: v }))}
                trackColor={{ false: colors.systemGray4, true: colors.primary }}
                thumbColor="white"
              />
            </XStack>

            {/* Reviewer model */}
            {!localConfig.useSharedModel && (
              <YStack marginBottom={Spacing.md}>
                <Text fontSize={FontSize.caption} color={colors.textTertiary} marginBottom={2}>Reviewer Model</Text>
                <TouchableOpacity
                  style={[styles.modelSelector, { borderColor: colors.separator, backgroundColor: colors.codeBackground }]}
                  onPress={() => setPickerTarget('__reviewer__')}
                >
                  <Text fontSize={FontSize.footnote} color={colors.text} flex={1} numberOfLines={1}>
                    {providerLabel(localConfig.reviewerProvider)}
                  </Text>
                  <ChevronDown size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </YStack>
            )}

            {/* Agent count controls */}
            <XStack alignItems="center" justifyContent="space-between" marginBottom={Spacing.sm}>
              <Text fontSize={FontSize.subheadline} color={colors.text}>
                Analysts ({localConfig.agents.length})
              </Text>
              <XStack gap={Spacing.sm}>
                <TouchableOpacity
                  style={[styles.roundButton, { backgroundColor: canRemove ? `${colors.destructive}20` : colors.systemGray5 }]}
                  onPress={() => removeAgent(localConfig.agents[localConfig.agents.length - 1]?.id)}
                  disabled={!canRemove}
                >
                  <Minus size={16} color={canRemove ? colors.destructive : colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roundButton, { backgroundColor: canAdd ? `${colors.primary}20` : colors.systemGray5 }]}
                  onPress={addAgent}
                  disabled={!canAdd}
                >
                  <Plus size={16} color={canAdd ? colors.primary : colors.textTertiary} />
                </TouchableOpacity>
              </XStack>
            </XStack>

            {/* Agent cards */}
            {localConfig.agents.map((agent) => (
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
                    style={[styles.roleInput, { color: colors.text }]}
                    placeholderTextColor={colors.textTertiary}
                    placeholder="Role name"
                  />
                  {canRemove && (
                    <TouchableOpacity onPress={() => removeAgent(agent.id)} hitSlop={8}>
                      <X size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  )}
                </XStack>
                <TextInput
                  value={agent.instructions}
                  onChangeText={(t) => updateAgent(agent.id, { instructions: t })}
                  style={[styles.instructionsInput, { color: colors.textSecondary }]}
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
                      style={[styles.modelSelector, { borderColor: colors.separator, backgroundColor: colors.surface }]}
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
              style={[styles.actionButton, { borderWidth: 1, borderColor: colors.separator }]}
              onPress={reset}
            >
              <Text fontSize={FontSize.subheadline} color={colors.textSecondary}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={save}
            >
              <Text fontSize={FontSize.subheadline} fontWeight="600" color="white">Save</Text>
            </TouchableOpacity>
          </XStack>
        </YStack>
      </KeyboardAvoidingView>

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

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  roundButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInput: {
    flex: 1,
    fontSize: FontSize.footnote,
    fontWeight: '600',
    padding: 0,
  },
  instructionsInput: {
    fontSize: FontSize.caption,
    padding: 0,
    minHeight: 40,
  },
  actionButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  saveButton: {
    flex: 2,
  },
});
