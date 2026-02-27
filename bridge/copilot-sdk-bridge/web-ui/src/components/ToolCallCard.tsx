import { useState, useMemo } from 'react';
import hljs from 'highlight.js/lib/core';

interface ToolCallCardProps {
  name: string;
  args: string;
  result?: string;
  status?: 'running' | 'done' | 'error';
}

function highlightJson(raw: string): string {
  try {
    const formatted = JSON.stringify(JSON.parse(raw), null, 2);
    return hljs.highlight(formatted, { language: 'json' }).value;
  } catch {
    return hljs.highlightAuto(raw).value;
  }
}

const statusIcon: Record<string, string> = {
  running: '⏳',
  done: '✅',
  error: '❌',
};

export function ToolCallCard({ name, args, result, status }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  const argsHtml = useMemo(() => highlightJson(args), [args]);
  const resultHtml = useMemo(() => (result ? highlightJson(result) : ''), [result]);

  return (
    <div className="tool-card">
      <div className="tool-card-header" onClick={() => setOpen(!open)}>
        <span className="tool-icon">🔧</span>
        <span className="tool-name">{name}</span>
        {status && <span className="tool-status">{statusIcon[status] || ''}</span>}
        <span className={`collapse-arrow ${open ? 'open' : ''}`}>▶</span>
      </div>
      <div className={`tool-card-body ${open ? 'open' : ''}`}>
        <pre dangerouslySetInnerHTML={{ __html: argsHtml }} />
        {resultHtml && (
          <>
            <div style={{ padding: '4px 12px', fontSize: '0.75em', opacity: 0.5 }}>Result:</div>
            <pre dangerouslySetInnerHTML={{ __html: resultHtml }} />
          </>
        )}
      </div>
    </div>
  );
}
