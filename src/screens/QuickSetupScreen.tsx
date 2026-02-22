/**
 * QuickSetupScreen — 3-step onboarding wizard with animated transitions.
 *
 * AI Provider flow:  Step 1: Choose provider → Step 2: API key → Step 3: Pick model
 * ACP/Codex flow:    Step 1: Choose ACP/Codex → Step 2: Host + token → Save
 *
 * Logic extracted into:
 *  - quicksetup/presets.ts    (preset data)
 *  - quicksetup/useQuickSetupWizard.ts (state + handlers)
 */

import React from 'react';
import {
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  FlatList,
  View,
  UIManager,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Check, Search, ChevronDown, ChevronUp, Sliders, MessageSquare, Brain } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { AIProviderType } from '../ai/types';
import { AI_PRESETS, ACP_PRESETS } from './quicksetup/presets';
import { useQuickSetupWizard } from './quicksetup/useQuickSetupWizard';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export function QuickSetupScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const w = useQuickSetupWizard();

  // ── Render Steps ──

  const renderStepIndicator = () => (
    <XStack justifyContent="center" gap={Spacing.xs} marginBottom={Spacing.lg}>
      {Array.from({ length: w.stepCount }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === w.step ? colors.primary : colors.separator,
              width: i === w.step ? 24 : 8,
            },
          ]}
        />
      ))}
    </XStack>
  );

  const renderStep0 = () => {
    const isFirstOnboarding = !w.isEditing && w.servers.length === 0;
    let cardIndex = 0;
    return (
    <YStack gap={Spacing.xs}>
      <YStack alignItems="center" gap={Spacing.xs} marginBottom={Spacing.sm}>
        {isFirstOnboarding ? (
          <Text fontSize={28} fontWeight="700" color={colors.text}>
            Benvenuto 👋
          </Text>
        ) : (
          <Text fontSize={24} fontWeight="700" color={colors.text}>
            {w.isEditing ? 'Modifica server' : 'Aggiungi server'}
          </Text>
        )}
        <Text fontSize={FontSize.footnote} textAlign="center" color={colors.textTertiary}>
          Scegli come connetterti
        </Text>
      </YStack>

      {/* AI Provider presets */}
      <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary} textTransform="uppercase" letterSpacing={0.5}>
        AI Provider
      </Text>
      {AI_PRESETS.map(preset => {
        const idx = cardIndex++;
        return (
        <Animated.View
          key={preset.type}
          style={{ opacity: w.cardAnims[idx], transform: [{ translateY: w.cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
        >
          <TouchableOpacity
            style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            onPress={() => w.handlePresetSelect(preset)}
            activeOpacity={0.7}
          >
            <XStack alignItems="center" gap={Spacing.sm}>
              <preset.icon size={20} color={colors.primary} />
              <Text fontSize={FontSize.body} fontWeight="600" color={colors.text} flex={1}>
                {preset.label}
              </Text>
              <ChevronRight size={16} color={colors.textTertiary} />
            </XStack>
          </TouchableOpacity>
        </Animated.View>
        );
      })}

      {/* Agent CLI presets — flat list */}
      <Text fontSize={FontSize.caption} fontWeight="600" color={colors.textTertiary} textTransform="uppercase" letterSpacing={0.5} marginTop={Spacing.xs}>
        Agent CLI (ACP)
      </Text>
      {ACP_PRESETS.map(preset => {
        const idx = cardIndex++;
        return (
        <Animated.View
          key={preset.label}
          style={{ opacity: w.cardAnims[idx], transform: [{ translateY: w.cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
        >
          <TouchableOpacity
            style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            onPress={() => w.handleACPSelect(preset)}
            activeOpacity={0.7}
          >
            <XStack alignItems="center" gap={Spacing.sm}>
              <preset.icon size={20} color={colors.primary} />
              <Text fontSize={FontSize.body} fontWeight="600" color={colors.text} flex={1}>
                {preset.label}
              </Text>
              <ChevronRight size={16} color={colors.textTertiary} />
            </XStack>
          </TouchableOpacity>
        </Animated.View>
        );
      })}

      {/* Skip + Advanced */}
      <XStack justifyContent="space-between" marginTop={Spacing.xs}>
        {w.servers.length > 0 && (
          <TouchableOpacity style={styles.advancedLink} onPress={() => w.navigation.goBack()}>
            <XStack alignItems="center" gap={4}>
              <ChevronLeft size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
                Torna alla chat
              </Text>
            </XStack>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.advancedLink} onPress={() => w.navigation.navigate('AddServer')}>
          <XStack alignItems="center" gap={4}>
            <Text fontSize={FontSize.footnote} color={colors.primary}>
              Configurazione avanzata
            </Text>
            <ChevronRight size={14} color={colors.primary} />
          </XStack>
        </TouchableOpacity>
      </XStack>
    </YStack>
    );
  };

  const renderStep1AI = () => (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <XStack alignItems="center" gap={Spacing.sm}>
          {w.selectedPreset && <w.selectedPreset.icon size={22} color={colors.primary} />}
          <Text fontSize={24} fontWeight="700" color={colors.text}>
            {w.selectedPreset?.label}
          </Text>
        </XStack>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          Inserisci la tua API key
        </Text>
      </YStack>

      <YStack gap={Spacing.sm}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
          placeholder={w.selectedPreset?.type === AIProviderType.OpenRouter ? 'sk-or-...' : 'sk-...'}
          placeholderTextColor={colors.textTertiary}
          value={w.apiKey}
          onChangeText={w.setApiKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {w.isFetching && (
          <XStack alignItems="center" gap={Spacing.xs}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
              Caricamento modelli...
            </Text>
          </XStack>
        )}
        {w.fetchError && (
          <Text fontSize={FontSize.caption} color={colors.destructive}>
            {w.fetchError}
          </Text>
        )}
        {w.models.length > 0 && !w.isFetching && (
          <XStack alignItems="center" gap={4}>
            <Check size={14} color={colors.healthyGreen} />
            <Text fontSize={FontSize.caption} color={colors.healthyGreen}>
              {w.models.length} modelli trovati
            </Text>
          </XStack>
        )}

        <Text fontSize={FontSize.caption} color={colors.textTertiary}>
          La chiave viene salvata in modo sicuro sul dispositivo.{'\n'}
          I modelli vengono caricati automaticamente.
        </Text>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: (w.apiKey.trim() || w.isEditing) ? 1 : 0.4 }]}
        onPress={w.goToModelStep}
        disabled={!w.apiKey.trim() && !w.isEditing}
        activeOpacity={0.8}
      >
        <XStack alignItems="center" gap={Spacing.xs}>
          <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
            Scegli modello
          </Text>
          <ChevronRight size={18} color={colors.contrastText} />
        </XStack>
      </TouchableOpacity>
    </YStack>
  );

  const renderStep1ACP = () => (
    <YStack gap={Spacing.lg}>
      <TouchableOpacity onPress={w.goBack} style={styles.backButton}>
        <ChevronLeft size={20} color={colors.primary} />
        <Text fontSize={FontSize.body} color={colors.primary}>Indietro</Text>
      </TouchableOpacity>

      <YStack alignItems="center" gap={Spacing.xs}>
        <Text fontSize={24} fontWeight="700" color={colors.text}>
          {w.selectedACP?.label}
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
          Configura la connessione al server
        </Text>
      </YStack>

      <YStack gap={Spacing.md}>
        {/* Name */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Nome</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator, fontFamily: undefined }]}
            placeholder={w.selectedACP?.label ?? 'My Agent'}
            placeholderTextColor={colors.textTertiary}
            value={w.acpName}
            onChangeText={w.setAcpName}
            autoCapitalize="none"
          />
        </YStack>

        {/* Scheme toggle */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Protocollo</Text>
          <XStack gap={Spacing.sm}>
            {(['ws', 'wss', 'tcp'] as const).map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.schemeChip,
                  {
                    backgroundColor: w.acpScheme === s ? colors.primary : colors.cardBackground,
                    borderColor: w.acpScheme === s ? colors.primary : colors.separator,
                  },
                ]}
                onPress={() => { Haptics.selectionAsync(); w.setAcpScheme(s); }}
              >
                <Text
                  fontSize={FontSize.footnote}
                  fontWeight="600"
                  color={w.acpScheme === s ? colors.contrastText : colors.text}
                >
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        </YStack>

        {/* Host */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Host</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            placeholder="localhost:8765"
            placeholderTextColor={colors.textTertiary}
            value={w.acpHost}
            onChangeText={w.setAcpHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
        </YStack>

        {/* Token (optional) */}
        <YStack gap={Spacing.xs}>
          <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>Token (opzionale)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator }]}
            placeholder="Bearer token"
            placeholderTextColor={colors.textTertiary}
            value={w.acpToken}
            onChangeText={w.setAcpToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </YStack>
      </YStack>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: w.saving ? 0.7 : (w.acpHost.trim() ? 1 : 0.4) }]}
        onPress={w.handleSaveACP}
        disabled={w.saving || !w.acpHost.trim()}
        activeOpacity={0.8}
      >
        {w.saving ? (
          <ActivityIndicator color={colors.contrastText} />
        ) : (
          <XStack alignItems="center" gap={Spacing.xs}>
            <Text fontSize={FontSize.headline} fontWeight="600" color={colors.contrastText}>
              {w.isEditing ? 'Salva modifiche' : 'Connetti'}
            </Text>
            <Check size={18} color={colors.contrastText} />
          </XStack>
        )}
      </TouchableOpacity>
    </YStack>
  );

  const renderStep1 = () => w.flow === 'acp' ? renderStep1ACP() : renderStep1AI();

  const renderStep2 = () => (
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
        keyExtractor={item => item.id}
        style={{ maxHeight: 260 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
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
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
      />

      {/* Advanced Settings (collapsible) */}
      <TouchableOpacity
        style={[styles.advancedToggle, { borderColor: colors.separator }]}
        onPress={() => { Haptics.selectionAsync(); w.setShowAdvanced(!w.showAdvanced); }}
        activeOpacity={0.7}
      >
        <XStack alignItems="center" gap={Spacing.xs} flex={1}>
          <Sliders size={16} color={colors.textTertiary} />
          <Text fontSize={FontSize.footnote} fontWeight="500" color={colors.textSecondary}>
            Impostazioni avanzate
          </Text>
        </XStack>
        {w.showAdvanced
          ? <ChevronUp size={16} color={colors.textTertiary} />
          : <ChevronDown size={16} color={colors.textTertiary} />
        }
      </TouchableOpacity>

      {w.showAdvanced && (
        <YStack gap={Spacing.md} paddingHorizontal={Spacing.xs}>
          {/* System Prompt */}
          <YStack gap={Spacing.xs}>
            <XStack alignItems="center" gap={Spacing.xs}>
              <MessageSquare size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>System Prompt</Text>
            </XStack>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { color: colors.text, backgroundColor: colors.cardBackground, borderColor: colors.separator },
              ]}
              placeholder="Sei un assistente utile..."
              placeholderTextColor={colors.textTertiary}
              value={w.systemPrompt}
              onChangeText={w.setSystemPrompt}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </YStack>

          {/* Temperature */}
          <YStack gap={Spacing.xs}>
            <XStack alignItems="center" gap={Spacing.xs}>
              <Sliders size={14} color={colors.textTertiary} />
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.textSecondary}>
                Temperature: {w.temperature !== undefined ? w.temperature!.toFixed(1) : 'Default'}
              </Text>
            </XStack>
            <XStack alignItems="center" gap={Spacing.sm}>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>0</Text>
              <View style={{ flex: 1 }}>
                <XStack alignItems="center">
                  {[0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.tempChip,
                        {
                          backgroundColor: w.temperature === val ? colors.primary : colors.cardBackground,
                          borderColor: w.temperature === val ? colors.primary : colors.separator,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        w.setTemperature(w.temperature === val ? undefined : val);
                      }}
                    >
                      <Text
                        fontSize={11}
                        fontWeight="600"
                        color={w.temperature === val ? colors.contrastText : colors.textTertiary}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </View>
              <Text fontSize={FontSize.caption} color={colors.textTertiary}>2</Text>
            </XStack>
          </YStack>

          {/* Reasoning (only if model supports it) */}
          {w.selectedModelInfo?.supportsReasoning && (
            <TouchableOpacity
              style={[
                styles.reasoningToggle,
                {
                  backgroundColor: w.reasoningEnabled ? colors.primaryMuted : colors.cardBackground,
                  borderColor: w.reasoningEnabled ? colors.primary : colors.separator,
                },
              ]}
              onPress={() => { Haptics.selectionAsync(); w.setReasoningEnabled(!w.reasoningEnabled); }}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" gap={Spacing.sm} flex={1}>
                <Brain size={18} color={w.reasoningEnabled ? colors.primary : colors.textTertiary} />
                <YStack>
                  <Text fontSize={FontSize.body} fontWeight="500" color={colors.text}>Extended Thinking</Text>
                  <Text fontSize={FontSize.caption} color={colors.textTertiary}>Ragionamento step-by-step</Text>
                </YStack>
              </XStack>
              <View style={[
                styles.toggleTrack,
                { backgroundColor: w.reasoningEnabled ? colors.primary : colors.systemGray4 },
              ]}>
                <View style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: w.reasoningEnabled ? 20 : 2 }] },
                ]} />
              </View>
            </TouchableOpacity>
          )}
        </YStack>
      )}

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

  const steps = [renderStep0, renderStep1, renderStep2];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + 80,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}
        <Animated.View style={{ opacity: w.fadeAnim, transform: [{ translateX: w.slideAnim }], flex: 1 }}>
          {steps[w.step]()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
  },
  presetCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compactCard: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  primaryButton: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedLink: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
  schemeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: undefined,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tempChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 1,
  },
  reasoningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
});
