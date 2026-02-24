/**
 * CliChoiceBlock — Detects and renders ask_user-like choice patterns
 * in CLI session content as styled interactive cards.
 *
 * Recognizes patterns:
 *   - Lines with emoji + **bold option** — description
 *   - Numbered options: "1.", "2.", "3." followed by bold text
 *   - "Raccomandata" / "Recommended" tags highlighted
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { MessageCircleQuestion, Star } from 'lucide-react-native';
import type { ThemeColors } from '../../utils/theme';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface ChoiceItem {
  label: string;
  description: string;
  isRecommended: boolean;
}

interface ChoiceBlock {
  question: string;
  choices: ChoiceItem[];
  startIndex: number;
  endIndex: number;
}

/** Parse choice blocks from markdown content. */
export function parseChoiceBlocks(content: string): ChoiceBlock[] {
  const lines = content.split('\n');
  const blocks: ChoiceBlock[] = [];

  // Pattern: question line followed by 2+ choice lines
  // Choice line: starts with emoji or number+dot, contains **bold**
  const choiceLineRe = /^(?:[🏆🚨📂\u2B50\u2705\u274C•\-\*]|\d+\.)\s*\*\*(.+?)\*\*\s*[—\-:.]?\s*(.*)/;
  const questionRe = /\?\s*$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();

    // Look for a question line (ends with ?)
    if (questionRe.test(line)) {
      const questionLine = line;
      const choices: ChoiceItem[] = [];
      let j = i + 1;

      // Skip blank lines
      while (j < lines.length && !lines[j]!.trim()) j++;

      // Collect consecutive choice lines
      while (j < lines.length) {
        const cl = lines[j]!.trim();
        if (!cl) { j++; continue; }
        const m = choiceLineRe.exec(cl);
        if (!m) break;
        const label = m[1]!.trim();
        const description = m[2]?.trim() || '';
        const isRecommended = /raccomandata|recommended/i.test(cl);
        choices.push({ label, description, isRecommended });
        j++;
      }

      if (choices.length >= 2) {
        blocks.push({
          question: questionLine.replace(/^#+\s*/, ''),
          choices,
          startIndex: i,
          endIndex: j - 1,
        });
        i = j;
        continue;
      }
    }
    i++;
  }

  return blocks;
}

/** Split content into regular text + choice blocks for rendering. */
export function splitContentWithChoices(content: string): Array<{ type: 'text'; content: string } | { type: 'choices'; block: ChoiceBlock }> {
  const blocks = parseChoiceBlocks(content);
  if (blocks.length === 0) return [{ type: 'text', content }];

  const lines = content.split('\n');
  const result: Array<{ type: 'text'; content: string } | { type: 'choices'; block: ChoiceBlock }> = [];
  let cursor = 0;

  for (const block of blocks) {
    if (block.startIndex > cursor) {
      const text = lines.slice(cursor, block.startIndex).join('\n').trim();
      if (text) result.push({ type: 'text', content: text });
    }
    result.push({ type: 'choices', block });
    cursor = block.endIndex + 1;
  }

  if (cursor < lines.length) {
    const text = lines.slice(cursor).join('\n').trim();
    if (text) result.push({ type: 'text', content: text });
  }

  return result;
}

// ── Component ──

interface CliChoiceBlockProps {
  block: ChoiceBlock;
  colors: ThemeColors;
}

export const CliChoiceBlock = React.memo(function CliChoiceBlock({ block, colors }: CliChoiceBlockProps) {
  return (
    <YStack marginVertical={Spacing.sm} gap={Spacing.xs}>
      {/* Question */}
      <XStack alignItems="center" gap={6} marginBottom={4}>
        <MessageCircleQuestion size={16} color={colors.primary} />
        <Text fontSize={FontSize.subheadline} fontWeight="600" color={colors.text} flex={1}>
          {block.question}
        </Text>
      </XStack>

      {/* Choices */}
      {block.choices.map((choice, i) => (
        <View
          key={i}
          style={[
            styles.choiceCard,
            {
              borderColor: choice.isRecommended ? colors.primary : colors.separator,
              backgroundColor: choice.isRecommended ? `${colors.primary}12` : 'transparent',
            },
          ]}
        >
          <XStack alignItems="flex-start" gap={Spacing.sm}>
            <Text fontSize={FontSize.caption} fontWeight="700" color={colors.textSecondary} marginTop={1}>
              {i + 1}.
            </Text>
            <YStack flex={1} gap={2}>
              <XStack alignItems="center" gap={4}>
                <Text fontSize={FontSize.footnote} fontWeight="600" color={colors.text} flex={1}>
                  {choice.label}
                </Text>
                {choice.isRecommended && (
                  <XStack alignItems="center" gap={2} backgroundColor={colors.primary} paddingHorizontal={6} paddingVertical={1} borderRadius={8}>
                    <Star size={9} color={colors.contrastText} />
                    <Text fontSize={9} fontWeight="700" color={colors.contrastText}>REC</Text>
                  </XStack>
                )}
              </XStack>
              {choice.description ? (
                <Text fontSize={FontSize.caption} color={colors.textSecondary} numberOfLines={3}>
                  {choice.description}
                </Text>
              ) : null}
            </YStack>
          </XStack>
        </View>
      ))}
    </YStack>
  );
});

const styles = StyleSheet.create({
  choiceCard: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
  },
});
