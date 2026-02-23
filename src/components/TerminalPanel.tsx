/**
 * TerminalPanel — Embedded xterm.js terminal via WebView.
 * Connects to remote shells through the Unified Bridge ACP protocol.
 * Supports spawning new PTY shells and connecting to existing tmux sessions.
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Modal, TouchableOpacity, StyleSheet, Platform, ScrollView, KeyboardAvoidingView } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { X, Maximize2, Minimize2, Terminal, Plus, List } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSize, Radius } from '../utils/theme';
import { useAppStore } from '../stores/appStore';
import { _service } from '../stores/storePrivate';
import { terminalEvents } from '../acp/terminalEvents';
import { ACPConnectionState } from '../acp/models/types';

interface TerminalSession {
  id: string;
  name: string;
  source: 'pty' | 'tmux';
}

interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
}

/**
 * Shared message handler logic for RN↔WebView bridge.
 * Injected into both xterm and ghostty HTML templates.
 */
const HANDLE_MSG_JS = `
    function handleMsg(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'write') term.write(msg.data);
        if (msg.type === 'clear') { term.clear(); term.reset(); }
        if (msg.type === 'info') term.writeln('\\x1b[36m' + msg.text + '\\x1b[0m');
        if (msg.type === 'error') term.writeln('\\x1b[31m' + msg.text + '\\x1b[0m');
      } catch { /* malformed JSON from RN bridge — safe to ignore */ }
    }
    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
`;

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
        black: '#1a1a2e', red: '#ef4444', green: '#10A37F', yellow: '#f59e0b',
        blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#e4e4e7',
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

    // Send user input to React Native
    term.onData((data) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'input', data }));
    });

    // Report resize
    new ResizeObserver(() => {
      fitAddon.fit();
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'resize', cols: term.cols, rows: term.rows
      }));
    }).observe(document.getElementById('terminal'));

    ${HANDLE_MSG_JS}

    term.writeln('\\x1b[1;36m╔══════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[1;36m║   Agentic Remote Terminal            ║\\x1b[0m');
    term.writeln('\\x1b[1;36m╚══════════════════════════════════════╝\\x1b[0m');
    term.writeln('');
    term.writeln('Tap \\x1b[32m+ New Shell\\x1b[0m or select a tmux session.');
    term.writeln('');

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'ready', cols: term.cols, rows: term.rows
    }));
  </script>
</body>
</html>
`;

// ghostty-web uses same API as xterm.js but WASM-compiled VT100 parser
const GHOSTTY_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #1a1a2e; overflow: hidden; }
    #terminal { height: 100%; width: 100%; }
    .xterm { height: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script type="module">
    import { init, Terminal } from 'https://esm.sh/ghostty-web@latest';

    await init();

    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e4e4e7',
        cursor: '#10A37F',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(16, 163, 127, 0.3)',
        black: '#1a1a2e', red: '#ef4444', green: '#10A37F', yellow: '#f59e0b',
        blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#e4e4e7',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 5000,
    });

    term.open(document.getElementById('terminal'));

    // FitAddon-like behavior: resize on container changes
    function fitTerminal() {
      const container = document.getElementById('terminal');
      const charWidth = 8;
      const charHeight = 16;
      const cols = Math.floor(container.clientWidth / charWidth);
      const rows = Math.floor(container.clientHeight / charHeight);
      if (cols > 0 && rows > 0) term.resize(cols, rows);
    }
    fitTerminal();

    term.onData((data) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'input', data }));
    });

    new ResizeObserver(() => {
      fitTerminal();
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'resize', cols: term.cols, rows: term.rows
      }));
    }).observe(document.getElementById('terminal'));

    ${HANDLE_MSG_JS}

    term.writeln('\\x1b[1;35m╔══════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[1;35m║   Agentic Terminal (Ghostty)         ║\\x1b[0m');
    term.writeln('\\x1b[1;35m╚══════════════════════════════════════╝\\x1b[0m');
    term.writeln('');
    term.writeln('Powered by \\x1b[35mghostty-web\\x1b[0m WASM terminal emulator.');
    term.writeln('Tap \\x1b[32m+ New Shell\\x1b[0m or select a tmux session.');
    term.writeln('');

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'ready', cols: term.cols, rows: term.rows
    }));
  </script>
</body>
</html>
`;

