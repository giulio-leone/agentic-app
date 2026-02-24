/**
 * ProviderModelPicker — full-screen modal with autocomplete search.
 * Uses FlatList with plain RN Views to avoid Fabric SectionList crash on Android.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
  Text as RNText,
} from 'react-native';
import { Check, Eye, Brain, Wrench, Search, X, ChevronLeft } from 'lucide-react-native';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { ServerType } from '../../acp/models/types';
import type { ACPServerConfiguration } from '../../acp/models/types';
import { getProviderInfo } from '../../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../../ai/ModelFetcher';
import { getCachedModels } from '../../ai/ModelCache';
import { getApiKey } from '../../storage/SecureStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;
  bridgeModels: Array<{ id: string; name: string; provider: string }>;
  selectedBridgeModel: string | null;
  onSelectServer: (id: string) => void;
  onUpdateServer: (server: ACPServerConfiguration) => void;
  onSelectBridgeModel: (modelId: string | null) => void;
  colors: ThemeColors;
}

interface ModelOption {
  id: string;
  modelId: string;
  providerName: string;
  providerServerId: string;
  displayName: string;
  model: FetchedModel;
  isHeader?: boolean;
}

export const ProviderModelPicker = React.memo(function ProviderModelPicker({
  visible,
  onClose,
  servers,
  selectedServerId,
  bridgeModels,
  selectedBridgeModel,
  onSelectServer,
  onUpdateServer,
  onSelectBridgeModel,
  colors,
}: Props) {
  const providers = useMemo(
    () => servers.filter(s => s.serverType === ServerType.AIProvider && s.aiProviderConfig),
    [servers],
  );

  const [allOptions, setAllOptions] = useState<ModelOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Reset contentReady when Modal closes
  useEffect(() => {
    if (!visible) setContentReady(false);
  }, [visible]);

  // Triggered by Modal onShow — guarantees animation is complete before rendering
  const handleModalShow = useCallback(() => {
    setTimeout(() => setContentReady(true), 100);
  }, []);

  // Populate models
  useEffect(() => {
    if (!visible || !contentReady) return;
    if (providers.length === 0 && bridgeModels.length === 0) return;

    setQuery('');

    // Bridge models: synchronous
    if (bridgeModels.length > 0) {
      const bridgeServer = servers.find(s => s.serverType === ServerType.ACP || s.scheme === 'tcp');
      setAllOptions(bridgeModels.map(m => ({
        id: `bridge::${m.id}`,
        modelId: m.id,
        providerName: `Bridge (${m.provider})`,
        providerServerId: bridgeServer?.id ?? 'bridge',
        displayName: m.name,
        model: { id: m.id, name: m.name, created: 0 },
      })));
      setLoading(false);
      return;
    }

    // AI Provider models: async fetch
    let cancelled = false;
    setLoading(true);

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
              models = await fetchModelsFromProvider(config.providerType, apiKey, config.baseUrl ?? info.defaultBaseUrl);
            }
          } catch { /* skip */ }
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
      }
    })();

    return () => { cancelled = true; };
  }, [visible, contentReady, providers, bridgeModels, servers]);

  // Filter
  const filtered = useMemo(() => {
    const opts = query.trim()
      ? allOptions.filter(o => {
          const q = query.toLowerCase();
          return o.modelId.toLowerCase().includes(q) || o.displayName.toLowerCase().includes(q) || o.providerName.toLowerCase().includes(q);
        })
      : allOptions;

    // Insert section headers
    const result: ModelOption[] = [];
    let lastProvider = '';
    for (const o of opts) {
      if (o.providerName !== lastProvider) {
        lastProvider = o.providerName;
        result.push({ ...o, id: `header::${o.providerName}`, isHeader: true });
      }
      result.push(o);
    }
    return result;
  }, [query, allOptions]);

  const currentServer = providers.find(p => p.id === selectedServerId);
  const currentModelId = currentServer?.aiProviderConfig?.modelId;

  const selectModel = useCallback((option: ModelOption) => {
    const provider = servers.find(s => s.id === option.providerServerId);
    if (option.id.startsWith('bridge::')) {
      if (provider) onSelectServer(provider.id);
      onSelectBridgeModel(option.modelId);
      Keyboard.dismiss();
      onClose();
      return;
    }
    if (!provider?.aiProviderConfig) return;
    onSelectServer(option.providerServerId);
    onUpdateServer({
      ...provider,
      aiProviderConfig: { ...provider.aiProviderConfig, modelId: option.modelId },
    });
    Keyboard.dismiss();
    onClose();
  }, [servers, onSelectServer, onUpdateServer, onClose, onSelectBridgeModel]);

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
    if (item.isHeader) {
      return (
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface, borderBottomColor: colors.separator }]}>
          <RNText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{item.providerName}</RNText>
        </View>
      );
    }

    const isBridge = item.id.startsWith('bridge::');
    const isSelected = isBridge
      ? item.modelId === selectedBridgeModel
      : item.modelId === currentModelId && item.providerServerId === selectedServerId;

    return (
      <TouchableOpacity
        style={[styles.modelRow, { borderBottomColor: colors.separator }, isSelected && { backgroundColor: `${colors.primary}10` }]}
        onPress={() => selectModel(item)}
        activeOpacity={0.6}
      >
        <View style={styles.modelInfo}>
          <RNText style={[styles.modelName, { color: isSelected ? colors.primary : colors.text }, isSelected && styles.modelNameSelected]}>
            {item.displayName}
          </RNText>
          <RNText style={[styles.modelId, { color: colors.textTertiary }]}>{item.modelId}</RNText>
          <View style={styles.badges}>
            {item.model.supportsVision && (
              <View style={styles.badge}>
                <Eye size={11} color={colors.textTertiary} />
                <RNText style={[styles.badgeText, { color: colors.textTertiary }]}>Vision</RNText>
              </View>
            )}
            {item.model.supportsTools && (
              <View style={styles.badge}>
                <Wrench size={11} color={colors.textTertiary} />
                <RNText style={[styles.badgeText, { color: colors.textTertiary }]}>Tools</RNText>
              </View>
            )}
            {item.model.supportsReasoning && (
              <View style={styles.badge}>
                <Brain size={11} color={colors.textTertiary} />
                <RNText style={[styles.badgeText, { color: colors.textTertiary }]}>Reasoning</RNText>
              </View>
            )}
          </View>
        </View>
        {isSelected && <Check size={20} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [currentModelId, selectedServerId, selectedBridgeModel, colors, selectModel]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={handleModalShow}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={[styles.searchBox, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
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
          </View>
        </View>

        {/* Content */}
        {!contentReady || loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <RNText style={[styles.loadingText, { color: colors.textTertiary }]}>Loading models…</RNText>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <RNText style={[styles.emptyText, { color: colors.textTertiary }]}>
                  {query ? `No models matching "${query}"` : 'No models available\nConfigure a provider in Settings'}
                </RNText>
                {query.trim().length > 0 && (
                  <TouchableOpacity onPress={handleManualSubmit} style={[styles.useCustom, { borderColor: colors.primary }]}>
                    <RNText style={[styles.useCustomText, { color: colors.primary }]}>Use "{query}" as model ID</RNText>
                  </TouchableOpacity>
                )}
              </View>
            }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: Spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modelInfo: {
    flex: 1,
    gap: 2,
  },
  modelName: {
    fontSize: 16,
  },
  modelNameSelected: {
    fontWeight: '600',
  },
  modelId: {
    fontSize: 13,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  useCustom: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  useCustomText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
