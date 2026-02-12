/**
 * Compact model picker bar — shows current model and lets user change it inline.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { ACPServerConfiguration, ServerType } from '../acp/models/types';
import { useAppStore } from '../stores/appStore';
import { getProviderInfo } from '../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../ai/ModelFetcher';
import { getCachedModels } from '../ai/ModelCache';
import { getApiKey } from '../storage/SecureStorage';

interface Props {
  server: ACPServerConfiguration;
}

export const ModelPickerBar = React.memo(function ModelPickerBar({ server }: Props) {
  const { colors } = useDesignSystem();
  const updateServer = useAppStore(s => s.updateServer);
  const [modalVisible, setModalVisible] = useState(false);
  const [models, setModels] = useState<FetchedModel[]>([]);
  const [filtered, setFiltered] = useState<FetchedModel[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  if (server.serverType !== ServerType.AIProvider || !server.aiProviderConfig) {
    return null;
  }

  const config = server.aiProviderConfig;
  const providerInfo = getProviderInfo(config.providerType);

  const openPicker = useCallback(async () => {
    setModalVisible(true);
    setSearch('');
    setLoading(true);

    // Try cached first
    const cached = await getCachedModels(config.providerType);
    if (!mountedRef.current) return;
    if (cached && cached.length > 0) {
      setModels(cached);
      setFiltered(cached);
      setLoading(false);
    }

    // Fetch fresh
    try {
      const apiKey = await getApiKey(`${server.id}_${config.providerType}`);
      if (!mountedRef.current) return;
      if (apiKey) {
        const fresh = await fetchModelsFromProvider(
          config.providerType,
          apiKey,
          config.baseUrl ?? providerInfo.defaultBaseUrl,
        );
        if (!mountedRef.current) return;
        if (fresh.length > 0) {
          setModels(fresh);
          setFiltered(fresh);
        }
      }
    } catch {
      // keep cached
    }
    if (mountedRef.current) setLoading(false);
  }, [config, server.id, providerInfo]);

  const selectModel = useCallback(async (modelId: string) => {
    setModalVisible(false);
    await updateServer({
      ...server,
      aiProviderConfig: { ...config, modelId },
    });
  }, [server, config, updateServer]);

  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      setFiltered(models.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)));
    } else {
      setFiltered(models);
    }
  }, [search, models]);

  // Temperature chips
  const tempOptions = useMemo(() => [0, 0.3, 0.7, 1.0, 1.5], []);

  const setTemperature = useCallback(async (temp: number) => {
    await updateServer({
      ...server,
      aiProviderConfig: { ...config, temperature: temp },
    });
  }, [server, config, updateServer]);

  const renderModelItem = useCallback(({ item }: { item: FetchedModel }) => {
    const isSelected = item.id === config.modelId;
    return (
      <TouchableOpacity
        style={[styles.modelRow, isSelected && { backgroundColor: colors.primary + '18' }]}
        onPress={() => selectModel(item.id)}
        activeOpacity={0.6}
      >
        <View style={styles.modelRowInfo}>
          <Text
            style={[styles.modelRowText, { color: isSelected ? colors.primary : colors.text }]}
            numberOfLines={1}
          >
            {item.id}
          </Text>
          <View style={styles.modelBadges}>
            {item.supportsVision && <Text style={styles.badge}>👁</Text>}
            {item.supportsTools && <Text style={styles.badge}>🔧</Text>}
            {item.supportsReasoning && <Text style={styles.badge}>🧠</Text>}
          </View>
        </View>
        {isSelected && <Text style={[styles.checkMark, { color: colors.primary }]}>✓</Text>}
      </TouchableOpacity>
    );
  }, [config.modelId, colors, selectModel]);

  return (
    <>
      <View style={[styles.bar, { borderColor: colors.separator }]}>
        <TouchableOpacity
          style={[styles.modelButton, { backgroundColor: colors.codeBackground }]}
          onPress={openPicker}
          activeOpacity={0.7}
        >
          <Text style={[styles.providerIcon]}>{providerInfo.icon}</Text>
          <Text style={[styles.modelName, { color: colors.text }]} numberOfLines={1}>
            {config.modelId}
          </Text>
          <Text style={[styles.chevron, { color: colors.textTertiary }]}>▾</Text>
        </TouchableOpacity>

        {/* Temperature indicator */}
        <TouchableOpacity
          style={[styles.tempChip, { backgroundColor: colors.codeBackground }]}
          onPress={() => {
            const currentIdx = tempOptions.indexOf(config.temperature ?? 0.7);
            const nextIdx = (currentIdx + 1) % tempOptions.length;
            setTemperature(tempOptions[nextIdx]);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tempLabel, { color: colors.textSecondary }]}>
            🌡️ {config.temperature?.toFixed(1) ?? '0.7'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Model picker modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Model</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
              placeholder="Search models..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                renderItem={renderModelItem}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    {search ? 'No models match' : 'No models available'}
                  </Text>
                }
                showsVerticalScrollIndicator={false}
                style={styles.modelList}
              />
            )}

            {/* Manual model input */}
            <View style={styles.manualInput}>
              <TextInput
                style={[styles.manualField, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
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
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  modelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    gap: 4,
    flex: 1,
    maxWidth: 280,
  },
  providerIcon: {
    fontSize: 14,
  },
  modelName: {
    fontSize: FontSize.caption,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    fontSize: 10,
  },
  tempChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  tempLabel: {
    fontSize: FontSize.caption,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.headline,
    fontWeight: '600',
  },
  modalClose: {
    fontSize: FontSize.body,
    fontWeight: '500',
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
  loader: {
    marginTop: Spacing.xl,
  },
  modelList: {
    flex: 1,
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  modelRowText: {
    fontSize: FontSize.body,
    flex: 1,
    marginRight: Spacing.sm,
  },
  modelRowInfo: {
    flex: 1,
  },
  checkMark: {
    fontSize: 14,
  },
  modelBadges: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  badge: {
    fontSize: 10,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    fontSize: FontSize.body,
  },
  manualInput: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  manualField: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
});
