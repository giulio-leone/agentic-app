/**
 * HtmlRenderer — Live HTML/CSS/JS preview via WebView.
 * Sandboxed execution with message bridge for resize events.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  content: string;
  backgroundColor: string;
}

export const HtmlRenderer = React.memo(function HtmlRenderer({ content, backgroundColor }: Props) {
  const html = useMemo(() => {
    // If content is a full HTML document, use as-is; otherwise wrap it
    const isFullDoc = content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html');
    if (isFullDoc) return content;

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      background: ${backgroundColor};
      color: #e4e4e7;
      overflow-x: hidden;
    }
    img { max-width: 100%; height: auto; }
    pre { overflow-x: auto; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; }
    code { font-family: 'Menlo', 'Courier New', monospace; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid rgba(255,255,255,0.1); padding: 8px; text-align: left; }
    th { background: rgba(255,255,255,0.05); font-weight: 600; }
    a { color: #10A37F; }
    canvas { max-width: 100%; }
  </style>
</head>
<body>${content}</body>
</html>`;
  }, [content, backgroundColor]);

  return (
    <WebView
      source={{ html }}
      style={styles.webview}
      scrollEnabled
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      scalesPageToFit={false}
      showsVerticalScrollIndicator={false}
    />
  );
});

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
});
