/**
 * Prompt template system — built-in + user-created templates.
 */

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  category: 'coding' | 'writing' | 'analysis' | 'custom';
  icon: string;
  isBuiltIn: boolean;
}

/** Built-in templates — not editable. */
export const BUILT_IN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'explain-code',
    title: 'Explain Code',
    prompt: 'Explain the following code step by step:\n\n```\n{code}\n```',
    category: 'coding',
    icon: '📖',
    isBuiltIn: true,
  },
  {
    id: 'refactor',
    title: 'Refactor',
    prompt: 'Refactor the following code for better readability and performance:\n\n```\n{code}\n```',
    category: 'coding',
    icon: '🔧',
    isBuiltIn: true,
  },
  {
    id: 'write-tests',
    title: 'Write Tests',
    prompt: 'Write comprehensive unit tests for the following code:\n\n```\n{code}\n```',
    category: 'coding',
    icon: '🧪',
    isBuiltIn: true,
  },
  {
    id: 'fix-bug',
    title: 'Fix Bug',
    prompt: 'I have this error:\n\n{error}\n\nHere is the relevant code:\n\n```\n{code}\n```\n\nPlease diagnose and fix the bug.',
    category: 'coding',
    icon: '🐛',
    isBuiltIn: true,
  },
  {
    id: 'summarize',
    title: 'Summarize',
    prompt: 'Summarize the following text concisely:\n\n{text}',
    category: 'writing',
    icon: '📝',
    isBuiltIn: true,
  },
  {
    id: 'translate',
    title: 'Translate',
    prompt: 'Translate the following text to {language}:\n\n{text}',
    category: 'writing',
    icon: '🌐',
    isBuiltIn: true,
  },
  {
    id: 'pros-cons',
    title: 'Pros & Cons',
    prompt: 'Analyze the pros and cons of: {topic}',
    category: 'analysis',
    icon: '⚖️',
    isBuiltIn: true,
  },
  {
    id: 'eli5',
    title: 'ELI5',
    prompt: 'Explain like I\'m 5 years old: {topic}',
    category: 'analysis',
    icon: '🧒',
    isBuiltIn: true,
  },
];

/** Match templates by slash command prefix. */
export function matchTemplates(query: string, templates: PromptTemplate[]): PromptTemplate[] {
  if (!query.startsWith('/')) return [];
  const search = query.slice(1).toLowerCase();
  if (!search) return templates;
  return templates.filter(t =>
    t.title.toLowerCase().includes(search) || t.id.includes(search)
  );
}
