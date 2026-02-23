import React from 'react';

interface BridgeConfig {
  port: number;
  cwd: string;
  copilot: boolean;
  codex: boolean;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high' | '';
  codexModel: string;
  codexPath: string;
}

interface Props {
  config: BridgeConfig;
  onUpdate: (patch: Partial<BridgeConfig>) => void;
}

export const ProviderConfig = React.memo(function ProviderConfig({ config, onUpdate }: Props) {
  return (
    <div className="bg-surface-light rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Providers</h3>

      {/* Copilot */}
      <div className="space-y-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium">🤖 GitHub Copilot</span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-accent"
            checked={config.copilot}
            onChange={(e) => onUpdate({ copilot: e.target.checked })}
          />
        </label>
        {config.copilot && (
          <div className="ml-6 space-y-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Model</label>
              <input
                type="text"
                className="w-full bg-surface border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
                value={config.model}
                onChange={(e) => onUpdate({ model: e.target.value })}
                placeholder="gpt-4.1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Reasoning Effort</label>
              <select
                className="w-full bg-surface border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
                value={config.reasoningEffort}
                onChange={(e) => onUpdate({ reasoningEffort: e.target.value as BridgeConfig['reasoningEffort'] })}
              >
                <option value="">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Codex */}
      <div className="space-y-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium">🧬 OpenAI Codex</span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-accent"
            checked={config.codex}
            onChange={(e) => onUpdate({ codex: e.target.checked })}
          />
        </label>
        {config.codex && (
          <div className="ml-6 space-y-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Model</label>
              <input
                type="text"
                className="w-full bg-surface border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
                value={config.codexModel}
                onChange={(e) => onUpdate({ codexModel: e.target.value })}
                placeholder="codex-mini"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Codex CLI path</label>
              <input
                type="text"
                className="w-full bg-surface border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
                value={config.codexPath}
                onChange={(e) => onUpdate({ codexPath: e.target.value })}
                placeholder="codex"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
