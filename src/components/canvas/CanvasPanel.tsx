/**
 * CanvasPanel — Full-screen artifact viewer with type-specific renderers.
 * Supports: HTML live preview, SVG, Mermaid diagrams, code editing,
 * CSV tables, Markdown, and images.
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
  Share,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Copy, X, Check, Share2, Edit3, Eye, Code, Globe, Palette, BarChart3, Table, FileText, Image as ImageIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import type { Artifact, ArtifactType } from '../../acp/models/types';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { HtmlRenderer } from './HtmlRenderer';
import { SvgRenderer } from './SvgRenderer';
import { MermaidRenderer } from './MermaidRenderer';
import { CodeEditor } from './CodeEditor';
import { ImageRenderer } from './ImageRenderer';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  visible: boolean;
  artifact: Artifact | null;
  onClose: () => void;
  onUpdateContent?: (artifactId: string, content: string) => void;
}

type ViewMode = 'preview' | 'source';

const TYPE_LABELS: Record<ArtifactType, string> = {
  code: 'Code',
  html: 'HTML Preview',
  svg: 'SVG',
  mermaid: 'Diagram',
  csv: 'Table',
  markdown: 'Document',
  image: 'Image',
};

export function CanvasPanel({ visible, artifact, onClose, onUpdateContent }: Props) {
  const { colors } = useDesignSystem();
  const { height } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');

  const handleCopy = useCallback(async () => {
    if (!artifact) return;
    await Clipboard.setStringAsync(artifact.content);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact]);

  const handleShare = useCallback(async () => {
    if (!artifact) return;
    await Share.share({ message: artifact.content, title: artifact.title });
  }, [artifact]);

  const toggleViewMode = useCallback(() => {
    setViewMode(m => m === 'preview' ? 'source' : 'preview');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleContentChange = useCallback((content: string) => {
    if (artifact && onUpdateContent) {
      onUpdateContent(artifact.id, content);
    }
  }, [artifact, onUpdateContent]);

  if (!artifact) return null;

  const hasPreview = ['html', 'svg', 'mermaid', 'image', 'markdown'].includes(artifact.type);
  const showingPreview = viewMode === 'preview' && hasPreview;

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
              maxHeight: height * 0.9,
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
              <Text fontSize={11} color={colors.textTertiary} marginTop={2}>
                {TYPE_LABELS[artifact.type] ?? artifact.type}
                {artifact.language ? ` · ${artifact.language}` : ''}
              </Text>
            </YStack>
            <XStack gap={Spacing.xs} alignItems="center">
              {/* View mode toggle (only for types with preview) */}
              {hasPreview && (
                <TouchableOpacity
                  onPress={toggleViewMode}
                  style={[styles.headerBtn, showingPreview && { backgroundColor: colors.primary + '20' }]}
                >
                  {showingPreview ? (
                    <Code size={15} color={colors.primary} />
                  ) : (
                    <Eye size={15} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                <Share2 size={15} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCopy} style={styles.headerBtn}>
                {copied ? <Check size={15} color={colors.primary} /> : <Copy size={15} color={colors.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </XStack>
          </XStack>

          {/* Content area */}
          <YStack flex={1}>
            {showingPreview ? (
              <PreviewRenderer artifact={artifact} colors={colors} />
            ) : artifact.type === 'code' ? (
              <CodeEditor
                content={artifact.content}
                language={artifact.language}
                colors={colors}
                onContentChange={onUpdateContent ? handleContentChange : undefined}
              />
            ) : artifact.type === 'csv' ? (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
                <CsvTable content={artifact.content} colors={colors} />
              </ScrollView>
            ) : (
              /* Source view for html/svg/mermaid/markdown */
              <CodeEditor
                content={artifact.content}
                language={artifact.language ?? artifact.type}
                colors={colors}
                onContentChange={onUpdateContent ? handleContentChange : undefined}
              />
            )}
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Preview router ─────────────────────────────────────────────────────────────

function PreviewRenderer({ artifact, colors }: { artifact: Artifact; colors: ReturnType<typeof useDesignSystem>['colors'] }) {
  const bg = colors.surface;

  switch (artifact.type) {
    case 'html':
      return <HtmlRenderer content={artifact.content} backgroundColor={bg} />;
    case 'svg':
      return <SvgRenderer content={artifact.content} backgroundColor={bg} />;
    case 'mermaid':
      return <MermaidRenderer content={artifact.content} backgroundColor={bg} />;
    case 'image':
      return <ImageRenderer content={artifact.content} mediaType={artifact.mediaType} />;
    case 'markdown':
      return <MarkdownRenderer content={artifact.content} colors={colors} />;
    default:
      return null;
  }
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
        <XStack borderBottomWidth={2} borderBottomColor={colors.separator}>
          {header.map((cell, i) => (
            <YStack key={i} width={120} paddingHorizontal={Spacing.sm} paddingVertical={Spacing.xs}>
              <Text fontSize={FontSize.caption} fontWeight="700" color={colors.text} numberOfLines={1}>
                {cell}
              </Text>
            </YStack>
          ))}
        </XStack>
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
    marginTop: 44,
  },
  headerBtn: {
    padding: 6,
    borderRadius: Radius.sm,
  },
});