export const TerminalPanel = React.memo(function TerminalPanel() {
  const visible = useAppStore(s => s.terminalVisible);
  const setTerminalVisible = useAppStore(s => s.setTerminalVisible);
  const connectionState = useAppStore(s => s.connectionState);
  const terminalEngine = useAppStore(s => s.terminalEngine);
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [tmuxSessions, setTmuxSessions] = useState<TmuxSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<TerminalSession[]>([]);
  const [termSize, setTermSize] = useState({ cols: 80, rows: 24 });

  const isConnected = connectionState === ACPConnectionState.Connected;
  const onClose = useCallback(() => {
    setTerminalVisible(false);
    setShowPicker(false);
  }, [setTerminalVisible]);

  // Clean up terminal event listeners when terminal changes
  useEffect(() => {
    if (!activeTermId) return;
    const unsubData = terminalEvents.onData(activeTermId, (_id, data) => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'write', data }));
    });
    const unsubExit = terminalEvents.onExit(activeTermId, (_id, code) => {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'info', text: `\r\n[Process exited with code ${code}]`
      }));
      setActiveTermId(null);
    });
    return () => { unsubData(); unsubExit(); terminalEvents.cleanup(activeTermId); };
  }, [activeTermId]);

  const refreshSessions = useCallback(async () => {
    if (!isConnected) return;
    try {
      const svc = _service;
      if (!svc) return;
      const resp = await svc.terminalList();
      const result = resp.result as Record<string, unknown>;
      setActiveSessions((result.active as TerminalSession[]) || []);
      setTmuxSessions((result.tmuxSessions as TmuxSession[]) || []);
    } catch { /* bridge may not support terminal yet */ }
  }, [isConnected]);

  const handleSpawn = useCallback(async () => {
    if (!isConnected) return;
    const svc = _service;
    if (!svc) return;
    try {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
      webViewRef.current?.postMessage(JSON.stringify({ type: 'info', text: '⏳ Spawning shell...' }));
      const resp = await svc.terminalSpawn({ cols: termSize.cols, rows: termSize.rows });
      const info = resp.result as unknown as TerminalSession;
      setActiveTermId(info.id);
      setShowPicker(false);
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'info', text: `✓ Connected to ${info.name} (${info.id})\r\n`
      }));
    } catch (e) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'error', text: `✗ Failed to spawn: ${e}`
      }));
    }
  }, [isConnected, termSize]);

  const handleConnectTmux = useCallback(async (sessionName: string) => {
    if (!isConnected) return;
    const svc = _service;
    if (!svc) return;
    try {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'info', text: `⏳ Connecting to tmux:${sessionName}...`
      }));
      const resp = await svc.terminalConnectTmux(sessionName, termSize.cols, termSize.rows);
      const info = resp.result as unknown as TerminalSession;
      setActiveTermId(info.id);
      setShowPicker(false);
      webViewRef.current?.postMessage(JSON.stringify({ type: 'clear' }));
    } catch (e) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'error', text: `✗ Failed: ${e}`
      }));
    }
  }, [isConnected, termSize]);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'input' && activeTermId) {
        _service?.terminalInput(activeTermId, msg.data);
      }
      if (msg.type === 'resize') {
        setTermSize({ cols: msg.cols, rows: msg.rows });
        if (activeTermId) {
          _service?.terminalResize(activeTermId, msg.cols, msg.rows);
        }
      }
      if (msg.type === 'ready') {
        setTermSize({ cols: msg.cols, rows: msg.rows });
      }
    } catch { /* ignore */ }
  }, [activeTermId]);

  return (
    <Modal visible={visible} animationType="slide" transparent={!isFullscreen} onRequestClose={onClose}>
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
                {activeTermId ? `Terminal (${activeTermId})` : 'Terminal'}
              </Text>
            </XStack>
            <XStack gap={Spacing.sm}>
              <TouchableOpacity onPress={() => { setShowPicker(p => !p); refreshSessions(); }} hitSlop={8}>
                <List size={16} color="#8E8EA0" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSpawn} hitSlop={8}>
                <Plus size={16} color="#10A37F" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsFullscreen(f => !f)} hitSlop={8}>
                {isFullscreen ? <Minimize2 size={16} color="#8E8EA0" /> : <Maximize2 size={16} color="#8E8EA0" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={16} color="#8E8EA0" />
              </TouchableOpacity>
            </XStack>
          </XStack>

          {/* Session picker */}
          {showPicker && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <YStack
                backgroundColor="#16162a"
                paddingHorizontal={Spacing.sm}
                paddingVertical={Spacing.sm}
                borderBottomWidth={StyleSheet.hairlineWidth}
                borderBottomColor="#2a2a4a"
                maxHeight={200}
              >
                {!isConnected && (
                  <Text fontSize={FontSize.caption} color="#f59e0b" marginBottom={Spacing.xs}>
                    ⚠ Not connected to bridge. Connect first.
                  </Text>
                )}
                <TouchableOpacity style={styles.sessionBtn} onPress={handleSpawn} disabled={!isConnected}>
                  <Text fontSize={FontSize.caption} color={isConnected ? '#10A37F' : '#555'}>
                    + New Shell
                  </Text>
                </TouchableOpacity>

                {tmuxSessions.length > 0 && (
                  <>
                    <Text fontSize={10} color="#666" marginTop={Spacing.xs}>TMUX SESSIONS</Text>
                    <ScrollView style={{ maxHeight: 100 }}>
                      {tmuxSessions.map((s) => (
                        <TouchableOpacity
                          key={s.name}
                          style={styles.sessionBtn}
                          onPress={() => handleConnectTmux(s.name)}
                        >
                          <Text fontSize={FontSize.caption} color="#e4e4e7">
                            📺 {s.name} ({s.windows} windows){s.attached ? ' • attached' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {activeSessions.length > 0 && (
                  <>
                    <Text fontSize={10} color="#666" marginTop={Spacing.xs}>ACTIVE TERMINALS</Text>
                    {activeSessions.map((s) => (
                      <Text key={s.id} fontSize={FontSize.caption} color="#8E8EA0" paddingVertical={2}>
                        {s.source === 'tmux' ? '📺' : '🖥️'} {s.id} — {s.name}
                      </Text>
                    ))}
                  </>
                )}
              </YStack>
            </KeyboardAvoidingView>
          )}

          {/* xterm.js WebView */}
          <WebView
            ref={webViewRef}
            source={{ html: terminalEngine === 'ghostty' ? GHOSTTY_HTML : XTERM_HTML }}
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
  sessionBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: 2,
    backgroundColor: '#1a1a2e',
  },
});
