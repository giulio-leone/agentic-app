import React from 'react';

type BridgeStatus = 'stopped' | 'starting' | 'running' | 'error';

const STATUS_DISPLAY: Record<BridgeStatus, { icon: string; label: string; color: string }> = {
  stopped: { icon: '⏹', label: 'Stopped', color: 'text-gray-400' },
  starting: { icon: '🔄', label: 'Starting...', color: 'text-warning' },
  running: { icon: '✅', label: 'Running', color: 'text-success' },
  error: { icon: '❌', label: 'Error', color: 'text-danger' },
};

interface Props {
  status: BridgeStatus;
  clients: number;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

export const StatusBar = React.memo(function StatusBar({ status, clients, onStart, onStop, onRestart }: Props) {
  const info = STATUS_DISPLAY[status];
  const isRunning = status === 'running';
  const isStarting = status === 'starting';

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface-light border-b border-gray-700">
      <div className="flex items-center gap-3">
        <span className={`text-lg ${info.color}`}>{info.icon}</span>
        <div>
          <span className={`text-sm font-semibold ${info.color}`}>{info.label}</span>
          {isRunning && (
            <span className="text-xs text-gray-400 ml-2">
              {clients} client{clients !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {!isRunning && !isStarting && (
          <button
            className="px-3 py-1.5 bg-accent hover:bg-accent-light text-white text-xs font-medium rounded-md transition-colors"
            onClick={onStart}
          >
            ▶ Start
          </button>
        )}
        {(isRunning || isStarting) && (
          <>
            <button
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium rounded-md transition-colors"
              onClick={onRestart}
            >
              🔄 Restart
            </button>
            <button
              className="px-3 py-1.5 bg-danger hover:bg-red-400 text-white text-xs font-medium rounded-md transition-colors"
              onClick={onStop}
            >
              ⏹ Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
});
