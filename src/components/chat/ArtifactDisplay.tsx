/**
 * ArtifactDisplay — Collapsible artifact cards with "Open" action.
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, ScrollView } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Code, Globe, Palette, BarChart3, Table, FileText, Image, Paperclip, type LucideIcon } from 'lucide-react-native';
import type { Artifact, ArtifactType } from '../../acp/models/types';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { sharedStyles } from '../../utils/sharedStyles';

const ARTIFACT_ICONS: Record<ArtifactType, LucideIcon> = {
  code: Code,
  html: Globe,
  svg: Palette,
  mermaid: BarChart3,
  csv: Table,
  markdown: FileText,
  image: Image,
};

export const ArtifactCard = React.memo(function ArtifactCard({
  artifact,
  colors,
  onOpen,
}: {
  artifact: Artifact;
  colors: ThemeColors;
  onOpen?: (artifact: Artifact) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => setExpanded(v => !v), []);
  const handleOpen = useCallback((e: GestureResponderEvent) => {
    e.stopPropagation?.();
    onOpen?.(artifact);
  }, [onOpen, artifact]);

  return (
    <TouchableOpacity
      style={[sharedStyles.separatorCard, { overflow: 'hidden', borderColor: colors.separator, backgroundColor: colors.codeBackground }]}
      onPress={handleToggle}
      activeOpacity={0.7}
    >
      <XStack alignItems="center" gap={8}>
        {React.createElement(ARTIFACT_ICONS[artifact.type] ?? Paperclip, { size: 18, color: colors.primary })}
        <YStack flex={1}>
          <Text fontWeight="500" fontSize={FontSize.footnote} color={colors.text}>{artifact.title}</Text>
          {artifact.language && (
            <Text fontSize={FontSize.caption} textTransform="uppercase" letterSpacing={0.5} marginTop={2} color={colors.textTertiary}>{artifact.language}</Text>
          )}
        </YStack>
        {onOpen && (
          <TouchableOpacity
            onPress={handleOpen}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Text fontSize={FontSize.caption} color={colors.primary} fontWeight="600">
              Open ↗
            </Text>
          </TouchableOpacity>
        )}
        <Text fontSize={14} fontWeight="600" paddingLeft={4} color={colors.textTertiary}>
          {expanded ? '▾' : '▸'}
        </Text>
      </XStack>
      {expanded && (
        <ScrollView horizontal style={{ marginTop: 8, maxHeight: 200 }}>
          <Text fontFamily="monospace" fontSize={FontSize.caption} color={colors.codeText} selectable>
            {artifact.content}
          </Text>
        </ScrollView>
      )}
    </TouchableOpacity>
  );
});

export function ArtifactList({
  artifacts,
  colors,
  onOpenArtifact,
}: {
  artifacts: Artifact[];
  colors: ThemeColors;
  onOpenArtifact?: (artifact: Artifact) => void;
}) {
  return (
    <YStack gap={8} marginTop={8}>
      {artifacts.map(art => (
        <ArtifactCard key={art.id} artifact={art} colors={colors} onOpen={onOpenArtifact} />
      ))}
    </YStack>
  );
}
