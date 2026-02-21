/**
 * CanvasPanel — Full-screen artifact viewer with type-specific renderers.
 * Presented as a modal bottom sheet over the chat.
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Copy, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import type { Artifact } from '../../acp/models/types';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface Props {
  visible: boolean;
  artifact: Artifact | null;
  onClose: () => void;
}

export function CanvasPanel({ visible, artifact, onClose }: Props) {
  const { colors } = useDesignSystem();
  const { height } = useWindowDimensions();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!artifact) return;
    await Clipboard.setStringAsync(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact]);

  if (!artifact) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              maxHeight: height * 0.85,
            },
          ]}
          onPress={() => {/* prevent close */}}
        >
          {/* Header */}
          <XStack
            paddingHorizontal={Spacing.lg}
            paddingVertical={Spacing.md}
            alignItems="center"
            justifyContent="space-between"
            borderBottomWidth={StyleSheet.hairlineWidth}
            borderBottomColor={colors.separator}
          >
            <YStack flex={1}>
              <Text fontSize={FontSize.subheadline} fontWeight="600" color={colors.text} numberOfLines={1}>
                {artifact.title}
              </Text>
              {artifact.language && (
                <Text fontSize={FontSize.caption} color={colors.textTertiary} textTransform="uppercase" marginTop={2}>
                  {artifact.language}
                </Text>
              )}
            </YStack>
            <XStack gap={Spacing.sm}>
              <TouchableOpacity onPress={handleCopy} style={styles.headerBtn}>
                <XStack alignItems="center" gap={4}>
                  {copied ? <Text fontSize={14} color={colors.primary}>✓ Copied</Text> : <><Copy size={14} color={colors.primary} /><Text fontSize={14} color={colors.primary}> Copy</Text></>}
                </XStack>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </XStack>
          </XStack>

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.md }}
            showsVerticalScrollIndicator
          >
            {artifact.type === 'csv' ? (
              <CsvTable content={artifact.content} colors={colors} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <Text
                  fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
                  fontSize={FontSize.caption}
                  lineHeight={20}
                  color={colors.codeText}
                  selectable
                >
                  {artifact.content}
                </Text>
              </ScrollView>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Simple CSV table renderer ────────────────────────────────────────────────

function CsvTable({ content, colors }: { content: string; colors: ReturnType<typeof useDesignSystem>['colors'] }) {
  const rows = content.trim().split('\n').map(line => parseCsvLine(line));
  if (rows.length === 0) return null;

  const header = rows[0]!;
  const body = rows.slice(1);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <YStack>
        {/* Header row */}
        <XStack borderBottomWidth={2} borderBottomColor={colors.separator}>
          {header.map((cell, i) => (
            <YStack key={i} width={120} paddingHorizontal={Spacing.sm} paddingVertical={Spacing.xs}>
              <Text fontSize={FontSize.caption} fontWeight="700" color={colors.text} numberOfLines={1}>
                {cell}
              </Text>
            </YStack>
          ))}
        </XStack>
        {/* Body rows */}
        {body.map((row, ri) => (
          <XStack
            key={ri}
            borderBottomWidth={StyleSheet.hairlineWidth}
            borderBottomColor={colors.separator}
            backgroundColor={ri % 2 === 0 ? 'transparent' : colors.codeBackground}
          >
            {row.map((cell, ci) => (
              <YStack key={ci} width={120} paddingHorizontal={Spacing.sm} paddingVertical={Spacing.xs}>
                <Text fontSize={FontSize.caption} color={colors.text} numberOfLines={2}>
                  {cell}
                </Text>
              </YStack>
            ))}
          </XStack>
        ))}
      </YStack>
    </ScrollView>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    flex: 1,
    marginTop: 60,
  },
  headerBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
