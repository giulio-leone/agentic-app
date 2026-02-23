/**
 * CodeBlock — syntax-highlighted code block with copy button and language label.
 * Uses simple token-based highlighting (no external dependency).
 */

import React, { useCallback, useMemo } from 'react';
import { Text as RNText, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useDesignSystem } from '../utils/designSystem';
import { type ThemeColors, FontSize, Spacing, Radius } from '../utils/theme';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

// ── Token types ──────────────────────────────────────────────────────────────

type TokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'number'
  | 'operator'
  | 'function'
  | 'type'
  | 'plain';

interface Token {
  type: TokenType;
  value: string;
}

// ── Language-aware tokenizer ─────────────────────────────────────────────────

const KEYWORDS_BY_LANG: Record<string, Set<string>> = {
  javascript: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'in', 'of', 'switch', 'case', 'break', 'continue', 'yield', 'delete', 'void', 'null', 'undefined', 'true', 'false']),
  typescript: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'type', 'interface', 'enum', 'as', 'extends', 'implements', 'readonly', 'private', 'public', 'protected', 'abstract', 'static', 'null', 'undefined', 'true', 'false', 'keyof', 'infer']),
  python: new Set(['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'yield', 'lambda', 'pass', 'break', 'continue', 'raise', 'in', 'not', 'and', 'or', 'is', 'None', 'True', 'False', 'self', 'async', 'await', 'global', 'nonlocal']),
  swift: new Set(['func', 'let', 'var', 'class', 'struct', 'enum', 'protocol', 'import', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'guard', 'self', 'Self', 'nil', 'true', 'false', 'try', 'catch', 'throw', 'throws', 'async', 'await', 'private', 'public', 'internal', 'fileprivate', 'open', 'static', 'override', 'mutating', 'where', 'in', 'as', 'is', 'extension', 'typealias', 'init', 'deinit', 'weak', 'unowned', 'lazy', 'final', 'convenience', 'required']),
  rust: new Set(['fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'use', 'pub', 'mod', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'self', 'Self', 'true', 'false', 'as', 'in', 'ref', 'async', 'await', 'move', 'unsafe', 'where', 'type', 'dyn', 'static', 'extern', 'crate', 'super']),
  go: new Set(['func', 'var', 'const', 'type', 'struct', 'interface', 'import', 'package', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'go', 'defer', 'select', 'chan', 'map', 'make', 'new', 'nil', 'true', 'false', 'fallthrough', 'default']),
  java: new Set(['class', 'interface', 'enum', 'extends', 'implements', 'import', 'package', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'this', 'super', 'void', 'null', 'true', 'false', 'instanceof']),
  bash: new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'in', 'function', 'return', 'exit', 'echo', 'export', 'local', 'readonly', 'shift', 'source', 'set', 'unset', 'true', 'false']),
  json: new Set([]),
  css: new Set([]),
  html: new Set([]),
  sql: new Set(['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'INTO', 'VALUES', 'SET', 'AND', 'OR', 'NOT', 'IN', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'NULL', 'TRUE', 'FALSE', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'UNION', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CASCADE']),
};

// Alias mapping
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
  py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash',
  kt: 'java', kotlin: 'java', cs: 'java', csharp: 'java',
  yml: 'json', yaml: 'json', xml: 'html',
  rs: 'rust', rb: 'python', php: 'javascript',
  c: 'go', cpp: 'go', 'c++': 'go', h: 'go',
};

function resolveLanguage(lang: string): string {
  const l = lang.toLowerCase().trim();
  return LANG_ALIASES[l] || l;
}

function getKeywords(lang: string): Set<string> {
  return KEYWORDS_BY_LANG[resolveLanguage(lang)] || KEYWORDS_BY_LANG.javascript!;
}

