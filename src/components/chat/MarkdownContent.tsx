/**
 * MarkdownContent — Renders markdown with inline images, artifacts, and syntax highlighting.
 */

import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Artifact } from '../../acp/models/types';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';
import { ArtifactList } from './ArtifactDisplay';
import { InlineImage } from './InlineImage';
import { codeBlockRules } from './codeBlockRules';

const hairline = StyleSheet.hairlineWidth;

// Re-export for convenience
export { codeBlockRules } from './codeBlockRules';

interface Props {
  content: string;
  colors: ThemeColors;
  artifacts?: Artifact[];
  onOpenArtifact?: (artifact: Artifact) => void;
}

export const MarkdownContent = React.memo(function MarkdownContent({ content, colors, artifacts, onOpenArtifact }: Props) {
  const mdStyles = useMemo(() => createMarkdownStyles(colors), [colors]);

  const handleLinkPress = useCallback((url: string) => {
    Linking.openURL(url).catch(e => console.warn('[Linking] Failed to open URL:', e));
    return false; // prevent default
  }, []);

  // Extract image URLs from markdown ![alt](url) patterns
  const parts = useMemo(() => {
    // Short-circuit: skip regex if no image syntax present
    if (!content.includes('![')) {
      return [{ type: 'text' as const, text: content }];
    }
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const result: Array<{ type: 'text'; text: string } | { type: 'image'; url: string; alt: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = imageRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', text: content.slice(lastIndex, match.index) });
      }
      result.push({ type: 'image', url: match[2]!, alt: match[1]! });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      result.push({ type: 'text', text: content.slice(lastIndex) });
    }
    return result;
  }, [content]);

  const hasImages = parts.length > 1 || (parts.length === 1 && parts[0]?.type === 'image');

  if (!hasImages) {
    return (
      <>
        <Markdown style={mdStyles} rules={codeBlockRules} onLinkPress={handleLinkPress}>{content}</Markdown>
        {artifacts && artifacts.length > 0 && <ArtifactList artifacts={artifacts} colors={colors} onOpenArtifact={onOpenArtifact} />}
      </>
    );
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text' && part.text.trim()) {
          return <Markdown key={`t-${i}`} style={mdStyles} rules={codeBlockRules} onLinkPress={handleLinkPress}>{part.text}</Markdown>;
        }
        if (part.type === 'image') {
          return <InlineImage key={`i-${i}-${part.url}`} url={part.url} alt={part.alt} colors={colors} />;
        }
        return null;
      })}
      {artifacts && artifacts.length > 0 && <ArtifactList artifacts={artifacts} colors={colors} onOpenArtifact={onOpenArtifact} />}
    </>
  );
});

export function createMarkdownStyles(colors: ThemeColors) {
  return {
    body: {
      color: colors.assistantBubbleText,
      fontSize: FontSize.body,
      lineHeight: 24,
    },
    heading1: {
      fontSize: FontSize.title2,
      fontWeight: '700' as const,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
      color: colors.text,
    },
    heading2: {
      fontSize: FontSize.title3,
      fontWeight: '600' as const,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
      color: colors.text,
    },
    heading3: {
      fontSize: FontSize.headline,
      fontWeight: '600' as const,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      color: colors.text,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    strong: {
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    code_inline: {
      backgroundColor: colors.codeBackground,
      color: colors.codeText,
      fontSize: FontSize.footnote,
      fontFamily: 'monospace',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: colors.codeBackground,
      color: colors.codeText,
      fontSize: FontSize.caption,
      fontFamily: 'monospace',
      padding: Spacing.md,
      borderRadius: Radius.sm,
      marginVertical: 4,
      overflow: 'hidden' as const,
    },
    code_block: {
      backgroundColor: colors.codeBackground,
      color: colors.codeText,
      fontSize: FontSize.caption,
      fontFamily: 'monospace',
      padding: Spacing.md,
      borderRadius: Radius.sm,
      marginVertical: 4,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },
    list_item: {
      marginVertical: 2,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    blockquote: {
      borderLeftColor: colors.textTertiary,
      borderLeftWidth: 3,
      paddingLeft: Spacing.md,
      marginVertical: 8,
      opacity: 0.85,
    },
    hr: {
      backgroundColor: colors.separator,
      height: 1,
      marginVertical: Spacing.md,
    },
    table: {
      borderColor: colors.separator,
      borderWidth: 1,
      borderRadius: 4,
      marginVertical: 8,
    },
    th: {
      backgroundColor: colors.codeBackground,
      padding: 6,
      borderBottomWidth: 1,
      borderColor: colors.separator,
    },
    td: {
      padding: 6,
      borderBottomWidth: hairline,
      borderColor: colors.separator,
    },
  };
}
