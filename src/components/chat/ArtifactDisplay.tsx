/**
 * ArtifactDisplay — Collapsible artifact cards.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
      style={[styles.card, { borderColor: colors.separator, backgroundColor: colors.codeBackground }]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{ARTIFACT_ICONS[artifact.type] ?? '📎'}</Text>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{artifact.title}</Text>
          {artifact.language && (
            <Text style={[styles.lang, { color: colors.textTertiary }]}>{artifact.language}</Text>
          )}
        </View>
        <Text style={[styles.chevron, { color: colors.textTertiary }]}>
          {expanded ? '▾' : '▸'}
        </Text>
      </View>
      {expanded && (
        <ScrollView horizontal style={styles.content}>
          <Text style={[styles.code, { color: colors.codeText }]} selectable>
            {artifact.content}
          </Text>
        </ScrollView>
      )}
    </TouchableOpacity>
  );
});

export function ArtifactList({ artifacts, colors }: { artifacts: Artifact[]; colors: ThemeColors }) {
  return (
    <View style={styles.list}>
      {artifacts.map(art => (
        <ArtifactCard key={art.id} artifact={art} colors={colors} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '500',
    fontSize: FontSize.footnote,
  },
  lang: {
    fontSize: FontSize.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '600',
    paddingLeft: 4,
  },
  content: {
    marginTop: 8,
    maxHeight: 200,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: FontSize.caption,
  },
});
