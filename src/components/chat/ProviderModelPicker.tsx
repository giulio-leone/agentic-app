/**
 * ProviderModelPicker — full-screen modal with autocomplete search.
 * Unified search across all providers, grouped by provider in SectionList.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  SectionList,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Check, Eye, Brain, Wrench, Search, X, ChevronLeft } from 'lucide-react-native';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { ServerType } from '../../acp/models/types';
import type { ACPServerConfiguration } from '../../acp/models/types';
import { getProviderInfo } from '../../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../../ai/ModelFetcher';
import { getCachedModels } from '../../ai/ModelCache';
import { getApiKey } from '../../storage/SecureStorage';
import { sharedStyles } from '../../utils/sharedStyles';

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
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setQuery('');

    (async () => {
      const options: ModelOption[] = [];

      for (const provider of providers) {
        const config = provider.aiProviderConfig!;
        const info = getProviderInfo(config.providerType);

        let models = await getCachedModels(config.providerType);
        if (cancelled) return;

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
        focusTimer = setTimeout(() => inputRef.current?.focus(), 300);
      }
    })();

    return () => {
      cancelled = true;
      if (focusTimer) clearTimeout(focusTimer);
    };
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

  // Group by provider
  const sections = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    for (const o of filtered) {
      const list = map.get(o.providerName) ?? [];
      list.push(o);
      map.set(o.providerName, list);
    }
    return Array.from(map, ([title, data]) => ({ title, data }));
  }, [filtered]);

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
            fontSize={16}
            fontWeight={isSelected ? '600' : '400'}
          >
            {item.displayName}
          </Text>
          <XStack alignItems="center" gap={4}>
            <Text fontSize={13} color={colors.textTertiary}>{item.modelId}</Text>
          </XStack>
          <XStack alignItems="center" gap={8} marginTop={2}>
            {item.model.supportsVision && (
              <XStack alignItems="center" gap={3}>
                <Eye size={11} color={colors.textTertiary} />
                <Text fontSize={11} color={colors.textTertiary}>Vision</Text>
              </XStack>
            )}
            {item.model.supportsTools && (
              <XStack alignItems="center" gap={3}>
                <Wrench size={11} color={colors.textTertiary} />
                <Text fontSize={11} color={colors.textTertiary}>Tools</Text>
              </XStack>
            )}
            {item.model.supportsReasoning && (
              <XStack alignItems="center" gap={3}>
                <Brain size={11} color={colors.textTertiary} />
                <Text fontSize={11} color={colors.textTertiary}>Reasoning</Text>
              </XStack>
            )}
          </XStack>
        </YStack>
        {isSelected && <Check size={20} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [currentModelId, selectedServerId, colors, selectModel]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string; data: ModelOption[] } }) => (
    <XStack
      paddingHorizontal={Spacing.md}
      paddingVertical={8}
      backgroundColor={colors.surface}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor={colors.separator}
    >
      <Text fontSize={13} fontWeight="700" color={colors.textSecondary} textTransform="uppercase" letterSpacing={0.8}>
        {section.title}
      </Text>
      <Text fontSize={13} color={colors.textTertiary} marginLeft={8}>({section.data.length})</Text>
    </XStack>
  ), [colors]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />

        {/* Header with back + search */}
        <XStack
          alignItems="center"
          paddingHorizontal={Spacing.sm}
          paddingVertical={8}
          gap={8}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor={colors.separator}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <XStack
            flex={1}
            alignItems="center"
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
              placeholder="Search models…"
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
        </XStack>

        {/* Results */}
        {loading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text fontSize={14} color={colors.textTertiary} marginTop={Spacing.md}>Loading models…</Text>
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
              <YStack alignItems="center" paddingVertical={Spacing.xl} paddingHorizontal={Spacing.lg}>
                <Text fontSize={16} color={colors.textTertiary} textAlign="center">
                  {query ? `No models matching "${query}"` : 'No models available\nConfigure a provider in Settings'}
                </Text>
                {query.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={handleManualSubmit}
                    style={[styles.useCustom, { borderColor: colors.primary }]}
                  >
                    <Text fontSize={15} color={colors.primary} fontWeight="500">Use "{query}" as model ID</Text>
                  </TouchableOpacity>
                )}
              </YStack>
            }
            showsVerticalScrollIndicator
            style={{ flex: 1 }}
            contentContainerStyle={sharedStyles.listContentPadBottom40}
            removeClippedSubviews
          />
        )}
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  useCustom: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
