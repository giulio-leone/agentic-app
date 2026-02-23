/**
 * ProviderModelPicker — unified bottom sheet for selecting provider + model.
 * Replaces the old ModelPickerBar + ServerChip combo.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Check, Eye, Brain, Wrench } from 'lucide-react-native';
import { FontSize, Spacing, Radius, type ThemeColors } from '../../utils/theme';
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
  /** All configured servers (both AI and CLI) */
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;
  onSelectServer: (id: string) => void;
  onUpdateServer: (server: ACPServerConfiguration) => void;
  colors: ThemeColors;
}

const hairline = StyleSheet.hairlineWidth;

export const ProviderModelPicker = React.memo(function ProviderModelPicker({
  visible,
  onClose,
  servers,
  selectedServerId,
  onSelectServer,
  onUpdateServer,
  colors,
}: Props) {
  // Only show AI provider servers
  const providers = useMemo(
    () => servers.filter(s => s.serverType === ServerType.AIProvider && s.aiProviderConfig),
    [servers],
  );

  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [filtered, setFiltered] = useState<FetchedModel[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // When opening, default to currently selected provider
  useEffect(() => {
    if (visible) {
      const current = providers.find(p => p.id === selectedServerId);
      setActiveProviderId(current?.id ?? providers[0]?.id ?? null);
      setSearch('');
    }
  }, [visible, selectedServerId, providers]);

  // Fetch models when active provider changes
  const activeProvider = providers.find(p => p.id === activeProviderId);
  const config = activeProvider?.aiProviderConfig;
  const providerInfo = config ? getProviderInfo(config.providerType) : null;

  useEffect(() => {
    if (!visible || !activeProviderId || !config || !providerInfo || !activeProvider) return;

    let cancelled = false;
    setLoading(true);
    setModels([]);
    setFiltered([]);

    (async () => {
      // Try cached first
      const cached = await getCachedModels(config.providerType);
      if (cancelled) return;
      if (cached && cached.length > 0) {
        setModels(cached);
        setFiltered(cached);
        setLoading(false);
      }

      // Fetch fresh
      try {
        const apiKey = await getApiKey(`${activeProvider.id}_${config.providerType}`);
        if (cancelled) return;
        if (apiKey) {
          const fresh = await fetchModelsFromProvider(
            config.providerType,
            apiKey,
            config.baseUrl ?? providerInfo.defaultBaseUrl,
          );
          if (cancelled) return;
          if (fresh.length > 0) {
            setModels(fresh);
            setFiltered(fresh);
          }
        }
      } catch {
        // keep cached
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [visible, activeProviderId, config?.providerType]);

  // Search filter
  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      setFiltered(models.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)));
    } else {
      setFiltered(models);
    }
  }, [search, models]);

  const selectModel = useCallback((modelId: string) => {
    if (!activeProvider || !config) return;
    // Select this provider as active server
    onSelectServer(activeProvider.id);
    // Update the model
    onUpdateServer({
      ...activeProvider,
      aiProviderConfig: { ...config, modelId },
    });
    onClose();
  }, [activeProvider, config, onSelectServer, onUpdateServer, onClose]);

  const renderModelItem = useCallback(({ item }: { item: FetchedModel }) => {
    const isSelected = item.id === config?.modelId && activeProviderId === selectedServerId;
    return (
      <TouchableOpacity
        style={[
          styles.modelItem,
          { borderBottomColor: colors.separator },
          isSelected && { backgroundColor: `${colors.primary}18` },
        ]}
        onPress={() => selectModel(item.id)}
        activeOpacity={0.6}
      >
        <YStack flex={1}>
          <Text
            color={isSelected ? colors.primary : colors.text}
            fontSize={FontSize.body}
            numberOfLines={1}
          >
            {item.id}
          </Text>
          <XStack gap={4} marginTop={2}>
            {item.supportsVision && <Eye size={10} color={colors.textTertiary} />}
            {item.supportsTools && <Wrench size={10} color={colors.textTertiary} />}
            {item.supportsReasoning && <Brain size={10} color={colors.textTertiary} />}
          </XStack>
        </YStack>
        {isSelected && <Check size={16} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [config?.modelId, activeProviderId, selectedServerId, colors, selectModel]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} backgroundColor={colors.surface}>
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center" padding={Spacing.md}>
        <Text fontSize={FontSize.headline} fontWeight="600" color={colors.text}>
          Select Provider & Model
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text fontSize={FontSize.body} fontWeight="500" color={colors.primary}>Done</Text>
        </TouchableOpacity>
      </XStack>

          {/* Provider tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <XStack gap={Spacing.xs} paddingHorizontal={Spacing.md} paddingBottom={Spacing.sm}>
              {providers.map(provider => {
                const info = provider.aiProviderConfig ? getProviderInfo(provider.aiProviderConfig.providerType) : null;
                const isActive = provider.id === activeProviderId;
                return (
                  <TouchableOpacity
                    key={provider.id}
                    onPress={() => setActiveProviderId(provider.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.providerTab,
                      {
                        backgroundColor: isActive ? `${colors.primary}18` : colors.codeBackground,
                        borderColor: isActive ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <XStack alignItems="center" gap={4}>
                      {info && (() => { const Icon = info.icon; return <Icon size={13} color={isActive ? colors.primary : colors.textSecondary} />; })()}
                      <Text fontSize={13} fontWeight={isActive ? '600' : '400'} color={isActive ? colors.primary : colors.textSecondary}>
                        {info?.name ?? provider.name}
                      </Text>
                    </XStack>
                  </TouchableOpacity>
                );
              })}
            </XStack>
          </ScrollView>

          {/* Search */}
          <TextInput
            style={[styles.searchInput, {
              backgroundColor: colors.inputBackground,
              color: colors.text,
              borderColor: colors.inputBorder,
            }]}
            placeholder="Search models..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Model list */}
          {loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderModelItem}
              ListEmptyComponent={
                <Text textAlign="center" paddingVertical={Spacing.xl} fontSize={FontSize.body} color={colors.textTertiary}>
                  {search ? 'No models match' : 'No models available — add API key in settings'}
                </Text>
              }
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            />
          )}

          {/* Manual model input */}
          <YStack paddingHorizontal={Spacing.md} paddingTop={Spacing.sm}>
            <TextInput
              style={[styles.manualInput, {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.inputBorder,
              }]}
              placeholder="Or type model ID manually..."
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={(e) => {
                const val = e.nativeEvent.text.trim();
                if (val) selectModel(val);
              }}
            />
          </YStack>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: hairline,
  },
  providerTab: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  searchInput: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
    marginBottom: Spacing.sm,
  },
  manualInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
});
