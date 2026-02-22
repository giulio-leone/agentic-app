/**
 * QuickSetup — Preset data for AI providers and ACP agents.
 */

import { Server, Globe, Bot, Brain, Gem, Zap, Github, type LucideIcon } from 'lucide-react-native';
import { ServerType } from '../../acp/models/types';
import { AIProviderType } from '../../ai/types';

export interface PresetProvider {
  type: AIProviderType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultModelId: string;
}

export interface ACPPreset {
  serverType: ServerType.ACP | ServerType.Codex | ServerType.CopilotCLI;
  label: string;
  description: string;
  defaultScheme: 'ws' | 'wss' | 'tcp';
  defaultHost: string;
  icon: LucideIcon;
}

export const AI_PRESETS: PresetProvider[] = [
  {
    type: AIProviderType.OpenRouter,
    label: 'OpenRouter',
    description: 'Accesso a 200+ modelli con una sola API key',
    icon: Globe,
    defaultModelId: 'anthropic/claude-sonnet-4',
  },
  {
    type: AIProviderType.OpenAI,
    label: 'OpenAI',
    description: 'GPT-4o, o3 e famiglia ChatGPT',
    icon: Bot,
    defaultModelId: 'gpt-4o',
  },
  {
    type: AIProviderType.Anthropic,
    label: 'Anthropic',
    description: 'Claude Sonnet 4, Opus e famiglia',
    icon: Brain,
    defaultModelId: 'claude-sonnet-4-20250514',
  },
  {
    type: AIProviderType.Google,
    label: 'Google AI',
    description: 'Gemini 2.5 Pro e Flash',
    icon: Gem,
    defaultModelId: 'gemini-2.5-pro-preview-06-05',
  },
  {
    type: AIProviderType.Groq,
    label: 'Groq',
    description: 'Ultra veloce — Llama, Mixtral',
    icon: Zap,
    defaultModelId: 'llama-3.3-70b-versatile',
  },
];

export const ACP_PRESETS: ACPPreset[] = [
  {
    serverType: ServerType.CopilotCLI,
    label: 'Copilot CLI',
    description: 'copilot --acp --port 3020',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3020',
    icon: Github,
  },
  {
    serverType: ServerType.ACP,
    label: 'Copilot SDK',
    description: 'copilot-bridge (SDK completo)',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3020',
    icon: Github,
  },
  {
    serverType: ServerType.ACP,
    label: 'Gemini CLI',
    description: 'gemini --acp (stdio→bridge)',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3030',
    icon: Gem,
  },
  {
    serverType: ServerType.ACP,
    label: 'Claude Code',
    description: 'claude-code-acp (stdio→bridge)',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3040',
    icon: Brain,
  },
  {
    serverType: ServerType.Codex,
    label: 'Codex CLI',
    description: 'codex --acp --port 8765',
    defaultScheme: 'ws',
    defaultHost: 'localhost:8765',
    icon: Bot,
  },
  {
    serverType: ServerType.ACP,
    label: 'CLI Generica',
    description: 'Qualsiasi agent ACP su rete',
    defaultScheme: 'ws',
    defaultHost: 'localhost:8765',
    icon: Server,
  },
];
