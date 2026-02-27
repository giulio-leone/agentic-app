import { useState, useRef, useEffect, useCallback } from 'react';
import type { ConsoleLogEntry } from '../services/types';

interface ConsoleTabProps {
  entries: readonly ConsoleLogEntry[];
}

export function ConsoleTab({ entries }: ConsoleTabProps) {
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [autoScroll]);

  useEffect(() => { scrollToBottom(); }, [entries, scrollToBottom]);

  const filtered = entries.filter((e) => {
    if (directionFilter !== 'all' && e.direction !== directionFilter) return false;
    if (typeFilter && !e.type.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    return true;
  });

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const truncate = (val: any, len = 120): string => {
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    return s.length > len ? s.slice(0, len) + '…' : s;
  };

  const prettyJson = (val: any): string => {
    try {
      return typeof val === 'string' ? val : JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <div className="console-tab">
      <div className="console-toolbar">
        <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as any)}>
          <option value="all">All</option>
          <option value="in">← Incoming</option>
          <option value="out">→ Outgoing</option>
        </select>
        <input
          type="text"
          placeholder="Filter by type…"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
        <label>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{filtered.length} entries</span>
      </div>

      <div className="console-entries" ref={listRef}>
        {filtered.length === 0 && (
          <div className="empty-state">No messages yet</div>
        )}
        {filtered.map((entry, i) => {
          const isExpanded = expandedIndex === i;
          return (
            <div key={i}>
              <div className="console-entry" onClick={() => setExpandedIndex(isExpanded ? null : i)}>
                <span className="timestamp">{formatTime(entry.timestamp)}</span>
                <span className={`direction ${entry.direction === 'out' ? 'outgoing' : 'incoming'}`}>
                  {entry.direction === 'out' ? '→' : '←'}
                </span>
                <span className="msg-type">{entry.type}</span>
                <span className="msg-preview">{truncate(entry.raw)}</span>
              </div>
              {isExpanded && (
                <div className="console-entry-expanded">
                  <pre>{prettyJson(entry.raw)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
