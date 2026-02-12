/**
 * Shared code block render rules for react-native-markdown-display.
 * Used by both MarkdownContent and SegmentView to avoid duplication.
 */

import React from 'react';
import type { ASTNode, RenderRules } from 'react-native-markdown-display';
import { CodeBlock } from '../CodeBlock';

export const codeBlockRules: RenderRules = {
  fence: (node: ASTNode) => {
    const lang = (node as ASTNode & { sourceInfo?: string }).sourceInfo || '';
    const code = node.content || '';
    return <CodeBlock key={node.key} code={code.replace(/\n$/, '')} language={lang} />;
  },
  code_block: (node: ASTNode) => {
    const code = node.content || '';
    return <CodeBlock key={node.key} code={code.replace(/\n$/, '')} language="" />;
  },
};
