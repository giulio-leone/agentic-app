/**
 * TerminalPanel — Embedded xterm.js terminal via WebView.
 * Opens as a modal overlay, connects to a local server via WebSocket.
 * Allows running CLI tools (copilot, gemini-cli, codex, etc.) with full terminal emulation.
 */

import React, { useRef, useCallback, useState } from 'react';
import { Modal, TouchableOpacity, StyleSheet, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { X, Maximize2, Minimize2, Terminal } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignSystem } from '../utils/designSystem';
import { Spacing, FontSize, Radius } from '../utils/theme';
import { useAppStore } from '../stores/appStore';

const XTERM_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #1a1a2e; overflow: hidden; }
    #terminal { height: 100%; width: 100%; }
    .xterm { height: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.min.js"></script>
  <script>
    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e4e4e7',
        cursor: '#10A37F',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(16, 163, 127, 0.3)',
        black: '#1a1a2e',
        red: '#ef4444',
        green: '#10A37F',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    let ws = null;

    function connect(/** @type {string} */ url) {
      if (ws) ws.close();
      ws = new WebSocket(url);
      ws.onopen = () => {
        term.writeln('\\x1b[32m✓ Connected to ' + url + '\\x1b[0m');
        term.writeln('');
        // Send terminal size
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') {
          term.write(msg.data);
        }
      };
      ws.onclose = () => {
        term.writeln('\\x1b[33m⚠ Disconnected\\x1b[0m');
      };
      ws.onerror = () => {
        term.writeln('\\x1b[31m✗ Connection error\\x1b[0m');
      };
    }

    // Send user input to server
    term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    new ResizeObserver(() => {
      fitAddon.fit();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    }).observe(document.getElementById('terminal'));

    // Welcome message
    term.writeln('\\x1b[1;36m╔══════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[1;36m║   Agentic Terminal                   ║\\x1b[0m');
    term.writeln('\\x1b[1;36m╚══════════════════════════════════════╝\\x1b[0m');
    term.writeln('');
    term.writeln('Enter a WebSocket URL to connect to a terminal server.');
    term.writeln('Example: ws://localhost:8080');
    term.writeln('');

    // Listen for messages from React Native
    function handleWindowMessage(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'connect') connect(msg.url);
        if (msg.type === 'write') term.write(msg.data);
        if (msg.type === 'clear') term.clear();
      } catch (err) {
        console.warn('[Terminal] Failed to parse message:', err);
      }
    }
    window.addEventListener('message', handleWindowMessage);

    // Also handle React Native Android
    function handleDocMessage(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'connect') connect(msg.url);
        if (msg.type === 'write') term.write(msg.data);
        if (msg.type === 'clear') term.clear();
      } catch (err) {
        console.warn('[Terminal] Failed to parse message:', err);
      }
    }
    document.addEventListener('message', handleDocMessage);

    // Notify React Native we're ready
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
  </script>
</body>
</html>
`;

export const TerminalPanel = React.memo(function TerminalPanel() {
  const visible = useAppStore(s => s.terminalVisible);
  const setTerminalVisible = useAppStore(s => s.setTerminalVisible);
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectUrl, setConnectUrl] = useState('ws://localhost:8080');
  const onClose = useCallback(() => setTerminalVisible(false), [setTerminalVisible]);

  const handleConnect = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'connect', url: connectUrl }));
  }, [connectUrl]);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      JSON.parse(event.nativeEvent.data);
    } catch { /* ignore */ }
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={!isFullscreen}
      onRequestClose={onClose}
    >
      <YStack
        flex={1}
        backgroundColor={isFullscreen ? '#1a1a2e' : 'rgba(0,0,0,0.5)'}
        justifyContent={isFullscreen ? 'flex-start' : 'flex-end'}
      >
        <YStack
          flex={isFullscreen ? 1 : undefined}
          height={isFullscreen ? undefined : '70%'}
          backgroundColor="#1a1a2e"
          borderTopLeftRadius={isFullscreen ? 0 : Radius.xl}
          borderTopRightRadius={isFullscreen ? 0 : Radius.xl}
          overflow="hidden"
          paddingTop={isFullscreen ? insets.top : 0}
        >
          {/* Header */}
          <XStack
            paddingHorizontal={Spacing.md}
            paddingVertical={Spacing.sm}
            alignItems="center"
            justifyContent="space-between"
            backgroundColor="#16162a"
          >
            <XStack alignItems="center" gap={Spacing.sm}>
              <Terminal size={16} color="#10A37F" />
              <Text fontSize={FontSize.subheadline} fontWeight="600" color="#e4e4e7">
                Terminal
              </Text>
            </XStack>
            <XStack gap={Spacing.sm}>
              <TouchableOpacity
                onPress={() => setIsFullscreen(f => !f)}
                hitSlop={8}
                accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                accessibilityRole="button"
              >
                {isFullscreen
                  ? <Minimize2 size={16} color="#8E8EA0" />
                  : <Maximize2 size={16} color="#8E8EA0" />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel="Close terminal"
                accessibilityRole="button"
              >
                <X size={16} color="#8E8EA0" />
              </TouchableOpacity>
            </XStack>
          </XStack>

          {/* Connection bar */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <XStack
              paddingHorizontal={Spacing.sm}
              paddingVertical={Spacing.xs}
              backgroundColor="#16162a"
              alignItems="center"
              gap={Spacing.xs}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="#2a2a4a"
            >
              <TextInput
                style={styles.urlInput}
                value={connectUrl}
                onChangeText={setConnectUrl}
                placeholder="ws://localhost:8080"
                placeholderTextColor="#555"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleConnect}
                accessibilityLabel="Terminal server URL"
              />
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={handleConnect}
                accessibilityLabel="Connect to terminal server"
                accessibilityRole="button"
              >
                <Text fontSize={FontSize.caption} fontWeight="600" color="#fff">
                  Connect
                </Text>
              </TouchableOpacity>
            </XStack>
          </KeyboardAvoidingView>

          {/* xterm.js WebView */}
          <WebView
            ref={webViewRef}
            source={{ html: XTERM_HTML }}
            style={{ flex: 1, backgroundColor: '#1a1a2e' }}
            javaScriptEnabled
            onMessage={handleWebViewMessage}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            allowsInlineMediaPlayback
            originWhitelist={['*']}
          />
        </YStack>
      </YStack>
    </Modal>
  );
});

const styles = StyleSheet.create({
  urlInput: {
    flex: 1,
    height: 32,
    backgroundColor: '#1a1a2e',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#e4e4e7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a4a',
  },
  connectBtn: {
    height: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: '#10A37F',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
