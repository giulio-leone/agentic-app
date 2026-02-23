/**
 * DirectoryPicker — full-screen modal for browsing the bridge filesystem.
 * Uses FlatList with plain RN Views (no Tamagui) to avoid Fabric crash.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
  Text as RNText,
} from 'react-native';
import { ChevronLeft, Folder, FileText, Check } from 'lucide-react-native';
import { Spacing, Radius, type ThemeColors } from '../../utils/theme';

interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  listDirectory: (path?: string) => Promise<{ path: string; entries: DirEntry[] } | null>;
  colors: ThemeColors;
}

export const DirectoryPicker = React.memo(function DirectoryPicker({
  visible,
  onClose,
  selectedPath,
  onSelect,
  listDirectory,
  colors,
}: Props) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  // Delay content render for Fabric stability
  useEffect(() => {
    if (visible) {
      const timer = requestAnimationFrame(() => setContentReady(true));
      return () => cancelAnimationFrame(timer);
    }
    setContentReady(false);
    return undefined;
  }, [visible]);

  const loadDir = useCallback(async (path?: string) => {
    setLoading(true);
    const result = await listDirectory(path);
    if (result) {
      setCurrentPath(result.path);
      setEntries(result.entries);
    }
    setLoading(false);
  }, [listDirectory]);

  // Load initial directory
  useEffect(() => {
    if (visible && contentReady) {
      loadDir(selectedPath ?? undefined);
    }
  }, [visible, contentReady, loadDir, selectedPath]);

  const pathParts = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((name, i) => ({
      name,
      path: '/' + parts.slice(0, i + 1).join('/'),
    }));
  }, [currentPath]);

  const navigateUp = useCallback(() => {
    if (!currentPath || currentPath === '/') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDir(parent);
  }, [currentPath, loadDir]);

  const selectCurrent = useCallback(() => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  }, [currentPath, onSelect, onClose]);

  const renderItem = useCallback(({ item }: { item: DirEntry }) => {
    const isSelected = item.path === selectedPath;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.separator }]}
        onPress={() => item.isDirectory ? loadDir(item.path) : undefined}
        activeOpacity={item.isDirectory ? 0.6 : 1}
        disabled={!item.isDirectory}
      >
        <View style={[styles.icon, { backgroundColor: item.isDirectory ? `${colors.primary}15` : `${colors.textTertiary}10` }]}>
          {item.isDirectory
            ? <Folder size={18} color={colors.primary} />
            : <FileText size={18} color={colors.textTertiary} />}
        </View>
        <View style={styles.nameContainer}>
          <RNText style={[styles.name, { color: item.isDirectory ? colors.text : colors.textTertiary }]} numberOfLines={1}>
            {item.name}
          </RNText>
        </View>
        {isSelected && <Check size={18} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [colors, selectedPath, loadDir]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <RNText style={[styles.title, { color: colors.text }]}>Select Directory</RNText>
          </View>
          <TouchableOpacity onPress={selectCurrent} style={[styles.selectButton, { backgroundColor: colors.primary }]}>
            <RNText style={styles.selectText}>Select</RNText>
          </TouchableOpacity>
        </View>

        {/* Breadcrumb */}
        <View style={[styles.breadcrumb, { backgroundColor: colors.inputBackground, borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={navigateUp} style={styles.upButton} disabled={currentPath === '/'}>
            <RNText style={[styles.breadcrumbText, { color: colors.primary }]}>↑ Up</RNText>
          </TouchableOpacity>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={pathParts}
            keyExtractor={item => item.path}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => loadDir(item.path)} style={styles.crumb}>
                <RNText style={[styles.breadcrumbText, { color: index === pathParts.length - 1 ? colors.text : colors.primary }]}>
                  {index === 0 ? '/' : ''}{item.name}{index < pathParts.length - 1 ? ' /' : ''}
                </RNText>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.breadcrumbContent}
          />
        </View>

        {/* Content */}
        {!contentReady || loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={item => item.path}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <RNText style={[styles.emptyText, { color: colors.textTertiary }]}>Empty directory</RNText>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  selectText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  upButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  breadcrumbContent: {
    alignItems: 'center',
  },
  crumb: {
    paddingHorizontal: 2,
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: 16,
  },
});
