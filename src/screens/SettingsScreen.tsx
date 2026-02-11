/**
 * Settings screen – dev mode, logs viewer, about.
 */

import React from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../stores/appStore';
import { Colors, FontSize, Spacing } from '../utils/theme';
import { APP_DISPLAY_NAME, APP_VERSION } from '../constants/app';

export function SettingsScreen() {
  const { devModeEnabled, toggleDevMode, developerLogs, clearLogs } =
    useAppStore();

  return (
    <ScrollView style={styles.container}>
      {/* Dev Mode */}
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Developer Mode</Text>
            <Text style={styles.settingSubtitle}>
              Show raw JSON-RPC messages in logs
            </Text>
          </View>
          <Switch
            value={devModeEnabled}
            onValueChange={toggleDevMode}
            trackColor={{ true: Colors.primary }}
          />
        </View>
      </View>

      {/* Developer Logs */}
      {devModeEnabled && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Developer Logs</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logsContainer}>
            {developerLogs.length === 0 ? (
              <Text style={styles.emptyLogs}>No logs yet</Text>
            ) : (
              developerLogs
                .slice()
                .reverse()
                .map((log, index) => (
                  <Text key={index} style={styles.logEntry} selectable>
                    {log}
                  </Text>
                ))
            )}
          </View>
        </View>
      )}

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>App</Text>
          <Text style={styles.aboutValue}>{APP_DISPLAY_NAME} v{APP_VERSION}</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Platform</Text>
          <Text style={styles.aboutValue}>React Native</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.systemGray6,
  },
  section: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
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
    color: Colors.text,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: FontSize.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  clearButton: {
    fontSize: FontSize.footnote,
    color: Colors.primary,
    fontWeight: '600',
  },
  logsContainer: {
    maxHeight: 300,
    backgroundColor: Colors.systemGray6,
    borderRadius: 8,
    padding: Spacing.sm,
  },
  emptyLogs: {
    fontSize: FontSize.footnote,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  logEntry: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.textSecondary,
    paddingVertical: 1,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aboutLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  aboutValue: {
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
});
