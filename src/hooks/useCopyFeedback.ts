import { useState, useRef, useEffect, useCallback } from 'react';

export function useCopyFeedback(delay = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const triggerCopy = useCallback(() => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), delay);
  }, [delay]);
  return { copied, triggerCopy };
}
