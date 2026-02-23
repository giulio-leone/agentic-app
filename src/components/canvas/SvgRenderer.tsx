/**
 * SvgRenderer — Renders SVG content via WebView.
 * Handles viewBox auto-scaling and dark theme adaptation.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  content: string;
  backgroundColor: string;
}

export const SvgRenderer = React.memo(function SvgRenderer({ content, backgroundColor }: Props) {
  const html = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: ${backgroundColor}; display: flex; align-items: center; justify-content: center; }
    svg { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>${content}</body>
</html>`, [content, backgroundColor]);

  return (
    <WebView
      source={{ html }}
      style={styles.webview}
      scrollEnabled={false}
      javaScriptEnabled={false}
      originWhitelist={['*']}
      scalesPageToFit={false}
    />
  );
});

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
});
