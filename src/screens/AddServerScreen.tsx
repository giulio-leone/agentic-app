/**
 * Add/Edit Server screen — iOS Settings-style grouped fields.
 * Supports ACP, Codex, and AI Provider server types.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../stores/appStore';
import { ServerType } from '../acp/models/types';
import { AIProviderType, AIProviderConfig } from '../ai/types';
import { ALL_PROVIDERS, getProviderInfo } from '../ai/providers';
import { saveApiKey } from '../storage/SecureStorage';
import { useTheme, FontSize, Spacing, Radius } from '../utils/theme';
import type { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddServer'>;

export function AddServerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddServer'>>();
  const editingServer = route.params?.editingServer;
  const { addServer, updateServer } = useAppStore();

  // Shared state
  const [name, setName] = useState(editingServer?.name ?? '');
  const [serverType, setServerType] = useState<ServerType>(
    editingServer?.serverType ?? ServerType.ACP,
  );

  // ACP / Codex fields
  const [scheme, setScheme] = useState(editingServer?.scheme ?? 'ws');
  const [host, setHost] = useState(editingServer?.host ?? '');
  const [token, setToken] = useState(editingServer?.token ?? '');
  const [workingDirectory, setWorkingDirectory] = useState(
    editingServer?.workingDirectory ?? '',
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfAccessClientId, setCfAccessClientId] = useState(
    editingServer?.cfAccessClientId ?? '',
  );
  const [cfAccessClientSecret, setCfAccessClientSecret] = useState(
    editingServer?.cfAccessClientSecret ?? '',
  );

  // AI Provider fields
  const editingAI = editingServer?.aiProviderConfig;
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>(
    editingAI?.providerType ?? AIProviderType.OpenAI,
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    editingAI?.modelId ?? '',
  );
  const [systemPrompt, setSystemPrompt] = useState(
    editingAI?.systemPrompt ?? '',
  );
  const [baseUrl, setBaseUrl] = useState(editingAI?.baseUrl ?? '');
  const [showBaseUrl, setShowBaseUrl] = useState(
    !!editingAI?.baseUrl || false,
  );

  const isEditing = !!editingServer;

  const providerInfo = useMemo(
    () => getProviderInfo(selectedProvider),
    [selectedProvider],
  );

  // Auto-select first model when provider changes
  const handleProviderChange = useCallback(
    (type: AIProviderType) => {
      Haptics.selectionAsync();
      setSelectedProvider(type);
      const info = getProviderInfo(type);
      setSelectedModel(info.models[0]?.id ?? '');
      setBaseUrl(info.defaultBaseUrl ?? '');
      setShowBaseUrl(info.requiresBaseUrl);
    },
    [],
  );

  // Auto-fill name from provider + model
  const autoName = useMemo(() => {
    const model = providerInfo.models.find(m => m.id === selectedModel);
    return model ? `${providerInfo.name} ${model.name}` : providerInfo.name;
  }, [providerInfo, selectedModel]);

  // ── Save logic ──

  const handleSave = useCallback(async () => {
    // AI Provider path
    if (serverType === ServerType.AIProvider) {
      if (!apiKey.trim() && !isEditing) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Missing Field', 'Please enter your API key.');
        return;
      }
      if (!selectedModel) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Missing Field', 'Please select a model.');
        return;
      }

      const serverData = {
        name: name.trim() || autoName,
        scheme: '',
        host: '',
        token: '',
        cfAccessClientId: '',
        cfAccessClientSecret: '',
        workingDirectory: '',
        serverType: ServerType.AIProvider,
        aiProviderConfig: {
          providerType: selectedProvider,
          modelId: selectedModel,
          baseUrl: baseUrl.trim() || undefined,
          systemPrompt: systemPrompt.trim() || undefined,
          temperature: undefined,
        } as AIProviderConfig,
      };

      try {
        if (isEditing && editingServer) {
          await updateServer({ ...serverData, id: editingServer.id });
          if (apiKey.trim()) {
            await saveApiKey(`${editingServer.id}_${selectedProvider}`, apiKey.trim());
          }
        } else {
          const serverId = await addServer(serverData);
          if (apiKey.trim()) {
            await saveApiKey(`${serverId}_${selectedProvider}`, apiKey.trim());
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', `Failed to save server: ${(error as Error).message}`);
      }
      return;
    }

    // ACP / Codex path
    const hostValue = host.trim();
    if (!hostValue) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing Field', 'Please enter a host address (e.g. localhost:8765)');
      return;
    }

    const serverData = {
      name: name.trim() || hostValue,
      scheme,
      host: hostValue,
      token: token.trim(),
      cfAccessClientId: cfAccessClientId.trim(),
      cfAccessClientSecret: cfAccessClientSecret.trim(),
      workingDirectory: workingDirectory.trim(),
      serverType,
    };

    try {
      if (isEditing && editingServer) {
        await updateServer({ ...serverData, id: editingServer.id });
      } else {
        await addServer(serverData);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to save server: ${(error as Error).message}`);
    }
  }, [
    name,
    scheme,
    host,
    token,
    cfAccessClientId,
    cfAccessClientSecret,
    workingDirectory,
    serverType,
    selectedProvider,
    selectedModel,
    apiKey,
    baseUrl,
    systemPrompt,
    autoName,
    isEditing,
    editingServer,
    addServer,
    updateServer,
    navigation,
  ]);

  // ── Render ──

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.systemGray6 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Protocol section — 3-segment */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>Protocol</Text>
          <View style={[styles.segmentedControl, { backgroundColor: colors.systemGray5 }]}>
            {([ServerType.ACP, ServerType.Codex, ServerType.AIProvider] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.segment,
                  serverType === type && [styles.segmentSelected, { backgroundColor: colors.cardBackground }],
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setServerType(type);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: colors.textTertiary },
                    serverType === type && { color: colors.text, fontWeight: '600' },
                  ]}
                >
                  {type === ServerType.AIProvider ? 'AI Provider' : type === ServerType.Codex ? 'Codex' : 'ACP'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {serverType === ServerType.AIProvider ? (
          <>
            {/* Provider Picker — horizontal scroll chips */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>Provider</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipContainer}
              >
                {ALL_PROVIDERS.map(p => {
                  const isSelected = p.type === selectedProvider;
                  return (
                    <TouchableOpacity
                      key={p.type}
                      style={[
                        styles.chip,
                        { borderColor: colors.separator },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => handleProviderChange(p.type)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipIcon}>{p.icon}</Text>
                      <Text
                        style={[
                          styles.chipLabel,
                          { color: colors.text },
                          isSelected && { color: '#FFFFFF' },
                        ]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* API Key */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>API Key</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={isEditing ? '••••••••' : 'sk-...'}
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>
              <Text style={[styles.secureNote, { color: colors.textTertiary }]}>
                🔒 Stored securely on device
              </Text>
            </View>

            {/* Model Picker */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>Model</Text>
              {providerInfo.models.map((model, idx) => {
                const isSelected = model.id === selectedModel;
                return (
                  <React.Fragment key={model.id}>
                    {idx > 0 && (
                      <View style={[styles.fieldSeparator, { backgroundColor: colors.separator }]} />
                    )}
                    <TouchableOpacity
                      style={styles.modelRow}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedModel(model.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modelInfo}>
                        <Text style={[styles.modelName, { color: colors.text }]}>{model.name}</Text>
                        {model.contextWindow && (
                          <Text style={[styles.modelMeta, { color: colors.textTertiary }]}>
                            {Math.round(model.contextWindow / 1000)}K context
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.radio,
                          { borderColor: isSelected ? colors.primary : colors.systemGray3 },
                          isSelected && { backgroundColor: colors.primary },
                        ]}
                      >
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Name */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={autoName}
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* System Prompt */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>System Prompt (optional)</Text>
              <TextInput
                style={[styles.multilineInput, { color: colors.text }]}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="You are a helpful assistant..."
                placeholderTextColor={colors.systemGray2}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Base URL — shown for Custom or on demand */}
            {(providerInfo.requiresBaseUrl || showBaseUrl) && (
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Base URL</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: colors.text }]}
                    value={baseUrl}
                    onChangeText={setBaseUrl}
                    placeholder={providerInfo.defaultBaseUrl ?? 'https://api.example.com/v1'}
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              </View>
            )}

            {/* Toggle Base URL override for non-Custom providers */}
            {!providerInfo.requiresBaseUrl && (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.cardBackground }]}
                onPress={() => setShowBaseUrl(!showBaseUrl)}
                activeOpacity={0.7}
              >
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Override Base URL</Text>
                  <Text style={[styles.chevronText, { color: colors.textTertiary }]}>
                    {showBaseUrl ? '▾' : '▸'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {/* Connection section — ACP / Codex */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Name</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="My Agent"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.fieldSeparator, { backgroundColor: colors.separator }]} />
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Scheme</Text>
                <View style={[styles.segmentedControlSmall, { backgroundColor: colors.systemGray5 }]}>
                  {(['ws', 'wss'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.segmentSmall,
                        scheme === s && [styles.segmentSelected, { backgroundColor: colors.cardBackground }],
                      ]}
                      onPress={() => setScheme(s)}
                    >
                      <Text
                        style={[
                          styles.segmentTextSmall,
                          { color: colors.textTertiary },
                          scheme === s && { color: colors.text, fontWeight: '600' },
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.fieldSeparator, { backgroundColor: colors.separator }]} />
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Host</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={host}
                  onChangeText={setHost}
                  placeholder="localhost:8765"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </View>

            {/* Optional section */}
            <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Token</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={token}
                  onChangeText={setToken}
                  placeholder="Bearer token"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>
              <View style={[styles.fieldSeparator, { backgroundColor: colors.separator }]} />
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Directory</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text }]}
                  value={workingDirectory}
                  onChangeText={setWorkingDirectory}
                  placeholder="/path/to/workspace"
                  placeholderTextColor={colors.systemGray2}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Advanced: Cloudflare Access */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardBackground }]}
              onPress={() => setShowAdvanced(!showAdvanced)}
              activeOpacity={0.7}
            >
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Cloudflare Access</Text>
                <Text style={[styles.chevronText, { color: colors.textTertiary }]}>
                  {showAdvanced ? '▾' : '▸'}
                </Text>
              </View>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Client ID</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: colors.text }]}
                    value={cfAccessClientId}
                    onChangeText={setCfAccessClientId}
                    placeholder="Client ID"
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={[styles.fieldSeparator, { backgroundColor: colors.separator }]} />
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Secret</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: colors.text }]}
                    value={cfAccessClientSecret}
                    onChangeText={setCfAccessClientSecret}
                    placeholder="Client Secret"
                    placeholderTextColor={colors.systemGray2}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                </View>
              </View>
            )}
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Update Server' : 'Add Server'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  cardLabel: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  fieldLabel: {
    fontSize: FontSize.body,
    fontWeight: '400',
    width: 90,
  },
  fieldInput: {
    flex: 1,
    fontSize: FontSize.body,
    textAlign: 'right',
    paddingVertical: 0,
  },
  fieldSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 0,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
    marginBottom: Spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  segmentedControlSmall: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
  },
  segmentSmall: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 5,
  },
  segmentTextSmall: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  chevronText: {
    fontSize: 14,
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: '600',
  },

  // ── AI Provider styles ──
  chipContainer: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 4,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
  },
  secureNote: {
    fontSize: FontSize.caption,
    paddingBottom: Spacing.md,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    minHeight: 44,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: FontSize.body,
  },
  modelMeta: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    fontSize: FontSize.body,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
    minHeight: 80,
  },
});
