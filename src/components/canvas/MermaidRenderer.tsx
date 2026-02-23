/**
 * MermaidRenderer — Renders Mermaid diagrams via WebView + CDN.
 * Supports flowchart, sequence, class, ER, gantt, pie, etc.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  content: string;
  backgroundColor: string;
}

export const MermaidRenderer = React.memo(function MermaidRenderer({ content, backgroundColor }: Props) {
  const escapedContent = useMemo(() => content.replace(/`/g, '\\`').replace(/<\/script/g, '<\\/script'), [content]);

  const html = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { min-height: 100%; background: ${backgroundColor}; display: flex; align-items: center; justify-content: center; padding: 16px; }
    #diagram { width: 100%; }
    #diagram svg { max-width: 100%; height: auto; }
    .error { color: #EF4444; font-family: monospace; font-size: 13px; padding: 16px; }
  </style>
</head>
<body>
  <div id="diagram"></div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#10A37F',
        primaryTextColor: '#e4e4e7',
        primaryBorderColor: '#3f3f46',
        lineColor: '#71717a',
        secondaryColor: '#27272a',
        tertiaryColor: '#18181b',
      },
    });
    try {
      const { svg } = await mermaid.render('mermaid-svg', \`${escapedContent}\`);
      document.getElementById('diagram').innerHTML = svg;
    } catch (e) {
      document.getElementById('diagram').innerHTML = '<div class="error">⚠ ' + e.message + '</div>';
    }
  </script>
</body>
</html>`, [escapedContent, backgroundColor]);

  return (
    <WebView
      source={{ html }}
      style={styles.webview}
      scrollEnabled
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      scalesPageToFit={false}
    />
  );
});

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
});
