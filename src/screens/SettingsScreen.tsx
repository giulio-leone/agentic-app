/**
 * Settings screen — themed.
 */

import React from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../stores/appStore';
import { useTheme, FontSize, Spacing, Radius } from '../utils/theme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/app';

export function SettingsScreen() {
  const { colors } = useTheme();
  const { devModeEnabled, toggleDevMode, developerLogs, clearLogs } =
    useAppStore();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Dev Mode */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Developer Mode</Text>
            <Text style={[styles.settingSubtitle, { color: colors.textTertiary }]}>
              Show raw JSON-RPC messages in logs
            </Text>
          </View>
          <Switch
            value={devModeEnabled}
            onValueChange={toggleDevMode}
            trackColor={{ true: colors.primary, false: colors.systemGray4 }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Developer Logs */}
      {devModeEnabled && (
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Developer Logs</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={[styles.clearButton, { color: colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.logsContainer, { backgroundColor: colors.codeBackground }]}>
            {developerLogs.length === 0 ? (
              <Text style={[styles.emptyLogs, { color: colors.textTertiary }]}>No logs yet</Text>
            ) : (
              developerLogs
                .slice()
                .reverse()
                .map((log, index) => (
                  <Text key={index} style={[styles.logEntry, { color: colors.codeText }]} selectable>
                    {log}
                  </Text>
                ))
            )}
          </View>
        </View>
      )}

      {/* About */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>App</Text>
          <Text style={[styles.aboutValue, { color: colors.text }]}>{APP_DISPLAY_NAME} v{APP_VERSION}</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Platform</Text>
          <Text style={[styles.aboutValue, { color: colors.text }]}>React Native (Expo)</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.headline,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: FontSize.body,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: FontSize.caption,
    marginTop: 2,
  },
  clearButton: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
  },
  logsContainer: {
    maxHeight: 300,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  emptyLogs: {
    fontSize: FontSize.footnote,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  logEntry: {
    fontSize: 11,
    fontFamily: 'monospace',
    paddingVertical: 1,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aboutLabel: {
    fontSize: FontSize.body,
  },
  aboutValue: {
    fontSize: FontSize.body,
    fontWeight: '500',
  },
});
