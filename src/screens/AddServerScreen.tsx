/**
 * Add/Edit Server screen — themed.
 */

import React, { useState, useCallback } from 'react';
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

  const [name, setName] = useState(editingServer?.name ?? '');
  const [scheme, setScheme] = useState(editingServer?.scheme ?? 'ws');
  const [host, setHost] = useState(editingServer?.host ?? '');
  const [token, setToken] = useState(editingServer?.token ?? '');
  const [workingDirectory, setWorkingDirectory] = useState(
    editingServer?.workingDirectory ?? '',
  );
  const [serverType, setServerType] = useState<ServerType>(
    editingServer?.serverType ?? ServerType.ACP,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfAccessClientId, setCfAccessClientId] = useState(
    editingServer?.cfAccessClientId ?? '',
  );
  const [cfAccessClientSecret, setCfAccessClientSecret] = useState(
    editingServer?.cfAccessClientSecret ?? '',
  );

  const isEditing = !!editingServer;

  const handleSave = useCallback(async () => {
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
    isEditing,
    editingServer,
    addServer,
    updateServer,
    navigation,
  ]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.cardBackground,
      color: colors.text,
      borderColor: colors.separator,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Server Type Picker */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>Protocol</Text>
          <View style={[styles.segmentedControl, { backgroundColor: colors.systemGray5 }]}>
            <TouchableOpacity
              style={[
                styles.segment,
                serverType === ServerType.ACP && [styles.segmentSelected, { backgroundColor: colors.cardBackground }],
              ]}
              onPress={() => setServerType(ServerType.ACP)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  serverType === ServerType.ACP && { color: colors.primary, fontWeight: '600' },
                ]}
              >
                ACP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                serverType === ServerType.Codex && [styles.segmentSelected, { backgroundColor: colors.cardBackground }],
              ]}
              onPress={() => setServerType(ServerType.Codex)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  serverType === ServerType.Codex && { color: colors.primary, fontWeight: '600' },
                ]}
              >
                Codex
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>Name</Text>
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="My Agent"
            placeholderTextColor={colors.systemGray2}
            autoCapitalize="none"
          />
        </View>

        {/* Scheme */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>Scheme</Text>
          <View style={[styles.segmentedControl, { backgroundColor: colors.systemGray5 }]}>
            {['ws', 'wss'].map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.segment,
                  scheme === s && [styles.segmentSelected, { backgroundColor: colors.cardBackground }],
                ]}
                onPress={() => setScheme(s)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: colors.textSecondary },
                    scheme === s && { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Host */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>Host</Text>
          <TextInput
            style={inputStyle}
            value={host}
            onChangeText={setHost}
            placeholder="localhost:8765"
            placeholderTextColor={colors.systemGray2}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        {/* Token */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>Bearer Token (optional)</Text>
          <TextInput
            style={inputStyle}
            value={token}
            onChangeText={setToken}
            placeholder="Enter token"
            placeholderTextColor={colors.systemGray2}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        {/* Working Directory */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>Working Directory (optional)</Text>
          <TextInput
            style={inputStyle}
            value={workingDirectory}
            onChangeText={setWorkingDirectory}
            placeholder="/path/to/workspace"
            placeholderTextColor={colors.systemGray2}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Advanced: Cloudflare Access */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={[styles.advancedToggleText, { color: colors.textTertiary }]}>
            {showAdvanced ? '▼' : '▶'} Cloudflare Access
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>CF-Access-Client-Id</Text>
              <TextInput
                style={inputStyle}
                value={cfAccessClientId}
                onChangeText={setCfAccessClientId}
                placeholder="Client ID"
                placeholderTextColor={colors.systemGray2}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>CF-Access-Client-Secret</Text>
              <TextInput
                style={inputStyle}
                value={cfAccessClientSecret}
                onChangeText={setCfAccessClientSecret}
                placeholder="Client Secret"
                placeholderTextColor={colors.systemGray2}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>
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
  fieldGroup: {
    gap: Spacing.xs + 2,
  },
  label: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
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
  advancedToggle: {
    paddingVertical: Spacing.sm,
  },
  advancedToggleText: {
    fontSize: FontSize.footnote,
    fontWeight: '500',
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
});
