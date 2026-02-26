/**
 * Step2CopilotModels — Model selection for Copilot SDK Bridge.
 * Fetches available models from bridge, lets user pick one, then saves.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Platform } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, Check, Github, RefreshCw, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';
import { CopilotBridgeService } from '../../ai/copilot';

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step2CopilotModelsProps {
  w: WizardState;
  colors: ThemeColors;
}

interface BridgeModel {
  id: string;
  name: string;
}

export function Step2CopilotModels({ w, colors }: Step2CopilotModelsProps) {
  const [models, setModels] = useState<BridgeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bridge = CopilotBridgeService.getInstance();
      if (!bridge.isConnected()) {
        await bridge.connect({
          url: w.copilotUrl,
          token: w.copilotToken.trim() || undefined,
          reconnect: false,
        });
      }
      const result = await bridge.listModels();
      if (!mountedRef.current) return;
      setModels(result.models.map(m => ({
        id: m.id,
        name: m.name ?? m.id,
      })));
    } catch (err) {
      if (!mountedRef.current) return;
      setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [w.copilotUrl, w.copilotToken]);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const renderModel = useCallback(({ item }: { item: BridgeModel }) => {
    const selected = w.copilotModelId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.modelItem,
          {
            backgroundColor: selected ? `${colors.primary}15` : colors.cardBackground,
            borderColor: selected ? colors.primary : colors.separator,
          },
        ]}
        onPress={() => {
          w.setCopilotModelId(item.id);
          Haptics.selectionAsync();
        }}
        activeOpacity={0.7}
      >
        <XStack alignItems="center" gap={Spacing.sm} flex={1}>
          {selected ? (
            <Check size={16} color={colors.primary} />
          ) : (
            <Sparkles size={16} color={colors.textTertiary} />
          )}
          <YStack flex={1}>
            <Text
              fontSize={FontSize.body}
              fontWeight={selected ? '600' : '400'}
              color={selected ? colors.primary : colors.text}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.name !== item.id && (
              <Text fontSize={11} color={colors.textTertiary} numberOfLines={1} fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}>
                {item.id}
              </Text>
            )}
          </YStack>
        </XStack>
      </TouchableOpacity>
    );
  }, [w.copilotModelId, colors, w]);

  return (
    <YStack gap={Spacing.lg} flex={1}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Github size={28} color={colors.primary} />
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          Scegli modello
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          {models.length > 0 ? `${models.length} modelli disponibili` : 'Caricamento modelli dal bridge...'}
        </Text>
      </YStack>

      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center" padding={Spacing.xl}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text fontSize={FontSize.footnote} color={colors.textTertiary} marginTop={Spacing.md}>
            Caricamento modelli...
          </Text>
        </YStack>
      ) : error ? (
        <YStack alignItems="center" gap={Spacing.md} padding={Spacing.lg}>
          <Text fontSize={FontSize.body} color={colors.destructive} textAlign="center">
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.separator }]}
            onPress={fetchModels}
          >
            <XStack alignItems="center" gap={Spacing.xs}>
              <RefreshCw size={14} color={colors.primary} />
              <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="500">Riprova</Text>
            </XStack>
          </TouchableOpacity>
        </YStack>
      ) : (
        <FlatList
          data={models}
          keyExtractor={item => item.id}
          renderItem={renderModel}
          contentContainerStyle={{ gap: 4 }}
          style={{ maxHeight: 300 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Save button */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: colors.primary, opacity: w.saving || !w.copilotModelId ? 0.4 : 1 },
        ]}
        onPress={w.handleSaveCopilot}
        disabled={w.saving || !w.copilotModelId}
        activeOpacity={0.8}
      >
        {w.saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <XStack alignItems="center" gap={Spacing.xs}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
              Connetti
            </Text>
            <Check size={18} color={colors.contrastText} />
          </XStack>
        )}
      </TouchableOpacity>
    </YStack>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  modelItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  retryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
