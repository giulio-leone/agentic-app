/**
 * MarkdownRenderer — Renders markdown content using the existing MarkdownContent component.
 */

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { MarkdownContent } from '../chat/MarkdownContent';
import type { ThemeColors } from '../../utils/theme';
import { Spacing } from '../../utils/theme';

interface Props {
  content: string;
  colors: ThemeColors;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, colors }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MarkdownContent content={content} colors={colors} />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md },
});
