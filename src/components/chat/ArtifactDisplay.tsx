/**
 * ArtifactDisplay — Collapsible artifact cards.
 */

import React, { useState } from 'react';
import { TouchableOpacity, ScrollView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import type { Artifact, ArtifactType } from '../../acp/models/types';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';

const ARTIFACT_ICONS: Record<ArtifactType, string> = {
  code: '💻',
  html: '🌐',
  svg: '🎨',
  mermaid: '📊',
  csv: '📋',
  markdown: '📝',
  image: '🖼️',
};

export const ArtifactCard = React.memo(function ArtifactCard({
  artifact,
  colors,
}: {
  artifact: Artifact;
  colors: ThemeColors;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={{ borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.sm, overflow: 'hidden', borderColor: colors.separator, backgroundColor: colors.codeBackground }}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <XStack alignItems="center" gap={8}>
        <Text fontSize={20}>{ARTIFACT_ICONS[artifact.type] ?? '📎'}</Text>
        <YStack flex={1}>
          <Text fontWeight="500" fontSize={FontSize.footnote} color={colors.text}>{artifact.title}</Text>
          {artifact.language && (
            <Text fontSize={FontSize.caption} textTransform="uppercase" letterSpacing={0.5} marginTop={2} color={colors.textTertiary}>{artifact.language}</Text>
          )}
        </YStack>
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

export function ArtifactList({ artifacts, colors }: { artifacts: Artifact[]; colors: ThemeColors }) {
  return (
    <YStack gap={8} marginTop={8}>
      {artifacts.map(art => (
        <ArtifactCard key={art.id} artifact={art} colors={colors} />
      ))}
    </YStack>
  );
}
