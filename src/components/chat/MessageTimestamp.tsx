/**
 * MessageTimestamp — Formatted timestamp for chat messages.
 */
import React, { useMemo } from 'react';
import { Text } from 'tamagui';
import type { ThemeColors } from '../../utils/theme';

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  } catch { return ''; }
}

interface Props {
  timestamp: string;
  colors: ThemeColors;
}

export const MessageTimestamp = React.memo(function MessageTimestamp({ timestamp, colors }: Props) {
  const text = useMemo(() => formatTimestamp(timestamp), [timestamp]);
  if (!text) return null;
  return (
    <Text fontSize={10} color={colors.textTertiary} letterSpacing={0.2}>
      {text}
    </Text>
  );
});
