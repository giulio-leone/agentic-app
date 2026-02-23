import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  View,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ChevronLeft, Check, Search, MessageSquare } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import type { ThemeColors } from '../../utils/theme';
import type { useQuickSetupWizard } from './useQuickSetupWizard';
import { AdvancedModelSettings } from './AdvancedModelSettings';
import { ITEM_LAYOUT_60, keyExtractorById } from '../../utils/listUtils';

const separatorStyle = { height: Spacing.xs } as const;
const ItemSeparator = () => <View style={separatorStyle} />;

type WizardState = ReturnType<typeof useQuickSetupWizard>;

interface Step2ModelPickerProps {
  w: WizardState;
  colors: ThemeColors;
}

export function Step2ModelPicker({ w, colors }: Step2ModelPickerProps) {
  const renderModelItem = useCallback(({ item }: { item: { id: string; name: string; contextWindow?: number } }) => {
    const isSelected = item.id === w.selectedModelId;
    return (
      <TouchableOpacity
        style={[
          styles.modelRow,
          {
            backgroundColor: isSelected ? colors.primaryMuted : 'transparent',
            borderColor: isSelected ? colors.primary : colors.separator,
            borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          w.setSelectedModelId(item.id);
        }}
        activeOpacity={0.7}
      >
        <YStack flex={1}>
          <Text fontSize={FontSize.body} fontWeight={isSelected ? '600' : '400'} color={colors.text} numberOfLines={1}>
            {item.name}
          </Text>
          <Text fontSize={FontSize.caption} color={colors.textTertiary} numberOfLines={1}>
            {item.id}
            {item.contextWindow ? ` · ${Math.round(item.contextWindow / 1000)}K ctx` : ''}
          </Text>
        </YStack>
        {isSelected && <Check size={18} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [w.selectedModelId, w.setSelectedModelId, colors]);

  return (
    <YStack gap={Spacing.md} flex={1}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          Scegli un modello
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          {w.displayModels.length} modelli disponibili
        </Text>
      </YStack>

      {/* Search */}
      <XStack
        alignItems="center"
        gap={Spacing.xs}
        paddingHorizontal={Spacing.md}
        paddingVertical={Spacing.sm}
        borderRadius={Radius.md}
        style={{ backgroundColor: colors.cardBackground }}
      >
        <Search size={16} color={colors.textTertiary} />
        <TextInput
          style={{ flex: 1, fontSize: FontSize.body, color: colors.text, padding: 0 }}
          placeholder="Cerca modello..."
          placeholderTextColor={colors.textTertiary}
          value={w.modelSearch}
          onChangeText={w.setModelSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </XStack>

      {/* Model list */}
      <FlatList
        data={w.displayModels}
        keyExtractor={keyExtractorById}
        style={{ maxHeight: 260 }}
        keyboardShouldPersistTaps="handled"
        renderItem={renderModelItem}
        getItemLayout={ITEM_LAYOUT_60}
        removeClippedSubviews
        ItemSeparatorComponent={ItemSeparator}
      />

      {/* Advanced Settings (collapsible) */}
      <AdvancedModelSettings
        showAdvanced={w.showAdvanced}
        onToggle={() => w.setShowAdvanced(!w.showAdvanced)}
        systemPrompt={w.systemPrompt}
        setSystemPrompt={w.setSystemPrompt}
        temperature={w.temperature}
        setTemperature={w.setTemperature}
        reasoningEnabled={w.reasoningEnabled}
        setReasoningEnabled={w.setReasoningEnabled}
        supportsReasoning={!!w.selectedModelInfo?.supportsReasoning}
        colors={colors}
      />

      {/* Save */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: w.saving ? 0.7 : 1 }]}
        onPress={w.handleSaveAI}
        disabled={w.saving || !w.selectedModelId}
        activeOpacity={0.8}
      >
        {w.saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <XStack alignItems="center" gap={Spacing.xs}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
              {w.isEditing ? 'Salva modifiche' : 'Inizia a chattare'}
            </Text>
            {w.isEditing ? <Check size={18} color={colors.contrastText} /> : <MessageSquare size={18} color={colors.contrastText} />}
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
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
