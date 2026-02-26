/**
 * QuickSetup — Preset data for AI providers, ACP agents, and Copilot SDK Bridge.
 */

import { Server, Globe, Bot, Brain, Gem, Zap, Github, Code, Terminal, type LucideIcon } from 'lucide-react-native';
import { ServerType } from '../../acp-hex/domain/types';
import { AIProviderType } from '../../ai/types';

export interface PresetProvider {
  type: AIProviderType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultModelId: string;
}

export interface ACPPreset {
  serverType: ServerType.ACP;
  label: string;
  description: string;
  defaultScheme: 'ws' | 'wss' | 'tcp';
  defaultHost: string;
  icon: LucideIcon;
}

export interface CopilotBridgePreset {
  label: string;
  description: string;
  icon: LucideIcon;
  defaultPort: number;
}

export const COPILOT_BRIDGE_PRESET: CopilotBridgePreset = {
  label: 'Copilot SDK Bridge',
  description: 'GitHub Copilot via SDK — discovery, pairing, 17+ modelli',
  icon: Github,
  defaultPort: 3030,
};

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
    serverType: ServerType.ACP,
    label: 'OpenCode',
    description: 'opencode --acp (stdio→bridge)',
    defaultScheme: 'tcp',
    defaultHost: 'localhost:3050',
    icon: Code,
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
