import React from 'react';

interface BridgeConfig {
  port: number;
  cwd: string;
  copilot: boolean;
  codex: boolean;
  model: string;
  codexModel: string;
  codexPath: string;
}

interface Props {
  config: BridgeConfig;
  onUpdate: (patch: Partial<BridgeConfig>) => void;
}

export const ServerConfig = React.memo(function ServerConfig({ config, onUpdate }: Props) {
  return (
    <div className="bg-surface-light rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Server</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Port</label>
          <input
            type="number"
            className="w-full bg-surface border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
            value={config.port}
            min={1024}
            max={65535}
            onChange={(e) => onUpdate({ port: parseInt(e.target.value, 10) || 3020 })}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Working Directory</label>
          <input
            type="text"
            className="w-full bg-surface border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
            value={config.cwd}
            onChange={(e) => onUpdate({ cwd: e.target.value })}
            placeholder="~/"
          />
        </div>
      </div>
    </div>
  );
});
