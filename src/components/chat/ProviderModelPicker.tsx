/**
 * ProviderModelPicker — autocomplete search for selecting a model.
 * Single input field shows all models across providers with instant filtering.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  SectionList,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Check, Eye, Brain, Wrench, Search, X } from 'lucide-react-native';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { ServerType } from '../../acp/models/types';
import type { ACPServerConfiguration } from '../../acp/models/types';
import { getProviderInfo } from '../../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../../ai/ModelFetcher';
import { getCachedModels } from '../../ai/ModelCache';
import { getApiKey } from '../../storage/SecureStorage';

import { BottomSheetModal } from './BottomSheetModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;
  onSelectServer: (id: string) => void;
  onUpdateServer: (server: ACPServerConfiguration) => void;
  colors: ThemeColors;
}

/** Model entry enriched with provider info for the unified list. */
interface ModelOption {
  id: string;
  modelId: string;
  providerName: string;
  providerServerId: string;
  displayName: string;
  model: FetchedModel;
}

export const ProviderModelPicker = React.memo(function ProviderModelPicker({
  visible,
  onClose,
  servers,
  selectedServerId,
  onSelectServer,
  onUpdateServer,
  colors,
}: Props) {
  const providers = useMemo(
    () => servers.filter(s => s.serverType === ServerType.AIProvider && s.aiProviderConfig),
    [servers],
  );

  const [allOptions, setAllOptions] = useState<ModelOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Fetch models from ALL providers on open
  useEffect(() => {
    if (!visible || providers.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setQuery('');

    (async () => {
      const options: ModelOption[] = [];

      for (const provider of providers) {
        const config = provider.aiProviderConfig!;
        const info = getProviderInfo(config.providerType);

        // Try cached first
        let models = await getCachedModels(config.providerType);
        if (cancelled) return;

        // Fetch fresh if no cache
        if (!models || models.length === 0) {
          try {
            const apiKey = await getApiKey(`${provider.id}_${config.providerType}`);
            if (cancelled) return;
            if (apiKey) {
              models = await fetchModelsFromProvider(
                config.providerType,
                apiKey,
                config.baseUrl ?? info.defaultBaseUrl,
              );
            }
          } catch { /* keep empty */ }
        }
        if (cancelled) return;

        if (models) {
          for (const m of models) {
            options.push({
              id: `${provider.id}::${m.id}`,
              modelId: m.id,
              providerName: info.name,
              providerServerId: provider.id,
              displayName: m.name || m.id.split('/').pop() || m.id,
              model: m,
            });
          }
        }
      }

      if (!cancelled) {
        setAllOptions(options);
        setLoading(false);
        // Focus input after models load
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, providers]);

  // Filter based on query
  const filtered = useMemo(() => {
    if (!query.trim()) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter(o =>
      o.modelId.toLowerCase().includes(q) ||
      o.displayName.toLowerCase().includes(q) ||
      o.providerName.toLowerCase().includes(q)
    );
  }, [query, allOptions]);

  // Group by provider for SectionList
  const sections = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    for (const o of filtered) {
      const list = map.get(o.providerName) ?? [];
      list.push(o);
      map.set(o.providerName, list);
    }
    return Array.from(map, ([title, data]) => ({ title, data }));
  }, [filtered]);

  // Currently selected
  const currentServer = providers.find(p => p.id === selectedServerId);
  const currentModelId = currentServer?.aiProviderConfig?.modelId;

  const selectModel = useCallback((option: ModelOption) => {
    const provider = servers.find(s => s.id === option.providerServerId);
    if (!provider?.aiProviderConfig) return;
    onSelectServer(option.providerServerId);
    onUpdateServer({
      ...provider,
      aiProviderConfig: { ...provider.aiProviderConfig, modelId: option.modelId },
    });
    Keyboard.dismiss();
    onClose();
  }, [servers, onSelectServer, onUpdateServer, onClose]);

  const handleManualSubmit = useCallback(() => {
    const val = query.trim();
    if (!val || !currentServer?.aiProviderConfig) return;
    onUpdateServer({
      ...currentServer,
      aiProviderConfig: { ...currentServer.aiProviderConfig, modelId: val },
    });
    Keyboard.dismiss();
    onClose();
  }, [query, currentServer, onUpdateServer, onClose]);

  const renderItem = useCallback(({ item }: { item: ModelOption }) => {
    const isSelected = item.modelId === currentModelId && item.providerServerId === selectedServerId;
    return (
      <TouchableOpacity
        style={[
          styles.modelRow,
          { borderBottomColor: colors.separator },
          isSelected && { backgroundColor: `${colors.primary}10` },
        ]}
        onPress={() => selectModel(item)}
        activeOpacity={0.6}
      >
        <YStack flex={1} gap={2}>
          <Text
            color={isSelected ? colors.primary : colors.text}
            fontSize={15}
            fontWeight={isSelected ? '600' : '400'}
            numberOfLines={1}
          >
            {item.displayName}
          </Text>
          <XStack alignItems="center" gap={6}>
            {item.model.supportsVision && <Eye size={10} color={colors.textTertiary} />}
            {item.model.supportsTools && <Wrench size={10} color={colors.textTertiary} />}
            {item.model.supportsReasoning && <Brain size={10} color={colors.textTertiary} />}
          </XStack>
        </YStack>
        {isSelected && <Check size={18} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [currentModelId, selectedServerId, colors, selectModel]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <XStack
      paddingHorizontal={Spacing.md}
      paddingVertical={6}
      backgroundColor={colors.codeBackground}
    >
      <Text fontSize={12} fontWeight="600" color={colors.textSecondary} textTransform="uppercase" letterSpacing={0.5}>
        {section.title}
      </Text>
    </XStack>
  ), [colors]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} backgroundColor={colors.surface}>
      {/* Search input — the hero element */}
      <XStack
        alignItems="center"
        marginHorizontal={Spacing.md}
        marginTop={Spacing.md}
        marginBottom={Spacing.sm}
        paddingHorizontal={12}
        borderRadius={Radius.lg}
        backgroundColor={colors.inputBackground}
        borderWidth={1}
        borderColor={colors.inputBorder}
        gap={8}
      >
        <Search size={16} color={colors.textTertiary} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search models..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleManualSubmit}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </XStack>

      {/* Results */}
      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical={Spacing.xl}>
          <ActivityIndicator color={colors.primary} />
          <Text fontSize={13} color={colors.textTertiary} marginTop={Spacing.sm}>Loading models…</Text>
        </YStack>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <YStack alignItems="center" paddingVertical={Spacing.xl}>
              <Text fontSize={15} color={colors.textTertiary}>
                {query ? 'No results' : 'No models — configure a provider first'}
              </Text>
              {query.trim().length > 0 && (
                <TouchableOpacity
                  onPress={handleManualSubmit}
                  style={[styles.useCustom, { borderColor: colors.primary }]}
                >
                  <Text fontSize={14} color={colors.primary}>Use "{query}" as model ID</Text>
                </TouchableOpacity>
              )}
            </YStack>
          }
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  useCustom: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
