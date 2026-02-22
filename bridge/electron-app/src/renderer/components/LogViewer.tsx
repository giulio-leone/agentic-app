import React, { useEffect, useRef } from 'react';

interface Props {
  logs: string[];
  onClear: () => void;
}

export const LogViewer = React.memo(function LogViewer({ logs, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{logs.length} lines</span>
        <button
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 bg-surface rounded-lg p-3 overflow-y-auto font-mono text-xs leading-relaxed text-gray-300"
      >
        {logs.length === 0 ? (
          <span className="text-gray-500">No logs yet. Start the bridge to see output.</span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap ${
                line.includes('[stderr]') ? 'text-danger' :
                line.includes('Error') ? 'text-warning' :
                line.includes('listening') || line.includes('Running') ? 'text-success' :
                ''
              }`}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
});
