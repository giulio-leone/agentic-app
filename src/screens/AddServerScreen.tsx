/**
 * Add/Edit Server screen — iOS Settings-style grouped fields.
 * Supports ACP, Codex, and AI Provider server types.
 * Logic extracted to useAddServerForm hook.
 */

import React from 'react';
import {
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { YStack, XStack, Text, Separator } from 'tamagui';
import { Lock, Brain, Eye } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ServerType } from '../acp/models/types';
import { ReasoningEffort } from '../ai/types';
import { ALL_PROVIDERS } from '../ai/providers';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { useAddServerForm } from '../hooks/useAddServerForm';

export const AddServerScreen = React.memo(function AddServerScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const w = useAddServerForm();
  const inputStyle = React.useMemo(() => ({
    flex: 1, fontSize: FontSize.body, color: colors.text, textAlign: 'right' as const, paddingVertical: 0,
  }), [colors.text]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.systemGray6 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Protocol section — 3-segment */}
        <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
          <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
            Protocol
          </Text>
          <XStack backgroundColor={colors.systemGray5} borderRadius={Radius.sm} padding={2} marginBottom={Spacing.md}>
            {([ServerType.ACP, ServerType.Codex, ServerType.CopilotCLI, ServerType.AIProvider] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: 6 },
                  w.serverType === type && {
                    backgroundColor: colors.cardBackground,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  w.handleServerTypeChange(type);
                }}
              >
                <Text
                  fontSize={FontSize.footnote}
                  fontWeight={w.serverType === type ? '600' : '500'}
                  color={w.serverType === type ? '$color' : '$textTertiary'}
                >
                  {type === ServerType.AIProvider ? 'AI Provider' : type === ServerType.Codex ? 'Codex' : type === ServerType.CopilotCLI ? 'Copilot' : 'ACP'}
                </Text>
              </TouchableOpacity>
            ))}
          </XStack>
        </YStack>

        {w.serverType === ServerType.AIProvider ? (
          <>
            {/* Provider Picker — horizontal scroll chips */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                Provider
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.sm }}
              >
                {ALL_PROVIDERS.map(p => {
                  const isSelected = p.type === w.selectedProvider;
                  return (
                    <TouchableOpacity
                      key={p.type}
                      style={[
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: Radius.full,
                          borderWidth: 1,
                          borderColor: colors.separator,
                          gap: 4,
                        },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => w.handleProviderChange(p.type)}
                      activeOpacity={0.7}
                    >
                      <Text fontSize={14}>{p.icon}</Text>
                      <Text
                        fontSize={FontSize.footnote}
                        fontWeight="500"
                        color={isSelected ? '$contrastText' : '$color'}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </YStack>

            {/* API Key */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>API Key</Text>
                <TextInput
                  style={inputStyle}
                  value={w.apiKey}
                  onChangeText={w.setApiKey}
                  placeholder={w.isEditing ? '••••••••' : 'sk-...'}
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </XStack>
              <XStack alignItems="center" gap={4}>
                <Lock size={12} color={colors.textTertiary} />
                <Text color="$textTertiary" fontSize={FontSize.caption} paddingBottom={Spacing.md}>
                  Stored securely on device
                </Text>
              </XStack>
            </YStack>

            {/* Model Picker */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between">
                <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                  Model
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 6,
                    borderRadius: Radius.sm,
                    marginTop: Spacing.sm,
                    minWidth: 60,
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                  }}
                  onPress={w.handleFetchModels}
                  disabled={w.isFetchingModels}
                  activeOpacity={0.7}
                  accessibilityLabel={w.fetchedModels ? 'Refresh models list' : 'Fetch available models'}
                >
                  {w.isFetchingModels ? (
                    <ActivityIndicator size="small" color={colors.contrastText} />
                  ) : (
                    <Text color="$contrastText" fontSize={FontSize.caption} fontWeight="600">
                      {w.fetchedModels ? '↻ Refresh' : '⬇ Fetch Models'}
                    </Text>
                  )}
                </TouchableOpacity>
              </XStack>
              {w.fetchError && (
                <Text color={colors.destructive} fontSize={FontSize.caption} paddingBottom={Spacing.sm}>
                  {w.fetchError}
                </Text>
              )}
              {w.displayModels.map((model, idx) => {
                const isSelected = model.id === w.selectedModel;
                return (
                  <React.Fragment key={model.id}>
                    {idx > 0 && (
                      <Separator borderColor="$separator" />
                    )}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: Spacing.md,
                        minHeight: 44,
                      }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        w.setSelectedModel(model.id);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel={`Select model: ${model.name}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <YStack flex={1}>
                        <Text color="$color" fontSize={FontSize.body}>{model.name}</Text>
                        <XStack alignItems="center" gap={6} marginTop={2}>
                          {model.contextWindow != null && (
                            <Text color="$textTertiary" fontSize={FontSize.caption}>
                              {Math.round(model.contextWindow / 1000)}K
                            </Text>
                          )}
                          {model.supportsReasoning && (
                            <Brain size={12} color={colors.primary} />
                          )}
                          {model.supportsVision && (
                            <Eye size={12} color={colors.primary} />
                          )}
                        </XStack>
                      </YStack>
                      <YStack
                        width={22}
                        height={22}
                        borderRadius={11}
                        borderWidth={2}
                        borderColor={isSelected ? '$primary' : colors.systemGray3}
                        backgroundColor={isSelected ? '$primary' : undefined}
                        alignItems="center"
                        justifyContent="center"
                        marginLeft={Spacing.md}
                      >
                        {isSelected && (
                          <YStack width={10} height={10} borderRadius={5} backgroundColor="$contrastText" />
                        )}
                      </YStack>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </YStack>

            {/* Reasoning Controls — shown when selected model supports reasoning */}
            {w.selectedModelInfo?.supportsReasoning && (
              <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
                <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                  Reasoning
                </Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: Spacing.md,
                    minHeight: 44,
                  }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    w.setReasoningEnabled(!w.reasoningEnabled);
                  }}
                  activeOpacity={0.7}
                >
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400">
                    Enable Reasoning
                  </Text>
                  <YStack
                    width={48}
                    height={28}
                    borderRadius={14}
                    padding={2}
                    justifyContent="center"
                    backgroundColor={w.reasoningEnabled ? '$primary' : colors.systemGray4}
                  >
                    <YStack
                      width={24}
                      height={24}
                      borderRadius={12}
                      backgroundColor="$contrastText"
                      alignSelf={w.reasoningEnabled ? 'flex-end' : undefined}
                    />
                  </YStack>
                </TouchableOpacity>
                {w.reasoningEnabled && (
                  <>
                    <Separator borderColor="$separator" />
                    <Text color="$textTertiary" fontSize={FontSize.caption} paddingBottom={Spacing.sm} paddingTop={Spacing.xs}>
                      Effort: {w.reasoningEffort}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.sm }}
                    >
                      {(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as ReasoningEffort[]).map(level => {
                        const isSelected = w.reasoningEffort === level;
                        return (
                          <TouchableOpacity
                            key={level}
                            style={[
                              {
                                paddingHorizontal: Spacing.md,
                                paddingVertical: 8,
                                borderRadius: Radius.md,
                                borderWidth: 1,
                                borderColor: colors.separator,
                                marginRight: Spacing.sm,
                              },
                              isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              w.setReasoningEffort(level);
                            }}
                          >
                            <Text
                              fontSize={FontSize.footnote}
                              fontWeight="600"
                              color={isSelected ? '$contrastText' : '$color'}
                            >
                              {level}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
              </YStack>
            )}

            {/* Name */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Name</Text>
                <TextInput
                  style={inputStyle}
                  value={w.name}
                  onChangeText={w.setName}
                  placeholder={w.autoName}
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                />
              </XStack>
            </YStack>

            {/* System Prompt */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                System Prompt (optional)
              </Text>
              <TextInput
                style={{ fontSize: FontSize.body, color: colors.text, paddingVertical: Spacing.sm, paddingBottom: Spacing.md, minHeight: 80 }}
                value={w.systemPrompt}
                onChangeText={w.setSystemPrompt}
                placeholder="You are a helpful assistant..."
                placeholderTextColor={colors.systemGray2}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </YStack>

            {/* Temperature */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <Text color="$textTertiary" fontSize={FontSize.caption} fontWeight="600" textTransform="uppercase" letterSpacing={0.5} paddingTop={Spacing.md} paddingBottom={Spacing.sm}>
                Temperature: {w.temperature !== undefined ? w.temperature.toFixed(1) : 'Default'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.sm }}
              >
                {[undefined, 0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0].map((t, idx) => {
                  const isSelected = w.temperature === t;
                  const label = t === undefined ? 'Auto' : t.toFixed(1);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        {
                          paddingHorizontal: Spacing.md,
                          paddingVertical: 8,
                          borderRadius: Radius.md,
                          borderWidth: 1,
                          borderColor: colors.separator,
                          marginRight: Spacing.sm,
                        },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        w.setTemperature(t);
                      }}
                    >
                      <Text
                        fontSize={FontSize.footnote}
                        fontWeight="600"
                        color={isSelected ? '$contrastText' : '$color'}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </YStack>

            {/* Base URL — shown for Custom or on demand */}
            {(w.providerInfo.requiresBaseUrl || w.showBaseUrl) && (
              <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Base URL</Text>
                  <TextInput
                    style={inputStyle}
                    value={w.baseUrl}
                    onChangeText={w.setBaseUrl}
                    placeholder={w.providerInfo.defaultBaseUrl ?? 'https://api.example.com/v1'}
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </XStack>
              </YStack>
            )}

            {/* Toggle Base URL override for non-Custom providers */}
            {!w.providerInfo.requiresBaseUrl && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.cardBackground,
                  borderRadius: Radius.md,
                  paddingHorizontal: Spacing.lg,
                  overflow: 'hidden',
                }}
                onPress={() => w.setShowBaseUrl(!w.showBaseUrl)}
                activeOpacity={0.7}
              >
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Override Base URL</Text>
                  <Text color="$textTertiary" fontSize={14}>
                    {w.showBaseUrl ? '▾' : '▸'}
                  </Text>
                </XStack>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Connection section — ACP / Codex */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Name</Text>
                <TextInput
                  style={inputStyle}
                  value={w.name}
                  onChangeText={w.setName}
                  placeholder="My Agent"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                />
              </XStack>
              <Separator borderColor="$separator" />
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Scheme</Text>
                <XStack backgroundColor={colors.systemGray5} borderRadius={6} padding={2}>
                  {(['ws', 'wss'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 5 },
                        w.scheme === s && {
                          backgroundColor: colors.cardBackground,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2,
                        },
                      ]}
                      onPress={() => w.setScheme(s)}
                    >
                      <Text
                        fontSize={FontSize.footnote}
                        fontWeight={w.scheme === s ? '600' : '500'}
                        color={w.scheme === s ? '$color' : '$textTertiary'}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </XStack>
              </XStack>
              <Separator borderColor="$separator" />
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Host</Text>
                <TextInput
                  style={inputStyle}
                  value={w.host}
                  onChangeText={w.setHost}
                  placeholder="localhost:8765"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </XStack>
            </YStack>

            {/* Optional section */}
            <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Token</Text>
                <TextInput
                  style={inputStyle}
                  value={w.token}
                  onChangeText={w.setToken}
                  placeholder="Bearer w.token"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </XStack>
              <Separator borderColor="$separator" />
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Directory</Text>
                <TextInput
                  style={inputStyle}
                  value={w.workingDirectory}
                  onChangeText={w.setWorkingDirectory}
                  placeholder="/path/to/workspace"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </XStack>
            </YStack>

            {/* Advanced: Cloudflare Access */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.cardBackground,
                borderRadius: Radius.md,
                paddingHorizontal: Spacing.lg,
                overflow: 'hidden',
              }}
              onPress={() => w.setShowAdvanced(!w.showAdvanced)}
              activeOpacity={0.7}
            >
              <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Cloudflare Access</Text>
                <Text color="$textTertiary" fontSize={14}>
                  {w.showAdvanced ? '▾' : '▸'}
                </Text>
              </XStack>
            </TouchableOpacity>

            {w.showAdvanced && (
              <YStack backgroundColor="$cardBackground" borderRadius={Radius.md} paddingHorizontal={Spacing.lg} overflow="hidden">
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Client ID</Text>
                  <TextInput
                    style={inputStyle}
                    value={w.cfAccessClientId}
                    onChangeText={w.setCfAccessClientId}
                    placeholder="Client ID"
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </XStack>
                <Separator borderColor="$separator" />
                <XStack alignItems="center" justifyContent="space-between" paddingVertical={Spacing.md} minHeight={44}>
                  <Text color="$color" fontSize={FontSize.body} fontWeight="400" width={90}>Secret</Text>
                  <TextInput
                    style={inputStyle}
                    value={w.cfAccessClientSecret}
                    onChangeText={w.setCfAccessClientSecret}
                    placeholder="Client Secret"
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                </XStack>
              </YStack>
            )}
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: Radius.md,
            paddingVertical: Spacing.md + 2,
            alignItems: 'center',
            marginTop: Spacing.sm,
          }}
          onPress={w.handleSave}
          accessibilityLabel={w.isEditing ? 'Update server' : 'Save new server'}
        >
          <Text color="$contrastText" fontSize={FontSize.body} fontWeight="600">
            {w.isEditing ? 'Update Server' : 'Add Server'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});