function tokenize(code: string, lang: string): Token[] {
  const keywords = getKeywords(lang);
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Comments: // or #
    if ((code[i] === '/' && code[i + 1] === '/') || (lang === 'python' || lang === 'bash' || lang === 'sh') && code[i] === '#') {
      const end = code.indexOf('\n', i);
      const commentEnd = end === -1 ? code.length : end;
      tokens.push({ type: 'comment', value: code.slice(i, commentEnd) });
      i = commentEnd;
      continue;
    }

    // Block comments /* */
    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const commentEnd = end === -1 ? code.length : end + 2;
      tokens.push({ type: 'comment', value: code.slice(i, commentEnd) });
      i = commentEnd;
      continue;
    }

    // Strings
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++;
        j++;
      }
      tokens.push({ type: 'string', value: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/\d/.test(code[i]!) && (i === 0 || !/\w/.test(code[i - 1]!))) {
      let j = i;
      while (j < code.length && /[\d.xXbBoOeE_a-fA-F]/.test(code[j]!)) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Words (identifiers / keywords)
    if (/[a-zA-Z_$@]/.test(code[i]!)) {
      let j = i;
      while (j < code.length && /[\w$]/.test(code[j]!)) j++;
      const word = code.slice(i, j);
      if (keywords.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (j < code.length && code[j] === '(') {
        tokens.push({ type: 'function', value: word });
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        tokens.push({ type: 'type', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = j;
      continue;
    }

    // Operators
    if (/[+\-*/%=<>!&|^~?:;,.{}()\[\]]/.test(code[i]!)) {
      tokens.push({ type: 'operator', value: code[i]! });
      i++;
      continue;
    }

    // Whitespace / other
    tokens.push({ type: 'plain', value: code[i]! });
    i++;
  }

  return tokens;
}

// ── Theme colors for tokens ──────────────────────────────────────────────────

function getTokenColor(type: TokenType, colors: ThemeColors): string {
  switch (type) {
    case 'keyword': return '#c678dd';    // purple
    case 'string': return '#98c379';     // green
    case 'comment': return '#5c6370';    // gray
    case 'number': return '#d19a66';     // orange
    case 'operator': return '#56b6c2';   // cyan
    case 'function': return '#61afef';   // blue
    case 'type': return '#e5c07b';       // yellow
    case 'plain': return colors.codeText;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lineNum: {
    fontFamily: 'monospace',
    fontSize: FontSize.caption,
    lineHeight: FontSize.caption * 1.6,
    textAlign: 'right',
    opacity: 0.5,
  },
});

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock = React.memo(function CodeBlock({ code, language = '' }: CodeBlockProps) {
  const { colors } = useDesignSystem();
  const { copied, triggerCopy } = useCopyFeedback();

  const tokens = useMemo(() => tokenize(code, language), [code, language]);
  const lines = useMemo(() => code.split('\n'), [code]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    triggerCopy();
  }, [code, triggerCopy]);

  const displayLang = language ? language.toUpperCase() : '';

  // Memoize rendered tokens — use RN Text for safe nesting inside Tamagui Text
  const renderedTokens = useMemo(() =>
    tokens.map((token, i) => (
      <RNText key={i} style={{ color: getTokenColor(token.type, colors), fontFamily: 'monospace', fontSize: FontSize.caption }}>
        {token.value}
      </RNText>
    )),
    [tokens, colors],
  );

  return (
    <YStack borderRadius={Radius.sm} marginVertical={4} overflow="hidden" backgroundColor={colors.codeBackground}>
      {/* Header with language + copy */}
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={Spacing.sm + 2} paddingVertical={6} borderBottomWidth={StyleSheet.hairlineWidth} borderBottomColor="rgba(255,255,255,0.08)">
        <Text fontSize={FontSize.caption - 1} fontWeight="600" letterSpacing={0.5} color={colors.textTertiary}>
          {displayLang}
        </Text>
        <TouchableOpacity onPress={handleCopy} style={styles.copyBtn} activeOpacity={0.7}>
          {copied ? <Check size={13} color={colors.primary} /> : <Copy size={13} color={colors.textTertiary} />}
          <Text fontSize={FontSize.caption} fontWeight="500" color={copied ? colors.primary : colors.textTertiary}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </XStack>

      {/* Code content */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack>
          {/* Line numbers gutter */}
          <YStack paddingVertical={Spacing.md} paddingLeft={Spacing.sm} paddingRight={Spacing.xs} borderRightWidth={StyleSheet.hairlineWidth} borderRightColor="rgba(255,255,255,0.06)">
          {lines.map((_, i) => (
              <RNText key={i} style={[styles.lineNum, { color: colors.textTertiary, minWidth: lines.length > 99 ? 24 : 16 }]}>
                {i + 1}
              </RNText>
            ))}
          </YStack>
          <Text padding={Spacing.md} fontFamily="monospace" fontSize={FontSize.caption} lineHeight={FontSize.caption * 1.6} selectable>
            {renderedTokens}
          </Text>
        </XStack>
      </ScrollView>
    </YStack>
  );
});
