/**
 * Compact model picker bar — shows current model and lets user change it inline.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { ACPServerConfiguration, ServerType } from '../acp/models/types';
import { useAppStore } from '../stores/appStore';
import { getProviderInfo } from '../ai/providers';
import { fetchModelsFromProvider, FetchedModel } from '../ai/ModelFetcher';
import { getCachedModels } from '../ai/ModelCache';
import { getApiKey } from '../storage/SecureStorage';

const hairline = StyleSheet.hairlineWidth;

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
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm + 2,
          borderBottomWidth: hairline,
          borderBottomColor: 'rgba(0,0,0,0.06)',
          ...(isSelected ? { backgroundColor: colors.primary + '18' } : {}),
        }}
        onPress={() => selectModel(item.id)}
        activeOpacity={0.6}
      >
        <YStack flex={1}>
          <Text
            color={isSelected ? colors.primary : colors.text}
            fontSize={FontSize.body}
            flex={1}
            marginRight={Spacing.sm}
            numberOfLines={1}
          >
            {item.id}
          </Text>
          <XStack gap={4} marginTop={2}>
            {item.supportsVision && <Text fontSize={10}>👁</Text>}
            {item.supportsTools && <Text fontSize={10}>🔧</Text>}
            {item.supportsReasoning && <Text fontSize={10}>🧠</Text>}
          </XStack>
        </YStack>
        {isSelected && <Text fontSize={14} color={colors.primary}>✓</Text>}
      </TouchableOpacity>
    );
  }, [config.modelId, colors, selectModel]);

  return (
    <>
      <XStack alignItems="center" paddingHorizontal={Spacing.md} paddingVertical={Spacing.xs} gap={Spacing.xs} borderColor="$separator">
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: Radius.full,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 5,
            gap: 4,
            flex: 1,
            maxWidth: 280,
            backgroundColor: colors.codeBackground,
          }}
          onPress={openPicker}
          activeOpacity={0.7}
        >
          <Text fontSize={14}>{providerInfo.icon}</Text>
          <Text fontSize={FontSize.caption} fontWeight="500" flex={1} color="$color" numberOfLines={1}>
            {config.modelId}
          </Text>
          <Text fontSize={10} color="$textTertiary">▾</Text>
        </TouchableOpacity>

        {/* Temperature indicator */}
        <TouchableOpacity
          style={{
            borderRadius: Radius.full,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 5,
            backgroundColor: colors.codeBackground,
          }}
          onPress={() => {
            const currentIdx = tempOptions.indexOf(config.temperature ?? 0.7);
            const nextIdx = (currentIdx + 1) % tempOptions.length;
            setTemperature(tempOptions[nextIdx]);
          }}
          activeOpacity={0.7}
        >
          <Text fontSize={FontSize.caption} color="$textSecondary">
            🌡️ {config.temperature?.toFixed(1) ?? '0.7'}
          </Text>
        </TouchableOpacity>
      </XStack>

      {/* Model picker modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <YStack flex={1} justifyContent="flex-end" backgroundColor="rgba(0,0,0,0.4)">
          <YStack
            borderTopLeftRadius={Radius.lg}
            borderTopRightRadius={Radius.lg}
            maxHeight="70%"
            paddingBottom={40}
            backgroundColor={colors.surface}
          >
            <XStack justifyContent="space-between" alignItems="center" padding={Spacing.md}>
              <Text fontSize={FontSize.headline} fontWeight="600" color="$color">Select Model</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text fontSize={FontSize.body} fontWeight="500" color="$colorFocus">Done</Text>
              </TouchableOpacity>
            </XStack>

            <TextInput
              style={{
                marginHorizontal: Spacing.md,
                borderRadius: Radius.md,
                borderWidth: 1,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                fontSize: FontSize.body,
                marginBottom: Spacing.sm,
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.inputBorder,
              }}
              placeholder="Search models..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {loading ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                renderItem={renderModelItem}
                ListEmptyComponent={
                  <Text textAlign="center" paddingVertical={Spacing.xl} fontSize={FontSize.body} color="$textTertiary">
                    {search ? 'No models match' : 'No models available'}
                  </Text>
                }
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              />
            )}

            {/* Manual model input */}
            <YStack paddingHorizontal={Spacing.md} paddingTop={Spacing.sm}>
              <TextInput
                style={{
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  fontSize: FontSize.body,
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                }}
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
          </YStack>
        </YStack>
      </Modal>
    </>
  );
});
